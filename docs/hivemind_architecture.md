# HiveMindOS 系统功能模块规范

> 个人AI操作系统 — 八层架构

---

## 系统总览

```
Human Layer          ← 人类控制、审批、反馈
     ↕
Audit Layer          ← 全链路日志、成本、合规
     ↕
Agent Layer          ← 各类 AI Agent 协作
     ↕
Workflow Layer       ← 多步骤流程编排
     ↕
Execution Layer      ← 真实动作执行
     ↕
Tool Layer           ← 工具能力集合
     ↕
Memory Layer         ← 知识与记忆系统
     ↕
Model Layer          ← LLM 基础能力
```

各层单向依赖：上层调用下层，下层不感知上层。

---

## 一、Model Layer（模型层）

**职责：** 统一管理所有 LLM 能力，屏蔽底层模型差异。

| 模块 | 职责 |
|------|------|
| `client.py` | provider-agnostic 调用（Claude / OpenAI 切换） |
| model_router | 根据任务类型自动选合适模型 |
| prompt_manager | Prompt 模板管理、版本控制 |
| token_budget | Token 用量统计、预算控制 |
| cache_manager | Prompt Cache 管理 |

---

## 二、Memory Layer（记忆层）

**职责：** 管理 AI 的所有记忆形式。

| 类型 | 时效 | 内容 |
|------|------|------|
| Working Memory | 单次对话 | 当前任务上下文 |
| Episodic Memory | 中期 | 历史对话、历史决策 |
| Enterprise Knowledge | 永久 | 企业文档、流程、规则 ← **当前开发重点** |

### knowledge_base 子结构

```
knowledge_base/
├── app/                    # FastAPI HTTP 层
│   └── routers/
│       ├── ingest.py       # POST /orgs/{org_id}/ingest
│       ├── query.py        # POST /orgs/{org_id}/query
│       └── wiki.py         # GET  /orgs/{org_id}/wiki
├── core/
│   ├── compiler/           # 知识编译
│   │   ├── entity_extractor.py
│   │   ├── workflow_extractor.py
│   │   └── markdown_writer.py
│   ├── agents/             # 三个核心 Agent
│   │   ├── ingest_agent.py
│   │   ├── query_agent.py
│   │   └── lint_agent.py
│   ├── wiki/               # Markdown 文件管理
│   └── graph/              # SQLite 实体图谱
├── models/                 # 数据模型
├── storage/                # 运行时数据（不进 Git）
│   ├── raw/                # 原始文件（永不修改）
│   ├── wiki/               # Markdown Wiki
│   └── graph/              # SQLite 图谱
└── sdk/
    └── knowledge_base.py   # 对其他层的统一接口
```

---

## 三、Tool Layer（工具层）

**职责：** 提供 AI 可调用的原子能力，每个 Tool 做一件事。

| 类别 | Tools |
|------|-------|
| 文件 | file_read, file_write, file_search |
| 网络 | web_search, web_fetch |
| 通信 | wechat_work_send, email_send |
| 数据 | sql_query, crm_read, crm_write, api_call |
| 文档 | doc_generate, contract_generate |

---

## 四、Workflow Layer（流程层）

**职责：** 编排多步骤业务流程，支持条件分支、人工审批、错误重试。

| 模块 | 职责 |
|------|------|
| workflow_engine | DAG 执行引擎 |
| approval_gate | 人工审批节点 |
| error_handler | 失败重试、降级 |
| templates | 预置销售场景流程模板 |

---

## 五、Agent Layer（智能体层）

| Agent | 职责 |
|-------|------|
| ingest_agent | 文件 → 编译知识 → 更新 Wiki |
| query_agent | Wiki → 推理回答 → 回写知识 |
| lint_agent | 知识质量巡检 |
| sales_agent | 销售场景：客户分析、报价辅助 |
| orchestrator | 分析意图、分配给合适 Agent |

---

## 六、Execution Layer（执行层）

**职责：** 所有真实世界操作的唯一出口。

```
Agent 发起 Tool 调用
    ↓
permission_checker（有权限？）
    ↓ Yes
human approval（需要审批？）
    ↓ Approved
action_executor 执行
    ↓
写入 Audit Layer
```

---

## 七、Audit Layer（审计层）

**职责：** 记录所有行为，不可篡改。

```json
{
  "event_id": "evt_xxx",
  "org_id": "acme",
  "agent": "sales_agent",
  "action": "wechat_work_send",
  "approved_by": "human",
  "tokens_used": 1240
}
```

---

## 八、Human Layer（人类层）

**职责：** 人类对 AI 系统的控制总开关。

```yaml
permissions:
  auto_allowed:       [web_search, file_read, crm_read]
  require_approval:   [wechat_work_send, crm_write, contract_generate]
  always_forbidden:   [delete_customer, modify_financial_records]
```

---

## 层间依赖

- 上层调下层，下层不感知上层
- 所有真实副作用经过 Execution Layer
- knowledge_base 对上层只暴露 SDK 接口

## 当前开发位置

```
Memory Layer → knowledge_base/  ← Phase 1 MVP
```
