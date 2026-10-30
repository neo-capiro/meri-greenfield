-- Existing control gets readonly allocation/nonce currentness privileges.
-- Native provisioning writer LOGIN/service binding is intentionally unselected.
\set ON_ERROR_STOP on
SELECT CASE WHEN (:{?phase_browser_host_control_grants})::int = 1 THEN 'ok'
 ELSE (SELECT 'MERI_BROWSER_HOST_GRANTS_PHASE_REQUIRED'::text)::int::text END AS phase_guard;
\if :{?phase_browser_host_control_grants}
BEGIN;
DO $$ BEGIN
 IF current_database()<>'capiro' OR current_user<>session_user THEN RAISE EXCEPTION 'MERI_BROWSER_HOST_INSTALLER_REQUIRED'; END IF;
 -- The existing Control service role may be LOGIN. This readonly privilege
 -- join neither changes login posture nor proves execution quiescence.
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='meri_control_runtime' AND NOT rolsuper AND NOT rolcreatedb AND NOT rolcreaterole AND NOT rolreplication AND NOT rolbypassrls) THEN
  RAISE EXCEPTION 'MERI_BROWSER_HOST_CONTROL_ROLE_REQUIRED';
 END IF;
END $$;
SET LOCAL ROLE meri_product_migrator;
GRANT USAGE ON SCHEMA meri_host_control TO meri_control_runtime;
GRANT SELECT ON meri_host_control.host_allocations TO meri_control_runtime;
GRANT SELECT,INSERT ON meri_host_control.request_nonces TO meri_control_runtime;
GRANT EXECUTE ON FUNCTION meri_host_control.lock_allocation(uuid,bigint),meri_host_control.lock_conversation(text,uuid) TO meri_control_runtime;
DO $$ BEGIN
 IF has_schema_privilege('meri_control_runtime','meri_host_control','CREATE')
  OR has_table_privilege('meri_control_runtime','meri_host_control.host_allocations','INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
  OR EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid='meri_host_control.host_allocations'::regclass AND attnum>0 AND NOT attisdropped
    AND has_column_privilege('meri_control_runtime',attrelid,attnum,'INSERT,UPDATE,REFERENCES'))
  OR has_table_privilege('meri_control_runtime','meri_host_control.request_nonces','UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') THEN
  RAISE EXCEPTION 'MERI_BROWSER_HOST_CONTROL_EXCESS_PRIVILEGE';
 END IF;
END $$;
COMMIT;
\endif
