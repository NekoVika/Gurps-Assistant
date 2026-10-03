"""Markdown links left by the MD2JSON migration are references, not names.

Fields the UI renders as entity links still hold
"[The Shoals](../../01_World_Bible/Locations/The_Shoals.md)". Whole, that
resolves to nothing: the passport shows it as proposed with the path visible
and offers to create a file named after the punctuation. One such file was
created during testing before this was caught.
"""
import pytest

from gurpsai.app.services.link_resolver import LinkResolver, link_text, normalize


@pytest.mark.parametrize("raw,expected", [
    ("[The Shoals](../../01_World_Bible/Locations/The_Shoals.md)", "The Shoals"),
    ("[Briefing Room](../../Locations/HQ.md#briefing-room)", "Briefing Room"),
    ("  [Rachel](x.json)  ", "Rachel"),
])
def test_the_readable_half_is_the_name(raw, expected):
    assert link_text(raw) == expected


def test_an_empty_label_falls_back_to_the_file_it_points_at():
    assert link_text("[](../../Locations/Broken_Bridge.md)") == "Broken_Bridge"
    assert link_text("[](../../Locations/HQ.md#briefing-room)") == "HQ"


@pytest.mark.parametrize("raw", [
    "Rachel",
    "Rain World (Decaying Megastructures)",   # parentheses, but not a link
    "Hinamizawa, Japan (1983)",
    "",
])
def test_ordinary_names_pass_through_untouched(raw):
    assert link_text(raw) == raw.strip()


def test_a_wrapped_reference_resolves_to_the_entity_it_names():
    registry = [{"title": "The Shoals", "path": "Campaign/01_World_Bible/Locations/The_Shoals.json"}]
    resolver = LinkResolver(registry)
    assert resolver.exists("[The Shoals](../../01_World_Bible/Locations/The_Shoals.md)")
    assert resolver.resolve("[The_Shoals](../../x.md)")["title"] == "The Shoals"


def test_normalize_folds_a_link_onto_the_plain_name():
    assert normalize("[The Shoals](../x.md)") == normalize("the_shoals")


@pytest.mark.parametrize("prose", [
    "None currently present.",
    "The party has not met anyone here yet.",
    "Who is in charge?",
    "Nobody!",
])
def test_a_sentence_is_not_an_entity_name(prose):
    # Migrated prose sits in the same arrays as names and was being offered as
    # something to create.
    from gurpsai.app.services.link_resolver import is_reference
    assert not is_reference(prose)


@pytest.mark.parametrize("name", [
    "Chapter 01: Descent into Filth",
    "Rain World (Decaying Megastructures)",
    "Looks-to-the-Moon",
    "Pump Tower - The Heart of Rot",
    "Five Pebbles...",
])
def test_real_names_are_still_references(name):
    from gurpsai.app.services.link_resolver import is_reference
    assert is_reference(name)


def test_a_pc_referenced_without_its_point_total_still_resolves():
    # Story files say "Jamie_Hass"; the file is "Jamie Hass (225 pts)". Without
    # the alias the PC reads as proposed and accepting creates a duplicate.
    registry = [{"title": "Jamie Hass (225 pts)", "path": "Campaign/02_Characters/PCs/Jamie.json"}]
    resolver = LinkResolver(registry)
    assert resolver.exists("Jamie_Hass")
    assert resolver.exists("Jamie Hass")
    assert resolver.resolve("Jamie_Hass")["title"] == "Jamie Hass (225 pts)"


def test_the_full_name_still_resolves_too():
    registry = [{"title": "Jamie Hass (225 pts)", "path": "Campaign/02_Characters/PCs/Jamie.json"}]
    assert LinkResolver(registry).exists("Jamie Hass (225 pts)")


def test_a_parenthetical_that_distinguishes_two_entities_is_not_collapsed():
    # Both alias to "the watcher"; first wins for the alias, but each still
    # resolves exactly. Nothing is silently merged.
    registry = [
        {"title": "The Watcher (Rain World)", "path": "a.json"},
        {"title": "The Watcher (Hinamizawa)", "path": "b.json"},
    ]
    r = LinkResolver(registry)
    assert r.resolve("The Watcher (Hinamizawa)")["path"] == "b.json"
    assert r.resolve("The Watcher (Rain World)")["path"] == "a.json"
