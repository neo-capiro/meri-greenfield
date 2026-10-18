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
\endif
