# HiveMindOS 执行引擎（知识沉淀层）

HiveMindOS 顶层包 — **Wiki / 智慧 / 候选池 / Chat** 知识沉淀，不是指挥中心。

自主任务引擎（Plan → Execute → Reflect）已迁至顶层包 **`agent_engine/`**，见 `agent_engine/README.md`。  
全仓库目录说明：[项目文档/0-程序目录结构.md](../../项目文档/0-程序目录结构.md)

不是普通 RAG 问答，而是把企业原始资料**编译**成持续成长的知识网络。

---

## 核心思路

**传统 RAG：**
```
用户问 → 临时搜索文档 → LLM 回答
```

**本系统：**
```
资料持续进入 → AI 编译理解 → 形成长期知识网络 → AI 直接基于知识工作
```

知识不是每次临时检索，而是持续维护、持续复利。

---

## 企业知识四层结构

| 层级 | 内容 | 示例 |
|------|------|------|
| 第一层：静态知识 | 文档类资料 | PDF、Word、PPT、Excel |
| 第二层：业务数据 | 系统数据 | CRM、订单、客户、财务 |
| 第三层：流程知识 | 企业经验 | 客户跟进、报价审批、售后 |
| 第四层：执行能力 | AI 行动力 | 发企微、生成合同、查数据库 |

**MVP 聚焦：** 销售型企业场景，覆盖第一层和第三层。

---

## 系统流程

```
原始文件上传
     ↓
IngestAgent（知识编译）
  ├── entity_extractor   → 提取实体（客户/销售/合同）
  ├── workflow_extractor → 提取流程与规则
  └── markdown_writer    → 生成结构化 Wiki 页面
     ↓
Wiki（Markdown 文件）+ Memory Graph（SQLite 实体图谱）
     ↓
QueryAgent（知识问答）
  ├── 关键词匹配相关 Wiki 页面
  ├── 拼装上下文
  └── LLM 综合回答
     ↓
LintAgent（定期巡检）
  ├── 空页面检测
  ├── 孤立页面检测
  └── AI 质量审查
```

---

## 目录结构

```
knowledge_base/
├── core/                       # 纯业务逻辑（不依赖 HTTP）
│   ├── compiler/
│   │   ├── entity_extractor.py     # 实体提取
│   │   ├── workflow_extractor.py   # 流程与规则提取
│   │   └── markdown_writer.py      # 生成 Markdown Wiki 页面
│   ├── pipelines/                  # LLM 处理工序（非自主 agent）
│   │   ├── ingest_agent.py         # 编排完整 ingest 流程
│   │   ├── query_agent.py          # 知识检索与问答
│   │   └── lint_agent.py           # 知识质量巡检
│   ├── wiki/
│   │   └── wiki_manager.py         # Markdown 文件读写管理
│   └── graph/
│       └── memory_graph.py         # SQLite 实体关系图谱
│
├── models/                     # 数据模型
│   ├── source.py               # RawSource
│   ├── entity.py               # Entity / Relation
│   └── job.py                  # CompileJob
│
├── storage/                    # 运行时数据（不进 Git）
│   ├── raw/{org_id}/           # 原始文件（永不修改）
│   ├── wiki/{org_id}/          # Markdown Wiki
│   └── graph/{org_id}/         # SQLite 图谱
│
├── sdk/
│   └── knowledge_base.py       # 对 HiveMindOS 其他层的统一接口
│
└── config.py                   # 环境变量与路径配置
```

HTTP 层（FastAPI）已迁至顶层 **`server/`**，见 [项目文档/0-程序目录结构.md](../../项目文档/0-程序目录结构.md)。

---

## 启动

```bash
# 项目根目录放 .env，后端代码在 backend/
cp .env.example .env            # 填入 ANTHROPIC_API_KEY
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8006
```

API 文档：http://localhost:8000/docs

---

## API 一览

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/orgs/{org_id}/ingest` | 上传文件，同步编译入库（≤20MB） |
| POST | `/api/v1/orgs/{org_id}/query` | 知识问答 |
| POST | `/api/v1/orgs/{org_id}/lint` | 触发知识质量巡检 |
| GET  | `/api/v1/orgs/{org_id}/wiki` | 浏览 Wiki 目录 |
| GET  | `/api/v1/orgs/{org_id}/wiki/{path}` | 读取 Wiki 页面 |
| GET  | `/api/v1/orgs/{org_id}/graph/entities` | 实体列表 |
| GET  | `/api/v1/orgs/{org_id}/graph/entity/{name}` | 实体详情与关联 |

---

## 使用示例

### 上传文件

```bash
curl -X POST http://localhost:8000/api/v1/orgs/acme/ingest \
  -F "file=@sales_process.pdf"
```

返回：
```json
{
  "file_id": "uuid",
  "filename": "sales_process.pdf",
  "entities_extracted": 8,
  "workflows_extracted": 3,
  "wiki_pages_created": 11,
  "pages": ["entities/客户.md", "workflows/销售流程.md", ...]
}
```

### 知识问答

```bash
curl -X POST http://localhost:8000/api/v1/orgs/acme/query \
  -H "Content-Type: application/json" \
  -d '{"question": "报价超过多少金额需要审批？"}'
```

返回：
```json
{
  "question": "报价超过多少金额需要审批？",
  "answer": "根据《报价审批规则》，超过10万元需要总监审批...",
  "source_pages": ["glossary/审批规则.md"]
}
```

### 其他 HiveMindOS 模块调用

```python
from knowledge_base.sdk.knowledge_base import KnowledgeBase

kb = KnowledgeBase(org_id="acme")

# 上传编译
kb.ingest("sales_process.pdf")

# 知识问答
result = kb.query("客户A现在什么状态？")

# 查询实体
entity = kb.get_entity("客户A")
neighbors = kb.get_neighbors("客户A")

# 知识巡检
report = kb.lint()
```

---

## Wiki 目录结构

编译后自动生成，按类型分类：

```
storage/wiki/{org_id}/
├── index.md            # 自动维护的知识库索引
├── entities/           # 实体档案（客户/销售/产品）
├── workflows/          # 流程文档（销售流程/报价审批）
├── glossary/           # 术语与规则
└── decisions/          # 历史决策（后续阶段）
```

---

## 多租户隔离

通过文件路径隔离，每个 org 数据完全独立：

```
storage/
├── raw/acme/       wiki/acme/       graph/acme/
├── raw/corp_b/     wiki/corp_b/     graph/corp_b/
```

---

## 技术选型

| 模块 | 技术 | 说明 |
|------|------|------|
| LLM | Claude API（claude-opus-4-7 / claude-sonnet-4-6） | 主力 / 快速任务 |
| Agent 框架 | Claude API 原生 tool use | 不引 LangChain |
| Wiki 存储 | 本地文件系统 Markdown | AI-native，可 Git 管理 |
| 图谱 | SQLite | 规模化后迁 Neo4j |
| 向量检索 | 暂不引入（Phase 2 加 chromadb） | Phase 1 关键词匹配够用 |
| API 框架 | FastAPI | |
| 文件解析 | pypdf2 / python-docx / openpyxl | |

---

## 开发阶段

| 阶段 | 目标 | 状态 |
|------|------|------|
| Phase 1 | Markdown Wiki：上传 → 编译 → 问答 | 骨架完成 |
| Phase 2 | Knowledge Compiler：结构化提取 + 增量更新 + chromadb | 待开发 |
| Phase 3 | Memory Graph：实体关系图谱 + 知识复利 | 待开发 |
| Phase 4 | Workflow Execution：企业微信聊天 + Agent 出站消息 | 聊天入站已接入（`integrations/wechat_work/`） |

---

## 设计原则

1. **原始文件永不修改** — `storage/raw/` 只追加
2. **增量编译** — content-hash 检测，避免重复处理
3. **Wiki 是唯一真相源** — Agent 基于 Wiki 工作，不查原始文件
4. **每次交互反哺知识** — 查询分析结果可回写 Wiki，形成知识复利
5. **先跑通再扩展** — SQLite 够用不上 Neo4j，关键词够用不上向量库
