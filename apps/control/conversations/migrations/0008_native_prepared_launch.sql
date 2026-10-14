-- Centrally reserved: extend the existing allocation resource, no new table or authority.
BEGIN;
CREATE OR REPLACE FUNCTION meri_conversations.preserve_native_preparation_identity() RETURNS trigger LANGUAGE plpgsql AS $$
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
    ((NEW.record->'resource') - 'grantFactsJsons' - 'physicalStopProven' - 'launchBinding') IS DISTINCT FROM
    ((OLD.record->'resource') - 'grantFactsJsons' - 'physicalStopProven' - 'launchBinding')) THEN
   RAISE EXCEPTION 'native resource identity is immutable';
  END IF;
  IF NEW.record->'resource' ? 'launchBinding' THEN
   IF jsonb_typeof(NEW.record->'resource'->'launchBinding') IS DISTINCT FROM 'object'
    OR NOT ((NEW.record->'resource'->'launchBinding') ?& ARRAY['preparationId','descriptorSha256','configTreeSha256','state'])
    OR ((NEW.record->'resource'->'launchBinding') - 'preparationId' - 'descriptorSha256' - 'configTreeSha256' - 'state') <> '{}'::jsonb
    OR jsonb_typeof(NEW.record->'resource'->'launchBinding'->'preparationId') IS DISTINCT FROM 'string'
    OR (NEW.record->'resource'->'launchBinding'->>'preparationId') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    OR jsonb_typeof(NEW.record->'resource'->'launchBinding'->'descriptorSha256') IS DISTINCT FROM 'string'
    OR (NEW.record->'resource'->'launchBinding'->>'descriptorSha256') !~ '^[a-f0-9]{64}$'
    OR jsonb_typeof(NEW.record->'resource'->'launchBinding'->'configTreeSha256') IS DISTINCT FROM 'string'
    OR (NEW.record->'resource'->'launchBinding'->>'configTreeSha256') !~ '^[a-f0-9]{64}$'
    OR jsonb_typeof(NEW.record->'resource'->'launchBinding'->'state') IS DISTINCT FROM 'string'
    OR (NEW.record->'resource'->'launchBinding'->>'state') NOT IN ('PREPARED','CLAIMED','STARTED','UNKNOWN')
    OR NEW.record->>'state' NOT IN ('ADMITTED','UNKNOWN','RETIRED') THEN
    RAISE EXCEPTION 'native prepared launch shape refused';
   END IF;
  END IF;
  IF OLD.record->'resource' ? 'launchBinding' THEN
   IF NOT (NEW.record->'resource' ? 'launchBinding')
    OR ((NEW.record->'resource'->'launchBinding') - 'state') IS DISTINCT FROM ((OLD.record->'resource'->'launchBinding') - 'state')
    OR ((NEW.record->'resource'->'launchBinding'->>'state') IS DISTINCT FROM (OLD.record->'resource'->'launchBinding'->>'state')
     AND (OLD.record->>'state'<>'ADMITTED' OR NEW.record->>'state'<>'ADMITTED'))
    OR NOT (CASE OLD.record->'resource'->'launchBinding'->>'state'
     WHEN 'PREPARED' THEN NEW.record->'resource'->'launchBinding'->>'state' IN ('PREPARED','CLAIMED')
     WHEN 'CLAIMED' THEN NEW.record->'resource'->'launchBinding'->>'state' IN ('CLAIMED','STARTED','UNKNOWN')
     WHEN 'STARTED' THEN NEW.record->'resource'->'launchBinding'->>'state'='STARTED'
     WHEN 'UNKNOWN' THEN NEW.record->'resource'->'launchBinding'->>'state'='UNKNOWN'
     ELSE false END) THEN
    RAISE EXCEPTION 'native prepared launch identity or transition refused';
   END IF;
  ELSIF NEW.record->'resource' ? 'launchBinding' THEN
   IF OLD.record->>'state'<>'ADMITTED' OR NEW.record->>'state'<>'ADMITTED'
    OR NEW.record->'resource'->'launchBinding'->>'state'<>'PREPARED' THEN
    RAISE EXCEPTION 'native prepared launch requires admitted allocation';
   END IF;
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
COMMIT;
