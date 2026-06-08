"""
Memory Extractor — HiveMind 核心能力：从对话中自动提炼长期智慧。

这是「智慧进化」的数据源头：
  Chat 对话 → 本模块判断记什么 → PostgreSQL → Qdrant → 智慧进化页 / Chat 召回

第一期类型：project、preference、decision
关键策略：
  - 截止日期、里程碑、交付节点 → decision（单独成条，不只塞进 project）
  - 项目身份变更 → update project
  - 一轮对话可输出多条记忆（update + create 并存）
"""

from __future__ import annotations

import json
import re

from memory_layer.knowledge_base import config
from memory_layer.knowledge_base.app.logging_config import get_logger
from memory_layer.knowledge_base.models.memory import MemoryCandidate
from model_layer import client as llm

log = get_logger("hivemind.agent.memory_extractor")

_ALLOWED_TYPES = {"project", "preference", "decision"}

# ── 核心提示词：决定系统「记得清不清楚」────────────────────────────────────────
_SYSTEM = """你是企业智慧提取专家。从用户与助手的对话中，判断有哪些值得长期记住的信息。

【核心原则】用户明确说「记住了」、或给出截止日期/里程碑时，必须提取，不可遗漏。

只提取以下类型：
- project    : 用户正在做的项目、产品、业务方向（身份与背景）
- preference : 用户的偏好、习惯、沟通风格、关注重点
- decision   : 明确决策、技术选型、方向转变、截止日期、交付节点、里程碑、承诺事项
  例：「22号要交工」→ decision，title 如「HiveMindOS 交工日期」，content 含具体日期与事项

提取规则（重要）：
1. 日期/节点类信息 → 单独 create 一条 decision，importance ≥ 0.9
   不要只 update 项目而把日期埋在 project content 里
2. 项目名纠正/补充 → update 对应 project（match_title 匹配已有标题）
3. 同一轮可同时返回多条：例如 update project + create decision
4. 结合「最近对话」判断日期/节点属于哪个项目；关联已有 project 时在 decision content 中写明项目名
5. 用户说「记住了」且含时间约束 → 必定提取为 decision

严格排除：
- 单纯的知识库问答（查规定、查流程）—— 那是 Wiki 的事
- 一次性的具体问题（「报价多少」）—— 不值得记
- 助手回答中的企业事实—— 除非用户明确表达个人立场、决策或时间节点

若本轮没有任何值得长期记住的内容，返回 {"memories": []}

若用户更新了已有认知，用 action="update" 并填写 match_title 匹配已有记忆标题。

严格返回 JSON，无 markdown：
{
  "memories": [
    {
      "action": "create",
      "memory_type": "decision",
      "title": "HiveMindOS 交工日期",
      "content": "HiveMindOS 项目定于 22 号交工交付",
      "importance": 0.92,
      "match_title": null
    }
  ]
}"""

_RECENT_TURN_LIMIT = 6  # 最近 3 轮（user+assistant）作为提取上下文


class MemoryExtractor:
    def run(
        self,
        question: str,
        answer: str,
        existing: list[dict],
        recent_turns: list[dict] | None = None,
    ) -> list[MemoryCandidate]:
        existing_block = "（无已有智慧）"
        if existing:
            lines = [
                f"- [{m['memory_type']}] {m['title']}: {m['content']}"
                for m in existing
            ]
            existing_block = "\n".join(lines)

        recent_block = self._format_recent(recent_turns)

        prompt = f"""已有智慧：
{existing_block}

最近对话（用于理解本轮语境，如项目名、正在讨论的事项）：
{recent_block}

本轮对话（重点分析）：
用户：{question}

助手：{answer[:2000]}

请判断是否有值得新增或更新的长期智慧。日期与里程碑务必单独提取为 decision。"""

        raw = llm.complete(prompt=prompt, system=_SYSTEM, model=config.FAST_MODEL)
        return self._parse(raw)

    @staticmethod
    def _format_recent(turns: list[dict] | None) -> str:
        if not turns:
            return "（无）"
        lines: list[str] = []
        for h in turns[-_RECENT_TURN_LIMIT:]:
            role = "用户" if h.get("role") == "user" else "助手"
            content = (h.get("content") or "").strip()
            if content:
                lines.append(f"{role}：{content[:500]}")
        return "\n".join(lines) if lines else "（无）"

    def _parse(self, raw: str) -> list[MemoryCandidate]:
        try:
            text = re.sub(r"^```(?:json)?\s*|\s*```$", "", raw.strip(), flags=re.MULTILINE)
            data = json.loads(text)
            items = data.get("memories") or []
        except (json.JSONDecodeError, ValueError):
            log.warning("[memory] extractor JSON parse failed")
            return []

        results: list[MemoryCandidate] = []
        for item in items:
            if not isinstance(item, dict):
                continue
            action = item.get("action", "create")
            if action == "skip":
                continue
            mtype = item.get("memory_type", "")
            if mtype not in _ALLOWED_TYPES:
                continue
            title = (item.get("title") or "").strip()
            content = (item.get("content") or "").strip()
            if not title or not content:
                continue
            importance = float(item.get("importance", 0.5))
            importance = max(0.0, min(1.0, importance))
            match_title = (item.get("match_title") or "").strip() or None
            if action not in ("create", "update"):
                action = "create"
            results.append(MemoryCandidate(
                action=action,
                memory_type=mtype,
                title=title,
                content=content,
                importance=importance,
                match_title=match_title,
            ))
        return results
