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
main.py 和 config.py 会加载 webui/.env（含远程 PG 配置）
启动 FastAPI 时需能读到 DB 环境变量：

uvicorn main:app --reload --port 8006