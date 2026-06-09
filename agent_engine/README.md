# Agent Engine（自主任务引擎）

用户提出业务目标 → 规划（含规划委员会）→ 执行 → 逐步反思 → 交付物与复盘。

> 全仓库目录地图与维护约定：[项目文档/0-程序目录结构.md](../项目文档/0-程序目录结构.md)

与 `memory_layer/knowledge_base`（知识沉淀：Wiki / 智慧 / 候选池）解耦；执行时通过 Tool 调用 KB 能力。

## 目录

| 路径 | 职责 |
|------|------|
| `settings/` | 委员会角色、工具白名单、gate、rubrics（**非**记忆层配置） |
| `agents/` | Planner、PlanningCommittee、StepReflect、FinalReflect、Replan |
| `execution/` | Orchestrator、Executor、条件与 gate 求值 |
| `services/` | `task_service` 生命周期、`experience_service` 经验召回 |
| `models/` | Plan、Task、Reflection |
| `registry/` | tasks.db、经验 SQLite |
| `tools/` | `task_toolkit`（封装 KB 工具）、`web_tools` |
| `domain/` | committee_config、rubric、deliverable、task_present |

## 配置

| 文件 | 说明 |
|------|------|
| `settings/planning_committee.yaml` | 规划委员会角色与触发来源 |
| `settings/task_tools.yaml` | Planner 可见 action |
| `settings/task_gates.yaml` | 重试上限、人工门 |
| `settings/rubrics/*.yaml` | 任务评分标准 |

Prompt 模板仍在 `memory_layer/knowledge_base/prompts/prompts.yaml`（`agents.planning_*` / `agents.final_reflect` 等）。

## API 入口

`memory_layer/knowledge_base/app/routers/tasks.py` → `agent_engine.services.task_service`
