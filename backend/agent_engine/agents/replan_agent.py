"""ReplanNode — 将 Reflect 追加任务规范化入队。"""

from __future__ import annotations

from agent_engine.tools.task_toolkit import list_actions
from agent_engine.models.plan import QueueTask


class ReplanAgent:
    def normalize(self, new_tasks: list[dict], *, existing_ids: set[str]) -> list[QueueTask]:
        allowed = set(list_actions())
        out: list[QueueTask] = []
        n = len(existing_ids)
        for i, raw in enumerate(new_tasks):
            action = raw.get("action") or raw.get("tool") or ""
            if action not in allowed:
                continue
            tid = str(raw.get("id") or f"add{n + i + 1}")
            while tid in existing_ids:
                n += 1
                tid = f"add{n}"
            existing_ids.add(tid)
            out.append(QueueTask.from_dict({
                "id": tid,
                "name": raw.get("name") or action,
                "action": action,
                "params": raw.get("params") or {},
                "gate": raw.get("gate", "auto"),
                "when": raw.get("when"),
                "reason": raw.get("reason", "Reflect 追加"),
                "status": "pending",
            }))
        return out
