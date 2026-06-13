-- 全链路审计日志：任务执行、Wiki 变更、对外通信、自动化等

CREATE TABLE IF NOT EXISTS audit_events (
    id              BIGSERIAL PRIMARY KEY,
    org_id          TEXT NOT NULL,
    user_id         TEXT,
    category        TEXT NOT NULL,
    action          TEXT NOT NULL,
    resource_type   TEXT,
    resource_id     TEXT,
    status          TEXT NOT NULL DEFAULT 'success',
    summary         TEXT,
    detail          JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_events_org_created
    ON audit_events (org_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_events_org_category
    ON audit_events (org_id, category, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_events_org_action
    ON audit_events (org_id, action, created_at DESC);
