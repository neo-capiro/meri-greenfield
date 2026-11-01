-- Assigned intents/0005 forward source only. Preserve 0001-0004 and the non-reusable delivery fence unchanged. The runner
-- owns the transaction. No data is read, rewritten or redacted; no role, grant or policy changes.
-- The actor-wide approval inbox (apps/control/intents/approval.mjs inbox/inboxCount, postgres-journal.mjs listForActor/
-- countForActor) reads one tenant/actor's prepared sdk deliveries newest first and counts the ones inside their window.
-- This index serves exactly that scan; the per-conversation list keeps using the primary key.
CREATE INDEX preparations_actor_inbox ON meri_intents.preparations
 (tenant_id, actor_id, created_at DESC, conversation_id DESC, delivery_id DESC)
 WHERE delivery_id LIKE 'sdk:%' AND state = 'PREPARED';
