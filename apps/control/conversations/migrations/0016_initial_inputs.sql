-- Centrally reserved source0016, table meri_conversations.initial_inputs, Startup sole author (16 October 2026).
-- One original input identity under the existing conversation transaction; no blank Run/Conversation or execution grant.
-- Allocation contains context and raw/prepared input DIGESTS only, not duplicate prompt text or credentials.
-- No deletion/reclaim/lease refresh. Source only: application, database and restore qualification remain separate.
BEGIN;
CREATE TABLE meri_conversations.initial_inputs (
 tenant_id text NOT NULL CHECK (length(tenant_id) BETWEEN 1 AND 256),
 conversation_id uuid NOT NULL, run_id uuid NOT NULL,
 request_id uuid NOT NULL UNIQUE,
 allocation jsonb NOT NULL CHECK (jsonb_typeof(allocation) = 'object'),
 allocation_sha256 text NOT NULL CHECK (allocation_sha256 ~ '^[a-f0-9]{64}$'),
 state text NOT NULL CHECK (state IN ('RESERVED','ACCEPTED')),
 accepted_request_sha256 text CHECK (accepted_request_sha256 ~ '^[a-f0-9]{64}$'),
 PRIMARY KEY (tenant_id,conversation_id),
 CHECK (allocation ?& ARRAY['binding','scopes','versions','selectedClientId','requestId','inputSha256','requestSha256','allocatedAtMs','expiresAtMs']),
 CHECK (jsonb_typeof(allocation->'binding') = 'object'),
 CHECK (allocation->'binding'->>'tenantId' = tenant_id),
 CHECK (allocation->'binding'->>'conversationId' = conversation_id::text),
 CHECK (allocation->'binding'->>'runId' = run_id::text),
 CHECK (allocation->'binding'->>'writerFence' = '1'),
 CHECK (allocation->>'requestId' = request_id::text),
 CHECK (allocation->>'inputSha256' ~ '^[a-f0-9]{64}$'),
 CHECK (allocation->>'requestSha256' ~ '^[a-f0-9]{64}$'),
 CHECK ((state = 'RESERVED' AND accepted_request_sha256 IS NULL) OR
        (state = 'ACCEPTED' AND accepted_request_sha256 IS NOT NULL AND accepted_request_sha256 = allocation->>'requestSha256'))
);
CREATE FUNCTION meri_conversations.guard_initial_input() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'INITIAL_INPUT_IMMUTABLE'; END IF;
 IF (NEW.tenant_id,NEW.conversation_id,NEW.run_id,NEW.request_id,NEW.allocation,NEW.allocation_sha256)
    IS DISTINCT FROM
    (OLD.tenant_id,OLD.conversation_id,OLD.run_id,OLD.request_id,OLD.allocation,OLD.allocation_sha256)
 THEN RAISE EXCEPTION 'INITIAL_INPUT_IMMUTABLE'; END IF;
 IF NOT (OLD.state = 'RESERVED' AND NEW.state = 'ACCEPTED' AND NEW.accepted_request_sha256 = OLD.allocation->>'requestSha256')
 THEN RAISE EXCEPTION 'INITIAL_INPUT_TRANSITION'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER immutable_initial_input BEFORE UPDATE OR DELETE ON meri_conversations.initial_inputs
 FOR EACH ROW EXECUTE FUNCTION meri_conversations.guard_initial_input();
COMMIT;
