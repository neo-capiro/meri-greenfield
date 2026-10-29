-- Forward-only Core memory serving predicate. Reuse the existing content-free
-- Core authority schema and NOLOGIN reader; never give Core raw native tables.
-- Run through the canonical integration ledger as its existing installer, also
-- the Core migration owner. Earlier integration creates the schema/reader.
\set ON_ERROR_STOP on
SELECT CASE WHEN (:{?phase_core_retention_serving})::int = 1 THEN 'ok'
            ELSE (SELECT 'MERI_CORE_RETENTION_PHASE_REQUIRED'::text)::int::text END AS phase_guard;
\if :{?phase_core_retention_serving}
BEGIN;
SET LOCAL ROLE NONE;
DO $$ BEGIN
 IF current_user<>session_user OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='meri_core_admission_reader'
   AND NOT rolcanlogin AND NOT rolinherit AND NOT rolsuper AND NOT rolbypassrls) OR
   EXISTS(SELECT 1 FROM pg_auth_members WHERE roleid='meri_core_admission_reader'::regrole) THEN
   RAISE EXCEPTION 'MERI_CORE_RETENTION_INSTALLER_REQUIRED';
 END IF;
END $$;
GRANT meri_core_admission_reader TO SESSION_USER WITH SET TRUE, INHERIT FALSE, ADMIN FALSE;
GRANT CREATE ON SCHEMA meri_core_authority TO meri_core_admission_reader;
SET LOCAL ROLE meri_product_migrator;
GRANT SELECT (tenant_id,conversation_id,owner_actor_id) ON meri_conversations.conversations TO meri_core_admission_reader;
GRANT SELECT (tenant_id,conversation_id,owner_actor_id,state,ledger_sequence) ON meri_conversations.retention_subjects TO meri_core_admission_reader;
GRANT SELECT (singleton,sequence,entry_sha256) ON meri_conversations.retention_recovery_watermark TO meri_core_admission_reader;
SET LOCAL ROLE meri_core_admission_reader;

CREATE OR REPLACE FUNCTION meri_core_authority.retention_serving_v1(
 p_tenant uuid,p_actor uuid,p_conversation uuid,p_sequence bigint,p_digest text
) RETURNS boolean LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE position bigint; digest text; retained record;
BEGIN
 IF p_tenant IS NULL OR p_tenant::text IS DISTINCT FROM nullif(current_setting('app.current_tenant',true),'') OR
    p_sequence IS NULL OR p_sequence<0 OR p_sequence>9007199254740991 OR
    (CASE WHEN p_sequence=0 THEN p_digest IS NOT NULL ELSE p_digest IS NULL OR p_digest !~ '^[a-f0-9]{64}$' END) THEN
   RAISE EXCEPTION 'MEMORY_RETENTION_WITNESS_INVALID';
 END IF;
 -- Native purge holds transition exclusion while calling Core cleanup. Core
 -- may already own a candidate row: try-lock refusal avoids lock inversion.
 IF p_conversation IS NOT NULL AND NOT pg_try_advisory_xact_lock_shared(hashtextextended(
      'meri_retention_transition:'||p_tenant::text||':conversation:'||p_conversation::text,0)) THEN
   RAISE EXCEPTION 'MEMORY_RETENTION_BUSY';
 END IF;
 IF NOT pg_try_advisory_xact_lock_shared(hashtextextended('meri_retention_recovery',0)) THEN
   RAISE EXCEPTION 'MEMORY_RETENTION_BUSY';
 END IF;
 SELECT w.sequence,w.entry_sha256 INTO position,digest FROM meri_conversations.retention_recovery_watermark w WHERE singleton;
 IF position IS NULL OR position<>p_sequence OR digest IS NOT NULL AND digest IS DISTINCT FROM p_digest THEN
   RAISE EXCEPTION 'MEMORY_RETENTION_WATERMARK_UNVERIFIED';
 END IF;
 -- The final transaction verification needs only the recovered watermark;
 -- subject exclusions acquired by earlier calls are held until transaction end.
 IF p_conversation IS NULL THEN RETURN true; END IF;
 IF p_actor IS NULL OR NOT EXISTS(SELECT 1 FROM meri_conversations.conversations
   WHERE tenant_id=p_tenant::text AND conversation_id=p_conversation AND owner_actor_id=p_actor::text) THEN RETURN false; END IF;
 SELECT state,owner_actor_id,ledger_sequence INTO retained FROM meri_conversations.retention_subjects
   WHERE tenant_id=p_tenant::text AND conversation_id=p_conversation;
 IF retained.state IS NULL THEN RETURN true; END IF;
 IF retained.ledger_sequence>position THEN RAISE EXCEPTION 'MEMORY_RETENTION_PROJECTION_UNVERIFIED'; END IF;
 RETURN retained.state='RELEASED' AND retained.owner_actor_id=p_actor::text;
END $$;
REVOKE ALL ON FUNCTION meri_core_authority.retention_serving_v1(uuid,uuid,uuid,bigint,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION meri_core_authority.retention_serving_v1(uuid,uuid,uuid,bigint,text) TO capiro_app, SESSION_USER;
SET LOCAL ROLE NONE;
REVOKE CREATE ON SCHEMA meri_core_authority FROM meri_core_admission_reader;
REVOKE meri_core_admission_reader FROM SESSION_USER;
SET LOCAL ROLE meri_product_migrator;
COMMIT;
\endif
