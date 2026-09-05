import json
import logging
from pathlib import Path
from typing import Dict, Any, List, Set, Tuple

from gurpsai.app.config import load_app_config, ROOT
from gurpsai.app.services.link_resolver import normalize

logger = logging.getLogger(__name__)

FIELD_MAPPING = {
    "character": {
        "characterRelations": {"target_field": "characterRelations", "target_is_obj": True},
        "locationRelations": {"target_field": "characterRelations", "target_is_obj": True},
        "factionRelations": {"target_field": "characterRelations", "target_is_obj": True},
        "storyAppearances": {"target_field": "characters", "target_is_obj": False},
    },
    "location": {
        "characterRelations": {"target_field": "locationRelations", "target_is_obj": True},
        "locationRelations": {"target_field": "locationRelations", "target_is_obj": True},
        "factionRelations": {"target_field": "locationRelations", "target_is_obj": True},
        "storyAppearances": {"target_field": "locations", "target_is_obj": False},
    },
    "faction": {
        "characterRelations": {"target_field": "factionRelations", "target_is_obj": True},
        "locationRelations": {"target_field": "factionRelations", "target_is_obj": True},
        "factionRelations": {"target_field": "factionRelations", "target_is_obj": True},
        "storyAppearances": {"target_field": "factions", "target_is_obj": False},
    },
    "story": {
        "characters": {"target_field": "storyAppearances", "target_is_obj": False},
        "locations": {"target_field": "storyAppearances", "target_is_obj": False},
        "factions": {"target_field": "storyAppearances", "target_is_obj": False},
    }
}

class RelationSyncService:
    def __init__(self):
        config = load_app_config()
        active_path = config.campaign.active_path.strip()
        if active_path:
            camp_path = Path(active_path)
            if camp_path.is_absolute():
                self.campaign_root = camp_path.resolve()
            else:
                self.campaign_root = (ROOT / active_path).resolve()
        else:
            self.campaign_root = (ROOT / "Campaign").resolve()
            
        self.file_index: Dict[str, Path] = {}
        self._index_built = False

    def _build_index(self):
        if self._index_built or not self.campaign_root.exists():
            return
            
        for file_path in self.campaign_root.rglob("*.json"):
            if ".trash" in file_path.parts or ".planning" in file_path.parts:
                continue
            try:
                content = file_path.read_text(encoding="utf-8")
                data = json.loads(content)
                name = data.get("name") or data.get("title")
                if name and normalize(name):
                    self.file_index.setdefault(normalize(name), file_path)
            except Exception:
                pass
                
        self._index_built = True

    def _detect_type(self, path_str: str) -> str:
        path_lower = path_str.lower()
        if "02_characters" in path_lower or "bestiary" in path_lower:
            return "character"
        elif "locations" in path_lower:
            return "location"
        elif "factions" in path_lower:
            return "faction"
        elif "03_story" in path_lower or "episodes" in path_lower or "sessions" in path_lower:
            return "story"
        return "unknown"

    def _diff_relations(self, old_list: list, new_list: list, is_obj: bool):
        if not isinstance(old_list, list): old_list = []
        if not isinstance(new_list, list): new_list = []
        
        if is_obj:
            old_set = {(r.get("name", ""), r.get("relation", "")) for r in old_list if isinstance(r, dict)}
            new_set = {(r.get("name", ""), r.get("relation", "")) for r in new_list if isinstance(r, dict)}
            added = [{"name": n, "relation": r} for n, r in new_set - old_set if n]
            removed = [{"name": n, "relation": r} for n, r in old_set - new_set if n]
            return added, removed
        else:
            old_set = set(str(x) for x in old_list)
            new_set = set(str(x) for x in new_list)
            added = list(new_set - old_set)
            removed = list(old_set - new_set)
            return added, removed

    def _update_target_file(self, target_path: Path, source_name: str, target_field: str, target_is_obj: bool, action: str, relation_str: str = ""):
        try:
            content = target_path.read_text(encoding="utf-8")
            data = json.loads(content)
        except Exception as e:
            logger.error(f"Sync failed reading target {target_path}: {e}")
            return

        if target_field not in data or not isinstance(data[target_field], list):
            data[target_field] = []

        field_list = data[target_field]
        modified = False

        if target_is_obj:
            if action == "add":
                exists = any(r.get("name") == source_name and r.get("relation") == relation_str for r in field_list if isinstance(r, dict))
                if not exists:
                    field_list.append({"name": source_name, "relation": relation_str})
                    modified = True
            elif action == "remove":
                original_len = len(field_list)
                field_list = [r for r in field_list if not (isinstance(r, dict) and r.get("name") == source_name and r.get("relation") == relation_str)]
                if len(field_list) != original_len:
                    data[target_field] = field_list
                    modified = True
        else:
            if action == "add":
                if source_name not in field_list:
                    field_list.append(source_name)
                    modified = True
            elif action == "remove":
                if source_name in field_list:
                    field_list.remove(source_name)
                    modified = True

        if modified:
            try:
                target_path.write_text(json.dumps(data, indent=2), encoding="utf-8")
                logger.info(f"Symmetric relation synced: {action} {source_name} in {target_path.name}")
            except Exception as e:
                logger.error(f"Sync failed writing target {target_path}: {e}")

    def sync_file(self, file_path_str: str, old_content: str, new_content: str):
        file_type = self._detect_type(file_path_str)
        if file_type not in FIELD_MAPPING:
            return

        try:
            old_data = json.loads(old_content) if old_content else {}
        except json.JSONDecodeError:
            old_data = {}
            
        try:
            new_data = json.loads(new_content)
        except json.JSONDecodeError:
            return

        source_name = new_data.get("name") or new_data.get("title")
        if not source_name:
            return

        mapping = FIELD_MAPPING[file_type]
        
        for source_field, target_info in mapping.items():
            source_is_obj = source_field not in ["storyAppearances", "characters", "locations", "factions"]
            
            old_list = old_data.get(source_field, [])
            new_list = new_data.get(source_field, [])
            
            added, removed = self._diff_relations(old_list, new_list, source_is_obj)
            
            if not added and not removed:
                continue
                
            self._build_index()

            for item in added:
                target_name = item.get("name") if source_is_obj else item
                relation_str = item.get("relation", "") if source_is_obj else ""
                
                target_path = self.file_index.get(normalize(target_name)) if target_name else None
                if target_path:
                    self._update_target_file(
                        target_path=target_path,
                        source_name=source_name,
                        target_field=target_info["target_field"],
                        target_is_obj=target_info["target_is_obj"],
                        action="add",
                        relation_str=relation_str
                    )

            for item in removed:
                target_name = item.get("name") if source_is_obj else item
                relation_str = item.get("relation", "") if source_is_obj else ""
                
                target_path = self.file_index.get(normalize(target_name)) if target_name else None
                if target_path:
                    self._update_target_file(
                        target_path=target_path,
                        source_name=source_name,
                        target_field=target_info["target_field"],
                        target_is_obj=target_info["target_is_obj"],
                        action="remove",
                        relation_str=relation_str
                    )
