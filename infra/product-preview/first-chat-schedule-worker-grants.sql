-- Forward schedule-worker activation, central ordinal 56. Existing applied bytes stay immutable.
-- The canonical phase runner uses the installer for role creation, then the existing schema owner for grants.
-- Private credential binding and LOGIN activation belong to the release operator, after this phase is reviewed/applied.
\set ON_ERROR_STOP on
SELECT CASE WHEN (:{?phase_schedule_worker_grants})::int = 1 THEN 'ok'
            ELSE (SELECT 'MERI_SCHEDULE_GRANTS_PHASE_REQUIRED'::text)::int::text END AS phase_guard;
\if :{?phase_schedule_worker_grants}
BEGIN;
DO $$
BEGIN
 IF current_database() <> 'capiro' OR current_user <> session_user THEN
  RAISE EXCEPTION 'MERI_SCHEDULE_INSTALLER_REQUIRED';
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='meri_schedule_runtime') THEN
  CREATE ROLE meri_schedule_runtime NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS CONNECTION LIMIT 10;
  COMMENT ON ROLE meri_schedule_runtime IS 'meri-first-chat-schedule-worker';
 ELSIF shobj_description('meri_schedule_runtime'::regrole,'pg_authid') IS DISTINCT FROM 'meri-first-chat-schedule-worker' THEN
  RAISE EXCEPTION 'MERI_SCHEDULE_ROLE_COLLISION';
 END IF;
 IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='meri_schedule_runtime'
            AND (rolcanlogin OR rolinherit OR rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls OR rolconnlimit<>10))
    OR EXISTS (SELECT 1 FROM pg_auth_members WHERE member='meri_schedule_runtime'::regrole) THEN
  RAISE EXCEPTION 'MERI_SCHEDULE_ROLE_ATTRIBUTES';
 END IF;
END $$;
GRANT CONNECT ON DATABASE capiro TO meri_schedule_runtime;
SET LOCAL ROLE meri_product_migrator;

-- These three canonical readers use FOR UPDATE. Reuse the existing statement guard so UPDATE of the
-- granted identity column (even a no-op or an empty-table update) is refused for every caller.
DO $$
DECLARE r record; guard oid; col int2; saved pg_trigger%ROWTYPE;
BEGIN
 guard := 'meri_conversations.reject_lock_column_update()'::regprocedure;
 FOR r IN SELECT * FROM (VALUES
  ('controls','control_id','lock_only_schedule_control'),
  ('initial_inputs','request_id','lock_only_schedule_initial_input'),
  ('native_executions','execution_id','lock_only_schedule_execution')) AS v(relation,column_name,trigger_name) LOOP
  SELECT attnum INTO STRICT col FROM pg_attribute
   WHERE attrelid=('meri_conversations.'||r.relation)::regclass AND attname=r.column_name AND NOT attisdropped;
  SELECT * INTO saved FROM pg_trigger WHERE tgrelid=('meri_conversations.'||r.relation)::regclass AND tgname=r.trigger_name;
  IF NOT FOUND THEN
   EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE OF %I ON meri_conversations.%I FOR EACH STATEMENT EXECUTE FUNCTION meri_conversations.reject_lock_column_update()',r.trigger_name,r.column_name,r.relation);
  ELSIF saved.tgfoid<>guard OR saved.tgtype<>18 OR saved.tgenabled<>'O' OR saved.tgattr::text<>col::text THEN
   RAISE EXCEPTION 'MERI_SCHEDULE_LOCK_GUARD_CONFLICT';
  END IF;
 END LOOP;
END $$;

GRANT USAGE ON SCHEMA meri_schedules, meri_intents, meri_conversations TO meri_schedule_runtime;
-- Current generation/acknowledgement and approved instruction custody are read-only. Core grants current firing authority.
GRANT SELECT ON meri_schedules.projections, meri_schedules.intents, meri_intents.preparations TO meri_schedule_runtime;
-- The schedule worker alone opens the durable occurrence barrier; control retains no occurrence INSERT.
GRANT SELECT, INSERT ON meri_schedules.occurrences TO meri_schedule_runtime;
GRANT UPDATE (state,updated_at) ON meri_schedules.occurrences TO meri_schedule_runtime;
-- Canonical admission and retirement remain private control operations. Only the cancellation journal writes here.
GRANT SELECT ON meri_conversations.runs, meri_conversations.events, meri_conversations.controls,
 meri_conversations.initial_inputs, meri_conversations.next_runs, meri_conversations.native_executions,
 meri_conversations.native_allocations TO meri_schedule_runtime;
GRANT INSERT ON meri_conversations.events TO meri_schedule_runtime;
GRANT UPDATE (projection,projection_sha256,last_sequence) ON meri_conversations.runs TO meri_schedule_runtime;
GRANT UPDATE (control_id) ON meri_conversations.controls TO meri_schedule_runtime;
GRANT UPDATE (request_id) ON meri_conversations.initial_inputs TO meri_schedule_runtime;
GRANT UPDATE (execution_id) ON meri_conversations.native_executions TO meri_schedule_runtime;

-- Effective privileges include inherited/PUBLIC rights. Refuse unexpected table or column rights and owner/RLS bypass.
DO $$
BEGIN
 IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname LIKE 'meri\_%' AND c.relowner='meri_schedule_runtime'::regrole)
 OR EXISTS (SELECT 1 FROM pg_namespace n WHERE n.nspname LIKE 'meri\_%'
  AND (has_schema_privilege('meri_schedule_runtime',n.oid,'CREATE')
   OR has_schema_privilege('meri_schedule_runtime',n.oid,'USAGE') AND n.nspname NOT IN ('meri_schedules','meri_intents','meri_conversations'))) THEN
  RAISE EXCEPTION 'MERI_SCHEDULE_SCHEMA_PRIVILEGE';
 END IF;
 IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  CROSS JOIN (VALUES ('SELECT'),('INSERT'),('UPDATE'),('DELETE'),('TRUNCATE'),('REFERENCES'),('TRIGGER')) AS p(priv)
  WHERE n.nspname LIKE 'meri\_%' AND c.relkind IN ('r','p','v','m') AND has_table_privilege('meri_schedule_runtime',c.oid,p.priv)
  AND NOT (p.priv='SELECT' AND c.oid::regclass::text IN (
   'meri_schedules.projections','meri_schedules.intents','meri_intents.preparations','meri_schedules.occurrences',
   'meri_conversations.runs','meri_conversations.events','meri_conversations.controls','meri_conversations.initial_inputs',
   'meri_conversations.next_runs','meri_conversations.native_executions','meri_conversations.native_allocations')
   OR p.priv='INSERT' AND c.oid::regclass::text IN ('meri_schedules.occurrences','meri_conversations.events'))) THEN
  RAISE EXCEPTION 'MERI_SCHEDULE_EXCESS_TABLE_PRIVILEGE';
 END IF;
 IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  JOIN pg_attribute a ON a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped
  WHERE n.nspname LIKE 'meri\_%' AND c.relkind IN ('r','p','v','m')
   AND has_column_privilege('meri_schedule_runtime',c.oid,a.attnum,'UPDATE')
   AND NOT (c.oid='meri_schedules.occurrences'::regclass AND a.attname IN ('state','updated_at')
    OR c.oid='meri_conversations.runs'::regclass AND a.attname IN ('projection','projection_sha256','last_sequence')
    OR c.oid='meri_conversations.controls'::regclass AND a.attname='control_id'
    OR c.oid='meri_conversations.initial_inputs'::regclass AND a.attname='request_id'
    OR c.oid='meri_conversations.native_executions'::regclass AND a.attname='execution_id')) THEN
  RAISE EXCEPTION 'MERI_SCHEDULE_EXCESS_COLUMN_PRIVILEGE';
 END IF;
 IF has_table_privilege('meri_control_runtime','meri_schedules.occurrences','INSERT') THEN
  RAISE EXCEPTION 'MERI_SCHEDULE_CONTROL_OCCURRENCE_INSERT';
 END IF;
END $$;
COMMIT;
\endif
