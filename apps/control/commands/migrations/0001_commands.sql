-- Source-only command intent journal. Apply explicitly to separately admitted state.
-- No source candidate/task/document table or automatic migration is created.
-- Meri-owned schema, never Core's shared public schema. Either command migration may run first.
CREATE SCHEMA IF NOT EXISTS meri_commands;
CREATE TABLE meri_commands.command_journal (
 tenant_id text NOT NULL,
 actor_id text NOT NULL,
 idempotency_key text NOT NULL CHECK (length(idempotency_key) BETWEEN 1 AND 128),
 command_id uuid NOT NULL,
 command_sha256 text NOT NULL CHECK (command_sha256 ~ '^[a-f0-9]{64}$'),
 proposal_sha256 text NOT NULL CHECK (proposal_sha256 ~ '^[a-f0-9]{64}$'),
 payload_sha256 text NOT NULL CHECK (payload_sha256 ~ '^[a-f0-9]{64}$'),
 payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
 executor jsonb NOT NULL CHECK (jsonb_typeof(executor) = 'object'),
 state text NOT NULL CHECK (state IN ('CLAIMED','UNKNOWN','OUTCOME')),
 outcome jsonb,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY (tenant_id, actor_id, idempotency_key),
 UNIQUE (tenant_id, actor_id, command_id),
 CHECK ((state = 'OUTCOME') = (outcome IS NOT NULL))
);
