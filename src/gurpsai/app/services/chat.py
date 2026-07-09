from __future__ import annotations

import json
import logging
from typing import Iterable, Any
from gurpsai.providers.base import ChatMessage, ChatResult
from gurpsai.domain.tools import Tool, ToolParameter, ToolCall, StructuredOutputSchema

from gurpsai.app.services.providers import ProviderService
from gurpsai.app.services.context import ContextService
from gurpsai.app.services.activity import ActivityService
from gurpsai.app.services.files import CampaignFileService
from gurpsai.app.services.rules import RulesQaService

logger = logging.getLogger(__name__)


class ChatService:
    """Simple provider-aware chat service."""

    def __init__(self, provider_service: ProviderService | None = None, context_service: ContextService | None = None) -> None:
        self._provider_service = provider_service or ProviderService()
        self._context_service = context_service or ContextService()

    def _prepare_messages(self, messages: list[ChatMessage], extra_instructions: str | None = None) -> list[ChatMessage]:
        system_prompt = self._context_service.build_system_prompt()
        if extra_instructions:
            system_prompt += f"\n\n{extra_instructions}"
        return [ChatMessage(role="system", content=system_prompt)] + messages

    def chat(
        self,
        *,
        provider_name: str,
        model: str | None,
        messages: list[ChatMessage],
    ) -> ChatResult:
        if not messages:
            raise ValueError("At least one chat message is required.")

        status = self._provider_service.get_status(provider_name)
        if not status.available:
            detail = status.error_message or f"Provider '{provider_name}' is unavailable."
            raise RuntimeError(detail)

        chosen_model = model
        if not chosen_model:
            if len(status.models) == 1:
                chosen_model = status.models[0].id
            elif len(status.models) == 0:
                raise ValueError(f"No models are available for provider '{provider_name}'.")
            else:
                raise ValueError(f"Provider '{provider_name}' has multiple models; pick one explicitly.")

        provider = self._provider_service.get_provider(provider_name)
        ready_messages = self._prepare_messages(messages)
        
        last_user_msg = next((m.content for m in reversed(messages) if m.role == "user"), "Unknown")
        ActivityService().log_event(
            event_type="CHAT",
            description=f"Sent a chat message",
            metadata={"model": chosen_model, "provider": provider_name, "prompt_preview": last_user_msg[:100]}
        )
        
        return provider.chat(ready_messages, model=chosen_model)

    def stream_chat(
        self,
        *,
        provider_name: str,
        model: str | None,
        messages: list[ChatMessage],
    ) -> Iterable[dict[str, Any]]:
        if not messages:
            raise ValueError("At least one chat message is required.")

        status = self._provider_service.get_status(provider_name)
        if not status.available:
            detail = status.error_message or f"Provider '{provider_name}' is unavailable."
            raise RuntimeError(detail)

        chosen_model = model
        if not chosen_model:
            if len(status.models) == 1:
                chosen_model = status.models[0].id
            elif len(status.models) == 0:
                raise ValueError(f"No models are available for provider '{provider_name}'.")
            else:
                raise ValueError(f"Provider '{provider_name}' has multiple models; pick one explicitly.")

        provider = self._provider_service.get_provider(provider_name)
        if not provider.capabilities().supports_streaming:
            raise RuntimeError(f"Provider '{provider_name}' does not support streaming.")
            
        tools = None
        if provider.capabilities().supports_tools:
            tools = [
                Tool(
                    name="read_file",
                    description="Read the contents of a campaign file. Use this to read existing notes or templates.",
                    parameters={"path": ToolParameter(type="string", description="The path to the file, e.g. Campaign/01_World_Bible/Locations/City.json")},
                    required_parameters=["path"]
                ),
                Tool(
                    name="query_rules",
                    description="Query the GURPS 4e Rules Database for mechanics and page references.",
                    parameters={"query": ToolParameter(type="string", description="The search query, e.g. 'Deceptive Attack'")},
                    required_parameters=["query"]
                ),
                Tool(
                    name="draft_file",
                    description="Propose the complete content for a new or updated campaign file.",
                    parameters={
                        "path": ToolParameter(type="string", description="The path where the file should be saved."),
                        "content": ToolParameter(type="string", description="The complete file content. Must be a valid JSON object if updating a JSON file.")
                    },
                    required_parameters=["path", "content"]
                )
            ]

        ready_messages = self._prepare_messages(messages)
        
        last_user_msg = next((m.content for m in reversed(messages) if m.role == "user"), "Unknown")
        ActivityService().log_event(
            event_type="CHAT",
            description=f"Started streaming chat",
            metadata={"model": chosen_model, "provider": provider_name, "prompt_preview": last_user_msg[:100]}
        )
        
        while True:
            stream = provider.stream_chat(ready_messages, model=chosen_model, tools=tools)
            tool_calls_in_stream = []
            
            for chunk in stream:
                if isinstance(chunk, str):
                    yield {"type": "text", "content": chunk}
                elif isinstance(chunk, ToolCall):
                    tool_calls_in_stream.append(chunk)

            if not tool_calls_in_stream:
                break
                
            ready_messages.append(ChatMessage(role="assistant", content="", tool_calls=tool_calls_in_stream))
            
            # Emit tool_calls to frontend so it can sync its history
            calls_list = [{"id": tc.id, "name": tc.name, "arguments": tc.arguments, "raw": tc.raw} for tc in tool_calls_in_stream]
            yield {"type": "tool_calls", "tool_calls": calls_list}
            
            for tc in tool_calls_in_stream:
                if tc.name == "read_file":
                    path = tc.arguments.get("path", "")
                    yield {"type": "status", "message": f"📖 Reading file: {path}"}
                    try:
                        content = CampaignFileService().read_file(path).content
                    except Exception as e:
                        content = f"Error: {e}"
                    ready_messages.append(ChatMessage(role="tool", content=content, tool_call_id=tc.id))
                    yield {"type": "tool_response", "tool_call_id": tc.id, "content": content}
                    
                elif tc.name == "query_rules":
                    query = tc.arguments.get("query", "")
                    yield {"type": "status", "message": f"⚖️ Querying rules: {query}"}
                    try:
                        content = RulesQaService().ask(query)
                    except Exception as e:
                        content = f"Error: {e}"
                    ready_messages.append(ChatMessage(role="tool", content=content, tool_call_id=tc.id))
                    yield {"type": "tool_response", "tool_call_id": tc.id, "content": content}
                    
                elif tc.name == "draft_file":
                    path = tc.arguments.get("path", "")
                    content = tc.arguments.get("content", "")
                    yield {"type": "draft", "path": path, "content": content}
                    msg_content = "Draft presented to user for review."
                    ready_messages.append(ChatMessage(role="tool", content=msg_content, tool_call_id=tc.id))
                    yield {"type": "tool_response", "tool_call_id": tc.id, "content": msg_content}

    def structured_chat(
        self,
        *,
        provider_name: str,
        model: str | None,
        messages: list[ChatMessage],
        schema: dict,
        creativity_level: str = "Balanced",
        narrative_intent: str | None = None,
        placement_context: str | None = None,
    ) -> dict:
        """Run a non-streaming chat request with JSON mode and return a parsed dict.

        This is the correct entry point for workflow use (create_npc, prep_session,
        entity generation, etc.) where structured JSON output is required.

        Raises:
            ValueError: if messages are empty, no model can be selected, or the
                provider does not support JSON mode.
            RuntimeError: if the provider is unavailable.
            json.JSONDecodeError: if the model returns invalid JSON despite schema enforcement.
        """
        if not messages:
            raise ValueError("At least one chat message is required.")

        status = self._provider_service.get_status(provider_name)
        if not status.available:
            detail = status.error_message or f"Provider '{provider_name}' is unavailable."
            raise RuntimeError(detail)

        if not status.capabilities.supports_json_mode:
            raise ValueError(
                f"Provider '{provider_name}' does not support JSON mode / structured outputs."
            )

        chosen_model = model
        if not chosen_model:
            if len(status.models) == 0:
                raise ValueError(f"No models are available for provider '{provider_name}'.")
            # Auto-select: prefer the first model when none is explicitly requested.
            # This mirrors the behaviour of the UI model selector.
            if len(status.models) == 1:
                chosen_model = status.models[0].id
            else:
                chosen_model = status.models[0].id
                logging.warning(
                    "structured_chat: multiple models available for '%s', auto-selected '%s'. "
                    "Pass model= explicitly to suppress this warning.",
                    provider_name,
                    chosen_model,
                )

        provider = self._provider_service.get_provider(provider_name)
        response_schema = StructuredOutputSchema(schema=schema)
        
        extra_instructions = []
        if placement_context:
            extra_instructions.append(f"PLACEMENT CONTEXT:\n{placement_context}")
        if narrative_intent:
            extra_instructions.append(f"NARRATIVE INTENT:\n{narrative_intent}")
            
        if creativity_level == "Strict":
            extra_instructions.append("CREATIVITY RESTRICTION: STRICT.\nCRITICAL: Do NOT invent any new NPCs, Factions, Locations, or Story Events. Only reference entities explicitly provided in the context. Do NOT create relations to existing entities unless explicitly requested to do so.")
        elif creativity_level == "Balanced":
            extra_instructions.append("CREATIVITY RESTRICTION: BALANCED.\nYou may invent minor localized entities (like an innkeeper, a single shop) but do not invent major factions, overarching villains, or major world locations. You may link to existing major entities if it is highly relevant.")
        elif creativity_level == "Unrestricted":
            extra_instructions.append("CREATIVITY RESTRICTION: UNRESTRICTED.\nYou have full creative freedom to invent new factions, locations, characters, and sweeping relations to enrich the story.")
            
        ready_messages = self._prepare_messages(messages, extra_instructions="\n\n".join(extra_instructions) if extra_instructions else None)

        last_user_msg = next((m.content for m in reversed(messages) if m.role == "user"), "Unknown")
        ActivityService().log_event(
            event_type="STRUCTURED_CHAT",
            description="Ran structured chat with JSON schema enforcement",
            metadata={"model": chosen_model, "provider": provider_name, "prompt_preview": last_user_msg[:100]},
        )

        # Use the streaming endpoint internally rather than the blocking chat() call.
        # The streaming path has per-chunk read timeouts rather than a single
        # total-response timeout, so it handles long-running structured generation
        # (e.g. full GURPS character builds) without hitting urllib read timeouts.
        text_chunks: list[str] = []
        for chunk in provider.stream_chat(
            ready_messages,
            model=chosen_model,
            response_schema=response_schema,
        ):
            if isinstance(chunk, str):
                text_chunks.append(chunk)
            # ToolCall chunks are ignored — schema-enforced responses never call tools.

        full_text = "".join(text_chunks).strip()

        # --- Robust JSON extraction ---
        # Step 1: strip markdown code fences if the model wrapped its output despite instructions.
        # Handles: ```json\n{...}\n``` and ```\n{...}\n```
        import re as _re
        fenced = _re.match(r"^```(?:json)?\s*([\s\S]*?)```\s*$", full_text, _re.IGNORECASE)
        if fenced:
            full_text = fenced.group(1).strip()

        # Step 2: scan forward to the first { or [ so any remaining preamble prose is skipped.
        # raw_decode then handles any trailing text after the closing brace.
        start = next((i for i, ch in enumerate(full_text) if ch in "{["), None)
        if start is None:
            raise json.JSONDecodeError("No JSON object found in model response", full_text, 0)
        if start > 0:
            logger.warning(
                "structured_chat: skipped %d leading characters before JSON object", start
            )
            full_text = full_text[start:]

        decoder = json.JSONDecoder()
        try:
            obj, _ = decoder.raw_decode(full_text)
        except json.JSONDecodeError as exc:
            logger.error(
                "structured_chat: JSON parse failed at char %d — raw output (first 800 chars): %r",
                exc.pos,
                full_text[:800],
            )
            raise
        return obj

