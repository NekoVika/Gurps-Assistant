"""A failed turn must not wedge the session forever.

When the provider errors after announcing a tool call, the saved history keeps
an assistant message whose call was never answered. Providers refuse that
pairing, so without repair every later message in the chat fails identically
and the user has to abandon the session.
"""
import io
import json
from urllib import error

import pytest

from gurpsai.app.services.chat import prune_orphaned_tool_calls
from gurpsai.domain.tools import ToolCall
from gurpsai.providers.base import ChatMessage
from gurpsai.providers.gemini import _describe_http_error


def call(cid, name="read_file"):
    return ToolCall(id=cid, name=name, arguments={"path": "x.json"})


def test_answered_tool_calls_survive_untouched():
    messages = [
        ChatMessage(role="user", content="read it"),
        ChatMessage(role="assistant", content="", tool_calls=[call("a")]),
        ChatMessage(role="tool", content="{}", tool_call_id="a"),
        ChatMessage(role="assistant", content="done"),
    ]
    assert prune_orphaned_tool_calls(messages) == messages


def test_unanswered_call_on_an_empty_assistant_message_is_dropped():
    messages = [
        ChatMessage(role="user", content="read it"),
        ChatMessage(role="assistant", content="", tool_calls=[call("a")]),
    ]
    assert prune_orphaned_tool_calls(messages) == [messages[0]]


def test_unanswered_call_keeps_the_text_the_model_did_produce():
    messages = [
        ChatMessage(role="user", content="read it"),
        ChatMessage(role="assistant", content="Let me look.", tool_calls=[call("a")]),
    ]
    out = prune_orphaned_tool_calls(messages)
    assert len(out) == 2
    assert out[1].content == "Let me look."
    assert out[1].tool_calls == []


def test_partially_answered_calls_keep_only_the_answered_one():
    messages = [
        ChatMessage(role="assistant", content="", tool_calls=[call("a"), call("b")]),
        ChatMessage(role="tool", content="{}", tool_call_id="a"),
    ]
    out = prune_orphaned_tool_calls(messages)
    assert [tc.id for tc in out[0].tool_calls] == ["a"]
    assert out[1].tool_call_id == "a"


def test_tool_result_without_a_matching_call_is_dropped():
    messages = [
        ChatMessage(role="user", content="hi"),
        ChatMessage(role="tool", content="stray", tool_call_id="ghost"),
    ]
    assert prune_orphaned_tool_calls(messages) == [messages[0]]


def test_a_repaired_history_is_stable_under_a_second_pass():
    messages = [
        ChatMessage(role="user", content="read it"),
        ChatMessage(role="assistant", content="", tool_calls=[call("a")]),
        ChatMessage(role="tool", content="{}", tool_call_id="b"),
    ]
    once = prune_orphaned_tool_calls(messages)
    assert prune_orphaned_tool_calls(once) == once


def http_error(code, body):
    return error.HTTPError(
        "https://example.test", code, "err", {}, io.BytesIO(json.dumps(body).encode())
    )


def test_error_shows_googles_sentence_not_its_json():
    described = _describe_http_error(
        http_error(429, {"error": {"code": 429, "message": "Quota exceeded for requests.", "status": "RESOURCE_EXHAUSTED"}})
    )
    assert "Quota exceeded for requests." in described
    assert "{" not in described and "RESOURCE_EXHAUSTED" not in described


@pytest.mark.parametrize("code,fragment", [(401, "API key"), (429, "rate limit"), (503, "overloaded")])
def test_each_status_gets_an_actionable_hint(code, fragment):
    assert fragment.lower() in _describe_http_error(http_error(code, {})).lower()


def test_unparseable_body_still_yields_a_sentence():
    described = _describe_http_error(
        error.HTTPError("https://example.test", 500, "err", {}, io.BytesIO(b"<html>nope</html>"))
    )
    assert described and "<html>" not in described
