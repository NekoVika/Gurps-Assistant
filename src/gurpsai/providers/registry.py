from __future__ import annotations

from gurpsai.providers.base import LlmProvider


class ProviderRegistry:
    """In-memory registry for provider adapters."""

    def __init__(self) -> None:
        self._providers: dict[str, LlmProvider] = {}

    def register(self, provider: LlmProvider) -> None:
        self._providers[provider.provider_name] = provider

    def get(self, provider_name: str) -> LlmProvider:
        try:
            return self._providers[provider_name]
        except KeyError as exc:
            raise KeyError(f"Unknown provider: {provider_name}") from exc

    def list_provider_names(self) -> list[str]:
        return sorted(self._providers.keys())

    def list_providers(self) -> list[LlmProvider]:
        return [self._providers[name] for name in self.list_provider_names()]
