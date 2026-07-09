from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

@dataclass(frozen=True)
class ToolParameter:
    type: str
    description: str
    enum: list[str] | None = None

@dataclass(frozen=True)
class Tool:
    name: str
    description: str
    parameters: dict[str, ToolParameter] = field(default_factory=dict)
    required_parameters: list[str] = field(default_factory=list)

@dataclass(frozen=True)
class ToolCall:
    id: str
    name: str
    arguments: dict[str, Any]
    raw: dict[str, Any] | None = None

@dataclass(frozen=True)
class ToolResult:
    tool_call_id: str
    name: str
    content: str


@dataclass(frozen=True)
class StructuredOutputSchema:
    """JSON schema to enforce structured outputs from the provider.

    Pass this to provider.chat() or ChatService.structured_chat() to activate
    JSON mode with schema enforcement (where supported). The provider will
    constrain its output to valid JSON matching ``schema``.
    """
    schema: dict
    mime_type: str = "application/json"
