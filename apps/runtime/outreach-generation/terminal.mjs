/** A generation that ends before it can publish any draft still owns the Core unit it was claimed for.
 *
 * `apps/worker/conversation/outreach-generation.mjs` settles a unit only after `prepare` has resolved it, so a run that
 * dies earlier (admission, activity-load, runtime preparation, a lost attempt) never calls `failed` and Core keeps the
 * item `sdk_running`: terminal for this run, still counted as an active generation for the tenant. The continuation
 * owner already settles its own units; this is the same closed settlement for the run's own terminal proof.
 *
 * The caller supplies the run's canonical terminal `state`; only a stored `failed` run whose request carries Core's own
 * outreach marker is considered, and `read` must resolve the unit whose request identity matches this exact run before
 * anything is settled. UNKNOWN is preserved: a run whose effect or stop is unresolved settles as `generation_unknown`,
 * never as a success or a failure it cannot prove, so a unit that was already `sdk_completing` stays ambiguous. Core
 * accepts the settlement from any active unit state and answers a replayed settlement with the retained one, so a
 * duplicate or late call is harmless. The candidate invokes this from its existing `reconcileEnded` callback (the
 * AGENTCORE_EXECUTION_ENDED path), which is the terminal point a runner reaches even when `runner/execution/settle` is
 * never called.
 */
import {outreachPromptHint} from '../../../packages/runtime/outreach-generation.mjs';
export function createOutreachTerminalSettlement({load,read,settle,errorCode='generation_unknown'}){
 if([load,read,settle].some(fn=>typeof fn!=='function')||typeof errorCode!=='string')throw Object.assign(Error('OUTREACH_TERMINAL_CONFIGURATION'),{code:'OUTREACH_TERMINAL_CONFIGURATION'});
 return async function settleTerminalOutreach({binding,state,signal}){
  if(state!=='failed')return null;
  const saved=await load({binding,signal}),run=saved?.run,request=saved?.request;
  // A successor turn owns a different request; this run's own terminal failure is the only proof this settlement relies on.
  if(!run||!request||run.state!=='failed'||!outreachPromptHint(request.prompt))return null;
  const selection=await read({binding,run,request,signal});
  if(selection===null)return null;
  return settle({binding,run,selection,errorCode,signal});
 };
}
