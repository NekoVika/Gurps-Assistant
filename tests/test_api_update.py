import json
import urllib.request
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from gurpsai.api.main import app

client = TestClient(app)

@patch("urllib.request.urlopen")
def test_update_check_available(mock_urlopen):
    # Mock GitHub API response for a newer version
    mock_response = MagicMock()
    mock_response.read.return_value = json.dumps({
        "tag_name": "v99.99.99",
        "assets": [
            {
                "name": "GURPS_Assistant_Setup_v99.99.99.exe",
                "browser_download_url": "https://example.com/download.exe"
            }
        ]
    }).encode("utf-8")
    
    # Enter context manager for urlopen
    mock_response.__enter__.return_value = mock_response
    mock_urlopen.return_value = mock_response

    response = client.get("/update/check")
    assert response.status_code == 200
    data = response.json()
    
    assert data["update_available"] is True
    assert data["latest_version"] == "99.99.99"
    assert data["download_url"] == "https://example.com/download.exe"

@patch("urllib.request.urlopen")
def test_update_check_not_available(mock_urlopen):
    from gurpsai.__version__ import __version__
    
    # Mock GitHub API response for the SAME version
    mock_response = MagicMock()
    mock_response.read.return_value = json.dumps({
        "tag_name": f"v{__version__}",
        "assets": [
            {
                "name": f"GURPS_Assistant_Setup_v{__version__}.exe",
                "browser_download_url": "https://example.com/download.exe"
            }
        ]
    }).encode("utf-8")
    
    mock_response.__enter__.return_value = mock_response
    mock_urlopen.return_value = mock_response

    response = client.get("/update/check")
    assert response.status_code == 200
    data = response.json()
    
    assert data["update_available"] is False
    assert data["latest_version"] == __version__
    assert data["download_url"] is None
