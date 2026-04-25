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

@router.get("/check", response_model=UpdateCheckResponse)
def check_update() -> UpdateCheckResponse:
    from gurpsai.__version__ import __version__
    url = "https://api.github.com/repos/VikA/AnomalyHunter_v2/releases/latest"
    
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
                    
            if latest_tag and latest_tag != __version__ and download_url:
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
        # CREATE_NEW_CONSOLE = 0x00000010
        # DETACHED_PROCESS = 0x00000008
        creationflags = 0x00000018
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
