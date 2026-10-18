/** Temporal activity binding for scheduled dispatch. Activities run once per workflow attempt (the workflow sets maximumAttempts 1);
 * the host passes its activity context (Context.current from @temporalio/activity) so cancellation reaches every owner call. */
import {denySchedule} from '../../../packages/contracts/schedules-0.2/lifecycle-validation.mjs';
import {sdkMethod} from './temporal-schedule-mutations.mjs';
export function createScheduledDispatchActivities({dispatch,context}) {
 const run=sdkMethod(dispatch,'dispatch'),reconcile=sdkMethod(dispatch,'reconcile');
 const cancel=Object.hasOwn(dispatch,'cancel')?sdkMethod(dispatch,'cancel'):null;
 if(typeof context!=='function')denySchedule('SCHEDULE_DISPATCH_OPTIONS');
 const bind=method=>async input=>method({occurrence:input?.occurrence,signal:context().cancellationSignal});
 return Object.freeze({dispatchScheduledOccurrence:bind(run),reconcileScheduledOccurrence:bind(reconcile),...(cancel?{cancelScheduledOccurrence:bind(cancel)}:{})});
}
