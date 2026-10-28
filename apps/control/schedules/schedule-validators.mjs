/**
 * The schedule app's join to the VERSIONED schedule contract family.
 *
 * The routines request/response family (`RoutinesPrepare/Approve/List/Reconcile` in
 * intents-application) resolves the schedule tool interface at `0.3.0`, and the 0.3 lifecycle
 * owner is the one that admits an approved `policy.sourceTrigger` (source-only policy) while the
 * frozen 0.2 owners keep refusing it. So the routines/schedule owners validate their
 * requests, intents, proposals and results with the 0.3 family — built here by the frozen owners
 * themselves (`schedules-0.3/*`), never re-implemented, and never a copied authority.
 *
 * The frozen 0.2 family stays reachable for the shapes that were deliberately pinned to it: the
 * Intents 0.1 `schedule_review` item and journal rows recorded before this join. Two explicit
 * families, no silent widening: a 0.3 intent is only ever admitted by the 0.3 owner, and the 0.2
 * owners keep refusing the new selector byte-for-byte as before.
 */
import {scheduleToolValidators as currentScheduleToolValidators,validateToolShape as currentValidateToolShape}
  from '../../../packages/contracts/schedules-0.3/tool-validators.mjs';
import {scheduleToolValidators as legacyScheduleToolValidators} from '../../../packages/contracts/retrieval-0.2/validate.mjs';
import {CURRENT_SCHEDULE_OPERATION_VERSION,LEGACY_SCHEDULE_OPERATION_VERSION,SCHEDULE_OPERATION_VERSIONS as FAMILY_OPERATION_VERSIONS,
  scheduleOperationDeclared,scheduleOperationFamily} from '../../../packages/contracts/schedule-operation-family.mjs';

/** The exact family pin this app's routines deliveries are prepared and recorded under. The routines request/response
 * family resolves the schedule tool interface at `0.3.0`, so a routines delivery is recorded under that pin and the
 * journal, the intent port and the custody read each select that same family from the recorded pin. */
export const ROUTINES_OPERATION_VERSION = CURRENT_SCHEDULE_OPERATION_VERSION;
/** The retained pin, still declared by the family owner and still admitted for rows recorded before this join. */
export const LEGACY_OPERATION_VERSION = LEGACY_SCHEDULE_OPERATION_VERSION;
export const SOURCE_TRIGGER_OPERATION_VERSION = ROUTINES_OPERATION_VERSION;
export const SCHEDULE_OPERATION_VERSIONS = FAMILY_OPERATION_VERSIONS;
/** 0.3 tool validators over the frozen 0.3 schemas — the current routines/schedule family, one owner with the journal. */
export const scheduleToolValidators = currentScheduleToolValidators;
/** 0.3 tool-schema `$defs` validator — the same single owner, so a receipt or a request is never checked against a
 *  different family than the one that produced it. */
export const validateToolShape = currentValidateToolShape;
/** The frozen 0.2 tool validators, still resolvable for the deliberately legacy shapes; the family owner's own
 *  exact-pin selection is re-exported so no consumer restates the pin set. */
export {legacyScheduleToolValidators,scheduleOperationDeclared,scheduleOperationFamily};
export {assertScheduleIntent, snapshotScheduleCall, scheduleShape, assertScheduleAuthority, canonicalSha256, frozenScheduleData, denySchedule,
        scheduleErrorCode} from '../../../packages/contracts/schedules-0.3/lifecycle-validation.mjs';
