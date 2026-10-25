-- Objective private selections join the existing expired-Trash retention owner.
-- Preserve every job/run/replay digest; only the exact record body can become a
-- terminal tombstone under the existing transaction-bound purge target.
BEGIN;

-- The original unnamed record constraint is located by its exact table/column.
-- No binding, identity or digest constraint is removed.
DO $$
DECLARE record_constraint name;
BEGIN
 SELECT c.conname INTO STRICT record_constraint FROM pg_catalog.pg_constraint c
 JOIN pg_catalog.pg_attribute a ON a.attrelid=c.conrelid AND a.attname='record'
 WHERE c.conrelid='meri_objective_source.run_starts'::regclass AND c.contype='c' AND a.attnum=ANY(c.conkey);
 EXECUTE format('ALTER TABLE meri_objective_source.run_starts DROP CONSTRAINT %I',record_constraint);
END $$;
ALTER TABLE meri_objective_source.run_starts ADD CONSTRAINT run_starts_retained_record_check
 CHECK (record=jsonb_build_object('retentionTombstone',true,'conversationId',conversation_id::text) OR
 (jsonb_typeof(record) = 'object' AND octet_length(record::text) <= 2097152 AND
  record ?& ARRAY['schemaVersion','generationJobId','binding','sourceAdmissionSha256','sourceRequestSha256','typedRequestSha256','selectionSha256','effectExpiresAtMs','selection'] AND
  record - ARRAY['schemaVersion','generationJobId','binding','sourceAdmissionSha256','sourceRequestSha256','typedRequestSha256','selectionSha256','effectExpiresAtMs','selection'] = '{}'::jsonb AND
  record->'schemaVersion' = '1'::jsonb AND record->>'generationJobId' = generation_job_id::text AND record->'binding' = binding AND
  record->>'sourceAdmissionSha256' = source_admission_sha256 AND record->>'sourceRequestSha256' = source_request_sha256 AND
  record->>'typedRequestSha256' = typed_request_sha256 AND record->>'selectionSha256' = selection_sha256 AND
  record->'effectExpiresAtMs' = to_jsonb(effect_expires_at_ms) AND jsonb_typeof(record->'selection') = 'object' AND
  record->'selection' ?& ARRAY['sourceAdmission','request','executionContext','queuedType'] AND
  (record->'selection') - ARRAY['sourceAdmission','request','executionContext','queuedType'] = '{}'::jsonb AND
  record#>>'{selection,sourceAdmission,generationJobId}' = generation_job_id::text AND
  record#>>'{selection,request,jobId}' = generation_job_id::text AND
  record#>>'{selection,sourceAdmission,actorUserId}' = binding->>'actorId' AND
  record#>>'{selection,sourceAdmission,canonical,tenantId}' = tenant_id AND
  record#>>'{selection,queuedType}' IN ('appropriations','authorization','regulatory','coalition','procurement','earmark','amendment')) IS TRUE);

ALTER TABLE meri_conversations.retention_purge_targets DROP CONSTRAINT retention_purge_targets_identity_check;
ALTER TABLE meri_conversations.retention_purge_targets
ADD CONSTRAINT retention_purge_targets_identity_check CHECK ((
  (target IS NOT NULL AND jsonb_typeof(target)='object'
   AND target ?& ARRAY['table','key','rowSha256','mode']
   AND target - ARRAY['table','key','rowSha256','mode']='{}'::jsonb
   AND jsonb_typeof(target->'key')='object' AND target->'key'<>'{}'::jsonb
   AND target->>'mode' IN ('delete','identity','run','approval','command','lookup','intent','objective')
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

CREATE OR REPLACE FUNCTION meri_conversations.expired_conversation_purge_target(p_table text,p_row jsonb,p_mode text)
RETURNS boolean LANGUAGE plpgsql AS $$
DECLARE columns text[]; actual_key jsonb; conversation text; expected_mode text;
BEGIN
 CASE p_table
  WHEN 'meri_objective_source.run_starts' THEN columns:=ARRAY['generation_job_id']; expected_mode:='objective';
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
   AND (p_table<>'meri_objective_source.run_starts' OR p_row#>>'{binding,actorId}'=s.owner_actor_id)
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


CREATE OR REPLACE FUNCTION meri_objective_source.guard_run_start_immutable() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog AS $$
BEGIN
 IF TG_OP='INSERT' THEN
  IF NEW.record->'retentionTombstone'='true'::jsonb THEN RAISE EXCEPTION 'OBJECTIVE_RUN_START_IMMUTABLE'; END IF;
  RETURN NEW;
 END IF;
 IF TG_OP='UPDATE' THEN
  IF OLD.record->'retentionTombstone'='true'::jsonb THEN RAISE EXCEPTION 'OBJECTIVE_RUN_START_IMMUTABLE'; END IF;
  IF NEW.record=jsonb_build_object('retentionTombstone',true,'conversationId',OLD.conversation_id::text)
   AND (to_jsonb(NEW)-'record') IS NOT DISTINCT FROM (to_jsonb(OLD)-'record')
   AND meri_conversations.expired_conversation_purge_target('meri_objective_source.run_starts',to_jsonb(OLD),'objective')
  THEN RETURN NEW; END IF;
 END IF;
 RAISE EXCEPTION 'OBJECTIVE_RUN_START_IMMUTABLE';
END $$;
CREATE TRIGGER immutable_run_start_insert BEFORE INSERT ON meri_objective_source.run_starts
 FOR EACH ROW EXECUTE FUNCTION meri_objective_source.guard_run_start_immutable();
-- SELECT/INSERT already belong to this role. No DELETE, TRUNCATE, identity or
-- hash update privilege is granted. The guard rejects rehydration permanently.
GRANT UPDATE (record) ON meri_objective_source.run_starts TO meri_control_runtime;
COMMIT;
