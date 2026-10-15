-- Next-turn reservations: one immutable mapping from a completed, captured, retired source run to its reserved target run,
-- plus the conversation-wide sequence base of every run. Additive; migration ID allocation to be confirmed by the central owner.
BEGIN;
-- Volatile trigger queries refresh their snapshots at READ COMMITTED. Stronger
-- isolation can retain a pre-lock event snapshot even when the parent did not
-- change, so those isolation levels are explicitly unsupported and fail closed.
DO $$ BEGIN
 IF current_setting('transaction_isolation')<>'read committed' THEN RAISE EXCEPTION 'sequence ranges require READ COMMITTED'; END IF;
END $$;
-- Drain both parent writers and pre-trigger event statements before auditing the
-- retained history. Locks stay held through validation, backfill and trigger DDL.
LOCK TABLE meri_conversations.runs,meri_conversations.events IN ACCESS EXCLUSIVE MODE;
ALTER TABLE meri_conversations.runs ADD COLUMN sequence_base bigint NOT NULL DEFAULT 0 CHECK (sequence_base >= 0);
ALTER TABLE meri_conversations.runs ADD COLUMN sequence_end bigint CHECK (sequence_end >= sequence_base);
-- Existing rows must be reconstructible, rather than repaired by renumbering or
-- rounding. An empty draft is legitimate only when last_sequence=0 and no event
-- is retained. All arithmetic stays exact and representable by JavaScript owners.
ALTER TABLE meri_conversations.runs ADD CONSTRAINT valid_run_writer_fence CHECK ((
 jsonb_typeof(projection#>'{binding,writerFence}')='number'
 AND (projection#>>'{binding,writerFence}')::numeric BETWEEN 1 AND 9007199254740991
 AND trunc((projection#>>'{binding,writerFence}')::numeric)=(projection#>>'{binding,writerFence}')::numeric
) IS TRUE);
ALTER TABLE meri_conversations.runs ADD CONSTRAINT safe_run_sequence_range CHECK (
 last_sequence BETWEEN 0 AND 9007199254740991
 AND sequence_base BETWEEN 0 AND 9007199254740991
 AND sequence_base::numeric+last_sequence::numeric<=9007199254740991
 AND (sequence_end IS NULL OR (sequence_end BETWEEN 0 AND 9007199254740991
  AND sequence_end::numeric=sequence_base::numeric+last_sequence::numeric))
);
CREATE UNIQUE INDEX conversation_writer_fence ON meri_conversations.runs(tenant_id,conversation_id,((projection#>>'{binding,writerFence}')::numeric));
CREATE FUNCTION meri_conversations.validate_retained_run_events(p_tenant text,p_conversation uuid,p_run uuid,p_last bigint,p_projection jsonb) RETURNS void LANGUAGE plpgsql AS $$
DECLARE retained bigint; first_sequence bigint; final_sequence bigint; invalid_payload boolean;
BEGIN
 SELECT count(*),min(e.sequence),max(e.sequence),bool_or(
  e.event->'sequence' IS DISTINCT FROM to_jsonb(e.sequence)
  OR e.event->>'eventId' IS DISTINCT FROM e.event_id::text
  OR e.event->'binding' IS DISTINCT FROM p_projection->'binding'
  OR e.event->'scopes' IS DISTINCT FROM p_projection->'scopes'
 ) INTO retained,first_sequence,final_sequence,invalid_payload
 FROM meri_conversations.events e WHERE e.tenant_id=p_tenant AND e.conversation_id=p_conversation AND e.run_id=p_run;
 IF (p_last=0 AND retained<>0) OR (p_last>0 AND (retained<>p_last OR first_sequence IS DISTINCT FROM 1::bigint OR final_sequence IS DISTINCT FROM p_last)) OR coalesce(invalid_payload,false) THEN
  RAISE EXCEPTION 'retained run events do not match declared sequence range';
 END IF;
END $$;
DO $$ BEGIN
 PERFORM meri_conversations.validate_retained_run_events(tenant_id,conversation_id,run_id,last_sequence,projection) FROM meri_conversations.runs;
END $$;
WITH ranges AS (
 SELECT tenant_id,conversation_id,run_id,
 COALESCE(sum(last_sequence::numeric) OVER (PARTITION BY tenant_id,conversation_id ORDER BY (projection#>>'{binding,writerFence}')::numeric ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING),0) AS base,
 lead(run_id) OVER (PARTITION BY tenant_id,conversation_id ORDER BY (projection#>>'{binding,writerFence}')::numeric) AS successor
 FROM meri_conversations.runs
) UPDATE meri_conversations.runs r SET sequence_base=ranges.base,
 sequence_end=CASE WHEN successor IS NULL THEN NULL ELSE ranges.base+r.last_sequence::numeric END
 FROM ranges WHERE r.tenant_id=ranges.tenant_id AND r.conversation_id=ranges.conversation_id AND r.run_id=ranges.run_id;
CREATE FUNCTION meri_conversations.preserve_run_range() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD.sequence_end IS NULL AND NEW.sequence_end IS NOT NULL AND current_setting('transaction_isolation')<>'read committed' THEN RAISE EXCEPTION 'sequence ranges require READ COMMITTED'; END IF;
 IF NEW.sequence_base <> OLD.sequence_base THEN RAISE EXCEPTION 'run sequence base is immutable'; END IF;
 IF OLD.sequence_end IS NOT NULL AND (NEW.sequence_end IS DISTINCT FROM OLD.sequence_end OR NEW.last_sequence <> OLD.last_sequence OR NEW.projection <> OLD.projection OR NEW.projection_sha256 <> OLD.projection_sha256) THEN RAISE EXCEPTION 'run sequence range is closed'; END IF;
 IF OLD.sequence_end IS NULL AND NEW.sequence_end IS NOT NULL THEN
  IF NEW.sequence_end::numeric<>NEW.sequence_base::numeric+NEW.last_sequence::numeric THEN RAISE EXCEPTION 'invalid run sequence end'; END IF;
  -- UPDATE already holds the run row lock also acquired by every event mutation.
  PERFORM meri_conversations.validate_retained_run_events(NEW.tenant_id,NEW.conversation_id,NEW.run_id,NEW.last_sequence,NEW.projection);
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER preserve_run_range BEFORE UPDATE ON meri_conversations.runs FOR EACH ROW EXECUTE FUNCTION meri_conversations.preserve_run_range();
ALTER TABLE meri_conversations.runs ADD COLUMN hold_completion_id uuid;
CREATE TABLE meri_conversations.completion_checkpoints (
 tenant_id text NOT NULL, conversation_id uuid NOT NULL, run_id uuid NOT NULL,
 completion_id uuid NOT NULL, checkpoint_id uuid NOT NULL,
 identity jsonb NOT NULL, identity_sha256 text NOT NULL CHECK (identity_sha256 ~ '^[a-f0-9]{64}$'),
 state text NOT NULL CHECK (state IN ('CAPTURING','UNKNOWN','PUBLISHED')),
 proof jsonb, proof_sha256 text CHECK (proof_sha256 ~ '^[a-f0-9]{64}$'),
 PRIMARY KEY (tenant_id,conversation_id,run_id), UNIQUE (tenant_id,completion_id), UNIQUE (tenant_id,checkpoint_id),
 CHECK ((state='PUBLISHED') = (proof IS NOT NULL AND proof_sha256 IS NOT NULL)),
 CHECK ((proof IS NULL) = (proof_sha256 IS NULL)),
 FOREIGN KEY (tenant_id,conversation_id,run_id) REFERENCES meri_conversations.runs
);
CREATE FUNCTION meri_conversations.preserve_completion_identity() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'completion checkpoints are immutable'; END IF;
 IF NEW.tenant_id<>OLD.tenant_id OR NEW.conversation_id<>OLD.conversation_id OR NEW.run_id<>OLD.run_id OR NEW.completion_id<>OLD.completion_id OR NEW.checkpoint_id<>OLD.checkpoint_id OR NEW.identity<>OLD.identity OR NEW.identity_sha256<>OLD.identity_sha256 THEN RAISE EXCEPTION 'completion identity is immutable'; END IF;
 IF OLD.state='PUBLISHED' AND (NEW.state<>OLD.state OR NEW.proof IS DISTINCT FROM OLD.proof OR NEW.proof_sha256 IS DISTINCT FROM OLD.proof_sha256) THEN RAISE EXCEPTION 'completion proof is immutable'; END IF;
 IF OLD.state='UNKNOWN' AND NEW.state='CAPTURING' THEN RAISE EXCEPTION 'completion capture cannot restart'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER preserve_completion_identity BEFORE UPDATE OR DELETE ON meri_conversations.completion_checkpoints FOR EACH ROW EXECUTE FUNCTION meri_conversations.preserve_completion_identity();
CREATE FUNCTION meri_conversations.reject_closed_range_event() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE parent meri_conversations.runs%ROWTYPE;
BEGIN
 IF current_setting('transaction_isolation')<>'read committed' THEN RAISE EXCEPTION 'sequence ranges require READ COMMITTED'; END IF;
 -- FOR KEY SHARE is insufficient: it is compatible with the closer's non-key
 -- UPDATE. FOR UPDATE serializes insertion/commit with sealing the same parent.
 IF TG_OP IN ('UPDATE','DELETE') THEN
  SELECT * INTO parent FROM meri_conversations.runs WHERE tenant_id=OLD.tenant_id AND conversation_id=OLD.conversation_id AND run_id=OLD.run_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'event parent is missing'; END IF;
  IF parent.sequence_end IS NOT NULL THEN RAISE EXCEPTION 'run sequence range is closed'; END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 END IF;
 SELECT * INTO parent FROM meri_conversations.runs WHERE tenant_id=NEW.tenant_id AND conversation_id=NEW.conversation_id AND run_id=NEW.run_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'event parent is missing'; END IF;
 IF parent.sequence_end IS NOT NULL THEN RAISE EXCEPTION 'run sequence range is closed'; END IF;
 IF NEW.sequence NOT BETWEEN 1 AND 9007199254740991
  OR NEW.event->'sequence' IS DISTINCT FROM to_jsonb(NEW.sequence)
  OR NEW.event->>'eventId' IS DISTINCT FROM NEW.event_id::text
  OR NEW.event->'binding' IS DISTINCT FROM parent.projection->'binding'
  OR NEW.event->'scopes' IS DISTINCT FROM parent.projection->'scopes' THEN RAISE EXCEPTION 'event does not match parent sequence range'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER reject_closed_range_event BEFORE INSERT OR UPDATE OR DELETE ON meri_conversations.events FOR EACH ROW EXECUTE FUNCTION meri_conversations.reject_closed_range_event();
CREATE TABLE meri_conversations.next_runs (
 tenant_id text NOT NULL, conversation_id uuid NOT NULL, source_run_id uuid NOT NULL, target_run_id uuid NOT NULL,
 reservation jsonb NOT NULL, reservation_sha256 text NOT NULL CHECK (reservation_sha256 ~ '^[a-f0-9]{64}$'),
 state text NOT NULL CHECK (state IN ('RESERVED','ACCEPTED')),
 PRIMARY KEY (tenant_id, conversation_id, source_run_id),
 UNIQUE (tenant_id, conversation_id, target_run_id),
 FOREIGN KEY (tenant_id, conversation_id, source_run_id) REFERENCES meri_conversations.runs
);
CREATE FUNCTION meri_conversations.preserve_next_run_identity() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'next_runs rows are immutable'; END IF;
 IF NEW.tenant_id <> OLD.tenant_id OR NEW.conversation_id <> OLD.conversation_id OR NEW.target_run_id <> OLD.target_run_id OR NEW.source_run_id <> OLD.source_run_id OR NEW.reservation <> OLD.reservation OR NEW.reservation_sha256 <> OLD.reservation_sha256 THEN RAISE EXCEPTION 'next_runs identity is immutable'; END IF;
 IF NEW.state='ACCEPTED' AND NOT EXISTS (SELECT 1 FROM meri_conversations.runs WHERE tenant_id=NEW.tenant_id AND conversation_id=NEW.conversation_id AND run_id=NEW.target_run_id AND projection->'binding'=NEW.reservation->'target') THEN RAISE EXCEPTION 'accepted next run target is missing'; END IF;
 IF NOT (NEW.state = OLD.state OR (OLD.state = 'RESERVED' AND NEW.state = 'ACCEPTED')) THEN RAISE EXCEPTION 'next_runs state cannot regress'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER preserve_next_run_identity BEFORE UPDATE OR DELETE ON meri_conversations.next_runs FOR EACH ROW EXECUTE FUNCTION meri_conversations.preserve_next_run_identity();
COMMIT;
