-- Meri integration grants (phase_integration_grants only), run by first-chat-migrate.mjs stage 'integration' after the
-- integration packet migrations (docs/integration/MIGRATION-PACKET-20261018.md #1-#11, #3/#4 moved to meri_commands).
-- first-chat-database.sql stays byte-identical: its phase_meri_grants sha256 is recorded in meri_migration_ledger.
-- Same rules as phase_meri_grants: runtime logins get schema USAGE, SELECT/INSERT and column UPDATE only, each derived
-- from a production statement; no DELETE, TRUNCATE, table-wide UPDATE, default privilege or grant option.
-- Retention-projection and purge privileges are withheld: control composes no retention serving and purge is disabled.
\set ON_ERROR_STOP on
SELECT CASE WHEN (:{?phase_integration_grants})::int = 1 THEN 'ok'
            ELSE (SELECT 'MERI_D2_INTEGRATION_GRANTS_PHASE_REQUIRED'::text)::int::text END AS phase_guard;

\if :{?phase_integration_grants}
-- ===================================================================== INTEGRATION GRANTS (after the packet migrations)
-- Runs as the schema owner. Every object below was created by the ordered migrations under this role.
SET ROLE meri_product_migrator;
DO $$
DECLARE missing text;
BEGIN
 IF current_database() <> 'capiro' THEN RAISE EXCEPTION 'MERI_D2_RUN_ON_DATABASE_CAPIRO'; END IF;
 IF to_regclass('public.meri_command_journal') IS NOT NULL OR to_regclass('public.meri_approval_metadata') IS NOT NULL THEN
  RAISE EXCEPTION 'MERI_D2_COMMANDS_IN_PUBLIC';
 END IF;
 SELECT string_agg(s, ', ') INTO missing FROM unnest(ARRAY[
  'meri_settings','meri_intents','meri_commands','meri_schedules','meri_task_lookup','meri_objective_source','meri_artifacts','meri_memory']) AS s
  WHERE NOT EXISTS (SELECT 1 FROM pg_namespace n WHERE n.nspname = s AND pg_get_userbyid(n.nspowner) = 'meri_product_migrator');
 IF missing IS NOT NULL THEN RAISE EXCEPTION 'MERI_D2_MIGRATED_SCHEMA_MISSING_OR_FOREIGN %', missing; END IF;
 SELECT string_agg(t, ', ') INTO missing FROM unnest(ARRAY[
  'meri_settings.tenant_settings','meri_settings.user_preferences','meri_settings.settings_audit',
  'meri_intents.preparations','meri_commands.command_journal','meri_commands.approval_metadata',
  'meri_schedules.projections','meri_schedules.intents','meri_schedules.occurrences','meri_schedules.run_cancel_proofs',
  'meri_task_lookup.lookups','meri_task_lookup.events','meri_objective_source.custody','meri_memory.candidates',
  'meri_objective_source.run_starts','meri_objective_source.reader_replays',
  'meri_artifacts.versions','meri_artifacts.heads','meri_artifacts.retention_subjects','meri_artifacts.retention_purges',
  'meri_artifacts.preview_attempts','meri_artifacts.previews','meri_artifacts.preview_custody']) AS t
  WHERE to_regclass(t) IS NULL
     OR (SELECT pg_get_userbyid(relowner) FROM pg_class WHERE oid = to_regclass(t)) <> 'meri_product_migrator';
 IF missing IS NOT NULL THEN RAISE EXCEPTION 'MERI_D2_MIGRATED_RELATION_MISSING_OR_FOREIGN %', missing; END IF;
END $$;

REVOKE ALL ON SCHEMA meri_settings, meri_intents, meri_commands, meri_schedules, meri_task_lookup,
 meri_objective_source, meri_artifacts, meri_memory FROM PUBLIC;
GRANT USAGE ON SCHEMA meri_settings, meri_intents, meri_commands, meri_schedules, meri_task_lookup,
 meri_objective_source, meri_artifacts, meri_memory TO meri_control_runtime;

-- Control: memory candidate journal (lane M): insert, read, and the submission settle columns only.
GRANT SELECT, INSERT ON TABLE meri_memory.candidates TO meri_control_runtime;
GRANT UPDATE (submission_state,review_id,submitted_at) ON meri_memory.candidates TO meri_control_runtime;

-- Control: personal preferences (user-preferences.mjs). The audit row is insert-only; tenant settings stay ungranted.
GRANT SELECT, INSERT ON TABLE meri_settings.user_preferences TO meri_control_runtime;
GRANT UPDATE (revision,document,document_sha256,updated_at,updated_by) ON meri_settings.user_preferences TO meri_control_runtime;
GRANT INSERT ON TABLE meri_settings.settings_audit TO meri_control_runtime;

-- Control: intent preparation journal. Rows are immutable except the single PENDING settle (trigger-enforced).
GRANT SELECT, INSERT ON TABLE meri_intents.preparations TO meri_control_runtime;
GRANT UPDATE (state,outcome,settled_at) ON meri_intents.preparations TO meri_control_runtime;

-- Control: command journal and approval metadata (approval metadata is append-only).
GRANT SELECT, INSERT ON TABLE meri_commands.command_journal, meri_commands.approval_metadata TO meri_control_runtime;
GRANT UPDATE (state,outcome,updated_at) ON meri_commands.command_journal TO meri_control_runtime;

-- Control: routines foreground schedule owner. Opening an occurrence belongs to the schedule worker (no role yet).
GRANT SELECT, INSERT ON TABLE meri_schedules.projections, meri_schedules.intents TO meri_control_runtime;
GRANT SELECT ON TABLE meri_schedules.occurrences TO meri_control_runtime;
-- Control: single-use Core cancellation-proof jti ledger (insert-before-effect; never updated or deleted).
GRANT SELECT, INSERT ON TABLE meri_schedules.run_cancel_proofs TO meri_control_runtime;
GRANT UPDATE (generation,projection,projection_sha256,active_intent) ON meri_schedules.projections TO meri_control_runtime;
-- The control-owned consent lifecycle updates only its reference column (schedules 0004); Core owns consent authority.
GRANT UPDATE (read_consent) ON meri_schedules.projections TO meri_control_runtime;
GRANT UPDATE (state,updated_at) ON meri_schedules.intents, meri_schedules.occurrences TO meri_control_runtime;

-- Control: task lookup results.
GRANT SELECT, INSERT ON TABLE meri_task_lookup.lookups, meri_task_lookup.events TO meri_control_runtime;
GRANT UPDATE (state,record) ON meri_task_lookup.lookups TO meri_control_runtime;
GRANT UPDATE (event) ON meri_task_lookup.events TO meri_control_runtime;

-- Control: Objective source custody, CLAIMED -> COMMITTED only (trigger-enforced; no DELETE or TRUNCATE).
GRANT SELECT, INSERT ON TABLE meri_objective_source.custody TO meri_control_runtime;
GRANT UPDATE (state,version,committed_at) ON meri_objective_source.custody TO meri_control_runtime;

-- Control: Objective run starts (D7-4, objective-source 0002), insert-only (trigger-enforced; no UPDATE, DELETE or TRUNCATE).
GRANT SELECT, INSERT ON TABLE meri_objective_source.run_starts TO meri_control_runtime;
-- Control: Objective reader v2 replay store (0003), CLAIMED -> COMMITTED only (trigger-enforced; no DELETE or TRUNCATE).
GRANT SELECT, INSERT ON TABLE meri_objective_source.reader_replays TO meri_control_runtime;
GRANT UPDATE (state,version,value,value_sha256,committed_at) ON meri_objective_source.reader_replays TO meri_control_runtime;

-- Control: artifact versions, heads and preview custody. versions UPDATE(record_sha256) is lock-only for the
-- guard_preview_attempt FOR KEY SHARE read; immutable_artifact_versions already rejects every row UPDATE
-- (same treatment as initial_run_bindings in EXISTING-DATABASE-GRANTS-20261016.md).
GRANT SELECT, INSERT ON TABLE meri_artifacts.versions, meri_artifacts.heads,
 meri_artifacts.preview_attempts, meri_artifacts.previews TO meri_control_runtime;
GRANT UPDATE (record_sha256) ON meri_artifacts.versions TO meri_control_runtime;
GRANT UPDATE (version_id,projection,projection_sha256) ON meri_artifacts.heads TO meri_control_runtime;
GRANT UPDATE (object_reference,object_reference_sha256,object_version_id) ON meri_artifacts.preview_attempts TO meri_control_runtime;

-- Readback: no runtime login holds a table-wide write, DDL-like or grant-option privilege on any new relation, only
-- control holds USAGE on the new schemas, and withheld relations/verbs carry no control privilege.
DO $$
DECLARE bad text;
BEGIN
 SELECT string_agg(DISTINCT r.rolname || ' ' || priv || ' ' || c.oid::regclass::text, ', ') INTO bad
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  CROSS JOIN (VALUES ('meri_control_runtime'),('meri_model_budget_owner'),('meri_temporal_issuer_service')) AS r(rolname)
  CROSS JOIN (VALUES ('UPDATE'),('DELETE'),('TRUNCATE'),('TRIGGER'),('REFERENCES'),
                     ('SELECT WITH GRANT OPTION'),('INSERT WITH GRANT OPTION')) AS p(priv)
  WHERE n.nspname IN ('meri_settings','meri_intents','meri_commands','meri_schedules','meri_task_lookup',
                      'meri_objective_source','meri_artifacts','meri_memory')
    AND c.relkind IN ('r','v','p') AND has_table_privilege(r.rolname, c.oid, priv);
 IF bad IS NOT NULL THEN RAISE EXCEPTION 'MERI_D2_EXCESS_TABLE_PRIVILEGE %', bad; END IF;
 IF EXISTS (SELECT 1 FROM unnest(ARRAY['meri_settings','meri_intents','meri_commands','meri_schedules',
             'meri_task_lookup','meri_objective_source','meri_artifacts','meri_memory']) AS s
             CROSS JOIN (VALUES ('meri_model_budget_owner'),('meri_temporal_issuer_service')) AS r(rolname)
             WHERE has_schema_privilege(r.rolname, s, 'USAGE')) THEN
  RAISE EXCEPTION 'MERI_D2_CROSS_SCHEMA_USAGE';
 END IF;
 IF EXISTS (SELECT 1 FROM unnest(ARRAY['meri_settings.tenant_settings','meri_artifacts.retention_subjects',
             'meri_artifacts.retention_purges','meri_artifacts.preview_custody']) AS t
             WHERE has_any_column_privilege('meri_control_runtime', t, 'SELECT, INSERT, UPDATE, REFERENCES'))
    OR has_any_column_privilege('meri_control_runtime', 'meri_settings.settings_audit', 'SELECT, UPDATE, REFERENCES')
    OR has_table_privilege('meri_control_runtime', 'meri_schedules.occurrences', 'INSERT')
    OR has_any_column_privilege('meri_control_runtime', 'meri_objective_source.run_starts', 'UPDATE, REFERENCES') THEN
  RAISE EXCEPTION 'MERI_D2_WITHHELD_PRIVILEGE_PRESENT';
 END IF;
END $$;
RESET ROLE;

-- ===================================================================== CORE API ROLE (capiro_app) AND THE ADMISSION SNAPSHOT
-- Core's API runtime role is `capiro_app` (Core migration 20260502020000_capiro_app_role; the preview Core task's DB_USER is
-- the `username` key of its app credential — the packet reads that name back before this phase runs). Fail closed if absent.
DO $$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'capiro_app') THEN RAISE EXCEPTION 'MERI_D2_CORE_APP_ROLE_MISSING capiro_app'; END IF;
END $$;

-- Option B delegation facts (read-delegation/migrations/0001_read_delegation_facts.sql): Core reads the four views only;
-- run currentness comes from the snapshot function below, never from a view row's existence (dot #121 6248061000).
SET ROLE meri_product_migrator;
GRANT USAGE ON SCHEMA meri_read_delegation_facts TO capiro_app;
GRANT SELECT ON TABLE meri_read_delegation_facts.run_facts_v1, meri_read_delegation_facts.reservations_v1,
  meri_read_delegation_facts.occurrences_v1, meri_read_delegation_facts.schedules_v1 TO capiro_app;
RESET ROLE;

-- Meri-owned SECURITY DEFINER current-admission snapshot (dot 6248138427 / 6248171459; Core lane proposal
-- capiro-backend #84 docs/integration/CORE-ADMISSION-SNAPSHOT-FUNCTION-20261018.sql at 70e13545, body verbatim).
-- Contract `capiro.meri-core-admission-snapshot.v1`: Core calls exactly this signature on its own transaction after its
-- proposal advisory lock; the function takes the canonical budget FOR SHARE first, reads clock_timestamp() in its own
-- statement, then Meri's saved ADMITTED record, the run, its allocation and its grants in grant_id order. The predicate
-- stays Core's. Runs as the admin login (role creation and ownership transfer); idempotent on re-run.
BEGIN;
DO $$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'meri_core_admission_reader') THEN
  CREATE ROLE meri_core_admission_reader NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;
 END IF;
END $$;
GRANT USAGE ON SCHEMA meri_product_budget TO meri_core_admission_reader;
GRANT USAGE ON SCHEMA meri_conversations TO meri_core_admission_reader;
GRANT SELECT ON meri_conversations.native_allocations TO meri_core_admission_reader;
GRANT SELECT ON meri_product_budget.budget, meri_product_budget.runs, meri_product_budget.tool_run_allocations,
  meri_product_budget.grants, meri_product_budget.tool_grant_bindings TO meri_core_admission_reader;
-- PostgreSQL requires UPDATE privilege for FOR SHARE; one column only, held by the definer role, never used.
GRANT UPDATE (quarantined) ON meri_product_budget.budget TO meri_core_admission_reader;

CREATE SCHEMA IF NOT EXISTS meri_core_authority;
REVOKE ALL ON SCHEMA meri_core_authority FROM PUBLIC;

CREATE OR REPLACE FUNCTION meri_core_authority.current_admission_v1(p_tenant_id uuid, p_conversation_id uuid, p_run_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
PARALLEL UNSAFE
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $fn$
DECLARE
  v_present boolean := false;
  v_quarantined boolean;
  v_now timestamptz;
  v_admitted jsonb;
  v_run jsonb;
  v_allocation jsonb;
  v_grants jsonb;
BEGIN
  -- 1. The canonical budget lock, first.
  SELECT true, b.quarantined INTO v_present, v_quarantined
    FROM meri_product_budget.budget AS b WHERE b.id = 1 FOR SHARE;
  v_present := COALESCE(v_present, false);
  -- 2. The database clock, in its own statement after the lock.
  v_now := pg_catalog.clock_timestamp();
  -- 3. Meri's saved ADMITTED record for exactly this tenant/conversation/run, then the admission rows.
  SELECT pg_catalog.jsonb_build_object(
           'state', n.record -> 'state', 'binding', n.record -> 'binding',
           'allocationSha256', n.record -> 'allocationSha256', 'grantFactsJsons', n.record -> 'resource' -> 'grantFactsJsons')
    INTO v_admitted
    FROM meri_conversations.native_allocations AS n
   WHERE n.tenant_id = p_tenant_id::text AND n.conversation_id = p_conversation_id AND n.run_id = p_run_id;
  SELECT pg_catalog.jsonb_build_object(
           'runId', r.run_id::text, 'attempt', r.attempt, 'workerArn', r.worker_arn,
           'fence', r.fence, 'policyRevision', r.policy_revision::text)
    INTO v_run
    FROM meri_product_budget.runs AS r WHERE r.run_id = p_run_id;
  SELECT pg_catalog.jsonb_build_object(
           'allocation', a.allocation, 'allocationSha256', a.allocation_sha256::text,
           'startedAtMs', pg_catalog.floor(pg_catalog.date_part('epoch', a.started_at) * 1000)::bigint)
    INTO v_allocation
    FROM meri_product_budget.tool_run_allocations AS a WHERE a.run_id = p_run_id;
  SELECT COALESCE(pg_catalog.jsonb_agg(x.item ORDER BY x.grant_id), '[]'::jsonb)
    INTO v_grants
    FROM (
      SELECT g.grant_id, pg_catalog.jsonb_build_object(
               'grantId', g.grant_id::text, 'runId', g.run_id::text, 'attempt', g.attempt, 'workerArn', g.worker_arn,
               'fence', g.fence, 'policyRevision', g.policy_revision::text, 'capabilitySha256', g.capability_sha256::text,
               'expiresAtMs', pg_catalog.floor(pg_catalog.date_part('epoch', g.expires_at) * 1000)::bigint,
               'state', g.state, 'boundGrantId', b.grant_id::text, 'boundRunId', b.run_id::text, 'facts', b.facts) AS item
        FROM meri_product_budget.grants AS g
        LEFT JOIN meri_product_budget.tool_grant_bindings AS b ON b.grant_id = g.grant_id
       WHERE g.run_id = p_run_id
       ORDER BY g.grant_id
       LIMIT 65
    ) AS x;
  RETURN pg_catalog.jsonb_build_object(
    'contract', 'capiro.meri-core-admission-snapshot.v1',
    'budgetPresent', v_present,
    'quarantined', v_quarantined,
    'dbNowMs', pg_catalog.floor(pg_catalog.date_part('epoch', v_now) * 1000)::bigint,
    'admitted', v_admitted,
    'run', v_run,
    'allocation', v_allocation,
    'grants', v_grants);
END
$fn$;

ALTER FUNCTION meri_core_authority.current_admission_v1(uuid, uuid, uuid) OWNER TO meri_core_admission_reader;
REVOKE EXECUTE ON FUNCTION meri_core_authority.current_admission_v1(uuid, uuid, uuid) FROM PUBLIC;
GRANT USAGE ON SCHEMA meri_core_authority TO capiro_app;
GRANT EXECUTE ON FUNCTION meri_core_authority.current_admission_v1(uuid, uuid, uuid) TO capiro_app;
COMMIT;

-- Readback: capiro_app holds nothing in a Meri schema beyond the four facts views and the function; the definer role
-- holds no login and nothing beyond its reads and the one lock column.
DO $$
DECLARE bad text;
BEGIN
 SELECT string_agg(DISTINCT c.oid::regclass::text || ' ' || priv, ', ') INTO bad
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  CROSS JOIN (VALUES ('SELECT'),('INSERT'),('UPDATE'),('DELETE'),('TRUNCATE'),('TRIGGER'),('REFERENCES')) AS p(priv)
  WHERE n.nspname LIKE 'meri\_%' AND c.relkind IN ('r','v','p') AND has_table_privilege('capiro_app', c.oid, priv)
    AND NOT (n.nspname = 'meri_read_delegation_facts' AND priv = 'SELECT'
             AND c.relname IN ('run_facts_v1','reservations_v1','occurrences_v1','schedules_v1'));
 IF bad IS NOT NULL THEN RAISE EXCEPTION 'MERI_D2_CORE_APP_EXCESS_PRIVILEGE %', bad; END IF;
 IF (SELECT rolcanlogin OR rolsuper OR rolcreaterole OR rolcreatedb FROM pg_roles WHERE rolname = 'meri_core_admission_reader') THEN
  RAISE EXCEPTION 'MERI_D2_ADMISSION_READER_ATTRIBUTES';
 END IF;
 IF NOT has_function_privilege('capiro_app', 'meri_core_authority.current_admission_v1(uuid, uuid, uuid)', 'EXECUTE')
    OR has_function_privilege('meri_control_runtime', 'meri_core_authority.current_admission_v1(uuid, uuid, uuid)', 'EXECUTE') THEN
  RAISE EXCEPTION 'MERI_D2_SNAPSHOT_FUNCTION_PRIVILEGE';
 END IF;
END $$;
-- ROLLBACK (one transaction, admin): REVOKE EXECUTE/USAGE from capiro_app; DROP FUNCTION meri_core_authority.current_admission_v1(uuid,uuid,uuid);
-- DROP SCHEMA meri_core_authority; REVOKE the reader's grants; DROP ROLE meri_core_admission_reader; REVOKE the four view SELECTs and
-- schema USAGE from capiro_app (DEPLOYMENT-PACKET-20261018.md §9).
\endif
