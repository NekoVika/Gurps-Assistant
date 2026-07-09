"""Unit tests for gurpsai.domain.tools — Tool, ToolParameter, ToolCall, ToolResult."""

import unittest
from dataclasses import FrozenInstanceError

from gurpsai.domain.tools import Tool, ToolCall, ToolParameter, ToolResult


class ToolParameterTests(unittest.TestCase):
    """Tests for the ToolParameter dataclass."""

    def test_basic_construction(self):
        param = ToolParameter(type="string", description="A file path")
        self.assertEqual(param.type, "string")
        self.assertEqual(param.description, "A file path")
        self.assertIsNone(param.enum)

    def test_enum_field(self):
        param = ToolParameter(type="string", description="Mode", enum=["fast", "slow"])
        self.assertEqual(param.enum, ["fast", "slow"])

    def test_frozen_immutability(self):
        param = ToolParameter(type="string", description="x")
        with self.assertRaises(FrozenInstanceError):
            param.type = "integer"  # type: ignore[misc]


class ToolTests(unittest.TestCase):
    """Tests for the Tool dataclass."""

    def test_minimal_construction(self):
        tool = Tool(name="ping", description="Ping the server")
        self.assertEqual(tool.name, "ping")
        self.assertEqual(tool.description, "Ping the server")
        self.assertEqual(tool.parameters, {})
        self.assertEqual(tool.required_parameters, [])

    def test_with_parameters(self):
        params = {
            "path": ToolParameter(type="string", description="File path"),
            "encoding": ToolParameter(type="string", description="Encoding", enum=["utf-8", "ascii"]),
        }
        tool = Tool(
            name="read_file",
            description="Read a file",
            parameters=params,
            required_parameters=["path"],
        )
        self.assertEqual(len(tool.parameters), 2)
        self.assertIn("path", tool.parameters)
        self.assertEqual(tool.required_parameters, ["path"])

    def test_frozen_immutability(self):
        tool = Tool(name="a", description="b")
        with self.assertRaises(FrozenInstanceError):
            tool.name = "c"  # type: ignore[misc]


class ToolCallTests(unittest.TestCase):
    """Tests for the ToolCall dataclass."""

    def test_basic_construction(self):
        tc = ToolCall(id="call_1", name="read_file", arguments={"path": "foo.json"})
        self.assertEqual(tc.id, "call_1")
        self.assertEqual(tc.name, "read_file")
        self.assertEqual(tc.arguments, {"path": "foo.json"})
        self.assertIsNone(tc.raw)

    def test_with_raw_payload(self):
        raw = {"functionCall": {"name": "read_file", "args": {"path": "foo.json"}}}
        tc = ToolCall(id="call_1", name="read_file", arguments={"path": "foo.json"}, raw=raw)
        self.assertEqual(tc.raw, raw)

    def test_frozen_immutability(self):
        tc = ToolCall(id="1", name="x", arguments={})
        with self.assertRaises(FrozenInstanceError):
            tc.id = "2"  # type: ignore[misc]


class ToolResultTests(unittest.TestCase):
    """Tests for the ToolResult dataclass."""

    def test_basic_construction(self):
        tr = ToolResult(tool_call_id="call_1", name="read_file", content="file contents here")
        self.assertEqual(tr.tool_call_id, "call_1")
        self.assertEqual(tr.name, "read_file")
        self.assertEqual(tr.content, "file contents here")

    def test_frozen_immutability(self):
        tr = ToolResult(tool_call_id="1", name="x", content="y")
        with self.assertRaises(FrozenInstanceError):
            tr.content = "z"  # type: ignore[misc]


if __name__ == "__main__":
    unittest.main()
