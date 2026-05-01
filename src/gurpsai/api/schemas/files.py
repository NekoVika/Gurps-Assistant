from __future__ import annotations

from pydantic import BaseModel, Field


class FileTreeNodeResponse(BaseModel):
    path: str
    name: str
    title: str | None = None
    node_type: str = Field(pattern="^(file|directory)$")
    children: list["FileTreeNodeResponse"] = Field(default_factory=list)


class FileContentResponse(BaseModel):
    path: str
    name: str
    content: str
    truncated: bool = False


FileTreeNodeResponse.model_rebuild()

class FileWriteRequest(BaseModel):
    path: str
    content: str
    
class FileWriteResponse(BaseModel):
    success: bool
    path: str
    message: str

class DeleteFileRequest(BaseModel):
    path: str

class RestoreTrashItemRequest(BaseModel):
    trash_id: str

class TrashItem(BaseModel):
    trash_id: str
    original_path: str
    deleted_at: str
    name: str

