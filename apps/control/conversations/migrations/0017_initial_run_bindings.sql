-- Centrally reserved source 0017 for Meri first-chat initial-run binding; exclusive Meri first-chat lane (16 October 2026).
-- Immutable original binding ahead of Run acceptance. No credential, prompt, grant, or seed is stored here.
-- Source only: database execution, reviewed role grants, restore, concurrency, and deployment qualification remain separate.
BEGIN;
CREATE TABLE meri_conversations.initial_run_bindings (
 tenant_id text NOT NULL CHECK (length(tenant_id) BETWEEN 1 AND 128),
 conversation_id uuid NOT NULL,
 run_id uuid NOT NULL,
 record jsonb NOT NULL CHECK ((jsonb_typeof(record) = 'object') IS TRUE),
 record_sha256 text NOT NULL CHECK (record_sha256 ~ '^[a-f0-9]{64}$'),
 PRIMARY KEY (tenant_id,conversation_id),
 UNIQUE (tenant_id,run_id),
 CHECK ((record ?& ARRAY['schemaVersion','state','binding','selectedClientId',
                         'policyRevision','versions','configurationSha256',
                         'createdAtMs','expiresAtMs']) IS TRUE),
 CHECK (((record - ARRAY['schemaVersion','state','binding','selectedClientId',
                          'policyRevision','versions','configurationSha256',
                          'createdAtMs','expiresAtMs']) = '{}'::jsonb) IS TRUE),
 CHECK ((jsonb_typeof(record->'binding') = 'object') IS TRUE),
 CHECK (((record->'binding') ?& ARRAY['tenantId','actorId','conversationId',
                                      'runId','attemptId','workerId','writerFence']) IS TRUE),
 CHECK ((((record->'binding') - ARRAY['tenantId','actorId','conversationId',
                                       'runId','attemptId','workerId','writerFence'])
          = '{}'::jsonb) IS TRUE),
 CHECK ((jsonb_typeof(record->'versions') = 'object') IS TRUE),
 CHECK (((record->'versions') ?& ARRAY['imageDigest','sdk','cli','contracts',
                                       'skillsDigest','checkpointFormat']) IS TRUE),
 CHECK ((((record->'versions') - ARRAY['imageDigest','sdk','cli','contracts',
                                        'skillsDigest','checkpointFormat'])
          = '{}'::jsonb) IS TRUE),
 CHECK ((record->'schemaVersion' = '1'::jsonb) IS TRUE),
 CHECK ((jsonb_typeof(record->'state') = 'string'
         AND record->>'state' = 'ADMITTED') IS TRUE),
 CHECK ((jsonb_typeof(record#>'{binding,tenantId}') = 'string'
         AND record#>>'{binding,tenantId}' = tenant_id) IS TRUE),
 CHECK ((jsonb_typeof(record#>'{binding,actorId}') = 'string'
         AND length(record#>>'{binding,actorId}') BETWEEN 1 AND 128) IS TRUE),
 CHECK ((jsonb_typeof(record#>'{binding,conversationId}') = 'string'
         AND record#>>'{binding,conversationId}' = conversation_id::text) IS TRUE),
 CHECK ((jsonb_typeof(record#>'{binding,runId}') = 'string'
         AND record#>>'{binding,runId}' = run_id::text) IS TRUE),
 CHECK ((jsonb_typeof(record#>'{binding,attemptId}') = 'string'
         AND record#>>'{binding,attemptId}' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') IS TRUE),
 CHECK ((jsonb_typeof(record#>'{binding,workerId}') = 'string'
         AND record#>>'{binding,workerId}' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') IS TRUE),
 CHECK ((record#>'{binding,writerFence}' = '1'::jsonb) IS TRUE),
 CHECK ((jsonb_typeof(record->'selectedClientId') = 'string'
         AND record->>'selectedClientId' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') IS TRUE),
 CHECK ((jsonb_typeof(record->'policyRevision') = 'string'
         AND length(record->>'policyRevision') BETWEEN 1 AND 256) IS TRUE),
 CHECK ((jsonb_typeof(record->'configurationSha256') = 'string'
         AND record->>'configurationSha256' ~ '^[a-f0-9]{64}$') IS TRUE),
 CHECK ((jsonb_typeof(record#>'{versions,imageDigest}') = 'string'
         AND record#>>'{versions,imageDigest}' ~ '^sha256:[a-f0-9]{64}$') IS TRUE),
 CHECK ((jsonb_typeof(record#>'{versions,sdk}') = 'string'
         AND record#>>'{versions,sdk}' ~ '^[0-9]+[.][0-9]+[.][0-9]+$') IS TRUE),
 CHECK ((jsonb_typeof(record#>'{versions,cli}') = 'string'
         AND record#>>'{versions,cli}' ~ '^[0-9]+[.][0-9]+[.][0-9]+$') IS TRUE),
 CHECK ((jsonb_typeof(record#>'{versions,contracts}') = 'string'
         AND record#>>'{versions,contracts}' = '0.1.0') IS TRUE),
 CHECK ((jsonb_typeof(record#>'{versions,skillsDigest}') = 'string'
         AND record#>>'{versions,skillsDigest}' ~ '^[a-f0-9]{64}$') IS TRUE),
 CHECK ((jsonb_typeof(record#>'{versions,checkpointFormat}') = 'string'
         AND record#>>'{versions,checkpointFormat}' = '0.1.0') IS TRUE),
 CHECK (CASE
         WHEN jsonb_typeof(record->'createdAtMs') = 'number'
          AND jsonb_typeof(record->'expiresAtMs') = 'number'
         THEN (record->>'createdAtMs')::numeric BETWEEN 0 AND 9007199254740991
          AND (record->>'createdAtMs')::numeric = trunc((record->>'createdAtMs')::numeric)
          AND (record->>'expiresAtMs')::numeric BETWEEN 1 AND 9007199254740991
          AND (record->>'expiresAtMs')::numeric = trunc((record->>'expiresAtMs')::numeric)
          AND (record->>'expiresAtMs')::numeric > (record->>'createdAtMs')::numeric
         ELSE false
        END)
);
CREATE FUNCTION meri_conversations.reject_initial_run_binding_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 RAISE EXCEPTION 'INITIAL_RUN_BINDING_IMMUTABLE';
END $$;
CREATE TRIGGER immutable_initial_run_binding BEFORE UPDATE OR DELETE ON meri_conversations.initial_run_bindings
 FOR EACH ROW EXECUTE FUNCTION meri_conversations.reject_initial_run_binding_change();
CREATE TRIGGER immutable_initial_run_binding_truncate BEFORE TRUNCATE ON meri_conversations.initial_run_bindings
 FOR EACH STATEMENT EXECUTE FUNCTION meri_conversations.reject_initial_run_binding_change();
-- PostgreSQL 16 SELECT ... FOR UPDATE requires UPDATE privilege on at least one
-- column. Grant the app role SELECT, INSERT, and UPDATE(record_sha256) only;
-- the UPDATE trigger rejects actual mutations. Never grant DELETE, TRUNCATE,
-- table ownership, or schema DDL to the app role.
-- Reconcile preexisting conversations before mounting; never backfill invented bindings.
COMMIT;
