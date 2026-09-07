"""Spatial placement resolves through links; it is never stored.

The point of resolving is that only anchors move. When the party travels, the
campaign state changes and every NPC attached to a PC follows for free -- so a
travelling companion's own file never needs touching.
"""
import pytest

from gurpsai.app.services.placement import PlacementIndex

LOCATIONS = {
    "Rain World": {"name": "Rain World"},
    "Five Pebbles": {"name": "Five Pebbles", "parentLocation": "Rain World"},
    "The Leg": {"name": "The Leg", "parentLocation": "Five Pebbles"},
    "HQ": {"name": "HQ"},
    "Lower Market": {"name": "Lower Market", "parentLocation": "Rain World"},
}


def index(characters, party="HQ"):
    return PlacementIndex(locations=LOCATIONS, characters=characters, party_location=party)


def test_a_shopkeeper_resolves_to_his_own_location():
    idx = index({"Rick": {"name": "Rick", "location": "Lower Market"}})
    got = idx.resolve("Rick")
    assert got.status == "placed"
    assert got.location == "Lower Market"
    assert got.ancestors == ("Rain World",)


def test_placement_carries_the_full_containment_chain():
    idx = index({"Scout": {"name": "Scout", "location": "The Leg"}})
    assert idx.resolve("Scout").ancestors == ("Five Pebbles", "Rain World")


def test_a_companion_follows_a_pc_to_the_party_position():
    idx = index({
        "Jamie Hass": {"name": "Jamie Hass", "kind": "pc"},
        "Rick": {"name": "Rick", "location": "Jamie Hass"},
    }, party="HQ")
    got = idx.resolve("Rick")
    assert got.status == "placed"
    assert got.location == "HQ"
    assert got.chain == ("Jamie Hass", "HQ")


def test_moving_the_party_moves_every_follower_without_touching_them():
    characters = {
        "Jamie Hass": {"name": "Jamie Hass", "kind": "pc"},
        "Rick": {"name": "Rick", "location": "Jamie Hass"},
    }
    assert index(characters, party="HQ").resolve("Rick").location == "HQ"
    # Only the campaign state changed; Rick's file is identical.
    assert index(characters, party="Lower Market").resolve("Rick").location == "Lower Market"


def test_a_chain_of_followers_resolves_through_to_the_end():
    idx = index({
        "Jamie Hass": {"name": "Jamie Hass", "kind": "pc"},
        "Rick": {"name": "Rick", "location": "Jamie Hass"},
        "Rick's Dog": {"name": "Rick's Dog", "location": "Rick"},
    })
    got = idx.resolve("Rick's Dog")
    assert got.location == "HQ"
    assert got.chain == ("Rick", "Jamie Hass", "HQ")


def test_an_empty_link_is_unplaced_not_an_error():
    idx = index({"Rick": {"name": "Rick", "location": ""}})
    assert idx.resolve("Rick").status == "unplaced"


@pytest.mark.parametrize("placeholder", ["TBD", "N/A", "???"])
def test_placeholder_text_counts_as_unplaced(placeholder):
    idx = index({"Rick": {"name": "Rick", "location": placeholder}})
    assert idx.resolve("Rick").status == "unplaced"


def test_a_link_to_nothing_is_reported_with_its_target():
    idx = index({"Rick": {"name": "Rick", "location": "Atlantis"}})
    got = idx.resolve("Rick")
    assert got.status == "unresolved"
    assert got.unresolved_target == "Atlantis"


def test_mutual_following_is_caught_instead_of_looping():
    idx = index({
        "Rick": {"name": "Rick", "location": "Mara"},
        "Mara": {"name": "Mara", "location": "Rick"},
    })
    assert idx.resolve("Rick").status == "cycle"


def test_resolution_folds_case_and_underscores():
    idx = index({"Rick": {"name": "Rick", "location": "lower_market"}})
    assert idx.resolve("Rick").location == "Lower Market"


def test_a_location_is_already_somewhere():
    assert index({}).resolve("The Leg").status == "placed"


def test_an_unset_party_position_surfaces_rather_than_silently_failing():
    idx = index({
        "Jamie Hass": {"name": "Jamie Hass", "kind": "pc"},
        "Rick": {"name": "Rick", "location": "Jamie Hass"},
    }, party="")
    got = idx.resolve("Rick")
    assert got.status == "unresolved"
    assert "party" in (got.unresolved_target or "").lower()


def test_describe_shows_the_answer_and_the_route():
    idx = index({
        "Jamie Hass": {"name": "Jamie Hass", "kind": "pc"},
        "Rick": {"name": "Rick", "location": "Jamie Hass"},
    })
    assert idx.describe("Rick") == "HQ (via Jamie Hass)"
    assert idx.describe("Rick").startswith("HQ")


def test_describe_stays_plain_for_a_direct_placement():
    idx = index({"Rick": {"name": "Rick", "location": "Lower Market"}})
    assert idx.describe("Rick") == "Lower Market"
