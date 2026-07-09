"""Unit tests for GeminiProvider formatting and parsing logic.

All tests mock HTTP calls — no API key or network required.
"""

import json
import unittest
from io import BytesIO
from unittest.mock import MagicMock, patch

from gurpsai.domain.providers import ProviderCapabilities
from gurpsai.domain.tools import Tool, ToolCall, ToolParameter
from gurpsai.providers.base import ChatMessage
from gurpsai.providers.gemini import GeminiConfig, GeminiProvider


def _make_provider() -> GeminiProvider:
    """Create a GeminiProvider with a fake API key, bypassing config loading."""
    return GeminiProvider(config=GeminiConfig(api_key="test-key-000"))


class FormatToolsTests(unittest.TestCase):
    """Tests for GeminiProvider._format_tools()."""

    def setUp(self):
        self.provider = _make_provider()

    def test_none_returns_none(self):
        result = self.provider._format_tools(None)
        self.assertIsNone(result)

    def test_empty_list_returns_none(self):
        result = self.provider._format_tools([])
        self.assertIsNone(result)

    def test_single_tool(self):
        tools = [
            Tool(
                name="read_file",
                description="Read a file",
                parameters={"path": ToolParameter(type="string", description="File path")},
                required_parameters=["path"],
            )
        ]
        result = self.provider._format_tools(tools)
        self.assertIsNotNone(result)
        self.assertEqual(len(result), 1)

        decls = result[0]["functionDeclarations"]
        self.assertEqual(len(decls), 1)
        decl = decls[0]
        self.assertEqual(decl["name"], "read_file")
        self.assertEqual(decl["description"], "Read a file")
        self.assertEqual(decl["parameters"]["type"], "OBJECT")
        self.assertIn("path", decl["parameters"]["properties"])
        self.assertEqual(decl["parameters"]["properties"]["path"]["type"], "STRING")
        self.assertEqual(decl["parameters"]["required"], ["path"])

    def test_tool_with_enum_parameter(self):
        tools = [
            Tool(
                name="set_mode",
                description="Set mode",
                parameters={"mode": ToolParameter(type="string", description="Mode", enum=["fast", "slow"])},
                required_parameters=["mode"],
            )
        ]
        result = self.provider._format_tools(tools)
        decl = result[0]["functionDeclarations"][0]
        self.assertEqual(decl["parameters"]["properties"]["mode"]["enum"], ["fast", "slow"])

    def test_multiple_tools(self):
        tools = [
            Tool(name="tool_a", description="A"),
            Tool(name="tool_b", description="B"),
            Tool(name="tool_c", description="C"),
        ]
        result = self.provider._format_tools(tools)
        decls = result[0]["functionDeclarations"]
        self.assertEqual(len(decls), 3)
        names = [d["name"] for d in decls]
        self.assertEqual(names, ["tool_a", "tool_b", "tool_c"])


class FormatMessagesTests(unittest.TestCase):
    """Tests for GeminiProvider._format_messages()."""

    def setUp(self):
        self.provider = _make_provider()

    def test_system_messages_extracted(self):
        msgs = [
            ChatMessage(role="system", content="You are a GM."),
            ChatMessage(role="user", content="Hello"),
        ]
        content, system = self.provider._format_messages(msgs)
        self.assertEqual(system, ["You are a GM."])
        self.assertEqual(len(content), 1)
        self.assertEqual(content[0]["role"], "user")

    def test_user_and_assistant_roles(self):
        msgs = [
            ChatMessage(role="user", content="Hi"),
            ChatMessage(role="assistant", content="Hello!"),
        ]
        content, system = self.provider._format_messages(msgs)
        self.assertEqual(len(system), 0)
        self.assertEqual(content[0]["role"], "user")
        self.assertEqual(content[1]["role"], "model")

    def test_tool_role_as_function_response(self):
        msgs = [
            ChatMessage(role="tool", content="file data here", tool_call_id="read_file"),
        ]
        content, system = self.provider._format_messages(msgs)
        self.assertEqual(len(content), 1)
        self.assertEqual(content[0]["role"], "user")
        part = content[0]["parts"][0]
        self.assertIn("functionResponse", part)
        self.assertEqual(part["functionResponse"]["name"], "read_file")
        self.assertEqual(part["functionResponse"]["response"]["content"], "file data here")

    def test_assistant_with_tool_calls_raw(self):
        """When tool_calls have a raw payload, that exact raw dict is used as the part."""
        raw_part = {"functionCall": {"name": "read_file", "args": {"path": "x.json"}}, "thought": True}
        tc = ToolCall(id="read_file", name="read_file", arguments={"path": "x.json"}, raw=raw_part)
        msgs = [
            ChatMessage(role="assistant", content="", tool_calls=[tc]),
        ]
        content, _ = self.provider._format_messages(msgs)
        self.assertEqual(len(content), 1)
        # The raw part should be preserved exactly
        self.assertIn(raw_part, content[0]["parts"])

    def test_assistant_with_tool_calls_no_raw(self):
        """When tool_calls lack raw, a synthetic functionCall part is created."""
        tc = ToolCall(id="read_file", name="read_file", arguments={"path": "y.json"})
        msgs = [
            ChatMessage(role="assistant", content="", tool_calls=[tc]),
        ]
        content, _ = self.provider._format_messages(msgs)
        parts = content[0]["parts"]
        fn_parts = [p for p in parts if "functionCall" in p]
        self.assertEqual(len(fn_parts), 1)
        self.assertEqual(fn_parts[0]["functionCall"]["name"], "read_file")
        self.assertEqual(fn_parts[0]["functionCall"]["args"], {"path": "y.json"})

    def test_empty_content_and_no_tool_calls_skipped(self):
        """A message with empty content and no tool_calls produces no parts → skipped."""
        msgs = [ChatMessage(role="assistant", content="")]
        content, _ = self.provider._format_messages(msgs)
        self.assertEqual(len(content), 0)


class ChatResponseParsingTests(unittest.TestCase):
    """Tests for GeminiProvider.chat() response parsing, with mocked HTTP."""

    def setUp(self):
        self.provider = _make_provider()

    def _mock_post(self, response_data: dict):
        """Patch _post_json to return the given data."""
        return patch.object(self.provider, "_post_json", return_value=response_data)

    def test_text_only_response(self):
        data = {
            "candidates": [{
                "content": {
                    "parts": [{"text": "Hello, adventurer!"}]
                }
            }]
        }
        with self._mock_post(data):
            result = self.provider.chat(
                [ChatMessage(role="user", content="Hi")],
                model="gemini-2.5-flash",
            )
        self.assertEqual(result.text, "Hello, adventurer!")
        self.assertEqual(result.tool_calls, [])
        self.assertEqual(result.model, "gemini-2.5-flash")
        self.assertEqual(result.provider, "gemini")

    def test_function_call_response(self):
        data = {
            "candidates": [{
                "content": {
                    "parts": [{
                        "functionCall": {"name": "read_file", "args": {"path": "state.json"}}
                    }]
                }
            }]
        }
        with self._mock_post(data):
            result = self.provider.chat(
                [ChatMessage(role="user", content="Read state")],
                model="gemini-2.5-flash",
            )
        self.assertEqual(result.text, "")
        self.assertEqual(len(result.tool_calls), 1)
        tc = result.tool_calls[0]
        self.assertEqual(tc.name, "read_file")
        self.assertEqual(tc.arguments, {"path": "state.json"})
        # raw should be the entire part dict
        self.assertIsNotNone(tc.raw)
        self.assertIn("functionCall", tc.raw)

    def test_mixed_text_and_function_call(self):
        data = {
            "candidates": [{
                "content": {
                    "parts": [
                        {"text": "Let me check that. "},
                        {"functionCall": {"name": "query_rules", "args": {"query": "Deceptive Attack"}}}
                    ]
                }
            }]
        }
        with self._mock_post(data):
            result = self.provider.chat(
                [ChatMessage(role="user", content="How does Deceptive Attack work?")],
                model="gemini-2.5-flash",
            )
        self.assertEqual(result.text, "Let me check that. ")
        self.assertEqual(len(result.tool_calls), 1)
        self.assertEqual(result.tool_calls[0].name, "query_rules")

    def test_no_candidates_raises(self):
        with self._mock_post({"candidates": []}):
            with self.assertRaises(RuntimeError):
                self.provider.chat(
                    [ChatMessage(role="user", content="Hi")],
                    model="gemini-2.5-flash",
                )

    def test_no_api_key_raises(self):
        provider = GeminiProvider(config=GeminiConfig(api_key=None))
        with self.assertRaises(RuntimeError, msg="Add GEMINI_API_KEY"):
            provider.chat(
                [ChatMessage(role="user", content="Hi")],
                model="gemini-2.5-flash",
            )


class StreamChatParsingTests(unittest.TestCase):
    """Tests for GeminiProvider.stream_chat() SSE parsing."""

    def setUp(self):
        self.provider = _make_provider()

    def _make_sse_response(self, events: list[dict]) -> MagicMock:
        """Build a mock HTTP response that yields SSE data lines."""
        lines = []
        for event in events:
            lines.append(f"data: {json.dumps(event)}\n".encode("utf-8"))
        mock_resp = MagicMock()
        mock_resp.__enter__ = MagicMock(return_value=mock_resp)
        mock_resp.__exit__ = MagicMock(return_value=False)
        mock_resp.__iter__ = MagicMock(return_value=iter(lines))
        return mock_resp

    @patch("gurpsai.providers.gemini.request.urlopen")
    def test_text_chunks_yielded(self, mock_urlopen):
        events = [
            {"candidates": [{"content": {"parts": [{"text": "Hello "}]}}]},
            {"candidates": [{"content": {"parts": [{"text": "world!"}]}}]},
        ]
        mock_urlopen.return_value = self._make_sse_response(events)

        chunks = list(self.provider.stream_chat(
            [ChatMessage(role="user", content="Hi")],
            model="gemini-2.5-flash",
        ))
        self.assertEqual(chunks, ["Hello ", "world!"])

    @patch("gurpsai.providers.gemini.request.urlopen")
    def test_function_call_yielded_as_tool_call(self, mock_urlopen):
        events = [
            {"candidates": [{"content": {"parts": [
                {"functionCall": {"name": "read_file", "args": {"path": "x.json"}}}
            ]}}]},
        ]
        mock_urlopen.return_value = self._make_sse_response(events)

        chunks = list(self.provider.stream_chat(
            [ChatMessage(role="user", content="Read x")],
            model="gemini-2.5-flash",
        ))
        self.assertEqual(len(chunks), 1)
        self.assertIsInstance(chunks[0], ToolCall)
        self.assertEqual(chunks[0].name, "read_file")

    @patch("gurpsai.providers.gemini.request.urlopen")
    def test_malformed_sse_lines_skipped(self, mock_urlopen):
        """Lines that aren't valid SSE or valid JSON should be silently skipped."""
        lines = [
            b"not-sse-data\n",
            b"data: {invalid json\n",
            b"data: " + json.dumps({"candidates": [{"content": {"parts": [{"text": "ok"}]}}]}).encode() + b"\n",
        ]
        mock_resp = MagicMock()
        mock_resp.__enter__ = MagicMock(return_value=mock_resp)
        mock_resp.__exit__ = MagicMock(return_value=False)
        mock_resp.__iter__ = MagicMock(return_value=iter(lines))
        mock_urlopen.return_value = mock_resp

        chunks = list(self.provider.stream_chat(
            [ChatMessage(role="user", content="Test")],
            model="gemini-2.5-flash",
        ))
        self.assertEqual(chunks, ["ok"])

    def test_no_api_key_raises(self):
        provider = GeminiProvider(config=GeminiConfig(api_key=None))
        with self.assertRaises(RuntimeError):
            list(provider.stream_chat(
                [ChatMessage(role="user", content="Hi")],
                model="gemini-2.5-flash",
            ))


class ModelSortKeyTests(unittest.TestCase):
    """Tests for the model sort preference logic."""

    def setUp(self):
        self.provider = _make_provider()

    def test_preferred_order(self):
        ids = ["gemini-2.0-flash", "gemini-2.5-pro", "gemini-2.5-flash", "unknown-model"]
        sorted_ids = sorted(ids, key=self.provider._sort_key)
        self.assertEqual(sorted_ids[0], "gemini-2.5-flash")
        self.assertEqual(sorted_ids[1], "gemini-2.5-pro")
        self.assertEqual(sorted_ids[2], "gemini-2.0-flash")
        # unknown pushed to end
        self.assertEqual(sorted_ids[3], "unknown-model")


if __name__ == "__main__":
    unittest.main()
