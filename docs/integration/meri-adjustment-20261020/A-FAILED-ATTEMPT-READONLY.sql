-- Package A: read-only inspection of the failed E attempt (runner task 283f12c53eba4dc89f4d54767d0fa832).
-- For the shipper (dot) to run with an EXISTING authorized reader only. Do not create new access for this.
-- Every statement is a SELECT inside a READ ONLY transaction that is rolled back. No FOR UPDATE, no writes.
-- Columns and JSON keys come from the migrations and journals at deployed source 2b4421f6:
--   apps/control/conversations/migrations/0001,0002,0004,0006,0007,0008,0011,0015,0017
--   apps/control/conversations/{native-preparation-journal,execution-journal}.mjs
--   apps/gateway/budget/migrations/0001_product_budget.sql, 0002_tenant_budgets.sql
-- Schema meri_conversations is read by the control role; meri_product_budget by the model-owner role.
-- A reader may need both roles, or run sections 1-6 and 7-8 separately.
--
-- Recorded identifiers (CloudWatch worker log, Temporal task token, CloudTrail RunTask):
--   tenant_id        17b63099-bc0f-4ac5-b596-496161e9481e   (workflowId field 1, per temporal-dispatch.mjs:8)
--   conversation_id  13865b0a-b0d0-41de-8c97-c2a2058fa222
--   run_id           c3af3d1d-66bb-46ed-94fc-5a7a87e97ade
--   execution key    2b6358940a46173d56f2a4873b91afd797ef35c53a1c38909a6f1ed7297a8432 (RunTask startedBy/clientToken/tags)
--   plan sha256      8468284d23a5509356d7b70a53a5aabc2e7f4613bf84e278f930208138bc81bc
--   expires-at-ms    1792461199753 (2026-10-20T01:53:19.753Z)

BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout = '15s';

-- 1. Run row: lifecycle state, binding (attemptId, workerId, writerFence), request identity, last event sequence.
SELECT tenant_id, conversation_id, run_id, request_id, request_sha256, last_sequence,
       projection->>'state'        AS run_state,
       projection->'binding'       AS binding,
       projection->'versions'      AS versions,
       hold_control_id, continuation_sha256, projection_sha256
  FROM meri_conversations.runs
 WHERE tenant_id = '17b63099-bc0f-4ac5-b596-496161e9481e'
   AND conversation_id = '13865b0a-b0d0-41de-8c97-c2a2058fa222'
 ORDER BY run_id;

-- 2. Ordered run events (the only ordered durable history in this schema besides Temporal).
SELECT run_id, sequence, event_id, event, event_sha256
  FROM meri_conversations.events
 WHERE tenant_id = '17b63099-bc0f-4ac5-b596-496161e9481e'
   AND conversation_id = '13865b0a-b0d0-41de-8c97-c2a2058fa222'
   AND run_id = 'c3af3d1d-66bb-46ed-94fc-5a7a87e97ade'
 ORDER BY sequence;

-- 3. Native allocation (CURRENT state only; previous states are not retained).
--    state: CLAIMED|ALLOCATED|ADMITTED|UNKNOWN|RETIRED; resource.launchBinding.state: PREPARED|CLAIMED|STARTED|UNKNOWN
SELECT tenant_id, conversation_id, run_id, intent_key,
       record->>'state'                                   AS allocation_state,
       record->'resource'->>'taskArn'                     AS task_arn,
       record->'resource'->'launchBinding'                AS launch_binding,
       record->'resource'->'launchBinding'->>'state'      AS launch_state,
       record->'resource'->'physicalStopProven'           AS physical_stop_proven,
       record_sha256
  FROM meri_conversations.native_allocations
 WHERE intent_key = '2b6358940a46173d56f2a4873b91afd797ef35c53a1c38909a6f1ed7297a8432'
    OR (tenant_id = '17b63099-bc0f-4ac5-b596-496161e9481e'
        AND conversation_id = '13865b0a-b0d0-41de-8c97-c2a2058fa222');

-- 4. Native execution journal (phase: launching|unknown|started|retired; native.taskId once started).
SELECT tenant_id, conversation_id, run_id, execution_key, execution_id,
       record->>'phase'        AS phase,
       record->>'planSha256'   AS plan_sha256,
       record->>'expiresAtMs'  AS expires_at_ms,
       record->'native'        AS native,
       record_sha256
  FROM meri_conversations.native_executions
 WHERE execution_id = '2b6358940a46173d56f2a4873b91afd797ef35c53a1c38909a6f1ed7297a8432'
    OR (tenant_id = '17b63099-bc0f-4ac5-b596-496161e9481e'
        AND conversation_id = '13865b0a-b0d0-41de-8c97-c2a2058fa222');

-- 5. Task and model grant issuance (claim fence, grant id, issued time).
SELECT 'task' AS kind, issuance_key, state, claim_fence, version, grant_id, capability_sha256,
       expires_at_ms, claimed_at, issued_at, binding
  FROM meri_conversations.run_issuances
 WHERE tenant_id = '17b63099-bc0f-4ac5-b596-496161e9481e'
   AND conversation_id = '13865b0a-b0d0-41de-8c97-c2a2058fa222'
UNION ALL
SELECT 'model', issuance_key, state, claim_fence, version, grant_id, capability_sha256,
       expires_at_ms, claimed_at, issued_at, binding
  FROM meri_conversations.model_run_issuances
 WHERE tenant_id = '17b63099-bc0f-4ac5-b596-496161e9481e'
   AND conversation_id = '13865b0a-b0d0-41de-8c97-c2a2058fa222';

-- 6. Initial binding, SDK session mirror and checkpoints/controls for this run.
SELECT 'initial_run_binding' AS source, run_id, record AS detail
  FROM meri_conversations.initial_run_bindings
 WHERE tenant_id = '17b63099-bc0f-4ac5-b596-496161e9481e'
   AND conversation_id = '13865b0a-b0d0-41de-8c97-c2a2058fa222'
UNION ALL
SELECT 'sdk_session', run_id,
       jsonb_build_object('session_id', session_id, 'entries_count', entries_count, 'bytes', bytes)
  FROM meri_conversations.sdk_sessions
 WHERE tenant_id = '17b63099-bc0f-4ac5-b596-496161e9481e'
   AND conversation_id = '13865b0a-b0d0-41de-8c97-c2a2058fa222'
UNION ALL
SELECT 'control', run_id, jsonb_build_object('control_id', control_id, 'control_sequence', control_sequence, 'projection', projection)
  FROM meri_conversations.controls
 WHERE tenant_id = '17b63099-bc0f-4ac5-b596-496161e9481e'
   AND conversation_id = '13865b0a-b0d0-41de-8c97-c2a2058fa222'
UNION ALL
SELECT 'checkpoint', run_id, jsonb_build_object('checkpoint_id', checkpoint_id, 'control_id', control_id, 'proof_sha256', proof_sha256)
  FROM meri_conversations.checkpoints
 WHERE tenant_id = '17b63099-bc0f-4ac5-b596-496161e9481e'
   AND conversation_id = '13865b0a-b0d0-41de-8c97-c2a2058fa222';

-- 6b. Other allocations in the same conversation (the preparation journal refuses a new allocation while any
--     other allocation in the conversation is not RETIRED with physicalStopProven=true).
SELECT run_id, record->>'state' AS allocation_state, record->'resource'->'physicalStopProven' AS physical_stop_proven
  FROM meri_conversations.native_allocations
 WHERE tenant_id = '17b63099-bc0f-4ac5-b596-496161e9481e'
   AND conversation_id = '13865b0a-b0d0-41de-8c97-c2a2058fa222';

ROLLBACK;

BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout = '15s';

-- 7. Model budget: run fence/attempt, grants, provider requests (UNKNOWN|SETTLED|NO_DISPATCH).
--    run_id is assumed to equal the binding runId; if no row matches, use the time-window query 7c.
SELECT run_id, attempt, worker_arn, fence, policy_revision
  FROM meri_product_budget.runs WHERE run_id = 'c3af3d1d-66bb-46ed-94fc-5a7a87e97ade';
SELECT grant_id, run_id, attempt, worker_arn, fence, state, expires_at, capability_sha256
  FROM meri_product_budget.grants WHERE run_id = 'c3af3d1d-66bb-46ed-94fc-5a7a87e97ade' ORDER BY grant_id;
SELECT request_id, grant_id, attempt, fence, model_id, profile_id, input_tokens, max_output_tokens,
       hold_micro_usd, state, actual_micro_usd, created_at, settled_at
  FROM meri_product_budget.requests WHERE run_id = 'c3af3d1d-66bb-46ed-94fc-5a7a87e97ade' ORDER BY created_at;
-- 7c. Any provider request created during the attempt window, whatever its run id.
SELECT request_id, run_id, grant_id, state, hold_micro_usd, actual_micro_usd, created_at, settled_at
  FROM meri_product_budget.requests
 WHERE created_at BETWEEN '2026-10-20T01:38:00Z' AND '2026-10-20T01:56:00Z'
 ORDER BY created_at;

-- 8. Tenant reservation (HELD|RELEASED|SETTLED|NOT_DISPATCHED) and tenant cap.
SELECT tenant_id, run_id, month, hold_micro_usd, settled_micro_usd, state, created_at, released_at, settled_at, not_dispatched_at
  FROM meri_product_budget.tenant_run_reservations
 WHERE tenant_id = '17b63099-bc0f-4ac5-b596-496161e9481e'
   AND (run_id = 'c3af3d1d-66bb-46ed-94fc-5a7a87e97ade' OR created_at BETWEEN '2026-10-20T01:38:00Z' AND '2026-10-20T01:56:00Z');
SELECT tenant_id, monthly_cap_micro_usd, max_concurrent_runs
  FROM meri_product_budget.tenant_budgets WHERE tenant_id = '17b63099-bc0f-4ac5-b596-496161e9481e';

ROLLBACK;
