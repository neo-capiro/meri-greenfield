-- Qualification-only current-fence registry schema for the partial
-- sdk-interruption-fixture-v1 experiment. One owner, one schema, one migration.
--
-- Deliberately absent: DROP, TRUNCATE, DELETE, IF NOT EXISTS, reset helpers,
-- CREATE ROLE / GRANT / REVOKE, product or Temporal objects, and any privilege
-- widening. The migration fails outright if the schema already exists, so it can
-- never silently re-initialise a database that holds real qualification state.
--
-- No worker-selected object key, bucket, URL or storage privilege is represented
-- here: the registry stores only the caller-supplied immutable version references
-- that a trusted object store already reread.

CREATE SCHEMA meri_qualification_sdk_fixture;

-- Immutable records are immutable in the database, not merely by convention.
CREATE FUNCTION meri_qualification_sdk_fixture.refuse_immutable_mutation()
RETURNS trigger LANGUAGE plpgsql AS $refuse$
BEGIN
  RAISE EXCEPTION 'qualification record is immutable';
END
$refuse$;

-- The original clock and the stable binding of a run can never be rewritten by a
-- replacement; only the current attempt/fence/grant columns may advance.
CREATE FUNCTION meri_qualification_sdk_fixture.refuse_run_rebinding()
RETURNS trigger LANGUAGE plpgsql AS $rebind$
BEGIN
  IF NEW.run_uuid IS DISTINCT FROM OLD.run_uuid
     OR NEW.session_id IS DISTINCT FROM OLD.session_id
     OR NEW.t0_ms IS DISTINCT FROM OLD.t0_ms
     OR NEW.deadline_ms IS DISTINCT FROM OLD.deadline_ms
     OR NEW.cleanup_deadline_ms IS DISTINCT FROM OLD.cleanup_deadline_ms
     OR NEW.canonical_tenant_id IS DISTINCT FROM OLD.canonical_tenant_id
     OR NEW.canonical_actor_id IS DISTINCT FROM OLD.canonical_actor_id
     OR NEW.canonical_conversation_id IS DISTINCT FROM OLD.canonical_conversation_id
     OR NEW.canonical_run_id IS DISTINCT FROM OLD.canonical_run_id
     OR NEW.source_commit IS DISTINCT FROM OLD.source_commit
     OR NEW.image_digest IS DISTINCT FROM OLD.image_digest
     OR NEW.sdk_version IS DISTINCT FROM OLD.sdk_version
     OR NEW.cli_version IS DISTINCT FROM OLD.cli_version
     OR NEW.contracts_version IS DISTINCT FROM OLD.contracts_version
     OR NEW.contracts_schema_sha256 IS DISTINCT FROM OLD.contracts_schema_sha256
     OR NEW.skills_manifest_sha256 IS DISTINCT FROM OLD.skills_manifest_sha256
     OR NEW.policy_revision IS DISTINCT FROM OLD.policy_revision
     OR NEW.current_attempt <= OLD.current_attempt
     OR NEW.current_fence <= OLD.current_fence
  THEN
    RAISE EXCEPTION 'run binding is not advanceable';
  END IF;
  RETURN NEW;
END
$rebind$;

-- One current attempt/fence/grant/policy per run, plus the original T0/D/C.
CREATE TABLE meri_qualification_sdk_fixture.runs (
  run_uuid uuid PRIMARY KEY,
  session_id uuid NOT NULL,
  t0_ms bigint NOT NULL CHECK (t0_ms BETWEEN 1 AND 9007199254740991),
  deadline_ms bigint NOT NULL CHECK (deadline_ms = t0_ms + 720000),
  cleanup_deadline_ms bigint NOT NULL CHECK (cleanup_deadline_ms = t0_ms + 900000),
  canonical_tenant_id text NOT NULL CHECK (char_length(canonical_tenant_id) BETWEEN 1 AND 128),
  canonical_actor_id text NOT NULL CHECK (char_length(canonical_actor_id) BETWEEN 1 AND 128),
  canonical_conversation_id uuid NOT NULL,
  canonical_run_id uuid NOT NULL,
  source_commit char(40) NOT NULL CHECK (source_commit ~ '^[0-9a-f]{40}$'),
  image_digest text NOT NULL CHECK (image_digest ~ '^sha256:[0-9a-f]{64}$'),
  sdk_version text NOT NULL CHECK (sdk_version = '0.3.295'),
  cli_version text NOT NULL CHECK (cli_version = '2.1.295'),
  contracts_version text NOT NULL CHECK (contracts_version = '0.1.0'),
  contracts_schema_sha256 char(64) NOT NULL CHECK (contracts_schema_sha256 ~ '^[0-9a-f]{64}$'),
  skills_manifest_sha256 char(64) NOT NULL CHECK (skills_manifest_sha256 ~ '^[0-9a-f]{64}$'),
  policy_revision char(64) NOT NULL CHECK (policy_revision ~ '^[0-9a-f]{64}$'),
  current_attempt integer NOT NULL CHECK (current_attempt BETWEEN 1 AND 2),
  current_fence integer NOT NULL CHECK (current_fence BETWEEN 1 AND 2147483647),
  current_grant_id uuid NOT NULL,
  current_mapping_id uuid NOT NULL,
  current_task_arn text NOT NULL CHECK (current_task_arn ~ '^arn:aws:ecs:us-east-1:967807252336:task/[A-Za-z0-9_-]{1,255}/[0-9a-f]{32}$'),
  current_attempt_id uuid NOT NULL,
  current_worker_id uuid NOT NULL,
  current_peer_id text NOT NULL CHECK (char_length(current_peer_id) BETWEEN 1 AND 128),
  current_credential_id text NOT NULL CHECK (char_length(current_credential_id) BETWEEN 1 AND 256),
  current_admitted_at_ms bigint NOT NULL,
  current_expires_at_ms bigint NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK (current_admitted_at_ms >= t0_ms),
  CHECK (current_expires_at_ms > current_admitted_at_ms),
  CHECK (current_expires_at_ms <= deadline_ms),
  CONSTRAINT runs_current_grant_unique UNIQUE (current_grant_id)
);

CREATE TRIGGER runs_advance_only BEFORE UPDATE ON meri_qualification_sdk_fixture.runs
  FOR EACH ROW EXECUTE FUNCTION meri_qualification_sdk_fixture.refuse_run_rebinding();

-- Append-only grant history. A revoked grant keeps its exact binding so a late
-- producer can be compared against what it was actually admitted with.
CREATE TABLE meri_qualification_sdk_fixture.grants (
  grant_id uuid PRIMARY KEY,
  run_uuid uuid NOT NULL REFERENCES meri_qualification_sdk_fixture.runs(run_uuid),
  session_id uuid NOT NULL,
  attempt integer NOT NULL CHECK (attempt BETWEEN 1 AND 2),
  fence integer NOT NULL CHECK (fence BETWEEN 1 AND 2147483647),
  phase text NOT NULL CHECK (phase IN ('interrupt', 'resume')),
  mapping_id uuid NOT NULL UNIQUE,
  task_arn text NOT NULL CHECK (task_arn ~ '^arn:aws:ecs:us-east-1:967807252336:task/[A-Za-z0-9_-]{1,255}/[0-9a-f]{32}$'),
  attempt_id uuid NOT NULL,
  worker_id uuid NOT NULL,
  peer_id text NOT NULL CHECK (char_length(peer_id) BETWEEN 1 AND 128),
  credential_id text NOT NULL CHECK (char_length(credential_id) BETWEEN 1 AND 256),
  policy_revision char(64) NOT NULL CHECK (policy_revision ~ '^[0-9a-f]{64}$'),
  admitted_at_ms bigint NOT NULL,
  expires_at_ms bigint NOT NULL CHECK (expires_at_ms > admitted_at_ms),
  state text NOT NULL CHECK (state IN ('ACTIVE', 'REVOKED')),
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK ((state = 'REVOKED') = (revoked_at IS NOT NULL))
);

-- Grant identity and binding never change. The only permitted transition is a
-- one-time ACTIVE -> REVOKED update made by replacement admission.
CREATE FUNCTION meri_qualification_sdk_fixture.refuse_grant_rebinding()
RETURNS trigger LANGUAGE plpgsql AS $grant$
BEGIN
  IF NEW.grant_id IS DISTINCT FROM OLD.grant_id
     OR NEW.run_uuid IS DISTINCT FROM OLD.run_uuid
     OR NEW.session_id IS DISTINCT FROM OLD.session_id
     OR NEW.attempt IS DISTINCT FROM OLD.attempt
     OR NEW.fence IS DISTINCT FROM OLD.fence
     OR NEW.phase IS DISTINCT FROM OLD.phase
     OR NEW.mapping_id IS DISTINCT FROM OLD.mapping_id
     OR NEW.task_arn IS DISTINCT FROM OLD.task_arn
     OR NEW.attempt_id IS DISTINCT FROM OLD.attempt_id
     OR NEW.worker_id IS DISTINCT FROM OLD.worker_id
     OR NEW.peer_id IS DISTINCT FROM OLD.peer_id
     OR NEW.credential_id IS DISTINCT FROM OLD.credential_id
     OR NEW.policy_revision IS DISTINCT FROM OLD.policy_revision
     OR NEW.admitted_at_ms IS DISTINCT FROM OLD.admitted_at_ms
     OR NEW.expires_at_ms IS DISTINCT FROM OLD.expires_at_ms
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
     OR OLD.state <> 'ACTIVE' OR NEW.state <> 'REVOKED'
     OR OLD.revoked_at IS NOT NULL OR NEW.revoked_at IS NULL
  THEN
    RAISE EXCEPTION 'grant binding is immutable';
  END IF;
  RETURN NEW;
END
$grant$;

CREATE TRIGGER grants_revoke_only BEFORE UPDATE ON meri_qualification_sdk_fixture.grants
  FOR EACH ROW EXECUTE FUNCTION meri_qualification_sdk_fixture.refuse_grant_rebinding();

CREATE TRIGGER grants_no_delete BEFORE DELETE ON meri_qualification_sdk_fixture.grants
  FOR EACH ROW EXECUTE FUNCTION meri_qualification_sdk_fixture.refuse_immutable_mutation();

-- At most one ACTIVE grant per run; the replacement transaction revokes the old
-- grant before this index can admit a second one.
CREATE UNIQUE INDEX grants_one_active_per_run
  ON meri_qualification_sdk_fixture.grants (run_uuid) WHERE state = 'ACTIVE';

-- Exactly one immutable commit per run, written once, never updated or deleted.
CREATE TABLE meri_qualification_sdk_fixture.commits (
  commit_id uuid PRIMARY KEY,
  receipt_id uuid NOT NULL UNIQUE,
  receipt_sha256 char(64) NOT NULL CHECK (receipt_sha256 ~ '^[0-9a-f]{64}$'),
  run_uuid uuid NOT NULL REFERENCES meri_qualification_sdk_fixture.runs(run_uuid),
  grant_id uuid NOT NULL REFERENCES meri_qualification_sdk_fixture.grants(grant_id),
  attempt integer NOT NULL CHECK (attempt = 1),
  fence integer NOT NULL CHECK (fence BETWEEN 1 AND 2147483647),
  phase text NOT NULL CHECK (phase = 'interrupt'),
  task_arn text NOT NULL,
  policy_revision char(64) NOT NULL CHECK (policy_revision ~ '^[0-9a-f]{64}$'),
  bundle_object_id uuid NOT NULL,
  bundle_version_id text NOT NULL CHECK (char_length(bundle_version_id) BETWEEN 1 AND 256),
  bundle_sha256 char(64) NOT NULL CHECK (bundle_sha256 ~ '^[0-9a-f]{64}$'),
  bundle_bytes bigint NOT NULL CHECK (bundle_bytes BETWEEN 1 AND 50331648),
  workspace_sha256 char(64) NOT NULL CHECK (workspace_sha256 ~ '^[0-9a-f]{64}$'),
  workspace_readback_sha256 char(64) NOT NULL CHECK (workspace_readback_sha256 ~ '^[0-9a-f]{64}$'),
  committed_at_ms bigint NOT NULL,
  recorded_at timestamptz NOT NULL,
  published_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  verifier_id text NOT NULL CHECK (char_length(verifier_id) BETWEEN 1 AND 128),
  CHECK (workspace_sha256 = workspace_readback_sha256),
  CHECK (recorded_at >= to_timestamp(committed_at_ms / 1000.0)),
  CONSTRAINT commits_one_per_run UNIQUE (run_uuid)
);

CREATE TRIGGER commits_immutable BEFORE UPDATE OR DELETE ON meri_qualification_sdk_fixture.commits
  FOR EACH ROW EXECUTE FUNCTION meri_qualification_sdk_fixture.refuse_immutable_mutation();
