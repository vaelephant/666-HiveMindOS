"""PlannerNode — 将用户目标拆解为任务队列。"""

from __future__ import annotations

import json

from memory_layer.knowledge_base import config
from memory_layer.knowledge_base.app.logging_config import get_logger
from memory_layer.knowledge_base.core.domain.rubric import match_task_type
from memory_layer.knowledge_base.core.parsers.llm_json import parse_json_object
from memory_layer.knowledge_base.core.tools.task_toolkit import TaskToolExecutor, format_tools_for_prompt, list_actions
from memory_layer.knowledge_base.models.plan import Plan
from memory_layer.knowledge_base.prompts import get, render
from model_layer import client as llm

log = get_logger("hivemind.agent.planner")

_PLANNER = get("agents.planner")


def validate_plan(plan_dict: dict, allowed: list[str] | None = None) -> bool:
    allowed = allowed or list_actions()
    if not plan_dict.get("goal"):
        return False
    tasks = plan_dict.get("tasks") or plan_dict.get("steps") or []
    if not tasks:
        return False
    seen: set[str] = set()
    for t in tasks:
        action = t.get("action") or t.get("tool")
        if not action or action not in allowed:
            return False
        tid = str(t.get("id", ""))
        if not tid or tid in seen:
            return False
        seen.add(tid)
    return True


def _fallback_plan(goal: str, task_type: str) -> dict:
    """规则模板 — LLM 不可用或校验失败时使用。"""
    if task_type == "wiki_organize_decisions":
        return {
            "goal": goal,
            "task_type": task_type,
            "rubric_id": task_type,
            "success_criteria": [
                "检索本周 decision 记忆与会话",
                "提炼事实并写入候选池",
                "Resolver 解析并编译进 Wiki",
                "用户收到变更清单",
            ],
            "estimated_risk": "medium",
            "tasks": [
                {"id": "t1", "name": "检索决策记忆", "action": "search_memories",
                 "params": {"category": "decision", "since_days": 7}, "gate": "auto",
                 "reason": "收集本周决策类智慧"},
                {"id": "t2", "name": "列出相关会话", "action": "list_sessions",
                 "params": {"since_days": 7, "limit": 20}, "gate": "auto",
                 "reason": "补充会话上下文"},
                {"id": "t3", "name": "提炼结构化事实", "action": "extract_facts",
                 "params": {"sources": ["$t1", "$t2"], "category": "decision"}, "gate": "auto",
                 "reason": "从原料抽取 Wiki 候选事实"},
                {"id": "t4", "name": "写入候选池", "action": "enqueue_candidates",
                 "params": {"facts": "$t3"}, "gate": "auto", "when": "$t3.count > 0",
                 "reason": "进入候选晋升流程"},
                {"id": "t5", "name": "批量解析候选", "action": "resolve_candidates",
                 "params": {"limit": 50}, "gate": "auto", "when": "$t4.created > 0",
                 "reason": "Resolver 自动批准高置信条目"},
                {"id": "t6", "name": "编译进 Wiki", "action": "compile_candidates",
                 "params": {"limit": 30}, "gate": "auto_if_low_risk", "when": "$t5.approved > 0",
                 "reason": "将已批准候选写入企业 Wiki"},
            ],
        }
    if task_type == "sales_proposal":
        q = goal[:80]
        return {
            "goal": goal,
            "task_type": task_type,
            "rubric_id": task_type,
            "success_criteria": [
                "完成客户/公司背景调研（内部 Wiki + 公开信息）",
                "明确客户痛点与需求",
                "输出可执行的销售方案（含渠道、排期、指标）",
            ],
            "estimated_risk": "medium",
            "tasks": [
                {"id": "t1", "name": "检索内部 Wiki", "action": "search_wiki",
                 "params": {"query": q}, "gate": "auto",
                 "reason": "查阅企业已有客户/产品知识"},
                {"id": "t2", "name": "搜索客户公开信息", "action": "web_search",
                 "params": {"query": q, "limit": 5}, "gate": "auto",
                 "reason": "获取公司背景、业务动态"},
                {"id": "t3", "name": "读取重点网页", "action": "read_url",
                 "params": {"url": "$t2.first_url"}, "gate": "auto",
                 "when": "$t2.count > 0", "reason": "深入阅读首条搜索结果"},
                {"id": "t4", "name": "查询客户实体", "action": "list_entities",
                 "params": {"entity_type": "customer"}, "gate": "auto",
                 "reason": "对齐知识图谱中的客户档案"},
                {"id": "t5", "name": "分析客户痛点", "action": "llm_generate",
                 "params": {
                     "prompt": "基于材料分析目标客户的核心痛点、购买决策人、使用场景，输出条目清单。",
                     "context": ["$t1", "$t2", "$t3", "$t4"],
                 }, "gate": "auto", "reason": "结构化痛点分析"},
                {"id": "t6", "name": "生成销售方案", "action": "llm_generate",
                 "params": {
                     "prompt": (
                         "生成完整销售方案，须含：产品定位、核心卖点、渠道策略、"
                         "内容策略、执行排期、预算建议、转化路径、可衡量 KPI。"
                     ),
                     "context": ["$t5", "$t1", "$t2"],
                 }, "gate": "auto", "reason": "输出可交付销售方案"},
            ],
        }
    return {
        "goal": goal,
        "task_type": task_type,
        "rubric_id": task_type,
        "success_criteria": ["完成用户目标"],
        "estimated_risk": "medium",
        "tasks": [
            {"id": "t1", "name": "检索组织概况", "action": "get_org_stats",
             "params": {}, "gate": "auto", "reason": "了解现状"},
            {"id": "t2", "name": "搜索 Wiki", "action": "search_wiki",
             "params": {"query": goal[:50]}, "gate": "auto", "reason": "查阅已有知识"},
        ],
    }


class PlannerAgent:
    def run(
        self,
        goal: str,
        org_id: str,
        *,
        constraints: dict | None = None,
        experience: list[dict] | None = None,
        user_id: str = "demo",
    ) -> Plan:
        task_type = match_task_type(goal)
        executor = TaskToolExecutor(org_id, user_id)
        stats = executor.execute("get_org_stats", {})
        exp_text = "（无）"
        if experience:
            exp_text = json.dumps(
                [{"score": e.get("score"), "workflow": e.get("workflow")} for e in experience[:2]],
                ensure_ascii=False,
            )

        prompt = render(
            "agents.planner",
            goal=goal,
            constraints=json.dumps(constraints or {}, ensure_ascii=False),
            org_stats=json.dumps(stats, ensure_ascii=False),
            task_type=task_type,
            tools=format_tools_for_prompt(),
            experience=exp_text,
        )

        plan_dict: dict | None = None
        try:
            raw = llm.complete(prompt, system=_PLANNER.system, model=_PLANNER.resolve_model(config))
            plan_dict = parse_json_object(raw)
            if not validate_plan(plan_dict):
                log.warning("[planner] invalid plan from LLM, using fallback")
                plan_dict = None
        except Exception as exc:
            log.warning("[planner] LLM failed: %s, using fallback", exc)

        if plan_dict is None:
            plan_dict = _fallback_plan(goal, task_type)

        plan_dict.setdefault("task_type", task_type)
        plan_dict.setdefault("rubric_id", task_type)
        return Plan.from_dict(plan_dict)
