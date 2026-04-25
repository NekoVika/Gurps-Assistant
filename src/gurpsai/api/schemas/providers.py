from __future__ import annotations

from pydantic import BaseModel, Field


class ProviderCapabilitiesResponse(BaseModel):
    supports_streaming: bool = Field(default=False)
    supports_json_mode: bool = Field(default=False)
    supports_tools: bool = Field(default=False)
    max_context_tokens: int | None = Field(default=None)


class ProviderModelResponse(BaseModel):
    id: str
    display_name: str
    provider: str
    capabilities: ProviderCapabilitiesResponse


class ProviderStatusResponse(BaseModel):
    name: str
    display_name: str
    available: bool
    configured: bool
    error_message: str | None = None
    base_url: str | None = None
    capabilities: ProviderCapabilitiesResponse
    models: list[ProviderModelResponse]
