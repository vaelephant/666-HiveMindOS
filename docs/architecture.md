# HiveMindOS 技术架构文档

> 企业AI执行知识系统 — 把企业原始资料编译成持续成长的知识网络

---

## 一、产品定位

HiveMindOS 不是普通 RAG 问答系统，而是「企业知识编译系统」。

**传统 RAG：**
```
用户问 → 临时搜索文档 → LLM 回答
```

**HiveMindOS：**
```
资料持续进入 → AI 编译理解 → 形成长期知识网络 → AI 直接基于知识工作
```

核心差异：**知识是持续维护的，不是每次临时检索的。**

---

## 二、企业知识四层结构

| 层级 | 内容 | 示例 |
|------|------|------|
| 第一层：静态知识 | 文档类资料 | PDF、Word、PPT、Excel、制度、产品资料 |
| 第二层：业务数据 | 系统数据 | CRM、订单、库存、客户数据、财务数据 |
| 第三层：流程知识 | 企业经验 | 客户跟进流程、报价审批、售后处理 |
| 第四层：执行能力 | AI 行动力 | 发企业微信、操作后台、生成合同、查数据库 |

**MVP 聚焦：销售型企业场景（客户/合同/报价/销售流程）**

---

## 三、系统总体架构

```
企业原始资料（Raw Sources）
        ↓
Knowledge Compiler（知识编译器）  ← 核心价值所在
        ↓
企业 Markdown Wiki（结构化知识）
        ↓
Memory Graph（实体关系图谱）
        ↓
Agent 层（ingest / query / lint）
        ↓
Workflow Execution（执行能力）
        ↓
企业微信 / 邮件 / CRM / 数据库
```

### Karpathy 三层模型

| 层 | 名称 | 内容 |
|----|------|------|
| Layer 1 | Raw Sources | 原始资料，永不修改（类 Git 仓库） |
| Layer 2 | Wiki | AI 理解后的世界：摘要、实体、关系、结论 |
| Layer 3 | Schema | AI 认知规则：如何组织、命名、更新、引用知识 |

---

## 四、关键架构决策

| 决策点 | 选择 | 原因 |
|--------|------|------|
| 目标客群 | 销售型企业 | 场景清晰，CRM/合同/客户需求明确 |
| 多租户隔离 | 文件路径隔离 `wiki/{org_id}/` | 轻量，部署快，初期完全够用 |
| Ingest 模式 | 同步处理（≤20MB） | 省掉队列复杂度，Phase 1 够用 |
| 第一个执行 Tool | 企业微信 | 官方 API 完整，文档清晰 |
| Agent 框架 | Claude API 原生 tool use | 不引 LangChain，debug 友好，成本可控 |
| Wiki 存储 | 本地文件系统 + Git | 版本历史天然解决，可回滚 |
| 知识图谱起步 | SQLite + JSON | 不上 Neo4j，规模化后再迁移 |
| 向量检索 | 阶段2引入 chromadb | 阶段1不做，Markdown 直读足够 |

---

## 五、核心模块详解

### 5.1 Raw Sources Layer

- 原始文件永不修改
- 用 content-hash 做去重和增量检测
- 支持格式：PDF、Word、PPT、Excel、邮件、会议记录、网页、数据库导出、聊天记录

```python
class RawSource:
    id: str
    org_id: str
    filename: str
    content_hash: str          # SHA256，用于增量检测
    source_type: str           # pdf / word / excel / crm / email / ...
    created_at: datetime
    metadata: dict
```

### 5.2 Knowledge Compiler（最核心）

不是简单 embedding，而是 AI 主动理解资料，提取结构化知识。

**增量处理流程：**
```
新文件进来
↓
计算 content-hash
↓
对比已有 hash → 未变化则跳过
↓
有变化 → AI 提取新知识（实体/流程/规则/关系）
↓
diff 旧 Wiki 页面 → 只更新变化部分
↓
更新 Memory Graph
```

**提取内容：**

| 提取类型 | 示例 |
|----------|------|
| 实体提取 | 客户、销售、报价、审批、合同 |
| 流程提取 | 客户咨询→销售跟进→报价→审批→签约 |
| 规则提取 | "超过10万需总监审批" |
| 关系建立 | 销售 ↔ 客户 ↔ 合同 ↔ 财务 |

**自动生成/更新 Wiki 页面：**
```
《销售流程.pdf》上传后 →
  wiki/{org_id}/workflows/sales_process.md
  wiki/{org_id}/glossary/approval_rules.md
  wiki/{org_id}/entities/sales_team.md
```

### 5.3 Markdown Wiki

AI-native 存储，LLM 天然擅长读写 Markdown。

**目录结构：**
```
wiki/
└── {org_id}/
    ├── index.md           # 知识图谱入口
    ├── customers/         # 客户档案
    ├── products/          # 产品资料
    ├── workflows/         # 流程文档
    ├── reports/           # 分析报告
    ├── glossary/          # 术语与规则
    ├── decisions/         # 历史决策
    └── entities/          # 实体信息
```

每个 org 的 wiki 目录用 Git 管理，自动追踪知识变更历史。

### 5.4 Memory Graph

实体关系图谱，让 AI 真正「理解企业」而不是「搜索资料」。

**示例：**
```
客户A ↔ 合同#001 ↔ 产品B ↔ 售后工单 ↔ 财务风险 ↔ 销售负责人张三
```

**数据模型：**
```python
class Entity:
    id: str
    org_id: str
    name: str
    entity_type: str       # person / product / process / rule / customer / contract
    wiki_path: str         # 对应 wiki 页面路径
    attributes: dict
    updated_at: datetime

class Relation:
    id: str
    org_id: str
    source_entity_id: str
    target_entity_id: str
    relation_type: str     # owns / involves / requires / triggers / ...
    weight: float
    metadata: dict
```

**存储：** 阶段3用 SQLite，规模化后迁 Neo4j。

### 5.5 Agent 系统

三个核心 Agent，均基于 Claude API 原生 tool use：

**ingest_agent.py**
```
职责：读取新资料 → 提取知识 → 更新 Wiki + Graph
触发：文件上传后同步调用
```

**query_agent.py**
```
职责：读取 Wiki → 综合回答 → 生成新分析 → 回写 Wiki
触发：用户查询时调用
特点：每次查询都可能丰富知识库（知识复利）
```

**lint_agent.py**
```
职责：巡检知识质量
  - 检测矛盾信息
  - 标记过时内容
  - 找孤立页面（无引用）
  - 补全缺失概念
触发：定期运行（如每日）或手动触发
```

### 5.6 Workflow Execution

Phase 4 实现，第一个打通企业微信。

```python
# Tool 定义示例
tools = [
    {
        "name": "send_wechat_work_message",
        "description": "发送企业微信消息给指定用户或群",
        "input_schema": {
            "type": "object",
            "properties": {
                "to_user": {"type": "string"},
                "content": {"type": "string"},
                "msg_type": {"type": "string", "enum": ["text", "markdown"]}
            }
        }
    }
]
```

---

## 六、API 设计

```
# Ingest
POST   /api/v1/orgs/{org_id}/ingest              # 上传资料（同步，≤20MB）

# Wiki
GET    /api/v1/orgs/{org_id}/wiki                # 浏览 wiki 目录
GET    /api/v1/orgs/{org_id}/wiki/{path}         # 读取 wiki 页面

# Query
POST   /api/v1/orgs/{org_id}/query               # 知识问答

# Graph
GET    /api/v1/orgs/{org_id}/graph/entities      # 实体列表
GET    /api/v1/orgs/{org_id}/graph/relations     # 关系查询
GET    /api/v1/orgs/{org_id}/graph/entity/{id}   # 实体详情

# Execute（Phase 4）
POST   /api/v1/orgs/{org_id}/execute             # 执行任务

# Admin
GET    /api/v1/orgs/{org_id}/sources             # 原始资料列表
POST   /api/v1/orgs/{org_id}/lint                # 触发知识巡检
```

---

## 七、项目目录结构

```
HiveMindOS/
├── api/
│   ├── main.py
│   └── routers/
│       ├── ingest.py
│       ├── wiki.py
│       ├── query.py
│       ├── graph.py
│       └── execute.py
├── core/
│   ├── compiler/
│   │   ├── knowledge_compiler.py   # 主入口
│   │   ├── entity_extractor.py
│   │   ├── flow_extractor.py
│   │   └── rule_extractor.py
│   ├── agents/
│   │   ├── ingest_agent.py
│   │   ├── query_agent.py
│   │   └── lint_agent.py
│   ├── wiki/
│   │   ├── wiki_manager.py         # 文件读写、目录管理
│   │   └── markdown_builder.py     # Markdown 生成
│   └── graph/
│       ├── memory_graph.py         # 图结构 CRUD
│       └── graph_query.py          # 关系查询
├── models/
│   ├── source.py
│   ├── entity.py
│   ├── relation.py
│   └── job.py
├── storage/
│   ├── raw/                        # 原始文件（只读）
│   └── wiki/                       # Markdown Wiki（Git 管理）
├── tools/
│   └── wechat_work.py              # 企业微信 Tool（Phase 4）
├── docs/
│   └── architecture.md             # 本文档
├── tests/
├── requirements.txt
└── README.md
```

---

## 八、技术选型汇总

| 模块 | 技术 | 备注 |
|------|------|------|
| 语言 | Python 3.11+ | |
| LLM 主力 | claude-opus-4-7 | 复杂理解/编译任务 |
| LLM 快速 | claude-sonnet-4-6 | 问答/简单提取 |
| Agent 框架 | Claude API 原生 tool use | 不引 LangChain |
| API 框架 | FastAPI | |
| Wiki 存储 | 本地文件系统 + Git | |
| 图数据库 | SQLite（→ Neo4j） | 规模化后迁移 |
| 向量检索 | chromadb（Phase 2 引入） | |
| 文件解析 | pypdf2, python-docx, openpyxl | |
| 企业微信 | 企业微信官方 API | Phase 4 |

---

## 九、开发阶段规划

### Phase 1 — Markdown Wiki（MVP）

**目标：** 上传销售文档 → AI 编译 → 可问答

- [ ] FastAPI 项目骨架
- [ ] 文件上传接口（同步，≤20MB）
- [ ] 文档解析（PDF/Word/Excel）
- [ ] ingest_agent：提取知识 → 生成 Wiki Markdown
- [ ] Wiki 文件管理（读写、目录结构）
- [ ] query_agent：基于 Wiki 回答问题
- [ ] 多租户文件路径隔离

**验收标准：**
上传《销售流程.pdf》，30秒内生成结构化 Wiki 页面，能正确回答"报价超过多少需要审批？"

---

### Phase 2 — Knowledge Compiler

**目标：** 结构化提取，Wiki 持续更新

- [ ] 实体提取 pipeline
- [ ] 流程提取（有向图结构）
- [ ] 规则提取
- [ ] 实体关系建立
- [ ] Wiki 增量更新 + 冲突检测
- [ ] lint_agent 知识质量巡检
- [ ] chromadb 向量检索

---

### Phase 3 — Memory Graph

**目标：** 实体关系图谱，AI 理解企业

- [ ] SQLite 图结构设计
- [ ] Entity / Relation CRUD
- [ ] 关系查询 API
- [ ] 知识复利机制（查询结果回写 Graph）
- [ ] 图谱可视化（可选）

---

### Phase 4 — Workflow Execution

**目标：** AI 能真正执行任务

- [ ] 企业微信 Tool 接入
- [ ] Tool 调用框架
- [ ] 多步骤 Workflow 编排
- [ ] 执行日志与审计

---

## 十、核心设计原则

1. **原始资料永不修改** — Raw Sources 只追加，不删改
2. **知识编译增量更新** — content-hash 检测，避免重复处理
3. **Wiki 是唯一真相源** — Agent 基于 Wiki 工作，不直接查原始文件
4. **每次交互都反哺知识** — query_agent 的分析结果回写 Wiki，知识复利
5. **先跑通，后扩展** — SQLite 够用就不上 Neo4j，文件系统够用就不上向量库
