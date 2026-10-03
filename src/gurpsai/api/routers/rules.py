from __future__ import annotations

from fastapi import APIRouter, HTTPException, status

from gurpsai.api.schemas.rules import (
    RulesQaRequest, RulesQaResponse, TraitCatalogueResponse,
)
from gurpsai.app.services.rules import RulesQaService
from gurpsai.app.services.trait_catalogue import TraitCatalogueService

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


@router.get("/traits", response_model=TraitCatalogueResponse)
def trait_catalogue() -> TraitCatalogueResponse:
    """Every priced trait the local rules database knows about.

    Served whole rather than queried per name: it is a few hundred rows, the UI
    checks every line of every character, and a round trip per trait would be
    slower than the lookup itself.
    """
    catalogue = TraitCatalogueService().load()
    return TraitCatalogueResponse(
        available=catalogue.available,
        reason=catalogue.reason,
        books=catalogue.books,
        traits=catalogue.traits,
    )
