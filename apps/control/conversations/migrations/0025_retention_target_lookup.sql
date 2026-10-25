-- Exact-key lookup for the existing expired-conversation purge guard.
-- Hash indexing preserves accepted UTF-8 key sizes; PostgreSQL rechecks
-- the complete jsonb equality and every existing authority predicate.
BEGIN;
CREATE INDEX retention_purge_targets_planned_key
 ON meri_conversations.retention_purge_targets
 USING hash ((target->'key'))
 WHERE state='PLANNED';
COMMIT;
