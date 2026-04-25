from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Iterable

from gurpsai.domain.providers import ProviderCapabilities, ProviderModel, ProviderStatus


@dataclass(frozen=True)
class ChatMessage:
    role: str
    content: str


@dataclass(frozen=True)
class ChatResult:
    text: str
    model: str
    provider: str


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
    def chat(self, messages: list[ChatMessage], *, model: str) -> ChatResult:
        """Perform a non-streaming chat request."""

    def stream_chat(self, messages: list[ChatMessage], *, model: str) -> Iterable[str]:
        """Yield streamed content chunks when streaming is supported."""
        raise NotImplementedError(f"{self.provider_name} does not implement streaming chat.")
