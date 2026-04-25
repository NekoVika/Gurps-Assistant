from __future__ import annotations

from pydantic import BaseModel, Field


class ChatMessageRequest(BaseModel):
    role: str = Field(pattern="^(system|user|assistant)$")
    content: str = Field(min_length=1)


class ChatRequest(BaseModel):
    provider: str = Field(min_length=1)
    model: str | None = None
    messages: list[ChatMessageRequest] = Field(min_length=1)


class ChatResponse(BaseModel):
    provider: str
    model: str
    text: str
