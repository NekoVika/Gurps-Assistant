"""Unit tests for ScopeService — semantic 'current scope' descriptor.

The service is exercised through an injected fake file provider (the shape of
CampaignFileService: read_file(path) -> object with .content, and
get_registry() -> list[dict]). No disk or app config is touched.
"""

import unittest
from dataclasses import dataclass

from gurpsai.app.services.scope import ScopeService


@dataclass
class _FakeFile:
    content: str


class _FakeFileService:
    """Minimal stand-in for CampaignFileService backed by an in-memory campaign."""

    def __init__(self, files: dict[str, str]):
        # files: virtual path (e.g. "Campaign/03_Story/...") -> JSON string
        self._files = files

    def read_file(self, path: str) -> _FakeFile:
        if path not in self._files:
            raise FileNotFoundError(path)
        return _FakeFile(content=self._files[path])

    def get_registry(self) -> list[dict]:
        import json
        from pathlib import Path

        registry = []
        for path, content in self._files.items():
            try:
                data = json.loads(content)
            except Exception:
                continue
            if not isinstance(data, dict):
                continue
            stem = Path(path).stem
            registry.append(
                {
                    "id": stem,
                    "title": data.get("title") or data.get("name") or stem,
                    "path": path,
                    "type": data.get("type", "Unknown"),
                }
            )
        return registry


def _make_campaign() -> dict[str, str]:
    import json

    files = {
        "Campaign/state.json": json.dumps(
            {
                "campaignName": "Anomaly Hunters",
                "activeQuests": ["Uncover the Watcher", "Stop the Rot spreading"],
                "recentEvents": ["The party arrived at the swamp."],
            }
        ),
        "Campaign/03_Story/Episodes/EP01_The_Rot_Beneath.json": json.dumps(
            {
                "title": "The Rot Beneath",
                "type": "Episode",
                "status": "Active",
                "childLinks": ["Swamp Crossing"],
                "premise": "The party investigates the Rot spreading beneath the "
                "swamp and the Watcher's shadowy role.",
            }
        ),
        "Campaign/03_Story/Chapters/Swamp_Crossing.json": json.dumps(
            {
                "title": "Swamp Crossing",
                "type": "Chapter",
                "status": "Draft",
                "childLinks": ["Drone Ambush", "Missing Bridge"],
                "premise": "Guide the group across the muddy wetland to firm ground.",
            }
        ),
        "Campaign/03_Story/Encounters/Drone_Ambush.json": json.dumps(
            {
                "title": "Drone Ambush",
                "type": "Encounter",
                "status": "Draft",
                "premise": "A local militia drone ambushes travelers on the causeway.",
                "childLinks": [],
            }
        ),
        "Campaign/02_Characters/Cast/Mara.json": json.dumps(
            {
                "name": "Mara",
                "type": "NPC",
                "role": "Local swamp guide",
                "concept": "Weathered scout",
            }
        ),
    }
    return files


class ScopeServiceTests(unittest.TestCase):
    def setUp(self):
        self.svc = ScopeService(file_service=_FakeFileService(_make_campaign()))

    # -- null / fallback behaviour -----------------------------------------

    def test_none_path_returns_none(self):
        self.assertIsNone(self.svc.describe(None))
        self.assertIsNone(self.svc.describe(""))
        self.assertIsNone(self.svc.describe("   "))

    def test_unreadable_path_returns_none(self):
        self.assertIsNone(self.svc.describe("Campaign/does/not/exist.json"))

    # -- story nodes: hierarchy --------------------------------------------

    def test_episode_lists_children_and_no_parent(self):
        out = self.svc.describe(
            "Campaign/03_Story/Episodes/EP01_The_Rot_Beneath.json"
        )
        self.assertIn("FOCUS SCOPE", out)
        self.assertIn('Episode "The Rot Beneath"', out)
        self.assertIn("Swamp Crossing", out)  # child link
        self.assertIn("none found", out)  # no parent references it

    def test_chapter_resolves_parent_and_flags_unresolved_child(self):
        out = self.svc.describe(
            "Campaign/03_Story/Chapters/Swamp_Crossing.json"
        )
        # Parent is the Episode whose childLinks include this chapter.
        self.assertIn("Parent: The Rot Beneath", out)
        # Drone Ambush exists; Missing Bridge does not.
        self.assertIn("NOT YET CREATED", out)
        self.assertIn("Missing Bridge", out)

    def test_encounter_resolves_parent_chapter(self):
        out = self.svc.describe(
            "Campaign/03_Story/Encounters/Drone_Ambush.json"
        )
        self.assertIn('Encounter "Drone Ambush"', out)
        self.assertIn("Parent: Swamp Crossing", out)

    # -- story nodes: arc linkage / guidance -------------------------------

    def test_episode_detects_arc_ties(self):
        out = self.svc.describe(
            "Campaign/03_Story/Episodes/EP01_The_Rot_Beneath.json"
        )
        # Premise overlaps global arcs on "watcher" and "spreading".
        self.assertIn("Possible ties to global arcs", out)
        self.assertIn("watcher", out.lower())
        self.assertIn("may connect", out)  # arc-aware guidance branch

    def test_standalone_chapter_gets_self_contained_guidance(self):
        out = self.svc.describe(
            "Campaign/03_Story/Chapters/Swamp_Crossing.json"
        )
        # No overlap with the global arcs -> standalone guidance.
        self.assertIn("LOCAL / standalone", out)
        self.assertIn("self-contained", out)
        self.assertIn("Do NOT weave the global arcs", out)

    def test_global_arcs_are_surfaced(self):
        out = self.svc.describe(
            "Campaign/03_Story/Chapters/Swamp_Crossing.json"
        )
        self.assertIn("Uncover the Watcher", out)
        self.assertIn("Stop the Rot spreading", out)

    # -- non-story entities -------------------------------------------------

    def test_character_gets_simple_descriptor(self):
        out = self.svc.describe("Campaign/02_Characters/Cast/Mara.json")
        self.assertIn('FOCUS SCOPE: Character "Mara"', out)
        self.assertIn("Local swamp guide", out)
        self.assertIn("focused on this character", out)
        # Non-story entities should not emit the hierarchy/arc block.
        self.assertNotIn("Child links", out)

    # -- resilience ---------------------------------------------------------

    def test_missing_state_file_no_arcs(self):
        files = _make_campaign()
        del files["Campaign/state.json"]
        svc = ScopeService(file_service=_FakeFileService(files))
        out = svc.describe("Campaign/03_Story/Chapters/Swamp_Crossing.json")
        self.assertIn("No global arcs are recorded", out)
        # Still self-contained guidance in the absence of arcs.
        self.assertIn("self-contained", out)


if __name__ == "__main__":
    unittest.main()
