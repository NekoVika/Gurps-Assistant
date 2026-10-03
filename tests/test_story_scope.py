"""Scope reads downward, but only for fixtures.

This is the asymmetry `storyPlacement.mode` exists to record. Getting it wrong
in either direction breaks focus mode: treat appearances as inherited and every
encounter shows the whole episode's cast; ignore fixtures and the recurring
trader vanishes from the scenes he is meant to be in.
"""
import pytest

from gurpsai.app.services.story_scope import StoryScope, build_parents

NODES = {
    "Episode 3": {"childLinks": ["Chapter 1", "Chapter 2"]},
    "Chapter 1": {"childLinks": ["Encounter A", "Encounter B"]},
    "Chapter 2": {"childLinks": []},
    "Encounter A": {},
    "Encounter B": {},
}


def placed(node, mode="appearance"):
    return {"storyPlacement": {"node": node, "mode": mode}}


def scope(entities):
    return StoryScope(nodes=NODES, entities=entities)


def names(members):
    return [m.name for m in members]


def test_parents_come_from_childlinks():
    parents = build_parents(NODES)
    assert parents["chapter 1"] == "Episode 3"
    assert parents["encounter a"] == "Chapter 1"


def test_lineage_runs_from_the_node_up_to_the_arc():
    assert scope({}).lineage("Encounter A") == ["Encounter A", "Chapter 1", "Episode 3"]


def test_an_entity_pinned_here_is_in_scope():
    assert names(scope({"Rick": placed("Encounter A")}).members("Encounter A")) == ["Rick"]


def test_an_appearance_above_does_not_reach_down():
    # Being in the episode does not put you in every encounter of it.
    assert scope({"Rick": placed("Episode 3")}).members("Encounter A") == []


def test_a_fixture_above_does_reach_down():
    # The trader they see every day this chapter shows up in each scene.
    members = scope({"Rick": placed("Chapter 1", "fixture")}).members("Encounter A")
    assert names(members) == ["Rick"]
    assert members[0].via == "inherited"
    assert members[0].placed_at == "Chapter 1"


def test_a_fixture_of_the_whole_episode_reaches_every_encounter():
    s = scope({"Watcher": placed("Episode 3", "fixture")})
    assert names(s.members("Encounter A")) == ["Watcher"]
    assert names(s.members("Encounter B")) == ["Watcher"]


def test_a_fixture_does_not_leak_across_siblings():
    s = scope({"Rick": placed("Chapter 1", "fixture")})
    assert s.members("Chapter 2") == []


def test_pinned_entities_sort_above_inherited_ones():
    s = scope({
        "Zed": placed("Encounter A"),
        "Adam": placed("Chapter 1", "fixture"),
    })
    members = s.members("Encounter A")
    assert [m.via for m in members] == ["pinned", "inherited"]
    assert names(members) == ["Zed", "Adam"]


def test_a_fixture_pinned_at_the_focus_node_counts_as_pinned():
    members = scope({"Rick": placed("Encounter A", "fixture")}).members("Encounter A")
    assert members[0].via == "pinned"


def test_scope_matching_folds_case_and_underscores():
    assert names(scope({"Rick": placed("encounter_a")}).members("Encounter A")) == ["Rick"]


def test_unplaced_entities_are_in_nobodys_scope():
    assert scope({"Rick": placed("")}).members("Encounter A") == []


@pytest.mark.parametrize("node", ["", "TBD", "???"])
def test_focusing_a_placeholder_returns_nothing(node):
    assert scope({"Rick": placed("Encounter A")}).members(node) == []


def test_a_childlink_cycle_does_not_hang_the_walk():
    nodes = {"A": {"childLinks": ["B"]}, "B": {"childLinks": ["A"]}}
    assert StoryScope(nodes=nodes, entities={}).lineage("A") == ["A", "B"]


def test_a_child_claimed_twice_keeps_one_parent():
    nodes = {
        "Episode 3": {"childLinks": ["Chapter 1"]},
        "Episode 4": {"childLinks": ["Chapter 1"]},
    }
    parents = build_parents(nodes)
    assert parents["chapter 1"] in {"Episode 3", "Episode 4"}


PATHS = {
    "Test Episode": "Campaign/03_Story/Episode_Test/Episode_Overview.json",
    "The Lower Drains": "Campaign/03_Story/Episode_Test/Chapter_Lower_Drains/Chapter_Overview.json",
    "Flooded Passages": "Campaign/03_Story/Episode_Test/Chapter_Lower_Drains/Encounters/Flooded.json",
}
UNLINKED = {"Test Episode": {"childLinks": []}, "The Lower Drains": {"childLinks": ["Flooded Passages"]}, "Flooded Passages": {}}


def test_folder_nesting_supplies_edges_childlinks_left_out():
    # The real campaign has a chapter inside its episode's folder that the
    # episode never lists; without this the lineage stops one level short.
    parents = build_parents(UNLINKED, PATHS)
    assert parents["the lower drains"] == "Test Episode"


def test_childlinks_win_where_both_say_something():
    nodes = {"Stated Parent": {"childLinks": ["Child"]}, "Folder Parent": {}, "Child": {}}
    paths = {
        "Folder Parent": "Campaign/03_Story/Folder_Parent/Overview.json",
        "Child": "Campaign/03_Story/Folder_Parent/Child/Overview.json",
        "Stated Parent": "Campaign/03_Story/Stated_Parent/Overview.json",
    }
    assert build_parents(nodes, paths)["child"] == "Stated Parent"


def test_lineage_reaches_the_episode_through_mixed_edges():
    s = StoryScope(nodes=UNLINKED, entities={}, node_paths=PATHS)
    assert s.lineage("Flooded Passages") == ["Flooded Passages", "The Lower Drains", "Test Episode"]


def test_a_fixture_on_the_episode_reaches_a_folder_nested_encounter():
    s = StoryScope(
        nodes=UNLINKED,
        entities={"Watcher": {"storyPlacement": {"node": "Test Episode", "mode": "fixture"}}},
        node_paths=PATHS,
    )
    assert [m.name for m in s.members("Flooded Passages")] == ["Watcher"]


def test_the_campaign_overview_is_the_root_of_the_story_tree():
    # It carries no childLinks and sits beside the episodes rather than above
    # them, so only its type identifies it. Leaving it out put every
    # campaign-level fixture in nobody's scope.
    from gurpsai.app.services.story_scope import is_story_node
    assert is_story_node({"title": "Anomaly Hunters", "type": "Campaign"})
    assert is_story_node({"title": "Ep", "type": "Episode"})
    assert is_story_node({"title": "Anything", "childLinks": []})
    assert not is_story_node({"name": "Rick", "attributes": []})
    assert not is_story_node({"name": "HQ", "internalStructure": []})


def test_a_campaign_fixture_reaches_every_scene():
    nodes = {"My Campaign": {"type": "Campaign"}, "Ep 1": {"childLinks": ["Scene A"]}, "Scene A": {}}
    paths = {
        "My Campaign": "Campaign/03_Story/Campaign_Overview.json",
        "Ep 1": "Campaign/03_Story/Episode_01/Episode_Overview.json",
        "Scene A": "Campaign/03_Story/Episode_01/Encounters/A.json",
    }
    s = StoryScope(
        nodes=nodes,
        entities={"Rachel": {"storyPlacement": {"node": "My Campaign", "mode": "fixture"}}},
        node_paths=paths,
    )
    assert s.lineage("Scene A") == ["Scene A", "Ep 1", "My Campaign"]
    assert [m.name for m in s.members("Scene A")] == ["Rachel"]
