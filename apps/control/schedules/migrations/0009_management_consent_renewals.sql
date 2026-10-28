-- MR-04 renewal custody: the schedule-owned management journal also carries the durable renewal decision.
--
-- Additive and minimal. This migration changes NOTHING except the two cancel-specific predicates of 0005 that would
-- otherwise refuse a renewal row: the record/operation predicate and the state/outcome predicate. The key-set CHECK,
-- every identity/hash/state/column CHECK, the primary key, the unique proposal_id, the immutable trigger, the
-- privileges of 0006 and every other byte of 0005 stay exactly as they are. No column, index, table, store or grant
-- is added, and the existing retention class over this table is unchanged.
--
-- The two predicates are located by their OWN definitions in pg_constraint (pg_get_constraintdef), never by a guessed
-- PostgreSQL-generated name, and this migration fails closed unless exactly one of each is found. The 'mode' member is
-- unique to the record/operation predicate and 'approval_required' is unique to the state/outcome predicate; the
-- state/outcome predicate also mentions 'cancel_scheduled_task', which is why that string is NOT a discriminator.
DO $$
DECLARE
 candidate record;
 operation_predicate text[] := ARRAY[]::text[];
 state_predicate text[] := ARRAY[]::text[];
BEGIN
 FOR candidate IN
  SELECT conname, pg_get_constraintdef(oid) AS definition
  FROM pg_constraint
  WHERE conrelid = 'meri_schedules.management_preparations'::regclass AND contype = 'c'
 LOOP
  IF candidate.definition LIKE '%''mode''%' THEN operation_predicate := operation_predicate || candidate.conname; END IF;
  IF candidate.definition LIKE '%approval_required%' THEN state_predicate := state_predicate || candidate.conname; END IF;
 END LOOP;
 IF array_length(operation_predicate,1) IS DISTINCT FROM 1 OR array_length(state_predicate,1) IS DISTINCT FROM 1 THEN
  RAISE EXCEPTION 'MR04_MANAGEMENT_RENEWAL_PREDICATE_NOT_EXACTLY_ONE operation=% state=%', operation_predicate, state_predicate;
 END IF;
 EXECUTE format('ALTER TABLE meri_schedules.management_preparations DROP CONSTRAINT %I', operation_predicate[1]);
 EXECUTE format('ALTER TABLE meri_schedules.management_preparations DROP CONSTRAINT %I', state_predicate[1]);
END $$;
-- The original cancel branch, byte for byte, plus the renewal branch. A renewal record keeps the SAME closed key set
-- as a cancel record: the decision travels inside `request` so the reviewed digest and the decision instant are
-- immutable in the row. `versions` is the exact current RuntimeVersions object when the attended session carries one
-- and null when it does not; a present object is still validated by the custody module and by the SQL object test.
ALTER TABLE meri_schedules.management_preparations
 ADD CONSTRAINT management_preparation_record_operation CHECK ((
  (record->>'operation' = 'cancel_scheduled_task' AND jsonb_typeof(record->'request') = 'object' AND
   record->'request'->>'mode' IN ('pause','delete') AND record->'request'->>'running' = 'leave' AND record->'request'->'runs' = '[]'::jsonb AND
   (record->>'requestSha256') ~ '^[a-f0-9]{64}$' AND jsonb_typeof(record->'scopes') = 'array' AND
   jsonb_array_length(record->'scopes') = 1 AND jsonb_typeof(record->'versions') = 'object')
  OR
  (record->>'operation' = 'renew_routine_consent' AND jsonb_typeof(record->'request') = 'object' AND
   (record->'request'->>'scheduleId') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' AND
   (record->'request'->>'reviewSha256') ~ '^[a-f0-9]{64}$' AND record->'request'->>'decision' = 'approved' AND
   (record->'request'->>'decidedAtMs') ~ '^[0-9]{1,17}$' AND (record->'request'->>'expiresAtMs') ~ '^[0-9]{1,17}$' AND
   (record->>'requestSha256') ~ '^[a-f0-9]{64}$' AND jsonb_typeof(record->'scopes') = 'array' AND
   -- The renewal carries the FULL original scope set of the immutable intent, exactly as the published
   -- ScheduleProjection admits it (1..100 unique scopes) and as Core re-decides the entire canonical set; it is never
   -- truncated to the one current anchor scope. The cancel branch above keeps its own exactly-one rule byte for byte.
   jsonb_array_length(record->'scopes') BETWEEN 1 AND 100 AND
   (jsonb_typeof(record->'versions') = 'object' OR record->'versions' = 'null'::jsonb))
 ) IS TRUE);
-- The original PENDING and FAILED branches and the original cancel PREPARED branch, plus a renewal PREPARED branch
-- that holds the observed window and never a proposal (a renewal dispatches no schedule and allocates no proposal).
ALTER TABLE meri_schedules.management_preparations
 ADD CONSTRAINT management_preparation_state CHECK ((
  (state = 'PENDING' AND outcome IS NULL AND proposal_id IS NULL AND settled_at IS NULL) OR
  (state = 'FAILED' AND proposal_id IS NULL AND settled_at IS NOT NULL AND
   (jsonb_typeof(outcome) = 'object' AND outcome ? 'code' AND outcome - 'code' = '{}'::jsonb AND
    outcome->>'code' IN ('REFUSED','UNAVAILABLE','INVALID_REQUEST','STALE')) IS TRUE) OR
  (state = 'PREPARED' AND settled_at IS NOT NULL AND
   ((proposal_id IS NOT NULL AND
     (jsonb_typeof(outcome) = 'object' AND outcome ?& ARRAY['status','proposal'] AND outcome - ARRAY['status','proposal'] = '{}'::jsonb AND
      outcome->>'status' = 'approval_required' AND outcome->'proposal'->>'operation' = 'cancel_scheduled_task' AND
      outcome->'proposal'->>'proposalId' = proposal_id::text AND
      outcome->'proposal'->'projection'->'owner'->>'tenantId' = tenant_id AND
      outcome->'proposal'->'projection'->'owner'->>'actorId' = actor_id AND
      (CASE WHEN record->'selectedClientId' = 'null'::jsonb THEN (outcome->'proposal'->'projection'->'scopes') = (record->'scopes')
            ELSE (outcome->'proposal'->'projection'->'scopes') @> (record->'scopes') END)) IS TRUE)
    OR
    (proposal_id IS NULL AND record->>'operation' = 'renew_routine_consent' AND
     (jsonb_typeof(outcome) = 'object' AND outcome ?& ARRAY['status','window'] AND outcome - ARRAY['status','window'] = '{}'::jsonb AND
      outcome->>'status' = 'renewed' AND jsonb_typeof(outcome->'window') = 'object' AND
      outcome->'window'->>'state' IN ('active','expired') AND
      (outcome->'window'->>'generation') ~ '^[0-9]{1,17}$' AND (outcome->'window'->>'issuedAtMs') ~ '^[0-9]{1,17}$' AND
      (outcome->'window'->>'expiresAtMs') ~ '^[0-9]{1,17}$' AND (outcome->'window'->>'observedAtMs') ~ '^[0-9]{1,17}$' AND
      jsonb_typeof(outcome->'window'->'idempotent') = 'boolean' AND (outcome->'window'->>'policyRevision') IS NOT NULL) IS TRUE)))
 ) IS TRUE);
