-- Meri first-chat preview: Temporal grants (phase_temporal_grants only), run by first-chat-migrate.mjs stage 'temporal'.
-- Supersedes the phase_temporal_grants section of first-chat-database.sql, which stays byte-identical because its
-- sha256 is recorded in meri_migration_ledger by the applied 'meri' stage. Change from that section: the pinned
-- Temporal 1.32.1 postgres12 1.19 schema (temporal-sql-tool, admin-tools 4fdaf912…) also creates the legacy
-- cluster_metadata table, observed live on 17 Oct; it joins the reviewed catalog and the runtime grant.
\set ON_ERROR_STOP on
SELECT CASE WHEN (:{?phase_temporal_grants})::int = 1 THEN 'ok'
            ELSE (SELECT 'MERI_D2_TEMPORAL_GRANTS_PHASE_REQUIRED'::text)::int::text END AS phase_guard;

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
 'nexus_endpoints','nexus_endpoints_partition_status','cluster_metadata'];
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
 public.queue, public.queue_metadata, public.cluster_metadata_info, public.cluster_metadata, public.cluster_membership,
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
