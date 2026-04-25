from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(frozen=True)
class ProviderCapabilities:
    supports_streaming: bool = False
    supports_json_mode: bool = False
    supports_tools: bool = False
    max_context_tokens: int | None = None


@dataclass(frozen=True)
class ProviderModel:
    id: str
    display_name: str
    provider: str
    capabilities: ProviderCapabilities = field(default_factory=ProviderCapabilities)


@dataclass(frozen=True)
class ProviderStatus:
    name: str
    display_name: str
    available: bool
    configured: bool = True
    error_message: str | None = None
    base_url: str | None = None
    capabilities: ProviderCapabilities = field(default_factory=ProviderCapabilities)
    models: list[ProviderModel] = field(default_factory=list)
