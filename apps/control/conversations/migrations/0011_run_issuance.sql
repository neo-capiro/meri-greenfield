-- Durable per-run issuance store (S1): one immutable issuance per original run binding. Migration ID 0011 centrally reserved for this
-- work on 15 October 2026 (docs/coordination/tasks/CODEX-CENTRAL-MIGRATION-ALLOCATION-20261015.md); source only, no application
-- authority. The row binds the exact intent (binding, request hash, original expiry), a durable fenced claim that precedes capability
-- generation, the issued identity (grant id, capability digest, protected opaque-material reference) and the immutable facts hash.
-- No raw credential or capability value is ever stored; every update is a compare-and-set on `version`; the intent columns are
-- immutable once written and a different intent for the same key is refused by the adapter and by the trigger below.
BEGIN;
CREATE TABLE meri_conversations.run_issuances (
 issuance_key text PRIMARY KEY CHECK (issuance_key ~ '^[a-f0-9]{64}$'),
 tenant_id text NOT NULL, conversation_id uuid NOT NULL, run_id uuid NOT NULL,
 binding jsonb NOT NULL, binding_sha256 text NOT NULL CHECK (binding_sha256 = issuance_key),
 request_sha256 text NOT NULL CHECK (request_sha256 ~ '^[a-f0-9]{64}$'),
 expires_at_ms bigint NOT NULL CHECK (expires_at_ms BETWEEN 1 AND 9007199254740991),
 state text NOT NULL CHECK (state IN ('CLAIMED','ISSUED')),
 claim_fence uuid NOT NULL,
 version bigint NOT NULL DEFAULT 1 CHECK (version >= 1),
 grant_id uuid, capability_sha256 text CHECK (capability_sha256 IS NULL OR capability_sha256 ~ '^[a-f0-9]{64}$'),
 material_ref text CHECK (material_ref IS NULL OR length(material_ref) BETWEEN 1 AND 1024),
 facts_sha256 text CHECK (facts_sha256 IS NULL OR facts_sha256 ~ '^[a-f0-9]{64}$'),
 claimed_at timestamptz NOT NULL DEFAULT now(), issued_at timestamptz,
 UNIQUE (tenant_id, conversation_id, run_id),
 CHECK ((state = 'ISSUED') = (grant_id IS NOT NULL AND capability_sha256 IS NOT NULL AND material_ref IS NOT NULL AND issued_at IS NOT NULL)),
 CHECK (state = 'ISSUED' OR facts_sha256 IS NULL)
);
-- Immutability: the intent never changes; ISSUED identity never changes; the facts hash is written once; the version only increments by one.
CREATE FUNCTION meri_conversations.guard_run_issuance() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'RUN_ISSUANCE_IMMUTABLE'; END IF;
 IF NEW.issuance_key <> OLD.issuance_key OR NEW.binding <> OLD.binding OR NEW.request_sha256 <> OLD.request_sha256 OR NEW.expires_at_ms <> OLD.expires_at_ms OR NEW.claim_fence <> OLD.claim_fence OR NEW.claimed_at <> OLD.claimed_at THEN RAISE EXCEPTION 'RUN_ISSUANCE_IMMUTABLE'; END IF;
 IF NEW.version <> OLD.version + 1 THEN RAISE EXCEPTION 'RUN_ISSUANCE_VERSION'; END IF;
 IF OLD.state = 'ISSUED' AND (NEW.state <> 'ISSUED' OR NEW.grant_id <> OLD.grant_id OR NEW.capability_sha256 <> OLD.capability_sha256 OR NEW.material_ref <> OLD.material_ref OR NEW.issued_at <> OLD.issued_at) THEN RAISE EXCEPTION 'RUN_ISSUANCE_IMMUTABLE'; END IF;
 IF OLD.facts_sha256 IS NOT NULL AND NEW.facts_sha256 IS DISTINCT FROM OLD.facts_sha256 THEN RAISE EXCEPTION 'RUN_ISSUANCE_FACTS_IMMUTABLE'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER immutable_run_issuance BEFORE UPDATE OR DELETE ON meri_conversations.run_issuances
 FOR EACH ROW EXECUTE FUNCTION meri_conversations.guard_run_issuance();
COMMIT;
