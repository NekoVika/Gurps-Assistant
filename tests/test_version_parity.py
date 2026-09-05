"""Every place that declares a version must agree with __version__.py.

The updater compares the GitHub tag against `__version__` by string
inequality, and the UI header shows whatever `/health` reports. When those
two disagree a fresh install reports the previous version and offers itself
a downgrade, so parity is a release gate rather than cosmetics.
"""
import json
import re
from pathlib import Path

import gurpsai
from gurpsai.__version__ import __version__
from gurpsai.api.main import create_app
from gurpsai.app.services.health import HealthService

ROOT = Path(__file__).resolve().parents[1]


def test_package_attr_matches_version_module():
    assert gurpsai.__version__ == __version__


def test_setup_py_matches():
    text = (ROOT / "setup.py").read_text(encoding="utf-8")
    match = re.search(r'version\s*=\s*["\']([^"\']+)["\']', text)
    assert match, "no version= found in setup.py"
    assert match.group(1) == __version__


def test_web_package_json_matches():
    data = json.loads((ROOT / "web" / "package.json").read_text(encoding="utf-8"))
    assert data["version"] == __version__


def test_openapi_app_version_matches():
    assert create_app().version == __version__


def test_health_service_reports_current_version():
    assert HealthService().get_status().version == __version__
