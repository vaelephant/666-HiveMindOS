# Org Playbook — 组织 AI 使用说明书

> 面向产品说明、对内培训与对外宣传。技术实现见文末「附录」。

---

## 一句话（对外宣传）

**Playbook 是 HiveMind 的「组织人格」：让 AI 按你们公司的规矩、语气和边界说话，而不是像通用 ChatGPT 那样千人一面。**

---

## 它是什么？（通俗版）

Playbook = **公司给 AI 写的「使用说明书 + 说话规矩」**。

每次员工在 **Web Chat** 或 **企业微信** 里发起新对话时，系统会把 Playbook **读一遍、定下来**，告诉 AI：

- 我们是谁、做什么业务  
- 用什么语气（专业 / 简洁 / 是否适合企微短回复）  
- 什么能答、什么不能瞎编  
- 哪些操作必须提醒「需要人工确认」  

可以把它类比为：

| 类比 | 含义 |
|------|------|
| 新员工入职手册 | 先知道公司怎么做事，再开始接客户 |
| 品牌语气指南 | 对外说法统一，不像临时找的外包客服 |
| 岗位红线 | 报价、对外发送、改 Wiki 等要有审批意识 |

业界类似概念：Hermes Agent 的 `SOUL.md` / `AGENTS.md`；HiveMind 里统一叫 **Org Playbook**。

---

## 它解决什么问题？

| 没有 Playbook | 有 Playbook |
|---------------|-------------|
| 语气像通用大模型 | 像「懂业务的同事」 |
| 不确定的事也说得像真的一样 | 明确区分「已知 / 不确定 / 需核实」 |
| 企微里容易长篇大论 | 可按组织要求控制结构和长度 |
| 每个员工各问各的，标准不一 | **同一 org 下全员同一套顶层规则** |

---

## 和「智慧进化」有什么区别？

两者配合使用，不要混为一谈：

| | **Org Playbook** | **智慧进化（memories）** |
|---|------------------|---------------------------|
| **谁写** | 管理员 / 团队在 Web UI 主动编辑 | 从日常对话中 **自动提炼** |
| **内容** | 公司规矩、语气、禁忌、流程原则 | 具体项目、个人偏好、历史决策 |
| **例子** | 「对外报价必须人工确认」 | 「王总偏好表格对比竞品」 |
| **变化频率** | 你保存后才变 | 聊多了会自动增减、合并 |
| **在对话里** | 会话 **开始时冻结**，整段对话一致 | 常驻高价值块 + 按问题 **动态召回** |

**记忆口诀：Playbook 定规矩，智慧记细节。**

还有第三层 **企业 Wiki**（上传资料编译），负责正式文档与流程；Playbook 不负责存大段知识，只负责 **怎么答**。

---

## 「会话开始时冻结」是什么意思？

用户 **新开一条 Chat 或企微对话** 时：

1. 系统读取当前 org 的 Playbook（及少量常驻智慧）  
2. 组装成固定上下文块，**在本会话内不再改动**  
3. 之后每一轮提问都在这套「底色」上回答  

**好处：**

- 整段对话风格一致，不会前后矛盾  
- 有利于控制 token 与模型前缀稳定性  

**注意：** 在 Playbook 页点 **保存** 后，**下一条新会话** 才生效；正在聊的那条不会中途变脸。

---

## 在哪里配置？

| 入口 | 路径 |
|------|------|
| Web UI | **集成 → Playbook**（`/integrations/playbook`） |
| 服务端文件（可选） | `{STORAGE_ROOT}/orgs/{org_id}/playbook.md` |

- 未自定义时：使用 `memory_layer/knowledge_base/settings/playbook.yaml` 中的 **系统默认** 模板  
- 保存一次后即变为 **组织自定义**，按 org 隔离（与账户页的 `数据空间 org` 一致）  
- **Web Chat 与企微共用同一份 Playbook**

演示样例灌入：

```bash
python scripts/seed_demo_ui_samples.py --org <你的orgId> --user <你的userId>
```

---

## 对外宣传可用的三段话

**30 秒版**  
HiveMind 不只会聊天。Org Playbook 让每家客户拥有自己的 AI「人格」：说什么、怎么说、什么不能乱说，一次配置，全员 Chat 和企微统一生效。

**1 分钟版**  
通用大模型不知道你的公司。Playbook 是管理员在 HiveMind 里维护的组织级 AI 守则——业务边界、语气、合规提醒——在新对话开始时自动注入。它和自动沉淀的「智慧进化」分工明确：Playbook 定顶层规矩，智慧记项目与偏好，Wiki 存正式知识。三者叠加，AI 才像企业里的人，而不是互联网上的陌生人。

**差异化要点（对客户 / 投资人）**  
- **多租户原生**：每个 org 独立 Playbook，SaaS 可售  
- **全通道一致**：Web + 企微同一套组织上下文  
- **可审计可运营**：Markdown 可读可改，不藏在黑盒 prompt 里  
- **与 Hermes 等 Agent 产品同思路，但嵌入企业知识库与审批体系**

---

## 和相关能力的关系（产品地图）

```
Org Playbook        ← 组织规矩、语气（人工维护，会话冻结）
     +
常驻智慧块          ← 高价值 preference / project（会话冻结）
     +
动态智慧召回        ← 按问题语义检索（每轮变化）
     +
企业 Wiki / 图谱    ← 正式知识与流程
     +
Agent Skills        ← 高分任务沉淀的可复用「做法」（见工具箱）
```

---

## 附录：技术说明（研发）

### 注入位置

`memory_layer/knowledge_base/core/services/context_builder.py`

- `ensure_session_pinned_context()`：会话首轮写入 `chat_sessions.pinned_context`  
- Playbook 与常驻智慧一并进入 pinned 块  
- 动态召回、历史会话搜索为独立层，见 `settings/recall.yaml`

### API

| 方法 | 路径 |
|------|------|
| GET | `/api/v1/orgs/{org_id}/playbook` |
| PUT | `/api/v1/orgs/{org_id}/playbook` |
| DELETE | `/api/v1/orgs/{org_id}/playbook`（恢复系统默认） |

BFF：`/api/kb/{orgId}/playbook`

### 默认配置

`memory_layer/knowledge_base/settings/playbook.yaml`

### 存储路径

由环境变量 `STORAGE_ROOT` 决定（见 `.env`）。组织覆盖文件：

```
{STORAGE_ROOT}/orgs/{org_id}/playbook.md
```

仓库内演示模板（seed 脚本从此复制到运行时目录）：

```
memory_layer/knowledge_base/storage/orgs/demo/playbook.md
```

### 相关文档

- [4-智慧进化.md](./4-智慧进化.md) — L1/L2 记忆提炼  
- [3-chat 架构.md](./3-chat%20架构.md) — Chat 管线  
- 企微集成 — `docs/plans/2026-06-11-wechat-work-integration-design.md`
