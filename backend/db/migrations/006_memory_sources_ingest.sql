-- L3 文档智慧提炼：允许 memory_sources 记录资料库来源

BEGIN;

ALTER TABLE memory_sources DROP CONSTRAINT IF EXISTS memory_sources_source_type_check;
ALTER TABLE memory_sources ADD CONSTRAINT memory_sources_source_type_check
    CHECK (source_type IN ('chat_message', 'chat_session', 'wiki', 'agent_task', 'ingest'));

CREATE INDEX IF NOT EXISTS idx_memories_org_source
    ON memories (org_id, source_type, created_at DESC)
    WHERE status = 'active';

INSERT INTO schema_migrations (version)
VALUES ('006_memory_sources_ingest')
ON CONFLICT (version) DO NOTHING;

COMMIT;
