-- Superseded historical source proposal only. The central owner has now
-- reserved conversation 0019 and authored the full source migration there;
-- register and qualify that numbered file, not this proposal. The
-- conversation store already provides a bounded exact-row inventory slice;
-- the complete canonical retention facts composer is still absent. The
-- source-qualified row owner also expects a distinct
-- meri_conversations.memory_proposal_retention_targets relation with
-- (workflow_id,tenant_id,conversation_id,run_id,key_sha256,plan_sha256,state,
-- ledger_sequence), plus a same-transaction exact-target DELETE trigger and
-- UPDATE refusal on the journal. Those are held for central migration review.
-- Startup readiness source already probes the journal relation. Never apply
-- this proposal file directly. The superseding, centrally source-allocated
-- conversation slot is 0019_memory_proposal_contexts.sql; published 0018
-- belongs to the distinct memory candidate target owner.
-- The conversation-store journal owns immutable rows and exact-key replay.
BEGIN;
CREATE TABLE meri_conversations.memory_proposal_contexts (
 tenant_id text NOT NULL,
 conversation_id uuid NOT NULL,
 run_id uuid NOT NULL,
 key_sha256 text NOT NULL CHECK (key_sha256 ~ '^[a-f0-9]{64}$'),
 record jsonb NOT NULL CHECK (octet_length(record::text) <= 1048576),
 record_sha256 text NOT NULL CHECK (record_sha256 ~ '^[a-f0-9]{64}$'),
 expires_at_ms bigint NOT NULL CHECK (expires_at_ms > 0),
 PRIMARY KEY (tenant_id,conversation_id,run_id,key_sha256),
 FOREIGN KEY (tenant_id,conversation_id,run_id) REFERENCES meri_conversations.runs
);
COMMIT;
