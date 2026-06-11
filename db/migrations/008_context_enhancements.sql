-- Session pinned context + chat message search index
-- pinned_context: frozen at session start (Hermes-style MEMORY/USER block)

BEGIN;

ALTER TABLE chat_sessions
  ADD COLUMN IF NOT EXISTS pinned_context TEXT;

CREATE INDEX IF NOT EXISTS idx_chat_messages_org_user_time
  ON chat_messages (org_id, user_id, created_at DESC);

INSERT INTO schema_migrations (version) VALUES ('008_context_enhancements')
ON CONFLICT (version) DO NOTHING;

COMMIT;
