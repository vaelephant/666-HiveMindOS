-- 外部工具 / MCP 注册表（按 org 隔离）

CREATE TABLE IF NOT EXISTS external_tools (
    id              SERIAL PRIMARY KEY,
    org_id          TEXT NOT NULL,
    tool_id         TEXT NOT NULL,
    label           TEXT NOT NULL,
    kind            TEXT NOT NULL DEFAULT 'mcp',
    description     TEXT,
    endpoint        TEXT,
    enabled         BOOLEAN NOT NULL DEFAULT TRUE,
    config          JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (org_id, tool_id)
);

CREATE INDEX IF NOT EXISTS idx_external_tools_org ON external_tools (org_id, enabled);
