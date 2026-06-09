# Plan → Execute → Reflect 任务引擎 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将现有只读 TaskAgent 升级为 Plan → Execute → Reflect 三阶段任务引擎，支持用户开放目标（如「整理本周项目决策进 Wiki」）的自主规划与执行。

**Architecture:** Planner 产出 JSON Plan → Executor 按白名单 action 逐步执行（含 gate/when）→ Reflect 生成 Markdown 报告。知识库操作通过 TaskToolRegistry 封装现有 service，UI 在 Agent 任务页展示 Plan 与进度。

**Tech Stack:** Python 3.11+ / FastAPI / SQLite TaskRegistry / OpenAI tool-calling via `model_layer.client` / Next.js webui

**Design doc:** `docs/plans/2026-06-09-plan-execute-reflect-design.md`

---

## Task 1: Plan 数据模型与 Task 扩展

**Files:**
- Create: `memory_layer/knowledge_base/models/plan.py`
- Modify: `memory_layer/knowledge_base/models/task.py`
- Modify: `memory_layer/knowledge_base/core/registry/task_registry.py`
- Test: `memory_layer/knowledge_base/tests/test_task_models.py`

**Step 1: Write the failing test**

```python
# memory_layer/knowledge_base/tests/test_task_models.py
from memory_layer.knowledge_base.models.plan import Plan, PlanStep
from memory_layer.knowledge_base.models.task import Task

def test_plan_from_dict():
    raw = {
        "goal": "整理决策",
        "success_criteria": ["检索完成"],
        "steps": [{"id": "s1", "action": "search_memories", "params": {"category": "decision"}, "gate": "auto"}],
        "estimated_risk": "low",
    }
    plan = Plan.from_dict(raw)
    assert plan.goal == "整理决策"
    assert len(plan.steps) == 1
    assert plan.steps[0].action == "search_memories"

def test_task_extended_fields():
    t = Task(id="1", org_id="demo", input="test", phase="planning", plan=None)
    assert t.phase == "planning"
```

**Step 2: Run test — expect FAIL**

```bash
cd /Users/yan/code/666-HiveMindOS
python -m pytest memory_layer/knowledge_base/tests/test_task_models.py -v
```

**Step 3: Implement models**

`plan.py`:
```python
from dataclasses import dataclass, field

@dataclass
class PlanStep:
    id: str
    action: str
    params: dict = field(default_factory=dict)
    gate: str = "auto"
    when: str | None = None
    reason: str = ""

@dataclass
class Plan:
    goal: str
    success_criteria: list[str]
    steps: list[PlanStep]
    estimated_risk: str = "low"

    @classmethod
    def from_dict(cls, d: dict) -> "Plan":
        steps = [PlanStep(**s) for s in d.get("steps", [])]
        return cls(
            goal=d["goal"],
            success_criteria=d.get("success_criteria", []),
            steps=steps,
            estimated_risk=d.get("estimated_risk", "low"),
        )

    def to_dict(self) -> dict:
        return {
            "goal": self.goal,
            "success_criteria": self.success_criteria,
            "estimated_risk": self.estimated_risk,
            "steps": [
                {"id": s.id, "action": s.action, "params": s.params,
                 "gate": s.gate, "when": s.when, "reason": s.reason}
                for s in self.steps
            ],
        }
```

`task.py` — 新增字段：
```python
phase: str = "pending"  # planning | planned | executing | reflecting | done | error | awaiting_approval
plan: dict | None = None
checkpoints: dict = field(default_factory=dict)
pending_step_id: str | None = None
```

`task_registry.py` — migration：
- `plan TEXT`, `phase TEXT DEFAULT 'pending'`, `checkpoints TEXT DEFAULT '{}'`, `pending_step_id TEXT`
- `_from_row` / `add` / `update` 处理 JSON 序列化

**Step 4: Run test — expect PASS**

**Step 5: Commit**

```bash
git add memory_layer/knowledge_base/models/plan.py memory_layer/knowledge_base/models/task.py \
  memory_layer/knowledge_base/core/registry/task_registry.py memory_layer/knowledge_base/tests/test_task_models.py
git commit -m "feat(tasks): add Plan model and extend Task with phase/plan fields"
```

---

## Task 2: Task Tool Registry

**Files:**
- Create: `memory_layer/knowledge_base/settings/task_tools.yaml`
- Create: `memory_layer/knowledge_base/core/tools/task_toolkit.py`
- Test: `memory_layer/knowledge_base/tests/test_task_toolkit.py`

**Step 1: Write failing test**

```python
def test_registry_lists_known_actions():
    from memory_layer.knowledge_base.core.tools.task_toolkit import list_actions, TaskToolExecutor
    actions = list_actions()
    assert "search_memories" in actions
    assert "compile_candidates" in actions

def test_get_org_stats(demo_org_fixture):
    ex = TaskToolExecutor(org_id="demo", user_id="demo")
    result = ex.execute("get_org_stats", {})
    assert "pending" in result
```

**Step 2: Run — expect FAIL**

**Step 3: Implement `task_tools.yaml`**

```yaml
actions:
  - name: get_org_stats
    domain: meta
    description: 获取组织候选池与智慧概况
    params: {}

  - name: search_memories
    domain: memory
    description: 按分类与时间范围搜索活跃智慧
    params:
      category: { type: string, optional: true }
      since_days: { type: integer, optional: true, default: 7 }
      query: { type: string, optional: true }

  - name: list_sessions
    domain: memory
    description: 列出近期聊天会话
    params:
      since_days: { type: integer, optional: true, default: 7 }
      limit: { type: integer, optional: true, default: 20 }

  - name: read_session
    domain: memory
    description: 读取指定会话的消息记录
    params:
      session_id: { type: string, required: true }

  - name: search_wiki
    domain: knowledge
    description: 搜索 Wiki 页面
    params:
      query: { type: string, required: true }

  - name: read_page
    domain: knowledge
    description: 读取 Wiki 页面全文
    params:
      path: { type: string, required: true }

  - name: list_entities
    domain: knowledge
    description: 列出知识图谱实体
    params:
      entity_type: { type: string, optional: true }

  - name: extract_facts
    domain: extract
    description: 从记忆/会话内容提炼结构化事实
    params:
      sources: { type: array, required: true }
      category: { type: string, optional: true }

  - name: enqueue_candidates
    domain: candidate
    description: 将事实批量写入候选池
    params:
      facts: { type: array, required: true }

  - name: resolve_candidates
    domain: candidate
    description: Resolver 批量解析 pending 候选
    params:
      limit: { type: integer, optional: true, default: 30 }

  - name: compile_candidates
    domain: candidate
    description: 将 approved 候选编译进 Wiki
    params:
      limit: { type: integer, optional: true, default: 20 }
```

**Step 4: Implement `TaskToolExecutor`**

- `list_actions()` → 读 yaml
- `execute(name, params)` → dispatch 到：
  - `get_org_stats` → `candidate_service.get_candidate_stats` + memory count
  - `search_memories` → `MemoryRegistry.list_active` + filter by category/since_days/query
  - `list_sessions` / `read_session` → ChatRegistry
  - wiki actions → 复用 `WikiToolExecutor`
  - `extract_facts` → 新 prompt `agents.extract_facts` + `parse_json`
  - `enqueue_candidates` → loop `CandidateRegistry.create`
  - `resolve_candidates` / `compile_candidates` → 现有 service

- 每个 action 返回 `dict` 摘要（含 `count`/`created`/`approved` 等，供 `when` 求值）

**Step 5: Run tests — expect PASS**

**Step 6: Commit**

```bash
git commit -m "feat(tasks): add TaskToolRegistry with memory/knowledge/candidate actions"
```

---

## Task 3: Planner Agent

**Files:**
- Modify: `memory_layer/knowledge_base/prompts/prompts.yaml` — 新增 `agents.planner`
- Create: `memory_layer/knowledge_base/core/agents/planner_agent.py`
- Test: `memory_layer/knowledge_base/tests/test_planner_agent.py`

**Step 1: Add prompt `agents.planner`**

要点：
- 只输出 JSON，action 必须来自给定清单
- 包含 success_criteria、estimated_risk
- 典型目标映射示例（整理决策 → search_memories + list_sessions + extract_facts + enqueue + resolve + compile）

**Step 2: Write test (mock LLM or fixture JSON)**

```python
def test_plan_validation_rejects_unknown_action():
    from memory_layer.knowledge_base.core.agents.planner_agent import validate_plan
    bad = {"goal": "x", "success_criteria": [], "steps": [{"id": "s1", "action": "hack_shell", "params": {}}]}
    assert validate_plan(bad) is False
```

**Step 3: Implement `PlannerAgent`**

```python
class PlannerAgent:
    def run(self, goal: str, org_id: str) -> Plan:
        stats = TaskToolExecutor(org_id).execute("get_org_stats", {})
        tool_catalog = format_tools_for_prompt()  # from task_tools.yaml
        raw = llm.chat(system=..., user=render(goal, stats, tool_catalog))
        plan_dict = parse_json(raw)
        if not validate_plan(plan_dict):
            raise ValueError("invalid plan")
        return Plan.from_dict(plan_dict)
```

**Step 4: Run tests**

**Step 5: Commit**

---

## Task 4: Executor Engine

**Files:**
- Create: `memory_layer/knowledge_base/core/execution/condition_eval.py`
- Create: `memory_layer/knowledge_base/core/execution/executor_engine.py`
- Test: `memory_layer/knowledge_base/tests/test_executor_engine.py`

**Step 1: Write failing tests**

```python
def test_skip_when_condition_false():
    # when="$s1.count > 10" with checkpoint s1.count=2 → skipped

def test_gate_auto_if_low_risk_pauses_on_decision():
    # compile_candidates + tier 1 + pending decision → awaiting_approval

def test_param_ref_resolution():
    # params facts="$s3" → inject checkpoints["s3"]
```

**Step 2: Implement `condition_eval.py`**

- 安全子集：`$sN.field > N`, `==`, `&&`, `||`
- 不支持任意 eval / import

**Step 3: Implement `ExecutorEngine`**

```python
class ExecutorEngine:
    def __init__(self, org_id: str, user_id: str, on_step=None):
        ...

    def run(self, plan: Plan, *, start_from: str | None = None) -> tuple[list[dict], dict]:
        """Returns (steps, checkpoints). May raise ApprovalRequired(pending_step_id)."""
```

Gate 逻辑：
- `auto_if_low_risk` on `compile_candidates`：查 `get_candidate_stats` + `high_risk_categories` from resolver/taxonomy

**Step 4: Run tests**

**Step 5: Commit**

---

## Task 5: Reflect Agent + Task Service 编排

**Files:**
- Modify: `memory_layer/knowledge_base/prompts/prompts.yaml` — `agents.reflect`
- Create: `memory_layer/knowledge_base/core/agents/reflect_agent.py`
- Create: `memory_layer/knowledge_base/core/services/task_service.py`
- Modify: `memory_layer/knowledge_base/app/routers/tasks.py`
- Deprecate: `memory_layer/knowledge_base/core/agents/task_agent.py`（改为调用 task_service 或删除）

**Step 1: Implement `ReflectAgent`**

输入 goal + plan + steps + checkpoints → Markdown 报告

**Step 2: Implement `task_service.run_task(task_id)`**

```python
def run_task(task_id: str, org_id: str, *, resume_from: str | None = None):
    registry.update(task_id, phase="planning")
    plan = PlannerAgent().run(task.input, org_id)
    registry.update(task_id, phase="planned", plan=plan.to_dict())

    registry.update(task_id, phase="executing")
    try:
        steps, checkpoints = ExecutorEngine(org_id, on_step=...).run(plan, start_from=resume_from)
    except ApprovalRequired as e:
        registry.update(task_id, phase="awaiting_approval", pending_step_id=e.step_id, ...)
        return

    registry.update(task_id, phase="reflecting")
    report = ReflectAgent().run(...)
    registry.update(task_id, phase="done", status="done", result=report, steps=steps, checkpoints=checkpoints)
```

**Step 3: Update `tasks.py` router**

- `TaskRequest`: add `auto_run: bool = True`
- `POST .../approve` — resume from `pending_step_id`
- `POST .../cancel`

**Step 4: Manual smoke test**

```bash
curl -X POST http://localhost:8006/api/v1/orgs/demo/tasks \
  -H 'Content-Type: application/json' \
  -d '{"input":"帮我整理本周项目决策进 Wiki"}'
# poll GET until phase=done or awaiting_approval
```

**Step 5: Commit**

---

## Task 6: WebUI — Agent 任务页升级

**Files:**
- Modify: `webui/src/lib/kb-types.ts`
- Modify: `webui/src/lib/kb-api.ts`
- Modify: `webui/src/components/knowledge-base/agent-tasks-view.tsx`

**Step 1: Extend types**

```typescript
export type TaskPhase = 'pending' | 'planning' | 'planned' | 'executing' | 'reflecting' | 'done' | 'error' | 'awaiting_approval';

export type PlanStep = {
  id: string;
  action: string;
  params: Record<string, unknown>;
  gate: string;
  when?: string | null;
  reason: string;
};

export type TaskPlan = {
  goal: string;
  success_criteria: string[];
  steps: PlanStep[];
  estimated_risk: string;
};

export type AgentTask = {
  // existing + phase, plan, checkpoints, pending_step_id
};
```

**Step 2: Add API helpers**

```typescript
export async function approveTask(taskId: string, fromStep?: string): Promise<AgentTask>
```

**Step 3: Update UI**

- 标题改为「自主任务」；副标题「描述目标，系统自动规划并执行」
- Plan 卡片：展示 steps + reason + risk
- `awaiting_approval` → 「批准继续」按钮
- Step 行：ACTION_LABELS 覆盖新 action
- 占位示例改为 Wiki 整理场景

**Step 4: Visual check** — 本地 `pnpm dev` + 提交一条任务

**Step 5: Commit**

---

## Task 7: 项目文档

**Files:**
- Create: `项目文档/7-自主任务引擎.md`

内容：Plan → Execute → Reflect 流程、可用 action、gate 策略、与知识沉淀关系、API 示例。

**Commit:**

```bash
git commit -m "docs: add 自主任务引擎说明"
```

---

## 测试策略

| 层级 | 范围 |
|------|------|
| 单元 | Plan 解析、condition_eval、gate 逻辑、validate_plan |
| 集成 | TaskToolExecutor 各 action（mock DB fixture 或 demo org） |
| 端到端 | curl 创建任务 + UI 轮询（需本地 KB 服务 + 有 memories 数据） |

无现有 pytest 基础设施时，Task 1 创建 `memory_layer/knowledge_base/tests/` 并加 `conftest.py`（`PYTHONPATH=.`）。

---

## 运行命令速查

```bash
# 后端
cd /Users/yan/code/666-HiveMindOS
uvicorn memory_layer.knowledge_base.app.main:app --port 8006 --reload

# 测试
python -m pytest memory_layer/knowledge_base/tests/ -v

# 前端
cd webui && pnpm dev
```

---

## 执行选项

**Plan complete and saved to `docs/plans/2026-06-09-plan-execute-reflect.md`.**

**1. Subagent-Driven（本会话）** — 按 Task 1→7 逐步实现，每步验收  
**2. Parallel Session（新会话）** — 新开会话引用本 plan，用 executing-plans skill 批量执行

你想用哪种方式开始实现？
