from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query, status

from pydantic import ValidationError

from gurpsai.api.schemas.files import FileContentResponse, FileTreeNodeResponse, FileWriteRequest, FileWriteResponse
from gurpsai.app.services.files import CampaignFileService, FileTreeNode
from gurpsai.app.services.relation_sync import RelationSyncService
from gurpsai.domain.campaign import CharacterData, LocationData, StoryData

router = APIRouter(prefix="/files", tags=["files"])


def _to_node_response(node: FileTreeNode) -> FileTreeNodeResponse:
    return FileTreeNodeResponse(
        path=node.path,
        name=node.name,
        node_type=node.node_type,
        children=[_to_node_response(child) for child in node.children],
    )


@router.get("/tree", response_model=list[FileTreeNodeResponse])
def file_tree() -> list[FileTreeNodeResponse]:
    service = CampaignFileService()
    return [_to_node_response(node) for node in service.tree()]


@router.get("/content", response_model=FileContentResponse)
def file_content(path: str = Query(..., min_length=1)) -> FileContentResponse:
    service = CampaignFileService()
    try:
        content = service.read_file(path)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except FileNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

    return FileContentResponse(
        path=content.path,
        name=content.name,
        content=content.content,
        truncated=content.truncated,
    )


from fastapi.responses import FileResponse
from fastapi import UploadFile, File, Form

@router.get("/media", response_class=FileResponse)
def file_media(path: str = Query(..., min_length=1)) -> FileResponse:
    service = CampaignFileService()
    try:
        media_path = service.get_media_path(path)
        return FileResponse(media_path)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except FileNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

@router.get("/media_list", response_model=list[str])
def list_media(dir_path: str = Query(..., min_length=1)) -> list[str]:
    service = CampaignFileService()
    try:
        return service.list_media_in_dir(dir_path)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

@router.post("/upload_media")
async def upload_media(dir_path: str = Form(...), file: UploadFile = File(...)):
    service = CampaignFileService()
    try:
        content = await file.read()
        filename = service.upload_media(dir_path, file.filename, content)
        return {"success": True, "filename": filename}
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)) from exc


def validate_file_data(path: str, content: str) -> None:
    if not path.endswith(".json"):
        return
    try:
        if "02_Characters" in path or "Bestiary" in path:
            CharacterData.model_validate_json(content)
        elif "Locations" in path:
            LocationData.model_validate_json(content)
        elif "03_Story" in path or "Episodes" in path or "sessions" in path:
            StoryData.model_validate_json(content)
    except ValidationError as ve:
        # Format detailed Pydantic errors for the frontend
        errors = []
        for err in ve.errors():
            field = " -> ".join(str(loc) for loc in err["loc"])
            msg = err["msg"]
            errors.append(f"[{field}]: {msg}")
        raise ValueError(f"Schema Validation Failed:\n" + "\n".join(errors))

@router.post("/validate")
def file_validate(request: FileWriteRequest):
    try:
        validate_file_data(request.path, request.content)
        return {"valid": True, "error": None}
    except ValueError as exc:
        return {"valid": False, "error": str(exc)}
    except Exception as exc:
        return {"valid": False, "error": str(exc)}

@router.post("/write", response_model=FileWriteResponse)
def file_write(request: FileWriteRequest) -> FileWriteResponse:
    service = CampaignFileService()
    try:
        # Phase 5: Fast Backend Mender/Validator intercept
        validate_file_data(request.path, request.content)
        
        try:
            old_content = service.read_file(request.path).content
        except FileNotFoundError:
            old_content = ""
            
        service.write_file(request.path, request.content)
        
        # Fire and forget sync (synchronous for now, fast enough)
        try:
            RelationSyncService().sync_file(request.path, old_content, request.content)
        except Exception as sync_exc:
            import logging
            logging.getLogger(__name__).error(f"Relation sync failed: {sync_exc}")

        return FileWriteResponse(success=True, path=request.path, message="File updated successfully.")
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)) from exc
