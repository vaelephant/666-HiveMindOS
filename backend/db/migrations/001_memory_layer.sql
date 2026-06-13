-- HiveMindOS Memory Layer — PostgreSQL schema
-- Layer 1: Raw Chat
-- Layer 2: Structured Memory (+ lifecycle audit)
-- Layer 3: Qdrant vectors referenced via memories.qdrant_point_id

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── Migration tracking ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS schema_migrations (
    version     TEXT PRIMARY KEY,
    applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Layer 1: Raw Chat ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS chat_sessions (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id      TEXT NOT NULL,
    user_id     TEXT NOT NULL DEFAULT 'demo',
    title       TEXT NOT NULL DEFAULT '',
    status      TEXT NOT NULL DEFAULT 'active'
                CHECK (status IN ('active', 'archived')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chat_messages (
    id          BIGSERIAL PRIMARY KEY,
    session_id  UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
    org_id      TEXT NOT NULL,
    user_id     TEXT NOT NULL DEFAULT 'demo',
    role        TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content     TEXT NOT NULL,
    sources     JSONB NOT NULL DEFAULT '[]',
    follow_ups  JSONB NOT NULL DEFAULT '[]',
    metadata    JSONB NOT NULL DEFAULT '{}',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Layer 2: Structured Memory ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS memories (
    id               BIGSERIAL PRIMARY KEY,
    org_id           TEXT NOT NULL,
    user_id          TEXT,
    memory_type      TEXT NOT NULL
                     CHECK (memory_type IN (
                         'preference', 'project', 'goal', 'rule',
                         'decision', 'entity', 'workflow', 'fact'
                     )),
    title            TEXT NOT NULL,
    content          TEXT NOT NULL,
    importance       REAL NOT NULL DEFAULT 0.5
                     CHECK (importance >= 0 AND importance <= 1),
    status           TEXT NOT NULL DEFAULT 'active'
                     CHECK (status IN ('active', 'archived', 'deleted')),
    source_type      TEXT
                     CHECK (source_type IS NULL OR source_type IN (
                         'chat', 'ingest', 'manual', 'agent', 'wiki'
                     )),
    source_id        TEXT,
    qdrant_point_id  TEXT,
    superseded_by    BIGINT REFERENCES memories(id) ON DELETE SET NULL,
    decay_score      REAL NOT NULL DEFAULT 1.0
                     CHECK (decay_score >= 0 AND decay_score <= 1),
    last_accessed_at TIMESTAMPTZ,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS memory_events (
    id          BIGSERIAL PRIMARY KEY,
    memory_id   BIGINT NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
    org_id      TEXT NOT NULL,
    event_type  TEXT NOT NULL
                CHECK (event_type IN (
                    'created', 'updated', 'merged', 'conflict',
                    'archived', 'deleted', 'decayed', 'accessed'
                )),
    old_content TEXT,
    new_content TEXT,
    metadata    JSONB NOT NULL DEFAULT '{}',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Links extracted memories back to originating chat messages
CREATE TABLE IF NOT EXISTS memory_sources (
    id          BIGSERIAL PRIMARY KEY,
    memory_id   BIGINT NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
    source_type TEXT NOT NULL CHECK (source_type IN ('chat_message', 'chat_session', 'wiki', 'agent_task')),
    source_id   TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (memory_id, source_type, source_id)
);

-- ── Indexes ──────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_chat_sessions_org_user_updated
    ON chat_sessions (org_id, user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_chat_messages_session_created
    ON chat_messages (session_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_chat_messages_org_created
    ON chat_messages (org_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_memories_org_type_status
    ON memories (org_id, memory_type, status);

CREATE INDEX IF NOT EXISTS idx_memories_org_user_importance
    ON memories (org_id, user_id, importance DESC)
    WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_memories_qdrant_point
    ON memories (qdrant_point_id)
    WHERE qdrant_point_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_memory_events_memory_created
    ON memory_events (memory_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_memory_sources_lookup
    ON memory_sources (source_type, source_id);

-- ── updated_at trigger for chat_sessions ─────────────────────────────────────

CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_chat_sessions_updated ON chat_sessions;
CREATE TRIGGER trg_chat_sessions_updated
    BEFORE UPDATE ON chat_sessions
    FOR EACH ROW EXECUTE PROCEDURE touch_updated_at();

DROP TRIGGER IF EXISTS trg_memories_updated ON memories;
CREATE TRIGGER trg_memories_updated
    BEFORE UPDATE ON memories
    FOR EACH ROW EXECUTE PROCEDURE touch_updated_at();

INSERT INTO schema_migrations (version) VALUES ('001_memory_layer')
ON CONFLICT (version) DO NOTHING;

COMMIT;
