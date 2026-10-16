-- Parent released source authoring under central allocation 0b0b7abd536a27a74e3b1077ae71eed6e0ba275b, 16 October 2026.
-- Canonical namespace only. Historical unqualified P-INT-M1 proposal remains unchanged. No SQL execution authorized.
CREATE SCHEMA meri_intents;
CREATE TABLE meri_intents.preparations (
 tenant_id text NOT NULL CHECK (length(tenant_id) BETWEEN 1 AND 128),
 actor_id text NOT NULL CHECK (length(actor_id) BETWEEN 1 AND 128),
 conversation_id uuid NOT NULL,
 delivery_id text NOT NULL CHECK (delivery_id ~ '^sdk:[a-f0-9]{64}$'),
 record jsonb NOT NULL CHECK (jsonb_typeof(record) = 'object'),
 record_sha256 text NOT NULL CHECK (record_sha256 ~ '^[a-f0-9]{64}$'),
 state text NOT NULL CHECK (state IN ('PENDING','PREPARED','FAILED','UNKNOWN')),
 outcome jsonb,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 settled_at timestamptz,
 PRIMARY KEY (tenant_id,actor_id,conversation_id,delivery_id),
 CHECK ((state = 'PENDING') = (settled_at IS NULL)),
 CHECK (record ?& ARRAY['operation','argumentsSha256'] AND record - ARRAY['operation','argumentsSha256'] = '{}'::jsonb),
 CHECK (jsonb_typeof(record->'operation') = 'object' AND jsonb_typeof(record->'argumentsSha256') = 'string'),
 CHECK ((record->>'argumentsSha256') ~ '^[a-f0-9]{64}$'),
 CHECK ((record->'operation') ?& ARRAY['id','version'] AND (record->'operation') - ARRAY['id','version'] = '{}'::jsonb),
 CHECK (jsonb_typeof(record->'operation'->'id') = 'string' AND jsonb_typeof(record->'operation'->'version') = 'string' AND
        record->'operation'->>'id' ~ '^[a-z][a-z_]{0,62}$' AND record->'operation'->>'version' = '0.2.0'),
 CHECK ((state IN ('PENDING','UNKNOWN') AND outcome IS NULL) OR
        (state = 'FAILED' AND outcome IS NOT NULL AND jsonb_typeof(outcome) = 'object' AND outcome ? 'code' AND outcome - 'code' = '{}'::jsonb AND
         jsonb_typeof(outcome->'code') = 'string' AND outcome->>'code' IN ('UNAVAILABLE','ACCESS_DENIED','REFUSED','INVALID_ARGUMENTS','DEADLINE','CANCELLED','CONFLICT','UNKNOWN')) OR
        (state = 'PREPARED' AND outcome IS NOT NULL AND jsonb_typeof(outcome) = 'object' AND outcome ?& ARRAY['result','release'] AND outcome - ARRAY['result','release'] = '{}'::jsonb AND
         jsonb_typeof(outcome->'result') = 'object' AND jsonb_typeof(outcome->'release') = 'object' AND
         (outcome->'release') ?& ARRAY['binding','scopes','expiresAtMs'] AND (outcome->'release') - ARRAY['binding','scopes','expiresAtMs'] = '{}'::jsonb AND
         jsonb_typeof(outcome->'release'->'binding') = 'object' AND jsonb_typeof(outcome->'release'->'scopes') = 'array' AND jsonb_array_length(outcome->'release'->'scopes') BETWEEN 1 AND 100 AND
         jsonb_typeof(outcome->'release'->'expiresAtMs') = 'number')),
 -- New writes always retain the complete release envelope. Current authorization is still required on every release by the mount.
 CHECK (state <> 'PREPARED' OR ((outcome->'release'->'binding') ?& ARRAY['tenantId','actorId','conversationId'] AND
        jsonb_typeof(outcome->'release'->'binding'->'tenantId') = 'string' AND jsonb_typeof(outcome->'release'->'binding'->'actorId') = 'string' AND
        jsonb_typeof(outcome->'release'->'binding'->'conversationId') = 'string' AND
        outcome->'release'->'binding'->>'tenantId' = tenant_id AND outcome->'release'->'binding'->>'actorId' = actor_id AND
        outcome->'release'->'binding'->>'conversationId' = conversation_id::text AND
        (outcome->'release'->>'expiresAtMs')::numeric BETWEEN 1 AND 9007199254740991 AND
        (outcome->'release'->>'expiresAtMs')::numeric = trunc((outcome->'release'->>'expiresAtMs')::numeric)))
);
CREATE FUNCTION meri_intents.guard_preparation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 -- Deletion could make an already-used delivery dispatchable again. Any future retention design must retain its claim fence.
 IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'INTENT_PREPARATION_FENCE_REQUIRED'; END IF;
 IF (NEW.tenant_id,NEW.actor_id,NEW.conversation_id,NEW.delivery_id,NEW.record,NEW.record_sha256,NEW.created_at)
    IS DISTINCT FROM (OLD.tenant_id,OLD.actor_id,OLD.conversation_id,OLD.delivery_id,OLD.record,OLD.record_sha256,OLD.created_at)
 THEN RAISE EXCEPTION 'INTENT_PREPARATION_IMMUTABLE'; END IF;
 IF OLD.state <> 'PENDING' OR NEW.state = 'PENDING' THEN RAISE EXCEPTION 'INTENT_PREPARATION_TERMINAL'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER immutable_preparation BEFORE UPDATE OR DELETE ON meri_intents.preparations
 FOR EACH ROW EXECUTE FUNCTION meri_intents.guard_preparation();
