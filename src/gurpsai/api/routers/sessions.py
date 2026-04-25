from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from gurpsai.app.services.sessions import SessionService, ChatSession
from gurpsai.providers.base import ChatMessage

router = APIRouter(prefix="/sessions", tags=["sessions"])

class SaveSessionRequest(BaseModel):
    title: str | None = None
    messages: list[ChatMessage] | None = None

@router.get("", response_model=list[ChatSession])
def list_sessions() -> list[ChatSession]:
    service = SessionService()
    return service.list_sessions()

@router.get("/{session_id}", response_model=ChatSession)
def get_session(session_id: str) -> ChatSession:
    service = SessionService()
    try:
        return service.get_session(session_id)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Session not found")

class CreateSessionRequest(BaseModel):
    title: str = "New Chat"

@router.post("", response_model=ChatSession)
def create_session(req: CreateSessionRequest) -> ChatSession:
    service = SessionService()
    return service.create_session(title=req.title)

@router.put("/{session_id}", response_model=ChatSession)
def update_session(session_id: str, req: SaveSessionRequest) -> ChatSession:
    service = SessionService()
    try:
        session = service.get_session(session_id)
        if req.title is not None:
            session.title = req.title
        if req.messages is not None:
            session.messages = req.messages
        return service.save_session(session)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Session not found")

@router.delete("/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_session(session_id: str):
    service = SessionService()
    service.delete_session(session_id)
    return None
