-- ASSIGNED memory/0002, source only. The historical allocation name says "delete"; this deletes candidate CONTENT by a
-- one-way tombstone and preserves the candidate and idempotency replay fences. Never apply without the centrally assigned
-- conversations/0018 target amendment and its policy, grants, recovery and purge row owner. The migration runner owns the tx.
ALTER TABLE meri_memory.candidates
 ADD COLUMN origin_kind text,
 ADD COLUMN origin_conversation_id uuid,
 ADD COLUMN candidate_purged_at timestamptz;

-- Backfill immutable locators before allowing a candidate to become NULL. Fail the migration if old content is malformed.
UPDATE meri_memory.candidates SET
 origin_kind = candidate->'origin'->>'kind',
 origin_conversation_id = CASE WHEN candidate->'origin'->>'kind'='conversation'
  THEN (candidate->'origin'->>'conversationId')::uuid ELSE NULL END;
ALTER TABLE meri_memory.candidates
 ALTER COLUMN origin_kind SET NOT NULL,
 ALTER COLUMN candidate DROP NOT NULL,
 ADD CONSTRAINT candidates_origin_kind CHECK (origin_kind IN ('conversation','surface')),
 ADD CONSTRAINT candidates_origin_conversation CHECK ((origin_kind='conversation')=(origin_conversation_id IS NOT NULL)),
 ADD CONSTRAINT candidates_content_tombstone CHECK ((candidate IS NULL)=(candidate_purged_at IS NOT NULL)),
 ADD CONSTRAINT candidates_live_origin CHECK (candidate IS NULL OR
  (candidate->'origin'->>'kind'=origin_kind AND
   (origin_kind='surface' OR candidate->'origin'->>'conversationId'=origin_conversation_id::text)));
CREATE INDEX candidates_conversation_live ON meri_memory.candidates(tenant_id,origin_conversation_id,candidate_id)
 WHERE candidate IS NOT NULL AND candidate_purged_at IS NULL AND origin_kind='conversation';

CREATE OR REPLACE FUNCTION meri_memory.candidates_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF (NEW.tenant_id,NEW.candidate_id,NEW.proposer_actor_id,NEW.idempotency_key,NEW.request_sha256,
     NEW.candidate_sha256,NEW.scope,NEW.client_id,NEW.created_at,NEW.origin_kind,NEW.origin_conversation_id)
    IS DISTINCT FROM
    (OLD.tenant_id,OLD.candidate_id,OLD.proposer_actor_id,OLD.idempotency_key,OLD.request_sha256,
     OLD.candidate_sha256,OLD.scope,OLD.client_id,OLD.created_at,OLD.origin_kind,OLD.origin_conversation_id) THEN
  RAISE EXCEPTION 'memory candidate replay identity is immutable';
 END IF;
 IF NEW.candidate IS DISTINCT FROM OLD.candidate OR NEW.candidate_purged_at IS DISTINCT FROM OLD.candidate_purged_at THEN
  IF OLD.candidate IS NULL OR OLD.candidate_purged_at IS NOT NULL OR NEW.candidate IS NOT NULL OR
     NEW.candidate_purged_at IS NULL OR OLD.origin_kind<>'conversation' OR
     (NEW.submission_state,NEW.review_id,NEW.submitted_at) IS DISTINCT FROM
     (OLD.submission_state,OLD.review_id,OLD.submitted_at) OR NOT EXISTS (
   SELECT 1 FROM meri_conversations.retention_purge_targets t
   JOIN meri_conversations.retention_subjects s
     ON s.tenant_id=t.tenant_id AND s.conversation_id=t.conversation_id
   WHERE t.tenant_id=OLD.tenant_id AND t.conversation_id=OLD.origin_conversation_id
     AND t.actor_id=OLD.proposer_actor_id
     AND t.class='meriMemoryCandidates' AND t.candidate_id=OLD.candidate_id
     AND t.state='PLANNED' AND t.xmin=pg_current_xact_id()::xid
     AND s.state='SUPPRESSED' AND s.owner_actor_id=OLD.proposer_actor_id
     AND s.projection->>'state'=s.state
     AND s.projection->>'ownerActorId'=s.owner_actor_id
     AND (s.projection->>'ledgerSequence')::bigint=s.ledger_sequence
     AND s.projection->>'entrySha256'=s.entry_sha256
     AND t.plan_sha256=s.projection->'purge'->>'planSha256'
     AND t.ledger_sequence=(s.projection->'purge'->>'ledgerSequence')::bigint
     AND s.projection->'purge'->>'state' IN ('PLANNED','UNKNOWN')
   FOR UPDATE OF t,s
  ) THEN RAISE EXCEPTION 'memory candidate tombstone target unavailable'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE FUNCTION meri_memory.reject_candidate_delete() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'memory candidate replay identity cannot be deleted'; END $$;
CREATE TRIGGER candidates_no_delete BEFORE DELETE ON meri_memory.candidates
 FOR EACH ROW EXECUTE FUNCTION meri_memory.reject_candidate_delete();
