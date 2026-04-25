from __future__ import annotations

from fastapi import APIRouter, HTTPException, status

from gurpsai.api.schemas.settings import ProviderSettingsResponse, ProviderSettingsUpdateRequest
from gurpsai.app.config import (
    ProviderSettingsUpdate,
    load_provider_settings_view,
    save_provider_settings,
)

router = APIRouter(prefix="/settings", tags=["settings"])


@router.get("/providers", response_model=ProviderSettingsResponse)
def get_provider_settings() -> ProviderSettingsResponse:
    view = load_provider_settings_view()
    return ProviderSettingsResponse(
        gemini_api_key_configured=view.gemini_api_key_configured,
        gemini_base_url=view.gemini_base_url,
        gemini_timeout_seconds=view.gemini_timeout_seconds,
        ollama_base_url=view.ollama_base_url,
        ollama_timeout_seconds=view.ollama_timeout_seconds,
        default_chat_provider=view.default_chat_provider,
        default_chat_model=view.default_chat_model,
        default_wizard_provider=view.default_wizard_provider,
        default_wizard_model=view.default_wizard_model,
        default_mending_provider=view.default_mending_provider,
        default_mending_model=view.default_mending_model,
    )


@router.put("/providers", response_model=ProviderSettingsResponse)
def update_provider_settings(request: ProviderSettingsUpdateRequest) -> ProviderSettingsResponse:
    try:
        view = save_provider_settings(
            ProviderSettingsUpdate(
                gemini_api_key=request.gemini_api_key,
                set_gemini_api_key=request.set_gemini_api_key,
                gemini_base_url=request.gemini_base_url,
                gemini_timeout_seconds=request.gemini_timeout_seconds,
                ollama_base_url=request.ollama_base_url,
                ollama_timeout_seconds=request.ollama_timeout_seconds,
                default_chat_provider=request.default_chat_provider,
                default_chat_model=request.default_chat_model,
                default_wizard_provider=request.default_wizard_provider,
                default_wizard_model=request.default_wizard_model,
                default_mending_provider=request.default_mending_provider,
                default_mending_model=request.default_mending_model,
            )
        )
    except OSError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Could not write settings file: {exc}",
        ) from exc

    return ProviderSettingsResponse(
        gemini_api_key_configured=view.gemini_api_key_configured,
        gemini_base_url=view.gemini_base_url,
        gemini_timeout_seconds=view.gemini_timeout_seconds,
        ollama_base_url=view.ollama_base_url,
        ollama_timeout_seconds=view.ollama_timeout_seconds,
        default_chat_provider=view.default_chat_provider,
        default_chat_model=view.default_chat_model,
        default_wizard_provider=view.default_wizard_provider,
        default_wizard_model=view.default_wizard_model,
        default_mending_provider=view.default_mending_provider,
        default_mending_model=view.default_mending_model,
    )
