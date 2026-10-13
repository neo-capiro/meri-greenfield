-- Product namespace DDL ONLY. Root allocated0001; not applied by runtime/import.
-- Canonical authority/accounting/provenance structures, no data/roles/grants/seeds.
-- Native owner must separately admit isolated schema, ledger cap, runs and grants.
CREATE SCHEMA meri_product_budget;
CREATE TABLE meri_product_budget.budget (
  id integer PRIMARY KEY CHECK (id=1),
  cap_micro_usd bigint NOT NULL CHECK (cap_micro_usd>0),
  consumed_micro_usd bigint NOT NULL DEFAULT 0 CHECK (consumed_micro_usd>=0),
  quarantined boolean NOT NULL DEFAULT false
);
CREATE TABLE meri_product_budget.runs (
  run_id uuid PRIMARY KEY, attempt integer NOT NULL CHECK(attempt>0),
  worker_arn text NOT NULL, fence integer NOT NULL CHECK(fence>0),
  policy_revision char(64) NOT NULL CHECK(policy_revision ~ '^[0-9a-f]{64}$')
);
CREATE TABLE meri_product_budget.grants (
  grant_id uuid PRIMARY KEY, run_id uuid NOT NULL REFERENCES meri_product_budget.runs,
  attempt integer NOT NULL CHECK(attempt>0), worker_arn text NOT NULL,
  fence integer NOT NULL CHECK(fence>0), policy_revision char(64) NOT NULL,
  capability_sha256 char(64) UNIQUE NOT NULL CHECK(capability_sha256 ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz NOT NULL, state text NOT NULL CHECK(state IN ('PENDING','ACTIVE','REVOKED'))
);
CREATE TABLE meri_product_budget.requests (
  request_id varchar(128) PRIMARY KEY, grant_id uuid NOT NULL REFERENCES meri_product_budget.grants,
  run_id uuid NOT NULL, attempt integer NOT NULL, worker_arn text NOT NULL,
  fence integer NOT NULL, policy_revision char(64) NOT NULL,
  native_body_sha256 char(64) NOT NULL, raw_request_sha256 char(64) NOT NULL,
  model_id text NOT NULL, profile_id text NOT NULL,
  pricing_revision char(64) NOT NULL, pricing_valid_until timestamptz NOT NULL,
  input_tokens integer NOT NULL CHECK(input_tokens>0),
  max_output_tokens integer NOT NULL CHECK(max_output_tokens>0),
  hold_micro_usd bigint NOT NULL CHECK(hold_micro_usd>0),
  state text NOT NULL CHECK(state IN ('UNKNOWN','SETTLED','NO_DISPATCH')),
  actual_micro_usd bigint CHECK(actual_micro_usd>=0),
  evidence_sha256 char(64), created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  settled_at timestamptz,
  CHECK ((state='UNKNOWN' AND actual_micro_usd IS NULL AND evidence_sha256 IS NULL AND settled_at IS NULL)
      OR (state<>'UNKNOWN' AND actual_micro_usd IS NOT NULL AND evidence_sha256 IS NOT NULL AND settled_at IS NOT NULL))
);
CREATE UNIQUE INDEX one_unknown_per_grant ON meri_product_budget.requests(grant_id) WHERE state='UNKNOWN';
CREATE TABLE meri_product_budget.tool_run_allocations (
  run_id uuid PRIMARY KEY REFERENCES meri_product_budget.runs,
  allocation_sha256 char(64) NOT NULL CHECK(allocation_sha256 ~ '^[0-9a-f]{64}$'),
  allocation jsonb NOT NULL,
  started_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  max_tool_calls bigint NOT NULL CHECK(max_tool_calls>0),
  max_cost_micro_usd bigint NOT NULL CHECK(max_cost_micro_usd>0)
);
CREATE TABLE meri_product_budget.tool_grant_bindings (
  grant_id uuid PRIMARY KEY REFERENCES meri_product_budget.grants,
  run_id uuid NOT NULL REFERENCES meri_product_budget.tool_run_allocations,
  facts jsonb NOT NULL
);
CREATE TABLE meri_product_budget.tool_reservations (
  invocation_id varchar(128) PRIMARY KEY,
  reservation_id uuid UNIQUE NOT NULL,
  grant_id uuid NOT NULL REFERENCES meri_product_budget.tool_grant_bindings,
  run_id uuid NOT NULL REFERENCES meri_product_budget.tool_run_allocations,
  facts jsonb NOT NULL, operation jsonb NOT NULL,
  arguments_sha256 char(64) NOT NULL CHECK(arguments_sha256 ~ '^[0-9a-f]{64}$'),
  hold_micro_usd bigint NOT NULL CHECK(hold_micro_usd>0),
  max_output_bytes bigint NOT NULL CHECK(max_output_bytes>0),
  state text NOT NULL CHECK(state IN ('UNKNOWN','SETTLED')),
  charged_micro_usd bigint CHECK(charged_micro_usd>0),
  output_bytes bigint CHECK(output_bytes>=0),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(), settled_at timestamptz,
  CHECK ((state='UNKNOWN' AND charged_micro_usd IS NULL AND output_bytes IS NULL AND settled_at IS NULL)
    OR (state='SETTLED' AND charged_micro_usd=hold_micro_usd AND output_bytes IS NOT NULL AND settled_at IS NOT NULL))
);
CREATE UNIQUE INDEX one_unknown_tool_per_grant ON meri_product_budget.tool_reservations(grant_id) WHERE state='UNKNOWN';
CREATE VIEW meri_product_budget.budget_liabilities AS
  SELECT 'model'::text AS kind,request_id::text AS slot,run_id,grant_id,state,hold_micro_usd,
         COALESCE(actual_micro_usd,0) AS consumed_micro_usd
    FROM meri_product_budget.requests
  UNION ALL
  SELECT 'tool'::text AS kind,invocation_id::text AS slot,run_id,grant_id,state,hold_micro_usd,
         COALESCE(charged_micro_usd,0) AS consumed_micro_usd
    FROM meri_product_budget.tool_reservations;
CREATE TABLE meri_product_budget.tool_invocations (
  invocation_id varchar(128) PRIMARY KEY CHECK(invocation_id ~ '^owned_[0-9a-f-]{36}$'),
  run_id uuid NOT NULL REFERENCES meri_product_budget.tool_run_allocations,
  producer_key_sha256 char(64) NOT NULL CHECK(producer_key_sha256 ~ '^[0-9a-f]{64}$'),
  delivery jsonb NOT NULL, facts jsonb NOT NULL,
  raw_request_sha256 char(64) NOT NULL CHECK(raw_request_sha256 ~ '^[0-9a-f]{64}$'),
  operation jsonb NOT NULL,
  deadline_ms bigint NOT NULL CHECK(deadline_ms>0),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  reservation_id uuid UNIQUE REFERENCES meri_product_budget.tool_reservations(reservation_id),
  arguments_sha256 char(64) CHECK(arguments_sha256 ~ '^[0-9a-f]{64}$'),
  completion jsonb,
  UNIQUE(run_id,producer_key_sha256),
  CHECK ((reservation_id IS NULL AND arguments_sha256 IS NULL AND completion IS NULL)
    OR (reservation_id IS NOT NULL AND arguments_sha256 IS NOT NULL))
);
