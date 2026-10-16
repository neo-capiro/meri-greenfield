-- Source-only allocation: CODEX-PACKAGE4-CENTRAL-MIGRATION-ALLOCATIONS-20261016.md
-- at0b0b7abd536a27a74e3b1077ae71eed6e0ba275b (initial reservation641f2980; authoring releasee5b1116f).
-- No application, grants, deployed adapter or retention/purge authority. Original claim identity never expires into retry.
BEGIN;
-- record_sha256 hashes the storage envelope, NOT the canonical ArtifactVersion. Do not use it as source_version_sha256.
ALTER TABLE meri_artifacts.versions ADD CONSTRAINT artifact_versions_preview_identity
 UNIQUE (tenant_id, conversation_id, artifact_id, version_id);

CREATE TABLE meri_artifacts.preview_attempts (
 tenant_id text NOT NULL, conversation_id uuid NOT NULL, artifact_id uuid NOT NULL, version_id uuid NOT NULL,
 source_version_sha256 text NOT NULL CHECK (source_version_sha256 ~ '^[a-f0-9]{64}$'),
 source_sha256 text NOT NULL CHECK (source_sha256 ~ '^[a-f0-9]{64}$'),
 preview_id uuid NOT NULL, object_id uuid NOT NULL,
 claim jsonb NOT NULL, claim_sha256 text NOT NULL CHECK (claim_sha256 ~ '^[a-f0-9]{64}$'),
 -- NULL means a potential orphan: the allocated object may have been written without an acknowledged physical version.
 object_reference jsonb, object_reference_sha256 text CHECK (object_reference_sha256 ~ '^[a-f0-9]{64}$'),
 object_version_id text CHECK (length(object_version_id) > 0),
 PRIMARY KEY (tenant_id, version_id), UNIQUE (tenant_id, preview_id), UNIQUE (tenant_id, object_id),
 UNIQUE (tenant_id, version_id, preview_id, claim_sha256, object_reference_sha256),
 FOREIGN KEY (tenant_id, conversation_id, artifact_id, version_id)
  REFERENCES meri_artifacts.versions (tenant_id, conversation_id, artifact_id, version_id),
 CHECK (jsonb_typeof(claim) IS NOT DISTINCT FROM 'object'),
 CHECK ((claim ->> 'claimVersion') IS NOT DISTINCT FROM 'meri.artifact-preview-claim.proposal-1'),
 CHECK ((claim ->> 'tenantId') IS NOT DISTINCT FROM tenant_id),
 CHECK ((claim ->> 'conversationId')::uuid IS NOT DISTINCT FROM conversation_id),
 CHECK ((claim ->> 'artifactId')::uuid IS NOT DISTINCT FROM artifact_id),
 CHECK ((claim ->> 'versionId')::uuid IS NOT DISTINCT FROM version_id),
 CHECK ((claim ->> 'previewId')::uuid IS NOT DISTINCT FROM preview_id),
 CHECK ((claim ->> 'objectId')::uuid IS NOT DISTINCT FROM object_id),
 CHECK ((claim ->> 'sourceVersionSha256') IS NOT DISTINCT FROM source_version_sha256),
 CHECK ((claim ->> 'sourceSha256') IS NOT DISTINCT FROM source_sha256),
 CHECK ((claim #>> '{binding,tenantId}') IS NOT DISTINCT FROM tenant_id),
 CHECK ((claim #>> '{binding,conversationId}')::uuid IS NOT DISTINCT FROM conversation_id),
 CHECK ((object_reference IS NULL) = (object_reference_sha256 IS NULL)),
 CHECK ((object_reference IS NULL) = (object_version_id IS NULL)),
 CHECK (object_reference IS NULL OR (
  jsonb_typeof(object_reference) IS NOT DISTINCT FROM 'object'
  AND (object_reference ->> 'objectId')::uuid IS NOT DISTINCT FROM object_id
  AND (object_reference ->> 'versionId') IS NOT DISTINCT FROM object_version_id
  AND ((object_reference ->> 'sha256') ~ '^[a-f0-9]{64}$') IS TRUE
  AND (object_reference -> 'scopes') IS NOT DISTINCT FROM (claim -> 'scopes')
 ))
);

CREATE FUNCTION meri_artifacts.guard_preview_attempt() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE source_version jsonb;
BEGIN
 IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'MERI_PREVIEW_RETENTION_UNALLOCATED'; END IF;
 IF TG_OP = 'UPDATE' THEN
  -- Only the first known physical object receipt may be added. Original binding/deadline/allocation stay unchanged.
  IF (to_jsonb(NEW) - 'object_reference' - 'object_reference_sha256' - 'object_version_id') IS DISTINCT FROM
     (to_jsonb(OLD) - 'object_reference' - 'object_reference_sha256' - 'object_version_id')
   OR (OLD.object_reference IS NOT NULL AND
       ROW(NEW.object_reference, NEW.object_reference_sha256, NEW.object_version_id) IS DISTINCT FROM
       ROW(OLD.object_reference, OLD.object_reference_sha256, OLD.object_version_id))
  THEN RAISE EXCEPTION 'MERI_PREVIEW_CLAIM_IMMUTABLE'; END IF;
  RETURN NEW;
 END IF;
 -- A new claim starts with potential custody only; object dispatch must follow acknowledged insertion.
 IF NEW.object_reference IS NOT NULL THEN RAISE EXCEPTION 'MERI_PREVIEW_CLAIM_REQUIRED'; END IF;
 SELECT v.record -> 'version' INTO source_version FROM meri_artifacts.versions v
  WHERE v.tenant_id = NEW.tenant_id AND v.conversation_id = NEW.conversation_id
   AND v.artifact_id = NEW.artifact_id AND v.version_id = NEW.version_id FOR KEY SHARE;
 IF NOT FOUND OR (source_version #>> '{object,sha256}') IS DISTINCT FROM NEW.source_sha256
  OR (source_version -> 'scopes') IS DISTINCT FROM (NEW.claim -> 'scopes')
 THEN RAISE EXCEPTION 'MERI_PREVIEW_SOURCE_MISMATCH'; END IF;
 -- The trusted adapter must also validate canonical sourceVersionSha256 and claim_sha256; SQL has no canonical JSON hasher.
 RETURN NEW;
END $$;
CREATE TRIGGER guarded_preview_attempt BEFORE INSERT OR UPDATE OR DELETE ON meri_artifacts.preview_attempts
 FOR EACH ROW EXECUTE FUNCTION meri_artifacts.guard_preview_attempt();

CREATE TABLE meri_artifacts.previews (
 tenant_id text NOT NULL, conversation_id uuid NOT NULL, artifact_id uuid NOT NULL, version_id uuid NOT NULL,
 source_version_sha256 text NOT NULL CHECK (source_version_sha256 ~ '^[a-f0-9]{64}$'),
 source_sha256 text NOT NULL CHECK (source_sha256 ~ '^[a-f0-9]{64}$'),
 preview_id uuid NOT NULL, claim_sha256 text NOT NULL CHECK (claim_sha256 ~ '^[a-f0-9]{64}$'),
 object_reference_sha256 text NOT NULL CHECK (object_reference_sha256 ~ '^[a-f0-9]{64}$'),
 record jsonb NOT NULL, record_sha256 text NOT NULL CHECK (record_sha256 ~ '^[a-f0-9]{64}$'),
 PRIMARY KEY (tenant_id, version_id), UNIQUE (tenant_id, preview_id),
 FOREIGN KEY (tenant_id, conversation_id, artifact_id, version_id)
  REFERENCES meri_artifacts.versions (tenant_id, conversation_id, artifact_id, version_id),
 FOREIGN KEY (tenant_id, version_id, preview_id, claim_sha256, object_reference_sha256)
  REFERENCES meri_artifacts.preview_attempts (tenant_id, version_id, preview_id, claim_sha256, object_reference_sha256),
 CHECK (jsonb_typeof(record) IS NOT DISTINCT FROM 'object'),
 CHECK ((record ->> 'recordVersion') IS NOT DISTINCT FROM 'meri.artifact-preview.proposal-1'),
 CHECK ((record ->> 'tenantId') IS NOT DISTINCT FROM tenant_id),
 CHECK ((record ->> 'conversationId')::uuid IS NOT DISTINCT FROM conversation_id),
 CHECK ((record ->> 'artifactId')::uuid IS NOT DISTINCT FROM artifact_id),
 CHECK ((record ->> 'versionId')::uuid IS NOT DISTINCT FROM version_id),
 CHECK ((record ->> 'previewId')::uuid IS NOT DISTINCT FROM preview_id),
 CHECK ((record #>> '{source,sha256}') IS NOT DISTINCT FROM source_sha256),
 CHECK ((record ->> 'status') IS NOT DISTINCT FROM 'published'),
 CHECK ((record -> 'nativeQualified') IS NOT DISTINCT FROM 'false'::jsonb)
);

CREATE FUNCTION meri_artifacts.guard_preview_record() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE attempt meri_artifacts.preview_attempts%ROWTYPE;
BEGIN
 IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'MERI_PREVIEW_RECORD_IMMUTABLE'; END IF;
 SELECT * INTO attempt FROM meri_artifacts.preview_attempts a
  WHERE a.tenant_id = NEW.tenant_id AND a.version_id = NEW.version_id FOR KEY SHARE;
 IF NOT FOUND OR attempt.object_reference IS NULL
  OR attempt.source_version_sha256 IS DISTINCT FROM NEW.source_version_sha256
  OR attempt.source_sha256 IS DISTINCT FROM NEW.source_sha256
  OR attempt.object_reference IS DISTINCT FROM (NEW.record #> '{preview,object}')
 THEN RAISE EXCEPTION 'MERI_PREVIEW_CUSTODY_REQUIRED'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER guarded_preview_record BEFORE INSERT OR UPDATE OR DELETE ON meri_artifacts.previews
 FOR EACH ROW EXECUTE FUNCTION meri_artifacts.guard_preview_record();

-- Trusted inventory only. UNKNOWN (known orphan or potential orphan) never expires or authorizes another dispatch.
-- No retention owner consumes this view yet; preview row deletion and deletion of referenced source versions remain blocked.
CREATE VIEW meri_artifacts.preview_custody AS
 SELECT a.tenant_id, a.conversation_id, a.artifact_id, a.version_id, a.source_version_sha256,
  a.claim, a.claim_sha256, a.object_id, a.object_reference, a.object_reference_sha256, a.object_version_id,
  p.record, p.record_sha256,
  CASE WHEN p.version_id IS NULL THEN 'UNKNOWN' ELSE 'COMMITTED' END AS state,
  (a.object_reference IS NULL) AS potential_orphan
 FROM meri_artifacts.preview_attempts a LEFT JOIN meri_artifacts.previews p
  ON p.tenant_id = a.tenant_id AND p.version_id = a.version_id;
COMMIT;
