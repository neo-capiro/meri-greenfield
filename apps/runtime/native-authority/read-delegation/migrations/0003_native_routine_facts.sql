-- Native routine current/read facts. Ordinal 53 extends the existing Core facts schema.
-- Canonical hashes are verified by Core; existence of a row grants no authority.
-- These closed projections contain identity, scope, budget and execution metadata only.
-- Never expose request/event/intent payloads: those contain prompts and instructions.
-- The existing migrator owns the view and base tables. Core receives SELECT only on
-- this view, without access to Meri's schemas, base tables, writes or owner role.
BEGIN;
CREATE VIEW meri_read_delegation_facts.routine_runs_v1 WITH (security_barrier = true) AS
SELECT p.tenant_id,
       p.schedule_id,
       o.occurrence_key,
       p.owner_actor_id,
       p.generation,
       p.projection,
       p.projection_sha256,
       p.active_intent,
       o.occurrence,
       o.effect,
       o.effect_sha256,
       o.state AS occurrence_state,
       r.projection AS run_projection,
       r.projection_sha256 AS run_projection_sha256,
       e.record AS execution_record,
       e.record_sha256 AS execution_record_sha256,
       e.execution_key,
       e.execution_id,
       NOT EXISTS (
         SELECT 1 FROM meri_conversations.runs newer
          WHERE newer.tenant_id = r.tenant_id AND newer.conversation_id = r.conversation_id
            AND (newer.projection#>>'{binding,writerFence}')::numeric > (r.projection#>>'{binding,writerFence}')::numeric
       ) AS current_writer,
       NOT EXISTS (
         SELECT 1 FROM meri_conversations.next_runs successor
          WHERE successor.tenant_id = r.tenant_id AND successor.conversation_id = r.conversation_id
            AND successor.source_run_id = r.run_id
       ) AS no_successor
  FROM meri_schedules.projections p
  JOIN meri_schedules.occurrences o ON o.tenant_id = p.tenant_id AND o.schedule_id = p.schedule_id
  JOIN meri_conversations.runs r ON r.tenant_id = o.tenant_id
    AND r.conversation_id::text = o.effect->'binding'->>'conversationId'
    AND r.run_id::text = o.effect->'binding'->>'runId'
  JOIN meri_conversations.native_executions e ON e.tenant_id = r.tenant_id
    AND e.conversation_id = r.conversation_id AND e.run_id = r.run_id;
REVOKE ALL ON TABLE meri_read_delegation_facts.routine_runs_v1 FROM PUBLIC;
GRANT SELECT ON TABLE meri_read_delegation_facts.routine_runs_v1 TO capiro_app;

-- Every run remains visible, including incomplete/foreign steps, so the Core owner
-- can reject an ambiguous chain. Private requests/files participate only in equality
-- checks. The runtime separately validates the full canonical journal hashes.
CREATE VIEW meri_read_delegation_facts.routine_resume_steps_v1 WITH (security_barrier = true) AS
SELECT o.tenant_id, o.schedule_id, o.occurrence_key, r.conversation_id, r.run_id,
       r.projection AS run_projection, r.projection_sha256 AS run_projection_sha256, r.request_sha256,
       e.record AS execution_record, e.record_sha256 AS execution_record_sha256, e.execution_key, e.execution_id,
       i.allocation AS initial_input, i.allocation_sha256 AS initial_input_sha256,
       i.state AS initial_input_state, i.accepted_request_sha256,
       CASE WHEN r.continuation IS NULL THEN NULL ELSE jsonb_build_object(
         'kind',r.continuation#>'{continuation,kind}', 'mode',r.continuation#>'{continuation,mode}',
         'controlId',r.continuation#>'{continuation,controlId}', 'sdkSession',r.continuation#>'{continuation,sdkSession}',
         'versions',r.continuation#>'{continuation,versions}', 'scopes',r.continuation#>'{continuation,scopes}',
         'sourceRequestSha256',r.continuation#>'{continuation,sourceRequestSha256}',
         'contextSha256',r.continuation#>'{continuation,contextSha256}', 'targetSessionId',r.continuation#>'{continuation,targetSessionId}') END AS continuation,
       CASE WHEN c.control_id IS NULL THEN NULL ELSE jsonb_build_object(
         'input',jsonb_build_object('controlId',c.projection#>'{input,controlId}','intent',c.projection#>'{input,intent}',
           'checkpointId',c.projection#>'{input,checkpointId}','checkpointSha256',c.projection#>'{input,checkpointSha256}'),
         'inputSha256',c.projection->'inputSha256', 'sourceBinding',c.projection->'sourceBinding',
         'scopes',c.projection->'scopes', 'sourceSelectedClientId',c.projection->'sourceSelectedClientId',
         'sourceRequestSha256',c.projection->'sourceRequestSha256', 'contextSha256',c.projection->'contextSha256',
         'versions',c.projection->'versions', 'captureSequence',c.projection->'captureSequence',
         'state',c.projection->'state', 'checkpointId',c.projection->'checkpointId',
         'target',CASE WHEN c.projection->'target' IS NULL OR c.projection->'target'='null'::jsonb THEN NULL ELSE jsonb_build_object(
           'binding',c.projection#>'{target,binding}','scopes',c.projection#>'{target,scopes}',
           'selectedClientId',c.projection#>'{target,selectedClientId}','admissionReceiptId',c.projection#>'{target,admissionReceiptId}',
           'targetSessionId',c.projection#>'{target,targetSessionId}','expiresAtMs',c.projection#>'{target,expiresAtMs}',
           'versions',coalesce(c.projection#>'{target,versions}',c.projection->'versions')) END,
         'retirement',CASE WHEN c.projection->'retirement' IS NULL OR c.projection->'retirement'='null'::jsonb THEN NULL ELSE jsonb_build_object(
           'binding',c.projection#>'{retirement,binding}','retirementReceiptId',c.projection#>'{retirement,retirementReceiptId}',
           'expiresAtMs',c.projection#>'{retirement,expiresAtMs}') END) END AS control,
       coalesce(parent.request=r.continuation->'sourceRequest' AND parent.request=c.projection->'sourceRequest'
         AND parent.request_sha256=c.projection->>'sourceRequestSha256'
         AND parent.request_sha256=r.continuation#>>'{continuation,sourceRequestSha256}',false) AS source_request_matches,
       coalesce((r.request-'requestId')=(parent.request-'requestId'),false) AS target_request_matches,
       coalesce(c.projection#>>'{proof,kind}'='native-session'
         AND c.projection#>'{proof,sdkSession}'=r.continuation#>'{continuation,sdkSession}'
         AND coalesce(c.projection#>'{proof,files}','null'::jsonb)=coalesce(r.continuation#>'{continuation,files}','null'::jsonb)
         AND c.projection#>'{proof,versions}'=r.continuation#>'{continuation,versions}'
         AND c.projection#>'{proof,scopes}'=r.continuation#>'{continuation,scopes}'
         AND c.projection#>'{proof,sourceRequestSha256}'=r.continuation#>'{continuation,sourceRequestSha256}'
         AND c.projection#>'{proof,contextSha256}'=r.continuation#>'{continuation,contextSha256}'
         AND c.projection->'checkpointId'=c.projection#>'{proof,checkpointId}'
         AND c.projection#>'{input,checkpointId}'=c.projection#>'{proof,checkpointId}'
         AND c.projection#>'{input,checkpointSha256}'=c.projection#>'{proof,checkpointSha256}',false) AS proof_matches,
       coalesce(parent.sequence_end=parent.sequence_base+parent.last_sequence AND r.sequence_base=parent.sequence_end,false) AS sequence_contiguous,
       coalesce((SELECT jsonb_agg(jsonb_build_object('controlId',outgoing.control_id,'intent',outgoing.projection#>'{input,intent}',
           'state',outgoing.projection->'state','targetBinding',outgoing.projection#>'{target,binding}',
           'retirementBinding',outgoing.projection#>'{retirement,binding}') ORDER BY outgoing.control_sequence)
          FROM meri_conversations.controls outgoing WHERE outgoing.tenant_id=r.tenant_id AND outgoing.conversation_id=r.conversation_id
            AND outgoing.run_id=r.run_id AND outgoing.projection#>>'{input,intent}' IN ('resume','fork')),'[]'::jsonb) AS outgoing_controls,
       n.reservation AS next_run_reservation, n.reservation_sha256 AS next_run_reservation_sha256, n.state AS next_run_state
  FROM meri_schedules.occurrences o
  JOIN meri_conversations.runs r ON r.tenant_id=o.tenant_id AND r.conversation_id::text=o.effect#>>'{binding,conversationId}'
  LEFT JOIN meri_conversations.native_executions e ON e.tenant_id=r.tenant_id AND e.conversation_id=r.conversation_id AND e.run_id=r.run_id
  LEFT JOIN meri_conversations.initial_inputs i ON i.tenant_id=r.tenant_id AND i.conversation_id=r.conversation_id AND i.run_id=r.run_id
  LEFT JOIN meri_conversations.runs parent ON parent.tenant_id=r.tenant_id AND parent.conversation_id=r.conversation_id
    AND parent.run_id::text=r.continuation#>>'{continuation,sdkSession,binding,runId}'
  LEFT JOIN meri_conversations.controls c ON c.tenant_id=r.tenant_id AND c.conversation_id=r.conversation_id
    AND c.run_id=parent.run_id AND c.control_id::text=r.continuation#>>'{continuation,controlId}'
  LEFT JOIN meri_conversations.next_runs n ON n.tenant_id=r.tenant_id AND n.conversation_id=r.conversation_id AND n.source_run_id=r.run_id;
REVOKE ALL ON TABLE meri_read_delegation_facts.routine_resume_steps_v1 FROM PUBLIC;
GRANT SELECT ON TABLE meri_read_delegation_facts.routine_resume_steps_v1 TO capiro_app;
COMMIT;
