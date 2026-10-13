-- Centrally allocated isolated product artifact versions; no qualification/native DB use.
BEGIN;
CREATE SCHEMA IF NOT EXISTS meri_artifacts;
CREATE TABLE meri_artifacts.versions (
 version_id uuid PRIMARY KEY, artifact_id uuid NOT NULL, tenant_id text NOT NULL,
 actor_id text NOT NULL, conversation_id uuid NOT NULL, request_sha256 text NOT NULL CHECK(request_sha256 ~ '^[a-f0-9]{64}$'),
 record jsonb NOT NULL, record_sha256 text NOT NULL CHECK(record_sha256 ~ '^[a-f0-9]{64}$')
);
CREATE INDEX artifact_versions_request ON meri_artifacts.versions(request_sha256,version_id);
CREATE FUNCTION meri_artifacts.reject_version_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'MERI_ARTIFACT_VERSION_IMMUTABLE'; END $$;
CREATE TRIGGER immutable_artifact_versions BEFORE UPDATE OR DELETE ON meri_artifacts.versions
FOR EACH ROW EXECUTE FUNCTION meri_artifacts.reject_version_mutation();
CREATE TABLE meri_artifacts.heads (
 artifact_id uuid PRIMARY KEY, version_id uuid NOT NULL REFERENCES meri_artifacts.versions(version_id),
 tenant_id text NOT NULL, actor_id text NOT NULL, conversation_id uuid NOT NULL,
 projection jsonb NOT NULL, projection_sha256 text NOT NULL CHECK(projection_sha256 ~ '^[a-f0-9]{64}$')
);
COMMIT;
