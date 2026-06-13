-- Per-user Chat starter question overrides

BEGIN;

CREATE TABLE IF NOT EXISTS user_chat_preferences (
    org_id      TEXT NOT NULL,
    user_id     TEXT NOT NULL,
    starters    JSONB NOT NULL DEFAULT '[]',
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (org_id, user_id)
);

INSERT INTO schema_migrations (version)
VALUES ('014_user_chat_preferences')
ON CONFLICT (version) DO NOTHING;

COMMIT;
