from __future__ import annotations

from fastapi import APIRouter

from gurpsai.api.schemas.providers import (
    ProviderCapabilitiesResponse,
    ProviderModelResponse,
    ProviderStatusResponse,
)
from gurpsai.app.services.providers import ProviderService
from gurpsai.domain.providers import ProviderStatus

router = APIRouter(tags=["providers"])


def _to_response(status: ProviderStatus) -> ProviderStatusResponse:
    return ProviderStatusResponse(
        name=status.name,
        display_name=status.display_name,
        available=status.available,
        configured=status.configured,
        error_message=status.error_message,
        base_url=status.base_url,
        capabilities=ProviderCapabilitiesResponse(
            supports_streaming=status.capabilities.supports_streaming,
            supports_json_mode=status.capabilities.supports_json_mode,
            supports_tools=status.capabilities.supports_tools,
            max_context_tokens=status.capabilities.max_context_tokens,
        ),
        models=[
            ProviderModelResponse(
                id=model.id,
                display_name=model.display_name,
                provider=model.provider,
                capabilities=ProviderCapabilitiesResponse(
                    supports_streaming=model.capabilities.supports_streaming,
                    supports_json_mode=model.capabilities.supports_json_mode,
                    supports_tools=model.capabilities.supports_tools,
                    max_context_tokens=model.capabilities.max_context_tokens,
                ),
            )
            for model in status.models
        ],
    )


@router.get("/providers", response_model=list[ProviderStatusResponse])
def list_providers() -> list[ProviderStatusResponse]:
    service = ProviderService()
    return [_to_response(status) for status in service.list_statuses()]
