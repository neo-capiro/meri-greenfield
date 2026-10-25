-- Forward-only expired Trash erasure through the existing retention target journal.
-- No content is changed by installation. The application must first read Core's
-- committed Trash identity and deadline, and hold the existing subject exclusion.
BEGIN;

ALTER TABLE meri_conversations.retention_purge_targets ADD COLUMN target jsonb;
ALTER TABLE meri_conversations.retention_purge_targets
 DROP CONSTRAINT retention_purge_targets_class_check,
 DROP CONSTRAINT retention_purge_targets_memory_identity_check;
ALTER TABLE meri_conversations.retention_purge_targets
 ADD CONSTRAINT retention_purge_targets_class_check CHECK (class IN (
  'sdkSession','meriMemoryCandidates','meriMemoryApprovalMetadata','meriMemoryCommandJournal',
  'meriMemoryIntentPreparations','conversation','events','lifecycle','completionCheckpoints',
  'nextRuns','selectedOutputs','nativeJournals','receipts')),
 ADD CONSTRAINT retention_purge_targets_identity_check CHECK ((
  (target IS NOT NULL AND jsonb_typeof(target)='object'
   AND target ?& ARRAY['table','key','rowSha256','mode']
   AND target - ARRAY['table','key','rowSha256','mode']='{}'::jsonb
   AND jsonb_typeof(target->'key')='object' AND target->'key'<>'{}'::jsonb
   AND target->>'mode' IN ('delete','identity','run','approval','command','lookup','intent')
   AND (target->'rowSha256'='null'::jsonb OR target->>'rowSha256' ~ '^[a-f0-9]{64}$')
   AND run_id IS NULL AND session_id IS NULL AND subpath IS NULL AND sequence IS NULL
   AND candidate_id IS NULL AND proposal_id IS NULL AND command_id IS NULL
   AND delivery_id IS NULL AND actor_id IS NULL)
  OR (target IS NULL AND (
   (class='sdkSession' AND run_id IS NOT NULL AND session_id IS NOT NULL AND subpath IS NOT NULL AND sequence IS NOT NULL
    AND candidate_id IS NULL AND proposal_id IS NULL AND command_id IS NULL AND delivery_id IS NULL AND actor_id IS NULL)
   OR (class='meriMemoryCandidates' AND candidate_id IS NOT NULL AND actor_id IS NOT NULL AND length(actor_id) BETWEEN 1 AND 128
    AND run_id IS NULL AND session_id IS NULL AND subpath IS NULL AND sequence IS NULL AND proposal_id IS NULL AND command_id IS NULL AND delivery_id IS NULL)
   OR (class='meriMemoryApprovalMetadata' AND proposal_id IS NOT NULL AND actor_id IS NOT NULL AND length(actor_id) BETWEEN 1 AND 128
    AND run_id IS NULL AND session_id IS NULL AND subpath IS NULL AND sequence IS NULL AND candidate_id IS NULL AND command_id IS NULL AND delivery_id IS NULL)
   OR (class='meriMemoryCommandJournal' AND command_id IS NOT NULL AND actor_id IS NOT NULL AND length(actor_id) BETWEEN 1 AND 128
    AND run_id IS NULL AND session_id IS NULL AND subpath IS NULL AND sequence IS NULL AND candidate_id IS NULL AND proposal_id IS NULL AND delivery_id IS NULL)
   OR (class='meriMemoryIntentPreparations' AND delivery_id IS NOT NULL AND delivery_id ~ '^sdk:[a-f0-9]{64}$'
    AND actor_id IS NOT NULL AND length(actor_id) BETWEEN 1 AND 128 AND run_id IS NULL AND session_id IS NULL AND subpath IS NULL AND sequence IS NULL
    AND candidate_id IS NULL AND proposal_id IS NULL AND command_id IS NULL)
  ))) IS TRUE);

-- Fixed target identities only. This function makes no change and grants no
-- authority by itself; row triggers call it with the actual OLD row. A target
-- inserted by an earlier transaction or a different suppression cannot qualify.
CREATE FUNCTION meri_conversations.expired_conversation_purge_target(p_table text,p_row jsonb,p_mode text)
RETURNS boolean LANGUAGE plpgsql AS $$
DECLARE columns text[]; actual_key jsonb; conversation text; expected_mode text;
BEGIN
 CASE p_table
  WHEN 'meri_conversations.runs' THEN columns:=ARRAY['run_id']; expected_mode:='run';
  WHEN 'meri_conversations.events' THEN columns:=ARRAY['run_id','sequence','event_id'];
  WHEN 'meri_conversations.controls' THEN columns:=ARRAY['control_id','run_id','control_sequence'];
  WHEN 'meri_conversations.checkpoints' THEN columns:=ARRAY['checkpoint_id'];
  WHEN 'meri_conversations.completion_checkpoints' THEN columns:=ARRAY['checkpoint_id','run_id'];
  WHEN 'meri_conversations.next_runs' THEN columns:=ARRAY['target_run_id'];
  WHEN 'meri_conversations.memory_proposal_contexts' THEN columns:=ARRAY['run_id','key_sha256'];
  WHEN 'meri_conversations.sdk_sessions' THEN columns:=ARRAY['run_id','session_id'];
  WHEN 'meri_conversations.sdk_session_streams' THEN columns:=ARRAY['run_id','session_id','subpath'];
  WHEN 'meri_conversations.sdk_session_entries' THEN columns:=ARRAY['run_id','session_id','subpath','sequence'];
  WHEN 'meri_conversations.sdk_session_batches' THEN columns:=ARRAY['run_id','session_id','append_id'];
  WHEN 'meri_conversations.native_allocations' THEN columns:=ARRAY['run_id'];
  WHEN 'meri_conversations.native_restorations' THEN columns:=ARRAY['run_id'];
  WHEN 'meri_conversations.selected_outputs' THEN columns:=ARRAY['run_id'];
  WHEN 'meri_conversations.selected_reads' THEN columns:=ARRAY['run_id','delivery_sha256'];
  WHEN 'meri_intents.preparations' THEN columns:=ARRAY['actor_id','delivery_id']; expected_mode:='intent';
  WHEN 'meri_commands.approval_metadata' THEN columns:=ARRAY['actor_id','proposal_id']; expected_mode:='approval';
  WHEN 'meri_commands.command_journal' THEN columns:=ARRAY['actor_id','idempotency_key']; expected_mode:='command';
  WHEN 'meri_task_lookup.lookups' THEN columns:=ARRAY['lookup_id']; expected_mode:='lookup';
  WHEN 'meri_task_lookup.events' THEN columns:=ARRAY['run_id','sequence'];
  WHEN 'meri_memory.candidates' THEN columns:=ARRAY['candidate_id']; expected_mode:='candidate';
  ELSE RETURN false;
 END CASE;
 IF p_mode IS DISTINCT FROM coalesce(expected_mode,'delete') OR NOT p_row ?& columns THEN RETURN false; END IF;
 SELECT jsonb_object_agg(k,p_row->k) INTO actual_key FROM unnest(columns) AS k;
 conversation:=p_row->>'conversation_id';
 IF p_table='meri_commands.approval_metadata' THEN conversation:=p_row#>>'{payload,record,binding,conversationId}'; END IF;
 IF p_table='meri_commands.command_journal' THEN conversation:=p_row#>>'{payload,proposal,command,binding,conversationId}'; END IF;
 IF p_table='meri_task_lookup.lookups' THEN conversation:=p_row#>>'{payload,context,binding,conversationId}'; END IF;
 IF p_table='meri_memory.candidates' AND p_row->>'origin_kind'='conversation' THEN conversation:=p_row->>'origin_conversation_id'; END IF;
 IF p_table='meri_task_lookup.events' THEN
  SELECT r.conversation_id::text INTO conversation FROM meri_conversations.runs r
   WHERE r.tenant_id=p_row->>'tenant_id' AND r.run_id::text=p_row->>'run_id';
 END IF;
 RETURN EXISTS (
  SELECT 1 FROM meri_conversations.retention_purge_targets t
  JOIN meri_conversations.retention_subjects s USING (tenant_id,conversation_id)
  WHERE t.tenant_id=p_row->>'tenant_id' AND t.conversation_id::text=conversation
   AND ((t.target->>'table'=p_table AND t.target->>'mode'=p_mode AND t.target->'key'=actual_key)
     OR (p_table='meri_memory.candidates' AND p_mode='candidate' AND t.target IS NULL
       AND t.class='meriMemoryCandidates' AND t.candidate_id::text=p_row->>'candidate_id'
       AND t.actor_id=p_row->>'proposer_actor_id' AND s.owner_actor_id=t.actor_id))
   AND t.state='PLANNED' AND t.xmin=pg_current_xact_id()::xid
   AND s.state='SUPPRESSED' AND s.projection->>'state'=s.state
   AND s.projection->>'ownerActorId'=s.owner_actor_id
   AND (NOT p_row ? 'actor_id' OR p_row->>'actor_id'=s.owner_actor_id)
   AND s.projection->>'ledgerSequence'=s.ledger_sequence::text
   AND s.projection->>'entrySha256'=s.entry_sha256
   AND s.projection#>>'{purge,state}' IN ('PLANNED','UNKNOWN')
   AND s.projection#>>'{purge,planSha256}'=t.plan_sha256
   AND s.projection#>>'{purge,ledgerSequence}'=t.ledger_sequence::text
   AND s.projection#>>'{purge,trash,revision}' ~ '^[1-9][0-9]*$'
   AND s.projection->>'reason'='conversation-trash:'||(s.projection#>>'{purge,trash,requestId}')
   AND (s.projection#>>'{purge,trash,restoreUntilMs}')::numeric
       -(s.projection#>>'{purge,trash,trashedAtMs}')::numeric=2592000000
   AND (s.projection#>>'{purge,trash,restoreUntilMs}')::numeric<=extract(epoch FROM clock_timestamp())*1000
  FOR UPDATE OF t,s
 );
END $$;

-- The existing candidate tombstone guard still owns immutable replay identity.
-- This added guard also requires the same committed expired-Trash target.
CREATE FUNCTION meri_conversations.guard_expired_memory_payload() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF (NEW.candidate,NEW.candidate_purged_at) IS DISTINCT FROM (OLD.candidate,OLD.candidate_purged_at)
    AND NOT meri_conversations.expired_conversation_purge_target('meri_memory.candidates',to_jsonb(OLD),'candidate')
 THEN RAISE EXCEPTION 'CONVERSATION_PURGE_TARGET_REQUIRED'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER expired_memory_payload BEFORE UPDATE ON meri_memory.candidates
 FOR EACH ROW EXECUTE FUNCTION meri_conversations.guard_expired_memory_payload();

CREATE FUNCTION meri_conversations.guard_expired_content_delete() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' AND meri_conversations.expired_conversation_purge_target(TG_TABLE_SCHEMA||'.'||TG_TABLE_NAME,to_jsonb(OLD),'delete') THEN RETURN OLD; END IF;
 RAISE EXCEPTION 'CONVERSATION_PURGE_TARGET_REQUIRED';
END $$;

CREATE TRIGGER expired_content_delete BEFORE DELETE ON meri_conversations.controls FOR EACH ROW EXECUTE FUNCTION meri_conversations.guard_expired_content_delete();
CREATE TRIGGER expired_content_delete BEFORE DELETE ON meri_conversations.events FOR EACH ROW EXECUTE FUNCTION meri_conversations.guard_expired_content_delete();
CREATE TRIGGER expired_content_delete BEFORE DELETE ON meri_conversations.checkpoints FOR EACH ROW EXECUTE FUNCTION meri_conversations.guard_expired_content_delete();
CREATE TRIGGER expired_content_delete BEFORE DELETE ON meri_conversations.sdk_sessions FOR EACH ROW EXECUTE FUNCTION meri_conversations.guard_expired_content_delete();
CREATE TRIGGER expired_content_delete BEFORE DELETE ON meri_conversations.sdk_session_streams FOR EACH ROW EXECUTE FUNCTION meri_conversations.guard_expired_content_delete();
CREATE TRIGGER expired_content_delete BEFORE DELETE ON meri_conversations.native_allocations FOR EACH ROW EXECUTE FUNCTION meri_conversations.guard_expired_content_delete();
CREATE TRIGGER expired_content_delete BEFORE DELETE ON meri_conversations.native_restorations FOR EACH ROW EXECUTE FUNCTION meri_conversations.guard_expired_content_delete();
CREATE TRIGGER expired_content_delete BEFORE DELETE ON meri_conversations.selected_outputs FOR EACH ROW EXECUTE FUNCTION meri_conversations.guard_expired_content_delete();
CREATE TRIGGER expired_content_delete BEFORE DELETE ON meri_conversations.selected_reads FOR EACH ROW EXECUTE FUNCTION meri_conversations.guard_expired_content_delete();
CREATE TRIGGER expired_content_delete BEFORE DELETE ON meri_task_lookup.events FOR EACH ROW EXECUTE FUNCTION meri_conversations.guard_expired_content_delete();

CREATE FUNCTION meri_conversations.reject_checkpoint_update() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'CHECKPOINT_IMMUTABLE'; END $$;
CREATE TRIGGER checkpoint_lock_only BEFORE UPDATE ON meri_conversations.checkpoints
 FOR EACH ROW EXECUTE FUNCTION meri_conversations.reject_checkpoint_update();

CREATE FUNCTION meri_conversations.reject_event_identity_update() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'EVENT_IDENTITY_IMMUTABLE'; END $$;
CREATE TRIGGER event_identity_lock_only BEFORE UPDATE OF event_id ON meri_conversations.events
 FOR EACH ROW EXECUTE FUNCTION meri_conversations.reject_event_identity_update();

-- Consumed identities remain unique and cannot be rehydrated. Ordinary updates
-- retain their existing owners; only the precise terminal payload replacement is
-- allowed through this additional retention path.
CREATE FUNCTION meri_conversations.guard_conversation_tombstone() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE before_body jsonb; after_body jsonb; columns text[]; mode text; marker jsonb; conversation text;
 old_row jsonb:=to_jsonb(OLD); new_row jsonb:=to_jsonb(NEW);
BEGIN
 IF TG_TABLE_NAME='runs' THEN
  before_body:=OLD.request; after_body:=NEW.request;
  columns:=ARRAY['request','continuation','continuation_sha256']; mode:='run'; conversation:=OLD.conversation_id::text;
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
 IF mode='run' AND (new_row->'continuation' IS DISTINCT FROM 'null'::jsonb OR new_row->'continuation_sha256' IS DISTINCT FROM 'null'::jsonb
      OR (old_row#>>'{projection,state}' IN ('completed','failed','cancelled')) IS NOT TRUE)
  OR mode='command' AND (old_row->>'state' IS DISTINCT FROM 'OUTCOME' OR new_row->'outcome' IS DISTINCT FROM marker)
  OR mode='lookup' AND ((old_row->>'state' IN ('RESULT','ERROR')) IS NOT TRUE OR new_row->'record' IS DISTINCT FROM CASE WHEN old_row->'record'='null'::jsonb THEN 'null'::jsonb ELSE marker END)
 THEN RAISE EXCEPTION 'CONVERSATION_PURGE_UNSETTLED'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER conversation_tombstone BEFORE UPDATE ON meri_conversations.runs FOR EACH ROW EXECUTE FUNCTION meri_conversations.guard_conversation_tombstone();
CREATE TRIGGER conversation_tombstone BEFORE UPDATE ON meri_commands.approval_metadata FOR EACH ROW EXECUTE FUNCTION meri_conversations.guard_conversation_tombstone();
CREATE TRIGGER conversation_tombstone BEFORE UPDATE ON meri_commands.command_journal FOR EACH ROW EXECUTE FUNCTION meri_conversations.guard_conversation_tombstone();
CREATE TRIGGER conversation_tombstone BEFORE UPDATE ON meri_task_lookup.lookups FOR EACH ROW EXECUTE FUNCTION meri_conversations.guard_conversation_tombstone();

-- The existing immutable trigger bodies are amended below, preserving their
-- ordinary update rules and historical exact-target routes.
CREATE OR REPLACE FUNCTION meri_conversations.reject_sdk_mirror_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' AND meri_conversations.expired_conversation_purge_target(TG_TABLE_SCHEMA||'.'||TG_TABLE_NAME,to_jsonb(OLD),'delete') THEN RETURN OLD; END IF;
 IF TG_OP = 'DELETE' AND TG_TABLE_NAME = 'sdk_session_entries' AND EXISTS (
  SELECT 1 FROM meri_conversations.retention_purge_targets t
  JOIN meri_conversations.retention_subjects s ON s.tenant_id = t.tenant_id AND s.conversation_id = t.conversation_id
  WHERE t.tenant_id = OLD.tenant_id AND t.conversation_id = OLD.conversation_id AND t.class = 'sdkSession'
    AND t.run_id = OLD.run_id AND t.session_id = OLD.session_id AND t.subpath = OLD.subpath AND t.sequence = OLD.sequence
    AND t.state = 'PLANNED' AND t.xmin = pg_current_xact_id()::xid AND s.state = 'SUPPRESSED'
 ) THEN RETURN OLD; END IF;
 RAISE EXCEPTION 'SDK_MIRROR_IMMUTABLE';
END $$;

CREATE OR REPLACE FUNCTION meri_conversations.preserve_completion_identity() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' AND meri_conversations.expired_conversation_purge_target(TG_TABLE_SCHEMA||'.'||TG_TABLE_NAME,to_jsonb(OLD),'delete') THEN RETURN OLD; END IF;
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'completion checkpoints are immutable'; END IF;
 IF NEW.tenant_id<>OLD.tenant_id OR NEW.conversation_id<>OLD.conversation_id OR NEW.run_id<>OLD.run_id OR NEW.completion_id<>OLD.completion_id OR NEW.checkpoint_id<>OLD.checkpoint_id OR NEW.identity<>OLD.identity OR NEW.identity_sha256<>OLD.identity_sha256 THEN RAISE EXCEPTION 'completion identity is immutable'; END IF;
 IF OLD.state='PUBLISHED' AND (NEW.state<>OLD.state OR NEW.proof IS DISTINCT FROM OLD.proof OR NEW.proof_sha256 IS DISTINCT FROM OLD.proof_sha256) THEN RAISE EXCEPTION 'completion proof is immutable'; END IF;
 IF OLD.state='UNKNOWN' AND NEW.state='CAPTURING' THEN RAISE EXCEPTION 'completion capture cannot restart'; END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION meri_conversations.reject_closed_range_event() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE parent meri_conversations.runs%ROWTYPE;
BEGIN
 IF TG_OP='DELETE' AND meri_conversations.expired_conversation_purge_target(TG_TABLE_SCHEMA||'.'||TG_TABLE_NAME,to_jsonb(OLD),'delete') THEN RETURN OLD; END IF;
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

CREATE OR REPLACE FUNCTION meri_conversations.preserve_next_run_identity() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' AND meri_conversations.expired_conversation_purge_target(TG_TABLE_SCHEMA||'.'||TG_TABLE_NAME,to_jsonb(OLD),'delete') THEN RETURN OLD; END IF;
 IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'next_runs rows are immutable'; END IF;
 IF NEW.tenant_id <> OLD.tenant_id OR NEW.conversation_id <> OLD.conversation_id OR NEW.target_run_id <> OLD.target_run_id OR NEW.source_run_id <> OLD.source_run_id OR NEW.reservation <> OLD.reservation OR NEW.reservation_sha256 <> OLD.reservation_sha256 THEN RAISE EXCEPTION 'next_runs identity is immutable'; END IF;
 IF NEW.state='ACCEPTED' AND NOT EXISTS (SELECT 1 FROM meri_conversations.runs WHERE tenant_id=NEW.tenant_id AND conversation_id=NEW.conversation_id AND run_id=NEW.target_run_id AND projection->'binding'=NEW.reservation->'target') THEN RAISE EXCEPTION 'accepted next run target is missing'; END IF;
 IF NOT (NEW.state = OLD.state OR (OLD.state = 'RESERVED' AND NEW.state = 'ACCEPTED')) THEN RAISE EXCEPTION 'next_runs state cannot regress'; END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION meri_conversations.reject_memory_proposal_context_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' AND meri_conversations.expired_conversation_purge_target(TG_TABLE_SCHEMA||'.'||TG_TABLE_NAME,to_jsonb(OLD),'delete') THEN RETURN OLD; END IF;
 IF TG_OP <> 'DELETE' THEN
  RAISE EXCEPTION 'MEMORY_PROPOSAL_CONTEXT_IMMUTABLE';
 END IF;
 IF EXISTS (
  SELECT 1 FROM meri_conversations.memory_proposal_retention_targets t
  JOIN meri_conversations.retention_subjects s
    ON s.tenant_id = t.tenant_id AND s.conversation_id = t.conversation_id
  WHERE t.tenant_id = OLD.tenant_id AND t.conversation_id = OLD.conversation_id
    AND t.run_id = OLD.run_id AND t.key_sha256 = OLD.key_sha256
    AND t.state = 'PLANNED' AND t.xmin = pg_current_xact_id()::xid
    AND s.state = 'SUPPRESSED' AND s.projection->>'state' = 'SUPPRESSED'
    AND s.projection#>>'{purge,state}' IN ('PLANNED','UNKNOWN')
    AND s.projection#>>'{purge,planSha256}' = t.plan_sha256
    AND s.projection#>>'{purge,ledgerSequence}' = t.ledger_sequence::text
    AND s.projection->>'ledgerSequence' = s.ledger_sequence::text
 ) THEN RETURN OLD; END IF;
 RAISE EXCEPTION 'MEMORY_PROPOSAL_CONTEXT_IMMUTABLE';
END $$;

CREATE OR REPLACE FUNCTION meri_intents.guard_preparation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP = 'TRUNCATE' OR TG_OP = 'DELETE' THEN
  RAISE EXCEPTION 'INTENT_PREPARATION_FENCE_REQUIRED';
 END IF;
 IF TG_OP = 'INSERT' THEN
  IF NEW.state <> 'PENDING' OR NEW.outcome IS NOT NULL OR NEW.outcome_purged_at IS NOT NULL
  THEN RAISE EXCEPTION 'INTENT_PREPARATION_CLAIM_REQUIRED'; END IF;
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
 IF OLD.state='PREPARED' AND NEW.state='REDACTED'
    AND OLD.outcome IS NOT NULL AND OLD.outcome_purged_at IS NULL
    AND NEW.outcome IS NULL AND NEW.outcome_purged_at IS NOT NULL
    AND (to_jsonb(NEW)-ARRAY['state','outcome','outcome_purged_at'])
      IS NOT DISTINCT FROM (to_jsonb(OLD)-ARRAY['state','outcome','outcome_purged_at'])
    AND meri_conversations.expired_conversation_purge_target('meri_intents.preparations',to_jsonb(OLD),'intent') THEN
  NEW.outcome_purged_at:=clock_timestamp(); RETURN NEW;
 END IF;
 RAISE EXCEPTION 'INTENT_PREPARATION_TERMINAL';
END $$;
COMMIT;
