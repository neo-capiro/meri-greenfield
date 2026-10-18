-- SOURCE ONLY. Durable single-use ledger for Core's routine cancellation proofs (wire B: capiro-backend PR #84 @32cf3ca7
-- docs/integration/MERI-ROUTINES-POLICY-AND-CANCELLATION-DRAFT.md section 5; R0 meri-greenfield #121 6247017061 item 3),
-- consumed by apps/runtime/native-authority/routines-run-control.mjs through postgres-run-cancel-proofs.mjs. One row per
-- (issuer, jti), inserted BEFORE the run's terminal journal append, so a proof stops at most one run once. Claim digests and the
-- one stopped run only; the token itself is never stored. Insert-only: no row is updated, deleted or truncated.
-- CREATE only: no existing object is altered or dropped. Requires 0001_schedule_owner.sql (schema meri_schedules).
-- Operator-applied in the 'integration' stage only; no roles, grants, credentials or keys are supplied here.
BEGIN;
CREATE TABLE meri_schedules.run_cancel_proofs (
 issuer text NOT NULL CHECK (issuer ~ '^[A-Za-z0-9][A-Za-z0-9:._/-]{0,255}$'),
 key_id text NOT NULL CHECK (key_id ~ '^[A-Za-z0-9._-]{1,64}$'),
 token_id uuid NOT NULL,
 tenant_id text NOT NULL CHECK (length(tenant_id) BETWEEN 1 AND 256),
 owner_actor_id text NOT NULL CHECK (length(owner_actor_id) BETWEEN 1 AND 256),
 schedule_id uuid NOT NULL,
 intent_id uuid NOT NULL,
 intent_sha256 text NOT NULL CHECK (intent_sha256 ~ '^[a-f0-9]{64}$'),
 decision_sha256 text NOT NULL CHECK (decision_sha256 ~ '^[a-f0-9]{64}$'),
 claims_sha256 text NOT NULL CHECK (claims_sha256 ~ '^[a-f0-9]{64}$'),
 proof_sha256 text NOT NULL CHECK (proof_sha256 ~ '^[a-f0-9]{64}$'),
 binding jsonb NOT NULL,
 binding_sha256 text NOT NULL CHECK (binding_sha256 ~ '^[a-f0-9]{64}$'),
 issued_at_s bigint NOT NULL CHECK (issued_at_s BETWEEN 0 AND 9007199254740991),
 expires_at_s bigint NOT NULL CHECK (expires_at_s BETWEEN 1 AND 9007199254740991),
 consumed_at timestamptz NOT NULL DEFAULT clock_timestamp() CHECK (isfinite(consumed_at)),
 PRIMARY KEY (issuer, token_id),
 -- Core's own bound: a proof lives at most 30 s (Meri's request bound) and is consumed by exactly one owner run.
 CHECK (expires_at_s > issued_at_s AND expires_at_s - issued_at_s <= 30),
 CHECK ((jsonb_typeof(binding) = 'object' AND binding->>'tenantId' = tenant_id AND binding->>'actorId' = owner_actor_id) IS TRUE)
);
CREATE FUNCTION meri_schedules.guard_run_cancel_proof() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog AS $$
BEGIN
 RAISE EXCEPTION 'SCHEDULE_RUN_CANCEL_PROOF_IMMUTABLE';
END $$;
CREATE TRIGGER guarded_run_cancel_proof BEFORE UPDATE OR DELETE ON meri_schedules.run_cancel_proofs
 FOR EACH ROW EXECUTE FUNCTION meri_schedules.guard_run_cancel_proof();
CREATE TRIGGER guarded_run_cancel_proof_truncate BEFORE TRUNCATE ON meri_schedules.run_cancel_proofs
 FOR EACH STATEMENT EXECUTE FUNCTION meri_schedules.guard_run_cancel_proof();
COMMIT;
