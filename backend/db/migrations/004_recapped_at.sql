-- L2 会话复盘去重：记录上次成功复盘时间，batch 跳过无新消息的会话

ALTER TABLE chat_sessions
    ADD COLUMN IF NOT EXISTS recapped_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_chat_sessions_recap_idle
    ON chat_sessions (org_id, user_id, updated_at ASC)
    WHERE status = 'active'
      AND (recapped_at IS NULL OR updated_at > recapped_at);
