import json
import logging
import time
import hashlib
from datetime import datetime
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional

from gurpsai.app.config import APP_DIR, load_app_config

# Ensure activities directory exists
ACTIVITIES_DIR = APP_DIR / "activities"
ACTIVITIES_DIR.mkdir(parents=True, exist_ok=True)


class ActivityEvent(BaseModel):
    id: str
    timestamp: str
    event_type: str
    description: str
    metadata: Dict[str, Any] = Field(default_factory=dict)


class ActivityService:
    def _get_log_path(self) -> Path:
        """Get the unique log file path for the current active campaign."""
        config = load_app_config()
        active_path = config.campaign.active_path.strip()
        if not active_path:
            active_path = "default_campaign"
        
        # Create a safe filename using a hash of the path
        safe_hash = hashlib.sha256(active_path.encode('utf-8')).hexdigest()[:12]
        base_name = Path(active_path).name if active_path != "default_campaign" else "default"
        
        # Sanitize base_name
        safe_base = "".join(c if c.isalnum() else "_" for c in base_name)
        
        filename = f"{safe_base}_{safe_hash}.json"
        return ACTIVITIES_DIR / filename

    def get_events(self) -> List[ActivityEvent]:
        """Read all activity events for the current campaign."""
        path = self._get_log_path()
        if not path.exists():
            return []
        
        try:
            content = path.read_text(encoding="utf-8")
            data = json.loads(content)
            return [ActivityEvent.model_validate(e) for e in data]
        except Exception as e:
            logging.error(f"Failed to read activity log at {path}: {e}")
            return []

    def log_event(self, event_type: str, description: str, metadata: Optional[Dict[str, Any]] = None):
        """Append a new event to the activity log."""
        events = self.get_events()
        
        new_event = ActivityEvent(
            id=str(time.time()),
            timestamp=datetime.utcnow().isoformat() + "Z",
            event_type=event_type,
            description=description,
            metadata=metadata or {}
        )
        
        events.append(new_event)
        
        # Keep only the last 1000 events to prevent the file from growing infinitely
        if len(events) > 1000:
            events = events[-1000:]
            
        try:
            path = self._get_log_path()
            path.write_text(json.dumps([e.model_dump() for e in events], indent=2), encoding="utf-8")
        except Exception as e:
            logging.error(f"Failed to write activity log: {e}")

