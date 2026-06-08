-- HiveMindOS Knowledge Candidate Pool
-- Raw (chat/docs) → candidates → resolver → Wiki
-- See 项目文档/5-知识候选池.md

BEGIN;

CREATE TABLE IF NOT EXISTS knowledge_candidates (
    id               BIGSERIAL PRIMARY KEY,
    org_id           TEXT NOT NULL,
    user_id          TEXT,
    category         TEXT NOT NULL
                     CHECK (category IN (
                         'decision', 'project', 'workflow', 'rule',
                         'product', 'methodology', 'entity', 'preference', 'other'
                     )),
    title            TEXT NOT NULL,
    content          TEXT NOT NULL,
    source_type      TEXT NOT NULL
                     CHECK (source_type IN ('chat', 'ingest', 'recap', 'manual', 'agent')),
    source_id        TEXT,
    confidence       REAL NOT NULL DEFAULT 0.5
                     CHECK (confidence >= 0 AND confidence <= 1),
    proposed_action  TEXT NOT NULL DEFAULT 'create_or_update'
                     CHECK (proposed_action IN (
                         'create', 'update', 'supplement', 'deprecate', 'create_or_update'
                     )),
    status           TEXT NOT NULL DEFAULT 'pending'
                     CHECK (status IN (
                         'pending', 'approved', 'merged', 'rejected', 'conflict'
                     )),
    resolver_action  TEXT
                     CHECK (resolver_action IS NULL OR resolver_action IN (
                         'create', 'update', 'supplement', 'deprecate', 'noop', 'conflict'
                     )),
    resolver_note    TEXT,
    target_wiki_path TEXT,
    memory_id        BIGINT REFERENCES memories(id) ON DELETE SET NULL,
    metadata         JSONB NOT NULL DEFAULT '{}',
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kc_org_status_created
    ON knowledge_candidates (org_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_kc_org_user_status
    ON knowledge_candidates (org_id, user_id, status)
    WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_kc_source
    ON knowledge_candidates (source_type, source_id);

DROP TRIGGER IF EXISTS trg_knowledge_candidates_updated ON knowledge_candidates;
CREATE TRIGGER trg_knowledge_candidates_updated
    BEFORE UPDATE ON knowledge_candidates
    FOR EACH ROW EXECUTE PROCEDURE touch_updated_at();

INSERT INTO schema_migrations (version) VALUES ('002_knowledge_candidates')
ON CONFLICT (version) DO NOTHING;

COMMIT;
