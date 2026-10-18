-- Source proposal only. A central owner must allocate a product migration ID,
-- register this table and SELECT/INSERT role grants in the migration tree, and
-- extend the canonical retention inventory producer and purge row owner before
-- installation. Startup readiness source already probes this relation. Never
-- apply this proposal file directly.
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
