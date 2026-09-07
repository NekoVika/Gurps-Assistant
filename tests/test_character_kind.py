"""`kind` separates individuals from templates, and is authoritative.

The distinction earns its keep in the loose-ends report: an individual with no
placement is unfinished work, but a bestiary template is not anywhere at all --
its instances are -- so it must never be nagged about.
"""
import importlib.util
from pathlib import Path

import pytest
from pydantic import ValidationError

from gurpsai.domain.campaign import CharacterData

ROOT = Path(__file__).resolve().parents[1]


def _load_script():
    spec = importlib.util.spec_from_file_location(
        "migrate_character_kind", ROOT / "scripts" / "migrate_character_kind.py"
    )
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_characters_are_individuals_unless_stated():
    assert CharacterData(name="Rick").kind == "individual"


@pytest.mark.parametrize("kind", ["individual", "type", "pc"])
def test_the_three_kinds_are_accepted(kind):
    assert CharacterData(name="Rick", kind=kind).kind == kind


@pytest.mark.parametrize("bad", ["npc", "Type", "creature", "monster"])
def test_invented_kinds_are_rejected(bad):
    with pytest.raises(ValidationError):
        CharacterData(name="Rick", kind=bad)


@pytest.mark.parametrize("path,expected", [
    ("02_Characters/Bestiary/Green_Lizard.json", "type"),
    ("02_Characters/PCs/Jamie_Hass.json", "pc"),
    ("02_Characters/Main_Cast/The_Watcher.json", "individual"),
    ("02_Characters/Cast/Someone.json", "individual"),
    ("somewhere/odd/Stray.json", "individual"),
])
def test_kind_is_derived_from_the_existing_folder(path, expected):
    assert _load_script().derive_kind(Path(path)) == expected


def test_folder_matching_ignores_case():
    assert _load_script().derive_kind(Path("02_Characters/bestiary/Rat.json")) == "type"
