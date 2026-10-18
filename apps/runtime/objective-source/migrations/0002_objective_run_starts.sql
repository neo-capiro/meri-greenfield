-- SOURCE ONLY. D7-4 (D015 #12) run-start association. Proposed next path in the independent objective-source family; it needs
-- its central ledger reservation before any apply. CREATE only: no existing object is altered or dropped.
-- No startup apply, roles, grants, credentials or production authority are supplied here.
-- Requires 0001_objective_custody.sql (schema meri_objective_source). Deliberately no foreign key into meri_conversations:
-- a row is written BEFORE its run is accepted, so a run with a row is always Objective and a run without one never is.
BEGIN;
CREATE TABLE meri_objective_source.run_starts (
 generation_job_id uuid PRIMARY KEY,
 tenant_id text NOT NULL CHECK (length(tenant_id) BETWEEN 1 AND 128),
 conversation_id uuid NOT NULL,
 run_id uuid NOT NULL,
 issuance_key text NOT NULL UNIQUE CHECK (issuance_key ~ '^[a-f0-9]{64}$'),
 binding jsonb NOT NULL,
 source_admission_sha256 text NOT NULL CHECK (source_admission_sha256 ~ '^[a-f0-9]{64}$'),
 source_request_sha256 text NOT NULL CHECK (source_request_sha256 ~ '^[a-f0-9]{64}$'),
 typed_request_sha256 text NOT NULL CHECK (typed_request_sha256 ~ '^[a-f0-9]{64}$'),
 selection_sha256 text NOT NULL CHECK (selection_sha256 ~ '^[a-f0-9]{64}$'),
 record_sha256 text NOT NULL CHECK (record_sha256 ~ '^[a-f0-9]{64}$'),
 effect_expires_at_ms bigint NOT NULL CHECK (effect_expires_at_ms BETWEEN 1 AND 9007199254740991),
 record jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp() CHECK (isfinite(created_at)),
 UNIQUE (tenant_id, conversation_id, run_id),
 -- Closed original binding (writer fence 1) with duplicated locators. Canonical JavaScript validators additionally derive the
 -- whole binding from (tenant, actor, job) and enforce the JCS digests, which jsonb::text cannot reproduce.
 CHECK ((jsonb_typeof(binding) = 'object' AND
  binding ?& ARRAY['tenantId','actorId','conversationId','runId','attemptId','workerId','writerFence'] AND
  binding - ARRAY['tenantId','actorId','conversationId','runId','attemptId','workerId','writerFence'] = '{}'::jsonb AND
  jsonb_typeof(binding->'tenantId') = 'string' AND binding->>'tenantId' = tenant_id AND
  binding->>'conversationId' = conversation_id::text AND binding->>'runId' = run_id::text AND
  jsonb_typeof(binding->'actorId') = 'string' AND length(binding->>'actorId') BETWEEN 1 AND 128 AND
  jsonb_typeof(binding->'attemptId') = 'string' AND jsonb_typeof(binding->'workerId') = 'string' AND
  binding->'writerFence' = '1'::jsonb) IS TRUE),
 -- Closed record and selection. The selection carries Core's published prompt (execution context): the same private class as
 -- custody's record; its retention class, suppression and purge stay unallocated activation prerequisites.
 CHECK ((jsonb_typeof(record) = 'object' AND octet_length(record::text) <= 2097152 AND
  record ?& ARRAY['schemaVersion','generationJobId','binding','sourceAdmissionSha256','sourceRequestSha256','typedRequestSha256','selectionSha256','effectExpiresAtMs','selection'] AND
  record - ARRAY['schemaVersion','generationJobId','binding','sourceAdmissionSha256','sourceRequestSha256','typedRequestSha256','selectionSha256','effectExpiresAtMs','selection'] = '{}'::jsonb AND
  record->'schemaVersion' = '1'::jsonb AND record->>'generationJobId' = generation_job_id::text AND record->'binding' = binding AND
  record->>'sourceAdmissionSha256' = source_admission_sha256 AND record->>'sourceRequestSha256' = source_request_sha256 AND
  record->>'typedRequestSha256' = typed_request_sha256 AND record->>'selectionSha256' = selection_sha256 AND
  record->'effectExpiresAtMs' = to_jsonb(effect_expires_at_ms) AND jsonb_typeof(record->'selection') = 'object' AND
  record->'selection' ?& ARRAY['sourceAdmission','request','executionContext','queuedType'] AND
  record->'selection' - ARRAY['sourceAdmission','request','executionContext','queuedType'] = '{}'::jsonb AND
  record#>>'{selection,sourceAdmission,generationJobId}' = generation_job_id::text AND
  record#>>'{selection,request,jobId}' = generation_job_id::text AND
  record#>>'{selection,sourceAdmission,clerkUserId}' = binding->>'actorId' AND
  record#>>'{selection,sourceAdmission,canonical,tenantId}' = tenant_id AND
  record#>>'{selection,queuedType}' IN ('appropriations','authorization','regulatory','coalition','procurement','earmark','amendment')) IS TRUE)
);

-- Insert-only: no update, deletion, truncation, reclaim or read-side completion. A start is never re-pointed to another run.
CREATE FUNCTION meri_objective_source.guard_run_start_immutable() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog AS $$
BEGIN
 RAISE EXCEPTION 'OBJECTIVE_RUN_START_IMMUTABLE';
END $$;
CREATE TRIGGER immutable_run_start BEFORE UPDATE OR DELETE ON meri_objective_source.run_starts
 FOR EACH ROW EXECUTE FUNCTION meri_objective_source.guard_run_start_immutable();
CREATE TRIGGER immutable_run_start_truncate BEFORE TRUNCATE ON meri_objective_source.run_starts
 FOR EACH STATEMENT EXECUTE FUNCTION meri_objective_source.guard_run_start_immutable();
COMMIT;
