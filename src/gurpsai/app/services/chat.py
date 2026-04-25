from __future__ import annotations

from typing import Iterable
from gurpsai.providers.base import ChatMessage, ChatResult

from gurpsai.app.services.providers import ProviderService
from gurpsai.app.services.context import ContextService
from gurpsai.app.services.activity import ActivityService


class ChatService:
    """Simple provider-aware chat service."""

    def __init__(self, provider_service: ProviderService | None = None, context_service: ContextService | None = None) -> None:
        self._provider_service = provider_service or ProviderService()
        self._context_service = context_service or ContextService()

    def _prepare_messages(self, messages: list[ChatMessage]) -> list[ChatMessage]:
        system_prompt = self._context_service.build_system_prompt()
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
    ) -> Iterable[str]:
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
        ready_messages = self._prepare_messages(messages)
        
        last_user_msg = next((m.content for m in reversed(messages) if m.role == "user"), "Unknown")
        ActivityService().log_event(
            event_type="CHAT",
            description=f"Started streaming chat",
            metadata={"model": chosen_model, "provider": provider_name, "prompt_preview": last_user_msg[:100]}
        )
        
        return provider.stream_chat(ready_messages, model=chosen_model)

