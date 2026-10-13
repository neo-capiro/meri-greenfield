-- Centrally allocated product migration; does not touch native qualification pins.
BEGIN;
CREATE SCHEMA IF NOT EXISTS meri_conversations;
CREATE TABLE meri_conversations.conversations (
 tenant_id text NOT NULL, conversation_id uuid NOT NULL, owner_actor_id text NOT NULL,
 projection jsonb NOT NULL, projection_sha256 text NOT NULL,
 PRIMARY KEY (tenant_id, conversation_id)
);
CREATE TABLE meri_conversations.runs (
 tenant_id text NOT NULL, conversation_id uuid NOT NULL, run_id uuid NOT NULL,
 projection jsonb NOT NULL, projection_sha256 text NOT NULL,
 request_id uuid NOT NULL, request jsonb NOT NULL, request_sha256 text NOT NULL,
 last_sequence bigint NOT NULL DEFAULT 0 CHECK(last_sequence >= 0),
 PRIMARY KEY (tenant_id, conversation_id, run_id),
 UNIQUE (tenant_id, conversation_id, request_id),
 FOREIGN KEY (tenant_id, conversation_id) REFERENCES meri_conversations.conversations
);
CREATE TABLE meri_conversations.events (
 tenant_id text NOT NULL, conversation_id uuid NOT NULL, run_id uuid NOT NULL,
 sequence bigint NOT NULL CHECK(sequence > 0), event_id uuid NOT NULL,
 event jsonb NOT NULL, event_sha256 text NOT NULL,
 PRIMARY KEY (tenant_id, conversation_id, run_id, sequence),
 UNIQUE (tenant_id, conversation_id, run_id, event_id),
 FOREIGN KEY (tenant_id, conversation_id, run_id) REFERENCES meri_conversations.runs
);
COMMIT;
