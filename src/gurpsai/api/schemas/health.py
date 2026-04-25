from __future__ import annotations

from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    status: str = Field(description="High-level service status")
    app_name: str = Field(description="Application identifier")
    version: str = Field(description="Application version")
