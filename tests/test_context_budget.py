"""Unit tests for ContextService — context budget guard and file tree truncation.

All filesystem and campaign file access is mocked.
"""

import unittest
from unittest.mock import MagicMock, patch


# CampaignFileService is imported lazily inside build_system_prompt(), so we
# must patch it at the location where Python resolves the name at import time —
# i.e. at the source module, then make the lazy import resolve to our mock.
_FS_PATCH = "gurpsai.app.services.files.CampaignFileService"


class ContextBudgetTests(unittest.TestCase):
    """Tests for the _MAX_CONTEXT_CHARS budget guard in ContextService."""

    def _make_service(self):
        from gurpsai.app.services.context import ContextService
        return ContextService()

    @patch("gurpsai.app.services.context._resolve_campaign_root")
    @patch("gurpsai.app.services.context.build_gm_base")
    @patch("gurpsai.app.services.context.get_persona_overlay")
    def test_prompt_contains_all_sections_when_under_budget(
        self, mock_overlay, mock_base, mock_root
    ):
        """When the assembled prompt is under budget, the full file tree is included."""
        mock_base.return_value = "GM identity"
        mock_overlay.return_value = None

        import tempfile, pathlib
        tmp = pathlib.Path(tempfile.mkdtemp())
        (tmp / "state.json").write_text('{"campaign": "test"}', encoding="utf-8")
        (tmp / "System_Rules.json").write_text('{"pointBudget": "225"}', encoding="utf-8")
        mock_root.return_value = tmp

        fake_node = MagicMock()
        fake_node.node_type = "file"
        fake_node.path = "Campaign/NPC/test.json"

        mock_fs = MagicMock()
        mock_fs.tree.return_value = [fake_node]

        # Patch the lazy import by injecting into sys.modules before the import happens
        import gurpsai.app.services.files as files_mod
        original_cls = files_mod.CampaignFileService
        try:
            files_mod.CampaignFileService = MagicMock(return_value=mock_fs)
            svc = self._make_service()
            prompt = svc.build_system_prompt()
        finally:
            files_mod.CampaignFileService = original_cls

        self.assertIn("Campaign/NPC/test.json", prompt)
        self.assertIn("state.json", prompt)
        self.assertIn("System_Rules.json", prompt)
        self.assertIn("AI CAPABILITIES", prompt)

    @patch("gurpsai.app.services.context._resolve_campaign_root")
    @patch("gurpsai.app.services.context.build_gm_base")
    @patch("gurpsai.app.services.context.get_persona_overlay")
    def test_file_tree_truncated_when_over_budget(
        self, mock_overlay, mock_base, mock_root
    ):
        """When the assembled prompt exceeds the budget, the file tree is truncated."""
        import gurpsai.app.services.context as ctx_mod

        # Temporarily shrink the budget to 200 chars for this test
        original_budget = ctx_mod._MAX_CONTEXT_CHARS
        ctx_mod._MAX_CONTEXT_CHARS = 200
        try:
            # Base prompt that fills most of the budget
            mock_base.return_value = "G" * 150
            mock_overlay.return_value = None

            import tempfile, pathlib
            tmp = pathlib.Path(tempfile.mkdtemp())
            mock_root.return_value = tmp

            nodes = []
            for i in range(50):
                n = MagicMock()
                n.node_type = "file"
                n.path = f"Campaign/Entity/file_{i:03d}.json"
                nodes.append(n)

            mock_fs = MagicMock()
            mock_fs.tree.return_value = nodes

            import gurpsai.app.services.files as files_mod
            original_cls = files_mod.CampaignFileService
            try:
                files_mod.CampaignFileService = MagicMock(return_value=mock_fs)
                svc = self._make_service()
                prompt = svc.build_system_prompt()
            finally:
                files_mod.CampaignFileService = original_cls
        finally:
            ctx_mod._MAX_CONTEXT_CHARS = original_budget

        # Tooling section must still be present
        self.assertIn("AI CAPABILITIES", prompt)
        # Last file should have been truncated away
        self.assertNotIn("file_049.json", prompt, "Last file should have been truncated")

    @patch("gurpsai.app.services.context._resolve_campaign_root")
    @patch("gurpsai.app.services.context.build_gm_base")
    @patch("gurpsai.app.services.context.get_persona_overlay")
    def test_persona_overlay_included(self, mock_overlay, mock_base, mock_root):
        """When a persona is given and overlay exists, it appears in the prompt."""
        mock_base.return_value = "base"
        mock_overlay.return_value = "KingCrab persona overlay"

        import tempfile, pathlib
        tmp = pathlib.Path(tempfile.mkdtemp())
        mock_root.return_value = tmp

        mock_fs = MagicMock()
        mock_fs.tree.return_value = []

        import gurpsai.app.services.files as files_mod
        original_cls = files_mod.CampaignFileService
        try:
            files_mod.CampaignFileService = MagicMock(return_value=mock_fs)
            svc = self._make_service()
            prompt = svc.build_system_prompt(persona="KingCrab")
        finally:
            files_mod.CampaignFileService = original_cls

        self.assertIn("KingCrab persona overlay", prompt)
        mock_overlay.assert_called_once_with("KingCrab")

    @patch("gurpsai.app.services.context._resolve_campaign_root")
    @patch("gurpsai.app.services.context.build_gm_base")
    @patch("gurpsai.app.services.context.get_persona_overlay")
    def test_missing_campaign_files_skipped_gracefully(
        self, mock_overlay, mock_base, mock_root
    ):
        """Missing state.json or System_Rules.json are skipped with a log warning, not a crash."""
        mock_base.return_value = "base"
        mock_overlay.return_value = None

        import tempfile, pathlib
        tmp = pathlib.Path(tempfile.mkdtemp())
        # No campaign files created — they should be silently skipped
        mock_root.return_value = tmp

        mock_fs = MagicMock()
        mock_fs.tree.return_value = []

        import gurpsai.app.services.files as files_mod
        original_cls = files_mod.CampaignFileService
        try:
            files_mod.CampaignFileService = MagicMock(return_value=mock_fs)
            svc = self._make_service()
            prompt = svc.build_system_prompt()
        finally:
            files_mod.CampaignFileService = original_cls

        self.assertIn("base", prompt)
        self.assertIn("AI CAPABILITIES", prompt)

    @patch("gurpsai.app.services.context._resolve_campaign_root")
    @patch("gurpsai.app.services.context.build_gm_base")
    @patch("gurpsai.app.services.context.get_persona_overlay")
    def test_file_tree_service_failure_skipped_gracefully(
        self, mock_overlay, mock_base, mock_root
    ):
        """If CampaignFileService.tree() raises, the section is skipped without crashing."""
        mock_base.return_value = "base"
        mock_overlay.return_value = None

        import tempfile, pathlib
        tmp = pathlib.Path(tempfile.mkdtemp())
        mock_root.return_value = tmp

        mock_fs = MagicMock()
        mock_fs.tree.side_effect = RuntimeError("Campaign not found")

        import gurpsai.app.services.files as files_mod
        original_cls = files_mod.CampaignFileService
        try:
            files_mod.CampaignFileService = MagicMock(return_value=mock_fs)
            svc = self._make_service()
            prompt = svc.build_system_prompt()
        finally:
            files_mod.CampaignFileService = original_cls

        # Tooling section is still emitted even when file tree fails
        self.assertIn("AI CAPABILITIES", prompt)


if __name__ == "__main__":
    unittest.main()
