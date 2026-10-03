"""A session must be reachable by the id the list reported.

Two of the real campaign's session files had leading digits stripped from
their names -- id "4cd5e235-…" living in "cd5e235-….json". list_sessions reads
ids from file contents, so those listed fine and then 404'd the moment the GM
switched to one.
"""
import json

import pytest

from gurpsai.app.services.sessions import SessionService


@pytest.fixture
def service(campaign_env):
    (campaign_env / ".planning" / "sessions").mkdir(parents=True, exist_ok=True)
    return SessionService()


def write_raw(campaign_env, filename: str, payload: dict) -> None:
    path = campaign_env / ".planning" / "sessions" / filename
    path.write_text(json.dumps(payload), encoding="utf-8")


def test_a_session_is_found_by_its_filename(service):
    created = service.create_session("Normal")
    assert service.get_session(created.id).title == "Normal"


def test_a_session_whose_filename_was_mangled_is_still_reachable(service, campaign_env):
    write_raw(campaign_env, "cd5e235-short.json",
              {"id": "4cd5e235-full", "title": "Mangled", "updated_at": 1.0, "messages": []})
    assert service.get_session("4cd5e235-full").title == "Mangled"


def test_listing_and_fetching_agree_on_every_session(service, campaign_env):
    write_raw(campaign_env, "truncated.json",
              {"id": "39-full-id", "title": "Listed", "updated_at": 1.0, "messages": []})
    service.create_session("Normal")
    for listed in service.list_sessions():
        assert service.get_session(listed.id).id == listed.id


def test_saving_heals_the_mismatched_filename(service, campaign_env):
    write_raw(campaign_env, "cd5e235-short.json",
              {"id": "4cd5e235-full", "title": "Mangled", "updated_at": 1.0, "messages": []})
    session = service.get_session("4cd5e235-full")
    session.title = "Renamed"
    service.save_session(session)

    sessions_dir = campaign_env / ".planning" / "sessions"
    assert (sessions_dir / "4cd5e235-full.json").is_file()
    assert not (sessions_dir / "cd5e235-short.json").exists()
    assert service.get_session("4cd5e235-full").title == "Renamed"


def test_deleting_removes_a_mismatched_file_too(service, campaign_env):
    write_raw(campaign_env, "odd-name.json",
              {"id": "real-id", "title": "Doomed", "updated_at": 1.0, "messages": []})
    service.delete_session("real-id")
    with pytest.raises(FileNotFoundError):
        service.get_session("real-id")


def test_a_genuinely_absent_session_still_raises(service):
    with pytest.raises(FileNotFoundError):
        service.get_session("no-such-session")
