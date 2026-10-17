-- RESERVED SOURCE AUTHORING ONLY, 16 October 2026. Parent-approved numbering; NOT DDL or execution acceptance.
-- No runtime applies this file. No roles, grants, credentials, seeds or SQL execution are authorized.
-- Mapping: docs/coordination/reports/DOT-RESERVED-MEMORY-SETTINGS-20261016.md.

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
