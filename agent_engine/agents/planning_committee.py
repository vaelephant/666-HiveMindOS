"""Planning Committee — 轻量多角色规划会议（角色定义见 agent_engine/settings/planning_committee.yaml）。"""

from __future__ import annotations

import json
from collections.abc import Callable

from memory_layer.knowledge_base import config
from memory_layer.knowledge_base.app.logging_config import get_logger
from agent_engine.agents.planner_agent import (
    _fallback_plan,
    validate_plan,
)
from agent_engine.domain.committee_config import (
    CommitteeRole,
    committee_roles,
    committee_roles_for_ui,
    fallback_domain_summary,
    fallback_risk_for_task_type,
    is_chat_upgrade,
    role_labels,
    should_trigger_committee,
)
from agent_engine.domain.rubric import format_rubric_for_prompt, load_rubric, match_task_type
from memory_layer.knowledge_base.core.parsers.llm_json import parse_json_object
from agent_engine.tools.task_toolkit import TaskToolExecutor, format_tools_for_prompt
from agent_engine.models.plan import Plan
from memory_layer.knowledge_base.prompts import get, render
from model_layer import client as llm

log = get_logger("hivemind.agent.planning_committee")


def _format_chat_context(constraints: dict | None) -> str:
    if not constraints:
        return "（无前置对话上下文）"
    if constraints.get("source") == "task_center":
        return "（任务中心直接创建，无 Chat 对话；需完整检索与规划）"
    ctx = constraints.get("context") or {}
    summary = {
        "session_id": constraints.get("session_id"),
        "wiki_paths": ctx.get("wiki_paths") or [],
        "memory_ids": ctx.get("memory_ids") or [],
        "turn_count": len(ctx.get("turns") or []),
    }
    if ctx.get("turns"):
        summary["recent_turns"] = [
            {"q": t.get("question", "")[:200], "a": (t.get("answer") or "")[:300]}
            for t in ctx["turns"][-3:]
        ]
    return json.dumps(summary, ensure_ascii=False)


def adapt_plan_for_chat_upgrade(plan_dict: dict, constraints: dict | None) -> dict:
    """根据 Chat 已带入的上下文，裁剪重复检索步骤。"""
    ctx = (constraints or {}).get("context") or {}
    wiki_paths = ctx.get("wiki_paths") or []
    turns = ctx.get("turns") or []
    session_id = (constraints or {}).get("session_id")
    has_memories = any((t.get("memories_used") or []) for t in turns if isinstance(t, dict))

    tasks = list(plan_dict.get("tasks") or [])
    adapted: list[dict] = []
    for t in tasks:
        action = t.get("action") or t.get("tool")
        if action == "search_wiki" and len(wiki_paths) >= 2:
            continue
        if action == "search_memories" and has_memories:
            t = dict(t)
            t["reason"] = f"{t.get('reason', '')}（Chat 已召回记忆，本步作补充）".strip()
        if action == "list_sessions" and session_id:
            t = dict(t)
            params = dict(t.get("params") or {})
            params["focus_session_id"] = session_id
            t["params"] = params
            t["reason"] = f"{t.get('reason', '')}（优先关联升级来源会话）".strip()
        adapted.append(t)

    if adapted:
        plan_dict = dict(plan_dict)
        plan_dict["tasks"] = adapted
    return plan_dict


def _fallback_domain(goal: str, task_type: str, constraints: dict | None) -> dict:
    ctx = (constraints or {}).get("context") or {}
    wiki_n = len(ctx.get("wiki_paths") or [])
    turn_n = len(ctx.get("turns") or [])
    skip = []
    if wiki_n >= 2:
        skip.append("search_wiki")
    notes = []
    if turn_n:
        notes.append(f"Chat 已进行 {turn_n} 轮对话，可直接提炼")
    if wiki_n:
        notes.append(f"Chat 已引用 {wiki_n} 个 Wiki 页面")
    default_summary = fallback_domain_summary()
    return {
        "summary": "；".join(notes) if notes else default_summary,
        "suggested_steps": [],
        "success_criteria": _fallback_plan(goal, task_type).get("success_criteria") or [],
        "skip_actions": skip,
    }


def _fallback_risk(task_type: str) -> dict:
    return fallback_risk_for_task_type(task_type)


def _minute(role_id: str, *, summary: str, detail: str = "", fallback: bool = False) -> dict:
    labels = role_labels()
    return {
        "role": role_id,
        "label": labels.get(role_id, role_id),
        "summary": summary,
        "detail": detail,
        "fallback": fallback,
    }


class PlanningCommittee:
    """按 planning_committee.yaml 配置的角色顺序开会，产出可执行 Plan。"""

    def run(
        self,
        goal: str,
        org_id: str,
        *,
        constraints: dict | None = None,
        experience: list[dict] | None = None,
        user_id: str = "demo",
        on_progress: Callable[[list[dict], str | None], None] | None = None,
    ) -> Plan:
        task_type = match_task_type(goal)
        rubric = format_rubric_for_prompt(load_rubric(task_type))
        executor = TaskToolExecutor(org_id, user_id)
        stats = executor.execute("get_org_stats", {})
        chat_ctx = _format_chat_context(constraints)
        exp_text = "（无）"
        if experience:
            exp_text = json.dumps(
                [{"score": e.get("score"), "workflow": e.get("workflow")} for e in experience[:2]],
                ensure_ascii=False,
            )

        minutes: list[dict] = []
        round_outputs: dict[str, dict] = {}
        plan_dict: dict | None = None
        used_fallback = False
        roles = committee_roles()

        def emit(active_role: str | None) -> None:
            if on_progress:
                on_progress(list(minutes), active_role)

        for role in roles:
            emit(role.id)

            if role.synthesizes_plan:
                plan_dict = self._chair_round(
                    role,
                    goal,
                    task_type,
                    round_outputs.get("domain", {}),
                    round_outputs.get("risk", {}),
                    chat_ctx,
                    stats,
                    exp_text,
                )
                if not plan_dict or not validate_plan(plan_dict):
                    log.warning("[committee] chair plan invalid, using fallback template")
                    plan_dict = _fallback_plan(goal, task_type)
                    used_fallback = True
                minutes.append(_minute(
                    role.id,
                    summary="已合成最终任务队列" + ("（规则模板）" if used_fallback else ""),
                    detail=f"共 {len(plan_dict.get('tasks') or [])} 步",
                    fallback=used_fallback,
                ))
                continue

            output, fb = self._run_deliberation_round(
                role,
                goal=goal,
                task_type=task_type,
                chat_ctx=chat_ctx,
                rubric=rubric,
                stats=stats,
                prior=round_outputs,
                constraints=constraints,
            )
            round_outputs[role.id] = output
            minutes.append(_minute(
                role.id,
                summary=self._summarize_round(role.id, output),
                detail=json.dumps(output, ensure_ascii=False)[:800],
                fallback=fb,
            ))

        assert plan_dict is not None

        if is_chat_upgrade(constraints):
            plan_dict = adapt_plan_for_chat_upgrade(plan_dict, constraints)
        risk_out = round_outputs.get("risk", {})
        plan_dict = self._apply_gate_overrides(plan_dict, risk_out)
        domain_out = round_outputs.get("domain", {})
        plan_dict.setdefault("task_type", task_type)
        plan_dict.setdefault("rubric_id", task_type)
        plan_dict.setdefault("success_criteria", domain_out.get("success_criteria") or [])
        plan_dict.setdefault("estimated_risk", risk_out.get("estimated_risk") or "medium")
        plan_dict["planning_mode"] = "committee"
        plan_dict["planning_minutes"] = minutes
        plan_dict["planning_active_role"] = None
        plan_dict["committee_roles"] = committee_roles_for_ui()
        emit(None)

        return Plan.from_dict(plan_dict)

    def _run_deliberation_round(
        self,
        role: CommitteeRole,
        *,
        goal: str,
        task_type: str,
        chat_ctx: str,
        rubric: str,
        stats: dict,
        prior: dict[str, dict],
        constraints: dict | None,
    ) -> tuple[dict, bool]:
        try:
            output = self._llm_round(role, goal, task_type, chat_ctx, rubric, stats, prior)
            if output:
                return output, False
        except Exception as exc:
            log.warning("[committee] %s round failed: %s", role.id, exc)

        if role.id == "domain":
            return _fallback_domain(goal, task_type, constraints), True
        if role.id == "risk":
            return _fallback_risk(task_type), True
        return {"summary": f"{role.label} 发言失败"}, True

    def _llm_round(
        self,
        role: CommitteeRole,
        goal: str,
        task_type: str,
        chat_ctx: str,
        rubric: str,
        stats: dict,
        prior: dict[str, dict],
    ) -> dict | None:
        prompt_cfg = get(f"agents.{role.prompt}")
        kwargs: dict = {
            "goal": goal,
            "task_type": task_type,
            "rubric": rubric,
        }
        if role.id == "domain":
            kwargs.update(
                chat_context=chat_ctx,
                org_stats=json.dumps(stats, ensure_ascii=False),
                tools=format_tools_for_prompt(),
            )
        elif role.id == "risk":
            domain = prior.get("domain", {})
            kwargs["domain_opinion"] = json.dumps(domain, ensure_ascii=False)
        else:
            return None

        prompt = render(f"agents.{role.prompt}", **kwargs)
        raw = llm.complete(prompt, system=prompt_cfg.system, profile=prompt_cfg.resolve_profile())
        return parse_json_object(raw)

    def _chair_round(
        self,
        role: CommitteeRole,
        goal: str,
        task_type: str,
        domain: dict,
        risk: dict,
        chat_ctx: str,
        stats: dict,
        experience: str,
    ) -> dict | None:
        try:
            prompt_cfg = get(f"agents.{role.prompt}")
            prompt = render(
                f"agents.{role.prompt}",
                goal=goal,
                task_type=task_type,
                domain_opinion=json.dumps(domain, ensure_ascii=False),
                risk_opinion=json.dumps(risk, ensure_ascii=False),
                chat_context=chat_ctx,
                org_stats=json.dumps(stats, ensure_ascii=False),
                tools=format_tools_for_prompt(),
                experience=experience,
            )
            raw = llm.complete(prompt, system=prompt_cfg.system, profile=prompt_cfg.resolve_profile())
            data = parse_json_object(raw)
            if validate_plan(data):
                return data
            return None
        except Exception as exc:
            log.warning("[committee] chair round failed: %s", exc)
            return None

    @staticmethod
    def _summarize_round(role_id: str, output: dict) -> str:
        if output.get("summary"):
            return str(output["summary"])
        if role_id == "risk" and output.get("estimated_risk"):
            return f"风险等级：{output['estimated_risk']}"
        return "已完成发言"

    @staticmethod
    def _apply_gate_overrides(plan_dict: dict, risk: dict) -> dict:
        overrides = {
            o.get("step_action"): o
            for o in (risk.get("gate_overrides") or [])
            if o.get("step_action")
        }
        if not overrides:
            return plan_dict
        tasks = []
        for t in plan_dict.get("tasks") or []:
            t = dict(t)
            action = t.get("action") or t.get("tool")
            if action in overrides:
                o = overrides[action]
                t["gate"] = o.get("gate") or t.get("gate", "auto")
                if o.get("reason"):
                    t["reason"] = f"{t.get('reason', '')}；{o['reason']}".strip("；")
            tasks.append(t)
        out = dict(plan_dict)
        out["tasks"] = tasks
        return out
