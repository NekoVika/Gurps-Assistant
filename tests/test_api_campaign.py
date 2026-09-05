import json

from fastapi.testclient import TestClient

from gurpsai.api.main import app
from tests.conftest import read_json, write_json

client = TestClient(app)

EXPECTED_DIRS = [
    "01_World_Bible/Locations",
    "01_World_Bible/Factions",
    "01_World_Bible/World_Maps_and_Art",
    "02_Characters/PCs",
    "02_Characters/Main_Cast",
    "02_Characters/Bestiary",
    "03_Story",
    "_reports/sessions",
]

EXPECTED_SEEDS = [
    "state.json",
    "00_System_Rules.json",
    "01_World_Bible/World_Dossier.json",
    "03_Story/Campaign_Overview.json",
]


def test_init_creates_full_skeleton(campaign_env):
    res = client.post("/campaign/init")
    assert res.status_code == 200
    body = res.json()
    assert body["success"] is True

    for rel_dir in EXPECTED_DIRS:
        assert (campaign_env / rel_dir).is_dir(), f"missing dir {rel_dir}"
    for rel_file in EXPECTED_SEEDS:
        target = campaign_env / rel_file
        assert target.is_file(), f"missing seed {rel_file}"
        data = read_json(target)
        assert isinstance(data, dict)

    overview = read_json(campaign_env / "03_Story/Campaign_Overview.json")
    assert overview["childLinks"] == []


def test_init_is_idempotent(campaign_env):
    client.post("/campaign/init")
    state_path = campaign_env / "state.json"
    write_json(state_path, {"campaignName": "Keep Me"})

    res = client.post("/campaign/init")
    assert res.status_code == 200
    assert res.json()["created"] == []
    assert read_json(state_path)["campaignName"] == "Keep Me"


def test_registry_lists_entities(campaign_env):
    client.post("/campaign/init")
    write_json(campaign_env / "02_Characters/Main_Cast/Grim_Bartender.json", {"name": "Grim Bartender"})
    write_json(campaign_env / "01_World_Bible/Locations/Old_Docks.json", {"name": "Old Docks"})
    write_json(campaign_env / "01_World_Bible/Factions/Iron_Ring.json", {"name": "Iron Ring"})
    write_json(campaign_env / "03_Story/Episode_Pilot/Episode_Overview.json", {"title": "Pilot", "type": "Episode"})

    res = client.get("/campaign/registry")
    assert res.status_code == 200
    items = res.json()["items"]
    by_title = {item["title"]: item for item in items}
    for title in ("Grim Bartender", "Old Docks", "Iron Ring", "Pilot"):
        assert title in by_title, f"{title} missing from registry"
        assert by_title[title]["path"].startswith("Campaign/")
    assert by_title["Pilot"]["type"] == "Episode"


def test_stubs_batch_lands_in_registry_visible_paths(campaign_env):
    client.post("/campaign/init")
    res = client.post("/campaign/stubs/batch", json={"stubs": [
        {"name": "Grim Bartender", "type": "Character"},
        {"name": "Old Docks", "type": "Location"},
        {"name": "Iron Ring", "type": "Faction"},
        {"name": "Sewer Descent", "type": "Episode"},
        {"name": "The Lower Drains", "type": "Chapter",
         "parent_path": "Campaign/03_Story/Episode_Sewer_Descent/Episode_Overview.json"},
        {"name": "2. Drone Defense", "type": "Encounter",
         "parent_path": "Campaign/03_Story/Episode_Sewer_Descent/Chapter_The_Lower_Drains/Chapter_Overview.json"},
    ]})
    assert res.status_code == 200
    body = res.json()
    assert body["created"] == 6
    assert set(body["paths"]) == {
        "Campaign/02_Characters/Main_Cast/Grim_Bartender.json",
        "Campaign/01_World_Bible/Locations/Old_Docks.json",
        "Campaign/01_World_Bible/Factions/Iron_Ring.json",
        "Campaign/03_Story/Episode_Sewer_Descent/Episode_Overview.json",
        "Campaign/03_Story/Episode_Sewer_Descent/Chapter_The_Lower_Drains/Chapter_Overview.json",
        "Campaign/03_Story/Episode_Sewer_Descent/Chapter_The_Lower_Drains/Encounters/Drone_Defense.json",
    }

    # Stub keeps the raw name so the original reference still resolves
    stub = read_json(campaign_env / "03_Story/Episode_Sewer_Descent/Chapter_The_Lower_Drains/Encounters/Drone_Defense.json")
    assert stub["title"] == "2. Drone Defense"

    # Second identical request creates nothing (case/underscore variants skip too)
    res2 = client.post("/campaign/stubs/batch", json={"stubs": [
        {"name": "grim_bartender", "type": "Character"},
        {"name": "Old Docks", "type": "Location"},
    ]})
    assert res2.status_code == 200
    assert res2.json()["created"] == 0
    assert set(res2.json()["skipped"]) == {"grim_bartender", "Old Docks"}


def test_file_write_syncs_relations(campaign_env):
    client.post("/campaign/init")
    write_json(campaign_env / "02_Characters/Main_Cast/Bea.json",
               {"name": "Bea", "characterRelations": []})
    write_json(campaign_env / "02_Characters/Main_Cast/Abe.json",
               {"name": "Abe", "characterRelations": []})

    updated = {"name": "Abe", "characterRelations": [{"name": "Bea", "relation": "Old friend"}]}
    res = client.post("/files/write", json={
        "path": "Campaign/02_Characters/Main_Cast/Abe.json",
        "content": json.dumps(updated),
    })
    assert res.status_code == 200

    bea = read_json(campaign_env / "02_Characters/Main_Cast/Bea.json")
    assert {"name": "Abe", "relation": "Old friend"} in bea["characterRelations"]


def test_rename_entity_refactors_references(campaign_env):
    client.post("/campaign/init")
    write_json(campaign_env / "02_Characters/Main_Cast/Old_Name.json", {"name": "Old Name"})
    write_json(campaign_env / "03_Story/Episode_Pilot/Episode_Overview.json", {
        "title": "Pilot", "type": "Episode",
        "characters": ["Old Name"],
        "characterRelations": [{"name": "Old Name", "relation": "Antagonist"}],
    })

    res = client.post("/campaign/rename-entity", json={
        "old_path": "Campaign/02_Characters/Main_Cast/Old_Name.json",
        "old_title": "Old Name",
        "new_name": "New Name",
        "updated_content": {"name": "New Name"},
    })
    assert res.status_code == 200
    body = res.json()
    assert body["success"] is True
    assert body["new_path"] == "Campaign/02_Characters/Main_Cast/New Name.json"
    assert body["refactored_files"] >= 1
    assert not (campaign_env / "02_Characters/Main_Cast/Old_Name.json").exists()

    episode = read_json(campaign_env / "03_Story/Episode_Pilot/Episode_Overview.json")
    assert episode["characters"] == ["New Name"]
    assert episode["characterRelations"][0]["name"] == "New Name"


def test_trash_lifecycle(campaign_env):
    client.post("/campaign/init")
    target = campaign_env / "02_Characters/Main_Cast/Doomed.json"
    write_json(target, {"name": "Doomed"})

    res = client.request("DELETE", "/campaign/file", json={"path": "Campaign/02_Characters/Main_Cast/Doomed.json"})
    assert res.status_code == 200
    assert not target.exists()

    items = client.get("/campaign/trash").json()
    assert len(items) == 1
    trash_id = items[0]["trash_id"]

    res = client.post("/campaign/trash/restore", json={"trash_id": trash_id})
    assert res.status_code == 200
    assert target.exists()

    client.request("DELETE", "/campaign/file", json={"path": "Campaign/02_Characters/Main_Cast/Doomed.json"})
    items = client.get("/campaign/trash").json()
    trash_id = items[0]["trash_id"]
    res = client.delete(f"/campaign/trash/{trash_id}")
    assert res.status_code == 200
    assert client.get("/campaign/trash").json() == []


def test_validate_flags_dangling_links(campaign_env):
    client.post("/campaign/init")
    write_json(campaign_env / "01_World_Bible/Factions/The_Watch.json", {"name": "The_Watch"})
    write_json(campaign_env / "03_Story/Episode_Pilot/Episode_Overview.json", {
        "title": "Pilot", "type": "Episode",
        "childLinks": ["Ghost Chapter"],
        "factions": ["the watch"],          # case variant of existing file: NOT dangling
        "characters": ["Unknown Stranger", "TBD"],  # placeholder excluded
    })

    res = client.get("/campaign/validate")
    assert res.status_code == 200
    body = res.json()
    dangling = {(d["name"], d["field"], d["suggested_type"]) for d in body["dangling"]}
    assert ("Ghost Chapter", "childLinks", "Chapter") in dangling
    assert ("Unknown Stranger", "characters", "Character") in dangling
    assert all(name not in ("the watch", "TBD") for name, _, _ in dangling)


def test_validate_clean_campaign_has_no_findings(campaign_env):
    client.post("/campaign/init")
    res = client.get("/campaign/validate")
    assert res.status_code == 200
    body = res.json()
    assert body["errors"] == []
    assert body["dangling"] == []


def test_file_write_rejects_escape(campaign_env):
    client.post("/campaign/init")
    res = client.post("/files/write", json={
        "path": "Campaign/../outside.json",
        "content": "{}",
    })
    assert res.status_code >= 400
