from __future__ import annotations

from gurpsai import __version__
from gurpsai.api.schemas.health import HealthResponse


class HealthService:
    """Simple service that reports backend availability."""

    def get_status(self) -> HealthResponse:
        return HealthResponse(
            status="ok",
            app_name="gurpsai-local-app",
            version=__version__,
        )
