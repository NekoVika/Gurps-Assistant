from gurpsai.app.services.link_resolver import LinkResolver, is_placeholder, is_reference, normalize


REGISTRY = [
    {"id": "The_Watch", "title": "The Watch", "path": "Campaign/01_World_Bible/Factions/The_Watch.json", "type": "Faction"},
    {"id": "Grim_Bartender", "title": "Grim Bartender", "path": "Campaign/02_Characters/Main_Cast/Grim_Bartender.json", "type": "Unknown"},
    {"id": "Chapter_Overview", "title": "The Lower Drains", "path": "Campaign/03_Story/Episode_S/Chapter_The_Lower_Drains/Chapter_Overview.json", "type": "Chapter"},
    {"id": "Ambush", "title": "2. Ambush", "path": "Campaign/03_Story/Episode_S/Chapter_X/Encounters/Ambush.json", "type": "Encounter"},
]


def make_resolver():
    return LinkResolver(REGISTRY)


def test_normalize_strips_case_underscores_extensions_and_ordinals():
    assert normalize("The_Watch") == "the watch"
    assert normalize("The Watch.json") == "the watch"
    assert normalize("2. Ambush") == "ambush"
    assert normalize("03_Ambush") == "ambush"
    assert normalize("  Spaced   Name ") == "spaced name"


def test_placeholders_are_never_references():
    for value in ("", "  ", "TBD", "tbd", "None", "N/A", "?"):
        assert is_placeholder(value)
    assert is_placeholder(None)
    assert is_placeholder(42)
    assert not is_placeholder("The Watch")


def test_prose_is_not_a_reference():
    # Legacy markdown-migrated arrays hold prose, not entity names.
    assert not is_reference("**Dominant Faction:** None (Natural Predators).")
    assert not is_reference("**Law & Order:** (Lawless Frontier - CR 0)")
    assert not is_reference("x" * 120)
    assert not is_reference("TBD")
    assert not is_reference(None)
    assert is_reference("The Watch")
    assert is_reference("Chapter 01: Descent into Filth")


def test_exact_match():
    r = make_resolver()
    assert r.resolve("The Watch")["path"].endswith("The_Watch.json")
    assert r.resolve("The_Watch")["path"].endswith("The_Watch.json")


def test_normalized_match_is_case_insensitive():
    r = make_resolver()
    assert r.exists("the watch")
    assert r.exists("THE_WATCH")
    assert r.exists("grim bartender")


def test_ordinal_prefix_resolves_to_sanitized_stub():
    # Stub file "Ambush.json" keeps raw title "2. Ambush"; both spellings resolve.
    r = make_resolver()
    assert r.exists("2. Ambush")
    assert r.exists("Ambush")


def test_placeholder_does_not_resolve():
    r = make_resolver()
    assert not r.exists("TBD")
    assert not r.exists("")
    assert not r.exists(None)


def test_missing_name_does_not_resolve():
    r = make_resolver()
    assert not r.exists("Ghost Chapter")


def test_directory_name_alias_for_story_nodes():
    # childLinks often hold the directory name ("Chapter 01"), not the title.
    registry = REGISTRY + [
        {"id": "Chapter_Overview", "title": "The Drainage Awakening",
         "path": "Campaign/03_Story/Episode_03/Chapter_01/Chapter_Overview.json", "type": "Chapter"},
        {"id": "Episode_Overview", "title": "Watcher of the Rain",
         "path": "Campaign/03_Story/Episode_03/Episode_Overview.json", "type": "Episode"},
    ]
    r = LinkResolver(registry)
    assert r.exists("Chapter 01")
    assert r.exists("Chapter_01")
    assert r.exists("Episode 03")
    # Non-story parent dirs are NOT aliased
    assert not r.exists("Main Cast")


def test_tail_match_only_when_unique():
    registry = REGISTRY + [
        {"id": "Iron_Watch", "title": "Iron Watch", "path": "Campaign/01_World_Bible/Factions/Iron_Watch.json", "type": "Faction"},
        {"id": "Night_Watch", "title": "Night Watch", "path": "Campaign/01_World_Bible/Factions/Night_Watch.json", "type": "Faction"},
    ]
    r = LinkResolver(registry)
    # "Watch" tail-matches three different factions -> ambiguous, unresolved
    assert not r.exists("Watch")
    # unique tail still resolves
    assert r.exists("Bartender")
