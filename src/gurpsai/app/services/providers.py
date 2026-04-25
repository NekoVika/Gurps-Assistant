from __future__ import annotations

from gurpsai.domain.providers import ProviderStatus
from gurpsai.providers.base import LlmProvider
from gurpsai.providers.gemini import GeminiProvider
from gurpsai.providers.ollama import OllamaProvider
from gurpsai.providers.registry import ProviderRegistry


def build_default_provider_registry() -> ProviderRegistry:
    registry = ProviderRegistry()
    registry.register(GeminiProvider())
    registry.register(OllamaProvider())
    return registry


class ProviderService:
    """Service layer for provider discovery and status reporting."""

    def __init__(self, registry: ProviderRegistry | None = None) -> None:
        self._registry = registry or build_default_provider_registry()

    def list_statuses(self) -> list[ProviderStatus]:
        return [provider.describe_status() for provider in self._registry.list_providers()]

    def get_provider(self, provider_name: str) -> LlmProvider:
        return self._registry.get(provider_name)

    def get_status(self, provider_name: str) -> ProviderStatus:
        provider = self.get_provider(provider_name)
        return provider.describe_status()
