# 企业微信聊天打通 — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Phase 1 — 员工在企业微信单聊应用里与 HiveMind 对话，消息走现有 ChatService + 记忆提取；每用户保持一个活跃企微会话。

**Architecture:** `integrations/wechat_work/` 封装 SDK/适配/webhook 逻辑；FastAPI 薄路由接收回调；`adapter` 查绑定 → `find_active_wechat_session` → `send_message` → `client` 回发。Web UI 仅配置页。

**Tech Stack:** Python 3.11+ / FastAPI / PostgreSQL / httpx / wechatpy（企微加解密）/ Next.js 16 BFF

**Design doc:** `docs/plans/2026-06-11-wechat-work-integration-design.md`

---

## Task 1: 数据库 Migration

**Files:**
- Create: `db/migrations/007_wechat_work.sql`
- Test: 手工 `psql` 或现有 migration 脚本

**Step 1: 写 migration**

```sql
-- db/migrations/007_wechat_work.sql

ALTER TABLE chat_sessions
  ADD COLUMN IF NOT EXISTS channel TEXT NOT NULL DEFAULT 'web'
    CHECK (channel IN ('web', 'wechat_work')),
  ADD COLUMN IF NOT EXISTS external_session_id TEXT;

CREATE INDEX IF NOT EXISTS idx_chat_sessions_channel
  ON chat_sessions (org_id, user_id, channel, updated_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_chat_sessions_wechat_active
  ON chat_sessions (org_id, user_id, channel, external_session_id)
  WHERE channel = 'wechat_work' AND status = 'active' AND external_session_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS wechat_work_org_config (
    org_id           TEXT PRIMARY KEY,
    corp_id          TEXT NOT NULL,
    agent_id         TEXT NOT NULL,
    secret           TEXT NOT NULL,
    token            TEXT NOT NULL,
    encoding_aes_key TEXT NOT NULL,
    enabled          BOOLEAN NOT NULL DEFAULT false,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS wechat_work_user_bindings (
    id               BIGSERIAL PRIMARY KEY,
    org_id           TEXT NOT NULL,
    platform_user_id TEXT NOT NULL,
    wechat_userid    TEXT NOT NULL,
    wechat_name      TEXT,
    bound_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (org_id, platform_user_id),
    UNIQUE (org_id, wechat_userid)
);

CREATE INDEX IF NOT EXISTS idx_wechat_bindings_org
  ON wechat_work_user_bindings (org_id);
```

**Step 2: 应用 migration**

```bash
cd /Users/yan/code/666-HiveMindOS
# 按项目现有方式执行，例如：
psql "$DATABASE_URL" -f db/migrations/007_wechat_work.sql
```

Expected: `ALTER TABLE`, `CREATE TABLE` 无报错

**Step 3: Commit**

```bash
git add db/migrations/007_wechat_work.sql
git commit -m "feat(db): add wechat work integration tables and chat channel column"
```

---

## Task 2: ChatRegistry 会话复用

**Files:**
- Modify: `knowledge_base/core/registry/chat_registry.py`
- Modify: `knowledge_base/models/chat.py`（可选加 `channel` 字段到 summary）
- Create: `integrations/tests/test_wechat_session.py`
- Modify: `knowledge_base/core/services/chat_service.py`（`create_session` 传 channel）

**Step 1: Write failing test**

```python
# integrations/tests/test_wechat_session.py
from unittest.mock import patch
from knowledge_base.core.registry.chat_registry import ChatRegistry

def test_find_active_wechat_session_returns_existing():
    reg = ChatRegistry()
    org, user, ext = "org1", "user1", "wx_zhangsan"
    with patch.object(reg, "_conn_execute") as mock:
        # 或用 test DB fixture — 优先用项目已有 postgres test 模式
        pass

def test_create_session_with_channel():
    reg = ChatRegistry()
    sid = reg.create_session("org1", "", user_id="user1", channel="wechat_work", external_session_id="wx_zhangsan")
    assert sid
    found = reg.find_active_session("org1", "user1", channel="wechat_work", external_session_id="wx_zhangsan")
    assert found == sid
```

**Step 2: Run — expect FAIL**

```bash
cd /Users/yan/code/666-HiveMindOS
python -m pytest integrations/tests/test_wechat_session.py -v
```

**Step 3: Implement `ChatRegistry` 扩展**

在 `chat_registry.py` 添加：

```python
def find_active_session(
    self,
    org_id: str,
    user_id: str,
    *,
    channel: str = "web",
    external_session_id: str | None = None,
) -> str | None:
    """返回匹配的 active session_id；企微通道用 external_session_id 定位。"""
    ...

def create_session(
    self,
    org_id: str,
    title: str,
    user_id: str = _DEFAULT_USER,
    *,
    channel: str = "web",
    external_session_id: str | None = None,
) -> str:
    # INSERT 时写入 channel, external_session_id
    ...
```

`chat_service.send_message` 中当 `session_id` 为空时，**不改动 web 路径**；企微由 adapter 先调 `find_active_session`，找不到再 `create_session`。

**Step 4: Run tests — expect PASS**

```bash
python -m pytest integrations/tests/test_wechat_session.py -v
```

**Step 5: Commit**

```bash
git add knowledge_base/core/registry/chat_registry.py \
        knowledge_base/core/services/chat_service.py \
        integrations/tests/test_wechat_session.py
git commit -m "feat(chat): support channel-scoped session lookup for wechat work"
```

---

## Task 3: integrations/wechat_work 包骨架 + config

**Files:**
- Create: `integrations/__init__.py`
- Create: `integrations/wechat_work/__init__.py`
- Create: `integrations/wechat_work/config.py`
- Modify: `requirements.txt`

**Step 1: 添加依赖**

```
wechatpy>=1.8.18
```

```bash
pip install wechatpy>=1.8.18
```

**Step 2: 实现 config.py**

```python
# integrations/wechat_work/config.py
from dataclasses import dataclass

@dataclass(frozen=True)
class WeChatWorkOrgConfig:
    org_id: str
    corp_id: str
    agent_id: str
    secret: str
    token: str
    encoding_aes_key: str
    enabled: bool

UNBOUND_REPLY = "请先在 HiveMind 平台完成企业微信账号绑定后再使用。"
UNSUPPORTED_MSG_REPLY = "暂不支持该消息类型，请发送文字消息。"
ERROR_REPLY = "处理失败，请稍后重试。"
```

**Step 3: Commit**

```bash
git add integrations/ requirements.txt
git commit -m "feat(integrations): scaffold wechat_work package and config"
```

---

## Task 4: registry.py（组织配置 + 用户绑定）

**Files:**
- Create: `integrations/wechat_work/registry.py`
- Create: `integrations/tests/test_wechat_registry.py`

**Step 1: Write failing tests**

```python
def test_save_and_load_org_config():
    ...

def test_resolve_platform_user_id():
    reg.bind_user("org1", "platform_u1", "wx_u1", "张三")
    assert reg.resolve_platform_user_id("org1", "wx_u1") == "platform_u1"
    assert reg.resolve_platform_user_id("org1", "unknown") is None
```

**Step 2: Run — expect FAIL**

```bash
python -m pytest integrations/tests/test_wechat_registry.py -v
```

**Step 3: Implement**

使用 `knowledge_base.core.db.postgres.pg_conn`，CRUD：
- `get_org_config(org_id) -> WeChatWorkOrgConfig | None`
- `upsert_org_config(...)`
- `bind_user` / `unbind_user` / `list_bindings`
- `resolve_platform_user_id(org_id, wechat_userid) -> str | None`

Secret MVP 明文存 DB；注释预留加密。

**Step 4: Run — expect PASS**

**Step 5: Commit**

```bash
git commit -m "feat(wechat): add org config and user binding registry"
```

---

## Task 5: client.py（Token + 发消息）

**Files:**
- Create: `integrations/wechat_work/client.py`
- Create: `integrations/tests/test_wechat_client.py`

**Step 1: Write failing test（mock httpx）**

```python
from unittest.mock import patch, MagicMock
from integrations.wechat_work.client import WeChatWorkClient

def test_get_access_token_caches():
    client = WeChatWorkClient("corp", "secret")
    with patch("httpx.get") as mock_get:
        mock_get.return_value = MagicMock(
            json=lambda: {"errcode": 0, "access_token": "tok123", "expires_in": 7200}
        )
        assert client.get_access_token() == "tok123"
        assert client.get_access_token() == "tok123"  # 第二次不请求
        assert mock_get.call_count == 1

def test_send_text_message():
    ...
```

**Step 2: Run — expect FAIL**

**Step 3: Implement**

```python
class WeChatWorkClient:
    TOKEN_URL = "https://qyapi.weixin.qq.com/cgi-bin/gettoken"
    SEND_URL = "https://qyapi.weixin.qq.com/cgi-bin/message/send"

    def get_access_token(self) -> str: ...
    def send_text(self, agent_id: int | str, to_user: str, content: str) -> None: ...
```

消息超 2048 字节时截断并加 `…`。

**Step 4: Run — expect PASS**

**Step 5: Commit**

```bash
git commit -m "feat(wechat): add API client with token cache and send message"
```

---

## Task 6: webhook_handler.py（验签 + 解密 + 分发）

**Files:**
- Create: `integrations/wechat_work/webhook_handler.py`
- Create: `integrations/tests/test_wechat_webhook_handler.py`

**Step 1: Write failing test**

使用企微官方文档中的验签 sample 向量（或 wechatpy 的 `WeChatCrypto`）：

```python
from integrations.wechat_work.webhook_handler import verify_url, parse_text_message

def test_verify_url_returns_echostr():
    ...

def test_parse_text_message_xml():
    event = parse_text_message(decrypted_xml)
    assert event.msg_type == "text"
    assert event.content == "你好"
    assert event.from_user == "zhangsan"
```

**Step 2: Run — expect FAIL**

**Step 3: Implement**

```python
@dataclass
class InboundEvent:
    msg_type: str
    from_user: str   # wechat userid
    content: str
    agent_id: str

def verify_url(msg_signature, timestamp, nonce, echostr, token, aes_key) -> str: ...
def decrypt_post_body(body, msg_signature, timestamp, nonce, token, aes_key) -> str: ...
def parse_text_message(xml: str) -> InboundEvent | None: ...
```

用 `wechatpy.enterprise.crypto.WeChatCrypto` 处理加解密。

**Step 4: Run — expect PASS**

**Step 5: Commit**

```bash
git commit -m "feat(wechat): add webhook verify, decrypt, and event parsing"
```

---

## Task 7: adapter.py（核心桥接）

**Files:**
- Create: `integrations/wechat_work/adapter.py`
- Create: `integrations/tests/test_wechat_adapter.py`

**Step 1: Write failing test**

```python
from unittest.mock import patch, MagicMock
from integrations.wechat_work.adapter import WeChatWorkAdapter

def test_unbound_user_gets_guide_message():
    adapter = WeChatWorkAdapter(...)
    with patch("integrations.wechat_work.registry.resolve_platform_user_id", return_value=None):
        reply = adapter.handle_inbound_text("org1", "wx_unknown", "你好")
    assert "绑定" in reply

def test_reuses_active_session():
    with patch.object(adapter._registry, "find_active_session", return_value="sess-1") as find_mock:
        with patch("knowledge_base.core.services.chat_service.send_message") as send_mock:
            send_mock.return_value = {"answer": "你好！", "session_id": "sess-1"}
            reply = adapter.handle_inbound_text("org1", "wx_u1", "你好")
    find_mock.assert_called_once_with("org1", "platform_u1", channel="wechat_work", external_session_id="wx_u1")
    send_mock.assert_called_once_with("org1", "你好", session_id="sess-1", user_id="platform_u1")
    assert reply == "你好！"
```

**Step 2: Run — expect FAIL**

**Step 3: Implement**

```python
class WeChatWorkAdapter:
    def handle_inbound_text(self, org_id: str, wechat_userid: str, text: str) -> str:
        platform_user = self._registry.resolve_platform_user_id(org_id, wechat_userid)
        if not platform_user:
            return UNBOUND_REPLY

        session_id = self._chat_registry.find_active_session(
            org_id, platform_user,
            channel="wechat_work",
            external_session_id=wechat_userid,
        )
        if not session_id:
            session_id = self._chat_registry.create_session(
                org_id, "", user_id=platform_user,
                channel="wechat_work",
                external_session_id=wechat_userid,
            )

        result = chat_service.send_message(org_id, text, session_id=session_id, user_id=platform_user)
        return result.get("answer") or ERROR_REPLY
```

出站回复由 router 层调 `client.send_text`（adapter 只返回文本，保持纯逻辑可测）。

**Step 4: Run — expect PASS**

**Step 5: Commit**

```bash
git commit -m "feat(wechat): add adapter bridging inbound messages to ChatService"
```

---

## Task 8: FastAPI Webhook 路由

**Files:**
- Create: `knowledge_base/app/routers/webhooks/__init__.py`
- Create: `knowledge_base/app/routers/webhooks/wechat_work.py`
- Modify: `knowledge_base/app/main.py`

**Step 1: 实现 router**

```python
# GET  /api/v1/webhooks/wechat-work/{org_id}  — URL 验证
# POST /api/v1/webhooks/wechat-work/{org_id}  — 消息回调
```

流程：
1. `get_org_config(org_id)` — 未启用返回 404
2. GET → `verify_url` → plain text echostr
3. POST → decrypt → `parse_text_message` → `adapter.handle_inbound_text` → `client.send_text` → 返回 `"success"` 或空串（企微要求）

**Step 2: 注册到 main.py**

```python
from server.routers.webhooks import wechat_work as webhooks_wechat_work
app.include_router(webhooks_wechat_work.router, prefix="/api/v1", tags=["webhooks"])
```

**Step 3: 手工验证 health 仍正常**

```bash
curl -s http://localhost:8006/health
```

Expected: `{"status":"ok",...}`

**Step 4: Commit**

```bash
git commit -m "feat(api): add wechat work webhook endpoints"
```

---

## Task 9: 管理 API（配置 + 绑定）

**Files:**
- Create: `knowledge_base/app/routers/integrations/__init__.py`
- Create: `knowledge_base/app/routers/integrations/wechat_work.py`
- Modify: `knowledge_base/app/main.py`

**Endpoints:**

```
GET    /api/v1/orgs/{org_id}/integrations/wechat-work
PUT    /api/v1/orgs/{org_id}/integrations/wechat-work
POST   /api/v1/orgs/{org_id}/integrations/wechat-work/test
GET    /api/v1/orgs/{org_id}/integrations/wechat-work/bindings
POST   /api/v1/orgs/{org_id}/integrations/wechat-work/bindings
DELETE /api/v1/orgs/{org_id}/integrations/wechat-work/bindings/{binding_id}
```

- GET 返回时 `secret` 脱敏为 `****`
- POST test：调 `client.get_access_token()` 验证凭证
- 复用现有 router 风格（参考 `chat.py` 的 org_id 路径参数）

**Commit:**

```bash
git commit -m "feat(api): add wechat work integration management endpoints"
```

---

## Task 10: Next.js BFF 代理

**Files:**
- Create: `webui/src/app/api/kb/[orgId]/integrations/wechat-work/route.ts`
- Create: `webui/src/app/api/kb/[orgId]/integrations/wechat-work/test/route.ts`
- Create: `webui/src/app/api/kb/[orgId]/integrations/wechat-work/bindings/route.ts`
- Create: `webui/src/app/api/kb/[orgId]/integrations/wechat-work/bindings/[bindingId]/route.ts`

**Pattern:** 复制 `webui/src/app/api/kb/[orgId]/chat/route.ts` 的 `kbBackendUrl` + `mergeUserIntoJsonBody` 模式。

```typescript
// GET/PUT → kbBackendUrl(orgId, '/integrations/wechat-work')
```

**Commit:**

```bash
git commit -m "feat(webui): add BFF routes for wechat work integration API"
```

---

## Task 11: Web UI 配置页

**Files:**
- Create: `webui/src/app/(platform)/integrations/wechat-work/page.tsx`
- Create: `webui/src/components/integrations/wechat-work-settings.tsx`（可选）
- Modify: `webui/src/config/navigation.ts`
- Modify: `webui/src/lib/kb-api.ts`（加 integration API 方法）

**UI 内容（MVP）：**
1. 表单：CorpID、AgentId、Secret、Token、EncodingAESKey、启用开关
2. 显示回调 URL：`{PUBLIC_API_BASE}/api/v1/webhooks/wechat-work/{orgId}`（供复制到企微后台）
3. 「测试连接」按钮
4. 用户绑定表：platform user id + wechat userid + 添加/删除

**导航：** 在 `PRIMARY_NAV` 的 `tools` 旁新增，或把 `tools` 改为带 children：

```typescript
{ navKey: 'integrations', label: '集成', href: '/integrations/wechat-work', icon: Plug, factory: 'hivemind' }
```

**Commit:**

```bash
git commit -m "feat(webui): add wechat work integration settings page"
```

---

## Task 12: 端到端联调清单

**不自动 commit — 手工验证**

1. 启动 KB 服务：`uvicorn server.main:app --port 8006`
2. ngrok：`ngrok http 8006` → 企微后台配置回调 URL
3. Web UI 填写凭证并启用
4. 添加绑定：`platform_user_id` = 当前登录用户，`wechat_userid` = 企微成员 ID
5. 企微发文字消息 → 收到 AI 回复
6. 再发一条 → 确认 **同一 session_id**（查 DB `chat_sessions` where `channel='wechat_work'`）
7. 确认 `chat_messages` 有记录，记忆提取 background task 无报错（查 logs）

```bash
psql "$DATABASE_URL" -c "
  SELECT id, channel, external_session_id, title, updated_at
  FROM chat_sessions WHERE channel = 'wechat_work' ORDER BY updated_at DESC LIMIT 5;
"
```

Expected: 同一 `wechat_userid` 仅一条 active 会话

---

## Task 13: 文档与环境变量

**Files:**
- Modify: `.env.example`（根目录，若存在）
- Modify: `knowledge_base/README.md`（加集成说明段落）

```env
# 可选开发兜底（生产用 DB 配置）
WECHAT_WORK_CORP_ID=
WECHAT_WORK_AGENT_ID=
WECHAT_WORK_SECRET=
WECHAT_WORK_TOKEN=
WECHAT_WORK_ENCODING_AES_KEY=
```

**Commit:**

```bash
git commit -m "docs: document wechat work integration setup"
```

---

## 执行顺序依赖

```
Task 1 (DB)
  → Task 2 (ChatRegistry)
  → Task 3-4 (package + registry)
  → Task 5-7 (client / webhook / adapter) 可并行
  → Task 8-9 (routers)
  → Task 10-11 (webui)
  → Task 12 (E2E)
  → Task 13 (docs)
```

## 刻意不做（YAGNI）

- OAuth 自动绑定
- 群聊 @机器人
- Agent `wechat_work_send` Tool（Phase 3）
- Secret 加密存储
- `hivemind-chat` channel 筛选 UI
