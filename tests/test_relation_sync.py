import json

from gurpsai.app.services.relation_sync import RelationSyncService
from tests.conftest import read_json, write_json


def test_story_characters_sync_to_story_appearances(campaign_env):
    write_json(campaign_env / "02_Characters/Main_Cast/Ada.json",
               {"name": "Ada", "storyAppearances": []})
    story_path = campaign_env / "03_Story/Episode_Pilot/Episode_Overview.json"
    old = {"title": "Pilot", "type": "Episode", "characters": []}
    new = {"title": "Pilot", "type": "Episode", "characters": ["Ada"]}
    write_json(story_path, new)

    service = RelationSyncService()
    service.sync_file("Campaign/03_Story/Episode_Pilot/Episode_Overview.json",
                      json.dumps(old), json.dumps(new))

    ada = read_json(campaign_env / "02_Characters/Main_Cast/Ada.json")
    assert "Pilot" in ada["storyAppearances"]

    # Removing the character removes the reciprocal appearance
    service2 = RelationSyncService()
    service2.sync_file("Campaign/03_Story/Episode_Pilot/Episode_Overview.json",
                       json.dumps(new), json.dumps(old))
    ada = read_json(campaign_env / "02_Characters/Main_Cast/Ada.json")
    assert "Pilot" not in ada["storyAppearances"]


def test_sync_matches_names_case_insensitively(campaign_env):
    # File stores "The_Watch"; story references "the watch" — index is normalized.
    write_json(campaign_env / "01_World_Bible/Factions/The_Watch.json",
               {"name": "The_Watch", "storyAppearances": []})
    old = {"title": "Pilot", "type": "Episode", "factions": []}
    new = {"title": "Pilot", "type": "Episode", "factions": ["the watch"]}
    write_json(campaign_env / "03_Story/Episode_Pilot/Episode_Overview.json", new)

    service = RelationSyncService()
    service.sync_file("Campaign/03_Story/Episode_Pilot/Episode_Overview.json",
                      json.dumps(old), json.dumps(new))

    watch = read_json(campaign_env / "01_World_Bible/Factions/The_Watch.json")
    assert "Pilot" in watch["storyAppearances"]


def test_character_relation_sync_is_reciprocal(campaign_env):
    write_json(campaign_env / "02_Characters/Main_Cast/Abe.json",
               {"name": "Abe", "characterRelations": []})
    write_json(campaign_env / "02_Characters/Main_Cast/Bea.json",
               {"name": "Bea", "characterRelations": []})

    old = {"name": "Abe", "characterRelations": []}
    new = {"name": "Abe", "characterRelations": [{"name": "Bea", "relation": "Rival"}]}
    write_json(campaign_env / "02_Characters/Main_Cast/Abe.json", new)

    service = RelationSyncService()
    service.sync_file("Campaign/02_Characters/Main_Cast/Abe.json",
                      json.dumps(old), json.dumps(new))

    bea = read_json(campaign_env / "02_Characters/Main_Cast/Bea.json")
    assert {"name": "Abe", "relation": "Rival"} in bea["characterRelations"]
