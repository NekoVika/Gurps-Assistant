from __future__ import annotations

from fastapi import APIRouter

from gurpsai.api.schemas.health import HealthResponse
from gurpsai.app.services.health import HealthService

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    service = HealthService()
    return service.get_status()

@router.get("/health/version")
def version():
    from gurpsai.__version__ import __version__
    return {"version": __version__}
