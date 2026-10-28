-- Actor/scope-owned proposal custody for management without a conversation.
-- This is not an effect journal or authority grant. The existing schedule intent
-- owner remains the sole generation/dispatch/ACK/UNKNOWN authority.
CREATE TABLE meri_schedules.management_preparations (
 tenant_id text NOT NULL CHECK (length(tenant_id) BETWEEN 1 AND 256),
 actor_id text NOT NULL CHECK (length(actor_id) BETWEEN 1 AND 256),
 scope_sha256 text NOT NULL CHECK (scope_sha256 ~ '^[a-f0-9]{64}$'),
 request_id text NOT NULL CHECK (request_id ~ '^[A-Za-z0-9._-]{1,128}$'),
 claim_id uuid NOT NULL,
 record jsonb NOT NULL CHECK (jsonb_typeof(record) = 'object'),
 record_sha256 text NOT NULL CHECK (record_sha256 ~ '^[a-f0-9]{64}$'),
 state text NOT NULL CHECK (state IN ('PENDING','PREPARED','FAILED')),
 proposal_id uuid UNIQUE, outcome jsonb,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(), settled_at timestamptz,
 PRIMARY KEY (tenant_id,actor_id,scope_sha256,request_id),
 CHECK (record ?& ARRAY['operation','request','requestSha256','selectedClientId','scopes','versions'] AND
        record - ARRAY['operation','request','requestSha256','selectedClientId','scopes','versions'] = '{}'::jsonb),
 CHECK ((record->>'operation' = 'cancel_scheduled_task' AND jsonb_typeof(record->'request') = 'object' AND
        record->'request'->>'mode' IN ('pause','delete') AND record->'request'->>'running' = 'leave' AND record->'request'->'runs' = '[]'::jsonb AND
        (record->>'requestSha256') ~ '^[a-f0-9]{64}$' AND jsonb_typeof(record->'scopes') = 'array' AND
        jsonb_array_length(record->'scopes') = 1 AND jsonb_typeof(record->'versions') = 'object') IS TRUE),
 CHECK ((state = 'PENDING' AND outcome IS NULL AND proposal_id IS NULL AND settled_at IS NULL) OR
        (state = 'FAILED' AND proposal_id IS NULL AND settled_at IS NOT NULL AND
         (jsonb_typeof(outcome) = 'object' AND outcome ? 'code' AND outcome - 'code' = '{}'::jsonb AND
          outcome->>'code' IN ('REFUSED','UNAVAILABLE','INVALID_REQUEST','STALE')) IS TRUE) OR
        (state = 'PREPARED' AND proposal_id IS NOT NULL AND settled_at IS NOT NULL AND
         (jsonb_typeof(outcome) = 'object' AND outcome ?& ARRAY['status','proposal'] AND outcome - ARRAY['status','proposal'] = '{}'::jsonb AND
          outcome->>'status' = 'approval_required' AND outcome->'proposal'->>'operation' = 'cancel_scheduled_task' AND
          outcome->'proposal'->>'proposalId' = proposal_id::text AND
          outcome->'proposal'->'projection'->'owner'->>'tenantId' = tenant_id AND
          outcome->'proposal'->'projection'->'owner'->>'actorId' = actor_id AND
          (CASE WHEN record->'selectedClientId' = 'null'::jsonb THEN (outcome->'proposal'->'projection'->'scopes') = (record->'scopes')
                ELSE (outcome->'proposal'->'projection'->'scopes') @> (record->'scopes') END)) IS TRUE))
);
CREATE FUNCTION meri_schedules.guard_management_preparation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'ROUTINE_MANAGEMENT_FENCE_REQUIRED'; END IF;
 IF (NEW.tenant_id,NEW.actor_id,NEW.scope_sha256,NEW.request_id,NEW.claim_id,NEW.record,NEW.record_sha256,NEW.created_at)
    IS DISTINCT FROM (OLD.tenant_id,OLD.actor_id,OLD.scope_sha256,OLD.request_id,OLD.claim_id,OLD.record,OLD.record_sha256,OLD.created_at)
 THEN RAISE EXCEPTION 'ROUTINE_MANAGEMENT_IMMUTABLE'; END IF;
 IF OLD.state <> 'PENDING' OR NEW.state = 'PENDING' THEN RAISE EXCEPTION 'ROUTINE_MANAGEMENT_TERMINAL'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER immutable_management_preparation BEFORE UPDATE OR DELETE ON meri_schedules.management_preparations
 FOR EACH ROW EXECUTE FUNCTION meri_schedules.guard_management_preparation();
