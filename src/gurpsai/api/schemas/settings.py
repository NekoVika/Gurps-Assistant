from __future__ import annotations

from pydantic import BaseModel, Field


class ProviderSettingsResponse(BaseModel):
    gemini_api_key_configured: bool
    gemini_base_url: str
    gemini_timeout_seconds: float
    ollama_base_url: str
    ollama_timeout_seconds: float
    default_chat_provider: str
    default_chat_model: str
    default_wizard_provider: str
    default_wizard_model: str
    default_mending_provider: str
    default_mending_model: str


class ProviderSettingsUpdateRequest(BaseModel):
    gemini_api_key: str | None = None
    set_gemini_api_key: bool = False
    gemini_base_url: str = Field(min_length=1)
    gemini_timeout_seconds: float = Field(gt=0)
    ollama_base_url: str = Field(min_length=1)
    ollama_timeout_seconds: float = Field(gt=0)
    default_chat_provider: str | None = None
    default_chat_model: str | None = None
    default_wizard_provider: str | None = None
    default_wizard_model: str | None = None
    default_mending_provider: str | None = None
    default_mending_model: str | None = None
