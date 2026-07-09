from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any, Iterable
from urllib import error, parse, request

from gurpsai.app.config import load_app_config
from gurpsai.domain.providers import ProviderCapabilities, ProviderModel, ProviderStatus
from gurpsai.domain.tools import Tool, ToolCall, StructuredOutputSchema
from gurpsai.providers.base import ChatMessage, ChatResult, LlmProvider


@dataclass(frozen=True)
class GeminiConfig:
    api_key: str | None = None
    base_url: str = "https://generativelanguage.googleapis.com/v1beta"
    timeout_seconds: float = 15.0


class GeminiProvider(LlmProvider):
    """Cloud provider adapter for the Gemini API."""

    def __init__(self, config: GeminiConfig | None = None) -> None:
        if config is None:
            app_config = load_app_config()
            config = GeminiConfig(
                api_key=app_config.gemini.api_key,
                base_url=app_config.gemini.base_url,
                timeout_seconds=app_config.gemini.timeout_seconds,
            )
        resolved = config
        self._config = resolved
        self._provider_capabilities = ProviderCapabilities(
            supports_streaming=True,
            supports_json_mode=True,
            supports_tools=True,
            max_context_tokens=None,
        )

    @property
    def provider_name(self) -> str:
        return "gemini"

    def capabilities(self) -> ProviderCapabilities:
        return self._provider_capabilities

    def health_check(self) -> bool:
        ok, _, _ = self._fetch_models()
        return ok

    def list_models(self) -> list[ProviderModel]:
        ok, payload, error_message = self._fetch_models()
        if not ok:
            raise RuntimeError(error_message or "Gemini is unavailable.")

        models_raw = payload.get("models", [])
        if not isinstance(models_raw, list):
            return []

        models: list[ProviderModel] = []
        seen_ids: set[str] = set()
        for item in models_raw:
            if not isinstance(item, dict):
                continue
            supported_actions = item.get("supportedGenerationMethods", [])
            if isinstance(supported_actions, list) and "generateContent" not in supported_actions:
                continue

            model_id = self._model_id_from_payload(item)
            if not model_id or model_id in seen_ids:
                continue

            display_name = item.get("displayName")
            if not isinstance(display_name, str) or not display_name.strip():
                display_name = model_id

            token_limit = item.get("inputTokenLimit")
            max_context_tokens = token_limit if isinstance(token_limit, int) else None

            models.append(
                ProviderModel(
                    id=model_id,
                    display_name=display_name,
                    provider=self.provider_name,
                    capabilities=ProviderCapabilities(
                        supports_streaming=True,
                        supports_json_mode=True,
                        supports_tools=True,
                        max_context_tokens=max_context_tokens,
                    ),
                )
            )
            seen_ids.add(model_id)

        models.sort(key=lambda model: self._sort_key(model.id))
        return models

    def describe_status(self) -> ProviderStatus:
        if not self._config.api_key:
            return ProviderStatus(
                name=self.provider_name,
                display_name="Gemini",
                available=False,
                configured=False,
                error_message="Add GEMINI_API_KEY to .env to enable Gemini.",
                base_url=self._config.base_url,
                capabilities=self._provider_capabilities,
                models=[],
            )

        ok, _, error_message = self._fetch_models()
        models: list[ProviderModel] = []
        if ok:
            try:
                models = self.list_models()
            except RuntimeError as exc:
                error_message = str(exc)
                ok = False

        return ProviderStatus(
            name=self.provider_name,
            display_name="Gemini",
            available=ok,
            configured=True,
            error_message=error_message,
            base_url=self._config.base_url,
            capabilities=self._provider_capabilities,
            models=models,
        )

    def chat(
        self,
        messages: list[ChatMessage],
        *,
        model: str,
        tools: list[Tool] | None = None,
        response_schema: StructuredOutputSchema | None = None,
    ) -> ChatResult:
        if not self._config.api_key:
            raise RuntimeError("Add GEMINI_API_KEY to .env before using Gemini.")

        content_messages, system_messages = self._format_messages(messages)

        payload: dict[str, Any] = {"contents": content_messages}
        if system_messages:
            payload["system_instruction"] = {
                "parts": [{"text": "\n\n".join(system_messages)}]
            }

        formatted_tools = self._format_tools(tools)
        if formatted_tools:
            payload["tools"] = formatted_tools

        if response_schema is not None:
            payload["generationConfig"] = {
                "responseMimeType": response_schema.mime_type,
                "responseSchema": response_schema.schema,
                "maxOutputTokens": 8192,
            }
        else:
            payload["generationConfig"] = {
                "maxOutputTokens": 8192,
            }

        data = self._post_json(
            f"/models/{model}:generateContent",
            payload,
            timeout=max(self._config.timeout_seconds, 120.0),
        )
        candidates = data.get("candidates", [])
        if not isinstance(candidates, list) or not candidates:
            raise RuntimeError("Gemini returned no candidates.")
        candidate = candidates[0]
        if not isinstance(candidate, dict):
            raise RuntimeError("Gemini returned an unexpected candidate payload.")
        content = candidate.get("content", {})
        if not isinstance(content, dict):
            raise RuntimeError("Gemini returned no content in the candidate response.")
        parts = content.get("parts", [])
        if not isinstance(parts, list) or not parts:
            raise RuntimeError("Gemini returned no text parts.")
            
        text_chunks = []
        tool_calls = []
        for part in parts:
            if isinstance(part, dict):
                text = part.get("text")
                if isinstance(text, str):
                    text_chunks.append(text)
                fn_call = part.get("functionCall")
                if isinstance(fn_call, dict):
                    name = fn_call.get("name")
                    args = fn_call.get("args", {})
                    if isinstance(name, str):
                        tool_calls.append(ToolCall(id=name, name=name, arguments=args, raw=part))
                        
        return ChatResult(text="".join(text_chunks), model=model, provider=self.provider_name, tool_calls=tool_calls)

    def stream_chat(
        self,
        messages: list[ChatMessage],
        *,
        model: str,
        tools: list[Tool] | None = None,
        response_schema: StructuredOutputSchema | None = None,
    ) -> Iterable[str | ToolCall]:
        if not self._config.api_key:
            raise RuntimeError("Add GEMINI_API_KEY to .env before using Gemini.")

        content_messages, system_messages = self._format_messages(messages)

        payload: dict[str, Any] = {"contents": content_messages}
        if system_messages:
            payload["system_instruction"] = {
                "parts": [{"text": "\n\n".join(system_messages)}]
            }

        formatted_tools = self._format_tools(tools)
        if formatted_tools:
            payload["tools"] = formatted_tools

        if response_schema is not None:
            payload["generationConfig"] = {
                "responseMimeType": response_schema.mime_type,
                "responseSchema": response_schema.schema,
                "maxOutputTokens": 8192,
            }
        else:
            payload["generationConfig"] = {
                "maxOutputTokens": 8192,
            }

        url = self._with_api_key(f"{self._config.base_url}/models/{model}:streamGenerateContent")
        if "?" in url:
            url += "&alt=sse"
        else:
            url += "?alt=sse"
            
        body = json.dumps(payload).encode("utf-8")
        req = request.Request(
            url,
            data=body,
            headers={
                "Content-Type": "application/json",
                "x-goog-api-key": self._config.api_key,
            },
            method="POST",
        )
        
        try:
            with request.urlopen(req) as response:
                buffer = []
                for line in response:
                    decoded = line.decode("utf-8")
                    if not decoded.strip():
                        # End of event
                        if buffer:
                            data_str = "".join(buffer)
                            buffer = []
                            try:
                                data = json.loads(data_str)
                                candidates = data.get("candidates", [])
                                if candidates and isinstance(candidates, list):
                                    candidate = candidates[0]
                                    content = candidate.get("content", {})
                                    parts = content.get("parts", [])
                                    for part in parts:
                                        if isinstance(part, dict):
                                            text = part.get("text", "")
                                            if text:
                                                yield text
                                            fn_call = part.get("functionCall")
                                            if isinstance(fn_call, dict):
                                                name = fn_call.get("name")
                                                args = fn_call.get("args", {})
                                                if isinstance(name, str):
                                                    yield ToolCall(id=name, name=name, arguments=args, raw=part)
                            except json.JSONDecodeError:
                                pass
                        continue
                    
                    if decoded.startswith("data:"):
                        content = decoded[5:]
                        if content.startswith(" "):
                            content = content[1:]
                        buffer.append(content)
        except error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace")
            raise RuntimeError(f"Gemini request failed: HTTP {exc.code}: {detail}") from exc
        except error.URLError as exc:
            reason = exc.reason if hasattr(exc, "reason") else exc
            raise RuntimeError(f"Could not reach Gemini API: {reason}") from exc

    def _format_messages(self, messages: list[ChatMessage]) -> tuple[list[dict[str, Any]], list[str]]:
        system_messages = [message.content for message in messages if message.role == "system"]
        content_messages = []
        for message in messages:
            if message.role == "system":
                continue
            if message.role == "tool":
                content_messages.append({
                    "role": "user",
                    "parts": [{"functionResponse": {"name": message.tool_call_id, "response": {"name": message.tool_call_id, "content": message.content}}}]
                })
                continue
                
            api_role = "model" if message.role == "assistant" else "user"
            parts = []
            if message.content:
                parts.append({"text": message.content})
            if message.tool_calls:
                for tc in message.tool_calls:
                    if tc.raw is not None:
                        parts.append(tc.raw)
                    else:
                        parts.append({"functionCall": {"name": tc.name, "args": tc.arguments}})
            if parts:
                content_messages.append({"role": api_role, "parts": parts})
                
        return content_messages, system_messages

    def _format_tools(self, tools: list[Tool] | None) -> list[dict[str, Any]] | None:
        if not tools:
            return None
        decls = []
        for tool in tools:
            props = {}
            for param_name, param in tool.parameters.items():
                props[param_name] = {
                    "type": param.type.upper(),
                    "description": param.description
                }
                if param.enum:
                    props[param_name]["enum"] = param.enum
            decl = {
                "name": tool.name,
                "description": tool.description,
                "parameters": {
                    "type": "OBJECT",
                    "properties": props,
                    "required": tool.required_parameters
                }
            }
            decls.append(decl)
        return [{"functionDeclarations": decls}]

    def _fetch_models(self) -> tuple[bool, dict[str, Any], str | None]:
        if not self._config.api_key:
            return False, {}, "Add GEMINI_API_KEY to .env to enable Gemini."
        try:
            payload = self._get_json("/models")
        except RuntimeError as exc:
            return False, {}, str(exc)
        return True, payload, None

    def _get_json(self, path: str) -> dict[str, Any]:
        if not self._config.api_key:
            raise RuntimeError("Add GEMINI_API_KEY to .env to enable Gemini.")
        url = self._with_api_key(f"{self._config.base_url}{path}")
        req = request.Request(url, headers={"x-goog-api-key": self._config.api_key}, method="GET")
        try:
            with request.urlopen(req, timeout=self._config.timeout_seconds) as response:
                body = response.read().decode("utf-8")
        except error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace")
            raise RuntimeError(f"Gemini request failed: HTTP {exc.code}: {detail}") from exc
        except error.URLError as exc:
            reason = exc.reason if hasattr(exc, "reason") else exc
            raise RuntimeError(f"Could not reach Gemini API: {reason}") from exc

        try:
            data = json.loads(body)
        except json.JSONDecodeError as exc:
            raise RuntimeError("Gemini returned invalid JSON.") from exc
        if not isinstance(data, dict):
            raise RuntimeError("Gemini returned an unexpected payload shape.")
        return data

    def _post_json(self, path: str, payload: dict[str, Any], *, timeout: float | None = None) -> dict[str, Any]:
        if not self._config.api_key:
            raise RuntimeError("Add GEMINI_API_KEY to .env to enable Gemini.")
        url = self._with_api_key(f"{self._config.base_url}{path}")
        body = json.dumps(payload).encode("utf-8")
        req = request.Request(
            url,
            data=body,
            headers={
                "Content-Type": "application/json",
                "x-goog-api-key": self._config.api_key,
            },
            method="POST",
        )
        effective_timeout = timeout if timeout is not None else self._config.timeout_seconds
        try:
            with request.urlopen(req, timeout=effective_timeout) as response:
                response_body = response.read().decode("utf-8")
        except error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace")
            raise RuntimeError(f"Gemini request failed: HTTP {exc.code}: {detail}") from exc
        except error.URLError as exc:
            reason = exc.reason if hasattr(exc, "reason") else exc
            raise RuntimeError(f"Could not reach Gemini API: {reason}") from exc

        try:
            data = json.loads(response_body)
        except json.JSONDecodeError as exc:
            raise RuntimeError("Gemini returned invalid JSON.") from exc
        if not isinstance(data, dict):
            raise RuntimeError("Gemini returned an unexpected payload shape.")
        return data

    def _with_api_key(self, url: str) -> str:
        if not self._config.api_key:
            return url
        query = parse.urlencode({"key": self._config.api_key})
        separator = "&" if "?" in url else "?"
        return f"{url}{separator}{query}"

    def _model_id_from_payload(self, item: dict[str, Any]) -> str | None:
        base_model_id = item.get("baseModelId")
        if isinstance(base_model_id, str) and base_model_id.strip():
            return base_model_id

        name = item.get("name")
        if isinstance(name, str) and name.startswith("models/"):
            return name.split("/", 1)[1]
        return None

    def _sort_key(self, model_id: str) -> tuple[int, str]:
        preferred = {
            "gemini-2.5-flash": 0,
            "gemini-2.5-pro": 1,
            "gemini-2.5-flash-lite": 2,
            "gemini-2.0-flash": 3,
        }
        return (preferred.get(model_id, 50), model_id)
