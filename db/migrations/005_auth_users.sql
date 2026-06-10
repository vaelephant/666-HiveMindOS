-- HiveMindOS Web UI — 用户认证表（NextAuth Credentials + Prisma）
-- 与 memory_layer 共用 PostgreSQL，users 表由 webui/prisma 管理

BEGIN;

CREATE TABLE IF NOT EXISTS users (
    id            TEXT PRIMARY KEY,
    name          TEXT,
    email         TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    org_id        TEXT NOT NULL UNIQUE,
    role          TEXT NOT NULL DEFAULT 'user',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
CREATE INDEX IF NOT EXISTS idx_users_org_id ON users (org_id);

INSERT INTO schema_migrations (version)
VALUES ('005_auth_users')
ON CONFLICT (version) DO NOTHING;

COMMIT;
