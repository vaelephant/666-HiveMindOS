"""ReflectNode — 逐步质量检查与下一步决策。"""

from __future__ import annotations

import json

from knowledge_base import config
from server.logging_config import get_logger
from agent_engine.domain.rubric import format_rubric_for_prompt, load_rubric
from knowledge_base.core.parsers.llm_json import parse_json_object
from agent_engine.models.plan import QueueTask
from agent_engine.models.reflection import StepReflectResult
from knowledge_base.prompts import get, render
from model_layer import client as llm

log = get_logger("hivemind.agent.step_reflect")

_REFLECT = get("agents.step_reflect")


def _rule_based_reflect(task: QueueTask, result: dict, rubric: dict) -> StepReflectResult | None:
    """确定性规则 — 常见路径免 LLM。"""
    action = task.action
    pass_score = int(rubric.get("pass_score") or 70)

    if action == "search_memories":
        count = int(result.get("count") or 0)
        if count == 0:
            return StepReflectResult(
                score=45, passed=False, status="add_task",
                reason="未检索到决策记忆，需扩大检索范围",
                problems=["记忆为空"],
                new_tasks=[{
                    "name": "扩大时间范围检索会话",
                    "action": "list_sessions",
                    "params": {"since_days": 14, "limit": 30},
                    "reason": "补充会话原料",
                }],
            )
        return StepReflectResult(
            score=min(95, 60 + count * 3), passed=True, status="pass",
            reason=f"检索到 {count} 条记忆",
        )

    if action == "list_sessions":
        count = int(result.get("count") or 0)
        score = 75 if count > 0 else 55
        status = "pass" if count > 0 else "add_task"
        new_tasks = []
        if count == 0:
            new_tasks = [{
                "name": "搜索 Wiki 已有决策页",
                "action": "search_wiki",
                "params": {"query": "决策"},
                "reason": "从 Wiki 补充",
            }]
        return StepReflectResult(
            score=score, passed=status == "pass", status=status,
            reason=f"列出 {count} 个会话", new_tasks=new_tasks,
        )

    if action == "extract_facts":
        count = int(result.get("count") or 0)
        if count == 0:
            return StepReflectResult(
                score=40, passed=False, status="fail",
                reason="未能提炼出可写入 Wiki 的事实",
                problems=["无可晋升内容"],
            )
        return StepReflectResult(
            score=min(92, 65 + count * 5), passed=True, status="pass",
            reason=f"提炼 {count} 条事实",
        )

    if action == "enqueue_candidates":
        created = int(result.get("created") or 0)
        if created == 0:
            return StepReflectResult(
                score=60, passed=True, status="pass",
                reason="无新候选需写入（可能已存在或跳过）",
            )
        return StepReflectResult(
            score=85, passed=True, status="pass",
            reason=f"写入 {created} 条候选",
        )

    if action == "resolve_candidates":
        conflict = int(result.get("conflict") or 0)
        approved = int(result.get("approved") or 0)
        score = 80 if approved > 0 else 65
        problems = [f"{conflict} 条冲突需人工"] if conflict else []
        return StepReflectResult(
            score=score, passed=True, status="pass",
            reason=f"解析完成，批准 {approved}，冲突 {conflict}",
            problems=problems,
        )

    if action == "compile_candidates":
        merged = int(result.get("merged") or 0)
        return StepReflectResult(
            score=90 if merged > 0 else pass_score,
            passed=True, status="pass",
            reason=f"编译 {merged} 条进 Wiki",
        )

    if action == "web_search":
        count = int(result.get("count") or 0)
        if count == 0:
            return StepReflectResult(
                score=50, passed=False, status="add_task",
                reason="公开信息检索为空，尝试换关键词",
                problems=["网络检索无结果"],
                new_tasks=[{
                    "name": "换关键词搜索",
                    "action": "web_search",
                    "params": {"query": task.params.get("query", "") + " 公司 业务", "limit": 5},
                    "reason": "扩大搜索词",
                }],
            )
        return StepReflectResult(
            score=min(88, 55 + count * 6), passed=True, status="pass",
            reason=f"检索到 {count} 条公开信息（{result.get('provider', '')}）",
        )

    if action == "read_url":
        if not result.get("ok"):
            return StepReflectResult(
                score=55, passed=True, status="pass",
                reason="网页读取失败，继续用摘要信息",
                problems=[str(result.get("error") or "read failed")],
            )
        chars = int(result.get("chars") or 0)
        return StepReflectResult(
            score=80 if chars > 200 else 60, passed=True, status="pass",
            reason=f"读取网页 {chars} 字",
        )

    if action == "llm_generate":
        chars = int(result.get("chars") or 0)
        if chars < 200:
            return StepReflectResult(
                score=45, passed=False, status="retry",
                reason="生成内容过短，需重试",
                problems=["输出不足"],
            )
        return StepReflectResult(
            score=min(92, 70 + chars // 100), passed=True, status="pass",
            reason=f"生成 {chars} 字内容",
        )

    if action == "search_wiki" and rubric.get("task_type") == "sales_proposal":
        count = int(result.get("count") or 0)
        return StepReflectResult(
            score=75 if count > 0 else 62, passed=True, status="pass",
            reason=f"Wiki 命中 {count} 页（无命中也可继续）",
        )

    if result.get("error"):
        return StepReflectResult(
            score=30, passed=False, status="retry",
            reason=str(result.get("error")),
            problems=[str(result.get("error"))],
        )

    return None


class StepReflectAgent:
    def run(
        self,
        *,
        goal: str,
        task: QueueTask,
        result: dict,
        rubric_id: str,
    ) -> StepReflectResult:
        rubric = load_rubric(rubric_id)
        ruled = _rule_based_reflect(task, result, rubric)
        if ruled is not None:
            return ruled

        try:
            prompt = render(
                "agents.step_reflect",
                goal=goal,
                task=json.dumps(task.to_dict(), ensure_ascii=False),
                result=json.dumps(result, ensure_ascii=False)[:6000],
                rubric=format_rubric_for_prompt(rubric),
            )
            raw = llm.complete(prompt, system=_REFLECT.system, profile=_REFLECT.resolve_profile())
            return StepReflectResult.from_dict(parse_json_object(raw))
        except Exception as exc:
            log.warning("[step_reflect] LLM failed: %s", exc)
            return StepReflectResult(
                score=70, passed=True, status="pass",
                reason=f"默认通过（反思 LLM 不可用: {exc}）",
            )
