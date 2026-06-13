-- Per-user model preferences and custom profiles

BEGIN;

CREATE TABLE IF NOT EXISTS user_model_settings (
    org_id          TEXT NOT NULL,
    user_id         TEXT NOT NULL,
    chat_profile    TEXT NOT NULL DEFAULT 'default',
    fast_profile    TEXT NOT NULL DEFAULT 'fast',
    embed_profile   TEXT NOT NULL DEFAULT 'embedding',
    custom_profiles JSONB NOT NULL DEFAULT '[]',
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (org_id, user_id)
);

INSERT INTO schema_migrations (version)
VALUES ('010_user_model_settings')
ON CONFLICT (version) DO NOTHING;

COMMIT;
