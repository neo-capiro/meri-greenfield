/** The canonical `authority` port `createIntentResultRelease` (`result-release.mjs`) validates, for ONE run's intent mount.
 * `createIntentResultRelease` checks a supplied receipt; it is not the authority. This owner is that authority, composed only
 * from current trusted owners and recomputed on the initial capture AND on every replayed release (dot item 6):
 *
 *  - run:    `currentRun(binding,{signal})` -> the admitted-run owner's JSON `{binding,policyRevision,deadlineMs,checkedAtMs}`
 *            (`createPostgresAdmittedRunOwner`); exact binding, fresh, unexpired; read again before the receipt is returned.
 *  - rights: `currentRights({binding,policyRevision,signal,deadlineMs})` -> `{tenantId,actorId,scopes,checkedAtMs,expiresAtMs}`,
 *            Core's CURRENT membership/client/policy answer for the run's principal; every scope is this tenant's at the run's
 *            current policy revision. No Meri owner stands in for it.
 *  - selection: the exact selection object and its hash; capture carries no original/result, release carries both.
 *  - scopes: capture answers the current rights' scopes; release additionally requires every original scope still current.
 *  - expiry: min(run deadline, rights expiry, original expiry).
 * The executor's own pre-release rechecks are untouched: this port only decides what an intent preparation may release.
 * Construction is inert. Failures are the intent mount's closed codes (`ACCESS_DENIED`, `UNAVAILABLE`). */
import {canonicalSha256 as hash,validateShape} from '../../../packages/contracts/validate.mjs';
import {data,own,nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {intentFault} from './faults.mjs';
const deny=()=>{throw intentFault('ACCESS_DENIED');};
const SHA=/^[a-f0-9]{64}$/u;
export function createIntentResultReleaseAuthority(configuration){
 const c=own(configuration,['binding','currentRun','currentRights','now'],['maxFactBytes']),binding=data(c.binding),maxFactBytes=c.maxFactBytes??131072;
 validateShape('RunBinding',binding);
 if(typeof c.currentRun!=='function'||typeof c.currentRights!=='function'||typeof c.now!=='function'||!Number.isSafeInteger(maxFactBytes)||maxFactBytes<1||maxFactBytes>1048576)throw intentFault('INTENT_CONFIGURATION');
 const fresh=(stamp,started)=>Number.isSafeInteger(stamp)&&stamp>=started&&stamp<=c.now();
 async function run(signal,started){
  let r;try{const raw=await c.currentRun(binding,{signal});if(typeof raw!=='string'||Buffer.byteLength(raw)>maxFactBytes)throw 0;r=data(own(JSON.parse(raw),['binding','policyRevision','deadlineMs','checkedAtMs']));}
  catch{throw intentFault('UNAVAILABLE');}
  if(hash(r.binding)!==hash(binding)||typeof r.policyRevision!=='string'||!r.policyRevision||!fresh(r.checkedAtMs,started)||!Number.isSafeInteger(r.deadlineMs)||r.deadlineMs<=c.now())deny();
  return r;
 }
 return Object.freeze({async check(value){
  const v=own(value,['selection','selectionSha256','limitDeadline'],['signal']);nativeSignal(v.signal);
  if(typeof v.limitDeadline!=='function')deny();
  let s;try{s=data(own(v.selection,['binding','operation','deliveryId','argumentsSha256','original','resultSha256']));}catch{return deny();}
  if(hash(s)!==v.selectionSha256||hash(s.binding)!==hash(binding)||typeof s.argumentsSha256!=='string'||!SHA.test(s.argumentsSha256)||
   (s.original===null)!==(s.resultSha256===null)||s.resultSha256!==null&&(typeof s.resultSha256!=='string'||!SHA.test(s.resultSha256)))deny();
  const started=c.now(),first=await run(v.signal,started);v.limitDeadline(first.deadlineMs);
  let rights;
  try{rights=data(own(await c.currentRights({binding,policyRevision:first.policyRevision,signal:v.signal,deadlineMs:first.deadlineMs}),['tenantId','actorId','scopes','checkedAtMs','expiresAtMs']));}
  catch{throw intentFault('UNAVAILABLE');}
  if(rights.tenantId!==binding.tenantId||rights.actorId!==binding.actorId||!fresh(rights.checkedAtMs,started)||!Number.isSafeInteger(rights.expiresAtMs)||rights.expiresAtMs<=c.now()||
   !Array.isArray(rights.scopes)||!rights.scopes.length||rights.scopes.length>100)deny();
  for(const scope of rights.scopes){try{validateShape('Scope',scope);}catch{return deny();}if(scope.tenantId!==binding.tenantId||scope.policyRevision!==first.policyRevision)deny();}
  if(new Set(rights.scopes.map(hash)).size!==rights.scopes.length)deny();
  let expiresAtMs=Math.min(first.deadlineMs,rights.expiresAtMs);
  if(s.original!==null){
   const current=new Set(rights.scopes.map(hash));
   if(!Number.isSafeInteger(s.original?.expiresAtMs)||!Array.isArray(s.original.scopes)||s.original.scopes.some(scope=>!current.has(hash(scope))))deny();
   expiresAtMs=Math.min(expiresAtMs,s.original.expiresAtMs);
  }
  if(expiresAtMs<=c.now())deny();v.limitDeadline(expiresAtMs);
  // Pre-release recheck: the run is still the same admitted run at the same policy revision and deadline.
  const last=await run(v.signal,started);
  if(last.policyRevision!==first.policyRevision||last.deadlineMs!==first.deadlineMs)deny();
  const checkedAtMs=c.now();if(checkedAtMs>=expiresAtMs)deny();
  return data({authorized:true,selectionSha256:v.selectionSha256,binding,scopes:rights.scopes,checkedAtMs,expiresAtMs});
 }});
}
