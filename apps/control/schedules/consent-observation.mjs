/** MR-04 visibility: the truthful read-consent observation of the current routines list rows.
 *
 * W5-02 MR-04 requires "routine active, read consent unresolved/expired" to be exposed DISTINCTLY from a successful
 * unattended read. The schedule owner's `list` inspects the projection, the current generation, the unresolved
 * generation and Temporal — it observes no consent at all. This helper adds that observation to the exact rows the
 * public list already returned, from Core's own stored consent, without writing anything, without creating a consent
 * or a revocation, and without touching the existing fail-closed firing/read refusals.
 *
 * Three rules are the whole point of the module:
 *  1. Unknown is not absence. A refused, unavailable or malformed observation, and a row whose current generation has
 *     no acknowledged intent to pin, answer `unknown` with nothing else filled in. Only Core's own `absent` — a
 *     statement about a row it could look for — may ever be reported as `absent`.
 *  2. `pinsMatched: false` is stale, never a no-consent declaration. Core answers it when the newest stored consent
 *     for this owner and schedule does not pin the generation/intent/projection the caller sent (and, when it carries
 *     a `consentGeneration`, when a stored row exists that simply is not the requested one). The caller re-reads the
 *     current pins from the schedule owner once and asks again; if the pins did not move, or the second answer still
 *     does not pin them, the row stays `unknown` with `stale: true`. It is never downgraded to `absent`.
 *  3. Observed expiry is consent state, not scheduling state. `expiresAtMs`/`issuedAtMs`/`scopeCount` are Core's own
 *     row values under Core's own database clock; they never replace or reinterpret the projection's `state`, and an
 *     unattended read that succeeded says nothing about consent. Both are reported side by side and neither is derived
 *     from the other.
 *
 * The intent digest is never reconstructed from browser fields or from a hash: the current acknowledged immutable
 * intent is read through the schedule owner's existing `readFiring` selection (the same read the firing path uses),
 * which returns the projection, the current generation and the acknowledged intent only when the stored digest, the
 * generation and the projection digest all agree.
 */
import {data} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';

const hex=/^[a-f0-9]{64}$/u;
const states=new Set(['active','expired','revoked','absent']),causes=new Set(['revocation','membership','client-scope']);
/** The closed observation facet. Every key is always present; nothing private (no scope payload, no consent id). */
const empty=(state,generation)=>({state,pinsMatched:false,stale:false,observedAtMs:null,generation,consentGeneration:null,
 issuedAtMs:null,expiresAtMs:null,scopeCount:null,cause:null,rightsSha256:null});
/** Core's closed answer, or null when it is not the exact eleven members. */
function answer(value){
 try{
  const r=data(value);if(!r||typeof r!=='object')return null;
  const keys=Object.keys(r);if(keys.length!==11||!['schemaVersion','state','pinsMatched','observedAtMs','generation','consentGeneration','issuedAtMs','expiresAtMs','scopeCount','cause','rightsSha256'].every(k=>keys.includes(k)))return null;
  if(r.schemaVersion!==1||!states.has(r.state)||typeof r.pinsMatched!=='boolean'||!Number.isSafeInteger(r.observedAtMs)||r.observedAtMs<0||!Number.isSafeInteger(r.generation)||r.generation<1)return null;
  if(!(r.consentGeneration===null||Number.isSafeInteger(r.consentGeneration)&&r.consentGeneration>=1)||!(r.issuedAtMs===null||Number.isSafeInteger(r.issuedAtMs))||
   !(r.expiresAtMs===null||Number.isSafeInteger(r.expiresAtMs))||!(r.scopeCount===null||Number.isSafeInteger(r.scopeCount)&&r.scopeCount>=0))return null;
  if(!(r.cause===null||causes.has(r.cause))||!(r.rightsSha256===null||typeof r.rightsSha256==='string'&&hex.test(r.rightsSha256)))return null;
  if(r.state==='active'&&(r.pinsMatched!==true||r.rightsSha256===null||r.expiresAtMs===null||r.consentGeneration===null))return null;
  if(r.state!=='active'&&r.rightsSha256!==null)return null;
  return r;
 }catch{return null;}
}
/** The facet of a row that could not be observed at all: `unknown`, and nothing else claimed. A caller that explicitly
 *  asked for the observation is told that no observation is available — never that this owner has no consent. */
export function unobserved(row){return empty('unknown',Number.isSafeInteger(row?.generation)&&row.generation>=1?row.generation:1);}
/** Core's answer as the closed facet. `unknown` is the only answer for anything this module cannot read as itself. */
export function consentFacet(value,generation){
 const r=answer(value);if(r===null)return empty('unknown',generation);
 const carried={state:r.state,pinsMatched:r.pinsMatched,stale:false,observedAtMs:r.observedAtMs,generation:r.generation,
  consentGeneration:r.consentGeneration,issuedAtMs:r.issuedAtMs,expiresAtMs:r.expiresAtMs,scopeCount:r.scopeCount,cause:r.cause,rightsSha256:r.rightsSha256};
 // A stored consent that does not pin this request is a re-read, never a declaration that the owner has no consent.
 if(r.state==='absent'&&r.consentGeneration!==null)return {...carried,state:'unknown',stale:true,rightsSha256:null};
 return carried;
}
/** The exact pins the observation needs, from the owner's own current acknowledged intent. Null when there is none. */
export function consentPins(firing,tenantId,scheduleId){
 if(firing===null||firing===undefined)return null;
 const projection=data(firing.projection),generation=firing.generation,intent=data(firing.intent);
 if(!Number.isSafeInteger(generation)||generation<1||intent===null||intent===undefined)return null;
 if(!projection||typeof projection!=='object'||projection.scheduleId!==scheduleId||!projection.owner||projection.owner.tenantId!==tenantId)return null;
 if(intent.intentId===undefined||intent.projection===undefined||intent.generation!==generation||hash(intent.projection)!==hash(projection))return null;
 return {tenantId,ownerActorId:projection.owner.actorId,scheduleId,generation,intentSha256:hash(intent),projectionSha256:hash(projection)};
}
const samePins=(a,b)=>a!==null&&b!==null&&a.generation===b.generation&&a.intentSha256===b.intentSha256&&a.projectionSha256===b.projectionSha256;
/** `{observe, readFiring}`: `observe` is the live Core wire D port, `readFiring` the schedule owner's own
 *  current-intent read selection. Both are borrowed; nothing here creates a client, a consent or a revocation. */
export function createRoutineConsentObservation(configuration){
 const {observe,readFiring}=configuration??{};
 if(typeof observe!=='function'||typeof readFiring!=='function')throw TypeError('ROUTINES_CONSENT_OBSERVATION_CONFIGURATION');
 const pins=async(principal,scheduleId,check)=>consentPins(await readFiring({tenantId:principal.tenantId,scheduleId},check),principal.tenantId,scheduleId);
 const ask=async value=>{try{return consentFacet(await observe(value),value.generation);}catch{return empty('unknown',value.generation);}};
 /** One row: the exact current pins, Core's answer, and — only when Core says a stored row does not pin them — a
  *  single re-read of the owner's current pins and one more ask. The bound is one retry: this never loops. */
 const one=async({principal,scheduleId,generation,signal,deadlineMs,check})=>{
  const exact=await pins(principal,scheduleId,check);if(exact===null)return empty('unknown',generation);
  const first=await ask({...exact,signal,deadlineMs});if(!first.stale)return first;
  const again=await pins(principal,scheduleId,check);
  if(again===null||samePins(exact,again))return first;
  return await ask({...again,signal,deadlineMs});
 };
 /** The public list rows, each with its own observation. Rows are observed in order and never re-ordered. */
 const observeRows=async({rows,principal,signal,deadlineMs,check})=>{
  if(!Array.isArray(rows))return rows;
  const out=[];
  for(const row of rows){
   const scheduleId=row?.projection?.scheduleId,generation=Number.isSafeInteger(row?.generation)&&row.generation>=1?row.generation:1;
   out.push(typeof scheduleId==='string'?{...row,consent:await one({principal,scheduleId,generation,signal,deadlineMs,check})}:{...row,consent:unobserved(row)});
  }
  return out;
 };
 return Object.freeze({one,observe:observeRows});
}
