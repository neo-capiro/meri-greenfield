-- Next-turn reservations: one immutable mapping from a completed, captured, retired source run to its reserved target run,
-- plus the conversation-wide sequence base of every run. Additive; migration ID allocation to be confirmed by the central owner.
BEGIN;
ALTER TABLE meri_conversations.runs ADD COLUMN sequence_base bigint NOT NULL DEFAULT 0 CHECK (sequence_base >= 0);
ALTER TABLE meri_conversations.runs ADD COLUMN sequence_end bigint CHECK (sequence_end >= sequence_base);
-- Existing-row policy: this unallocated source migration runs with an exclusive lock.
-- Reconstruct ordered, retained history only; no events are renumbered. Duplicate
-- fences abort the migration for explicit operator repair, never silent guessing.
LOCK TABLE meri_conversations.runs IN ACCESS EXCLUSIVE MODE;
CREATE UNIQUE INDEX conversation_writer_fence ON meri_conversations.runs(tenant_id,conversation_id,((projection->'binding'->>'writerFence')::bigint));
WITH ranges AS (
 SELECT tenant_id,conversation_id,run_id,
 COALESCE(sum(last_sequence) OVER (PARTITION BY tenant_id,conversation_id ORDER BY (projection->'binding'->>'writerFence')::bigint ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING),0) AS base,
 lead(run_id) OVER (PARTITION BY tenant_id,conversation_id ORDER BY (projection->'binding'->>'writerFence')::bigint) AS successor
 FROM meri_conversations.runs
) UPDATE meri_conversations.runs r SET sequence_base=ranges.base,
 sequence_end=CASE WHEN successor IS NULL THEN NULL ELSE ranges.base+r.last_sequence END
 FROM ranges WHERE r.tenant_id=ranges.tenant_id AND r.conversation_id=ranges.conversation_id AND r.run_id=ranges.run_id;
CREATE FUNCTION meri_conversations.preserve_run_range() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.sequence_base <> OLD.sequence_base THEN RAISE EXCEPTION 'run sequence base is immutable'; END IF;
 IF OLD.sequence_end IS NOT NULL AND (NEW.sequence_end IS DISTINCT FROM OLD.sequence_end OR NEW.last_sequence <> OLD.last_sequence OR NEW.projection <> OLD.projection OR NEW.projection_sha256 <> OLD.projection_sha256) THEN RAISE EXCEPTION 'run sequence range is closed'; END IF;
 IF OLD.sequence_end IS NULL AND NEW.sequence_end IS NOT NULL AND NEW.sequence_end <> NEW.sequence_base+NEW.last_sequence THEN RAISE EXCEPTION 'invalid run sequence end'; END IF;
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
BEGIN
 IF EXISTS (SELECT 1 FROM meri_conversations.runs WHERE tenant_id=NEW.tenant_id AND conversation_id=NEW.conversation_id AND run_id=NEW.run_id AND sequence_end IS NOT NULL) THEN RAISE EXCEPTION 'run sequence range is closed'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER reject_closed_range_event BEFORE INSERT ON meri_conversations.events FOR EACH ROW EXECUTE FUNCTION meri_conversations.reject_closed_range_event();
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
