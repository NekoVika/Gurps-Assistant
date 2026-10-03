"""Generic names are refused at creation, not discovered as collisions later.

"Chapter 01" was listed by two episodes in the real campaign, so one chapter
was parented to the wrong episode and inherited none of its fixtures. The name
was the whole problem.
"""
import pytest

from gurpsai.app.services.naming import generic_name_problem, is_generic_name


@pytest.mark.parametrize("name", [
    "Chapter 01", "chapter 1", "Chapter_04", "Episode 3", "Encounter", "Scene 2",
    "NPC", "NPC 2", "Character 7", "Location 1", "Faction",
    "New", "Untitled", "Test", "Draft 3", "Stub",
    "Chapter Episode 2",   # stacking categories does not make a name
])
def test_a_category_word_is_not_a_name(name):
    assert is_generic_name(name)


@pytest.mark.parametrize("name", ["01", "3", "1.2", "  7  "])
def test_a_bare_number_is_not_a_name(name):
    assert "number" in generic_name_problem(name)


@pytest.mark.parametrize("name", ["", "   ", None, 42])
def test_nothing_is_not_a_name(name):
    assert generic_name_problem(name) == "Give it a name."


@pytest.mark.parametrize("name", [
    "Chapter 01: Descent into Filth",   # the campaign's own good example
    "Test Episode Sewers",              # a real episode that happens to start with a category word
    "The Drainage Awakening",
    "Rick",
    "Encounter at the Broken Bridge",
    "New Hinamizawa",
    "Chapter of the Rat King",
    "Locationless Wanderer",
])
def test_anything_carrying_a_real_word_passes(name):
    assert generic_name_problem(name) is None


def test_the_message_shows_what_a_good_name_looks_like():
    problem = generic_name_problem("Chapter 04")
    assert "Chapter 04" in problem
    assert "category" in problem
    # No invented title: the message explains the collision instead.
    assert "Rat King" not in problem
