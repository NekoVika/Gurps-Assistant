from __future__ import annotations

from typing import List, Dict, Any
from fastapi import APIRouter
from pydantic import BaseModel

from gurpsai.app.services.activity import ActivityService

router = APIRouter(tags=["activity"])


class ActivityEventSchema(BaseModel):
    id: str
    timestamp: str
    event_type: str
    description: str
    metadata: Dict[str, Any]


class ActivityLogResponse(BaseModel):
    events: List[ActivityEventSchema]


@router.get("/activity", response_model=ActivityLogResponse)
def get_activity_log() -> ActivityLogResponse:
    service = ActivityService()
    events = service.get_events()
    return ActivityLogResponse(events=[ActivityEventSchema.model_validate(e.model_dump()) for e in events])
