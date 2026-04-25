from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any
from urllib import error, request

from gurpsai.app.config import load_app_config
from gurpsai.domain.providers import ProviderCapabilities, ProviderModel, ProviderStatus
from gurpsai.providers.base import ChatMessage, ChatResult, LlmProvider


@dataclass(frozen=True)
class OllamaConfig:
    base_url: str = "http://127.0.0.1:11434"
    timeout_seconds: float = 120.0


class OllamaProvider(LlmProvider):
    """Local provider adapter for Ollama."""

    def __init__(self, config: OllamaConfig | None = None) -> None:
        if config is None:
            app_config = load_app_config()
            config = OllamaConfig(
                base_url=app_config.ollama.base_url,
                timeout_seconds=app_config.ollama.timeout_seconds,
            )
        self._config = config
        self._provider_capabilities = ProviderCapabilities(
            supports_streaming=True,
            supports_json_mode=False,
            supports_tools=False,
            max_context_tokens=None,
        )

    @property
    def provider_name(self) -> str:
        return "ollama"

    def capabilities(self) -> ProviderCapabilities:
        return self._provider_capabilities

    def health_check(self) -> bool:
        ok, _, _ = self._fetch_tags()
        return ok

    def list_models(self) -> list[ProviderModel]:
        ok, payload, error_message = self._fetch_tags()
        if not ok:
            raise RuntimeError(error_message or "Ollama is unavailable.")

        models_raw = payload.get("models", [])
        if not isinstance(models_raw, list):
            return []

        models: list[ProviderModel] = []
        for item in models_raw:
            if not isinstance(item, dict):
                continue
            model_id = item.get("model") or item.get("name")
            if not isinstance(model_id, str) or not model_id.strip():
                continue
            display_name = item.get("name") if isinstance(item.get("name"), str) else model_id
            models.append(
                ProviderModel(
                    id=model_id,
                    display_name=display_name,
                    provider=self.provider_name,
                    capabilities=self._provider_capabilities,
                )
            )
        return models

    def describe_status(self) -> ProviderStatus:
        ok, _, error_message = self._fetch_tags()
        models: list[ProviderModel] = []
        if ok:
            try:
                models = self.list_models()
            except RuntimeError as exc:
                error_message = str(exc)
                ok = False

        return ProviderStatus(
            name=self.provider_name,
            display_name="Ollama",
            available=ok,
            configured=True,
            error_message=error_message,
            base_url=self._config.base_url,
            capabilities=self._provider_capabilities,
            models=models,
        )

    def chat(self, messages: list[ChatMessage], *, model: str) -> ChatResult:
        payload = {
            "model": model,
            "stream": False,
            "messages": [{"role": message.role, "content": message.content} for message in messages],
            "options": {"num_ctx": 32768},
        }
        data = self._post_json("/api/chat", payload)
        reply = data.get("message", {})
        if not isinstance(reply, dict):
            raise RuntimeError("Ollama returned an unexpected chat payload.")
        text = reply.get("content")
        if not isinstance(text, str):
            raise RuntimeError("Ollama response did not include message content.")
        return ChatResult(text=text, model=model, provider=self.provider_name)

    def stream_chat(self, messages: list[ChatMessage], *, model: str) -> Iterable[str]:
        payload = {
            "model": model,
            "stream": True,
            "messages": [{"role": message.role, "content": message.content} for message in messages],
            "options": {"num_ctx": 32768},
        }
        url = f"{self._config.base_url}/api/chat"
        body = json.dumps(payload).encode("utf-8")
        req = request.Request(
            url,
            data=body,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            with request.urlopen(req, timeout=self._config.timeout_seconds) as response:
                for line in response:
                    decoded = line.decode("utf-8").strip()
                    if not decoded:
                        continue
                    try:
                        data = json.loads(decoded)
                        chunk = data.get("message", {}).get("content", "")
                        if chunk:
                            yield chunk
                    except json.JSONDecodeError:
                        pass
        except error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace")
            raise RuntimeError(f"Ollama request failed: HTTP {exc.code}: {detail}") from exc
        except error.URLError as exc:
            reason = exc.reason if hasattr(exc, "reason") else exc
            raise RuntimeError(f"Could not reach Ollama at {self._config.base_url}: {reason}") from exc

    def _fetch_tags(self) -> tuple[bool, dict[str, Any], str | None]:
        try:
            payload = self._get_json("/api/tags")
        except RuntimeError as exc:
            return False, {}, str(exc)
        return True, payload, None

    def _get_json(self, path: str) -> dict[str, Any]:
        url = f"{self._config.base_url}{path}"
        req = request.Request(url, method="GET")
        try:
            with request.urlopen(req, timeout=self._config.timeout_seconds) as response:
                body = response.read().decode("utf-8")
        except error.URLError as exc:
            reason = exc.reason if hasattr(exc, "reason") else exc
            raise RuntimeError(f"Could not reach Ollama at {self._config.base_url}: {reason}") from exc

        try:
            data = json.loads(body)
        except json.JSONDecodeError as exc:
            raise RuntimeError("Ollama returned invalid JSON.") from exc
        if not isinstance(data, dict):
            raise RuntimeError("Ollama returned an unexpected payload shape.")
        return data

    def _post_json(self, path: str, payload: dict[str, Any]) -> dict[str, Any]:
        url = f"{self._config.base_url}{path}"
        body = json.dumps(payload).encode("utf-8")
        req = request.Request(
            url,
            data=body,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            with request.urlopen(req, timeout=self._config.timeout_seconds) as response:
                response_body = response.read().decode("utf-8")
        except error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace")
            raise RuntimeError(f"Ollama request failed: HTTP {exc.code}: {detail}") from exc
        except error.URLError as exc:
            reason = exc.reason if hasattr(exc, "reason") else exc
            raise RuntimeError(f"Could not reach Ollama at {self._config.base_url}: {reason}") from exc

        try:
            data = json.loads(response_body)
        except json.JSONDecodeError as exc:
            raise RuntimeError("Ollama returned invalid JSON.") from exc
        if not isinstance(data, dict):
            raise RuntimeError("Ollama returned an unexpected payload shape.")
        return data
