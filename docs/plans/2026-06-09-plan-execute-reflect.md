# 企业目标驱动型 Agent 执行系统 — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 实现六节点任务引擎（Planner → Queue → Executor → StepReflect → Replan → FinalReflect → Memory），Phase 1 打穿「整理本周项目决策进 Wiki」，同步预埋销售方案 Rubric。

**Architecture:** Planner 产出任务队列 + Rubric 类型 → Orchestrator 循环执行（Executor + StepReflect + Replan）→ FinalReflect 报告 → 高分路径写入 agent_experience。标准来自 `settings/rubrics/`，非模型自拟。

**Tech Stack:** Python 3.11+ / FastAPI / SQLite / model_layer.client / Next.js webui

**Design doc:** `docs/plans/2026-06-09-plan-execute-reflect-design.md`

**MVP 场景：C** — Phase 1 做 A（Wiki 整理），预埋 B（销售方案 Rubric），Phase 1.5 加 web_search。

---

## Task 1: 核心数据模型

**Files:**
- Create: `memory_layer/knowledge_base/models/plan.py`
- Create: `memory_layer/knowledge_base/models/reflection.py`
- Modify: `memory_layer/knowledge_base/models/task.py`
- Modify: `memory_layer/knowledge_base/core/registry/task_registry.py`
- Test: `memory_layer/knowledge_base/tests/test_task_models.py`

**Step 1: Write failing tests**

```python
from agent_engine.models.plan import Plan, QueueTask
from agent_engine.models.reflection import StepReflectResult
from agent_engine.models.task import Task

def test_queue_task_from_dict():
    t = QueueTask.from_dict({
        "id": "t1", "name": "检索记忆", "action": "search_memories",
        "params": {"category": "decision"}, "status": "pending",
    })
    assert t.action == "search_memories"

def test_step_reflect_result():
    r = StepReflectResult.from_dict({
        "score": 82, "passed": True, "status": "pass",
        "reason": "ok", "problems": [], "next_action": "continue", "new_tasks": [],
    })
    assert r.status == "pass"

def test_task_goal_fields():
    t = Task(id="1", org_id="demo", input="test", task_type="wiki_organize_decisions",
             phase="planning", queue=[], reflections=[])
    assert t.task_type == "wiki_organize_decisions"
```

**Step 2: Run — expect FAIL**

```bash
cd /Users/yan/code/666-HiveMindOS
python -m pytest memory_layer/knowledge_base/tests/test_task_models.py -v
```

**Step 3: Implement**

`plan.py` — `QueueTask` + `Plan`（含 `task_type`, `rubric_id`, `tasks[]`）

`reflection.py` — `StepReflectResult`（score, status, problems, new_tasks, dimensions）

`task.py` 扩展字段：
```python
task_type: str = "generic_goal"
rubric_id: str = ""
constraints: dict = field(default_factory=dict)
phase: str = "pending"
plan: dict | None = None
queue: list = field(default_factory=list)
checkpoints: dict = field(default_factory=dict)
reflections: list = field(default_factory=list)
score: int | None = None
experience_id: str | None = None
pending_step_id: str | None = None
```

`task_registry.py` — 新增列 + JSON 序列化；`CREATE TABLE` 用 `ALTER` 兼容旧库

**Step 4: Run — expect PASS**

**Step 5: Commit**

```bash
git commit -m "feat(tasks): add QueueTask, StepReflectResult, extend Goal/Task model"
```

---

## Task 2: Rubric 配置

**Files:**
- Create: `memory_layer/knowledge_base/settings/rubrics/wiki_organize_decisions.yaml`
- Create: `memory_layer/knowledge_base/settings/rubrics/sales_proposal.yaml`
- Create: `memory_layer/knowledge_base/settings/rubrics/generic_goal.yaml`
- Create: `memory_layer/knowledge_base/core/domain/rubric.py`
- Test: `memory_layer/knowledge_base/tests/test_rubric.py`

**Step 1: Write failing test**

```python
from agent_engine.domain.rubric import load_rubric, match_task_type

def test_load_wiki_rubric():
    r = load_rubric("wiki_organize_decisions")
    assert r["pass_score"] == 75
    assert len(r["criteria"]) >= 4

def test_match_task_type():
    assert match_task_type("帮我整理本周项目决策进 Wiki") == "wiki_organize_decisions"
```

**Step 2: Implement `rubric.py`**

- `load_rubric(rubric_id)` → 读 `settings/rubrics/{id}.yaml`
- `match_task_type(goal: str) -> str` — 关键词规则（decision/wiki/整理 → wiki_organize；客户/销售方案 → sales_proposal；默认 generic_goal）
- `format_rubric_for_prompt(rubric)` — 供 Reflect 使用

**Step 3: Run tests — PASS**

**Step 4: Commit**

---

## Task 3: Task Tool Registry

**Files:**
- Create: `memory_layer/knowledge_base/settings/task_tools.yaml`
- Create: `memory_layer/knowledge_base/settings/task_gates.yaml`
- Create: `memory_layer/knowledge_base/core/tools/task_toolkit.py`
- Test: `memory_layer/knowledge_base/tests/test_task_toolkit.py`

**Step 1: Tests + implement**（同 v1 plan：11 个 action + `llm_generate`）

每个 action 返回 `dict` 摘要（`count`, `created`, `approved`, `items` 等）

**Step 2: Commit**

```bash
git commit -m "feat(tasks): TaskToolRegistry with knowledge-domain actions"
```

---

## Task 4: Planner Agent

**Files:**
- Modify: `memory_layer/knowledge_base/prompts/prompts.yaml` — `agents.planner`
- Create: `memory_layer/knowledge_base/core/agents/planner_agent.py`
- Test: `memory_layer/knowledge_base/tests/test_planner_agent.py`

**Planner 输入：**

- goal + constraints
- `task_tools.yaml` 清单
- `get_org_stats`
- `match_task_type(goal)` → rubric
- 可选：`experience_registry.latest_high_score(task_type)` Top-1 workflow

**Planner 输出 JSON：**

```json
{
  "goal": "...",
  "task_type": "wiki_organize_decisions",
  "rubric_id": "wiki_organize_decisions",
  "success_criteria": ["..."],
  "tasks": [
    { "id": "t1", "name": "...", "action": "search_memories", "params": {}, "gate": "auto", "reason": "..." }
  ],
  "estimated_risk": "medium"
}
```

**Step 1: `validate_plan(plan_dict, allowed_actions)` — 拒绝未知 action**

**Step 2: Commit**

---

## Task 5: StepReflect + Replan Agents

**Files:**
- Modify: `memory_layer/knowledge_base/prompts/prompts.yaml` — `agents.step_reflect`, `agents.replan`
- Create: `memory_layer/knowledge_base/core/agents/step_reflect_agent.py`
- Create: `memory_layer/knowledge_base/core/agents/replan_agent.py`
- Test: `memory_layer/knowledge_base/tests/test_step_reflect.py`

**StepReflect 输出 status：** `pass | retry | add_task | fail`

```python
class StepReflectAgent:
    def run(self, *, goal, task, result, rubric, checkpoints) -> StepReflectResult:
        ...
```

**ReplanAgent** — 将 `new_tasks` 规范化为 `QueueTask`（校验 action 白名单、分配 id）

**单元测试（mock LLM）：** 解析 fixture JSON → 正确映射 status

**Commit**

---

## Task 6: Executor + Orchestrator

**Files:**
- Create: `memory_layer/knowledge_base/core/execution/condition_eval.py`
- Create: `memory_layer/knowledge_base/core/execution/executor_engine.py`
- Create: `memory_layer/knowledge_base/core/execution/orchestrator.py`
- Test: `memory_layer/knowledge_base/tests/test_orchestrator.py`

**Orchestrator 主循环：**

```python
class TaskOrchestrator:
    MAX_RETRIES = 2
    MAX_ADD_TASKS = 3
    MAX_TOTAL_STEPS = 20

    def run(self, goal: Task, *, resume_from: str | None = None) -> None:
        queue = goal.queue
        while queue_has_pending(queue):
            task = next_pending(queue)
            # gate check → maybe raise ApprovalRequired
            # when eval → maybe skip
            result = executor.execute(task)
            reflection = step_reflect.run(...)
            goal.reflections.append(reflection)
            if reflection.status == "pass":
                mark_done(task)
            elif reflection.status == "retry" and task.retry_count < MAX_RETRIES:
                task.retry_count += 1
            elif reflection.status == "add_task" and added_count < MAX_ADD_TASKS:
                queue.extend(replan.normalize(reflection.new_tasks))
            elif reflection.status == "fail":
                mark_failed(task)  # or HumanReview
            on_step_callback(...)
```

**Tests:**

- `when` 跳过
- `gate auto_if_low_risk` 暂停
- `add_task` 追加队列
- `retry` 计数上限

**Commit**

---

## Task 7: FinalReflect + Experience + Task Service

**Files:**
- Modify: `memory_layer/knowledge_base/prompts/prompts.yaml` — `agents.final_reflect`
- Create: `memory_layer/knowledge_base/core/agents/final_reflect_agent.py`
- Create: `memory_layer/knowledge_base/core/registry/experience_registry.py`
- Create: `memory_layer/knowledge_base/core/services/task_service.py`
- Modify: `memory_layer/knowledge_base/app/routers/tasks.py`
- Remove/redirect: `core/agents/task_agent.py` → task_service

**experience_registry.py：**

```python
def save_experience(org_id, task_type, goal, workflow, reflection, score, success) -> str
def latest_high_score(org_id, task_type, min_score=80, limit=1) -> list[dict]
```

**task_service.run_goal(goal_id)：**

```
planning → PlannerAgent
planned  → Orchestrator（execute/reflect/replan 循环）
reflecting → FinalReflectAgent → score
done → if score >= 80: MemoryNode.save
```

**API：**

- `POST /tasks` — `{ input, constraints?, auto_run? }`
- `POST /tasks/{id}/approve`
- `POST /tasks/{id}/cancel`
- `GET /experiences`（可选 Phase 1）

**Smoke test：**

```bash
curl -X POST http://localhost:8006/api/v1/orgs/demo/tasks \
  -H 'Content-Type: application/json' \
  -d '{"input":"帮我整理本周项目决策进 Wiki"}'
```

**Commit**

---

## Task 8: WebUI 升级

**Files:**
- Modify: `webui/src/lib/kb-types.ts`
- Modify: `webui/src/lib/kb-api.ts`
- Modify: `webui/src/components/knowledge-base/agent-tasks-view.tsx`

**Types 新增：** `TaskPhase`, `QueueTask`, `StepReflection`, `TaskPlan`, `task_type`, `score`, `reflections`

**UI：**

- 标题「自主任务」；示例「帮我整理本周项目决策进 Wiki」
- Plan/Queue 卡片
- 每步：action 标签 + result 摘要 + Reflect 分数/问题
- `add_task` 高亮新任务
- `awaiting_approval` → 批准按钮
- FinalReflect Markdown + 总分

**Commit**

---

## Task 9: 项目文档

**Files:**
- Modify: `项目文档/7-自主任务引擎.md`（流程图与节点说明已初稿，补 Rubric / API / MVP 章节）

内容：核心 Mermaid 流程图（见文档 §核心编排）、Rubric 三方标准、StepReflect 状态机、experience 沉淀、MVP 场景 C、API 示例。

**Commit**

```bash
git commit -m "docs: 自主任务引擎（Plan/Execute/Reflect/Replan/Memory）"
```

---

## 开发顺序总览

```
1. Rubric 种子（wiki + sales 预埋 + generic）     ← Task 2
2. 数据模型（Goal + Queue + Reflection）          ← Task 1
3. Task Tool Registry                             ← Task 3
4. Planner（JSON + task_type + 经验召回）          ← Task 4
5. Executor + Orchestrator（含 StepReflect 挂钩）  ← Task 6
6. StepReflect + Replan                           ← Task 5
7. FinalReflect + agent_experience                ← Task 7
8. API + task_service                             ← Task 7
9. 前端可视化                                      ← Task 8
10. 项目文档                                       ← Task 9
```

> Task 5 与 6 可并行开发接口后合并。

---

## 测试策略

| 层级 | 范围 |
|------|------|
| 单元 | Rubric 加载、match_task_type、validate_plan、condition_eval、reflect JSON 解析、retry/add 上限 |
| 集成 | TaskToolExecutor 各 action（demo org） |
| 端到端 | Wiki 整理目标 curl + UI 轮询；第二次同类目标验证 experience 召回 |

```bash
python -m pytest memory_layer/knowledge_base/tests/ -v
```

---

## Phase 1.5 增量（不在本 plan 任务内）

- `web_search` / `read_url` tool
- 启用 `sales_proposal` Rubric 端到端
- Qdrant experience embedding 召回
- `goals` + `goal_tasks` 拆表

---

## 执行选项

**Plan 已更新。**

**1. Subagent-Driven（本会话）** — Task 1→9 逐步实现  
**2. Parallel Session** — 新会话 + executing-plans

回复 `1` 或 `2` 开始写代码。
