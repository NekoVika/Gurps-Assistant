import json
import uuid
import time
from pathlib import Path
from pydantic import BaseModel, Field

from gurpsai.app.config import load_app_config
from gurpsai.providers.base import ChatMessage

ROOT = Path(__file__).resolve().parents[4]

class ChatSession(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str = "New Chat"
    updated_at: float = Field(default_factory=time.time)
    messages: list[ChatMessage] = Field(default_factory=list)

class SessionService:
    def _get_sessions_dir(self) -> Path:
        config = load_app_config()
        active_path = config.campaign.active_path.strip()
        if active_path:
            camp_path_base = Path(active_path)
            if not camp_path_base.is_absolute():
                camp_path_base = (ROOT / active_path).resolve()
        else:
            camp_path_base = (ROOT / "Campaign").resolve()
            
        sessions_dir = camp_path_base / ".planning" / "sessions"
        sessions_dir.mkdir(parents=True, exist_ok=True)
        return sessions_dir

    def list_sessions(self) -> list[ChatSession]:
        sessions = []
        sessions_dir = self._get_sessions_dir()
        for fp in sessions_dir.glob("*.json"):
            try:
                data = json.loads(fp.read_text(encoding="utf-8"))
                sessions.append(ChatSession(**data))
            except Exception:
                continue
        sessions.sort(key=lambda s: s.updated_at, reverse=True)
        return sessions

    def get_session(self, session_id: str) -> ChatSession:
        fp = self._get_sessions_dir() / f"{session_id}.json"
        if not fp.exists():
            raise FileNotFoundError(f"Session {session_id} not found")
        data = json.loads(fp.read_text(encoding="utf-8"))
        return ChatSession(**data)

    def create_session(self, title: str = "New Chat") -> ChatSession:
        session = ChatSession(title=title)
        return self.save_session(session)

    def save_session(self, session: ChatSession) -> ChatSession:
        session.updated_at = time.time()
        fp = self._get_sessions_dir() / f"{session.id}.json"
        fp.write_text(session.model_dump_json(indent=2), encoding="utf-8")
        return session

    def delete_session(self, session_id: str) -> None:
        fp = self._get_sessions_dir() / f"{session_id}.json"
        if fp.exists():
            fp.unlink()
