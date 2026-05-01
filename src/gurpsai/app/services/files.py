from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from gurpsai.app.config import load_app_config, ROOT
from gurpsai.app.services.activity import ActivityService
CAMPAIGN_ROOT = ROOT / "Campaign"

TEXT_EXTENSIONS = {
    ".md",
    ".txt",
    ".json",
    ".toml",
    ".yaml",
    ".yml",
    ".py",
    ".ps1",
    ".ini",
    ".cfg",
    ".csv",
}

ROOT_FILE_ALLOWLIST = {
    "README.md",
    "TODO.md",
    "TODO-DB.md",
    "AGENTS.md",
    "SYSTEM.md",
    "master_philosophy.md",
    "gemini.md",
}


@dataclass(frozen=True)
class FileTreeNode:
    path: str
    name: str
    node_type: str
    children: list["FileTreeNode"]
    title: str | None = None


@dataclass(frozen=True)
class FileContent:
    path: str
    name: str
    content: str
    truncated: bool


class CampaignFileService:
    """Read-only browser for campaign and selected repo files."""

    def __init__(self, root: Path | None = None) -> None:
        self._root = (root or ROOT).resolve()
        config = load_app_config()
        active_path = config.campaign.active_path.strip()
        
        if active_path:
            camp_path = Path(active_path)
            if camp_path.is_absolute():
                self._campaign_root = camp_path.resolve()
            else:
                self._campaign_root = (self._root / active_path).resolve()
        else:
            self._campaign_root = (self._root / "Campaign").resolve()

    def tree(self) -> list[FileTreeNode]:
        nodes: list[FileTreeNode] = []

        if self._campaign_root.exists() and self._campaign_root.is_dir():
            nodes.append(self._build_virtual_directory_node(self._campaign_root, virtual_prefix="Campaign"))

        repo_files = []
        for name in sorted(ROOT_FILE_ALLOWLIST):
            path = self._root / name
            if path.exists() and path.is_file():
                repo_files.append(
                    FileTreeNode(
                        path=name,
                        name=name,
                        node_type="file",
                        children=[],
                    )
                )
        nodes.extend(repo_files)
        return nodes

    def read_file(self, relative_path: str, *, max_chars: int = 120_000) -> FileContent:
        normalized = relative_path.strip().replace("\\", "/")
        if not normalized:
            raise ValueError("File path must be non-empty.")

        target = self._resolve_allowed_path(normalized)
        if not target.exists() or not target.is_file():
            raise FileNotFoundError(f"File not found: {normalized}")
        if not self._is_text_file(target):
            raise ValueError(f"Unsupported file type for preview: {normalized}")

        content = target.read_text(encoding="utf-8", errors="replace")
        truncated = len(content) > max_chars
        if truncated:
            content = content[:max_chars]

        return FileContent(
            path=normalized,
            name=target.name,
            content=content,
            truncated=truncated,
        )

    def get_media_path(self, relative_path: str) -> Path:
        normalized = relative_path.strip().replace("\\", "/")
        if not normalized:
            raise ValueError("File path must be non-empty.")

        target = self._resolve_allowed_path(normalized)
        if not target.exists() or not target.is_file():
            raise FileNotFoundError(f"Media file not found: {normalized}")
            
        return target

    def write_file(self, path: str, content: str) -> None:
        normalized = path.strip().replace("\\", "/")
        if not normalized.startswith("Campaign/"):
            raise ValueError("Only files within Campaign/ can be explicitly edited via UI.")
            
        target = self._resolve_allowed_path(normalized)
        
        # Ensure parent directories exist
        target.parent.mkdir(parents=True, exist_ok=True)
        
        is_new = not target.exists()
        
        # Write to disk
        target.write_text(content, encoding="utf-8")
        
        ActivityService().log_event(
            event_type="FILE_EDIT",
            description=f"{'Created' if is_new else 'Updated'} file {normalized}",
            metadata={"path": normalized, "is_new": is_new}
        )

    def list_media_in_dir(self, dir_path: str) -> list[str]:
        normalized = dir_path.strip().replace("\\", "/")
        target = self._resolve_allowed_path(normalized)
        # If it's a file path (like an editor's active file), get its parent directory
        if target.is_file():
            target = target.parent
            
        if not target.exists() or not target.is_dir():
            return []
        
        media_files = []
        valid_exts = {".png", ".jpg", ".jpeg", ".webp", ".gif"}
        for entry in target.iterdir():
            if entry.is_file() and entry.suffix.lower() in valid_exts:
                media_files.append(entry.name)
        return sorted(media_files)

    def upload_media(self, dir_path: str, filename: str, content: bytes) -> str:
        normalized = dir_path.strip().replace("\\", "/")
        target_dir = self._resolve_allowed_path(normalized)
        # If passed a file path, target the directory instead
        if target_dir.is_file():
            target_dir = target_dir.parent
            
        if not target_dir.exists() or not target_dir.is_dir():
            raise FileNotFoundError(f"Directory not found: {normalized}")
            
        valid_exts = {".png", ".jpg", ".jpeg", ".webp", ".gif"}
        file_path = target_dir / filename
        if file_path.suffix.lower() not in valid_exts:
            raise ValueError(f"Invalid file extension. Allowed: {valid_exts}")
            
        # 15MB limit
        if len(content) > 15 * 1024 * 1024:
            raise ValueError("File size exceeds 15MB limit.")
            
        file_path.write_bytes(content)
        
        ActivityService().log_event(
            event_type="FILE_UPLOAD",
            description=f"Uploaded media {filename}",
            metadata={"directory": normalized, "filename": filename, "size": len(content)}
        )
        return filename

    def _build_virtual_directory_node(self, directory: Path, virtual_prefix: str) -> FileTreeNode:
        children: list[FileTreeNode] = []

        entries = sorted(directory.iterdir(), key=lambda p: (p.is_file(), p.name.lower()))
        for entry in entries:
            if entry.name.startswith(".") and entry.name != ".keep":
                continue
            child_prefix = f"{virtual_prefix}/{entry.name}"
            if entry.is_dir():
                children.append(self._build_virtual_directory_node(entry, child_prefix))
            elif entry.is_file():
                title = None
                if entry.suffix.lower() == ".json":
                    try:
                        content = json.loads(entry.read_text(encoding="utf-8", errors="replace"))
                        if isinstance(content, dict):
                            title = content.get("title") or content.get("name")
                    except Exception:
                        pass
                children.append(
                    FileTreeNode(
                        path=child_prefix,
                        name=entry.name,
                        node_type="file",
                        children=[],
                        title=title,
                    )
                )

        name_parts = virtual_prefix.split("/")
        node_name = name_parts[-1]

        return FileTreeNode(
            path=virtual_prefix,
            name=node_name,
            node_type="directory",
            children=children,
        )

    def _resolve_allowed_path(self, normalized: str) -> Path:
        if normalized == "Campaign":
            return self._campaign_root
        
        if normalized.startswith("Campaign/"):
            subpath = normalized[len("Campaign/"):]
            if not subpath:
                return self._campaign_root
            path = (self._campaign_root / subpath).resolve()
            if self._campaign_root not in path.parents and path != self._campaign_root:
                raise ValueError("Path escapes Campaign root.")
            return path

        if normalized in ROOT_FILE_ALLOWLIST:
            path = (self._root / normalized).resolve()
            return path
            
        if normalized.startswith(".planning/") or normalized.startswith(".agents/"):
            path = (self._root / normalized).resolve()
            if self._root not in path.parents and path != self._root:
                raise ValueError("Path escapes workspace root.")
            return path

        raise ValueError(f"Path is not available in browser: {normalized}")

    def _is_text_file(self, path: Path) -> bool:
        return path.suffix.lower() in TEXT_EXTENSIONS or path.name in ROOT_FILE_ALLOWLIST
