-- MO14 forward migration source. Numeric slot awaits orchestrator allocation.
-- Existing run owner; no new feedback pipeline or approval/learning authority.
BEGIN;
ALTER TABLE meri_conversations.runs
 ADD COLUMN feedback jsonb,
 ADD COLUMN feedback_sha256 text,
 ADD CONSTRAINT run_feedback_consistent CHECK (
  (feedback IS NULL AND feedback_sha256 IS NULL) OR
  (feedback IS NOT NULL AND jsonb_typeof(feedback)='array' AND jsonb_array_length(feedback) BETWEEN 1 AND 50
   AND feedback_sha256 IS NOT NULL AND feedback_sha256 ~ '^[a-f0-9]{64}$'));
GRANT UPDATE (feedback,feedback_sha256) ON meri_conversations.runs TO meri_control_runtime;

CREATE FUNCTION meri_conversations.guard_run_feedback() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE prior jsonb:=coalesce(OLD.feedback,'[]'::jsonb); receipt jsonb;
BEGIN
 IF (NEW.feedback,NEW.feedback_sha256) IS NOT DISTINCT FROM (OLD.feedback,OLD.feedback_sha256) THEN RETURN NEW; END IF;
 -- The existing retention target transaction alone may erase the feedback body.
 IF NEW.request->'retentionTombstone'='true'::jsonb AND NEW.feedback IS NULL AND NEW.feedback_sha256 IS NULL
  AND meri_conversations.expired_conversation_purge_target('meri_conversations.runs',to_jsonb(OLD),'run') THEN RETURN NEW; END IF;
 IF OLD.request->'retentionTombstone'='true'::jsonb OR NEW.feedback IS NULL OR jsonb_typeof(NEW.feedback)<>'array'
  OR (OLD.projection->>'state' IN ('completed','failed','cancelled')) IS NOT TRUE
  OR jsonb_array_length(NEW.feedback)<>jsonb_array_length(prior)+1
  OR NEW.feedback-(jsonb_array_length(NEW.feedback)-1) IS DISTINCT FROM prior
 THEN RAISE EXCEPTION 'FEEDBACK_APPEND_REFUSED'; END IF;
 receipt:=NEW.feedback->(jsonb_array_length(NEW.feedback)-1);
 IF receipt->>'conversationId' IS DISTINCT FROM OLD.conversation_id::text
  OR receipt#>>'{target,runId}' IS DISTINCT FROM OLD.run_id::text
  OR receipt->>'actorId' IS DISTINCT FROM OLD.projection#>>'{binding,actorId}'
  OR receipt#>>'{target,throughSequence}' IS DISTINCT FROM OLD.last_sequence::text
  OR receipt->'disposition' IS DISTINCT FROM '{"status":"recorded","review":"not_reviewed","effect":"none"}'::jsonb
  OR EXISTS (SELECT 1 FROM jsonb_array_elements(prior) r WHERE r->>'requestId'=receipt->>'requestId' OR r->>'feedbackId'=receipt->>'feedbackId')
 THEN RAISE EXCEPTION 'FEEDBACK_RECEIPT_REFUSED'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER run_feedback BEFORE UPDATE OF feedback,feedback_sha256 ON meri_conversations.runs
 FOR EACH ROW EXECUTE FUNCTION meri_conversations.guard_run_feedback();

-- Preserve the existing terminal erasure guard and add both feedback columns.
CREATE OR REPLACE FUNCTION meri_conversations.guard_conversation_tombstone() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE before_body jsonb; after_body jsonb; columns text[]; mode text; marker jsonb; conversation text;
 old_row jsonb:=to_jsonb(OLD); new_row jsonb:=to_jsonb(NEW);
BEGIN
 IF TG_TABLE_NAME='runs' THEN
  before_body:=OLD.request; after_body:=NEW.request;
  columns:=ARRAY['request','continuation','continuation_sha256','feedback','feedback_sha256']; mode:='run'; conversation:=OLD.conversation_id::text;
 ELSE
  before_body:=OLD.payload; after_body:=NEW.payload;
  CASE TG_TABLE_SCHEMA||'.'||TG_TABLE_NAME
   WHEN 'meri_commands.approval_metadata' THEN columns:=ARRAY['payload']; mode:='approval'; conversation:=before_body#>>'{record,binding,conversationId}';
   WHEN 'meri_commands.command_journal' THEN columns:=ARRAY['payload','outcome']; mode:='command'; conversation:=before_body#>>'{proposal,command,binding,conversationId}';
   WHEN 'meri_task_lookup.lookups' THEN columns:=ARRAY['payload','record']; mode:='lookup'; conversation:=before_body#>>'{context,binding,conversationId}';
   ELSE RAISE EXCEPTION 'CONVERSATION_PURGE_TARGET_REQUIRED';
  END CASE;
 END IF;
 IF before_body->'retentionTombstone'='true'::jsonb THEN RAISE EXCEPTION 'CONVERSATION_TOMBSTONE_IMMUTABLE'; END IF;
 IF after_body->'retentionTombstone' IS DISTINCT FROM 'true'::jsonb THEN
  -- These newly granted content columns remain immutable outside this exact
  -- erasure path. Existing state/outcome/record transitions keep their owners.
  IF after_body IS DISTINCT FROM before_body OR mode='run' AND
     (new_row->'continuation',new_row->'continuation_sha256') IS DISTINCT FROM (old_row->'continuation',old_row->'continuation_sha256')
  THEN RAISE EXCEPTION 'CONVERSATION_CONTENT_IMMUTABLE'; END IF;
  RETURN NEW;
 END IF;
 marker:=jsonb_build_object('retentionTombstone',true,'conversationId',conversation);
 IF after_body IS DISTINCT FROM marker OR (to_jsonb(NEW)-columns) IS DISTINCT FROM (to_jsonb(OLD)-columns)
  OR NOT meri_conversations.expired_conversation_purge_target(TG_TABLE_SCHEMA||'.'||TG_TABLE_NAME,to_jsonb(OLD),mode)
 THEN RAISE EXCEPTION 'CONVERSATION_PURGE_TARGET_REQUIRED'; END IF;
 IF mode='run' AND (new_row->'feedback' IS DISTINCT FROM 'null'::jsonb OR new_row->'feedback_sha256' IS DISTINCT FROM 'null'::jsonb OR new_row->'continuation' IS DISTINCT FROM 'null'::jsonb OR new_row->'continuation_sha256' IS DISTINCT FROM 'null'::jsonb
      OR (old_row#>>'{projection,state}' IN ('completed','failed','cancelled')) IS NOT TRUE)
  OR mode='command' AND (old_row->>'state' IS DISTINCT FROM 'OUTCOME' OR new_row->'outcome' IS DISTINCT FROM marker)
  OR mode='lookup' AND ((old_row->>'state' IN ('RESULT','ERROR')) IS NOT TRUE OR new_row->'record' IS DISTINCT FROM CASE WHEN old_row->'record'='null'::jsonb THEN 'null'::jsonb ELSE marker END)
 THEN RAISE EXCEPTION 'CONVERSATION_PURGE_UNSETTLED'; END IF;
 RETURN NEW;
END $$;
COMMIT;
