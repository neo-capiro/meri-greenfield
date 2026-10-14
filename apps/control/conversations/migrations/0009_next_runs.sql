-- Next-turn reservations: one immutable mapping from a completed, captured, retired source run to its reserved target run,
-- plus the conversation-wide sequence base of every run. Additive; migration ID allocation to be confirmed by the central owner.
BEGIN;
ALTER TABLE meri_conversations.runs ADD COLUMN sequence_base bigint NOT NULL DEFAULT 0 CHECK (sequence_base >= 0);
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
 IF NEW.target_run_id <> OLD.target_run_id OR NEW.source_run_id <> OLD.source_run_id OR NEW.reservation <> OLD.reservation OR NEW.reservation_sha256 <> OLD.reservation_sha256 THEN RAISE EXCEPTION 'next_runs identity is immutable'; END IF;
 IF NOT (NEW.state = OLD.state OR (OLD.state = 'RESERVED' AND NEW.state = 'ACCEPTED')) THEN RAISE EXCEPTION 'next_runs state cannot regress'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER preserve_next_run_identity BEFORE UPDATE OR DELETE ON meri_conversations.next_runs FOR EACH ROW EXECUTE FUNCTION meri_conversations.preserve_next_run_identity();
COMMIT;
