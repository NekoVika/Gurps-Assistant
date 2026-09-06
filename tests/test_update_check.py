"""The updater must never offer a release older than what is installed.

/update/apply downloads and reinstalls silently, so a wrong answer here
downgrades the user's app without asking.
"""
import pytest

from gurpsai.api.routers.update import _is_newer, _parse_version


@pytest.mark.parametrize("latest,current", [
    ("0.3.1", "0.3.0"),
    ("0.4.0", "0.3.9"),
    ("1.0.0", "0.9.9"),
    ("0.3.0", "0.2.11"),   # 11 > 3 only if compared as text
    ("v0.3.1", "0.3.0"),   # tag_name may keep its v
])
def test_offers_newer_releases(latest, current):
    assert _is_newer(latest, current) is True


@pytest.mark.parametrize("latest,current", [
    ("0.2.10", "0.3.0"),   # the downgrade seen during v0.3.0 QA
    ("0.2.11", "0.3.0"),
    ("0.3.0", "0.3.0"),    # same version is not an update
    ("0.3", "0.3.0"),      # short form pads with zeros
])
def test_refuses_same_or_older(latest, current):
    assert _is_newer(latest, current) is False


@pytest.mark.parametrize("latest,current", [
    ("0.3.0-beta", "0.3.0"),
    ("", "0.3.0"),
    ("nightly", "0.3.0"),
])
def test_unparseable_tags_never_offer_an_update(latest, current):
    assert _is_newer(latest, current) is False


def test_parse_version_pads_nothing_and_rejects_junk():
    assert _parse_version("1.2.3") == (1, 2, 3)
    assert _parse_version("v0.3") == (0, 3)
    assert _parse_version("0.3.0rc1") is None
