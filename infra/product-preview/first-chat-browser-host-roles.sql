-- Forward installer phase before the host schema. No login, password, service
-- binding or activation. The ordinary migration owner remains NOCREATEROLE.
\set ON_ERROR_STOP on
SELECT CASE WHEN (:{?phase_browser_host_roles})::int = 1 THEN 'ok'
 ELSE (SELECT 'MERI_BROWSER_HOST_ROLES_PHASE_REQUIRED'::text)::int::text END AS phase_guard;
\if :{?phase_browser_host_roles}
BEGIN;
DO $$
DECLARE name text;
BEGIN
 IF current_database()<>'capiro' OR current_user<>session_user THEN RAISE EXCEPTION 'MERI_BROWSER_HOST_INSTALLER_REQUIRED'; END IF;
 FOREACH name IN ARRAY ARRAY['meri_host_allocator','meri_host_currentness'] LOOP
  IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=name) THEN
   EXECUTE format('CREATE ROLE %I NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS',name);
   EXECUTE format('COMMENT ON ROLE %I IS %L',name,'meri-browser-host-physical-owner-v1');
  ELSIF shobj_description(name::regrole,'pg_authid') IS DISTINCT FROM 'meri-browser-host-physical-owner-v1' THEN
   RAISE EXCEPTION 'MERI_BROWSER_HOST_ROLE_COLLISION';
  END IF;
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=name AND
    (rolcanlogin OR rolinherit OR rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls OR rolconnlimit<>-1))
   OR EXISTS(SELECT 1 FROM pg_auth_members WHERE member=name::regrole) THEN
   RAISE EXCEPTION 'MERI_BROWSER_HOST_ROLE_ATTRIBUTES';
  END IF;
 END LOOP;
END $$;
COMMIT;
\endif
