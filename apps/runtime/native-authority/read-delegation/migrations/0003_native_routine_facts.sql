-- Native routine current/read facts. Ordinal 53 extends the existing Core facts schema.
-- Canonical hashes are verified by Core; existence of a row grants no authority.
-- These closed projections contain identity, scope, budget and execution metadata only.
-- Do not join request/event/intent payloads: those contain prompts and instructions.
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
COMMIT;
