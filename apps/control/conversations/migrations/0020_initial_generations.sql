-- Meri C12 (decision O117): an original whose first turn never started is superseded by a new generation instead of
-- bricking its conversation after its window (at most 15 minutes) or a release. Both tables stay insert-only: their
-- immutability triggers (0016, 0017) are unchanged; a superseded generation and its reserved input remain as dead history.
-- The journal serves only the latest generation; supersession happens under the conversation's advisory lock.
BEGIN;
-- One original binding per conversation GENERATION. Existing rows are generation 1; the default keeps a first claim
-- by earlier code working (that code reads a conversation with several generations as corrupt: fail closed).
ALTER TABLE meri_conversations.initial_run_bindings
 ADD COLUMN generation integer NOT NULL DEFAULT 1 CHECK (generation BETWEEN 1 AND 1000000);
ALTER TABLE meri_conversations.initial_run_bindings DROP CONSTRAINT initial_run_bindings_pkey;
ALTER TABLE meri_conversations.initial_run_bindings ADD PRIMARY KEY (tenant_id,conversation_id,generation);
-- One original input per original RUN: the reserved input of a superseded generation never blocks the next one, and a
-- client retry may carry the same request id to the new run.
ALTER TABLE meri_conversations.initial_inputs DROP CONSTRAINT initial_inputs_pkey;
ALTER TABLE meri_conversations.initial_inputs ADD PRIMARY KEY (tenant_id,conversation_id,run_id);
ALTER TABLE meri_conversations.initial_inputs DROP CONSTRAINT initial_inputs_request_id_key;
ALTER TABLE meri_conversations.initial_inputs ADD UNIQUE (tenant_id,run_id,request_id);
COMMIT;
