-- Patient health reports — structured lab observations + full-text for other reports

BEGIN;

-- Allow health as memory provenance
ALTER TABLE memories DROP CONSTRAINT IF EXISTS memories_source_type_check;
ALTER TABLE memories ADD CONSTRAINT memories_source_type_check
    CHECK (source_type IS NULL OR source_type IN (
        'chat', 'ingest', 'manual', 'agent', 'wiki', 'health'
    ));

CREATE TABLE IF NOT EXISTS health_reports (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id                      TEXT NOT NULL,
    user_id                     TEXT NOT NULL,
    source_id                   TEXT,
    report_category             TEXT NOT NULL DEFAULT 'other'
                                CHECK (report_category IN ('lab', 'other')),
    report_subtype              TEXT,
    report_date                 TIMESTAMPTZ,
    date_inferred               BOOLEAN NOT NULL DEFAULT false,
    institution                 TEXT,
    full_text                   TEXT NOT NULL DEFAULT '',
    summary                     TEXT,
    extract_status              TEXT NOT NULL DEFAULT 'pending'
                                CHECK (extract_status IN (
                                    'pending', 'processing', 'done', 'failed'
                                )),
    extract_version             TEXT NOT NULL DEFAULT 'mvp-v1',
    classification_confidence   REAL,
    error_message               TEXT,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One row per lab indicator (WBC, HGB, …), not a single JSON blob
CREATE TABLE IF NOT EXISTS health_observations (
    id              BIGSERIAL PRIMARY KEY,
    report_id       UUID NOT NULL REFERENCES health_reports(id) ON DELETE CASCADE,
    org_id          TEXT NOT NULL,
    user_id         TEXT NOT NULL,
    code            TEXT,
    display_name    TEXT NOT NULL,
    value_num       DOUBLE PRECISION,
    value_text      TEXT,
    unit            TEXT,
    ref_low         DOUBLE PRECISION,
    ref_high        DOUBLE PRECISION,
    is_abnormal     BOOLEAN,
    confidence      REAL,
    sort_order      INT NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_health_reports_org_user_date
    ON health_reports (org_id, user_id, report_date DESC NULLS LAST, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_health_reports_org_status
    ON health_reports (org_id, user_id, extract_status);

CREATE INDEX IF NOT EXISTS idx_health_observations_report
    ON health_observations (report_id, sort_order);

CREATE INDEX IF NOT EXISTS idx_health_observations_org_user_name
    ON health_observations (org_id, user_id, display_name);

CREATE INDEX IF NOT EXISTS idx_health_observations_org_user_code
    ON health_observations (org_id, user_id, code)
    WHERE code IS NOT NULL;

INSERT INTO schema_migrations (version)
VALUES ('015_health_reports')
ON CONFLICT (version) DO NOTHING;

COMMIT;
