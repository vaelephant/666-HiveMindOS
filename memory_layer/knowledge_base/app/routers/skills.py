"""Agent skills API — list, read, and create SKILL.md files."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from agent_engine.skills.experience_to_skill import list_skills, skills_root, write_manual_skill
from memory_layer.knowledge_base.app.logging_config import get_logger

router = APIRouter()
log = get_logger("hivemind.skills")


class SkillCreateRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=120)
    description: str = Field(..., min_length=1, max_length=200)
    steps: list[str] = Field(..., min_length=1, max_length=20)
    scenario: list[str] | None = Field(default=None, max_length=10)


@router.get("/orgs/{org_id}/skills")
def get_skills(org_id: str):
    try:
        return {"skills": list_skills(org_id)}
    except Exception as exc:
        log.error("[skills] list failed org=%s: %s", org_id, exc)
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@router.post("/orgs/{org_id}/skills")
def create_skill(org_id: str, body: SkillCreateRequest):
    steps = [s.strip() for s in body.steps if s.strip()]
    if not steps:
        raise HTTPException(status_code=400, detail="至少填写一条推荐步骤")
    scenario = [s.strip() for s in (body.scenario or []) if s.strip()] or None
    try:
        result = write_manual_skill(
            org_id,
            title=body.title.strip(),
            description=body.description.strip(),
            steps=steps,
            scenario=scenario,
        )
        return {
            "name": result["skill_name"],
            "path": result["path"],
            "content": result["content"],
        }
    except FileExistsError:
        raise HTTPException(status_code=409, detail="同名 Skill 已存在，请换个标题") from None
    except Exception as exc:
        log.error("[skills] create failed org=%s: %s", org_id, exc)
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@router.get("/orgs/{org_id}/skills/{skill_name}")
def get_skill(org_id: str, skill_name: str):
    path = skills_root(org_id) / skill_name / "SKILL.md"
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Skill 不存在")
    try:
        return {
            "name": skill_name,
            "path": str(path),
            "content": path.read_text(encoding="utf-8"),
        }
    except Exception as exc:
        log.error("[skills] read failed org=%s name=%s: %s", org_id, skill_name, exc)
        raise HTTPException(status_code=503, detail=str(exc)) from exc
