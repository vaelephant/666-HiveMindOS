from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from memory_layer.knowledge_base.app.logging_config import get_logger
from memory_layer.knowledge_base.core.services import model_settings_service

router = APIRouter()
log = get_logger("hivemind.settings")


class ModelPreferencesUpdate(BaseModel):
    chat_profile: str | None = None
    fast_profile: str | None = None
    embed_profile: str | None = None


class CustomProfileCreate(BaseModel):
    label: str = Field(..., min_length=1, max_length=80)
    id: str | None = Field(None, max_length=50)
    provider: str = Field(..., pattern="^(openai|anthropic)$")
    model: str = Field(..., min_length=1, max_length=120)
    kind: str = Field("chat", pattern="^(chat|embed)$")
    max_tokens: int = Field(8192, ge=256, le=128000)
    dim: int | None = Field(None, ge=64, le=8192)


@router.get("/orgs/{org_id}/settings/models")
def get_model_settings(org_id: str, user_id: str = "demo"):
    try:
        return model_settings_service.list_model_catalog(org_id, user_id)
    except Exception as exc:
        log.error("[settings] get models failed: %s", exc)
        raise HTTPException(status_code=503, detail=f"模型设置不可用: {exc}") from exc


@router.put("/orgs/{org_id}/settings/models")
def update_model_preferences(org_id: str, body: ModelPreferencesUpdate, user_id: str = "demo"):
    try:
        settings = model_settings_service.save_preferences(
            org_id,
            user_id,
            chat_profile=body.chat_profile,
            fast_profile=body.fast_profile,
            embed_profile=body.embed_profile,
        )
        catalog = model_settings_service.list_model_catalog(org_id, user_id)
        catalog["preferences"]["updated_at"] = settings.updated_at
        return catalog
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        log.error("[settings] update models failed: %s", exc)
        raise HTTPException(status_code=503, detail=f"保存失败: {exc}") from exc


@router.post("/orgs/{org_id}/settings/models/custom")
def add_custom_model(org_id: str, body: CustomProfileCreate, user_id: str = "demo"):
    try:
        model_settings_service.add_custom_profile(org_id, user_id, body.model_dump())
        return model_settings_service.list_model_catalog(org_id, user_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        log.error("[settings] add custom model failed: %s", exc)
        raise HTTPException(status_code=503, detail=f"添加失败: {exc}") from exc


@router.delete("/orgs/{org_id}/settings/models/custom/{profile_id}")
def delete_custom_model(org_id: str, profile_id: str, user_id: str = "demo"):
    try:
        model_settings_service.remove_custom_profile(org_id, user_id, profile_id)
        return model_settings_service.list_model_catalog(org_id, user_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        log.error("[settings] delete custom model failed: %s", exc)
        raise HTTPException(status_code=503, detail=f"删除失败: {exc}") from exc
