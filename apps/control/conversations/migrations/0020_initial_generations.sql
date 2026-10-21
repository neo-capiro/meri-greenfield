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
-- Leading request_id also indexes the cross-conversation ownership probe. Enforce ownership for both current claims and
-- legacy writers during migration-first rollout: both acquire the conversation lock before this request lock.
ALTER TABLE meri_conversations.initial_inputs ADD UNIQUE (request_id,tenant_id,run_id);
CREATE FUNCTION meri_conversations.guard_initial_input_request_owner() RETURNS trigger
 LANGUAGE plpgsql VOLATILE SECURITY INVOKER AS $$
BEGIN
 -- The ownership read must see a competing commit after waiting for its request lock. Reject snapshot isolation rather
 -- than silently weaken the old global request-id invariant; VOLATILE gives each query a fresh READ COMMITTED snapshot.
 IF pg_catalog.current_setting('transaction_isolation') <> 'read committed'
 THEN RAISE EXCEPTION 'INITIAL_INPUT_ISOLATION_REQUIRED' USING ERRCODE = '0A000'; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('meri_initial_input_request:' || NEW.request_id::text,0));
 IF EXISTS (SELECT 1 FROM meri_conversations.initial_inputs
            WHERE request_id = NEW.request_id AND (tenant_id <> NEW.tenant_id OR conversation_id <> NEW.conversation_id))
 THEN RAISE EXCEPTION 'INITIAL_INPUT_CONFLICT' USING ERRCODE = '23505'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER initial_input_request_owner BEFORE INSERT ON meri_conversations.initial_inputs
 FOR EACH ROW EXECUTE FUNCTION meri_conversations.guard_initial_input_request_owner();
COMMIT;
