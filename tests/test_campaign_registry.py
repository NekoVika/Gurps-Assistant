"""What the campaign registry counts as an entity.

The registry is what every link check asks. `entityExists`, the "create a stub
for this?" prompt, the missing-entity banner and the entity picker all read it,
so anything it lists is treated as a real, referenceable thing in the campaign.

It was listing the contents of the campaign's own hidden folders: thirteen
entities that had been deleted into .trash, and three chat sessions out of
.planning. A deleted Helen still answered to entityExists.
"""
import json

import pytest

from gurpsai.app.services.files import CampaignFileService


@pytest.fixture()
def campaign(tmp_path, monkeypatch):
    """A campaign with a real entity, a deleted one, and a chat session."""
    root = tmp_path / "TestCampaign"
    (root / "02_Characters" / "Main_Cast").mkdir(parents=True)
    (root / "02_Characters" / "Main_Cast" / "Helen.json").write_text(
        json.dumps({"name": "Helen", "type": "Character"}), encoding="utf-8")

    # The trash keeps what was deleted, next to a note of where it came from.
    (root / ".trash").mkdir()
    (root / ".trash" / "abc123.meta.json").write_text(
        json.dumps({"name": "Karin.json", "original": "02_Characters/Main_Cast/Karin.json"}),
        encoding="utf-8")
    (root / ".trash" / "abc123.dat").write_text(
        json.dumps({"name": "Karin", "type": "Character"}), encoding="utf-8")

    # Chat sessions live beside the campaign and are not part of it.
    (root / ".planning" / "sessions").mkdir(parents=True)
    (root / ".planning" / "sessions" / "s1.json").write_text(
        json.dumps({"title": "New Chat"}), encoding="utf-8")

    monkeypatch.chdir(tmp_path)
    service = CampaignFileService(root=tmp_path)
    service._campaign_root = root.resolve()
    return service


def titles(service) -> set[str]:
    return {item["title"] for item in service.get_registry()}


def paths(service) -> list[str]:
    return [item["path"] for item in service.get_registry()]


class TestWhatCounts:
    def test_a_real_entity_is_listed(self, campaign):
        assert "Helen" in titles(campaign)

    def test_something_deleted_is_not(self, campaign):
        # It is in .trash precisely because the GM said it is gone.
        assert "Karin.json" not in titles(campaign)
        assert "Karin" not in titles(campaign)

    def test_a_chat_session_is_not_an_entity(self, campaign):
        assert "New Chat" not in titles(campaign)

    def test_nothing_from_a_hidden_folder_is_listed(self, campaign):
        assert not [p for p in paths(campaign) if "/." in p]

    def test_the_real_entity_is_the_only_one(self, campaign):
        assert len(campaign.get_registry()) == 1

    def test_a_dotted_file_is_still_skipped(self, campaign, tmp_path):
        # The original guard, which is right as far as it goes.
        root = tmp_path / "TestCampaign"
        (root / ".gurpsai_cache.json").write_text(json.dumps({"name": "cache"}), encoding="utf-8")
        assert "cache" not in titles(campaign)

    def test_a_folder_that_merely_contains_a_dot_is_fine(self, campaign, tmp_path):
        # Only a leading dot hides a folder; "Episode_3.5" is a real one.
        root = tmp_path / "TestCampaign"
        (root / "03_Story" / "Episode_3.5").mkdir(parents=True)
        (root / "03_Story" / "Episode_3.5" / "Overview.json").write_text(
            json.dumps({"name": "The Interlude", "type": "Episode"}), encoding="utf-8")
        assert "The Interlude" in titles(campaign)
