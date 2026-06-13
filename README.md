# HiveMindOS

个人AI操作系统。把企业原始资料编译成持续成长的知识网络，让 AI 成为真正能执行任务的企业员工。

产品能力说明见 [`项目文档/`](项目文档/)（含 [Org Playbook 组织 AI 守则](项目文档/10-Org-Playbook.md)、[智慧进化](项目文档/4-智慧进化.md) 等）。

---

## 系统架构

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

---

## 当前开发：HiveMindOS 执行引擎

> `knowledge_base/` — 后端服务模块（Chat、自主任务、知识沉淀）

详细文档见 → [knowledge_base/README.md](knowledge_base/README.md)

---

## 项目结构

```
HiveMindOS/
├── server/                   # FastAPI HTTP 层（:8006）
├── agent_engine/             # 自主任务引擎
├── knowledge_base/           # 知识沉淀（Wiki / Chat / 候选池）
├── memory_layer/             # 记忆子系统（逐步从 KB 抽离）
├── integrations/             # 第三方通道（企微等）
├── model_layer/              # LLM 统一调用层
├── webui/                    # Next.js 前端
├── tool_layer/               # 原子工具集合（预留）
├── workflow_layer/           # 流程编排（预留）
├── agent_layer/              # AI Agent（预留）
├── execution_layer/          # 执行与权限（预留）
├── audit_layer/              # 审计日志（预留）
├── human_layer/              # 人类控制（预留）
└── docs/                     # 架构文档
```

---

## 快速开始

```bash
cp .env.example .env        # 根目录 .env，填入 ANTHROPIC_API_KEY
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8006
```

API 文档：http://localhost:8006/docs
