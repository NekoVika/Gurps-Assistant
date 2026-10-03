from __future__ import annotations

from pydantic import BaseModel, Field


class RulesQaRequest(BaseModel):
    query: str = Field(min_length=1, description="Natural-language GURPS rules question")
    limit: int = Field(default=3, ge=1, le=10, description="Maximum number of evidence items per section")


class RulesQaResponse(BaseModel):
    query: str
    output: str


class TraitEntry(BaseModel):
    """One priced entry from a book's trait tables."""
    book_id: int
    kind: str
    name: str
    category: str | None = None
    exotic: bool = False
    #: The book marks these with a dagger; a sheet writes the specialty instead.
    specialised: bool = False
    #: The printed cost is for a self-control number of 12, so a sheet may
    #: legitimately differ. Without this the checker would report 39 false gaps.
    self_control: bool = False
    cost_text: str | None = None
    cost_kind: str | None = None
    cost_value: int | None = None
    attr: str | None = None
    difficulty: str | None = None
    defaults: str | None = None
    page: int | None = None
    needs_review: bool = False
    review_reason: str | None = None


class TraitCatalogueResponse(BaseModel):
    #: False when there is no local rules database; the UI then says so rather
    #: than showing an empty catalogue as though nothing were priced.
    available: bool
    reason: str = ""
    books: list[dict] = Field(default_factory=list)
    traits: list[TraitEntry] = Field(default_factory=list)
