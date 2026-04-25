import json
from pathlib import Path
from src.gurpsai.api.schemas.files import DeleteFileRequest, RestoreTrashItemRequest, TrashItem

with open('src/gurpsai/api/routers/campaign.py', 'a') as f:
    f.write('''
from src.gurpsai.api.schemas.files import DeleteFileRequest, RestoreTrashItemRequest, TrashItem
import uuid
import shutil
import datetime

def get_trash_dir() -> Path:
    config = load_app_config()
    campaign_path = Path(config.active_campaign_path)
    trash_dir = campaign_path / ".trash"
    trash_dir.mkdir(exist_ok=True, parents=True)
    return trash_dir

@router.delete("/file")
def delete_campaign_file(request: DeleteFileRequest):
    config = load_app_config()
    if not config.active_campaign_path:
        raise HTTPException(status_code=400, detail="No active campaign.")
    campaign_path = Path(config.active_campaign_path)
    
    # Check if file exists inside campaign
    target_path = Path(request.path)
    try:
        target_path.relative_to(campaign_path)
    except ValueError:
        raise HTTPException(status_code=400, detail="Path is outside the active campaign.")
        
    if not target_path.exists():
        raise HTTPException(status_code=404, detail="File not found.")
        
    trash_dir = get_trash_dir()
    trash_id = str(uuid.uuid4())
    
    trash_dat_path = trash_dir / f"{trash_id}.dat"
    trash_meta_path = trash_dir / f"{trash_id}.meta.json"
    
    # Move the file
    shutil.move(str(target_path), str(trash_dat_path))
    
    # Write metadata
    meta = {
        "trash_id": trash_id,
        "original_path": str(target_path),
        "deleted_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "name": target_path.name
    }
    with open(trash_meta_path, "w", encoding="utf-8") as meta_f:
        json.dump(meta, meta_f)
        
    return {"success": True, "trash_id": trash_id}

@router.get("/trash")
def list_trash_items() -> list[TrashItem]:
    try:
        trash_dir = get_trash_dir()
    except Exception:
        return []
        
    items = []
    for meta_file in trash_dir.glob("*.meta.json"):
        try:
            with open(meta_file, "r", encoding="utf-8") as f:
                data = json.load(f)
                items.append(TrashItem(**data))
        except Exception:
            continue
            
    # sort by deleted_at descending
    items.sort(key=lambda x: x.deleted_at, reverse=True)
    return items

@router.post("/trash/restore")
def restore_trash_item(request: RestoreTrashItemRequest):
    trash_dir = get_trash_dir()
    trash_id = request.trash_id
    
    trash_dat_path = trash_dir / f"{trash_id}.dat"
    trash_meta_path = trash_dir / f"{trash_id}.meta.json"
    
    if not trash_meta_path.exists() or not trash_dat_path.exists():
        raise HTTPException(status_code=404, detail="Trash item not found.")
        
    with open(trash_meta_path, "r", encoding="utf-8") as f:
        meta = json.load(f)
        
    original_path = Path(meta["original_path"])
    original_path.parent.mkdir(exist_ok=True, parents=True)
    
    # Move back
    shutil.move(str(trash_dat_path), str(original_path))
    
    # Delete metadata
    trash_meta_path.unlink()
    
    return {"success": True}

@router.delete("/trash/{trash_id}")
def permanent_delete_trash_item(trash_id: str):
    trash_dir = get_trash_dir()
    
    trash_dat_path = trash_dir / f"{trash_id}.dat"
    trash_meta_path = trash_dir / f"{trash_id}.meta.json"
    
    if trash_dat_path.exists():
        trash_dat_path.unlink()
    if trash_meta_path.exists():
        trash_meta_path.unlink()
        
    return {"success": True}
''')
