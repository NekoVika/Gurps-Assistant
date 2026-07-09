"""Unit tests for ChatService — tool orchestration, multi-turn loop, error handling.

All provider and dependent service calls are mocked.
"""

import unittest
from unittest.mock import MagicMock, patch, PropertyMock

from gurpsai.app.services.chat import ChatService
from gurpsai.domain.providers import ProviderCapabilities, ProviderModel, ProviderStatus
from gurpsai.domain.tools import Tool, ToolCall
from gurpsai.providers.base import ChatMessage, ChatResult


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _available_status(*, models: list[ProviderModel] | None = None) -> ProviderStatus:
    """A ProviderStatus that looks healthy and available."""
    if models is None:
        models = [ProviderModel(id="test-model", display_name="Test", provider="mock")]
    return ProviderStatus(
        name="mock",
        display_name="Mock",
        available=True,
        configured=True,
        models=models,
        capabilities=ProviderCapabilities(supports_streaming=True, supports_tools=True),
    )


def _unavailable_status() -> ProviderStatus:
    return ProviderStatus(
        name="mock",
        display_name="Mock",
        available=False,
        error_message="Provider offline",
    )


def _make_mock_provider(
    *,
    supports_streaming: bool = True,
    supports_tools: bool = True,
) -> MagicMock:
    """Build a mock LlmProvider with configurable capabilities."""
    provider = MagicMock()
    provider.capabilities.return_value = ProviderCapabilities(
        supports_streaming=supports_streaming,
        supports_tools=supports_tools,
    )
    return provider


def _make_service(
    provider_status: ProviderStatus | None = None,
    provider: MagicMock | None = None,
) -> ChatService:
    """Build a ChatService with mocked ProviderService and ContextService."""
    mock_provider_svc = MagicMock()
    mock_provider_svc.get_status.return_value = provider_status or _available_status()
    mock_provider_svc.get_provider.return_value = provider or _make_mock_provider()

    mock_context_svc = MagicMock()
    mock_context_svc.build_system_prompt.return_value = "You are a GM."

    return ChatService(provider_service=mock_provider_svc, context_service=mock_context_svc)


# ---------------------------------------------------------------------------
# chat() tests
# ---------------------------------------------------------------------------

class ChatSyncTests(unittest.TestCase):
    """Tests for ChatService.chat() (non-streaming)."""

    def test_empty_messages_raises(self):
        svc = _make_service()
        with self.assertRaises(ValueError, msg="At least one"):
            svc.chat(provider_name="mock", model="m", messages=[])

    def test_unavailable_provider_raises(self):
        svc = _make_service(provider_status=_unavailable_status())
        with self.assertRaises(RuntimeError, msg="offline"):
            svc.chat(
                provider_name="mock",
                model="m",
                messages=[ChatMessage(role="user", content="Hi")],
            )

    def test_no_models_raises(self):
        status = _available_status(models=[])
        svc = _make_service(provider_status=status)
        with self.assertRaises(ValueError, msg="No models"):
            svc.chat(
                provider_name="mock",
                model=None,
                messages=[ChatMessage(role="user", content="Hi")],
            )

    def test_multiple_models_without_explicit_raises(self):
        models = [
            ProviderModel(id="a", display_name="A", provider="mock"),
            ProviderModel(id="b", display_name="B", provider="mock"),
        ]
        status = _available_status(models=models)
        svc = _make_service(provider_status=status)
        with self.assertRaises(ValueError, msg="pick one"):
            svc.chat(
                provider_name="mock",
                model=None,
                messages=[ChatMessage(role="user", content="Hi")],
            )

    @patch("gurpsai.app.services.chat.ActivityService")
    def test_auto_selects_single_model(self, mock_activity_cls):
        provider = _make_mock_provider()
        provider.chat.return_value = ChatResult(text="ok", model="only-model", provider="mock")
        svc = _make_service(provider=provider)

        result = svc.chat(
            provider_name="mock",
            model=None,
            messages=[ChatMessage(role="user", content="Hi")],
        )
        self.assertEqual(result.text, "ok")
        # Verify system prompt was prepended
        call_args = provider.chat.call_args
        sent_messages = call_args[0][0]
        self.assertEqual(sent_messages[0].role, "system")
        self.assertEqual(sent_messages[0].content, "You are a GM.")


# ---------------------------------------------------------------------------
# stream_chat() tests
# ---------------------------------------------------------------------------

class StreamChatTests(unittest.TestCase):
    """Tests for ChatService.stream_chat() — tool loop & orchestration."""

    @patch("gurpsai.app.services.chat.ActivityService")
    def test_no_streaming_support_raises(self, _):
        provider = _make_mock_provider(supports_streaming=False)
        svc = _make_service(provider=provider)
        with self.assertRaises(RuntimeError, msg="does not support streaming"):
            list(svc.stream_chat(
                provider_name="mock",
                model="m",
                messages=[ChatMessage(role="user", content="Hi")],
            ))

    @patch("gurpsai.app.services.chat.ActivityService")
    def test_text_only_stream(self, _):
        """Provider yields text only → service yields text chunks, loop exits."""
        provider = _make_mock_provider()
        provider.stream_chat.return_value = iter(["Hello ", "world!"])
        svc = _make_service(provider=provider)

        chunks = list(svc.stream_chat(
            provider_name="mock",
            model="m",
            messages=[ChatMessage(role="user", content="Hi")],
        ))
        text_chunks = [c for c in chunks if c["type"] == "text"]
        self.assertEqual(len(text_chunks), 2)
        self.assertEqual(text_chunks[0]["content"], "Hello ")
        self.assertEqual(text_chunks[1]["content"], "world!")

    @patch("gurpsai.app.services.chat.ActivityService")
    @patch("gurpsai.app.services.chat.CampaignFileService")
    def test_read_file_tool_execution(self, mock_file_cls, _):
        """Provider returns a read_file tool call → service reads file and feeds result back."""
        mock_file_instance = MagicMock()
        mock_file_result = MagicMock()
        mock_file_result.content = '{"name": "Test NPC"}'
        mock_file_instance.read_file.return_value = mock_file_result
        mock_file_cls.return_value = mock_file_instance

        tc = ToolCall(id="read_file", name="read_file", arguments={"path": "NPCs/test.json"})

        provider = _make_mock_provider()
        # First stream: tool call; second stream: final text
        provider.stream_chat.side_effect = [
            iter([tc]),
            iter(["Done reading."]),
        ]
        svc = _make_service(provider=provider)

        chunks = list(svc.stream_chat(
            provider_name="mock",
            model="m",
            messages=[ChatMessage(role="user", content="Read the NPC")],
        ))

        types = [c["type"] for c in chunks]
        self.assertIn("tool_calls", types)
        self.assertIn("status", types)
        self.assertIn("tool_response", types)
        self.assertIn("text", types)

        # Verify the file was actually read
        mock_file_instance.read_file.assert_called_once_with("NPCs/test.json")

        # Verify tool_response content
        tool_resp = next(c for c in chunks if c["type"] == "tool_response" and c["tool_call_id"] == "read_file")
        self.assertEqual(tool_resp["content"], '{"name": "Test NPC"}')

    @patch("gurpsai.app.services.chat.ActivityService")
    @patch("gurpsai.app.services.chat.RulesQaService")
    def test_query_rules_tool_execution(self, mock_rules_cls, _):
        """Provider returns a query_rules tool call → service queries rules DB."""
        mock_rules_instance = MagicMock()
        mock_rules_instance.ask.return_value = "Deceptive Attack: -2 to defend per -1 to hit"
        mock_rules_cls.return_value = mock_rules_instance

        tc = ToolCall(id="query_rules", name="query_rules", arguments={"query": "Deceptive Attack"})

        provider = _make_mock_provider()
        provider.stream_chat.side_effect = [
            iter([tc]),
            iter(["Here's the answer."]),
        ]
        svc = _make_service(provider=provider)

        chunks = list(svc.stream_chat(
            provider_name="mock",
            model="m",
            messages=[ChatMessage(role="user", content="How does Deceptive Attack work?")],
        ))

        mock_rules_instance.ask.assert_called_once_with("Deceptive Attack")
        tool_resp = next(c for c in chunks if c["type"] == "tool_response")
        self.assertIn("Deceptive Attack", tool_resp["content"])

    @patch("gurpsai.app.services.chat.ActivityService")
    def test_draft_file_tool_execution(self, _):
        """Provider returns a draft_file tool call → service yields a draft event, no file write."""
        tc = ToolCall(
            id="draft_file",
            name="draft_file",
            arguments={"path": "NPCs/new.json", "content": '{"name": "New NPC"}'},
        )

        provider = _make_mock_provider()
        provider.stream_chat.side_effect = [
            iter([tc]),
            iter(["Draft sent for review."]),
        ]
        svc = _make_service(provider=provider)

        chunks = list(svc.stream_chat(
            provider_name="mock",
            model="m",
            messages=[ChatMessage(role="user", content="Create NPC")],
        ))

        draft_chunks = [c for c in chunks if c["type"] == "draft"]
        self.assertEqual(len(draft_chunks), 1)
        self.assertEqual(draft_chunks[0]["path"], "NPCs/new.json")
        self.assertEqual(draft_chunks[0]["content"], '{"name": "New NPC"}')

    @patch("gurpsai.app.services.chat.ActivityService")
    @patch("gurpsai.app.services.chat.CampaignFileService")
    def test_tool_error_yields_error_string(self, mock_file_cls, _):
        """When a tool raises, the error message is sent as the tool result instead of crashing."""
        mock_file_instance = MagicMock()
        mock_file_instance.read_file.side_effect = FileNotFoundError("File not found: bad.json")
        mock_file_cls.return_value = mock_file_instance

        tc = ToolCall(id="read_file", name="read_file", arguments={"path": "bad.json"})

        provider = _make_mock_provider()
        provider.stream_chat.side_effect = [
            iter([tc]),
            iter(["File not found, sorry."]),
        ]
        svc = _make_service(provider=provider)

        chunks = list(svc.stream_chat(
            provider_name="mock",
            model="m",
            messages=[ChatMessage(role="user", content="Read bad.json")],
        ))

        tool_resp = next(c for c in chunks if c["type"] == "tool_response")
        self.assertIn("Error:", tool_resp["content"])

    @patch("gurpsai.app.services.chat.ActivityService")
    def test_no_tools_injected_when_unsupported(self, _):
        """When provider doesn't support tools, stream_chat is called with tools=None."""
        provider = _make_mock_provider(supports_tools=False, supports_streaming=True)
        provider.stream_chat.return_value = iter(["Hi!"])
        svc = _make_service(provider=provider)

        list(svc.stream_chat(
            provider_name="mock",
            model="m",
            messages=[ChatMessage(role="user", content="Hi")],
        ))

        call_kwargs = provider.stream_chat.call_args[1]
        self.assertIsNone(call_kwargs.get("tools"))

    @patch("gurpsai.app.services.chat.ActivityService")
    def test_tools_injected_when_supported(self, _):
        """When provider supports tools, stream_chat is called with tool definitions."""
        provider = _make_mock_provider(supports_tools=True, supports_streaming=True)
        provider.stream_chat.return_value = iter(["Hi!"])
        svc = _make_service(provider=provider)

        list(svc.stream_chat(
            provider_name="mock",
            model="m",
            messages=[ChatMessage(role="user", content="Hi")],
        ))

        call_kwargs = provider.stream_chat.call_args[1]
        tools = call_kwargs.get("tools")
        self.assertIsNotNone(tools)
        tool_names = [t.name for t in tools]
        self.assertIn("read_file", tool_names)
        self.assertIn("query_rules", tool_names)
        self.assertIn("draft_file", tool_names)

    @patch("gurpsai.app.services.chat.ActivityService")
    @patch("gurpsai.app.services.chat.CampaignFileService")
    def test_multi_turn_loop(self, mock_file_cls, _):
        """Verify the while-True loop: tool call → execute → resume → text → exit."""
        mock_file_instance = MagicMock()
        mock_file_result = MagicMock()
        mock_file_result.content = "file data"
        mock_file_instance.read_file.return_value = mock_file_result
        mock_file_cls.return_value = mock_file_instance

        tc1 = ToolCall(id="read_file", name="read_file", arguments={"path": "a.json"})
        tc2 = ToolCall(id="read_file", name="read_file", arguments={"path": "b.json"})

        provider = _make_mock_provider()
        # Turn 1: two tool calls
        # Turn 2: one more tool call
        # Turn 3: final text
        provider.stream_chat.side_effect = [
            iter([tc1, tc2]),
            iter(["All done."]),
        ]
        svc = _make_service(provider=provider)

        chunks = list(svc.stream_chat(
            provider_name="mock",
            model="m",
            messages=[ChatMessage(role="user", content="Read both")],
        ))

        # stream_chat should have been called exactly twice (tool loop + final)
        self.assertEqual(provider.stream_chat.call_count, 2)

        text_chunks = [c for c in chunks if c["type"] == "text"]
        self.assertEqual(len(text_chunks), 1)
        self.assertEqual(text_chunks[0]["content"], "All done.")


# ---------------------------------------------------------------------------
# structured_chat() tests
# ---------------------------------------------------------------------------

class StructuredChatTests(unittest.TestCase):
    """Tests for ChatService.structured_chat() — JSON mode / structured outputs."""

    def _available_json_status(self, *, models=None) -> ProviderStatus:
        """A ProviderStatus with JSON mode capability enabled."""
        if models is None:
            models = [ProviderModel(id="test-model", display_name="Test", provider="mock")]
        return ProviderStatus(
            name="mock",
            display_name="Mock",
            available=True,
            configured=True,
            models=models,
            capabilities=ProviderCapabilities(
                supports_streaming=True,
                supports_tools=True,
                supports_json_mode=True,
            ),
        )

    def _no_json_status(self) -> ProviderStatus:
        """A ProviderStatus without JSON mode support."""
        return ProviderStatus(
            name="mock",
            display_name="Mock",
            available=True,
            configured=True,
            models=[ProviderModel(id="m", display_name="M", provider="mock")],
            capabilities=ProviderCapabilities(supports_json_mode=False),
        )

    def test_empty_messages_raises(self):
        svc = _make_service()
        with self.assertRaises(ValueError):
            svc.structured_chat(provider_name="mock", model="m", messages=[], schema={})

    def test_unavailable_provider_raises(self):
        svc = _make_service(provider_status=_unavailable_status())
        with self.assertRaises(RuntimeError, msg="offline"):
            svc.structured_chat(
                provider_name="mock",
                model="m",
                messages=[ChatMessage(role="user", content="Make an NPC")],
                schema={"type": "object"},
            )

    def test_no_json_mode_support_raises(self):
        """Provider without JSON mode should raise ValueError before calling provider.chat()."""
        svc = _make_service(provider_status=self._no_json_status())
        with self.assertRaises(ValueError, msg="does not support JSON mode"):
            svc.structured_chat(
                provider_name="mock",
                model="m",
                messages=[ChatMessage(role="user", content="Make an NPC")],
                schema={"type": "object"},
            )

    @patch("gurpsai.app.services.chat.ActivityService")
    def test_auto_selects_first_of_multiple_models(self, _):
        """When model=None and multiple models are available, the first is selected automatically."""
        models = [
            ProviderModel(id="fast-model", display_name="Fast", provider="mock"),
            ProviderModel(id="slow-model", display_name="Slow", provider="mock"),
        ]
        provider = _make_mock_provider()
        provider.stream_chat.return_value = iter(['{"auto": true}'])
        svc = _make_service(
            provider_status=self._available_json_status(models=models),
            provider=provider,
        )
        result = svc.structured_chat(
            provider_name="mock",
            model=None,
            messages=[ChatMessage(role="user", content="Hi")],
            schema={},
        )
        self.assertTrue(result["auto"])
        call_kwargs = provider.stream_chat.call_args[1]
        self.assertEqual(call_kwargs["model"], "fast-model")

    @patch("gurpsai.app.services.chat.ActivityService")
    def test_invalid_json_response_raises(self, _):
        """Provider returns completely non-JSON text → JSONDecodeError propagates."""
        import json as _json

        provider = _make_mock_provider()
        provider.stream_chat.return_value = iter(["this is not json at all — no object here"])
        svc = _make_service(
            provider_status=self._available_json_status(),
            provider=provider,
        )

        with self.assertRaises(_json.JSONDecodeError):
            svc.structured_chat(
                provider_name="mock",
                model="test-model",
                messages=[ChatMessage(role="user", content="Make NPC")],
                schema={"type": "object"},
            )

    @patch("gurpsai.app.services.chat.ActivityService")
    def test_trailing_text_after_json_is_discarded(self, _):
        """raw_decode silently drops any text the model appends after the JSON object."""
        provider = _make_mock_provider()
        # Simulate streamed chunks: JSON split across chunks, then trailing prose
        provider.stream_chat.return_value = iter(['{"name": "Kira"}', "\n\nSome extra explanation."])
        svc = _make_service(
            provider_status=self._available_json_status(),
            provider=provider,
        )
        result = svc.structured_chat(
            provider_name="mock",
            model="test-model",
            messages=[ChatMessage(role="user", content="Make NPC")],
            schema={"type": "object"},
        )
        self.assertEqual(result["name"], "Kira")

    @patch("gurpsai.app.services.chat.ActivityService")
    def test_returns_parsed_json(self, _):
        """Provider returns valid JSON string → structured_chat returns parsed dict."""
        provider = _make_mock_provider()
        # JSON split across multiple stream chunks (realistic SSE behaviour)
        provider.stream_chat.return_value = iter(['{"name": "Valeria"', ', "points": 225}'])
        svc = _make_service(
            provider_status=self._available_json_status(),
            provider=provider,
        )

        schema = {
            "type": "object",
            "properties": {
                "name": {"type": "string"},
                "points": {"type": "integer"},
            },
        }
        result = svc.structured_chat(
            provider_name="mock",
            model="test-model",
            messages=[ChatMessage(role="user", content="Create NPC")],
            schema=schema,
        )
        self.assertIsInstance(result, dict)
        self.assertEqual(result["name"], "Valeria")
        self.assertEqual(result["points"], 225)

    @patch("gurpsai.app.services.chat.ActivityService")
    def test_passes_response_schema_to_provider(self, _):
        """Verify that StructuredOutputSchema is forwarded to provider.stream_chat()."""
        from gurpsai.domain.tools import StructuredOutputSchema

        provider = _make_mock_provider()
        provider.stream_chat.return_value = iter(['{"ok": true}'])
        svc = _make_service(
            provider_status=self._available_json_status(),
            provider=provider,
        )

        schema = {"type": "object", "properties": {"ok": {"type": "boolean"}}}
        svc.structured_chat(
            provider_name="mock",
            model="test-model",
            messages=[ChatMessage(role="user", content="Test")],
            schema=schema,
        )

        call_kwargs = provider.stream_chat.call_args[1]
        passed_schema = call_kwargs.get("response_schema")
        self.assertIsNotNone(passed_schema)
        self.assertIsInstance(passed_schema, StructuredOutputSchema)
        self.assertEqual(passed_schema.schema, schema)
        self.assertEqual(passed_schema.mime_type, "application/json")

    @patch("gurpsai.app.services.chat.ActivityService")
    def test_auto_selects_single_model(self, _):
        """When model=None and only one model is available, it is selected automatically."""
        provider = _make_mock_provider()
        provider.stream_chat.return_value = iter(['{"auto": true}'])
        svc = _make_service(
            provider_status=self._available_json_status(
                models=[ProviderModel(id="only-model", display_name="Only", provider="mock")]
            ),
            provider=provider,
        )
        result = svc.structured_chat(
            provider_name="mock",
            model=None,
            messages=[ChatMessage(role="user", content="Hi")],
            schema={},
        )
        self.assertTrue(result["auto"])
        call_kwargs = provider.stream_chat.call_args[1]
        self.assertEqual(call_kwargs["model"], "only-model")


if __name__ == "__main__":
    unittest.main()
