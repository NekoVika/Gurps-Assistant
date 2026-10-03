"""One narrative home per entity, qualified by what kind of belonging it is.

`mode` separates two relations that behave oppositely: an appearance rolls
upward only, a fixture is the deliberate exception that reaches downward into
every descendant.
"""
import pytest
from pydantic import ValidationError

from gurpsai.domain.campaign import CharacterData, LocationData, StoryPlacement


def test_entities_start_unplaced_rather_than_invalid():
    # A name-only character stays schema-valid; unplaced is a loose end to
    # report, never a parse failure.
    char = CharacterData(name="Rick")
    assert char.storyPlacement.node == ""
    assert char.storyPlacement.mode == "appearance"


def test_locations_carry_the_same_axis_as_characters():
    # An HQ is campaign-level; a back alley exists only for one encounter.
    hq = LocationData(name="HQ", storyPlacement={"node": "Anomaly Hunters", "mode": "fixture"})
    assert hq.storyPlacement.mode == "fixture"
    assert LocationData(name="Back Alley").storyPlacement.node == ""


def test_a_recurring_trader_is_a_fixture_of_his_chapter():
    rick = CharacterData(name="Rick", storyPlacement={"node": "Chapter 2", "mode": "fixture"})
    assert rick.storyPlacement.node == "Chapter 2"


def test_extra_appearances_use_the_existing_plural_field():
    # The singular field answers "where does he belong"; one-offs elsewhere do
    # not compete with it.
    rick = CharacterData(
        name="Rick",
        storyPlacement={"node": "Chapter 2", "mode": "fixture"},
        storyAppearances=["Encounter 4.3: The Robbery"],
    )
    assert rick.storyPlacement.mode == "fixture"
    assert rick.storyAppearances == ["Encounter 4.3: The Robbery"]


@pytest.mark.parametrize("bad", ["Fixture", "cameo", "", "recurring"])
def test_unknown_modes_are_rejected_at_the_boundary(bad):
    # significance drifted into four vocabularies because it was a free string.
    with pytest.raises(ValidationError):
        StoryPlacement(node="Chapter 2", mode=bad)


def test_placement_survives_a_round_trip():
    rick = CharacterData(name="Rick", storyPlacement={"node": "Chapter 2", "mode": "fixture"})
    assert CharacterData(**rick.model_dump()).storyPlacement.mode == "fixture"


def test_legacy_files_without_the_field_still_load():
    legacy = {"name": "The Watcher", "concept": "Antagonist", "storyAppearances": ["Episode 3"]}
    char = CharacterData(**legacy)
    assert char.storyPlacement.node == ""
    assert char.storyAppearances == ["Episode 3"]
