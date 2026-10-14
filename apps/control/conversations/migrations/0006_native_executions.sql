-- Allocated centrally by Codex for native broker intent; apply only to task-owned local DB here.
BEGIN;
CREATE TABLE meri_conversations.native_executions (
 tenant_id text NOT NULL, conversation_id uuid NOT NULL, run_id uuid NOT NULL,
 execution_key text NOT NULL CHECK(execution_key ~ '^[a-f0-9]{64}$'),
 execution_id text NOT NULL CHECK(execution_id ~ '^[a-f0-9]{64}$'),
 record jsonb NOT NULL, record_sha256 text NOT NULL CHECK(record_sha256 ~ '^[a-f0-9]{64}$'),
 PRIMARY KEY(tenant_id,conversation_id,run_id), UNIQUE(execution_id),
 FOREIGN KEY(tenant_id,conversation_id,run_id) REFERENCES meri_conversations.runs
);
CREATE FUNCTION meri_conversations.preserve_native_execution_identity() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF ROW(NEW.tenant_id,NEW.conversation_id,NEW.run_id,NEW.execution_key,NEW.execution_id) IS DISTINCT FROM ROW(OLD.tenant_id,OLD.conversation_id,OLD.run_id,OLD.execution_key,OLD.execution_id)
 OR (NEW.record - 'phase' - 'native') IS DISTINCT FROM (OLD.record - 'phase' - 'native') THEN
  RAISE EXCEPTION 'native execution identity is immutable';
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER preserve_native_execution_identity BEFORE UPDATE ON meri_conversations.native_executions
 FOR EACH ROW EXECUTE FUNCTION meri_conversations.preserve_native_execution_identity();
COMMIT;
