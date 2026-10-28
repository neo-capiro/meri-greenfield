/**
 * The schedule app's join to the VERSIONED schedule contract family.
 *
 * The routines/schedule owners validate their schedule tool requests, intents and results with the 0.3
 * family, built by the frozen owners themselves (`schedules-0.3/*`), never re-implemented and never
 * a copied authority. The 0.3 owner is the one that admits an approved `configuration.task.work`
 * definition (and a source-only `policy.sourceTrigger`); the frozen 0.2 owners keep refusing both, so an
 * ordinary schedule without a Work definition is admitted byte-for-byte as before.
 *
 * Two explicit families, no silent widening: a 0.3 intent is only ever admitted by the 0.3 owner. The 0.3
 * validator composition itself lives with that family (`packages/contracts/schedules-0.3/tool-validators.mjs`)
 * and the exact operation-version pins with their selector (`packages/contracts/schedule-operation-family.mjs`),
 * so the worker and the app consume the same owners and this join adds no second build, parser or family
 * constant.
 */
export {scheduleSchema,scheduleToolValidators,validateToolShape} from '../../../packages/contracts/schedules-0.3/tool-validators.mjs';
export {assertScheduleIntent,snapshotScheduleCall,scheduleShape,assertScheduleAuthority,canonicalSha256,
        frozenScheduleData,denySchedule,scheduleErrorCode} from '../../../packages/contracts/schedules-0.3/lifecycle-validation.mjs';
