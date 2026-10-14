-- Centrally allocated canonical run metadata; no credentials, grant policies or runtime application.
BEGIN;
CREATE TABLE meri_conversations.native_allocations (
 tenant_id text NOT NULL, conversation_id uuid NOT NULL, run_id uuid NOT NULL,
 intent_key text NOT NULL CHECK(intent_key ~ '^[a-f0-9]{64}$'),
 record jsonb NOT NULL, record_sha256 text NOT NULL CHECK(record_sha256 ~ '^[a-f0-9]{64}$'),
 PRIMARY KEY(tenant_id,conversation_id,run_id), UNIQUE(intent_key),
 FOREIGN KEY(tenant_id,conversation_id,run_id) REFERENCES meri_conversations.runs
);
CREATE TABLE meri_conversations.native_restorations (LIKE meri_conversations.native_allocations INCLUDING ALL);
ALTER TABLE meri_conversations.native_restorations ADD FOREIGN KEY(tenant_id,conversation_id,run_id) REFERENCES meri_conversations.runs;
CREATE FUNCTION meri_conversations.preserve_native_preparation_identity() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF ROW(NEW.tenant_id,NEW.conversation_id,NEW.run_id,NEW.intent_key) IS DISTINCT FROM ROW(OLD.tenant_id,OLD.conversation_id,OLD.run_id,OLD.intent_key)
 OR (NEW.record - 'state' - 'resource' - 'receipt') IS DISTINCT FROM (OLD.record - 'state' - 'resource' - 'receipt') THEN
  RAISE EXCEPTION 'native preparation identity is immutable';
 END IF;
 IF TG_TABLE_NAME='native_allocations' THEN
  IF NOT (CASE OLD.record->>'state'
   WHEN 'CLAIMED' THEN NEW.record->>'state' IN ('ALLOCATED','UNKNOWN','RETIRED')
   WHEN 'ALLOCATED' THEN NEW.record->>'state' IN ('ALLOCATED','ADMITTED','UNKNOWN','RETIRED')
   WHEN 'UNKNOWN' THEN NEW.record->>'state' IN ('UNKNOWN','ALLOCATED','ADMITTED','RETIRED')
   WHEN 'ADMITTED' THEN NEW.record->>'state' IN ('ADMITTED','UNKNOWN','RETIRED')
   WHEN 'RETIRED' THEN NEW.record=OLD.record ELSE false END) THEN
   RAISE EXCEPTION 'native allocation transition refused';
  END IF;
  IF OLD.record->'resource' <> 'null'::jsonb AND
   (NEW.record->'resource' IS NULL OR NEW.record->'resource'='null'::jsonb OR
    ((NEW.record->'resource') - 'grantFactsJsons' - 'physicalStopProven') IS DISTINCT FROM
    ((OLD.record->'resource') - 'grantFactsJsons' - 'physicalStopProven')) THEN
   RAISE EXCEPTION 'native resource identity is immutable';
  END IF;
  IF NEW.record->>'state'='RETIRED' AND
   NEW.record->'resource'->'physicalStopProven' IS DISTINCT FROM 'true'::jsonb THEN
   RAISE EXCEPTION 'native retirement requires stop proof';
  END IF;
 ELSE
  IF NOT (CASE OLD.record->>'state'
   WHEN 'CLAIMED' THEN NEW.record->>'state' IN ('UNKNOWN','RESTORED')
   WHEN 'UNKNOWN' THEN NEW.record->>'state'='UNKNOWN'
   WHEN 'RESTORED' THEN NEW.record=OLD.record ELSE false END) THEN
   RAISE EXCEPTION 'native restoration transition refused';
  END IF;
  IF NEW.record->>'state'='RESTORED' AND
   (NEW.record->'receipt'->>'workspaceSha256' IS DISTINCT FROM NEW.record->>'workspaceSha256' OR
    NEW.record->'receipt'->>'opaqueSessionSha256' IS DISTINCT FROM NEW.record->>'opaqueSessionSha256') THEN
   RAISE EXCEPTION 'native restoration receipt refused';
  END IF;
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER preserve_native_allocation_identity BEFORE UPDATE ON meri_conversations.native_allocations FOR EACH ROW EXECUTE FUNCTION meri_conversations.preserve_native_preparation_identity();
CREATE TRIGGER preserve_native_restoration_identity BEFORE UPDATE ON meri_conversations.native_restorations FOR EACH ROW EXECUTE FUNCTION meri_conversations.preserve_native_preparation_identity();
COMMIT;
