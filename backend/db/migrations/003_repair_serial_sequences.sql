-- Repair BIGSERIAL sequences (common after manual data import / restore)
-- See knowledge_base/core/db/sequences.py

BEGIN;

DO $$
DECLARE
    r RECORD;
    max_id BIGINT;
BEGIN
    FOR r IN
        SELECT unnest(ARRAY[
            'chat_messages',
            'memories',
            'memory_events',
            'memory_sources',
            'knowledge_candidates'
        ]) AS tbl
    LOOP
        EXECUTE format('SELECT COALESCE(MAX(id), 0) FROM %I', r.tbl) INTO max_id;
        PERFORM setval(
            pg_get_serial_sequence(r.tbl, 'id'),
            max_id,
            true
        );
    END LOOP;
END $$;

INSERT INTO schema_migrations (version) VALUES ('003_repair_serial_sequences')
ON CONFLICT (version) DO NOTHING;

COMMIT;
