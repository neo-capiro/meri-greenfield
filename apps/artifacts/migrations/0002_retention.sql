-- Artifact retention: restorable projection of the authoritative retention ledger for artifact subjects and the trigger amendment
-- that admits a physical purge DELETE of an immutable artifact version only inside a transaction holding a matching PLANNED purge
-- row for that exact version. Additive. Migration ID 0002 centrally reserved for this work on 15 October 2026
-- (docs/coordination/tasks/CODEX-CENTRAL-MIGRATION-ALLOCATION-20261015.md); source only, no application authority.
BEGIN;
CREATE TABLE meri_artifacts.retention_subjects (
 tenant_id text NOT NULL, artifact_id uuid NOT NULL, owner_actor_id text NOT NULL,
 state text NOT NULL CHECK (state IN ('SUPPRESSED','RELEASED')),
 suppressed_at timestamptz, released_at timestamptz,
 ledger_sequence bigint NOT NULL CHECK (ledger_sequence >= 1),
 entry_sha256 text NOT NULL CHECK (entry_sha256 ~ '^[a-f0-9]{64}$'),
 projection jsonb NOT NULL, projection_sha256 text NOT NULL CHECK (projection_sha256 ~ '^[a-f0-9]{64}$'),
 PRIMARY KEY (tenant_id, artifact_id),
 CHECK ((state = 'SUPPRESSED') = (suppressed_at IS NOT NULL))
);
CREATE TABLE meri_artifacts.retention_purges (
 workflow_id text PRIMARY KEY CHECK (workflow_id ~ '^[a-f0-9]{64}$'),
 tenant_id text NOT NULL, artifact_id uuid NOT NULL,
 version_id uuid NOT NULL, object_id uuid NOT NULL, object_version_id text NOT NULL CHECK (length(object_version_id) BETWEEN 1 AND 1024),
 sha256 text NOT NULL CHECK (sha256 ~ '^[a-f0-9]{64}$'),
 plan_sha256 text NOT NULL CHECK (plan_sha256 ~ '^[a-f0-9]{64}$'),
 state text NOT NULL CHECK (state IN ('PLANNED','BLOCKED','UNKNOWN','EXECUTED')),
 receipt jsonb, receipt_sha256 text CHECK (receipt_sha256 IS NULL OR receipt_sha256 ~ '^[a-f0-9]{64}$'),
 ledger_sequence bigint NOT NULL CHECK (ledger_sequence >= 1),
 FOREIGN KEY (tenant_id, artifact_id) REFERENCES meri_artifacts.retention_subjects,
 CHECK ((receipt IS NULL) = (receipt_sha256 IS NULL))
);
CREATE INDEX artifact_retention_purges_subject ON meri_artifacts.retention_purges(tenant_id, artifact_id, state);
-- Immutability amendment: an artifact version row may be deleted only by the transaction that already recorded a PLANNED purge
-- for that exact version; UPDATE remains refused unconditionally. A head still referencing the version refuses the delete through
-- its foreign key, so the owner retires the head first.
CREATE OR REPLACE FUNCTION meri_artifacts.reject_version_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP = 'DELETE' AND EXISTS (
  SELECT 1 FROM meri_artifacts.retention_purges p
  WHERE p.tenant_id = OLD.tenant_id AND p.artifact_id = OLD.artifact_id AND p.version_id = OLD.version_id AND p.state = 'PLANNED'
    AND p.xmin = pg_current_xact_id()::xid
 ) THEN RETURN OLD; END IF;
 RAISE EXCEPTION 'MERI_ARTIFACT_VERSION_IMMUTABLE';
END $$;
COMMIT;
