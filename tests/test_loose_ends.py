"""The loose-ends report has to be able to reach zero.

A report that can never be finished gets ignored within a week, so nothing is
listed unless it has exactly one honest way to close. That is why types and PCs
are exempt by nature rather than dismissed by hand.
"""
from gurpsai.app.services.loose_ends import collect, summarise

LOCATIONS = {
    "HQ": {"name": "HQ"},
    "Lower Market": {"name": "Lower Market", "parentLocation": "HQ"},
}


def char(name, **kw):
    base = {"name": name, "kind": "individual", "location": "", "storyPlacement": {"node": "", "mode": "appearance"}}
    base.update(kw)
    return base


def issues(ends):
    return {(e.name, e.issue) for e in ends}


def test_a_fully_linked_individual_reports_nothing():
    chars = {"Rick": char("Rick", location="HQ", storyPlacement={"node": "Chapter 2", "mode": "fixture"})}
    assert collect(chars, LOCATIONS) == []


def test_an_unplaced_individual_is_loose_on_both_axes():
    ends = collect({"Rick": char("Rick")}, LOCATIONS)
    assert issues(ends) == {("Rick", "unplaced_spatial"), ("Rick", "unplaced_story")}


def test_a_bestiary_type_is_exempt_from_both_axes():
    # A template is not anywhere; its instances are.
    ends = collect({"Green Lizard": char("Green Lizard", kind="type")}, LOCATIONS)
    assert ends == []


def test_a_pc_is_exempt_from_spatial_placement():
    # PCs are wherever the party is, and that lives in campaign state.
    ends = collect({"Jamie": char("Jamie", kind="pc")}, LOCATIONS)
    assert ends == []


def test_a_companion_placed_through_a_pc_is_settled():
    chars = {
        "Jamie": char("Jamie", kind="pc"),
        "Rick": char("Rick", location="Jamie", storyPlacement={"node": "Chapter 2", "mode": "fixture"}),
    }
    assert collect(chars, LOCATIONS, party_location="HQ") == []


def test_pointing_at_a_missing_place_names_the_target():
    ends = collect({"Rick": char("Rick", location="Atlantis")}, LOCATIONS)
    unresolved = [e for e in ends if e.issue == "unresolved_location"]
    assert len(unresolved) == 1
    assert "Atlantis" in unresolved[0].detail


def test_unresolved_replaces_unplaced_rather_than_doubling_up():
    # One spatial problem per character, or the count stops meaning anything.
    ends = collect({"Rick": char("Rick", location="Atlantis")}, LOCATIONS)
    spatial = [e for e in ends if e.issue in {"unplaced_spatial", "unresolved_location"}]
    assert len(spatial) == 1


def test_characters_following_each_other_in_a_loop_are_reported():
    chars = {
        "Rick": char("Rick", location="Mara"),
        "Mara": char("Mara", location="Rick"),
    }
    ends = collect(chars, LOCATIONS)
    assert any(e.issue == "placement_cycle" for e in ends)


def test_locations_containing_each_other_are_reported():
    locs = {
        "A": {"name": "A", "parentLocation": "B"},
        "B": {"name": "B", "parentLocation": "A"},
    }
    ends = collect({}, locs)
    assert [e.issue for e in ends] == ["containment_cycle"]


def test_structural_problems_sort_above_missing_placements():
    chars = {
        "Rick": char("Rick"),
        "Mara": char("Mara", location="Nowhere"),
    }
    locs = {"A": {"name": "A", "parentLocation": "B"}, "B": {"name": "B", "parentLocation": "A"}}
    order = [e.issue for e in collect(chars, locs)]
    assert order[0] == "containment_cycle"
    assert order.index("unresolved_location") < order.index("unplaced_spatial")


def test_placeholder_story_nodes_do_not_count_as_placed():
    chars = {"Rick": char("Rick", location="HQ", storyPlacement={"node": "TBD", "mode": "appearance"})}
    assert any(e.issue == "unplaced_story" for e in collect(chars, LOCATIONS))


def test_summarise_counts_per_issue():
    chars = {"Rick": char("Rick"), "Mara": char("Mara")}
    assert summarise(collect(chars, LOCATIONS)) == {"unplaced_spatial": 2, "unplaced_story": 2}


def test_entries_carry_their_file_so_the_ui_can_open_them():
    ends = collect({"Rick": char("Rick")}, LOCATIONS, paths={"Rick": "Campaign/02_Characters/Rick.json"})
    assert all(e.source_path.endswith("Rick.json") for e in ends)


def test_every_issue_has_a_human_label():
    chars = {"Rick": char("Rick", location="Nowhere")}
    assert all(e.label and e.label != e.issue for e in collect(chars, LOCATIONS))


def test_a_types_habitat_text_is_not_treated_as_a_broken_link():
    # Bestiary entries carry descriptive habitat ("Shaded Citadel (Dark zones)").
    # They are exempt from placement, so that text is flavour, not a reference.
    ends = collect({"Green Lizard": char("Green Lizard", kind="type", location="Shaded Citadel (Dark zones)")}, LOCATIONS)
    assert ends == []


def test_a_pcs_location_text_is_not_validated_either():
    # A PC is wherever the party is; whatever the field says is a leftover note.
    ends = collect({"Jamie": char("Jamie", kind="pc", location="HQ / Current Mission")}, LOCATIONS)
    assert ends == []


def test_a_mutual_relation_is_not_a_loose_end():
    chars = {
        "Rick": char("Rick", location="HQ", storyPlacement={"node": "Ch 2", "mode": "fixture"},
                     characterRelations=[{"name": "Rachel", "relation": "Handler"}]),
        "Rachel": char("Rachel", location="HQ", storyPlacement={"node": "Ch 2", "mode": "fixture"},
                       characterRelations=[{"name": "Rick", "relation": "Asset"}]),
    }
    assert collect(chars, LOCATIONS) == []


def test_a_relation_recorded_on_one_side_only_is_reported():
    chars = {
        "Rick": char("Rick", location="HQ", storyPlacement={"node": "Ch 2", "mode": "fixture"},
                     characterRelations=[{"name": "Rachel", "relation": "Handler"}]),
        "Rachel": char("Rachel", location="HQ", storyPlacement={"node": "Ch 2", "mode": "fixture"}),
    }
    ends = [e for e in collect(chars, LOCATIONS) if e.issue == "one_sided_relation"]
    assert len(ends) == 1
    assert "Rachel" in ends[0].detail and "Handler" in ends[0].detail


def test_each_broken_pair_is_reported_once_not_twice():
    chars = {
        "Rick": char("Rick", location="HQ", storyPlacement={"node": "Ch 2", "mode": "fixture"},
                     characterRelations=[{"name": "Rachel", "relation": "Handler"}]),
        "Rachel": char("Rachel", location="HQ", storyPlacement={"node": "Ch 2", "mode": "fixture"}),
    }
    assert len([e for e in collect(chars, LOCATIONS) if e.issue == "one_sided_relation"]) == 1


def test_a_relation_to_a_missing_character_is_left_to_the_dangling_report():
    chars = {"Rick": char("Rick", location="HQ", storyPlacement={"node": "Ch 2", "mode": "fixture"},
                          characterRelations=[{"name": "Nobody", "relation": "Rival"}])}
    assert [e for e in collect(chars, LOCATIONS) if e.issue == "one_sided_relation"] == []


def test_reciprocity_matching_folds_case_and_underscores():
    chars = {
        "The Watch": char("The Watch", location="HQ", storyPlacement={"node": "Ch 2", "mode": "fixture"},
                          characterRelations=[{"name": "Rick", "relation": "Watches"}]),
        "Rick": char("Rick", location="HQ", storyPlacement={"node": "Ch 2", "mode": "fixture"},
                     characterRelations=[{"name": "the_watch", "relation": "Watched by"}]),
    }
    assert [e for e in collect(chars, LOCATIONS) if e.issue == "one_sided_relation"] == []
