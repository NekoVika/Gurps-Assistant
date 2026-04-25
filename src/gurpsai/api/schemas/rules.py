from __future__ import annotations

from pydantic import BaseModel, Field


class RulesQaRequest(BaseModel):
    query: str = Field(min_length=1, description="Natural-language GURPS rules question")
    limit: int = Field(default=3, ge=1, le=10, description="Maximum number of evidence items per section")


class RulesQaResponse(BaseModel):
    query: str
    output: str
