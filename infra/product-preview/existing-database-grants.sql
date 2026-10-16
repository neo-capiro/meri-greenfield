-- REVIEW-ONLY named SQL proposal at source e4fc10347c7bf557eff93423e42816834b009a4e.
-- Never applied. All SQL blocks below are comments: this file cannot create a
-- login, credential, database, grant, trigger, or migration when executed.
-- Exact names are PROPOSED, except temporal/temporal_visibility source names.
-- See EXISTING-DATABASE-GRANTS-20261016.md for approved cluster and role scope.
-- A separately approved manifest must allocate guard migrations and split these
-- blocks by database/owner before application. No Capiro public grants change.

/* ROLE PROVISIONING SPECIFICATION -- administrator only, separately approved.
CREATE ROLE meri_product_migrator NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
CREATE ROLE meri_control_runtime NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
CREATE ROLE meri_model_budget_owner NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
CREATE ROLE meri_temporal_migrator NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
CREATE ROLE meri_temporal_primary_runtime NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
CREATE ROLE meri_temporal_visibility_runtime NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
-- Existing database capiro keeps its database owner, PUBLIC privileges and
-- unrelated application grants. meri_product_migrator owns only allocated Meri
-- schemas. Temporal logical names require exclusive catalog/allocation proof;
-- this source authorizes no database creation. No runtime owner membership.
-- No LOGIN, password, IAM auth membership or guessed execution login is defined.
*/

/* DATABASE capiro -- existing approved application database.
-- Preserve database-wide PUBLIC/other-application ACLs and public schema.
-- Connect only under a separately approved Meri login and exact membership.
GRANT CONNECT ON DATABASE capiro TO meri_control_runtime, meri_model_budget_owner;
GRANT USAGE ON SCHEMA meri_conversations, meri_product_budget TO meri_control_runtime, meri_model_budget_owner;
-- Each schema and all its tables/sequences/functions must be migration-owned.
-- No schema CREATE or default privileges are granted to any runtime role.
*/

/* DATABASE capiro -- NEW GUARD SOURCE, CENTRAL MIGRATION ID UNALLOCATED.
-- Install/qualify before the lock-only column privileges below. Trigger scopes
-- forbid only UPDATE OF the chosen lock column. Other owner state writes remain
-- possible according to their separate grants; no full-table append-only claim.
-- No IF NOT EXISTS/OR REPLACE hides preexisting conflicting guard source.
CREATE FUNCTION meri_conversations.reject_lock_column_update() RETURNS trigger
LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'MERI_LOCK_COLUMN_UPDATE_REFUSED'; END $$;
REVOKE ALL ON FUNCTION meri_conversations.reject_lock_column_update() FROM PUBLIC;
CREATE TRIGGER lock_only_conversation_projection BEFORE UPDATE OF projection_sha256
 ON meri_conversations.conversations FOR EACH STATEMENT EXECUTE FUNCTION meri_conversations.reject_lock_column_update();
CREATE TRIGGER lock_only_selected_preparation BEFORE UPDATE OF preparation_sha256
 ON meri_conversations.selected_outputs FOR EACH STATEMENT EXECUTE FUNCTION meri_conversations.reject_lock_column_update();

CREATE FUNCTION meri_product_budget.reject_lock_column_update() RETURNS trigger
LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'MERI_BUDGET_LOCK_COLUMN_UPDATE_REFUSED'; END $$;
REVOKE ALL ON FUNCTION meri_product_budget.reject_lock_column_update() FROM PUBLIC;
CREATE TRIGGER lock_only_budget_id BEFORE UPDATE OF id
 ON meri_product_budget.budget FOR EACH STATEMENT EXECUTE FUNCTION meri_product_budget.reject_lock_column_update();
CREATE TRIGGER lock_only_budget_run_policy BEFORE UPDATE OF policy_revision
 ON meri_product_budget.runs FOR EACH STATEMENT EXECUTE FUNCTION meri_product_budget.reject_lock_column_update();
CREATE TRIGGER lock_only_budget_grant_capability BEFORE UPDATE OF capability_sha256
 ON meri_product_budget.grants FOR EACH STATEMENT EXECUTE FUNCTION meri_product_budget.reject_lock_column_update();
CREATE TRIGGER lock_only_budget_allocation_sha BEFORE UPDATE OF allocation_sha256
 ON meri_product_budget.tool_run_allocations FOR EACH STATEMENT EXECUTE FUNCTION meri_product_budget.reject_lock_column_update();
CREATE TRIGGER lock_only_budget_binding_facts BEFORE UPDATE OF facts
 ON meri_product_budget.tool_grant_bindings FOR EACH STATEMENT EXECUTE FUNCTION meri_product_budget.reject_lock_column_update();
CREATE TRIGGER lock_only_tenant_budget_id BEFORE UPDATE OF tenant_id
 ON meri_product_budget.tenant_budgets FOR EACH STATEMENT EXECUTE FUNCTION meri_product_budget.reject_lock_column_update();
*/

/* DATABASE capiro -- first-chat CONTROL store, migration owner grants.
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
GRANT UPDATE (record,record_sha256) ON meri_conversations.native_allocations,meri_conversations.native_restorations TO meri_control_runtime;
GRANT UPDATE (state,grant_id,capability_sha256,material_ref,issued_at,version,facts_sha256)
 ON meri_conversations.run_issuances,meri_conversations.model_run_issuances TO meri_control_runtime;
GRANT UPDATE (state,accepted_request_sha256,allocation_sha256) ON meri_conversations.initial_inputs TO meri_control_runtime;
GRANT UPDATE (record_sha256) ON meri_conversations.initial_run_bindings TO meri_control_runtime;
-- 0017 rejects every UPDATE and DELETE plus TRUNCATE. Existing 0009/0016
-- triggers preserve the lock-only sequence_base/reservation/allocation hashes.
-- No DELETE, TRUNCATE, TRIGGER, REFERENCES or schema ownership is granted.
*/

/* DATABASE capiro -- CONTROL SDK/selected ports, only when mounted.
GRANT SELECT, INSERT ON TABLE
 meri_conversations.sdk_sessions,meri_conversations.sdk_session_streams,
 meri_conversations.sdk_session_entries,meri_conversations.sdk_session_batches,
 meri_conversations.selected_outputs,meri_conversations.selected_reads
 TO meri_control_runtime;
GRANT UPDATE (entries_count,bytes) ON meri_conversations.sdk_sessions TO meri_control_runtime;
GRANT UPDATE (last_sequence) ON meri_conversations.sdk_session_streams TO meri_control_runtime;
GRANT UPDATE (preparation_sha256) ON meri_conversations.selected_outputs TO meri_control_runtime;
GRANT UPDATE (stage,result_text,completion) ON meri_conversations.selected_reads TO meri_control_runtime;
-- Existing mirror/owner triggers remain enabled and migration-owned.
*/

/* DATABASE capiro -- CONTROL canonical allocation/admission owner.
GRANT SELECT ON TABLE
 meri_product_budget.budget,meri_product_budget.runs,meri_product_budget.grants,
 meri_product_budget.tool_run_allocations,meri_product_budget.tool_grant_bindings,
 meri_product_budget.tenant_budgets,meri_product_budget.tenant_run_reservations,
 meri_product_budget.budget_liabilities
 TO meri_control_runtime;
GRANT INSERT ON TABLE
 meri_product_budget.runs,meri_product_budget.grants,
 meri_product_budget.tool_run_allocations,meri_product_budget.tool_grant_bindings,
 meri_product_budget.tenant_run_reservations
 TO meri_control_runtime;
-- Row lock only; requires the rejecting UPDATE OF id trigger above. Control
-- receives no write privilege on consumed_micro_usd, cap or quarantine state.
GRANT UPDATE (id) ON meri_product_budget.budget TO meri_control_runtime;
GRANT UPDATE (policy_revision) ON meri_product_budget.runs TO meri_control_runtime;
GRANT UPDATE (state,capability_sha256) ON meri_product_budget.grants TO meri_control_runtime;
GRANT UPDATE (allocation_sha256) ON meri_product_budget.tool_run_allocations TO meri_control_runtime;
GRANT UPDATE (facts) ON meri_product_budget.tool_grant_bindings TO meri_control_runtime;
GRANT UPDATE (tenant_id) ON meri_product_budget.tenant_budgets TO meri_control_runtime;
GRANT UPDATE (state,settled_micro_usd,released_at,settled_at,not_dispatched_at)
 ON meri_product_budget.tenant_run_reservations TO meri_control_runtime;
-- No INSERT/cap mutation on operator budget/tenant policy rows.
*/

/* DATABASE capiro -- MODEL owner reservation, settlement and readback.
GRANT SELECT ON TABLE
 meri_product_budget.budget,meri_product_budget.runs,meri_product_budget.grants,
 meri_product_budget.tool_run_allocations,meri_product_budget.tool_grant_bindings,
 meri_product_budget.requests,meri_product_budget.budget_liabilities
 TO meri_model_budget_owner;
GRANT SELECT ON TABLE meri_conversations.model_run_issuances TO meri_model_budget_owner;
GRANT SELECT ON TABLE meri_conversations.runs,meri_conversations.native_allocations,meri_conversations.events TO meri_model_budget_owner;
-- Canonical persisted lookup calls conversation allocation/read adapters with
-- FOR UPDATE. Existing 0009/0007 identity guards protect these lock columns.
GRANT UPDATE (sequence_base) ON meri_conversations.runs TO meri_model_budget_owner;
GRANT UPDATE (intent_key) ON meri_conversations.native_allocations TO meri_model_budget_owner;
GRANT INSERT ON TABLE meri_product_budget.requests TO meri_model_budget_owner;
GRANT UPDATE (consumed_micro_usd,quarantined) ON meri_product_budget.budget TO meri_model_budget_owner;
GRANT UPDATE (state,actual_micro_usd,evidence_sha256,settled_at) ON meri_product_budget.requests TO meri_model_budget_owner;
-- Lock-only privileges need the allocated/qualified guards above.
GRANT UPDATE (policy_revision) ON meri_product_budget.runs TO meri_model_budget_owner;
GRANT UPDATE (capability_sha256) ON meri_product_budget.grants TO meri_model_budget_owner;
GRANT UPDATE (allocation_sha256) ON meri_product_budget.tool_run_allocations TO meri_model_budget_owner;
GRANT UPDATE (facts) ON meri_product_budget.tool_grant_bindings TO meri_model_budget_owner;
-- No grant activation, issuance/model-material write, tool write, tenant-policy
-- write, cap mutation, DELETE/TRUNCATE/DDL/owner or grant-option privilege.
*/

/* DATABASE capiro -- optional read-only retention serving gate.
GRANT USAGE ON SCHEMA meri_artifacts TO meri_control_runtime;
GRANT SELECT ON TABLE
 meri_conversations.retention_subjects,meri_conversations.retention_purges,
 meri_conversations.retention_purge_targets,meri_conversations.retention_recovery_watermark,
 meri_artifacts.retention_subjects,meri_artifacts.retention_purges
 TO meri_control_runtime;
-- Only if exact watermark reconciliation is mounted/approved:
GRANT INSERT ON TABLE meri_conversations.retention_recovery_watermark TO meri_control_runtime;
GRANT UPDATE (sequence,entry_sha256) ON meri_conversations.retention_recovery_watermark TO meri_control_runtime;
-- Full retention writer performs DELETE/rebuild of plan rows. No corresponding
-- grant is silently added here; isolate/approve that port and its actual pool.
*/

/* DATABASE temporal -- dedicated logical DB, migration owner grants.
-- Pinned temporalio/temporal af08a5e5f2dd40f545f2afac7780daaa6987001e,
-- postgres12 primary target1.19. Actual migrated table/sequence set must equal
-- the reviewed catalog; no ALL TABLES or future-object default privileges.
REVOKE CONNECT, CREATE, TEMPORARY ON DATABASE temporal FROM PUBLIC;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT CONNECT ON DATABASE temporal TO meri_temporal_primary_runtime;
GRANT USAGE ON SCHEMA public TO meri_temporal_primary_runtime;
GRANT SELECT ON TABLE public.schema_version TO meri_temporal_primary_runtime;
GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE
 public.namespaces,public.namespace_metadata,public.shards,
 public.executions,public.current_executions,public.current_chasm_executions,
 public.buffered_events,public.tasks,public.task_queues,public.tasks_v2,public.task_queues_v2,
 public.task_queue_user_data,public.build_id_to_task_queue,
 public.history_immediate_tasks,public.history_scheduled_tasks,
 public.transfer_tasks,public.timer_tasks,public.replication_tasks,public.replication_tasks_dlq,
 public.visibility_tasks,public.activity_info_maps,public.timer_info_maps,
 public.child_execution_info_maps,public.request_cancel_info_maps,public.signal_info_maps,
 public.signals_requested_sets,public.chasm_node_maps,public.history_node,public.history_tree,
 public.queue,public.queue_metadata,public.cluster_metadata_info,public.cluster_membership,
 public.queues,public.queue_messages,public.nexus_endpoints,public.nexus_endpoints_partition_status
 TO meri_temporal_primary_runtime;
GRANT USAGE ON SEQUENCE public.buffered_events_id_seq TO meri_temporal_primary_runtime;
-- schema_update_history and schema_version writes remain migration-owner only.
-- No public schema CREATE, DDL, TEMP, TRUNCATE, extension or owner grants.
*/

/* DATABASE temporal_visibility -- dedicated logical DB, migration owner grants.
-- Same pinned source, postgres12 visibility target1.14. btree_gin installation
-- is separately approved administrator DDL; server role cannot install it.
REVOKE CONNECT, CREATE, TEMPORARY ON DATABASE temporal_visibility FROM PUBLIC;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT CONNECT ON DATABASE temporal_visibility TO meri_temporal_visibility_runtime;
GRANT USAGE ON SCHEMA public TO meri_temporal_visibility_runtime;
GRANT SELECT ON TABLE public.schema_version TO meri_temporal_visibility_runtime;
GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE public.executions_visibility TO meri_temporal_visibility_runtime;
REVOKE ALL ON FUNCTION public.convert_ts(character varying) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.convert_ts(character varying) TO meri_temporal_visibility_runtime;
-- No direct application/poller/runner access to either Temporal SQL database.
-- Schema history writes, extension DDL and schema/table ownership remain with
-- approved migration/admin identities, never delivered in runtime material.
*/
