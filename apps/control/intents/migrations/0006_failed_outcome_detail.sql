-- Assigned intents/0006 forward source only. Preserve 0001-0005 and the non-reusable delivery fence unchanged. The runner
-- owns the transaction. No data is read, rewritten or redacted; no table, column, index, role, privilege or policy changes.
--
-- A FAILED preparation may keep the owner's bounded plain-words detail beside its code (`apps/control/intents/faults.mjs`
-- INTENT_DETAIL_MAX, 400 characters), so a replay of the same delivery answers the same explained refusal and the
-- conversation's card can say what happened. The 0002 outcome CHECK admits a FAILED outcome of exactly {code}: on
-- 2 November 2026 every refusal settled with a detail violated it, the settle UPDATE rolled back and the deliveries stayed
-- PENDING ("Preparing" cards that never ended). The mount now settles the code alone when the explained row is refused;
-- this amendment lets the explained row through.
--
-- Resolve the 0002 outcome CHECK by its exact expression, not by trusting its name alone: parse the unchanged 0002
-- expression on this same relation as a NOT VALID comparison constraint (pg_get_expr removes parser-location differences),
-- require exactly one validated local constraint of that name with that expression, then replace it under the same name.
-- Ambiguity, drift (including an already widened constraint) or a comparison-name collision aborts before any DROP.
DO $$
DECLARE
 outcome_count bigint;
BEGIN
 IF EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='meri_intents.preparations'::regclass AND conname='detail_0006_expected_outcome')
 THEN RAISE EXCEPTION 'INTENT_PREPARATION_0002_SCHEMA_UNVERIFIED'; END IF;
 ALTER TABLE meri_intents.preparations
  ADD CONSTRAINT detail_0006_expected_outcome CHECK (
  (state IN ('PENDING','UNKNOWN') AND outcome IS NULL AND outcome_purged_at IS NULL) OR
  (state = 'FAILED' AND outcome_purged_at IS NULL AND outcome IS NOT NULL AND jsonb_typeof(outcome) = 'object'
   AND outcome ? 'code' AND outcome - 'code' = '{}'::jsonb AND jsonb_typeof(outcome->'code') = 'string'
   AND outcome->>'code' IN ('UNAVAILABLE','ACCESS_DENIED','REFUSED','INVALID_ARGUMENTS','DEADLINE','CANCELLED','CONFLICT','UNKNOWN')) OR
  (state = 'PREPARED' AND outcome_purged_at IS NULL AND outcome IS NOT NULL AND jsonb_typeof(outcome) = 'object'
   AND outcome ?& ARRAY['result','release'] AND outcome - ARRAY['result','release'] = '{}'::jsonb
   AND jsonb_typeof(outcome->'result') = 'object' AND jsonb_typeof(outcome->'release') = 'object'
   AND (outcome->'release') ?& ARRAY['binding','scopes','expiresAtMs']
   AND (outcome->'release') - ARRAY['binding','scopes','expiresAtMs'] = '{}'::jsonb
   AND jsonb_typeof(outcome->'release'->'binding') = 'object'
   AND jsonb_typeof(outcome->'release'->'scopes') = 'array'
   AND jsonb_array_length(outcome->'release'->'scopes') BETWEEN 1 AND 100
   AND jsonb_typeof(outcome->'release'->'expiresAtMs') = 'number') OR
  (state = 'REDACTED' AND outcome IS NULL AND outcome_purged_at IS NOT NULL)
 ) NOT VALID;
 SELECT count(*) INTO outcome_count FROM pg_constraint c
  WHERE c.conrelid='meri_intents.preparations'::regclass AND c.contype='c' AND c.conname='preparations_memory_outcome_check'
   AND c.convalidated AND c.conislocal AND c.coninhcount=0;
 IF outcome_count<>1 OR EXISTS (
  SELECT 1 FROM pg_constraint actual
  JOIN pg_constraint expected ON expected.conrelid=actual.conrelid AND expected.conname='detail_0006_expected_outcome'
  WHERE actual.conrelid='meri_intents.preparations'::regclass AND actual.conname='preparations_memory_outcome_check'
    AND pg_get_expr(actual.conbin,actual.conrelid,false) IS DISTINCT FROM pg_get_expr(expected.conbin,expected.conrelid,false)
 ) THEN RAISE EXCEPTION 'INTENT_PREPARATION_0002_SCHEMA_UNVERIFIED'; END IF;
 ALTER TABLE meri_intents.preparations
  DROP CONSTRAINT preparations_memory_outcome_check,
  DROP CONSTRAINT detail_0006_expected_outcome;
END $$;

-- The same constraint name, so a later amendment resolves it the same way. Only the FAILED branch changes: an optional
-- `detail` string of 1..400 characters beside `code`; nothing else may appear. Every existing row satisfies the stricter 0002
-- predicate, so validation on ADD scans without rejecting a row.
ALTER TABLE meri_intents.preparations
 ADD CONSTRAINT preparations_memory_outcome_check CHECK (
  (state IN ('PENDING','UNKNOWN') AND outcome IS NULL AND outcome_purged_at IS NULL) OR
  (state = 'FAILED' AND outcome_purged_at IS NULL AND outcome IS NOT NULL AND jsonb_typeof(outcome) = 'object'
   AND outcome ? 'code' AND outcome - ARRAY['code','detail'] = '{}'::jsonb AND jsonb_typeof(outcome->'code') = 'string'
   AND outcome->>'code' IN ('UNAVAILABLE','ACCESS_DENIED','REFUSED','INVALID_ARGUMENTS','DEADLINE','CANCELLED','CONFLICT','UNKNOWN')
   AND (NOT outcome ? 'detail' OR (jsonb_typeof(outcome->'detail') = 'string' AND length(outcome->>'detail') BETWEEN 1 AND 400))) OR
  (state = 'PREPARED' AND outcome_purged_at IS NULL AND outcome IS NOT NULL AND jsonb_typeof(outcome) = 'object'
   AND outcome ?& ARRAY['result','release'] AND outcome - ARRAY['result','release'] = '{}'::jsonb
   AND jsonb_typeof(outcome->'result') = 'object' AND jsonb_typeof(outcome->'release') = 'object'
   AND (outcome->'release') ?& ARRAY['binding','scopes','expiresAtMs']
   AND (outcome->'release') - ARRAY['binding','scopes','expiresAtMs'] = '{}'::jsonb
   AND jsonb_typeof(outcome->'release'->'binding') = 'object'
   AND jsonb_typeof(outcome->'release'->'scopes') = 'array'
   AND jsonb_array_length(outcome->'release'->'scopes') BETWEEN 1 AND 100
   AND jsonb_typeof(outcome->'release'->'expiresAtMs') = 'number') OR
  (state = 'REDACTED' AND outcome IS NULL AND outcome_purged_at IS NOT NULL)
 );
