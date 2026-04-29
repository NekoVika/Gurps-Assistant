from __future__ import annotations

import os
from pathlib import Path
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

from gurpsai.app.config import (
    CampaignSettingsUpdate,
    load_campaign_settings_view,
    save_campaign_settings,
    load_app_config,
    ROOT,
)

router = APIRouter(prefix="/campaign", tags=["campaign"])

class CampaignSettingsResponse(BaseModel):
    active_path: str

class CampaignSettingsUpdateRequest(BaseModel):
    active_path: str

class InitCampaignResponse(BaseModel):
    success: bool
    message: str

@router.get("/settings", response_model=CampaignSettingsResponse)
def get_campaign_settings() -> CampaignSettingsResponse:
    view = load_campaign_settings_view()
    return CampaignSettingsResponse(active_path=view.active_path)


@router.put("/settings", response_model=CampaignSettingsResponse)
def update_campaign_settings(request: CampaignSettingsUpdateRequest) -> CampaignSettingsResponse:
    try:
        view = save_campaign_settings(CampaignSettingsUpdate(active_path=request.active_path))
    except OSError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Could not write settings file: {exc}",
        ) from exc
    return CampaignSettingsResponse(active_path=view.active_path)

import subprocess

class CampaignBrowseResponse(BaseModel):
    path: str

@router.get("/browse", response_model=CampaignBrowseResponse)
def browse_campaign() -> CampaignBrowseResponse:
    # Spawn a detached python process that opens tkinter dialog and prints the path
    script = (
        "import tkinter as tk; "
        "from tkinter import filedialog; "
        "root = tk.Tk(); "
        "root.attributes('-topmost', True); "
        "root.withdraw(); "
        "path = filedialog.askdirectory(parent=root, title='Select Campaign Folder'); "
        "print(path)"
    )
    try:
        result = subprocess.run(
            ["python", "-c", script], 
            capture_output=True, 
            text=True, 
            check=False
        )
        selected = result.stdout.strip()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to open browse dialog: {exc}")
        
    return CampaignBrowseResponse(path=selected)

@router.post("/init", response_model=InitCampaignResponse)
def init_campaign() -> InitCampaignResponse:
    config = load_app_config()
    active_path = config.campaign.active_path.strip()
    if not active_path:
        raise HTTPException(status_code=400, detail="Cannot initialize: active campaign path is empty.")
    camp_path = Path(active_path)
    if not camp_path.is_absolute():
        camp_path = (ROOT / active_path).resolve()
        
    if not camp_path.exists():
        try:
            camp_path.mkdir(parents=True, exist_ok=True)
        except OSError as exc:
            raise HTTPException(status_code=500, detail=f"Could not create campaign directory: {exc}")

    state_file = camp_path / "state.md"
    rules_file = camp_path / "00_System_Rules.md"
    
    # Simple stub content
    state_content = """# Campaign State

## Overview
Campaign tracking and state documentation.

## Recent Events
- Campaign initialized.
"""

    rules_content = """# System Rules

## Rules Snapshot
Mechanical guidelines and specific rulings for this campaign.
"""

    try:
        if not state_file.exists():
            state_file.write_text(state_content, encoding="utf-8")
        if not rules_file.exists():
            rules_file.write_text(rules_content, encoding="utf-8")
    except OSError as exc:
        raise HTTPException(status_code=500, detail=f"Could not create initial campaign files: {exc}")
        
    return InitCampaignResponse(success=True, message="Campaign initialized with stub files.")

from pydantic import ValidationError
from gurpsai.domain.campaign import CharacterData, LocationData, StoryData, FactionData

class CampaignValidateResponse(BaseModel):
    scanned_files: int
    errors: list[str]

@router.get("/validate", response_model=CampaignValidateResponse)
def validate_campaign() -> CampaignValidateResponse:
    config = load_app_config()
    active_path = config.campaign.active_path.strip()
    if not active_path:
        raise HTTPException(status_code=400, detail="Cannot validate: active campaign path is empty.")
    
    camp_path = Path(active_path)
    if not camp_path.is_absolute():
        camp_path = (ROOT / active_path).resolve()

    if not camp_path.exists():
        raise HTTPException(status_code=404, detail="Campaign directory does not exist.")

    errors = []
    scanned = 0

    for file_path in camp_path.rglob("*.json"):
        rel_path = file_path.relative_to(camp_path).as_posix()
        try:
            content = file_path.read_text(encoding="utf-8")
        except Exception:
            continue

        try:
            if "02_Characters" in rel_path or "Bestiary" in rel_path:
                scanned += 1
                CharacterData.model_validate_json(content)
            elif "Locations" in rel_path:
                scanned += 1
                LocationData.model_validate_json(content)
            elif "04_Factions" in rel_path or "Factions" in rel_path:
                scanned += 1
                FactionData.model_validate_json(content)
            elif "03_Story" in rel_path or "Episodes" in rel_path or "sessions" in rel_path:
                scanned += 1
                StoryData.model_validate_json(content)
        except ValidationError as ve:
            for err in ve.errors():
                field = " -> ".join(str(loc) for loc in err["loc"])
                msg = err["msg"]
                errors.append(f"[{rel_path}] {field}: {msg}")
        except Exception as e:
            errors.append(f"[{rel_path}] Corrupt JSON: {str(e)}")

    return CampaignValidateResponse(scanned_files=scanned, errors=errors)

from gurpsai.app.services.chat import ChatService
from gurpsai.providers.base import ChatMessage as ProviderChatMessage

class MendRequest(BaseModel):
    provider: str | None = None
    model: str | None = None
    target_type: str
    raw_string: str

class MendResponse(BaseModel):
    mended_string: str

class MendFileRequest(BaseModel):
    provider: str | None = None
    model: str | None = None
    target_type: str
    raw_content: str

class MendFileResponse(BaseModel):
    mended_content: str

@router.post("/mend", response_model=MendResponse)
def mend_string(request: MendRequest) -> MendResponse:
    formats = {
        "Attribute": "Name Level [Points] (e.g., 'ST 10 [0]')",
        "Trait": "Name [Points] - Notes (Ref) (e.g., 'Combat Reflexes [15] - Reacts quickly (B43)')",
        "Skill": "Name (Base)-Level [Points] - Notes (e.g., 'Brawling (DX+1)-13 [2] - Punching')",
        "Gear": "Name [Quantity] (Weight, Cost) - Notes (e.g., 'Broadsword [1] (3 lbs, $500) - sw+1 cut')",
        "HitLocation": "Location (Roll): DR X - Notes (e.g., 'Skull (3-4): DR 2 - Helmet')"
    }
    
    target_format = formats.get(request.target_type, "Name [Points] - Notes")
    
    system_prompt = (
        "You are a strict data formatting engine. Your ONLY job is to take a malformed string "
        f"and rewrite it EXACTLY according to this template for a {request.target_type}:\n\n"
        f"TEMPLATE: {target_format}\n\n"
        "EXAMPLE INPUT: Combat Reflexes cost 15 points reacting fast\n"
        "EXAMPLE OUTPUT: {\"mended_string\": \"Combat Reflexes [15] - Reacting fast\"}\n\n"
        "CRITICAL INSTRUCTION: You must output a valid JSON object containing exactly one key 'mended_string'. Do not include any introductions, explanations, or formatting tags."
    )
    
    from gurpsai.app.config import load_app_config
    config = load_app_config()
    
    active_model = request.model or config.defaults.mending_model
    active_provider = request.provider or config.defaults.mending_provider

    service = ChatService()
    try:
        result = service.chat(
            provider_name=active_provider,
            model=active_model,
            messages=[
                ProviderChatMessage(role="system", content=system_prompt),
                ProviderChatMessage(role="user", content=f"Fix this string:\n{request.raw_string}")
            ]
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"LLM Mending failed: {exc}")
        
    raw_text = result.text.strip()
    
    start_idx = raw_text.find('{')
    end_idx = raw_text.rfind('}')
    if start_idx != -1 and end_idx != -1 and end_idx >= start_idx:
        json_str = raw_text[start_idx:end_idx+1]
        try:
            import json
            parsed = json.loads(json_str)
            if "mended_string" in parsed:
                return MendResponse(mended_string=parsed["mended_string"])
        except json.JSONDecodeError:
            pass
            
    # Fallback if it completely failed to output JSON
    raw_text = raw_text.replace("```json", "").replace("```", "").replace("<draft>", "").replace("</draft>", "").strip()
    return MendResponse(mended_string=raw_text)

@router.post("/mend-file", response_model=MendFileResponse)
def mend_file(request: MendFileRequest) -> MendFileResponse:
    import json
    from gurpsai.domain.campaign import CharacterData, LocationData, StoryData, FactionData
    
    target_type = request.target_type.lower()
    if "character" in target_type:
        schema_dict = CharacterData.model_json_schema()
    elif "location" in target_type:
        schema_dict = LocationData.model_json_schema()
    elif "faction" in target_type:
        schema_dict = FactionData.model_json_schema()
    else:
        schema_dict = StoryData.model_json_schema()
        
    schema_str = json.dumps(schema_dict, indent=2)
    
    system_prompt = (
        "You are an expert strict JSON formatting engine for a GURPS RPG campaign manager. "
        "The user will provide you with a malformed, corrupted, or badly formatted text file that was "
        "supposed to be a valid JSON object. Your ONLY job is to extract all the available information and "
        "rewrite it into a perfectly valid JSON object that strictly conforms to the provided JSON Schema.\n\n"
        f"JSON SCHEMA:\n{schema_str}\n\n"
        "CRITICAL INSTRUCTIONS:\n"
        "1. Output ONLY the raw JSON string. Do not include markdown formatting like ```json or any introductory text.\n"
        "2. Ensure all required fields from the schema are present. If data is missing, provide a sensible default (e.g., empty string or empty array) that matches the schema types.\n"
        "3. Do not invent new facts, but map existing text creatively into the closest matching schema field."
    )
    
    from gurpsai.app.config import load_app_config
    config = load_app_config()
    
    active_model = request.model or config.defaults.mending_model
    active_provider = request.provider or config.defaults.mending_provider

    service = ChatService()
    try:
        result = service.chat(
            provider_name=active_provider,
            model=active_model,
            messages=[
                ProviderChatMessage(role="system", content=system_prompt),
                ProviderChatMessage(role="user", content=f"Fix this file content:\n{request.raw_content}")
            ]
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"LLM File Mending failed: {exc}")
        
    raw_text = result.text.strip()
    
    start_idx = raw_text.find('{')
    end_idx = raw_text.rfind('}')
    if start_idx != -1 and end_idx != -1 and end_idx >= start_idx:
        raw_text = raw_text[start_idx:end_idx+1]
    
    try:
        json.loads(raw_text)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=500, detail=f"Mended output was not valid JSON: {exc}")

    return MendFileResponse(mended_content=raw_text)

from gurpsai.api.schemas.files import DeleteFileRequest, RestoreTrashItemRequest, TrashItem
import json
import uuid
import shutil
import datetime

class RenameEntityRequest(BaseModel):
    old_path: str
    new_name: str
    updated_content: dict

class RenameEntityResponse(BaseModel):
    success: bool
    new_path: str
    refactored_files: int

@router.post("/rename-entity", response_model=RenameEntityResponse)
def rename_entity(request: RenameEntityRequest) -> RenameEntityResponse:
    config = load_app_config()
    if not config.campaign.active_path:
        raise HTTPException(status_code=400, detail="No active campaign.")
    campaign_path = Path(config.campaign.active_path)
    
    normalized_path = request.old_path.replace("\\", "/")
    if normalized_path.startswith("Campaign/"):
        normalized_path = normalized_path[len("Campaign/"):]
        
    old_target = campaign_path / normalized_path
    if not old_target.exists() or not old_target.is_file():
        raise HTTPException(status_code=404, detail="Original file not found.")
        
    old_name = old_target.stem
    new_name = request.new_name
    
    if not new_name.strip():
        raise HTTPException(status_code=400, detail="New name cannot be empty.")
        
    safe_name = "".join(c for c in new_name if c.isalnum() or c in (" ", "-", "_")).strip()
    if not safe_name:
        raise HTTPException(status_code=400, detail="New name has no valid characters for a filename.")
        
    new_target = old_target.parent / f"{safe_name}.json"
    
    if new_target.exists() and new_target.resolve() != old_target.resolve():
         raise HTTPException(status_code=400, detail="A file with that name already exists.")

    with open(new_target, "w", encoding="utf-8") as f:
        json.dump(request.updated_content, f, indent=2)
        
    if new_target.resolve() != old_target.resolve():
        old_target.unlink()
        
    refactored_count = 0
    if old_name != new_name:
        for json_file in campaign_path.rglob("*.json"):
            if json_file.resolve() == new_target.resolve():
                continue
                
            try:
                with open(json_file, "r", encoding="utf-8") as f:
                    data = json.load(f)
            except Exception:
                continue
                
            def refactor_json_node(node) -> bool:
                changed = False
                if isinstance(node, dict):
                    for k, v in node.items():
                        if isinstance(v, str):
                            if v == old_name:
                                node[k] = new_name
                                changed = True
                        else:
                            if refactor_json_node(v):
                                changed = True
                elif isinstance(node, list):
                    for i, v in enumerate(node):
                        if isinstance(v, str):
                            if v == old_name:
                                node[i] = new_name
                                changed = True
                        else:
                            if refactor_json_node(v):
                                changed = True
                return changed

            if refactor_json_node(data):
                with open(json_file, "w", encoding="utf-8") as f:
                    json.dump(data, f, indent=2)
                refactored_count += 1
                
    rel_new_path = new_target.relative_to(campaign_path).as_posix()
    return RenameEntityResponse(success=True, new_path=rel_new_path, refactored_files=refactored_count)

def get_trash_dir() -> Path:
    config = load_app_config()
    campaign_path = Path(config.campaign.active_path)
    trash_dir = campaign_path / ".trash"
    trash_dir.mkdir(exist_ok=True, parents=True)
    return trash_dir
@router.delete("/file")
def delete_campaign_file(request: DeleteFileRequest):
    config = load_app_config()
    if not config.campaign.active_path:
        raise HTTPException(status_code=400, detail="No active campaign.")
    campaign_path = Path(config.campaign.active_path)
    
    # Check if file exists inside campaign
    # the frontend usually sends relative paths, often prefixed with "Campaign/"
    normalized_path = request.path.replace("\\", "/")
    if normalized_path.startswith("Campaign/"):
        normalized_path = normalized_path[len("Campaign/"):]
        
    if Path(normalized_path).is_absolute():
        target_path = Path(normalized_path).resolve()
    else:
        target_path = (campaign_path / normalized_path).resolve()
        
    try:
        target_path.relative_to(campaign_path.resolve())
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
