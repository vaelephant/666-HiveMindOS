-- WeChat Work (企业微信) integration: channel-scoped chat sessions + org config + user bindings

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

INSERT INTO schema_migrations (version) VALUES ('007_wechat_work')
ON CONFLICT (version) DO NOTHING;
