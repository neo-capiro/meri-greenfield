-- 0030: Child (SDK subagent) assignment custody on the existing run owner.
-- Existing run owner and existing run transaction; no child pipeline, scheduler, budget ledger or new authority.
BEGIN;
ALTER TABLE meri_conversations.runs
 ADD COLUMN child_assignments jsonb,
 ADD COLUMN child_assignments_sha256 text,
 ADD CONSTRAINT run_child_assignments_consistent CHECK (
  (child_assignments IS NULL AND child_assignments_sha256 IS NULL) OR
  (child_assignments IS NOT NULL AND jsonb_typeof(child_assignments)='array' AND jsonb_array_length(child_assignments) BETWEEN 1 AND 64
   AND child_assignments_sha256 IS NOT NULL AND child_assignments_sha256 ~ '^[a-f0-9]{64}$'));
GRANT UPDATE (child_assignments,child_assignments_sha256) ON meri_conversations.runs TO meri_control_runtime;

CREATE FUNCTION meri_conversations.guard_run_child_assignments() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE prior jsonb:=coalesce(OLD.child_assignments,'[]'::jsonb); receipt jsonb; tool text;
BEGIN
 IF (NEW.child_assignments,NEW.child_assignments_sha256) IS NOT DISTINCT FROM (OLD.child_assignments,OLD.child_assignments_sha256) THEN RETURN NEW; END IF;
 -- The existing retention target transaction alone may erase the child custody receipts.
 IF NEW.request->'retentionTombstone'='true'::jsonb AND NEW.child_assignments IS NULL AND NEW.child_assignments_sha256 IS NULL
  AND meri_conversations.expired_conversation_purge_target('meri_conversations.runs',to_jsonb(OLD),'run') THEN RETURN NEW; END IF;
 -- Append-only while the run is live: exactly one receipt, never a rewrite of the persisted prefix.
 IF OLD.request->'retentionTombstone'='true'::jsonb OR NEW.child_assignments IS NULL OR jsonb_typeof(NEW.child_assignments)<>'array'
  OR (OLD.projection->>'state'='running') IS NOT TRUE
  OR jsonb_array_length(NEW.child_assignments)<>jsonb_array_length(prior)+1
  OR NEW.child_assignments-(jsonb_array_length(NEW.child_assignments)-1) IS DISTINCT FROM prior
 THEN RAISE EXCEPTION 'CHILD_ASSIGNMENT_APPEND_REFUSED'; END IF;
 receipt:=NEW.child_assignments->(jsonb_array_length(NEW.child_assignments)-1); tool:=receipt->>'toolUseId';
 IF receipt->>'kind' NOT IN ('assignment','result')
  OR receipt->>'assignmentId' !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  OR tool IS NULL OR length(tool) NOT BETWEEN 1 AND 200
  OR jsonb_typeof(receipt->'revision')<>'object' OR NOT (receipt->'revision') ? 'steer'
  -- The persisted goal revision of the run is the revision the child was assigned under.
  OR receipt#>>'{revision,requestSha256}' IS DISTINCT FROM OLD.request_sha256
 THEN RAISE EXCEPTION 'CHILD_ASSIGNMENT_RECEIPT_REFUSED'; END IF;
 IF receipt->>'kind'='assignment' THEN
  -- One child per SDK tool-use identity: a re-issued call reads the persisted assignment instead of a second child.
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(prior) r WHERE r->>'toolUseId'=tool)
   OR receipt->>'role' IS NULL OR jsonb_typeof(receipt->'narrowing')<>'object' OR jsonb_typeof(receipt#>'{narrowing,tools}')<>'array'
   OR jsonb_array_length(receipt#>'{narrowing,tools}') NOT BETWEEN 0 AND 64
  THEN RAISE EXCEPTION 'CHILD_ASSIGNMENT_RECEIPT_REFUSED'; END IF;
 ELSE
  -- A result receipt is bound to its persisted assignment, carries the result digest and is written once.
  IF receipt->>'resultSha256' !~ '^[a-f0-9]{64}$' OR jsonb_typeof(receipt->'resultBytes')<>'number'
   OR (receipt->>'resultBytes')::numeric NOT BETWEEN 0 AND 1048576 OR receipt->>'outcome' NOT IN ('completed','failed')
   OR jsonb_typeof(receipt->'custody')<>'object'
   OR NOT EXISTS (SELECT 1 FROM jsonb_array_elements(prior) r WHERE r->>'kind'='assignment' AND r->>'toolUseId'=tool AND r->>'assignmentId'=receipt->>'assignmentId')
   OR EXISTS (SELECT 1 FROM jsonb_array_elements(prior) r WHERE r->>'kind'='result' AND r->>'toolUseId'=tool)
  THEN RAISE EXCEPTION 'CHILD_ASSIGNMENT_RECEIPT_REFUSED'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER run_child_assignments BEFORE UPDATE OF child_assignments,child_assignments_sha256 ON meri_conversations.runs
 FOR EACH ROW EXECUTE FUNCTION meri_conversations.guard_run_child_assignments();

-- Preserve the existing terminal erasure guard and add both child custody columns.
CREATE OR REPLACE FUNCTION meri_conversations.guard_conversation_tombstone() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE before_body jsonb; after_body jsonb; columns text[]; mode text; marker jsonb; conversation text;
 old_row jsonb:=to_jsonb(OLD); new_row jsonb:=to_jsonb(NEW);
BEGIN
 IF TG_TABLE_NAME='runs' THEN
  before_body:=OLD.request; after_body:=NEW.request;
  columns:=ARRAY['request','continuation','continuation_sha256','feedback','feedback_sha256','child_assignments','child_assignments_sha256']; mode:='run'; conversation:=OLD.conversation_id::text;
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
 -- The child custody columns are erased by the same retention purge owner as the other run content columns
 -- (apps/control/retention/conversation-purge-rows.mjs run erasure SET clause), so a run row may not be tombstoned
 -- while child custody receipts remain.
 IF mode='run' AND (new_row->'feedback' IS DISTINCT FROM 'null'::jsonb OR new_row->'feedback_sha256' IS DISTINCT FROM 'null'::jsonb OR new_row->'continuation' IS DISTINCT FROM 'null'::jsonb OR new_row->'continuation_sha256' IS DISTINCT FROM 'null'::jsonb OR new_row->'child_assignments' IS DISTINCT FROM 'null'::jsonb OR new_row->'child_assignments_sha256' IS DISTINCT FROM 'null'::jsonb
      OR (old_row#>>'{projection,state}' IN ('completed','failed','cancelled')) IS NOT TRUE)
  OR mode='command' AND (old_row->>'state' IS DISTINCT FROM 'OUTCOME' OR new_row->'outcome' IS DISTINCT FROM marker)
  OR mode='lookup' AND ((old_row->>'state' IN ('RESULT','ERROR')) IS NOT TRUE OR new_row->'record' IS DISTINCT FROM CASE WHEN old_row->'record'='null'::jsonb THEN 'null'::jsonb ELSE marker END)
 THEN RAISE EXCEPTION 'CONVERSATION_PURGE_UNSETTLED'; END IF;
 RETURN NEW;
END $$;
COMMIT;
