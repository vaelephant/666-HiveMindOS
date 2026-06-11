-- LLM token usage tracking (per org / user)

BEGIN;

CREATE TABLE IF NOT EXISTS llm_usage_events (
    id                BIGSERIAL PRIMARY KEY,
    org_id            TEXT NOT NULL,
    user_id           TEXT NOT NULL DEFAULT 'demo',
    provider          TEXT NOT NULL,
    model             TEXT NOT NULL,
    profile_id        TEXT,
    operation         TEXT NOT NULL
                      CHECK (operation IN ('chat', 'embed', 'agentic')),
    source            TEXT NOT NULL DEFAULT 'unknown',
    source_id         TEXT,
    prompt_tokens     INTEGER NOT NULL DEFAULT 0 CHECK (prompt_tokens >= 0),
    completion_tokens INTEGER NOT NULL DEFAULT 0 CHECK (completion_tokens >= 0),
    total_tokens      INTEGER NOT NULL DEFAULT 0 CHECK (total_tokens >= 0),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_llm_usage_org_user_created
    ON llm_usage_events (org_id, user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_llm_usage_org_created
    ON llm_usage_events (org_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_llm_usage_org_user_source
    ON llm_usage_events (org_id, user_id, source, created_at DESC);

INSERT INTO schema_migrations (version)
VALUES ('009_llm_usage')
ON CONFLICT (version) DO NOTHING;

COMMIT;
