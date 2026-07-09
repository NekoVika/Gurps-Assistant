from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Iterable

from gurpsai.domain.providers import ProviderCapabilities, ProviderModel, ProviderStatus
from gurpsai.domain.tools import Tool, ToolCall, StructuredOutputSchema


@dataclass(frozen=True)
class ChatMessage:
    role: str
    content: str
    tool_calls: list[ToolCall] = field(default_factory=list)
    tool_call_id: str | None = None


@dataclass(frozen=True)
class ChatResult:
    text: str
    model: str
    provider: str
    tool_calls: list[ToolCall] = field(default_factory=list)


class LlmProvider(ABC):
    """Common interface for local and cloud language-model providers."""

    @property
    @abstractmethod
    def provider_name(self) -> str:
        """Stable provider identifier."""

    @abstractmethod
    def health_check(self) -> bool:
        """Return True when the provider is ready to accept requests."""

    @abstractmethod
    def list_models(self) -> list[ProviderModel]:
        """Return the models available through this provider."""

    @abstractmethod
    def capabilities(self) -> ProviderCapabilities:
        """Return provider-level capabilities."""

    @abstractmethod
    def describe_status(self) -> ProviderStatus:
        """Return current provider availability, capabilities, and model info."""

    @abstractmethod
    def chat(
        self,
        messages: list[ChatMessage],
        *,
        model: str,
        tools: list[Tool] | None = None,
        response_schema: StructuredOutputSchema | None = None,
    ) -> ChatResult:
        """Perform a non-streaming chat request.

        If ``response_schema`` is provided and the provider supports JSON mode
        (``capabilities().supports_json_mode``), the response will be constrained
        to valid JSON matching the given schema.
        """

    def stream_chat(
        self,
        messages: list[ChatMessage],
        *,
        model: str,
        tools: list[Tool] | None = None,
        response_schema: StructuredOutputSchema | None = None,
    ) -> Iterable[str | ToolCall]:
        """Yield streamed content chunks or tool calls when streaming is supported."""
        raise NotImplementedError(f"{self.provider_name} does not implement streaming chat.")
