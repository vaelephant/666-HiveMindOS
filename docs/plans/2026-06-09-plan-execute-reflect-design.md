# Plan → Execute → Reflect 任务引擎 — 设计文档

> 日期：2026-06-09  
> 状态：已确认  
> 定位：HiveMindOS 核心能力 — 用户开放目标 → 自主规划 → 自主执行；知识库为沉淀副产物

---

## 一、产品定位

```
用户开放目标（自然语言）
    ↓
Planner   — 产出结构化 Plan，可审阅
    ↓
Executor  — 按步调用 Tool，支持人工门
    ↓
Reflect   — 对照成功标准，生成执行报告
    ↓
Memory Layer — 智慧 / Wiki 自动沉淀（副产物）
```

**与现有模块关系：**

| 模块 | 角色 |
|------|------|
| Chat | 对话问答；复杂目标可「升级为任务」 |
| L1/L2 进化 | 被动沉淀；任务引擎是**主动、有目标**的沉淀 |
| 自动化 4 job | 降级为预置 Plan 模板（未来） |
| Agent 任务页 | 升级为任务中心：Plan 预览、逐步进度、Reflect 报告 |
| 人工审核页 | 接收 Executor 产生的 `conflict` / 高风险 compile |

**Phase 1 边界（架构按 B 设计，实现按 A）：**

- 工具域：memory + knowledge + candidate + extract + meta
- 不实现：Shell、HTTP、外部通知（接口预留 `ToolRegistry.register`）

---

## 二、核心数据模型

### 2.1 Plan（Planner 输出）

```json
{
  "goal": "整理本周项目决策进 Wiki",
  "success_criteria": [
    "本周 decision 类记忆已全部检索",
    "新事实已写入候选池或 Wiki",
    "用户收到变更清单"
  ],
  "steps": [
    {
      "id": "s1",
      "action": "search_memories",
      "params": { "category": "decision", "since_days": 7 },
      "gate": "auto",
      "when": null,
      "reason": "检索本周决策记忆"
    },
    {
      "id": "s2",
      "action": "list_sessions",
      "params": { "since_days": 7 },
      "gate": "auto",
      "when": null,
      "reason": "列出本周相关会话"
    },
    {
      "id": "s3",
      "action": "extract_facts",
      "params": { "sources": ["$s1", "$s2"], "category": "decision" },
      "gate": "auto",
      "when": null,
      "reason": "从记忆与会话提炼结构化事实"
    },
    {
      "id": "s4",
      "action": "enqueue_candidates",
      "params": { "facts": "$s3" },
      "gate": "auto",
      "when": "$s3.count > 0",
      "reason": "写入候选池"
    },
    {
      "id": "s5",
      "action": "resolve_candidates",
      "params": { "limit": 50 },
      "gate": "auto",
      "when": "$s4.created > 0",
      "reason": "Resolver 自动解析"
    },
    {
      "id": "s6",
      "action": "compile_candidates",
      "params": { "limit": 30 },
      "gate": "auto_if_low_risk",
      "when": "$s5.approved > 0",
      "reason": "低风险类自动编译进 Wiki"
    }
  ],
  "estimated_risk": "medium"
}
```

**约束：**

- `action` 必须来自 `TaskToolRegistry` 白名单
- `params` 支持 `$step_id` 引用上步结果摘要字段
- `when` 为可选条件表达式，不满足则跳过
- `gate` 见 §2.4

### 2.2 Task（扩展现有模型）

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | str | UUID |
| `org_id` | str | 组织 |
| `input` | str | 用户原始目标 |
| `phase` | str | `planning` \| `planned` \| `executing` \| `reflecting` \| `done` \| `error` \| `awaiting_approval` |
| `plan` | dict \| null | 结构化 Plan |
| `steps` | list[dict] | 执行步骤记录（action、args、result、status、skipped） |
| `checkpoints` | dict | 步骤 id → 结果摘要，供 `$sN` 引用 |
| `result` | str \| null | Reflect 报告（Markdown） |
| `error` | str \| null | 错误信息 |
| `created_at` / `completed_at` | str | ISO 时间 |

**兼容：** 旧 Task 无 `phase`/`plan` 时视为 legacy `agentic_loop` 任务（可选保留 fallback）。

### 2.3 Step 执行记录

```json
{
  "step_id": "s4",
  "action": "enqueue_candidates",
  "args": { "facts": "..." },
  "status": "done",
  "result_summary": { "created": 3, "skipped": 1 },
  "result_raw": "...",
  "started_at": "...",
  "completed_at": "..."
}
```

### 2.4 Gate 策略

| gate | 行为 |
|------|------|
| `auto` | 直接执行 |
| `auto_if_low_risk` | 查 `resolver.yaml` + 分类；decision/rule/entity 或存在 conflict 则暂停任务，状态 `awaiting_approval` |
| `human` | Plan 生成后整单待批（`POST .../tasks/{id}/approve` 后执行） |
| `step_human` | 执行到该步前暂停 |

Phase 1 默认：`compile_candidates` 使用 `auto_if_low_risk`（对齐档 1 运营策略）。

---

## 三、组件架构

```
memory_layer/knowledge_base/
├── models/
│   ├── task.py              # 扩展 Task
│   └── plan.py              # Plan, PlanStep dataclasses
├── core/
│   ├── agents/
│   │   ├── planner_agent.py    # Plan 生成
│   │   ├── reflect_agent.py    # 收尾报告
│   │   └── task_agent.py       # legacy 或删除
│   ├── execution/
│   │   ├── executor_engine.py  # 逐步执行 + gate + when
│   │   └── condition_eval.py   # when 表达式求值
│   ├── tools/
│   │   ├── task_toolkit.py     # ToolRegistry + TaskToolExecutor
│   │   └── kb_toolkit.py       # 现有 Wiki 工具（复用）
│   └── services/
│       └── task_service.py     # Plan → Execute → Reflect 编排
├── settings/
│   └── task_tools.yaml         # 可用 action 清单（给 Planner）
├── prompts/prompts.yaml        # agents.planner, agents.reflect
└── app/routers/tasks.py        # API 扩展
```

### 3.1 Planner Agent

**输入：**

- 用户目标 `input`
- `task_tools.yaml` 能力清单（action 名、描述、params schema）
- 轻量 `get_org_stats` 快照（pending/approved/conflict 数量）

**输出：**

- 严格 JSON Plan（`parse_json` + schema 校验）
- 校验失败最多重试 1 次

**不做：** 不调用工具、不读 Wiki 全文（避免 Planner 过重）。

### 3.2 Executor Engine

**流程：**

1. 遍历 `plan.steps`
2. 求值 `when`；不满足 → 标记 `skipped`
3. 检查 `gate`；需人工 → 更新 `phase=awaiting_approval`，保存 `pending_step_id`
4. 解析 `params` 中的 `$sN` 引用
5. 调用 `TaskToolExecutor.execute(action, params)`
6. 写入 `steps` + `checkpoints[step_id]`
7. 单步失败：记录 error，根据配置 continue 或 abort

**不做：** 不让 LLM 在 Execute 阶段自由选 tool（防幻觉）。

### 3.3 Reflect Agent

**输入：**

- 原始目标 + Plan + 全部 step 结果 + checkpoints

**输出：**

- Markdown 报告：做了什么、沉淀了什么、哪些需人工、是否满足 success_criteria
- 可选：调用 L1 式 `extract_from_turn` 将任务摘要写入 memories（Phase 2）

### 3.4 Task Tool Registry（Phase 1）

| action | 域 | 底层 |
|--------|-----|------|
| `get_org_stats` | meta | candidate_stats + memory count |
| `search_memories` | memory | MemoryRegistry.list_active + 过滤 |
| `list_sessions` | memory | ChatRegistry.list_sessions + since 过滤 |
| `read_session` | memory | ChatRegistry.get_history |
| `search_wiki` | knowledge | WikiToolExecutor |
| `read_page` | knowledge | WikiToolExecutor |
| `list_entities` | knowledge | WikiToolExecutor |
| `extract_facts` | extract | LLM 子调用，输入 sources → facts[] |
| `enqueue_candidates` | candidate | CandidateRegistry.create |
| `resolve_candidates` | candidate | candidate_service.resolve_pending_candidates |
| `compile_candidates` | candidate | candidate_service.compile_approved_candidates |

---

## 四、API 设计

### 现有扩展

```
POST   /api/v1/orgs/{org_id}/tasks
       Body: { "input": "...", "auto_run": true }
       → 创建任务，后台跑 Plan → Execute → Reflect

GET    /api/v1/orgs/{org_id}/tasks/{task_id}
       → 含 plan, phase, steps, result

POST   /api/v1/orgs/{org_id}/tasks/{task_id}/approve
       Body: { "from_step": "s6" }  # 可选，从某步继续
       → awaiting_approval → 继续执行

POST   /api/v1/orgs/{org_id}/tasks/{task_id}/cancel
       → 取消运行中任务
```

### 任务生命周期

```
pending → planning → planned → executing → reflecting → done
                              ↘ awaiting_approval ↗
                              ↘ error
```

---

## 五、UI 设计（Agent 任务页）

1. **提交区**：文案改为「描述你想完成的目标」；示例改为「帮我整理本周项目决策进 Wiki」
2. **Plan 卡片**：`phase=planned` 时展示步骤列表 + 每步 reason；`awaiting_approval` 显示「批准继续」
3. **执行步骤**：按 step_id 展示 action 中文标签、状态（done/skipped/error/running）
4. **Reflect 报告**：`phase=done` 时展示 Markdown 报告，含 Wiki 变更链接
5. **冲突提示**：报告内 conflict 条目链到 `/human-review`

---

## 六、配置与治理

### settings/task_tools.yaml

声明 Planner 可见的 action 列表与参数 schema（与 Executor 注册表同步）。

### settings/task_gates.yaml（可选 Phase 1 硬编码）

```yaml
default_tier: 1
compile_gate: auto_if_low_risk
high_risk_categories: [decision, rule, entity]
```

与 `6-自动与人工审核分界线.md` 档 1 对齐：compile 遇高风险类暂停。

---

## 七、端到端验收场景

**用户输入：** 「帮我整理本周项目决策进 Wiki」

**期望：**

1. 10s 内出现 Plan（6～7 步）
2. 自动执行（或档 1 在 compile 前暂停）
3. 完成报告列出：检索了多少记忆/会话、新增候选数、编译 Wiki 路径、待人工项
4. `conflict` 条目可在人工审核页看到

---

## 八、后续扩展（不在 Phase 1）

- Chat 内「升级为任务」按钮
- 预置 Plan 模板（替代 cron 自动化）
- Shell / HTTP tools
- 子 Agent 并行（Research + Executor）
- Reflect 自动写入 memories
- Rust kernel 侧 planner.rs 与 Python 计划格式对齐

---

## 九、修订记录

| 日期 | 说明 |
|------|------|
| 2026-06-09 | 初稿：用户确认 Plan → Execute → Reflect 架构 |
