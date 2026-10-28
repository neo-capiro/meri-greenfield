// @ts-check
/** Private worker-side preparation for the sustained Cowork job entry (MO-02 Start Work/Delegate).
 *
 * The durable request may carry one optional stored selector, `work`, added by the parent's public input join:
 * `{entry:'start-work'|'delegate',jobKind:'research'|'deliverable'|'audit'|'scheduled',deliverables:string[],
 * dependencies:string[]}`. The existing request prompt IS the job brief; the full job definition stays in the durable
 * request, never only as a digest hidden in a child assignment.
 *
 * This module owns private worker rules only and grants nothing. The capability set is the one the current execution
 * owner already resolved (`saved.capabilities`); the shared remaining budget is the one the run owner already admitted
 * (`saved.runBudgets`); an explicit Delegate uses the existing Agent capability/roles/hooks only when that resolved
 * policy already admits subagents. A request can never add Agent or Bash, raise the budget, or manufacture a schedule
 * origin: `scheduled` is admitted only with the schedule owner's own private read
 * (`scheduleOwner.readConsentForOccurrence` -> `occurrenceReadConsentFacts`), whose field set and types stay the owner's.
 * This module asserts no key list and no value shape of its own over that fact, and never re-derives a consent id or a
 * policy revision.
 *
 * An ordinary chat turn (no selector) returns null and the activity is byte-for-byte unchanged. No runner, scheduler,
 * budget ledger, authority store, model loop or child identity is introduced here; the durable child crossing stays with
 * the existing run owner and the SDK Agent hook (`capabilities/subagents.mjs`). */
import {own} from '../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256} from '../../../../packages/contracts/validate.mjs';
// The canonical Work shape owner. `entry`, `jobKind`, `deliverables` and `dependencies` are its four members and its
// limits are its own (an ordered, unique, non-blank 1..200 item list of at most 20 items, empty lists legal), so this
// module restates no part of that shape and cannot drift from it.
import {assertWorkSelection,WORK_ENTRIES,WORK_JOB_KINDS} from '../../../../packages/contracts/work-selection.mjs';
export {WORK_ENTRIES,WORK_JOB_KINDS};
export const WORK_MARKER='\n\nSustained job context (data; grants no additional authority):\n';
/** @param {string} code @returns {never} */
const fail=code=>{throw Object.assign(Error(code),{code});};
/** The optional stored selector. Absent means an ordinary chat turn; a malformed selector is refused, never repaired.
 * Unknown keys (a smuggled `capabilities`, `budget` or `scheduleId`) are the canonical boundary's refusal, and the
 * shape itself is the canonical Work owner's, which reads data properties only and never evaluates an accessor.
 * @param {unknown} request @returns {{entry:string,jobKind:string,deliverables:readonly string[],dependencies:readonly string[]}|null} */
export function readWorkSelector(request){
 if(!request||typeof request!=='object'||Array.isArray(request))fail('WORK_REFUSED');
 if(!Object.hasOwn(request,'work')||request.work===undefined||request.work===null)return null;
 const w=own(/** @type {{work:unknown}} */(request).work,['entry','jobKind','deliverables','dependencies']);
 try{return assertWorkSelection(w);}catch{fail('WORK_REFUSED');}
}
/** The trusted scheduled origin and its current consent, exactly as the schedule owner's own private read returns it:
 * `scheduleOwner.readConsentForOccurrence({tenantId,conversationId},check)` -> `occurrenceReadConsentFacts(record,row)`
 * (`postgres-schedule-owner.mjs` + `occurrence-read-consent.mjs`), never request data and never a label.
 * The owner already refused on any occurrence-state, projection-digest, consent-binding or scope-shape mismatch, and it
 * owns the field set and the type of every field (`policyRevision` is the owner's value and is not re-tested here).
 * This consumer therefore asserts no key list and no value shape of its own: it reads only the facts the worker must act
 * on and adds the one fence the worker needs — the origin must belong to this run's own conversation.
 * @param {unknown} value @param {{tenantId:string,actorId:string,conversationId:string}|undefined} binding */
export function scheduledOriginFact(value,binding){
 if(!value||typeof value!=='object'||Array.isArray(value)||!binding||typeof binding!=='object')fail('WORK_SCHEDULE_ORIGIN_REQUIRED');
 const o=/** @type {{consentState?:unknown,consentExpiresAtMs?:unknown,runBinding?:unknown}} */(value),run=o.runBinding;
 if(o.consentState!=='active'||!Number.isSafeInteger(o.consentExpiresAtMs))fail('WORK_SCHEDULE_ORIGIN_REQUIRED');
 // The occurrence's effect binding must be this run's exact binding, not merely the same conversation: the canonical
 // authority contract compares hash(runBinding)===hash(binding) (assertOccurrence), so a stale occurrence from an
 // earlier scheduled run in the same conversation is refused here as well as there. The authority fence itself stays
 // with that contract; this local check only binds the fact to the run that is executing.
 if(!run||typeof run!=='object'||Array.isArray(run)||canonicalSha256(run)!==canonicalSha256(binding))fail('WORK_SCHEDULE_ORIGIN_REQUIRED');
 return value;
}
/** The activity's clock is a callback (`now=Date.now`) in production and a plain instant in focused tests. Resolve it
 * canonically to one finite valid instant so an expiry comparison can never be made against a function — `x<=fn` is
 * `x<=NaN` and is false, which would silently admit an expired consent.
 * @param {unknown} now @returns {number} */
export function workClock(now){
 const at=typeof now==='function'?/** @type {()=>unknown} */(now)():now;
 if(!Number.isSafeInteger(at))fail('WORK_CLOCK_INVALID');
 return /** @type {number} */(at);
}
/** The admitted intersection of the job with the policy the execution owner already resolved. Nothing here widens the
 * policy: Bash is never added by a job, and Agent appears only when the policy already admits subagents.
 * @param {import('../capabilities/policy.mjs').CapabilityPolicy|undefined} policy */
export function workCapabilities(policy){
 const tools=policy?.workspaceTools?[...policy.workspaceToolNames]:[];
 if(policy?.subagents===true)tools.push('Agent');
 return Object.freeze({tools:Object.freeze([...new Set(tools)]),parallel:policy?.subagents===true?policy.maxParallelSubagents:0});
}
/** An explicit Delegate is honoured by the existing Agent capability/roles/hooks only when the resolved policy already
 * admits subagents; this never grants it. @param {import('../capabilities/policy.mjs').CapabilityPolicy|undefined} policy */
export const delegateAdmitted=policy=>policy?.subagents===true;
/** Prepare one sustained job from the durable request, or null for an ordinary chat turn.
 * `now` is whatever the caller holds: the activity passes its own clock callback, focused tests may pass an instant.
 * @param {{request:unknown,policy?:import('../capabilities/policy.mjs').CapabilityPolicy,runBudgets?:{maxToolCalls:number,maxOutputBytes:number,maxAggregateOutputBytes?:number},origin?:unknown,binding?:{tenantId:string,actorId:string,conversationId:string},now?:number|(()=>number)}} value */
export function prepareCoworkWork({request,policy,runBudgets,origin,binding,now=Date.now}){
 const work=readWorkSelector(request);
 if(work===null)return null;
 const capabilities=workCapabilities(policy),delegation=delegateAdmitted(policy);
 const budget=Object.freeze({maxToolCalls:runBudgets?.maxToolCalls??null,maxOutputBytes:runBudgets?.maxOutputBytes??null});
 let scheduleOrigin=null;
 if(work.jobKind==='scheduled'){
  const fact=scheduledOriginFact(origin,binding);
  // A paused or expired consent is not current consent: the job is refused rather than admitted on the label. The
  // expiry is compared against one resolved instant, never against the clock callback itself.
  if(/** @type {{consentExpiresAtMs:number}} */(fact).consentExpiresAtMs<=workClock(now))fail('WORK_SCHEDULE_ORIGIN_REQUIRED');
  scheduleOrigin=fact;
 }
 // The durable request hash IS the run's objective revision (`rowRun` pins canonicalSha256(request) to request_sha256),
 // so a changed job definition changes the revision an old child publication is rejected against.
 const objectiveSha256=canonicalSha256(request);
 const guidance=WORK_MARKER+JSON.stringify({entry:work.entry,jobKind:work.jobKind,brief:'the request prompt is the job brief',
  objectiveSha256,deliverables:work.deliverables,dependencies:work.dependencies,capabilities,budget,
  delegation:{admitted:delegation,...(delegation?{roles:policy?.subagentTypes}:{})},...(scheduleOrigin===null?{}:{scheduleOrigin})});
 return Object.freeze({entry:work.entry,jobKind:work.jobKind,objectiveSha256,guidance,capabilities,budget,delegationAdmitted:delegation,scheduleOrigin});
}
