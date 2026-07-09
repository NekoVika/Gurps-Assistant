from __future__ import annotations

import json
import logging
from fastapi import APIRouter, HTTPException, status
from fastapi.responses import StreamingResponse

from gurpsai.api.schemas.chat import (
    ChatMessageRequest,
    ChatRequest,
    ChatResponse,
    StructuredChatRequest,
    StructuredChatResponse,
)
from gurpsai.app.services.chat import ChatService
from gurpsai.providers.base import ChatMessage
import gurpsai.domain.campaign as campaign_models

router = APIRouter(prefix="/chat", tags=["chat"])


from gurpsai.domain.tools import ToolCall

def _to_domain_messages(req_messages: list[ChatMessageRequest]) -> list[ChatMessage]:
    result = []
    for msg in req_messages:
        tcs = None
        if msg.tool_calls:
            tcs = []
            for tc in msg.tool_calls:
                tcs.append(ToolCall(id=tc["id"], name=tc["name"], arguments=tc.get("arguments", {}), raw=tc.get("raw")))
        result.append(ChatMessage(role=msg.role, content=msg.content, tool_calls=tcs, tool_call_id=msg.tool_call_id))
    return result

@router.post("", response_model=ChatResponse)
def chat(request: ChatRequest) -> ChatResponse:
    service = ChatService()
    try:
        result = service.chat(
            provider_name=request.provider,
            model=request.model,
            messages=_to_domain_messages(request.messages),
            scope_hint=request.scope_hint,
        )
    except KeyError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc

    return ChatResponse(provider=result.provider, model=result.model, text=result.text)

@router.post("/stream")
def chat_stream(request: ChatRequest) -> StreamingResponse:
    service = ChatService()
    try:
        stream = service.stream_chat(
            provider_name=request.provider,
            model=request.model,
            messages=_to_domain_messages(request.messages),
            scope_hint=request.scope_hint,
        )

        def sse_generator():
            try:
                for chunk in stream:
                    payload = json.dumps(chunk)
                    yield f"data: {payload}\n\n"
            except Exception as e:
                error_payload = json.dumps({"error": str(e)})
                yield f"event: error\ndata: {error_payload}\n\n"
            else:
                yield "data: [DONE]\n\n"

        return StreamingResponse(sse_generator(), media_type="text/event-stream")
    except KeyError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc


@router.post("/structured", response_model=StructuredChatResponse)
def chat_structured(request: StructuredChatRequest) -> StructuredChatResponse:
    """Run a single non-streaming chat turn with JSON mode schema enforcement.

    The provider must support JSON mode (``supports_json_mode=True``). Returns the
    model's response parsed as a dict matching the caller-supplied JSON Schema.
    """
    service = ChatService()
    try:
        result_dict = service.structured_chat(
            provider_name=request.provider,
            model=request.model,
            messages=_to_domain_messages(request.messages),
            schema=request.schema_,
            creativity_level=request.creativity_level,
            narrative_intent=request.narrative_intent,
            placement_context=request.placement_context,
        )

        if request.pydantic_model:
            model_cls = getattr(campaign_models, request.pydantic_model, None)
            if model_cls:
                try:
                    validated = model_cls.model_validate(result_dict)
                    result_dict = validated.model_dump()
                except Exception as e:
                    logging.warning("Pydantic validation failed for %s: %s", request.pydantic_model, e)

        # Resolve the model that was actually used — structured_chat() auto-selects
        # models[0] when model=None and multiple are available, so we mirror that here.
        provider_status = service._provider_service.get_status(request.provider)
        resolved_model = request.model or (
            provider_status.models[0].id if provider_status.models else "unknown"
        )
        return StructuredChatResponse(
            provider=request.provider,
            model=resolved_model,
            result=result_dict,
        )

    except KeyError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    except json.JSONDecodeError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Provider returned invalid JSON: {exc}",
        ) from exc
    except Exception as exc:  # noqa: BLE001
        logging.exception("Unhandled error in /chat/structured")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal error: {exc}",
        ) from exc
