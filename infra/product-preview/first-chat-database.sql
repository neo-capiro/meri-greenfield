-- Meri first-chat preview, Stage 1 database (change set D2), 17 October 2026.
-- One psql script, four phases. Select exactly one with -v phase_<name>=1:
--   phase_bootstrap        admin login on database capiro, BEFORE the ordered migrations
--   phase_meri_grants      admin login on database capiro, AFTER the ordered migrations and seed
--   phase_temporal_grants  admin login on database capiro, AFTER temporal-sql-tool applied both Temporal schemas
--   phase_release          admin login on database capiro, at the end of every run (drops the admin's temporary SET)
-- infra/product-preview/first-chat-migrate.mjs runs these phases in that order and ledgers them.
-- Bootstrap needs six psql variables, each a password or (preferred) a SCRAM-SHA-256 verifier:
--   control_password, model_owner_password, issuer_password,
--   temporal_migrator_password, temporal_primary_password, temporal_visibility_password
-- No literal password, Core object, public-schema grant on capiro, database-wide PUBLIC change on capiro,
-- SUPERUSER, BYPASSRLS, CREATEROLE, REPLICATION, default privilege or grant option appears below.
-- Only new meri_* roles, meri_* schemas and the new temporal/temporal_visibility databases are touched.
-- Supported psql subset (the runner interprets exactly this): \set ON_ERROR_STOP on, \if :{?var}, \endif,
-- \connect <database>, \gexec, :'var' and :{?var}. Nothing in a skipped phase is interpolated or executed.
\set ON_ERROR_STOP on

-- The failing branch is a sub-select so the planner cannot fold it into an unconditional error.
SELECT CASE WHEN (:{?phase_bootstrap})::int + (:{?phase_meri_grants})::int
                 + (:{?phase_temporal_grants})::int + (:{?phase_release})::int = 1
            THEN 'one phase selected'
            ELSE (SELECT 'MERI_D2_EXACTLY_ONE_PHASE_REQUIRED'::text)::int::text END AS phase_guard;
DO $$
BEGIN
 IF current_database() <> 'capiro' THEN RAISE EXCEPTION 'MERI_D2_RUN_ON_DATABASE_CAPIRO'; END IF;
 IF current_setting('server_version_num')::int < 160000 THEN RAISE EXCEPTION 'MERI_D2_POSTGRESQL_16_REQUIRED'; END IF;
END $$;

\if :{?phase_bootstrap}
-- ===================================================================== BOOTSTRAP
-- The admin must be able to create roles and databases and to grant CONNECT/CREATE on capiro.
DO $$
DECLARE me pg_roles%ROWTYPE;
BEGIN
 SELECT * INTO me FROM pg_roles WHERE rolname = current_user;
 IF NOT (me.rolsuper OR (me.rolcreaterole AND me.rolcreatedb)) THEN
  RAISE EXCEPTION 'MERI_D2_ADMIN_NEEDS_CREATEROLE_AND_CREATEDB';
 END IF;
 IF NOT (has_database_privilege('capiro', 'CONNECT WITH GRANT OPTION')
         AND has_database_privilege('capiro', 'CREATE WITH GRANT OPTION')) THEN
  RAISE EXCEPTION 'MERI_D2_ADMIN_CANNOT_GRANT_ON_CAPIRO';
 END IF;
END $$;

-- Refuse any pre-existing role, schema or database of the same name that this script did not create.
DO $$
DECLARE r record;
BEGIN
 FOR r IN SELECT rolname FROM pg_roles WHERE rolname IN (
   'meri_product_migrator','meri_control_runtime','meri_model_budget_owner','meri_temporal_issuer_service',
   'meri_temporal_migrator','meri_temporal_primary_runtime','meri_temporal_visibility_runtime') LOOP
  IF shobj_description((SELECT oid FROM pg_roles WHERE rolname = r.rolname), 'pg_authid')
     IS DISTINCT FROM 'meri-first-chat-d2' THEN
   RAISE EXCEPTION 'MERI_D2_ROLE_COLLISION %', r.rolname;
  END IF;
 END LOOP;
 FOR r IN SELECT nspname, pg_get_userbyid(nspowner) AS owner FROM pg_namespace WHERE nspname IN (
   'meri_conversations','meri_product_budget','meri_service_identity','meri_migration_ledger') LOOP
  IF r.owner <> 'meri_product_migrator' THEN RAISE EXCEPTION 'MERI_D2_SCHEMA_COLLISION %', r.nspname; END IF;
 END LOOP;
 FOR r IN SELECT oid, datname FROM pg_database WHERE datname IN ('temporal','temporal_visibility') LOOP
  IF shobj_description(r.oid, 'pg_database') IS DISTINCT FROM 'meri-first-chat-d2' THEN
   RAISE EXCEPTION 'MERI_D2_DATABASE_COLLISION %', r.datname;
  END IF;
 END LOOP;
END $$;

-- Roles. All start NOLOGIN; LOGIN and the password are set below from psql variables only.
-- On Aurora (non-superuser admin) PostgreSQL 16 records an implicit ADMIN-only membership of the
-- creating admin in each new role. It carries no INHERIT and no SET.
DO $$
DECLARE r record;
BEGIN
 FOR r IN SELECT * FROM (VALUES
   ('meri_product_migrator'),('meri_control_runtime'),('meri_model_budget_owner'),('meri_temporal_issuer_service'),
   ('meri_temporal_migrator'),('meri_temporal_primary_runtime'),('meri_temporal_visibility_runtime')) AS v(name) LOOP
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r.name) THEN
   EXECUTE format('CREATE ROLE %I NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS', r.name);
   EXECUTE format('COMMENT ON ROLE %I IS %L', r.name, 'meri-first-chat-d2');
  END IF;
 END LOOP;
END $$;
ALTER ROLE meri_product_migrator WITH NOLOGIN NOINHERIT;
SELECT format('ALTER ROLE meri_control_runtime WITH LOGIN NOINHERIT CONNECTION LIMIT 20 PASSWORD %L', :'control_password') \gexec
SELECT format('ALTER ROLE meri_model_budget_owner WITH LOGIN NOINHERIT CONNECTION LIMIT 20 PASSWORD %L', :'model_owner_password') \gexec
SELECT format('ALTER ROLE meri_temporal_issuer_service WITH LOGIN NOINHERIT CONNECTION LIMIT 4 PASSWORD %L', :'issuer_password') \gexec
SELECT format('ALTER ROLE meri_temporal_migrator WITH LOGIN NOINHERIT CONNECTION LIMIT 4 PASSWORD %L', :'temporal_migrator_password') \gexec
SELECT format('ALTER ROLE meri_temporal_primary_runtime WITH LOGIN NOINHERIT CONNECTION LIMIT -1 PASSWORD %L', :'temporal_primary_password') \gexec
SELECT format('ALTER ROLE meri_temporal_visibility_runtime WITH LOGIN NOINHERIT CONNECTION LIMIT -1 PASSWORD %L', :'temporal_visibility_password') \gexec

-- Temporary: lets this admin session act as each migration owner (SET only, never INHERIT).
-- phase_release revokes both. Runtime roles never get SET or INHERIT on any role.
GRANT meri_product_migrator TO CURRENT_USER WITH INHERIT FALSE, SET TRUE;
GRANT meri_temporal_migrator TO CURRENT_USER WITH INHERIT FALSE, SET TRUE;

-- Existing database capiro: add CONNECT for the three Meri logins and CREATE for the schema owner only.
-- PUBLIC, Core grants and the public schema are left exactly as they are. CREATE is revoked in phase_release.
GRANT CONNECT ON DATABASE capiro TO meri_control_runtime, meri_model_budget_owner, meri_temporal_issuer_service;
GRANT CREATE ON DATABASE capiro TO meri_product_migrator;

-- Migration ledger, owned by the schema owner. The migrations create the three product schemas themselves.
SET ROLE meri_product_migrator;
CREATE SCHEMA IF NOT EXISTS meri_migration_ledger;
REVOKE ALL ON SCHEMA meri_migration_ledger FROM PUBLIC;
CREATE TABLE IF NOT EXISTS meri_migration_ledger.applied (
 ordinal integer PRIMARY KEY CHECK (ordinal >= 1),
 name text NOT NULL UNIQUE CHECK (length(name) BETWEEN 1 AND 256),
 sha256 text NOT NULL CHECK (sha256 ~ '^[a-f0-9]{64}$'),
 applied_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 applied_by text NOT NULL DEFAULT session_user
);
REVOKE ALL ON TABLE meri_migration_ledger.applied FROM PUBLIC;
RESET ROLE;

-- Temporal logical databases (CREATE DATABASE runs alone, never inside a transaction block).
SELECT 'CREATE DATABASE temporal WITH TEMPLATE template0 ENCODING ''UTF8'''
 WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = 'temporal') \gexec
SELECT 'CREATE DATABASE temporal_visibility WITH TEMPLATE template0 ENCODING ''UTF8'''
 WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = 'temporal_visibility') \gexec
COMMENT ON DATABASE temporal IS 'meri-first-chat-d2';
COMMENT ON DATABASE temporal_visibility IS 'meri-first-chat-d2';
REVOKE ALL ON DATABASE temporal FROM PUBLIC;
REVOKE ALL ON DATABASE temporal_visibility FROM PUBLIC;
GRANT CONNECT ON DATABASE temporal TO meri_temporal_migrator, meri_temporal_primary_runtime;
GRANT CONNECT ON DATABASE temporal_visibility TO meri_temporal_migrator, meri_temporal_visibility_runtime;

\connect temporal
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT USAGE, CREATE ON SCHEMA public TO meri_temporal_migrator;
GRANT USAGE ON SCHEMA public TO meri_temporal_primary_runtime;

\connect temporal_visibility
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT USAGE, CREATE ON SCHEMA public TO meri_temporal_migrator;
GRANT USAGE ON SCHEMA public TO meri_temporal_visibility_runtime;
-- Visibility prerequisite, installed by the admin; the Temporal roles cannot create extensions.
CREATE EXTENSION IF NOT EXISTS btree_gin;

\connect capiro
-- Readback: exact role attributes, and no role can inherit or SET into a runtime login.
DO $$
DECLARE r record;
BEGIN
 FOR r IN SELECT v.name, v.login, p.* FROM (VALUES
   ('meri_product_migrator',false),('meri_control_runtime',true),('meri_model_budget_owner',true),
   ('meri_temporal_issuer_service',true),('meri_temporal_migrator',true),
   ('meri_temporal_primary_runtime',true),('meri_temporal_visibility_runtime',true)) AS v(name,login)
   LEFT JOIN pg_roles p ON p.rolname = v.name LOOP
  IF r.rolname IS NULL OR r.rolsuper OR r.rolbypassrls OR r.rolcreaterole OR r.rolcreatedb OR r.rolreplication
     OR r.rolinherit OR r.rolcanlogin IS DISTINCT FROM r.login THEN
   RAISE EXCEPTION 'MERI_D2_ROLE_ATTRIBUTES %', r.name;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_auth_members m WHERE m.member = r.oid) THEN
   RAISE EXCEPTION 'MERI_D2_ROLE_IS_A_MEMBER %', r.name;
  END IF;
  IF r.name NOT IN ('meri_product_migrator','meri_temporal_migrator') AND EXISTS (
     SELECT 1 FROM pg_auth_members m WHERE m.roleid = r.oid AND (m.inherit_option OR m.set_option)) THEN
   RAISE EXCEPTION 'MERI_D2_RUNTIME_ROLE_MEMBERSHIP %', r.name;
  END IF;
 END LOOP;
END $$;
\endif

\if :{?phase_meri_grants}
-- ===================================================================== MERI GRANTS (after migrations)
-- Runs as the schema owner. Every object below was created by the ordered migrations under this role.
SET ROLE meri_product_migrator;
DO $$
DECLARE missing text;
BEGIN
 SELECT string_agg(t, ', ') INTO missing FROM unnest(ARRAY[
  'meri_conversations.conversations','meri_conversations.runs','meri_conversations.events',
  'meri_conversations.controls','meri_conversations.checkpoints','meri_conversations.completion_checkpoints',
  'meri_conversations.next_runs','meri_conversations.native_executions','meri_conversations.native_allocations',
  'meri_conversations.native_restorations','meri_conversations.run_issuances','meri_conversations.model_run_issuances',
  'meri_conversations.initial_inputs','meri_conversations.initial_run_bindings','meri_conversations.sdk_sessions',
  'meri_conversations.sdk_session_streams','meri_conversations.sdk_session_entries','meri_conversations.sdk_session_batches',
  'meri_conversations.selected_outputs','meri_conversations.selected_reads',
  'meri_product_budget.budget','meri_product_budget.runs','meri_product_budget.grants','meri_product_budget.requests',
  'meri_product_budget.tool_run_allocations','meri_product_budget.tool_grant_bindings',
  'meri_product_budget.budget_liabilities','meri_product_budget.tenant_budgets',
  'meri_product_budget.tenant_run_reservations','meri_service_identity.service_task_registrations']) AS t
  WHERE to_regclass(t) IS NULL
     OR (SELECT pg_get_userbyid(relowner) FROM pg_class WHERE oid = to_regclass(t)) <> 'meri_product_migrator';
 IF missing IS NOT NULL THEN RAISE EXCEPTION 'MERI_D2_MIGRATED_RELATION_MISSING_OR_FOREIGN %', missing; END IF;
END $$;

REVOKE ALL ON SCHEMA meri_conversations, meri_product_budget, meri_service_identity FROM PUBLIC;
GRANT USAGE ON SCHEMA meri_conversations, meri_product_budget TO meri_control_runtime, meri_model_budget_owner;
GRANT USAGE ON SCHEMA meri_service_identity TO meri_temporal_issuer_service;

-- Lock-only column guards (EXISTING-DATABASE-GRANTS-20261016.md). Each statement-level trigger refuses any
-- UPDATE that names its single column, including a no-op, so the row-lock privilege cannot change the value.
-- A pre-existing function or trigger of the same name must match exactly, or the phase refuses.
DO $$
DECLARE f record; t record; fn oid; col int2; trg pg_trigger%ROWTYPE;
BEGIN
 FOR f IN SELECT * FROM (VALUES
   ('meri_conversations','MERI_LOCK_COLUMN_UPDATE_REFUSED'),
   ('meri_product_budget','MERI_BUDGET_LOCK_COLUMN_UPDATE_REFUSED')) AS v(schema_name,code) LOOP
  fn := to_regprocedure(f.schema_name || '.reject_lock_column_update()');
  IF fn IS NULL THEN
   EXECUTE format('CREATE FUNCTION %I.reject_lock_column_update() RETURNS trigger LANGUAGE plpgsql AS %L',
                  f.schema_name, format(' BEGIN RAISE EXCEPTION %L; END ', f.code));
   EXECUTE format('REVOKE ALL ON FUNCTION %I.reject_lock_column_update() FROM PUBLIC', f.schema_name);
  ELSIF NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_language l ON l.oid = p.prolang
                     WHERE p.oid = fn AND l.lanname = 'plpgsql' AND p.prorettype = 'trigger'::regtype
                       AND pg_get_userbyid(p.proowner) = 'meri_product_migrator'
                       AND p.prosrc = format(' BEGIN RAISE EXCEPTION %L; END ', f.code)) THEN
   RAISE EXCEPTION 'MERI_D2_GUARD_FUNCTION_CONFLICT %', f.schema_name;
  END IF;
 END LOOP;
 FOR t IN SELECT * FROM (VALUES
   ('meri_conversations','conversations','lock_only_conversation_projection','projection_sha256'),
   ('meri_conversations','selected_outputs','lock_only_selected_preparation','preparation_sha256'),
   ('meri_product_budget','budget','lock_only_budget_id','id'),
   ('meri_product_budget','runs','lock_only_budget_run_policy','policy_revision'),
   ('meri_product_budget','grants','lock_only_budget_grant_capability','capability_sha256'),
   ('meri_product_budget','tool_run_allocations','lock_only_budget_allocation_sha','allocation_sha256'),
   ('meri_product_budget','tool_grant_bindings','lock_only_budget_binding_facts','facts'),
   ('meri_product_budget','tenant_budgets','lock_only_tenant_budget_id','tenant_id'))
   AS v(schema_name,table_name,trigger_name,column_name) LOOP
  fn := to_regprocedure(t.schema_name || '.reject_lock_column_update()');
  SELECT attnum INTO col FROM pg_attribute
   WHERE attrelid = format('%I.%I', t.schema_name, t.table_name)::regclass AND attname = t.column_name AND NOT attisdropped;
  IF col IS NULL THEN RAISE EXCEPTION 'MERI_D2_GUARD_COLUMN_MISSING %.%', t.table_name, t.column_name; END IF;
  SELECT * INTO trg FROM pg_trigger
   WHERE tgrelid = format('%I.%I', t.schema_name, t.table_name)::regclass AND tgname = t.trigger_name;
  IF NOT FOUND THEN
   EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE OF %I ON %I.%I FOR EACH STATEMENT EXECUTE FUNCTION %I.reject_lock_column_update()',
                  t.trigger_name, t.column_name, t.schema_name, t.table_name, t.schema_name);
  -- tgtype 18 = BEFORE (2) + UPDATE (16), statement level (row bit 1 clear).
  ELSIF trg.tgfoid <> fn OR trg.tgtype <> 18 OR trg.tgenabled <> 'O' OR trg.tgattr::int2[] <> ARRAY[col] THEN
   RAISE EXCEPTION 'MERI_D2_GUARD_TRIGGER_CONFLICT %', t.trigger_name;
  END IF;
 END LOOP;
END $$;

-- Control: first-chat conversation store, native preparation/issuance, original input and successor.
GRANT SELECT, INSERT ON TABLE
 meri_conversations.conversations, meri_conversations.runs, meri_conversations.events,
 meri_conversations.controls, meri_conversations.checkpoints,
 meri_conversations.completion_checkpoints, meri_conversations.next_runs,
 meri_conversations.native_executions, meri_conversations.native_allocations,
 meri_conversations.native_restorations, meri_conversations.run_issuances,
 meri_conversations.model_run_issuances, meri_conversations.initial_inputs,
 meri_conversations.initial_run_bindings
 TO meri_control_runtime;
GRANT USAGE ON SEQUENCE meri_conversations.controls_control_sequence_seq TO meri_control_runtime;
GRANT UPDATE (projection_sha256) ON meri_conversations.conversations TO meri_control_runtime;
GRANT UPDATE (projection,projection_sha256,last_sequence,hold_control_id,hold_completion_id,sequence_end,sequence_base)
 ON meri_conversations.runs TO meri_control_runtime;
GRANT UPDATE (projection,projection_sha256) ON meri_conversations.controls TO meri_control_runtime;
GRANT UPDATE (state,proof,proof_sha256) ON meri_conversations.completion_checkpoints TO meri_control_runtime;
GRANT UPDATE (state,reservation_sha256) ON meri_conversations.next_runs TO meri_control_runtime;
GRANT UPDATE (record,record_sha256) ON meri_conversations.native_executions TO meri_control_runtime;
GRANT UPDATE (record,record_sha256) ON meri_conversations.native_allocations, meri_conversations.native_restorations TO meri_control_runtime;
GRANT UPDATE (state,grant_id,capability_sha256,material_ref,issued_at,version,facts_sha256)
 ON meri_conversations.run_issuances, meri_conversations.model_run_issuances TO meri_control_runtime;
GRANT UPDATE (state,accepted_request_sha256,allocation_sha256) ON meri_conversations.initial_inputs TO meri_control_runtime;
GRANT UPDATE (record_sha256) ON meri_conversations.initial_run_bindings TO meri_control_runtime;

-- Control: SDK session mirror and selected output/read journals.
GRANT SELECT, INSERT ON TABLE
 meri_conversations.sdk_sessions, meri_conversations.sdk_session_streams,
 meri_conversations.sdk_session_entries, meri_conversations.sdk_session_batches,
 meri_conversations.selected_outputs, meri_conversations.selected_reads
 TO meri_control_runtime;
GRANT UPDATE (entries_count,bytes) ON meri_conversations.sdk_sessions TO meri_control_runtime;
GRANT UPDATE (last_sequence) ON meri_conversations.sdk_session_streams TO meri_control_runtime;
GRANT UPDATE (preparation_sha256) ON meri_conversations.selected_outputs TO meri_control_runtime;
GRANT UPDATE (stage,result_text,completion) ON meri_conversations.selected_reads TO meri_control_runtime;

-- Control: canonical allocation/admission owner and tenant reservations. No cap or consumed write.
GRANT SELECT ON TABLE
 meri_product_budget.budget, meri_product_budget.runs, meri_product_budget.grants,
 meri_product_budget.tool_run_allocations, meri_product_budget.tool_grant_bindings,
 meri_product_budget.tenant_budgets, meri_product_budget.tenant_run_reservations,
 meri_product_budget.budget_liabilities
 TO meri_control_runtime;
GRANT INSERT ON TABLE
 meri_product_budget.runs, meri_product_budget.grants,
 meri_product_budget.tool_run_allocations, meri_product_budget.tool_grant_bindings,
 meri_product_budget.tenant_run_reservations
 TO meri_control_runtime;
GRANT UPDATE (id) ON meri_product_budget.budget TO meri_control_runtime;
GRANT UPDATE (policy_revision) ON meri_product_budget.runs TO meri_control_runtime;
GRANT UPDATE (state,capability_sha256) ON meri_product_budget.grants TO meri_control_runtime;
GRANT UPDATE (allocation_sha256) ON meri_product_budget.tool_run_allocations TO meri_control_runtime;
GRANT UPDATE (facts) ON meri_product_budget.tool_grant_bindings TO meri_control_runtime;
GRANT UPDATE (tenant_id) ON meri_product_budget.tenant_budgets TO meri_control_runtime;
GRANT UPDATE (state,settled_micro_usd,released_at,settled_at,not_dispatched_at)
 ON meri_product_budget.tenant_run_reservations TO meri_control_runtime;

-- Model budget owner: per-send reservation, settlement and readback over the same canonical tables.
GRANT SELECT ON TABLE
 meri_product_budget.budget, meri_product_budget.runs, meri_product_budget.grants,
 meri_product_budget.tool_run_allocations, meri_product_budget.tool_grant_bindings,
 meri_product_budget.requests, meri_product_budget.budget_liabilities
 TO meri_model_budget_owner;
GRANT SELECT ON TABLE meri_conversations.model_run_issuances TO meri_model_budget_owner;
GRANT SELECT ON TABLE meri_conversations.runs, meri_conversations.native_allocations, meri_conversations.events TO meri_model_budget_owner;
GRANT UPDATE (sequence_base) ON meri_conversations.runs TO meri_model_budget_owner;
GRANT UPDATE (intent_key) ON meri_conversations.native_allocations TO meri_model_budget_owner;
GRANT INSERT ON TABLE meri_product_budget.requests TO meri_model_budget_owner;
GRANT UPDATE (consumed_micro_usd,quarantined) ON meri_product_budget.budget TO meri_model_budget_owner;
GRANT UPDATE (state,actual_micro_usd,evidence_sha256,settled_at) ON meri_product_budget.requests TO meri_model_budget_owner;
GRANT UPDATE (policy_revision) ON meri_product_budget.runs TO meri_model_budget_owner;
GRANT UPDATE (capability_sha256) ON meri_product_budget.grants TO meri_model_budget_owner;
GRANT UPDATE (allocation_sha256) ON meri_product_budget.tool_run_allocations TO meri_model_budget_owner;
GRANT UPDATE (facts) ON meri_product_budget.tool_grant_bindings TO meri_model_budget_owner;

-- Temporal issuer: exactly the privileges its startup probe requires (service-task-registration-pg.mjs).
GRANT SELECT, INSERT ON TABLE meri_service_identity.service_task_registrations TO meri_temporal_issuer_service;
GRANT UPDATE (certificate_sha256,expires_at_ms,proof_observed_at_ms,generation,updated_at,revoked_at)
 ON meri_service_identity.service_task_registrations TO meri_temporal_issuer_service;

-- Readback: no runtime login holds a table-wide write, DDL-like or grant-option privilege on any Meri relation,
-- and only the owner and the issuer appear in the issuer schema/table ACLs.
DO $$
DECLARE bad text;
BEGIN
 SELECT string_agg(DISTINCT r.rolname || ' ' || priv || ' ' || c.oid::regclass::text, ', ') INTO bad
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  CROSS JOIN (VALUES ('meri_control_runtime'),('meri_model_budget_owner'),('meri_temporal_issuer_service')) AS r(rolname)
  CROSS JOIN (VALUES ('UPDATE'),('DELETE'),('TRUNCATE'),('TRIGGER'),('REFERENCES'),
                     ('SELECT WITH GRANT OPTION'),('INSERT WITH GRANT OPTION')) AS p(priv)
  WHERE n.nspname IN ('meri_conversations','meri_product_budget','meri_service_identity','meri_migration_ledger')
    AND c.relkind IN ('r','v','p') AND has_table_privilege(r.rolname, c.oid, priv);
 IF bad IS NOT NULL THEN RAISE EXCEPTION 'MERI_D2_EXCESS_TABLE_PRIVILEGE %', bad; END IF;
 IF has_schema_privilege('meri_control_runtime','meri_service_identity','USAGE')
    OR has_schema_privilege('meri_model_budget_owner','meri_service_identity','USAGE')
    OR has_schema_privilege('meri_temporal_issuer_service','meri_conversations','USAGE')
    OR has_schema_privilege('meri_temporal_issuer_service','meri_product_budget','USAGE') THEN
  RAISE EXCEPTION 'MERI_D2_CROSS_SCHEMA_USAGE';
 END IF;
 IF EXISTS (SELECT 1 FROM pg_namespace n CROSS JOIN LATERAL aclexplode(n.nspacl) a
             WHERE n.nspname = 'meri_service_identity'
               AND a.grantee NOT IN (n.nspowner, 'meri_temporal_issuer_service'::regrole))
    OR EXISTS (SELECT 1 FROM pg_class c CROSS JOIN LATERAL aclexplode(c.relacl) a
             WHERE c.oid = 'meri_service_identity.service_task_registrations'::regclass
               AND a.grantee NOT IN (c.relowner, 'meri_temporal_issuer_service'::regrole)) THEN
  RAISE EXCEPTION 'MERI_D2_ISSUER_ACL_NOT_EXCLUSIVE';
 END IF;
END $$;
RESET ROLE;
\endif

\if :{?phase_temporal_grants}
-- ===================================================================== TEMPORAL GRANTS (after temporal-sql-tool)
-- temporal-sql-tool ran as meri_temporal_migrator, so it owns every Temporal table. The installed catalog must
-- equal the reviewed pinned catalog (temporalio/temporal af08a5e5, postgres12 primary 1.19, visibility 1.14).
\connect temporal
SET ROLE meri_temporal_migrator;
DO $$
DECLARE expected text[] := ARRAY['schema_version','schema_update_history',
 'namespaces','namespace_metadata','shards','executions','current_executions','current_chasm_executions',
 'buffered_events','tasks','task_queues','tasks_v2','task_queues_v2','task_queue_user_data','build_id_to_task_queue',
 'history_immediate_tasks','history_scheduled_tasks','transfer_tasks','timer_tasks','replication_tasks',
 'replication_tasks_dlq','visibility_tasks','activity_info_maps','timer_info_maps','child_execution_info_maps',
 'request_cancel_info_maps','signal_info_maps','signals_requested_sets','chasm_node_maps','history_node',
 'history_tree','queue','queue_metadata','cluster_metadata_info','cluster_membership','queues','queue_messages',
 'nexus_endpoints','nexus_endpoints_partition_status'];
 actual text[]; seqs text[];
BEGIN
 SELECT coalesce(array_agg(relname::text ORDER BY relname::text COLLATE "C"), '{}') INTO actual FROM pg_class
  WHERE relnamespace = 'public'::regnamespace AND relkind IN ('r','p','v','m','f');
 IF actual <> (SELECT array_agg(x ORDER BY x COLLATE "C") FROM unnest(expected) AS x) THEN
  RAISE EXCEPTION 'MERI_D2_TEMPORAL_PRIMARY_CATALOG_MISMATCH %', actual;
 END IF;
 IF EXISTS (SELECT 1 FROM pg_class WHERE relnamespace = 'public'::regnamespace AND relkind IN ('r','p','S')
             AND pg_get_userbyid(relowner) <> 'meri_temporal_migrator') THEN
  RAISE EXCEPTION 'MERI_D2_TEMPORAL_PRIMARY_OWNER';
 END IF;
 SELECT coalesce(array_agg(relname::text ORDER BY relname::text COLLATE "C"), '{}') INTO seqs FROM pg_class
  WHERE relnamespace = 'public'::regnamespace AND relkind = 'S';
 IF seqs <> ARRAY['buffered_events_id_seq'] THEN RAISE EXCEPTION 'MERI_D2_TEMPORAL_PRIMARY_SEQUENCES %', seqs; END IF;
 IF (SELECT array_agg(curr_version::text) FROM public.schema_version) IS DISTINCT FROM ARRAY['1.19'] THEN
  RAISE EXCEPTION 'MERI_D2_TEMPORAL_PRIMARY_SCHEMA_VERSION';
 END IF;
END $$;
GRANT SELECT ON TABLE public.schema_version TO meri_temporal_primary_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
 public.namespaces, public.namespace_metadata, public.shards,
 public.executions, public.current_executions, public.current_chasm_executions,
 public.buffered_events, public.tasks, public.task_queues, public.tasks_v2, public.task_queues_v2,
 public.task_queue_user_data, public.build_id_to_task_queue,
 public.history_immediate_tasks, public.history_scheduled_tasks,
 public.transfer_tasks, public.timer_tasks, public.replication_tasks, public.replication_tasks_dlq,
 public.visibility_tasks, public.activity_info_maps, public.timer_info_maps,
 public.child_execution_info_maps, public.request_cancel_info_maps, public.signal_info_maps,
 public.signals_requested_sets, public.chasm_node_maps, public.history_node, public.history_tree,
 public.queue, public.queue_metadata, public.cluster_metadata_info, public.cluster_membership,
 public.queues, public.queue_messages, public.nexus_endpoints, public.nexus_endpoints_partition_status
 TO meri_temporal_primary_runtime;
GRANT USAGE ON SEQUENCE public.buffered_events_id_seq TO meri_temporal_primary_runtime;
RESET ROLE;

\connect temporal_visibility
SET ROLE meri_temporal_migrator;
DO $$
DECLARE actual text[];
BEGIN
 SELECT coalesce(array_agg(relname::text ORDER BY relname::text COLLATE "C"), '{}') INTO actual FROM pg_class
  WHERE relnamespace = 'public'::regnamespace AND relkind IN ('r','p','v','m','f','S');
 IF actual <> ARRAY['executions_visibility','schema_update_history','schema_version'] THEN
  RAISE EXCEPTION 'MERI_D2_TEMPORAL_VISIBILITY_CATALOG_MISMATCH %', actual;
 END IF;
 IF EXISTS (SELECT 1 FROM pg_class WHERE relnamespace = 'public'::regnamespace AND relkind IN ('r','p')
             AND pg_get_userbyid(relowner) <> 'meri_temporal_migrator')
    OR to_regprocedure('public.convert_ts(character varying)') IS NULL
    OR (SELECT pg_get_userbyid(proowner) FROM pg_proc WHERE oid = to_regprocedure('public.convert_ts(character varying)'))
       <> 'meri_temporal_migrator' THEN
  RAISE EXCEPTION 'MERI_D2_TEMPORAL_VISIBILITY_OWNER';
 END IF;
 IF (SELECT array_agg(curr_version::text) FROM public.schema_version) IS DISTINCT FROM ARRAY['1.14'] THEN
  RAISE EXCEPTION 'MERI_D2_TEMPORAL_VISIBILITY_SCHEMA_VERSION';
 END IF;
END $$;
GRANT SELECT ON TABLE public.schema_version TO meri_temporal_visibility_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.executions_visibility TO meri_temporal_visibility_runtime;
REVOKE ALL ON FUNCTION public.convert_ts(character varying) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.convert_ts(character varying) TO meri_temporal_visibility_runtime;
RESET ROLE;

\connect capiro
-- Schema application is finished: the Temporal migration login is disabled until a reviewed upgrade
-- re-runs phase_bootstrap (which restores LOGIN from its secret).
ALTER ROLE meri_temporal_migrator WITH NOLOGIN;
\endif

\if :{?phase_release}
-- ===================================================================== RELEASE (end of every run)
-- Idempotent: a missing grant only produces a WARNING.
RESET ROLE;
REVOKE CREATE ON DATABASE capiro FROM meri_product_migrator;
REVOKE meri_product_migrator FROM CURRENT_USER;
REVOKE meri_temporal_migrator FROM CURRENT_USER;
\endif
