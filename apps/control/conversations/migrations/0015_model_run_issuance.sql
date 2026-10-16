-- Parent-allocated source only: 0b0b7abd536a27a74e3b1077ae71eed6e0ba275b, 16 October 2026.
-- No SQL execution, credentials, roles, grants or activation authorized. Canonical task table 0011 is unchanged.
BEGIN;
CREATE TABLE meri_conversations.model_run_issuances (
 issuance_key text PRIMARY KEY CHECK (issuance_key ~ '^[a-f0-9]{64}$'),
 tenant_id text NOT NULL CHECK (length(tenant_id) BETWEEN 1 AND 128), conversation_id uuid NOT NULL, run_id uuid NOT NULL,
 binding jsonb NOT NULL CHECK (jsonb_typeof(binding) = 'object'),
 binding_sha256 text NOT NULL CHECK (binding_sha256 = issuance_key),
 request_sha256 text NOT NULL CHECK (request_sha256 ~ '^[a-f0-9]{64}$'),
 expires_at_ms bigint NOT NULL CHECK (expires_at_ms BETWEEN 1 AND 9007199254740991),
 state text NOT NULL CHECK (state IN ('CLAIMED','ISSUED')),
 claim_fence uuid NOT NULL,
 version bigint NOT NULL DEFAULT 1 CHECK (version BETWEEN 1 AND 9007199254740991),
 grant_id uuid UNIQUE, capability_sha256 text UNIQUE CHECK (capability_sha256 IS NULL OR capability_sha256 ~ '^[a-f0-9]{64}$'),
 material_ref text CHECK (material_ref IS NULL OR material_ref = 'model-material:v1:' || issuance_key),
 facts_sha256 text CHECK (facts_sha256 IS NULL OR facts_sha256 ~ '^[a-f0-9]{64}$'),
 claimed_at timestamptz NOT NULL DEFAULT now(), issued_at timestamptz,
 UNIQUE (tenant_id, conversation_id, run_id),
 CHECK (binding ?& ARRAY['tenantId','actorId','conversationId','runId','attemptId','workerId','writerFence']),
 CHECK (binding - ARRAY['tenantId','actorId','conversationId','runId','attemptId','workerId','writerFence'] = '{}'::jsonb),
 CHECK (jsonb_typeof(binding->'tenantId') = 'string' AND jsonb_typeof(binding->'actorId') = 'string' AND
        jsonb_typeof(binding->'conversationId') = 'string' AND jsonb_typeof(binding->'runId') = 'string' AND
        jsonb_typeof(binding->'attemptId') = 'string' AND jsonb_typeof(binding->'workerId') = 'string' AND jsonb_typeof(binding->'writerFence') = 'number'),
 CHECK (binding->>'tenantId' = tenant_id AND binding->>'conversationId' = conversation_id::text AND binding->>'runId' = run_id::text),
 CHECK ((state = 'CLAIMED' AND grant_id IS NULL AND capability_sha256 IS NULL AND material_ref IS NULL AND issued_at IS NULL AND facts_sha256 IS NULL) OR
        (state = 'ISSUED' AND grant_id IS NOT NULL AND capability_sha256 IS NOT NULL AND material_ref IS NOT NULL AND issued_at IS NOT NULL))
);
CREATE FUNCTION meri_conversations.guard_model_run_issuance() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'MODEL_RUN_ISSUANCE_IMMUTABLE'; END IF;
 IF (NEW.issuance_key,NEW.tenant_id,NEW.conversation_id,NEW.run_id,NEW.binding,NEW.binding_sha256,NEW.request_sha256,NEW.expires_at_ms,NEW.claim_fence,NEW.claimed_at)
    IS DISTINCT FROM
    (OLD.issuance_key,OLD.tenant_id,OLD.conversation_id,OLD.run_id,OLD.binding,OLD.binding_sha256,OLD.request_sha256,OLD.expires_at_ms,OLD.claim_fence,OLD.claimed_at)
 THEN RAISE EXCEPTION 'MODEL_RUN_ISSUANCE_IMMUTABLE'; END IF;
 IF NEW.version <> OLD.version + 1 THEN RAISE EXCEPTION 'MODEL_RUN_ISSUANCE_VERSION'; END IF;
 IF OLD.state = 'CLAIMED' AND NEW.state <> 'ISSUED' THEN RAISE EXCEPTION 'MODEL_RUN_ISSUANCE_TRANSITION'; END IF;
 IF OLD.state = 'ISSUED' AND (NEW.state,NEW.grant_id,NEW.capability_sha256,NEW.material_ref,NEW.issued_at)
    IS DISTINCT FROM (OLD.state,OLD.grant_id,OLD.capability_sha256,OLD.material_ref,OLD.issued_at)
 THEN RAISE EXCEPTION 'MODEL_RUN_ISSUANCE_IMMUTABLE'; END IF;
 IF OLD.facts_sha256 IS NOT NULL AND NEW.facts_sha256 IS DISTINCT FROM OLD.facts_sha256 THEN RAISE EXCEPTION 'MODEL_RUN_ISSUANCE_FACTS_IMMUTABLE'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER immutable_model_run_issuance BEFORE UPDATE OR DELETE ON meri_conversations.model_run_issuances
 FOR EACH ROW EXECUTE FUNCTION meri_conversations.guard_model_run_issuance();
COMMIT;
