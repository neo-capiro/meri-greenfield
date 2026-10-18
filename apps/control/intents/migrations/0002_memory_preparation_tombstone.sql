-- Assigned intents/0002 forward source only. Preserve 0001 and its non-reusable delivery fence. The runner
-- owns the transaction. This amendment requires conversation retention targets/0018 before any redaction,
-- plus a separately reviewed row owner, policy, recovery and narrow grants. It performs no data redaction.

-- The 0001 table has an unnamed table-level outcome CHECK (the seventh such CHECK, generated as
-- preparations_check6) and a column-level preparations_state_check. Refuse a different deployed shape
-- before replacing either; actual migration-ledger checksum and schema still require operator review.
DO $$
BEGIN
 IF NOT EXISTS (
  SELECT 1 FROM pg_constraint c
  WHERE c.conrelid='meri_intents.preparations'::regclass AND c.contype='c'
   AND c.conname='preparations_state_check'
   AND pg_get_constraintdef(c.oid) LIKE '%PREPARED%'
   AND pg_get_constraintdef(c.oid) LIKE '%UNKNOWN%'
 ) OR NOT EXISTS (
  SELECT 1 FROM pg_constraint c
  WHERE c.conrelid='meri_intents.preparations'::regclass AND c.contype='c'
   AND c.conname='preparations_check6'
   AND pg_get_constraintdef(c.oid) LIKE '%outcome%'
   AND pg_get_constraintdef(c.oid) LIKE '%PREPARED%'
   AND pg_get_constraintdef(c.oid) LIKE '%FAILED%'
 ) THEN RAISE EXCEPTION 'INTENT_PREPARATION_BASE_SCHEMA_UNVERIFIED'; END IF;
END $$;

ALTER TABLE meri_intents.preparations
 ADD COLUMN outcome_purged_at timestamptz,
 DROP CONSTRAINT preparations_state_check,
 DROP CONSTRAINT preparations_check6,
 ADD CONSTRAINT preparations_memory_state_check CHECK (state IN ('PENDING','PREPARED','FAILED','UNKNOWN','REDACTED')),
 ADD CONSTRAINT preparations_memory_outcome_check CHECK (
  (state IN ('PENDING','UNKNOWN') AND outcome IS NULL AND outcome_purged_at IS NULL) OR
  (state = 'FAILED' AND outcome_purged_at IS NULL AND outcome IS NOT NULL AND jsonb_typeof(outcome) = 'object'
   AND outcome ? 'code' AND outcome - 'code' = '{}'::jsonb AND jsonb_typeof(outcome->'code') = 'string'
   AND outcome->>'code' IN ('UNAVAILABLE','ACCESS_DENIED','REFUSED','INVALID_ARGUMENTS','DEADLINE','CANCELLED','CONFLICT','UNKNOWN')) OR
  (state = 'PREPARED' AND outcome_purged_at IS NULL AND outcome IS NOT NULL AND jsonb_typeof(outcome) = 'object'
   AND outcome ?& ARRAY['result','release'] AND outcome - ARRAY['result','release'] = '{}'::jsonb
   AND jsonb_typeof(outcome->'result') = 'object' AND jsonb_typeof(outcome->'release') = 'object'
   AND (outcome->'release') ?& ARRAY['binding','scopes','expiresAtMs']
   AND (outcome->'release') - ARRAY['binding','scopes','expiresAtMs'] = '{}'::jsonb
   AND jsonb_typeof(outcome->'release'->'binding') = 'object'
   AND jsonb_typeof(outcome->'release'->'scopes') = 'array'
   AND jsonb_array_length(outcome->'release'->'scopes') BETWEEN 1 AND 100
   AND jsonb_typeof(outcome->'release'->'expiresAtMs') = 'number') OR
  (state = 'REDACTED' AND outcome IS NULL AND outcome_purged_at IS NOT NULL)
 );

CREATE INDEX preparations_memory_live ON meri_intents.preparations
 (tenant_id,conversation_id,actor_id,delivery_id)
 WHERE state='PREPARED' AND outcome IS NOT NULL AND record->'operation'->>'id'='save_memory';

CREATE OR REPLACE FUNCTION meri_intents.guard_preparation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP = 'TRUNCATE' OR TG_OP = 'DELETE' THEN
  RAISE EXCEPTION 'INTENT_PREPARATION_FENCE_REQUIRED';
 END IF;
 IF TG_OP = 'INSERT' THEN
  IF NEW.state <> 'PENDING' OR NEW.outcome IS NOT NULL OR NEW.outcome_purged_at IS NOT NULL
  THEN RAISE EXCEPTION 'INTENT_PREPARATION_CLAIM_REQUIRED'; END IF;
  RETURN NEW;
 END IF;
 IF (NEW.tenant_id,NEW.actor_id,NEW.conversation_id,NEW.delivery_id,NEW.record,NEW.record_sha256,
     NEW.created_at,NEW.settled_at)
    IS DISTINCT FROM
    (OLD.tenant_id,OLD.actor_id,OLD.conversation_id,OLD.delivery_id,OLD.record,OLD.record_sha256,
     OLD.created_at,OLD.settled_at) THEN
  -- PENDING settlement is the sole exception to settled_at immutability.
  IF OLD.state <> 'PENDING' OR NEW.settled_at IS NULL OR
     (NEW.tenant_id,NEW.actor_id,NEW.conversation_id,NEW.delivery_id,NEW.record,NEW.record_sha256,NEW.created_at)
       IS DISTINCT FROM
     (OLD.tenant_id,OLD.actor_id,OLD.conversation_id,OLD.delivery_id,OLD.record,OLD.record_sha256,OLD.created_at)
  THEN RAISE EXCEPTION 'INTENT_PREPARATION_IMMUTABLE'; END IF;
 END IF;
 IF OLD.state = 'PENDING' AND NEW.state IN ('PREPARED','FAILED','UNKNOWN') AND
    NEW.outcome_purged_at IS NULL AND NEW.settled_at IS NOT NULL THEN RETURN NEW; END IF;
 IF OLD.state = 'PREPARED' AND NEW.state = 'REDACTED' AND
    OLD.outcome IS NOT NULL AND OLD.outcome_purged_at IS NULL AND
    NEW.outcome IS NULL AND NEW.outcome_purged_at IS NOT NULL AND
    NEW.settled_at IS NOT DISTINCT FROM OLD.settled_at AND
    OLD.record->'operation'->>'id' = 'save_memory' AND
    OLD.outcome->'result'->>'status' = 'approval_required' AND
    OLD.outcome->'result'->'proposal'->'command'->>'action' = 'memory.propose' AND EXISTS (
     SELECT 1 FROM meri_conversations.retention_purge_targets t
     JOIN meri_conversations.retention_subjects s
       ON s.tenant_id=t.tenant_id AND s.conversation_id=t.conversation_id
     WHERE t.tenant_id=OLD.tenant_id AND t.conversation_id=OLD.conversation_id
       AND t.actor_id=OLD.actor_id AND t.class='meriMemoryIntentPreparations'
       AND t.delivery_id=OLD.delivery_id AND t.state='PLANNED'
       AND t.xmin=pg_current_xact_id()::xid
       AND s.state='SUPPRESSED' AND s.owner_actor_id=OLD.actor_id
       AND s.projection->>'state'=s.state
       AND s.projection->>'ownerActorId'=s.owner_actor_id
       AND (s.projection->>'ledgerSequence')::bigint=s.ledger_sequence
       AND s.projection->>'entrySha256'=s.entry_sha256
       AND t.plan_sha256=s.projection->'purge'->>'planSha256'
       AND t.ledger_sequence=(s.projection->'purge'->>'ledgerSequence')::bigint
       AND s.projection->'purge'->>'state' IN ('PLANNED','UNKNOWN')
     FOR UPDATE OF t,s
    ) THEN
   NEW.outcome_purged_at := clock_timestamp();
   RETURN NEW;
  END IF;
 RAISE EXCEPTION 'INTENT_PREPARATION_TERMINAL';
END $$;

DROP TRIGGER immutable_preparation ON meri_intents.preparations;
CREATE TRIGGER immutable_preparation BEFORE INSERT OR UPDATE OR DELETE ON meri_intents.preparations
 FOR EACH ROW EXECUTE FUNCTION meri_intents.guard_preparation();
CREATE TRIGGER preparations_no_truncate BEFORE TRUNCATE ON meri_intents.preparations
 FOR EACH STATEMENT EXECUTE FUNCTION meri_intents.guard_preparation();
