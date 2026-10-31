-- Ordinal 79 (SCRUM-221, correction 01): durable per-original-run browser-download capacity on the EXISTING
-- intent journal. This file starts from the ACTUAL latest guard (0002_memory_preparation_tombstone, ordinal 77)
-- and adds ONLY: nullable run_id metadata, an INSERT-time run requirement for the private browser_download
-- operation, run_id immutability in the UPDATE branch, and a scoped reservation index. Every INSERT/DELETE/
-- TRUNCATE fence, settled_at exception, PENDING terminal rule and the constrained save_memory -> REDACTED
-- transition are preserved. No CHECK across historical rows, no new state, no PREPARED reopen: pre-79
-- browser_download rows with NULL run_id remain valid and are handled fail-closed by the reader.
ALTER TABLE meri_intents.preparations ADD COLUMN run_id uuid;

CREATE OR REPLACE FUNCTION meri_intents.guard_preparation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP = 'TRUNCATE' OR TG_OP = 'DELETE' THEN
  RAISE EXCEPTION 'INTENT_PREPARATION_FENCE_REQUIRED';
 END IF;
 IF TG_OP = 'INSERT' THEN
  IF NEW.state <> 'PENDING' OR NEW.outcome IS NOT NULL OR NEW.outcome_purged_at IS NOT NULL
  THEN RAISE EXCEPTION 'INTENT_PREPARATION_CLAIM_REQUIRED'; END IF;
  -- Only the private browser_download execution family binds an original run; legacy SDK/action rows stay NULL.
  IF NEW.record->'operation'->>'id' = 'browser_download' AND NEW.run_id IS NULL
  THEN RAISE EXCEPTION 'INTENT_PREPARATION_RUN_REQUIRED'; END IF;
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
 -- The claimed run is fixed for the life of the row and can never be rewritten, including before settlement.
 IF NEW.run_id IS DISTINCT FROM OLD.run_id THEN RAISE EXCEPTION 'INTENT_PREPARATION_RUN_IMMUTABLE'; END IF;
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

-- The count path is exactly the reservation scope: one actor's browser_download rows of this conversation/run,
-- excluding only proven refusals. The index keeps that lookup bounded without scanning unrelated deliveries.
CREATE INDEX preparations_browser_download_reservations ON meri_intents.preparations
 (tenant_id, conversation_id, run_id)
 WHERE (record->'operation'->>'id') = 'browser_download' AND state <> 'FAILED';
