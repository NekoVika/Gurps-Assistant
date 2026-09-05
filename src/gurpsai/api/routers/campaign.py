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
    created: list[str] = []
    existing: list[str] = []

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

import json

_TEMPLATE_DIR = ROOT / ".planning" / "_templates"

# Canonical campaign layout — must match what CampaignRegistry.tsx buckets
# and the creation wizards (web/src/lib/wizards.ts) expect.
_INIT_DIRS = [
    "01_World_Bible/Locations",
    "01_World_Bible/Factions",
    "01_World_Bible/World_Maps_and_Art",
    "02_Characters/PCs",
    "02_Characters/Main_Cast",
    "02_Characters/Bestiary",
    "03_Story",
    "_reports/sessions",
]

# (target file, template filename, fallback content if template missing)
_INIT_SEEDS: list[tuple[str, str, dict]] = [
    ("state.json", "State_Template.json", {
        "campaignName": "", "currentDate": "", "currentLocation": "",
        "activeQuests": [], "recentEvents": [], "inventory": [],
        "reputation": "", "notes": "",
    }),
    ("00_System_Rules.json", "System_Rules_Template.json", {
        "title": "System Rules", "baseSystem": "GURPS 4e", "coreBooks": [],
        "houseRules": "", "allowedOptions": "", "forbiddenOptions": "",
        "pointBudget": "", "customMechanics": "",
    }),
    ("01_World_Bible/World_Dossier.json", "World_Dossier_Template.json", {
        "name": "", "worldType": "", "toneAndGenre": "", "themes": [],
        "elevatorPitch": "", "corePremises": [], "tags": [], "images": [],
    }),
    ("03_Story/Campaign_Overview.json", "Campaign_Overview_Template.json", {
        "title": "", "status": "", "synopsis": "", "players": [], "pcs": [],
        "childLinks": [], "images": [],
    }),
]


def _load_seed_template(template_name: str, fallback: dict) -> dict:
    try:
        data = json.loads((_TEMPLATE_DIR / template_name).read_text(encoding="utf-8"))
        if not isinstance(data, dict):
            raise ValueError("template root is not an object")
    except Exception:
        data = dict(fallback)
    if template_name == "Campaign_Overview_Template.json":
        data.setdefault("childLinks", [])
    return data


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

    created: list[str] = []
    existing: list[str] = []

    try:
        for rel_dir in _INIT_DIRS:
            target = camp_path / rel_dir
            if target.is_dir():
                existing.append(rel_dir + "/")
            else:
                target.mkdir(parents=True, exist_ok=True)
                created.append(rel_dir + "/")

        for rel_file, template_name, fallback in _INIT_SEEDS:
            target = camp_path / rel_file
            if target.exists():
                existing.append(rel_file)
                continue
            data = _load_seed_template(template_name, fallback)
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(json.dumps(data, indent=2), encoding="utf-8")
            created.append(rel_file)
    except OSError as exc:
        raise HTTPException(status_code=500, detail=f"Could not create initial campaign files: {exc}")

    if created:
        message = f"Campaign initialized: created {len(created)} items."
    else:
        message = "Campaign structure already complete; nothing to create."
    return InitCampaignResponse(success=True, message=message, created=created, existing=existing)

from pydantic import ValidationError
from gurpsai.domain.campaign import CharacterData, LocationData, StoryData, FactionData

class DanglingRef(BaseModel):
    source_path: str
    field: str
    name: str
    suggested_type: str

class CampaignValidateResponse(BaseModel):
    scanned_files: int
    errors: list[str]
    dangling: list[DanglingRef] = []

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
    dangling: list[DanglingRef] = []
    scanned = 0

    from gurpsai.app.services.files import CampaignFileService
    from gurpsai.app.services.link_resolver import LinkResolver, is_reference
    service = CampaignFileService()
    registry = service.get_registry()
    resolver = LinkResolver(registry)

    for file_path in camp_path.rglob("*.json"):
        rel_path = file_path.relative_to(camp_path).as_posix()
        try:
            content = file_path.read_text(encoding="utf-8")
        except Exception:
            continue

        try:
            data_dict = {}
            try:
                import json
                data_dict = json.loads(content)
            except Exception:
                pass
                
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
                
            # Check for dangling references (reported separately from schema errors)
            if isinstance(data_dict, dict) and data_dict:
                source_path = f"Campaign/{rel_path}"

                def add_dangling(field: str, name: str, suggested_type: str) -> None:
                    dangling.append(DanglingRef(
                        source_path=source_path, field=field,
                        name=name, suggested_type=suggested_type,
                    ))

                for rel_key, suggested in [
                    ("characterRelations", "Character"),
                    ("locationRelations", "Location"),
                    ("factionRelations", "Faction"),
                ]:
                    if isinstance(data_dict.get(rel_key), list):
                        for rel in data_dict[rel_key]:
                            if isinstance(rel, dict) and isinstance(rel.get("name"), str):
                                name = rel["name"]
                                if is_reference(name) and not resolver.exists(name):
                                    add_dangling(rel_key, name, suggested)

                for arr_key, suggested in [
                    ("characters", "Character"),
                    ("locations", "Location"),
                    ("factions", "Faction"),
                    ("storyAppearances", "Story"),
                ]:
                    if isinstance(data_dict.get(arr_key), list):
                        for entry in data_dict[arr_key]:
                            if isinstance(entry, str) and is_reference(entry) and not resolver.exists(entry):
                                add_dangling(arr_key, entry, suggested)

                if isinstance(data_dict.get("childLinks"), list):
                    src_type = str(data_dict.get("type", "")).lower()
                    if src_type == "episode":
                        child_type = "Chapter"
                    elif src_type == "chapter":
                        child_type = "Encounter"
                    else:
                        child_type = "Episode"
                    for child in data_dict["childLinks"]:
                        if isinstance(child, str) and is_reference(child) and not resolver.exists(child):
                            add_dangling("childLinks", child, child_type)

        except ValidationError as ve:
            for err in ve.errors():
                field = " -> ".join(str(loc) for loc in err["loc"])
                msg = err["msg"]
                errors.append(f"[{rel_path}] {field}: {msg}")
        except Exception as e:
            errors.append(f"[{rel_path}] Corrupt JSON: {str(e)}")

    return CampaignValidateResponse(scanned_files=scanned, errors=errors, dangling=dangling)

class RegistryItem(BaseModel):
    id: str
    title: str
    path: str
    type: str

class CampaignRegistryResponse(BaseModel):
    items: list[RegistryItem]

@router.get("/registry", response_model=CampaignRegistryResponse)
def get_campaign_registry() -> CampaignRegistryResponse:
    from gurpsai.app.services.files import CampaignFileService
    service = CampaignFileService()
    items = service.get_registry()
    return CampaignRegistryResponse(items=[RegistryItem(**item) for item in items])

class StubRequest(BaseModel):
    name: str
    type: str
    parent_path: str | None = None

class BatchStubRequest(BaseModel):
    stubs: list[StubRequest]

class BatchStubResponse(BaseModel):
    created: int
    paths: list[str]
    skipped: list[str] = []

@router.post("/stubs/batch", response_model=BatchStubResponse)
def create_batch_stubs(request: BatchStubRequest) -> BatchStubResponse:
    from gurpsai.app.services.files import CampaignFileService
    from gurpsai.domain.campaign import CharacterData, LocationData, FactionData, StoryData
    import re
    
    from gurpsai.app.services.link_resolver import LinkResolver

    service = CampaignFileService()
    resolver = LinkResolver.from_service(service)
    created_paths = []
    skipped = []

    for stub in request.stubs:
        safe_name = "".join(c for c in stub.name if c.isalnum() or c in (" ", "-", "_")).strip()
        safe_name = re.sub(r'^[\d_]+', '', safe_name).strip()
        if not safe_name:
            continue

        # Entity already exists somewhere in the campaign (any folder, any
        # case/underscore variation) — don't create a duplicate stub.
        if resolver.exists(stub.name):
            skipped.append(stub.name)
            continue

        filename = safe_name.replace(" ", "_") + ".json"
        t_lower = stub.type.lower()
        if "char" in t_lower or "npc" in t_lower:
            data = CharacterData(name=stub.name).model_dump()
            rel_path = f"Campaign/02_Characters/Main_Cast/{filename}"
        elif "loc" in t_lower:
            data = LocationData(name=stub.name).model_dump()
            rel_path = f"Campaign/01_World_Bible/Locations/{filename}"
        elif "fac" in t_lower:
            data = FactionData(name=stub.name).model_dump()
            rel_path = f"Campaign/01_World_Bible/Factions/{filename}"
        elif "episode" in t_lower:
            data = StoryData(title=stub.name, type="Episode").model_dump()
            episode_dir = safe_name.replace(" ", "_")
            if not episode_dir.startswith("Episode_"):
                episode_dir = f"Episode_{episode_dir}"
            rel_path = f"Campaign/03_Story/{episode_dir}/Episode_Overview.json"
        elif "chap" in t_lower:
            data = StoryData(title=stub.name, type="Chapter").model_dump()
            chapter_dir = safe_name.replace(" ", "_")
            if not chapter_dir.startswith("Chapter_"):
                chapter_dir = f"Chapter_{chapter_dir}"
            if stub.parent_path:
                parent_dir = stub.parent_path.rsplit("/", 1)[0]
                rel_path = f"{parent_dir}/{chapter_dir}/Chapter_Overview.json"
            else:
                rel_path = f"Campaign/03_Story/_Unsorted/{chapter_dir}/Chapter_Overview.json"
        else:
            story_type = "Encounter" if "enc" in t_lower else "Story"
            data = StoryData(title=stub.name, type=story_type).model_dump()
            if stub.parent_path:
                parent_dir = stub.parent_path.rsplit("/", 1)[0]
                rel_path = f"{parent_dir}/Encounters/{filename}"
            else:
                rel_path = f"Campaign/03_Story/_Unsorted/{filename}"

        try:
            # Belt-and-suspenders: never overwrite an existing file.
            service.read_file(rel_path)
            skipped.append(stub.name)
        except Exception:
            import json
            service.write_file(rel_path, json.dumps(data, indent=2))
            created_paths.append(rel_path)

    return BatchStubResponse(created=len(created_paths), paths=created_paths, skipped=skipped)

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
    old_title: str
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
        
    import re
    safe_name = "".join(c for c in new_name if c.isalnum() or c in (" ", "-", "_")).strip()
    safe_name = re.sub(r'^[\d_]+', '', safe_name).strip()
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
    if request.old_title != new_name:
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
                    ref_keys = {"childLinks", "characters", "locations", "factions", "storyAppearances"}
                    relation_keys = {"characterRelations", "locationRelations", "factionRelations"}
                    for k, v in node.items():
                        if k in ref_keys and isinstance(v, list):
                            for i, item in enumerate(v):
                                if isinstance(item, str) and (item == request.old_title or item.endswith(request.old_title)):
                                    v[i] = new_name
                                    changed = True
                        elif k in relation_keys and isinstance(v, list):
                            for item in v:
                                if isinstance(item, dict) and isinstance(item.get("name"), str) \
                                        and (item["name"] == request.old_title or item["name"].endswith(request.old_title)):
                                    item["name"] = new_name
                                    changed = True
                        elif isinstance(v, dict) or isinstance(v, list):
                            if refactor_json_node(v):
                                changed = True
                elif isinstance(node, list):
                    for item in node:
                        if isinstance(item, dict) or isinstance(item, list):
                            if refactor_json_node(item):
                                changed = True
                return changed

            if refactor_json_node(data):
                with open(json_file, "w", encoding="utf-8") as f:
                    json.dump(data, f, indent=2)
                refactored_count += 1
                
    rel_new_path = new_target.relative_to(campaign_path).as_posix()
    frontend_path = f"Campaign/{rel_new_path}"
    return RenameEntityResponse(success=True, new_path=frontend_path, refactored_files=refactored_count)

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
