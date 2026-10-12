-- Explicit qualification-only upgrade. Apply only after 0001 by the trusted owner.
-- Positive tool charges are conservative accounting, not provider actual usage.
CREATE TABLE meri_qualification.tool_run_allocations (
  run_id uuid PRIMARY KEY REFERENCES meri_qualification.runs,
  allocation_sha256 char(64) NOT NULL CHECK(allocation_sha256 ~ '^[0-9a-f]{64}$'),
  allocation jsonb NOT NULL,
  started_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  max_tool_calls bigint NOT NULL CHECK(max_tool_calls>0),
  max_cost_micro_usd bigint NOT NULL CHECK(max_cost_micro_usd>0)
);
CREATE TABLE meri_qualification.tool_grant_bindings (
  grant_id uuid PRIMARY KEY REFERENCES meri_qualification.grants,
  run_id uuid NOT NULL REFERENCES meri_qualification.tool_run_allocations,
  facts jsonb NOT NULL
);
CREATE TABLE meri_qualification.tool_reservations (
  invocation_id varchar(128) PRIMARY KEY,
  reservation_id uuid UNIQUE NOT NULL,
  grant_id uuid NOT NULL REFERENCES meri_qualification.tool_grant_bindings,
  run_id uuid NOT NULL REFERENCES meri_qualification.tool_run_allocations,
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
CREATE UNIQUE INDEX one_unknown_tool_per_grant ON meri_qualification.tool_reservations(grant_id) WHERE state='UNKNOWN';
CREATE VIEW meri_qualification.budget_liabilities AS
  SELECT 'model'::text AS kind,request_id::text AS slot,run_id,grant_id,state,hold_micro_usd,
         COALESCE(actual_micro_usd,0) AS consumed_micro_usd
    FROM meri_qualification.requests
  UNION ALL
  SELECT 'tool'::text AS kind,invocation_id::text AS slot,run_id,grant_id,state,hold_micro_usd,
         COALESCE(charged_micro_usd,0) AS consumed_micro_usd
    FROM meri_qualification.tool_reservations;
