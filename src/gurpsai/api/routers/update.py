import os
import tempfile
import subprocess
import urllib.request
import urllib.error
import json
from pathlib import Path
from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel

router = APIRouter(prefix="/update", tags=["update"])

class UpdateCheckResponse(BaseModel):
    update_available: bool
    latest_version: str
    download_url: str | None = None

def _parse_version(value: str) -> tuple[int, ...] | None:
    """Parse a dotted numeric version into a comparable tuple, else None."""
    try:
        return tuple(int(part) for part in value.strip().lstrip("v").split("."))
    except (ValueError, AttributeError):
        return None


def _is_newer(latest: str, current: str) -> bool:
    """True only when `latest` is strictly ahead of `current`.

    A plain inequality check would offer whatever GitHub calls "latest" even
    when it is behind the installed build, and /update/apply reinstalls
    silently -- so an unparseable tag on either side means no update.
    """
    latest_parts = _parse_version(latest)
    current_parts = _parse_version(current)
    if latest_parts is None or current_parts is None:
        return False
    width = max(len(latest_parts), len(current_parts))
    latest_parts += (0,) * (width - len(latest_parts))
    current_parts += (0,) * (width - len(current_parts))
    return latest_parts > current_parts


@router.get("/check", response_model=UpdateCheckResponse)
def check_update() -> UpdateCheckResponse:
    from gurpsai.__version__ import __version__
    url = "https://api.github.com/repos/NekoVika/Gurps-Assistant/releases/latest"
    
    req = urllib.request.Request(url, headers={"User-Agent": "GURPS-Assistant"})
    try:
        with urllib.request.urlopen(req, timeout=5) as response:
            data = json.loads(response.read().decode())
            
            latest_tag = data.get("tag_name", "").lstrip("v")
            assets = data.get("assets", [])
            download_url = None
            for asset in assets:
                if asset["name"].endswith(".exe"):
                    download_url = asset["browser_download_url"]
                    break
                    
            if latest_tag and download_url and _is_newer(latest_tag, __version__):
                return UpdateCheckResponse(
                    update_available=True, 
                    latest_version=latest_tag, 
                    download_url=download_url
                )
    except Exception as e:
        print(f"Failed to check for updates: {e}")
        pass
        
    return UpdateCheckResponse(
        update_available=False, 
        latest_version=__version__, 
        download_url=None
    )

class ApplyUpdateRequest(BaseModel):
    download_url: str

def perform_update(download_url: str):
    try:
        temp_dir = Path(tempfile.gettempdir())
        installer_path = temp_dir / "GURPS_Assistant_Update.exe"
        
        req = urllib.request.Request(download_url, headers={"User-Agent": "GURPS-Assistant"})
        with urllib.request.urlopen(req) as response, open(installer_path, "wb") as out_file:
            out_file.write(response.read())
            
        # Spawn the installer detached and silent. 
        creationflags = subprocess.DETACHED_PROCESS | subprocess.CREATE_NEW_PROCESS_GROUP
        subprocess.Popen(
            [str(installer_path), "/VERYSILENT", "/SUPPRESSMSGBOXES", "/FORCECLOSEAPPLICATIONS"],
            creationflags=creationflags
        )
        
        # Kill the FastAPI process so the installer can replace files without locking issues
        os._exit(0)
    except Exception as e:
        print(f"Update failed to apply: {e}")

@router.post("/apply")
def apply_update(req: ApplyUpdateRequest, background_tasks: BackgroundTasks):
    background_tasks.add_task(perform_update, req.download_url)
    return {"status": "updating"}
