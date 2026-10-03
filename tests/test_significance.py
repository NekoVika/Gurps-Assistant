"""One vocabulary for narrative weight.

Four sites disagreed about this field -- editor dropdown, NPC template, wizard
prompt, and the files themselves -- so the campaign grew seven spellings of
four ideas. The enum stops that recurring; these cases pin the collapse.
"""
import importlib.util
from pathlib import Path

import pytest
from pydantic import ValidationError

from gurpsai.domain.campaign import CharacterData

ROOT = Path(__file__).resolve().parents[1]


def _norm():
    spec = importlib.util.spec_from_file_location(
        "migrate_significance", ROOT / "scripts" / "migrate_significance.py"
    )
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.normalize_significance


@pytest.mark.parametrize("raw,expected", [
    # every value that was actually on disk
    ("1 Core", "core"),
    ("2 Supporting", "supporting"),
    ("2 (Supporting)", "supporting"),
    ("Major", "core"),
    ("Supporting", "supporting"),
    ("Keystone", "core"),
    ("0 (Common Variant)", "background"),
    # already canonical
    ("core", "core"),
    ("background", "background"),
    # unset stays unset
    ("", ""),
    ("   ", ""),
])
def test_legacy_values_collapse_onto_the_enum(raw, expected):
    assert _norm()(raw) == expected


@pytest.mark.parametrize("raw", ["3 Featured", "4. Background", "1: Core"])
def test_rank_prefixes_are_stripped_however_punctuated(raw):
    assert _norm()(raw) in {"featured", "background", "core"}


def test_matching_ignores_case():
    assert _norm()("CORE") == "core"
    assert _norm()("  Featured  ") == "featured"


@pytest.mark.parametrize("raw", ["protagonist", "tier 7", "???"])
def test_unrecognised_values_report_rather_than_guess(raw):
    # None makes the migration leave the file alone and print it, instead of
    # quietly picking a bucket.
    assert _norm()(raw) is None


@pytest.mark.parametrize("value", ["core", "supporting", "featured", "background", ""])
def test_the_enum_accepts_exactly_the_five_states(value):
    assert CharacterData(name="Rick", significance=value).significance == value


@pytest.mark.parametrize("stale", ["1 Core", "Keystone", "Major", "0 (Common Variant)"])
def test_the_old_spellings_can_no_longer_be_written(stale):
    with pytest.raises(ValidationError):
        CharacterData(name="Rick", significance=stale)


def test_a_type_may_carry_no_significance():
    # A template has no narrative weight of its own; its instances do.
    assert CharacterData(name="Green Lizard", kind="type").significance == ""
