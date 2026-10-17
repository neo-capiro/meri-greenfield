-- SOURCE ONLY. Exclusive allocation: central ledger 93838193c46a13b2fdda9dee9c142d1af0e60cba.
-- No startup apply, roles, grants, credentials or production authority are supplied.
-- Requires the existing canonical conversation runs and S1 run_issuances tables.
BEGIN;
CREATE SCHEMA meri_objective_source;
CREATE TABLE meri_objective_source.custody (
 generation_job_id uuid PRIMARY KEY,
 issuance_key text NOT NULL UNIQUE CHECK (issuance_key ~ '^[a-f0-9]{64}$'),
 tenant_id text NOT NULL CHECK (length(tenant_id) BETWEEN 1 AND 128),
 conversation_id uuid NOT NULL,
 run_id uuid NOT NULL,
 binding jsonb NOT NULL,
 binding_sha256 text NOT NULL CHECK (binding_sha256 = issuance_key),
 source_admission_sha256 text NOT NULL CHECK (source_admission_sha256 ~ '^[a-f0-9]{64}$'),
 source_request_sha256 text NOT NULL CHECK (source_request_sha256 ~ '^[a-f0-9]{64}$'),
 facts_sha256 text NOT NULL CHECK (facts_sha256 ~ '^[a-f0-9]{64}$'),
 record_sha256 text NOT NULL CHECK (record_sha256 ~ '^[a-f0-9]{64}$'),
 original_expires_at_ms bigint NOT NULL CHECK (original_expires_at_ms BETWEEN 1 AND 9007199254740991),
 record jsonb NOT NULL,
 state text NOT NULL CHECK (state IN ('CLAIMED','COMMITTED')),
 claim_fence uuid NOT NULL,
 version bigint NOT NULL CHECK (version IN (1,2)),
 claimed_at timestamptz NOT NULL DEFAULT clock_timestamp() CHECK (isfinite(claimed_at)),
 committed_at timestamptz CHECK (committed_at IS NULL OR isfinite(committed_at)),
 FOREIGN KEY (issuance_key) REFERENCES meri_conversations.run_issuances(issuance_key),
 FOREIGN KEY (tenant_id,conversation_id,run_id) REFERENCES meri_conversations.runs(tenant_id,conversation_id,run_id),
 CHECK ((state = 'CLAIMED' AND version = 1 AND committed_at IS NULL) OR
        (state = 'COMMITTED' AND version = 2 AND committed_at IS NOT NULL AND committed_at >= claimed_at)),
 -- Closed binding and duplicated locators. Canonical JavaScript validators
 -- additionally enforce all UUIDs, JCS binding digest and whole-facts semantics.
 CHECK ((jsonb_typeof(binding) = 'object' AND
  binding ?& ARRAY['tenantId','actorId','conversationId','runId','attemptId','workerId','writerFence'] AND
  binding - ARRAY['tenantId','actorId','conversationId','runId','attemptId','workerId','writerFence'] = '{}'::jsonb AND
  jsonb_typeof(binding->'tenantId') = 'string' AND
  binding->>'tenantId' = tenant_id AND binding->>'conversationId' = conversation_id::text AND
  binding->>'runId' = run_id::text AND jsonb_typeof(binding->'actorId') = 'string' AND
  length(binding->>'actorId') BETWEEN 1 AND 128 AND
  jsonb_typeof(binding->'attemptId') = 'string' AND jsonb_typeof(binding->'workerId') = 'string' AND
  jsonb_typeof(binding->'writerFence') = 'number' AND
  (binding->>'writerFence')::numeric BETWEEN 1 AND 9007199254740991 AND
  (binding->>'writerFence')::numeric = trunc((binding->>'writerFence')::numeric)) IS TRUE),
 -- This is a storage-size backstop, never a replacement for the canonical
 -- four-MiB private-record validator or a jsonb::text-based hash convention.
 CHECK ((jsonb_typeof(record) = 'object' AND octet_length(record::text) <= 8388608 AND
  record ?& ARRAY['schemaVersion','generationJobId','sourceAdmissionSha256','binding','acceptedRequest','runIdentity','issued'] AND
  record - ARRAY['schemaVersion','generationJobId','sourceAdmissionSha256','binding','acceptedRequest','runIdentity','issued'] = '{}'::jsonb AND
  record->'schemaVersion' = '2'::jsonb AND record->>'generationJobId' = generation_job_id::text AND
  record->>'sourceAdmissionSha256' = source_admission_sha256 AND record->'binding' = binding AND
  record#>'{issued,original,binding}' = binding AND record#>'{issued,issuance,binding}' = binding AND
  record#>>'{issued,issuance,issuanceKey}' = issuance_key AND
  record#>>'{issued,issuance,requestSha256}' = source_request_sha256 AND
  record#>>'{issued,issuance,factsSha256}' = facts_sha256 AND record#>>'{issued,factsSha256}' = facts_sha256 AND
  record#>>'{issued,objectiveGeneration,sourceAdmissionSha256}' = source_admission_sha256 AND
  record#>>'{issued,objectiveGeneration,sourceAdmission,generationJobId}' = generation_job_id::text AND
  record#>'{issued,original,expiresAtMs}' = to_jsonb(original_expires_at_ms) AND
  record#>'{issued,issuance,expiresAtMs}' = to_jsonb(original_expires_at_ms)) IS TRUE)
);

-- No lease, reclaim, read-side completion or deletion. The private payload,
-- source identities and original execution expiry are immutable even precommit.
CREATE FUNCTION meri_objective_source.guard_custody_immutable() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog AS $$
BEGIN
 IF TG_OP IN ('DELETE','TRUNCATE') THEN RAISE EXCEPTION 'OBJECTIVE_CUSTODY_IMMUTABLE'; END IF;
 IF TG_OP = 'INSERT' THEN
  IF NEW.state IS DISTINCT FROM 'CLAIMED' OR NEW.version IS DISTINCT FROM 1 OR NEW.committed_at IS NOT NULL THEN
   RAISE EXCEPTION 'OBJECTIVE_CUSTODY_INITIAL_STATE';
  END IF;
  RETURN NEW;
 END IF;
 IF ROW(NEW.generation_job_id,NEW.issuance_key,NEW.tenant_id,NEW.conversation_id,NEW.run_id,
        NEW.binding,NEW.binding_sha256,NEW.source_admission_sha256,NEW.source_request_sha256,
        NEW.facts_sha256,NEW.record_sha256,NEW.original_expires_at_ms,NEW.record,NEW.claim_fence,NEW.claimed_at)
 IS DISTINCT FROM
    ROW(OLD.generation_job_id,OLD.issuance_key,OLD.tenant_id,OLD.conversation_id,OLD.run_id,
        OLD.binding,OLD.binding_sha256,OLD.source_admission_sha256,OLD.source_request_sha256,
        OLD.facts_sha256,OLD.record_sha256,OLD.original_expires_at_ms,OLD.record,OLD.claim_fence,OLD.claimed_at) THEN
  RAISE EXCEPTION 'OBJECTIVE_CUSTODY_IMMUTABLE';
 END IF;
 IF OLD.state IS DISTINCT FROM 'CLAIMED' OR OLD.version IS DISTINCT FROM 1 OR OLD.committed_at IS NOT NULL OR
    NEW.state IS DISTINCT FROM 'COMMITTED' OR NEW.version IS DISTINCT FROM 2 OR NEW.committed_at IS NULL THEN
  RAISE EXCEPTION 'OBJECTIVE_CUSTODY_TRANSITION';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER immutable_custody BEFORE INSERT OR UPDATE OR DELETE ON meri_objective_source.custody
 FOR EACH ROW EXECUTE FUNCTION meri_objective_source.guard_custody_immutable();
CREATE TRIGGER immutable_custody_truncate BEFORE TRUNCATE ON meri_objective_source.custody
 FOR EACH STATEMENT EXECUTE FUNCTION meri_objective_source.guard_custody_immutable();
COMMIT;
