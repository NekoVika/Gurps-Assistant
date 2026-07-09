from __future__ import annotations

from pydantic import BaseModel, Field


from typing import Any

class ChatMessageRequest(BaseModel):
    role: str = Field(pattern="^(system|user|assistant|tool)$")
    content: str = ""
    tool_calls: list[dict[str, Any]] | None = None
    tool_call_id: str | None = None


class ChatRequest(BaseModel):
    provider: str = Field(min_length=1)
    model: str | None = None
    messages: list[ChatMessageRequest] = Field(min_length=1)
    scope_hint: str | None = None


class ChatResponse(BaseModel):
    provider: str
    model: str
    text: str


class StructuredChatRequest(BaseModel):
    provider: str = Field(min_length=1)
    model: str | None = None
    messages: list[ChatMessageRequest] = Field(min_length=1)
    schema_: dict = Field(alias="output_schema")
    pydantic_model: str | None = None

    creativity_level: str = "Balanced"
    narrative_intent: str | None = None
    placement_context: str | None = None

    model_config = {"populate_by_name": True}


class StructuredChatResponse(BaseModel):
    provider: str
    model: str
    result: dict
