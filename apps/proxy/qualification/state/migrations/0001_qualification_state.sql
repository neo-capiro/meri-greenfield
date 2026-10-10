-- Qualification-only owner migration. No DROP, IF NOT EXISTS or product schema.
CREATE SCHEMA meri_qualification;
CREATE TABLE meri_qualification.budget (
  id integer PRIMARY KEY CHECK (id=1),
  cap_micro_usd bigint NOT NULL CHECK (cap_micro_usd=10000000),
  consumed_micro_usd bigint NOT NULL DEFAULT 0 CHECK (consumed_micro_usd>=0),
  quarantined boolean NOT NULL DEFAULT false
);
INSERT INTO meri_qualification.budget(id,cap_micro_usd) VALUES(1,10000000);
CREATE TABLE meri_qualification.runs (
  run_id uuid PRIMARY KEY, attempt integer NOT NULL CHECK(attempt>0),
  worker_arn text NOT NULL, fence integer NOT NULL CHECK(fence>0),
  policy_revision char(64) NOT NULL CHECK(policy_revision ~ '^[0-9a-f]{64}$')
);
CREATE TABLE meri_qualification.grants (
  grant_id uuid PRIMARY KEY, run_id uuid NOT NULL REFERENCES meri_qualification.runs,
  attempt integer NOT NULL CHECK(attempt>0), worker_arn text NOT NULL,
  fence integer NOT NULL CHECK(fence>0), policy_revision char(64) NOT NULL,
  capability_sha256 char(64) UNIQUE NOT NULL CHECK(capability_sha256 ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz NOT NULL, state text NOT NULL CHECK(state IN ('PENDING','ACTIVE','REVOKED'))
);
CREATE TABLE meri_qualification.requests (
  request_id varchar(128) PRIMARY KEY, grant_id uuid NOT NULL REFERENCES meri_qualification.grants,
  run_id uuid NOT NULL, attempt integer NOT NULL, worker_arn text NOT NULL,
  fence integer NOT NULL, policy_revision char(64) NOT NULL,
  native_body_sha256 char(64) NOT NULL, raw_request_sha256 char(64) NOT NULL,
  model_id text NOT NULL, profile_id text NOT NULL,
  pricing_revision char(64) NOT NULL, pricing_valid_until timestamptz NOT NULL,
  input_tokens integer NOT NULL CHECK(input_tokens BETWEEN 1 AND 8192),
  max_output_tokens integer NOT NULL CHECK(max_output_tokens BETWEEN 1 AND 256),
  hold_micro_usd bigint NOT NULL CHECK(hold_micro_usd>0),
  state text NOT NULL CHECK(state IN ('UNKNOWN','SETTLED','NO_DISPATCH')),
  actual_micro_usd bigint CHECK(actual_micro_usd>=0),
  evidence_sha256 char(64), created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  settled_at timestamptz,
  CHECK ((state='UNKNOWN' AND actual_micro_usd IS NULL AND evidence_sha256 IS NULL AND settled_at IS NULL)
      OR (state<>'UNKNOWN' AND actual_micro_usd IS NOT NULL AND evidence_sha256 IS NOT NULL AND settled_at IS NOT NULL))
);
CREATE UNIQUE INDEX one_unknown_per_grant ON meri_qualification.requests(grant_id) WHERE state='UNKNOWN';
