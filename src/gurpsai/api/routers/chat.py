from __future__ import annotations

import json
from fastapi import APIRouter, HTTPException, status
from fastapi.responses import StreamingResponse

from gurpsai.api.schemas.chat import ChatRequest, ChatResponse
from gurpsai.app.services.chat import ChatService
from gurpsai.providers.base import ChatMessage

router = APIRouter(prefix="/chat", tags=["chat"])


@router.post("", response_model=ChatResponse)
def chat(request: ChatRequest) -> ChatResponse:
    service = ChatService()
    try:
        result = service.chat(
            provider_name=request.provider,
            model=request.model,
            messages=[ChatMessage(role=message.role, content=message.content) for message in request.messages],
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
            messages=[ChatMessage(role=message.role, content=message.content) for message in request.messages],
        )

        def sse_generator():
            try:
                for chunk in stream:
                    payload = json.dumps({"text": chunk})
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
