-- SOURCE ONLY. Option B read consent reference (lane RD; D016-A item 5; FABLE-RUN-BOUND-READ-DELEGATION-20261018.md section 9).
-- The routine owner's signed-in approval of a routine is also the consent for that routine's READS; Core owns the consent row
-- (meri_read_delegation_consents) and answers every occurrence from it. Meri keeps only the consent REFERENCE and its last state
-- beside the projection it was approved for, so pause, delete and resume can name it: {consentId, state, createdAtMs,
-- expiresAtMs, scheduleProjectionSha256, operationsDigest}. It is never authority and never a credential.
-- One nullable column on the projection row: the projection and intent JSON are canonical-hashed closed shapes and cannot carry
-- it (apps/control/schedules/postgres-schedule-owner.mjs readReadConsent/recordReadConsent). ADD COLUMN only: no existing
-- column, row, index or constraint is altered or dropped. Requires 0001_schedule_owner.sql. Operator-applied only; this file
-- authorizes no SQL execution or live activation.
BEGIN;
ALTER TABLE meri_schedules.projections ADD COLUMN read_consent jsonb
 CONSTRAINT projections_read_consent_shape CHECK (
  read_consent IS NULL OR (
   jsonb_typeof(read_consent) = 'object'
   AND (read_consent->>'consentId') ~ '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'
   AND (read_consent->>'state') IN ('active','paused','revoked')
   AND (read_consent->>'scheduleProjectionSha256') ~ '^[a-f0-9]{64}$'
   AND (read_consent->>'operationsDigest') ~ '^[a-f0-9]{64}$'
   AND jsonb_typeof(read_consent->'createdAtMs') = 'number'
   AND jsonb_typeof(read_consent->'expiresAtMs') = 'number'));
COMMIT;
