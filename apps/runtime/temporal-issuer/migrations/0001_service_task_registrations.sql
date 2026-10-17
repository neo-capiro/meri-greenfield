-- Source-only, centrally allocated Temporal service identity owner (2026-10-17).
-- Do not run against an application database without separate role, restore and
-- concurrency qualification. No application principal owns this schema/table.
BEGIN;
CREATE SCHEMA meri_service_identity;
REVOKE ALL ON SCHEMA meri_service_identity FROM PUBLIC;

CREATE TABLE meri_service_identity.service_task_registrations (
 task_arn text PRIMARY KEY CHECK (task_arn ~ '^arn:aws:ecs:[a-z0-9-]+:[0-9]{12}:task/[A-Za-z0-9_-]+/[a-f0-9]{32}$'),
 role text CHECK (role IN ('control','temporal-worker')),
 peer_ipv4 inet CHECK (peer_ipv4 IS NULL OR family(peer_ipv4) = 4),
 revision text CHECK (revision IS NULL OR length(revision) BETWEEN 1 AND 128),
 service_arn text,
 task_definition_arn text,
 image_uri text,
 task_role_arn text,
 execution_role_arn text,
 certificate_sha256 text CHECK (certificate_sha256 IS NULL OR certificate_sha256 ~ '^[a-f0-9]{64}$'),
 peer_san_uri text,
 expires_at_ms bigint CHECK (expires_at_ms IS NULL OR expires_at_ms BETWEEN 1 AND 9007199254740991),
 proof_observed_at_ms bigint CHECK (proof_observed_at_ms IS NULL OR proof_observed_at_ms BETWEEN 0 AND 9007199254740991),
 generation bigint NOT NULL DEFAULT 0 CHECK (generation >= 0),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 revoked_at timestamptz,
 CHECK (
   revoked_at IS NOT NULL OR
   (role IS NOT NULL AND peer_ipv4 IS NOT NULL AND revision IS NOT NULL AND
    service_arn IS NOT NULL AND task_definition_arn IS NOT NULL AND image_uri IS NOT NULL AND
    execution_role_arn IS NOT NULL AND certificate_sha256 IS NOT NULL AND peer_san_uri IS NOT NULL AND
    expires_at_ms IS NOT NULL AND proof_observed_at_ms IS NOT NULL)
 ),
 CHECK ((certificate_sha256 IS NULL AND peer_san_uri IS NULL AND expires_at_ms IS NULL) OR
        (certificate_sha256 IS NOT NULL AND peer_san_uri IS NOT NULL AND expires_at_ms IS NOT NULL)),
 CHECK (revoked_at IS NOT NULL OR generation > 0),
 CHECK (service_arn IS NULL OR length(service_arn) BETWEEN 1 AND 512),
 CHECK (task_definition_arn IS NULL OR length(task_definition_arn) BETWEEN 1 AND 512),
 CHECK (image_uri IS NULL OR length(image_uri) BETWEEN 1 AND 1024),
 CHECK (task_role_arn IS NULL OR length(task_role_arn) BETWEEN 1 AND 512),
 CHECK (execution_role_arn IS NULL OR length(execution_role_arn) BETWEEN 1 AND 512),
 CHECK (peer_san_uri IS NULL OR length(peer_san_uri) BETWEEN 1 AND 1024)
);
CREATE UNIQUE INDEX service_task_registrations_current_certificate_uq
 ON meri_service_identity.service_task_registrations(certificate_sha256)
 WHERE certificate_sha256 IS NOT NULL;
REVOKE ALL ON TABLE meri_service_identity.service_task_registrations FROM PUBLIC;

CREATE FUNCTION meri_service_identity.guard_service_task_registration_change()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP = 'TRUNCATE' OR TG_OP = 'DELETE' THEN
  RAISE EXCEPTION 'SERVICE_TASK_REGISTRATION_PERMANENT';
 END IF;
 IF TG_OP = 'UPDATE' THEN
  IF OLD.revoked_at IS NOT NULL OR
     NEW.task_arn IS DISTINCT FROM OLD.task_arn OR
     NEW.role IS DISTINCT FROM OLD.role OR
     NEW.peer_ipv4 IS DISTINCT FROM OLD.peer_ipv4 OR
     NEW.revision IS DISTINCT FROM OLD.revision OR
     NEW.service_arn IS DISTINCT FROM OLD.service_arn OR
     NEW.task_definition_arn IS DISTINCT FROM OLD.task_definition_arn OR
     NEW.image_uri IS DISTINCT FROM OLD.image_uri OR
     NEW.task_role_arn IS DISTINCT FROM OLD.task_role_arn OR
     NEW.execution_role_arn IS DISTINCT FROM OLD.execution_role_arn OR
     NEW.peer_san_uri IS DISTINCT FROM OLD.peer_san_uri OR
     NEW.created_at IS DISTINCT FROM OLD.created_at OR
     NEW.generation <> OLD.generation + 1 OR
     NEW.updated_at < OLD.updated_at THEN
   RAISE EXCEPTION 'SERVICE_TASK_REGISTRATION_IMMUTABLE';
  END IF;
  IF NEW.revoked_at IS NULL THEN
   IF NEW.certificate_sha256 IS NOT DISTINCT FROM OLD.certificate_sha256 OR
      NEW.expires_at_ms <= OLD.expires_at_ms OR
      NEW.proof_observed_at_ms < OLD.proof_observed_at_ms THEN
    RAISE EXCEPTION 'SERVICE_TASK_REGISTRATION_ROTATION_REFUSED';
   END IF;
  ELSIF NEW.certificate_sha256 IS DISTINCT FROM OLD.certificate_sha256 OR
        NEW.peer_san_uri IS DISTINCT FROM OLD.peer_san_uri OR
        NEW.expires_at_ms IS DISTINCT FROM OLD.expires_at_ms OR
        NEW.proof_observed_at_ms IS DISTINCT FROM OLD.proof_observed_at_ms OR
        NEW.revoked_at < OLD.created_at THEN
   RAISE EXCEPTION 'SERVICE_TASK_REGISTRATION_REVOKE_REFUSED';
  END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER guard_service_task_registration_update BEFORE UPDATE OR DELETE
 ON meri_service_identity.service_task_registrations FOR EACH ROW
 EXECUTE FUNCTION meri_service_identity.guard_service_task_registration_change();
CREATE TRIGGER guard_service_task_registration_truncate BEFORE TRUNCATE
 ON meri_service_identity.service_task_registrations FOR EACH STATEMENT
 EXECUTE FUNCTION meri_service_identity.guard_service_task_registration_change();

-- Deployment must pin a dedicated issuer LOGIN role with NOINHERIT,
-- NOSUPERUSER, NOBYPASSRLS, NOCREATEDB, NOCREATEROLE and no broad app/owner
-- membership. This migration deliberately does not create a role or grant it.
-- Grant only that dedicated issuer DB role: schema USAGE;
-- table SELECT, INSERT and UPDATE(certificate_sha256,expires_at_ms,
-- proof_observed_at_ms,generation,updated_at,revoked_at). UPDATE is needed for
-- SELECT FOR UPDATE under PostgreSQL 16. No DELETE/TRUNCATE/DDL or PUBLIC grant.
-- A deployment owner must separately audit actual role membership and primary
-- writer routing before applying this source migration. No seed or purge exists.
-- A point-in-time restore predating a revoke also predates its tombstone. Keep
-- issuer tasks stopped after restore until the deployment owner reconciles the
-- complete revocation log/backup boundary and requalifies primary currentness.
COMMIT;
