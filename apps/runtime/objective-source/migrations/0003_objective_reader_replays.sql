-- SOURCE ONLY. Durable (issuer, subject, jti) replay store for Core's signed Objective reader v2 tokens (reader-gate.mjs
-- idempotency.runOnce). Proposed next path in the independent objective-source family; it needs its central ledger
-- reservation before any apply. CREATE only: no existing object is altered or dropped.
-- No startup apply, roles, grants, credentials or production authority are supplied here. Requires 0001 (schema).
BEGIN;
CREATE TABLE meri_objective_source.reader_replays (
 issuer text NOT NULL CHECK (length(issuer) BETWEEN 1 AND 256),
 subject text NOT NULL CHECK (length(subject) BETWEEN 1 AND 256),
 token_id uuid NOT NULL,
 tenant_id text NOT NULL CHECK (length(tenant_id) BETWEEN 1 AND 128),
 generation_job_id uuid NOT NULL,
 purpose text NOT NULL CHECK (purpose IN ('active-source','historical-source','retained-result')),
 identity jsonb NOT NULL,
 identity_sha256 text NOT NULL CHECK (identity_sha256 ~ '^[a-f0-9]{64}$'),
 source jsonb NOT NULL,
 source_sha256 text NOT NULL CHECK (source_sha256 ~ '^[a-f0-9]{64}$'),
 signed_token_sha256 text NOT NULL CHECK (signed_token_sha256 ~ '^[a-f0-9]{64}$'),
 token_expires_at_ms bigint NOT NULL CHECK (token_expires_at_ms BETWEEN 1 AND 9007199254740991),
 state text NOT NULL CHECK (state IN ('CLAIMED','COMMITTED')),
 claim_fence uuid NOT NULL,
 version bigint NOT NULL CHECK (version IN (1,2)),
 value jsonb,
 value_sha256 text,
 claimed_at timestamptz NOT NULL DEFAULT clock_timestamp() CHECK (isfinite(claimed_at)),
 committed_at timestamptz CHECK (committed_at IS NULL OR isfinite(committed_at)),
 PRIMARY KEY (issuer, subject, token_id),
 CHECK ((state = 'CLAIMED' AND version = 1 AND value IS NULL AND value_sha256 IS NULL AND committed_at IS NULL) OR
        (state = 'COMMITTED' AND version = 2 AND value IS NOT NULL AND value_sha256 ~ '^[a-f0-9]{64}$' AND
         committed_at IS NOT NULL AND committed_at >= claimed_at)),
 -- The released value is a reader v2 response (at most 4 MiB serialized); this is a storage backstop only.
 CHECK (value IS NULL OR (jsonb_typeof(value) = 'object' AND octet_length(value::text) <= 8388608)),
 -- Closed gate identity with duplicated locators. JavaScript recomputes identity_sha256/source_sha256 and sourceSha256 (JCS).
 CHECK ((jsonb_typeof(identity) = 'object' AND
  identity ?& ARRAY['issuer','subject','audience','tokenId','signedTokenSha256','purpose','operation','phase','method','path','query',
   'bodySha256','generationJobId','sourceAdmissionSha256','sourceSha256','custodyIdentitySha256','expiresAtMs'] AND
  identity - ARRAY['issuer','subject','audience','tokenId','signedTokenSha256','purpose','operation','phase','method','path','query',
   'bodySha256','generationJobId','sourceAdmissionSha256','sourceSha256','custodyIdentitySha256','expiresAtMs'] = '{}'::jsonb AND
  identity->>'issuer' = issuer AND identity->>'subject' = subject AND identity->>'tokenId' = token_id::text AND
  identity->>'purpose' = purpose AND identity->>'generationJobId' = generation_job_id::text AND
  identity->>'signedTokenSha256' = signed_token_sha256 AND identity->'expiresAtMs' = to_jsonb(token_expires_at_ms) AND
  identity->>'method' = 'POST' AND identity->>'query' = '' AND identity->>'sourceSha256' = source_sha256) IS TRUE),
 CHECK ((jsonb_typeof(source) = 'object' AND
  source ?& ARRAY['generationJobId','binding','sourceAdmissionSha256'] AND
  source - ARRAY['generationJobId','binding','sourceAdmissionSha256'] = '{}'::jsonb AND
  source->>'generationJobId' = generation_job_id::text AND source#>>'{binding,tenantId}' = tenant_id AND
  source->>'sourceAdmissionSha256' = identity->>'sourceAdmissionSha256') IS TRUE)
);

-- Claim once (CLAIMED v1), then exactly one CLAIMED v1 -> COMMITTED v2 with the released value. No deletion, truncation,
-- reclaim or change after commit; a CLAIMED row whose effect outcome is unknown stays CLAIMED (UNKNOWN) forever.
CREATE FUNCTION meri_objective_source.guard_reader_replay() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog AS $$
BEGIN
 IF TG_OP IN ('DELETE','TRUNCATE') THEN RAISE EXCEPTION 'OBJECTIVE_READER_REPLAY_IMMUTABLE'; END IF;
 IF TG_OP = 'INSERT' THEN
  IF NEW.state IS DISTINCT FROM 'CLAIMED' OR NEW.version IS DISTINCT FROM 1 OR NEW.value IS NOT NULL OR
     NEW.value_sha256 IS NOT NULL OR NEW.committed_at IS NOT NULL THEN
   RAISE EXCEPTION 'OBJECTIVE_READER_REPLAY_INITIAL_STATE';
  END IF;
  RETURN NEW;
 END IF;
 IF ROW(NEW.issuer,NEW.subject,NEW.token_id,NEW.tenant_id,NEW.generation_job_id,NEW.purpose,NEW.identity,NEW.identity_sha256,
        NEW.source,NEW.source_sha256,NEW.signed_token_sha256,NEW.token_expires_at_ms,NEW.claim_fence,NEW.claimed_at)
 IS DISTINCT FROM
    ROW(OLD.issuer,OLD.subject,OLD.token_id,OLD.tenant_id,OLD.generation_job_id,OLD.purpose,OLD.identity,OLD.identity_sha256,
        OLD.source,OLD.source_sha256,OLD.signed_token_sha256,OLD.token_expires_at_ms,OLD.claim_fence,OLD.claimed_at) THEN
  RAISE EXCEPTION 'OBJECTIVE_READER_REPLAY_IMMUTABLE';
 END IF;
 IF OLD.state IS DISTINCT FROM 'CLAIMED' OR OLD.version IS DISTINCT FROM 1 OR OLD.value IS NOT NULL OR
    NEW.state IS DISTINCT FROM 'COMMITTED' OR NEW.version IS DISTINCT FROM 2 OR NEW.value IS NULL OR NEW.committed_at IS NULL THEN
  RAISE EXCEPTION 'OBJECTIVE_READER_REPLAY_TRANSITION';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER guarded_reader_replay BEFORE INSERT OR UPDATE OR DELETE ON meri_objective_source.reader_replays
 FOR EACH ROW EXECUTE FUNCTION meri_objective_source.guard_reader_replay();
CREATE TRIGGER guarded_reader_replay_truncate BEFORE TRUNCATE ON meri_objective_source.reader_replays
 FOR EACH STATEMENT EXECUTE FUNCTION meri_objective_source.guard_reader_replay();
COMMIT;
