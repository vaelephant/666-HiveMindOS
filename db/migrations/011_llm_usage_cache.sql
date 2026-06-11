-- KV / prompt cache hit tracking on LLM usage events

BEGIN;

ALTER TABLE llm_usage_events
    ADD COLUMN IF NOT EXISTS cached_prompt_tokens INTEGER NOT NULL DEFAULT 0
        CHECK (cached_prompt_tokens >= 0);

ALTER TABLE llm_usage_events
    ADD COLUMN IF NOT EXISTS cache_creation_tokens INTEGER NOT NULL DEFAULT 0
        CHECK (cache_creation_tokens >= 0);

INSERT INTO schema_migrations (version)
VALUES ('011_llm_usage_cache')
ON CONFLICT (version) DO NOTHING;

COMMIT;
