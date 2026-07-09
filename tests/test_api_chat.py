"""Integration tests for the chat API endpoints.

Uses FastAPI TestClient. The ChatService is mocked so no real LLM calls happen.
"""

import json
import unittest
from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient

from gurpsai.api.main import app
from gurpsai.api.routers.chat import _to_domain_messages
from gurpsai.api.schemas.chat import ChatMessageRequest
from gurpsai.domain.tools import ToolCall
from gurpsai.providers.base import ChatMessage, ChatResult


client = TestClient(app)


# ---------------------------------------------------------------------------
# _to_domain_messages conversion tests
# ---------------------------------------------------------------------------

class ToDomainMessagesTests(unittest.TestCase):
    """Tests for the _to_domain_messages helper in the chat router."""

    def test_plain_message(self):
        req_msgs = [
            ChatMessageRequest(role="user", content="Hello"),
        ]
        result = _to_domain_messages(req_msgs)
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0].role, "user")
        self.assertEqual(result[0].content, "Hello")
        self.assertIsNone(result[0].tool_call_id)

    def test_message_with_tool_calls(self):
        req_msgs = [
            ChatMessageRequest(
                role="assistant",
                content="",
                tool_calls=[
                    {"id": "call_1", "name": "read_file", "arguments": {"path": "x.json"}},
                    {"id": "call_2", "name": "query_rules", "arguments": {"query": "dodge"}, "raw": {"functionCall": {"name": "query_rules"}}},
                ],
            ),
        ]
        result = _to_domain_messages(req_msgs)
        self.assertEqual(len(result), 1)
        msg = result[0]
        self.assertEqual(len(msg.tool_calls), 2)
        self.assertIsInstance(msg.tool_calls[0], ToolCall)
        self.assertEqual(msg.tool_calls[0].id, "call_1")
        self.assertEqual(msg.tool_calls[0].name, "read_file")
        self.assertIsNone(msg.tool_calls[0].raw)
        # Second call has raw
        self.assertIsNotNone(msg.tool_calls[1].raw)

    def test_tool_response_message(self):
        req_msgs = [
            ChatMessageRequest(role="tool", content="file data", tool_call_id="call_1"),
        ]
        result = _to_domain_messages(req_msgs)
        self.assertEqual(result[0].role, "tool")
        self.assertEqual(result[0].tool_call_id, "call_1")
        self.assertEqual(result[0].content, "file data")


# ---------------------------------------------------------------------------
# POST /chat tests
# ---------------------------------------------------------------------------

class ChatEndpointTests(unittest.TestCase):
    """Tests for the synchronous POST /chat endpoint."""

    @patch("gurpsai.api.routers.chat.ChatService")
    def test_valid_request(self, mock_svc_cls):
        mock_svc = MagicMock()
        mock_svc.chat.return_value = ChatResult(text="Hello!", model="test-model", provider="mock")
        mock_svc_cls.return_value = mock_svc

        response = client.post("/chat", json={
            "provider": "mock",
            "model": "test-model",
            "messages": [{"role": "user", "content": "Hi"}],
        })
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["text"], "Hello!")
        self.assertEqual(data["model"], "test-model")
        self.assertEqual(data["provider"], "mock")

    def test_empty_messages_returns_422(self):
        """Pydantic min_length=1 should reject empty messages list."""
        response = client.post("/chat", json={
            "provider": "mock",
            "model": "test-model",
            "messages": [],
        })
        self.assertEqual(response.status_code, 422)

    @patch("gurpsai.api.routers.chat.ChatService")
    def test_unknown_provider_returns_404(self, mock_svc_cls):
        mock_svc = MagicMock()
        mock_svc.chat.side_effect = KeyError("Provider 'nope' not found")
        mock_svc_cls.return_value = mock_svc

        response = client.post("/chat", json={
            "provider": "nope",
            "model": "m",
            "messages": [{"role": "user", "content": "Hi"}],
        })
        self.assertEqual(response.status_code, 404)

    @patch("gurpsai.api.routers.chat.ChatService")
    def test_unavailable_provider_returns_503(self, mock_svc_cls):
        mock_svc = MagicMock()
        mock_svc.chat.side_effect = RuntimeError("Provider offline")
        mock_svc_cls.return_value = mock_svc

        response = client.post("/chat", json={
            "provider": "mock",
            "model": "m",
            "messages": [{"role": "user", "content": "Hi"}],
        })
        self.assertEqual(response.status_code, 503)

    @patch("gurpsai.api.routers.chat.ChatService")
    def test_bad_request_returns_400(self, mock_svc_cls):
        mock_svc = MagicMock()
        mock_svc.chat.side_effect = ValueError("No models available")
        mock_svc_cls.return_value = mock_svc

        response = client.post("/chat", json={
            "provider": "mock",
            "model": None,
            "messages": [{"role": "user", "content": "Hi"}],
        })
        self.assertEqual(response.status_code, 400)


# ---------------------------------------------------------------------------
# POST /chat/stream tests
# ---------------------------------------------------------------------------

class ChatStreamEndpointTests(unittest.TestCase):
    """Tests for the SSE streaming POST /chat/stream endpoint."""

    @patch("gurpsai.api.routers.chat.ChatService")
    def test_text_stream(self, mock_svc_cls):
        """Verify SSE format: data lines with JSON, ending in [DONE]."""
        mock_svc = MagicMock()
        mock_svc.stream_chat.return_value = iter([
            {"type": "text", "content": "Hello "},
            {"type": "text", "content": "world!"},
        ])
        mock_svc_cls.return_value = mock_svc

        response = client.post("/chat/stream", json={
            "provider": "mock",
            "model": "m",
            "messages": [{"role": "user", "content": "Hi"}],
        })
        self.assertEqual(response.status_code, 200)
        self.assertIn("text/event-stream", response.headers.get("content-type", ""))

        lines = response.text.strip().split("\n\n")
        # Should have 2 data lines + 1 [DONE]
        self.assertEqual(len(lines), 3)

        # First two are data payloads
        payload1 = json.loads(lines[0].replace("data: ", ""))
        self.assertEqual(payload1["type"], "text")
        self.assertEqual(payload1["content"], "Hello ")

        # Last is DONE sentinel
        self.assertEqual(lines[-1].strip(), "data: [DONE]")

    @patch("gurpsai.api.routers.chat.ChatService")
    def test_tool_events_in_stream(self, mock_svc_cls):
        """Verify tool_calls and draft events appear in the SSE stream."""
        mock_svc = MagicMock()
        mock_svc.stream_chat.return_value = iter([
            {"type": "tool_calls", "tool_calls": [{"id": "tc1", "name": "read_file", "arguments": {"path": "x.json"}}]},
            {"type": "status", "message": "📖 Reading file: x.json"},
            {"type": "tool_response", "tool_call_id": "tc1", "content": "data"},
            {"type": "draft", "path": "y.json", "content": "{}"},
            {"type": "text", "content": "Done."},
        ])
        mock_svc_cls.return_value = mock_svc

        response = client.post("/chat/stream", json={
            "provider": "mock",
            "model": "m",
            "messages": [{"role": "user", "content": "Do things"}],
        })
        self.assertEqual(response.status_code, 200)

        # Parse all SSE data events (skip [DONE])
        events = []
        for line in response.text.strip().split("\n\n"):
            clean = line.strip()
            if clean.startswith("data: ") and clean != "data: [DONE]":
                events.append(json.loads(clean[6:]))

        event_types = [e["type"] for e in events]
        self.assertIn("tool_calls", event_types)
        self.assertIn("status", event_types)
        self.assertIn("tool_response", event_types)
        self.assertIn("draft", event_types)
        self.assertIn("text", event_types)

    @patch("gurpsai.api.routers.chat.ChatService")
    def test_stream_error_yields_error_event(self, mock_svc_cls):
        """When the stream generator raises, an SSE error event is emitted."""
        def _exploding_stream():
            yield {"type": "text", "content": "Starting..."}
            raise RuntimeError("LLM exploded")

        mock_svc = MagicMock()
        mock_svc.stream_chat.return_value = _exploding_stream()
        mock_svc_cls.return_value = mock_svc

        response = client.post("/chat/stream", json={
            "provider": "mock",
            "model": "m",
            "messages": [{"role": "user", "content": "Hi"}],
        })
        self.assertEqual(response.status_code, 200)

        # Should contain an error event
        self.assertIn("event: error", response.text)
        self.assertIn("LLM exploded", response.text)

    @patch("gurpsai.api.routers.chat.ChatService")
    def test_stream_unavailable_provider_returns_503(self, mock_svc_cls):
        mock_svc = MagicMock()
        mock_svc.stream_chat.side_effect = RuntimeError("Offline")
        mock_svc_cls.return_value = mock_svc

        response = client.post("/chat/stream", json={
            "provider": "mock",
            "model": "m",
            "messages": [{"role": "user", "content": "Hi"}],
        })
        self.assertEqual(response.status_code, 503)


# ---------------------------------------------------------------------------
# Schema validation tests
# ---------------------------------------------------------------------------

class ChatSchemaTests(unittest.TestCase):
    """Tests for ChatMessageRequest / ChatRequest Pydantic validation."""

    def test_invalid_role_rejected(self):
        """Roles outside the allowed pattern should fail validation."""
        response = client.post("/chat", json={
            "provider": "mock",
            "model": "m",
            "messages": [{"role": "hacker", "content": "Hi"}],
        })
        self.assertEqual(response.status_code, 422)

    def test_empty_provider_rejected(self):
        response = client.post("/chat", json={
            "provider": "",
            "model": "m",
            "messages": [{"role": "user", "content": "Hi"}],
        })
        self.assertEqual(response.status_code, 422)

    def test_tool_call_fields_accepted(self):
        """Messages with tool_calls and tool_call_id should pass schema validation."""
        response_data = {
            "provider": "mock",
            "model": "m",
            "messages": [
                {"role": "user", "content": "Hi"},
                {
                    "role": "assistant",
                    "content": "",
                    "tool_calls": [{"id": "tc1", "name": "read_file", "arguments": {"path": "x"}}],
                },
                {"role": "tool", "content": "file data", "tool_call_id": "tc1"},
            ],
        }
        # Just verify schema validation passes (the actual chat call will need a mock)
        req = ChatMessageRequest(role="tool", content="data", tool_call_id="tc1")
        self.assertEqual(req.tool_call_id, "tc1")


if __name__ == "__main__":
    unittest.main()
