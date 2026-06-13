from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from agent_engine.core.tool_registry import get_catalog, list_external_tools, update_tool
from server.logging_config import get_logger

router = APIRouter()
log = get_logger("hivemind.tools.api")


@router.get("/orgs/{org_id}/tools/catalog")
def tools_catalog(org_id: str):
    try:
        return get_catalog(org_id)
    except Exception as exc:
        log.error("[tools] catalog failed: %s", exc)
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@router.get("/orgs/{org_id}/tools/external")
def external_tools(org_id: str):
    try:
        return {"tools": list_external_tools(org_id)}
    except Exception as exc:
        log.error("[tools] list failed: %s", exc)
        raise HTTPException(status_code=503, detail=str(exc)) from exc


class ToolPatchRequest(BaseModel):
    enabled: bool | None = None
    endpoint: str | None = None
    description: str | None = None
    config: dict | None = None


@router.patch("/orgs/{org_id}/tools/external/{tool_id}")
def patch_external_tool(org_id: str, tool_id: str, req: ToolPatchRequest):
    try:
        tool = update_tool(
            org_id,
            tool_id,
            enabled=req.enabled,
            endpoint=req.endpoint,
            description=req.description,
            config=req.config,
        )
        return {"tool": tool}
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        log.error("[tools] patch failed: %s", exc)
        raise HTTPException(status_code=503, detail=str(exc)) from exc
