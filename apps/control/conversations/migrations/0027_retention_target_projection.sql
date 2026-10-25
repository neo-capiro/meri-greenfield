-- Expand the canonical authority projection once per matched subject row.
-- Keep every current exact-target/authority/expiry predicate and both row locks;
-- the legacy Memory branch remains byte-identical to migration 0026.
BEGIN;
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
 -- Keep the canonical JSONB equality outside the legacy alternative so a
 -- generic cached plan can use retention_purge_targets_planned_key.
 IF EXISTS (
  SELECT 1 FROM meri_conversations.retention_purge_targets t
  JOIN meri_conversations.retention_subjects s USING (tenant_id,conversation_id)
  CROSS JOIN LATERAL jsonb_to_record(s.projection) AS doc(
   state text,"ownerActorId" text,"ledgerSequence" text,"entrySha256" text,reason text,purge jsonb)
  CROSS JOIN LATERAL jsonb_to_record(doc.purge) AS purge_doc(
   state text,"planSha256" text,"ledgerSequence" text,trash jsonb)
  CROSS JOIN LATERAL jsonb_to_record(purge_doc.trash) AS trash_doc(
   revision text,"requestId" text,"restoreUntilMs" text,"trashedAtMs" text)
  WHERE t.tenant_id=p_row->>'tenant_id' AND t.conversation_id::text=conversation
   AND t.target->>'table'=p_table AND t.target->>'mode'=p_mode AND t.target->'key'=actual_key
   AND t.state='PLANNED' AND t.xmin=pg_current_xact_id()::xid
   AND s.state='SUPPRESSED' AND doc.state=s.state
   AND doc."ownerActorId"=s.owner_actor_id
   AND (NOT p_row ? 'actor_id' OR p_row->>'actor_id'=s.owner_actor_id)
   AND (p_table<>'meri_objective_source.run_starts' OR p_row#>>'{binding,actorId}'=s.owner_actor_id)
   AND doc."ledgerSequence"=s.ledger_sequence::text
   AND doc."entrySha256"=s.entry_sha256
   AND purge_doc.state IN ('PLANNED','UNKNOWN')
   AND purge_doc."planSha256"=t.plan_sha256
   AND purge_doc."ledgerSequence"=t.ledger_sequence::text
   AND trash_doc.revision ~ '^[1-9][0-9]*$'
   AND doc.reason='conversation-trash:'||(trash_doc."requestId")
   AND (trash_doc."restoreUntilMs")::numeric
       -(trash_doc."trashedAtMs")::numeric=2592000000
   AND (trash_doc."restoreUntilMs")::numeric<=extract(epoch FROM clock_timestamp())*1000
  FOR UPDATE OF t,s
 ) THEN RETURN true; END IF;
 IF p_table='meri_memory.candidates' AND p_mode='candidate' THEN
  RETURN EXISTS (
   SELECT 1 FROM meri_conversations.retention_purge_targets t
   JOIN meri_conversations.retention_subjects s USING (tenant_id,conversation_id)
   WHERE t.tenant_id=p_row->>'tenant_id' AND t.conversation_id::text=conversation
    AND t.target IS NULL AND t.class='meriMemoryCandidates'
    AND t.candidate_id::text=p_row->>'candidate_id'
    AND t.actor_id=p_row->>'proposer_actor_id' AND s.owner_actor_id=t.actor_id
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
 END IF;
 RETURN false;
END $$;
COMMIT;
