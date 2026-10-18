-- Centrally reserved conversation migration 0019 (18 October 2026).
-- Durable, immutable proposal-page continuation and its distinct exact-row
-- retention target. Conversation 0018 belongs to memory candidate targets;
-- held 0012 and 0014 are separate. This is source only: no live apply, purge
-- activation, or role grant is authorized by registering this file.
BEGIN;
CREATE TABLE meri_conversations.memory_proposal_contexts (
 tenant_id text NOT NULL, conversation_id uuid NOT NULL, run_id uuid NOT NULL,
 key_sha256 text NOT NULL CHECK (key_sha256 ~ '^[a-f0-9]{64}$'),
 record jsonb NOT NULL CHECK (jsonb_typeof(record) = 'object' AND octet_length(record::text) <= 1048576),
 record_sha256 text NOT NULL CHECK (record_sha256 ~ '^[a-f0-9]{64}$'),
 expires_at_ms bigint NOT NULL CHECK (expires_at_ms BETWEEN 1 AND 9007199254740991),
 PRIMARY KEY (tenant_id,conversation_id,run_id,key_sha256),
 FOREIGN KEY (tenant_id,conversation_id,run_id) REFERENCES meri_conversations.runs
);

-- This relation is deliberately distinct from retention_purge_targets: that
-- SDK mirror target requires session/subpath/sequence, which this row lacks.
-- No foreign key points to the context row, because its authorized deletion
-- must not leave a cascading or deferred-reference path around the trigger.
CREATE TABLE meri_conversations.memory_proposal_retention_targets (
 workflow_id text PRIMARY KEY CHECK (workflow_id ~ '^[a-f0-9]{64}$'),
 tenant_id text NOT NULL, conversation_id uuid NOT NULL,
 run_id uuid NOT NULL,
 key_sha256 text NOT NULL CHECK (key_sha256 ~ '^[a-f0-9]{64}$'),
 plan_sha256 text NOT NULL CHECK (plan_sha256 ~ '^[a-f0-9]{64}$'),
 state text NOT NULL CHECK (state IN ('PLANNED','EXECUTED','UNKNOWN')),
 ledger_sequence bigint NOT NULL CHECK (ledger_sequence >= 1),
 FOREIGN KEY (tenant_id,conversation_id) REFERENCES meri_conversations.retention_subjects
);
CREATE INDEX memory_proposal_retention_targets_row
 ON meri_conversations.memory_proposal_retention_targets
 (tenant_id,conversation_id,run_id,key_sha256);
CREATE UNIQUE INDEX memory_proposal_one_planned_target_per_row
 ON meri_conversations.memory_proposal_retention_targets
 (tenant_id,conversation_id,run_id,key_sha256) WHERE state = 'PLANNED';

-- A planned target must be inserted or refreshed in this very transaction.
-- The subject must still be SUPPRESSED under that exact current purge plan;
-- an older target, another row, or another plan never authorizes a DELETE.
-- UPDATE and TRUNCATE are unconditionally refused. Nothing purges on install.
CREATE FUNCTION meri_conversations.reject_memory_proposal_context_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP <> 'DELETE' THEN
  RAISE EXCEPTION 'MEMORY_PROPOSAL_CONTEXT_IMMUTABLE';
 END IF;
 IF EXISTS (
  SELECT 1 FROM meri_conversations.memory_proposal_retention_targets t
  JOIN meri_conversations.retention_subjects s
    ON s.tenant_id = t.tenant_id AND s.conversation_id = t.conversation_id
  WHERE t.tenant_id = OLD.tenant_id AND t.conversation_id = OLD.conversation_id
    AND t.run_id = OLD.run_id AND t.key_sha256 = OLD.key_sha256
    AND t.state = 'PLANNED' AND t.xmin = pg_current_xact_id()::xid
    AND s.state = 'SUPPRESSED' AND s.projection->>'state' = 'SUPPRESSED'
    AND s.projection#>>'{purge,state}' IN ('PLANNED','UNKNOWN')
    AND s.projection#>>'{purge,planSha256}' = t.plan_sha256
    AND s.projection#>>'{purge,ledgerSequence}' = t.ledger_sequence::text
    AND s.projection->>'ledgerSequence' = s.ledger_sequence::text
 ) THEN RETURN OLD; END IF;
 RAISE EXCEPTION 'MEMORY_PROPOSAL_CONTEXT_IMMUTABLE';
END $$;
CREATE TRIGGER immutable_memory_proposal_context
 BEFORE UPDATE OR DELETE ON meri_conversations.memory_proposal_contexts
 FOR EACH ROW EXECUTE FUNCTION meri_conversations.reject_memory_proposal_context_mutation();
CREATE TRIGGER immutable_memory_proposal_context_truncate
 BEFORE TRUNCATE ON meri_conversations.memory_proposal_contexts
 FOR EACH STATEMENT EXECUTE FUNCTION meri_conversations.reject_memory_proposal_context_mutation();

-- Role review before installation: the task store needs schema USAGE,
-- SELECT, INSERT, and UPDATE(record_sha256) only for SELECT ... FOR UPDATE;
-- the trigger rejects actual UPDATE. The retention row owner separately needs
-- target SELECT/INSERT/UPDATE/DELETE for projection rebuild and context DELETE
-- for exact-row purge. Never grant TRUNCATE,
-- table ownership, or schema DDL to either application role.
COMMIT;
