-- Forward-only control serving/recovery rights. Apply after conversations/0018,
-- conversations/0019 and memory/0002 through the canonical integration ledger.
-- Existing migrations and phase grants remain immutable. This grants no physical
-- content erasure, candidate tombstone mutation, schema ownership or schedule write.
BEGIN;

-- The context trigger rejects actual UPDATE; this column privilege permits the
-- existing SELECT ... FOR UPDATE used by the immutable retain/replay owner.
GRANT SELECT, INSERT ON meri_conversations.memory_proposal_contexts TO meri_control_runtime;
GRANT UPDATE (record_sha256) ON meri_conversations.memory_proposal_contexts TO meri_control_runtime;

GRANT SELECT, INSERT ON meri_conversations.retention_subjects, meri_artifacts.retention_subjects TO meri_control_runtime;
GRANT UPDATE (owner_actor_id, state, suppressed_at, released_at, ledger_sequence, entry_sha256, projection, projection_sha256)
 ON meri_conversations.retention_subjects, meri_artifacts.retention_subjects TO meri_control_runtime;

-- Recovery replaces subject-local projection metadata even with purge disabled.
-- These DELETE privileges do not reach SDK entries, artifact versions or contexts.
GRANT INSERT, DELETE ON meri_conversations.retention_purges, meri_artifacts.retention_purges,
 meri_conversations.retention_purge_targets TO meri_control_runtime;
GRANT SELECT (tenant_id, conversation_id) ON meri_conversations.retention_purges,
 meri_conversations.retention_purge_targets TO meri_control_runtime;
GRANT SELECT (tenant_id, artifact_id) ON meri_artifacts.retention_purges TO meri_control_runtime;

GRANT SELECT (singleton, sequence, entry_sha256), INSERT (singleton, sequence, entry_sha256),
 UPDATE (sequence, entry_sha256) ON meri_conversations.retention_recovery_watermark TO meri_control_runtime;
COMMIT;
