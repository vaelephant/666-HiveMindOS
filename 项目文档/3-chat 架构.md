架构
Next.js Chat 页
    ↓ fetch
/api/kb/{orgId}/chat/...        ← Next.js 纯代理，不写库
    ↓
FastAPI /api/v1/orgs/{orgId}/chat/...
    ↓
chat_service（管线编排）
    ├─ ChatRegistry → PostgreSQL（chat_sessions / chat_messages）
    ├─ ChatAgent    → Wiki + Graph 检索
    └─ _extract_memories_stub()  ← 预留 Memory Extractor → memories → Qdrant
FastAPI 新增
端点	作用
GET .../chat/sessions
侧栏历史列表
GET .../chat/sessions/{id}
加载完整对话
DELETE .../chat/sessions/{id}
删除对话
POST .../chat
发送消息（{ message, session_id? }）
POST /chat 管线：

创建/复用 session
保存用户消息到 PG
从 PG 加载历史 → 调 ChatAgent
保存 assistant 回答（含 sources / follow_ups）
记忆提取 stub（待接 memories + Qdrant）
前端变更
移除 localStorage（chat-sessions.ts 已删）
历史列表、加载、删除、发送均走 /api/kb/... 代理
前端不再传 history，由 FastAPI 从数据库读取
配置



已完成
Chat / Agent / 知识管理 产品分层
聊天记录走 FastAPI → PostgreSQL
侧栏历史 + 加载优化 + hydration 修复
建议下一步：P1 Memory Extractor
这是从「能聊天的机器人」到「有记忆的企业系统」的关键一步。

用户发消息 → 保存 chat_messages
           → ChatAgent 回答
           → Memory Extractor（新增）
           → 写入 memories 表
           → 记录 memory_events 溯源
第一期范围（控制在一周内）：

只做 3 类：project、preference、decision
每轮对话后异步提取（不阻塞回答）
先写 PostgreSQL，不接 Qdrant
在 chat_service._extract_memories_stub 处接入
做完后的效果：

用户说「我在做 HiveMindOS」→ 自动记入 memories
下次问「我之前在做什么项目？」→ Context Builder 能召回（P2）
之后顺序
阶段	内容	依赖
P2
Context Builder — 回答时注入相关 memories + Wiki
P1 有数据
P3
Qdrant 语义检索
P1/P2
P4
流式输出（SSE）
独立，可并行
P5
Memory Lifecycle（更新/冲突/归档）
P1
P6
user_id 真实登录态
有账号系统时
我的建议
现在做 P1 Memory Extractor。

如果你同意，我可以从这三块开始：

MemoryExtractor Agent（输入一轮对话，输出 0~N 条 memory JSON）
MemoryRegistry（PostgreSQL CRUD，对接 memories 表）
在 chat_service 管线里异步调用
要开始做吗？还是你更想先做流式输出（P4）改善体验？