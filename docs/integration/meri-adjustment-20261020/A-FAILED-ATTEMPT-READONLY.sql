-- Package A: read-only inspection of the failed E attempt (runner task 283f12c53eba4dc89f4d54767d0fa832).
-- Executed by the orchestrator (single AWS operator) through A-FAILED-ATTEMPT-READ-<n>.overrides.json, one RunTask per
-- file, on the existing meri-product-preview-d2-migrate:6 task definition; see A-BASELINE-AND-FAILURE-MAP.md section 4.
-- Every statement is a SELECT inside a READ ONLY transaction that is rolled back; the runner also sets
-- default_transaction_read_only=on and statement_timeout=15s on each connection. No FOR UPDATE, no writes.
-- Each "-- @login <name>" section runs on its own least-privilege login (grants: infra/product-preview/
-- first-chat-database.sql and existing-database-grants.sql). The Aurora master login is never used.
-- Columns and JSON keys come from the migrations and journals at deployed source 2b4421f6:
--   apps/control/conversations/migrations/0001,0002,0004,0006,0007,0008,0011,0015,0017
--   apps/control/conversations/{native-preparation-journal,execution-journal}.mjs
--   apps/gateway/budget/migrations/0001_product_budget.sql, 0002_tenant_budgets.sql
-- Recorded identifiers (CloudWatch worker log, Temporal task token, CloudTrail RunTask):
--   tenant_id        17b63099-bc0f-4ac5-b596-496161e9481e   (workflowId field 1, per temporal-dispatch.mjs:8)
--   conversation_id  13865b0a-b0d0-41de-8c97-c2a2058fa222
--   run_id           c3af3d1d-66bb-46ed-94fc-5a7a87e97ade
--   execution key    2b6358940a46173d56f2a4873b91afd797ef35c53a1c38909a6f1ed7297a8432 (RunTask startedBy/clientToken/tags)
--   expires-at-ms    1792461199753 (2026-10-20T01:53:19.753Z)
-- The \set values below are psql variables; the runner substitutes :'name' the same way.
-- After editing this file, regenerate the overrides: node A-FAILED-ATTEMPT-READ-GENERATE.cjs

\set tenant '17b63099-bc0f-4ac5-b596-496161e9481e'
\set conversation '13865b0a-b0d0-41de-8c97-c2a2058fa222'
\set run 'c3af3d1d-66bb-46ed-94fc-5a7a87e97ade'
\set execution '2b6358940a46173d56f2a4873b91afd797ef35c53a1c38909a6f1ed7297a8432'
\set workflow 'meri:17b63099-bc0f-4ac5-b596-496161e9481e:13865b0a-b0d0-41de-8c97-c2a2058fa222:c3af3d1d-66bb-46ed-94fc-5a7a87e97ade'
\set from '2026-10-20T01:38:00Z'
\set to '2026-10-20T01:56:00Z'

-- @login control
BEGIN TRANSACTION READ ONLY;

-- Q1 Run rows: lifecycle state and binding (attemptId, workerId, writerFence). The request body is omitted.
SELECT tenant_id, conversation_id, run_id, request_id, request_sha256, last_sequence,
       projection->>'state' AS run_state, projection->'binding' AS binding, projection->'versions' AS versions,
       hold_control_id, continuation_sha256, projection_sha256
  FROM meri_conversations.runs
 WHERE tenant_id = :'tenant'
   AND conversation_id = :'conversation'
 ORDER BY run_id;

-- Q2 Ordered run events: the only ordered durable history in this schema besides Temporal.
SELECT run_id, sequence, event_id, event, event_sha256
  FROM meri_conversations.events
 WHERE tenant_id = :'tenant'
   AND conversation_id = :'conversation'
   AND run_id = :'run'
 ORDER BY sequence;

-- Q3 Native allocations, current state only (CLAIMED|ALLOCATED|ADMITTED|UNKNOWN|RETIRED; launchBinding PREPARED|CLAIMED|STARTED|UNKNOWN).
--    All rows of the conversation: another allocation that is not RETIRED with stop proof blocks a new one.
SELECT run_id, intent_key, record->>'state' AS allocation_state,
       record->'resource'->>'taskArn' AS task_arn,
       record->'resource'->'launchBinding' AS launch_binding,
       record->'resource'->'physicalStopProven' AS physical_stop_proven, record_sha256
  FROM meri_conversations.native_allocations
 WHERE intent_key = :'execution'
    OR (tenant_id = :'tenant'
        AND conversation_id = :'conversation');

-- Q4 Native execution journal (phase launching|unknown|started|retired; native.taskId once started).
SELECT run_id, execution_id, record->>'phase' AS phase, record->>'planSha256' AS plan_sha256,
       record->>'expiresAtMs' AS expires_at_ms, record->'native' AS native, record_sha256
  FROM meri_conversations.native_executions
 WHERE execution_id = :'execution'
    OR (tenant_id = :'tenant'
        AND conversation_id = :'conversation');

-- Q5 Task and model grant issuance (claim fence, grant, issue time).
SELECT 'task' AS kind, run_id, issuance_key, state, claim_fence, version, grant_id, expires_at_ms, claimed_at, issued_at, binding
  FROM meri_conversations.run_issuances
 WHERE tenant_id = :'tenant'
   AND conversation_id = :'conversation'
UNION ALL
SELECT 'model', run_id, issuance_key, state, claim_fence, version, grant_id, expires_at_ms, claimed_at, issued_at, binding
  FROM meri_conversations.model_run_issuances
 WHERE tenant_id = :'tenant'
   AND conversation_id = :'conversation';

-- Q6 Initial binding, SDK session mirror (counts only), controls and checkpoints.
SELECT 'initial_run_binding' AS source, run_id, record AS detail
  FROM meri_conversations.initial_run_bindings
 WHERE tenant_id = :'tenant'
   AND conversation_id = :'conversation'
UNION ALL
SELECT 'sdk_session', run_id, jsonb_build_object('session_id', session_id, 'entries_count', entries_count, 'bytes', bytes)
  FROM meri_conversations.sdk_sessions
 WHERE tenant_id = :'tenant'
   AND conversation_id = :'conversation'
UNION ALL
SELECT 'control', run_id, jsonb_build_object('control_id', control_id, 'control_sequence', control_sequence, 'projection', projection)
  FROM meri_conversations.controls
 WHERE tenant_id = :'tenant'
   AND conversation_id = :'conversation'
UNION ALL
SELECT 'checkpoint', run_id, jsonb_build_object('checkpoint_id', checkpoint_id, 'control_id', control_id, 'proof_sha256', proof_sha256)
  FROM meri_conversations.checkpoints
 WHERE tenant_id = :'tenant'
   AND conversation_id = :'conversation';

-- Q7 Model budget run fence/attempt and grants (run_id assumed equal to the binding runId).
SELECT run_id, attempt, worker_arn, fence, policy_revision
  FROM meri_product_budget.runs WHERE run_id = :'run';
SELECT grant_id, run_id, attempt, worker_arn, fence, state, expires_at
  FROM meri_product_budget.grants WHERE run_id = :'run' ORDER BY grant_id;

-- Q8 Tenant reservation (HELD|RELEASED|SETTLED|NOT_DISPATCHED) and tenant cap.
SELECT tenant_id, run_id, month, hold_micro_usd, settled_micro_usd, state, created_at, released_at, settled_at, not_dispatched_at
  FROM meri_product_budget.tenant_run_reservations
 WHERE tenant_id = :'tenant'
   AND (run_id = :'run' OR created_at BETWEEN :'from' AND :'to');
SELECT tenant_id, monthly_cap_micro_usd, max_concurrent_runs
  FROM meri_product_budget.tenant_budgets WHERE tenant_id = :'tenant';

ROLLBACK;

-- @login owner
BEGIN TRANSACTION READ ONLY;

-- Q9 Provider requests (UNKNOWN|SETTLED|NO_DISPATCH): for this run, and any request created in the attempt window.
SELECT request_id, run_id, grant_id, attempt, fence, model_id, input_tokens, max_output_tokens,
       hold_micro_usd, state, actual_micro_usd, created_at, settled_at
  FROM meri_product_budget.requests
 WHERE run_id = :'run'
    OR created_at BETWEEN :'from' AND :'to'
 ORDER BY created_at;

ROLLBACK;

-- @login visibility
BEGIN TRANSACTION READ ONLY;

-- Q10 Temporal visibility row for the workflow (status, close time, history length). Event details need the
--     Temporal frontend with an authorized client identity, which no existing task definition provides.
SELECT * FROM executions_visibility
 WHERE workflow_id = :'workflow';

ROLLBACK;
