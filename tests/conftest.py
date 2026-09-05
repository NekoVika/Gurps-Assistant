import json
from pathlib import Path

import pytest


@pytest.fixture
def campaign_env(tmp_path, monkeypatch):
    """Point the app at a temporary campaign directory.

    Services resolve the campaign root through load_app_config() ->
    _load_app_state() at request time, so patching _load_app_state is enough.
    Returns the campaign root path (not yet created).
    """
    camp = tmp_path / "Camp"
    import gurpsai.app.config as cfg

    monkeypatch.setattr(cfg, "_load_app_state", lambda: {"active_campaign_path": str(camp)})
    monkeypatch.delenv("ACTIVE_CAMPAIGN_PATH", raising=False)
    return camp


def write_json(path: Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2), encoding="utf-8")


def read_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))
