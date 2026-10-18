-- Allocated source migration 0018 (2026-10-18). Extend the canonical conversation row-target journal for
-- memory payloads. The target records an exact row identity under the existing plan hash, suppression
-- generation and workflow ID; it neither deletes content nor grants any writer permission. The central
-- retention row owner must inventory, plan, write and recover these classes before enabling purge.
-- SDK targets created by 0010 retain their original required identity and delete guard.
BEGIN;

ALTER TABLE meri_conversations.retention_purge_targets
  DROP CONSTRAINT retention_purge_targets_class_check,
  ALTER COLUMN run_id DROP NOT NULL,
  ALTER COLUMN session_id DROP NOT NULL,
  ALTER COLUMN subpath DROP NOT NULL,
  ALTER COLUMN sequence DROP NOT NULL,
  ADD COLUMN candidate_id uuid,
  ADD COLUMN proposal_id uuid,
  ADD COLUMN command_id uuid,
  ADD COLUMN delivery_id text,
  ADD COLUMN actor_id text;

ALTER TABLE meri_conversations.retention_purge_targets
  ADD CONSTRAINT retention_purge_targets_class_check CHECK (class IN (
    'sdkSession',
    'meriMemoryCandidates',
    'meriMemoryApprovalMetadata',
    'meriMemoryCommandJournal',
    'meriMemoryIntentPreparations'
  )),
  ADD CONSTRAINT retention_purge_targets_memory_identity_check CHECK (
    (class = 'sdkSession'
      AND run_id IS NOT NULL AND session_id IS NOT NULL AND subpath IS NOT NULL AND sequence IS NOT NULL
      AND candidate_id IS NULL AND proposal_id IS NULL AND command_id IS NULL AND delivery_id IS NULL AND actor_id IS NULL)
    OR (class = 'meriMemoryCandidates'
      AND candidate_id IS NOT NULL AND actor_id IS NOT NULL AND length(actor_id) BETWEEN 1 AND 128
      AND run_id IS NULL AND session_id IS NULL AND subpath IS NULL AND sequence IS NULL
      AND proposal_id IS NULL AND command_id IS NULL AND delivery_id IS NULL)
    OR (class = 'meriMemoryApprovalMetadata'
      AND proposal_id IS NOT NULL AND actor_id IS NOT NULL AND length(actor_id) BETWEEN 1 AND 128
      AND run_id IS NULL AND session_id IS NULL AND subpath IS NULL AND sequence IS NULL
      AND candidate_id IS NULL AND command_id IS NULL AND delivery_id IS NULL)
    OR (class = 'meriMemoryCommandJournal'
      AND command_id IS NOT NULL AND actor_id IS NOT NULL AND length(actor_id) BETWEEN 1 AND 128
      AND run_id IS NULL AND session_id IS NULL AND subpath IS NULL AND sequence IS NULL
      AND candidate_id IS NULL AND proposal_id IS NULL AND delivery_id IS NULL)
    OR (class = 'meriMemoryIntentPreparations'
      AND delivery_id IS NOT NULL AND delivery_id ~ '^sdk:[a-f0-9]{64}$'
      AND actor_id IS NOT NULL AND length(actor_id) BETWEEN 1 AND 128
      AND run_id IS NULL AND session_id IS NULL AND subpath IS NULL AND sequence IS NULL
      AND candidate_id IS NULL AND proposal_id IS NULL AND command_id IS NULL)
  );

-- A row may legitimately recur in a new suppression plan. These are lookup indexes, not uniqueness
-- constraints; workflow_id remains the target journal's unique identity.
CREATE INDEX retention_purge_targets_memory_candidate ON meri_conversations.retention_purge_targets
  (tenant_id, conversation_id, actor_id, candidate_id) WHERE class = 'meriMemoryCandidates';
CREATE INDEX retention_purge_targets_memory_approval_metadata ON meri_conversations.retention_purge_targets
  (tenant_id, conversation_id, actor_id, proposal_id) WHERE class = 'meriMemoryApprovalMetadata';
CREATE INDEX retention_purge_targets_memory_command_journal ON meri_conversations.retention_purge_targets
  (tenant_id, conversation_id, actor_id, command_id) WHERE class = 'meriMemoryCommandJournal';
CREATE INDEX retention_purge_targets_memory_intent_preparations ON meri_conversations.retention_purge_targets
  (tenant_id, conversation_id, actor_id, delivery_id) WHERE class = 'meriMemoryIntentPreparations';

COMMIT;
