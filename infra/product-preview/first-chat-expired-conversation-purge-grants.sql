-- Apply only after conversations/0023 and the existing integration grants.
-- The existing control role performs exact-target expired Trash erasure. No
-- parent, consumed-key, accounting, artifact, schema or TRUNCATE grant is added.
BEGIN;
GRANT SELECT, INSERT, UPDATE, DELETE ON meri_conversations.retention_purge_targets TO meri_control_runtime;

GRANT DELETE ON meri_conversations.events, meri_conversations.controls,
 meri_conversations.checkpoints, meri_conversations.completion_checkpoints,
 meri_conversations.next_runs, meri_conversations.memory_proposal_contexts,
 meri_conversations.sdk_sessions, meri_conversations.sdk_session_streams,
 meri_conversations.sdk_session_entries, meri_conversations.sdk_session_batches,
 meri_conversations.native_allocations, meri_conversations.native_restorations,
 meri_conversations.selected_outputs, meri_conversations.selected_reads,
 meri_task_lookup.events TO meri_control_runtime;

-- Existing immutable guards reject actual updates to these columns. The column
-- grants allow the row owner's SELECT FOR UPDATE validation before deletion.
GRANT UPDATE (entry_sha256) ON meri_conversations.sdk_session_entries TO meri_control_runtime;
GRANT UPDATE (receipt_sha256) ON meri_conversations.sdk_session_batches TO meri_control_runtime;
-- Checkpoints are immutable through their owner; this extra lock-only trigger
-- is installed by 0023 before this privilege is granted.
GRANT UPDATE (proof_sha256) ON meri_conversations.checkpoints TO meri_control_runtime;
GRANT UPDATE (event_id) ON meri_conversations.events TO meri_control_runtime;

GRANT UPDATE (request,continuation,continuation_sha256) ON meri_conversations.runs TO meri_control_runtime;
GRANT UPDATE (payload) ON meri_commands.approval_metadata TO meri_control_runtime;
GRANT UPDATE (payload,outcome) ON meri_commands.command_journal TO meri_control_runtime;
GRANT UPDATE (payload,record) ON meri_task_lookup.lookups TO meri_control_runtime;
GRANT UPDATE (outcome_purged_at) ON meri_intents.preparations TO meri_control_runtime;
GRANT UPDATE (candidate,candidate_purged_at) ON meri_memory.candidates TO meri_control_runtime;
COMMIT;
