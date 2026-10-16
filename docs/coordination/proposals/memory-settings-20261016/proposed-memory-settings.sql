-- PROPOSED DDL ONLY: memory producer journal and persisted settings (Fable, 16 October 2026).
-- No migration ID is allocated and this file is never executed by the source. dot/Codex allocate the ID and owning namespace.
-- Owners: apps/control/memory/postgres-journal.mjs and apps/control/settings/postgres-store.mjs. No role, grant or seed row.

CREATE SCHEMA meri_memory;

-- Producer outbox. The candidate and its hash are written once; only the submission columns move. Review status lives in Core.
CREATE TABLE meri_memory.candidates (
  tenant_id         text        NOT NULL CHECK (length(tenant_id) BETWEEN 1 AND 128),
  candidate_id      uuid        NOT NULL,
  proposer_actor_id text        NOT NULL CHECK (length(proposer_actor_id) BETWEEN 1 AND 128),
  idempotency_key   text        NOT NULL CHECK (length(idempotency_key) BETWEEN 1 AND 128),
  request_sha256    char(64)    NOT NULL CHECK (request_sha256 ~ '^[a-f0-9]{64}$'),
  candidate         jsonb       NOT NULL,
  candidate_sha256  char(64)    NOT NULL CHECK (candidate_sha256 ~ '^[a-f0-9]{64}$'),
  scope             text        NOT NULL CHECK (scope IN ('personal','client','firm')),
  client_id         uuid        NULL,
  created_at        timestamptz NOT NULL,
  submission_state  text        NOT NULL CHECK (submission_state IN ('PREPARED','SUBMITTED','SUBMISSION_UNKNOWN')),
  review_id         uuid        NULL,
  submitted_at      timestamptz NULL,
  PRIMARY KEY (tenant_id, candidate_id),
  UNIQUE (tenant_id, proposer_actor_id, idempotency_key),
  CHECK ((scope = 'client') = (client_id IS NOT NULL)),
  CHECK ((submission_state = 'SUBMITTED') = (review_id IS NOT NULL))
);
CREATE INDEX candidates_proposer_recent ON meri_memory.candidates (tenant_id, proposer_actor_id, created_at DESC, candidate_id DESC);

-- Immutability: identity, request and candidate columns can never change after insert.
CREATE FUNCTION meri_memory.candidates_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (NEW.tenant_id, NEW.candidate_id, NEW.proposer_actor_id, NEW.idempotency_key, NEW.request_sha256, NEW.candidate, NEW.candidate_sha256,
      NEW.scope, NEW.client_id, NEW.created_at)
     IS DISTINCT FROM
     (OLD.tenant_id, OLD.candidate_id, OLD.proposer_actor_id, OLD.idempotency_key, OLD.request_sha256, OLD.candidate, OLD.candidate_sha256,
      OLD.scope, OLD.client_id, OLD.created_at) THEN
    RAISE EXCEPTION 'memory candidates are immutable';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER candidates_immutable BEFORE UPDATE ON meri_memory.candidates FOR EACH ROW EXECUTE FUNCTION meri_memory.candidates_immutable();

CREATE SCHEMA meri_settings;

CREATE TABLE meri_settings.user_preferences (
  tenant_id       text        NOT NULL CHECK (length(tenant_id) BETWEEN 1 AND 128),
  actor_id        text        NOT NULL CHECK (length(actor_id) BETWEEN 1 AND 128),
  revision        bigint      NOT NULL CHECK (revision >= 1),
  document        jsonb       NOT NULL,
  document_sha256 char(64)    NOT NULL CHECK (document_sha256 ~ '^[a-f0-9]{64}$'),
  updated_at      timestamptz NOT NULL,
  updated_by      text        NOT NULL,
  PRIMARY KEY (tenant_id, actor_id)
);

CREATE TABLE meri_settings.tenant_settings (
  tenant_id       text        PRIMARY KEY CHECK (length(tenant_id) BETWEEN 1 AND 128),
  revision        bigint      NOT NULL CHECK (revision >= 1),
  document        jsonb       NOT NULL,
  document_sha256 char(64)    NOT NULL CHECK (document_sha256 ~ '^[a-f0-9]{64}$'),
  updated_at      timestamptz NOT NULL,
  updated_by      text        NOT NULL
);

-- Audit rows are never rewritten: paths and hashes only, never values. DELETE stays available to the retention/deletion owner.
CREATE TABLE meri_settings.settings_audit (
  sequence         bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  audit_id         uuid        NOT NULL UNIQUE,
  tenant_id        text        NOT NULL,
  target           text        NOT NULL CHECK (target IN ('user','tenant')),
  subject_actor_id text        NULL,
  actor_id         text        NOT NULL,
  from_revision    bigint      NOT NULL CHECK (from_revision >= 0),
  to_revision      bigint      NOT NULL CHECK (to_revision = from_revision + 1),
  before_sha256    char(64)    NULL,
  after_sha256     char(64)    NOT NULL,
  platform_sha256  char(64)    NULL,
  changed_fields   text[]      NOT NULL,
  recorded_at      timestamptz NOT NULL,
  CHECK ((target = 'user') = (subject_actor_id IS NOT NULL)),
  CHECK ((target = 'tenant') = (platform_sha256 IS NOT NULL)),
  CHECK ((from_revision = 0) = (before_sha256 IS NULL))
);
CREATE INDEX settings_audit_tenant_recent ON meri_settings.settings_audit (tenant_id, sequence DESC);
CREATE FUNCTION meri_settings.audit_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'settings audit rows are immutable'; END $$;
CREATE TRIGGER settings_audit_append_only BEFORE UPDATE ON meri_settings.settings_audit FOR EACH ROW EXECUTE FUNCTION meri_settings.audit_append_only();
