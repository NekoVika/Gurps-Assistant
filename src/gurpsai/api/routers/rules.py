from __future__ import annotations

from fastapi import APIRouter, HTTPException, status

from gurpsai.api.schemas.rules import RulesQaRequest, RulesQaResponse
from gurpsai.app.services.rules import RulesQaService

from gurpsai.app.services.activity import ActivityService

router = APIRouter(prefix="/rules", tags=["rules"])


@router.post("/qa", response_model=RulesQaResponse)
def rules_qa(request: RulesQaRequest) -> RulesQaResponse:
    service = RulesQaService()
    try:
        output = service.ask(request.query, limit=request.limit)
        ActivityService().log_event(
            event_type="RULES_QUERY",
            description=f"Queried rules DB",
            metadata={"query": request.query, "limit": request.limit, "success": True}
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except RuntimeError as exc:
        ActivityService().log_event(
            event_type="RULES_QUERY",
            description=f"Rules query failed",
            metadata={"query": request.query, "error": str(exc), "success": False}
        )
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    return RulesQaResponse(query=request.query, output=output)
