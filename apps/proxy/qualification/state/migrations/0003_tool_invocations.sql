-- Qualification-only explicit owner upgrade after 0002; never auto-applied.
-- Invocation provenance is not a second accounting ledger.
CREATE TABLE meri_qualification.tool_invocations (
  invocation_id varchar(128) PRIMARY KEY CHECK(invocation_id ~ '^owned_[0-9a-f-]{36}$'),
  run_id uuid NOT NULL REFERENCES meri_qualification.tool_run_allocations,
  producer_key_sha256 char(64) NOT NULL CHECK(producer_key_sha256 ~ '^[0-9a-f]{64}$'),
  delivery jsonb NOT NULL, facts jsonb NOT NULL,
  raw_request_sha256 char(64) NOT NULL CHECK(raw_request_sha256 ~ '^[0-9a-f]{64}$'),
  operation jsonb NOT NULL,
  deadline_ms bigint NOT NULL CHECK(deadline_ms>0),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  reservation_id uuid UNIQUE REFERENCES meri_qualification.tool_reservations(reservation_id),
  arguments_sha256 char(64) CHECK(arguments_sha256 ~ '^[0-9a-f]{64}$'),
  completion jsonb,
  UNIQUE(run_id,producer_key_sha256),
  CHECK ((reservation_id IS NULL AND arguments_sha256 IS NULL AND completion IS NULL)
    OR (reservation_id IS NOT NULL AND arguments_sha256 IS NOT NULL))
);
