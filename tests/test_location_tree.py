"""Spatial containment: parsing legacy region labels, and walking the tree.

The campaign's `region` field carried containment informally, so the parser has
to cope with real strings like "Rain World (Lower Regions)" and
"Five Pebbles Outer Shell" -- including one row whose region names itself.
"""
import pytest

from gurpsai.app.services.location_tree import (
    ancestors,
    find_cycles,
    resolve_parent,
    split_region,
)

NAMES = ["Rain World", "Five Pebbles", "Hinamizawa", "The Watch"]


@pytest.mark.parametrize("text,base,qualifier", [
    ("Rain World (Lower Regions)", "Rain World", "Lower Regions"),
    ("Rain World - Drowned Zone", "Rain World", "Drowned Zone"),
    ("Anatolia (Bronze Age — Trojan War era)", "Anatolia", "Bronze Age — Trojan War era"),
    ("Rain World", "Rain World", ""),
    ("", "", ""),
    ("   ", "", ""),
])
def test_split_region_separates_parent_from_qualifier(text, base, qualifier):
    assert split_region(text) == (base, qualifier)


def test_em_and_en_dashes_split_like_hyphens():
    assert split_region("Rain World — Drowned Zone")[0] == "Rain World"
    assert split_region("Rain World – Drowned Zone")[0] == "Rain World"


def test_hyphenated_names_are_not_split():
    # No surrounding spaces, so this is one name rather than parent + qualifier.
    assert split_region("Hinamizawa-Mura") == ("Hinamizawa-Mura", "")


def test_exact_match_resolves():
    assert resolve_parent("Rain World", "Drainage System", NAMES) == "Rain World"


def test_a_place_never_contains_itself():
    # Rain_World.json really does carry region "Rain World".
    assert resolve_parent("Rain World", "Rain World", NAMES) is None


def test_prefix_match_resolves_a_descriptive_label():
    assert resolve_parent("Five Pebbles Outer Shell", "The Leg", NAMES) == "Five Pebbles"


def test_resolution_folds_case_and_underscores():
    assert resolve_parent("rain_world", "The Shoals", NAMES) == "Rain World"


def test_unknown_places_stay_top_level():
    assert resolve_parent("Anatolia", "Troy", NAMES) is None
    assert resolve_parent("", "Troy", NAMES) is None


def test_longest_prefix_wins():
    names = ["The Watch", "The Watchtower"]
    assert resolve_parent("The Watchtower Roof", "Sniper Nest", names) == "The Watchtower"


def test_ancestors_are_nearest_first():
    parents = {"the leg": "Five Pebbles", "five pebbles": "Rain World"}
    assert ancestors("The Leg", parents) == ["Five Pebbles", "Rain World"]


def test_ancestors_stop_at_the_root():
    assert ancestors("Rain World", {"five pebbles": "Rain World"}) == []


def test_ancestors_survive_a_cycle_instead_of_hanging():
    parents = {"a": "B", "b": "A"}
    assert ancestors("A", parents) == ["B"]


def test_find_cycles_reports_a_two_node_loop_once():
    cycles = find_cycles({"a": "B", "b": "A"})
    assert len(cycles) == 1
    assert set(cycles[0]) == {"a", "b"}


def test_find_cycles_catches_a_self_parent():
    assert find_cycles({"a": "A"}) == [["a"]]


def test_a_healthy_tree_reports_no_cycles():
    assert find_cycles({"the leg": "Five Pebbles", "five pebbles": "Rain World"}) == []
