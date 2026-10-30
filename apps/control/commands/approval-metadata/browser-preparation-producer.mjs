/** Request-local browser approval PREPARATION producer.
 *
 * The authenticated host callback hands Control the exact `meri-browser-approval-request/3` it captured.
 * This producer is the one place that turns it into retained metadata, and it never issues a permit:
 *   - currentness comes from the existing execution journal (`withCurrentRun` -> `readCurrentOnClient`)
 *     in one SHORT run transaction; remote policy I/O happens outside that lock;
 *   - the effective browser policy comes from the canonical browser-policy reader, and the subject's
 *     `policySha256` must equal the digest of THAT resolved policy (host policy and run authority are
 *     different identities and are never substituted for each other);
 *   - the metadata owner stores the preparation and re-checks the same authority before release.
 * Activation stays held: building this producer creates no listener, credential, host or activation.
 */
import {canonicalSha256} from '../../../../packages/contracts/validate.mjs';
import {own,data} from '../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {BROWSER_ACTION,BROWSER_ACTION_OPERATION,assertBrowserApprovalRequest,
 browserPreparationFromRequest} from '../../../../packages/contracts/runtime-0.2/browser-approval-preparation.mjs';
import {createBrowserActionApprovalMetadataOwner} from './browser-owner.mjs';

const fail=code=>{throw Object.assign(Error(code),{code});};
const DENIED='BROWSER_PREPARATION_REFUSED';
const CHANGED='BROWSER_PREPARATION_AUTHORITY_CHANGED';

export function createBrowserPreparationProducer(configuration){
 const c=own(configuration,['journal','browserPolicy','store','approver','actorRole'],['now','maxRequestMs']);
 const {journal,browserPolicy,store,actorRole}=c,approver=data(own(c.approver,['tenantId','actorId']));
 const now=c.now??Date.now,maxRequestMs=c.maxRequestMs??30000;
 if(typeof journal?.withCurrentRun!=='function'||typeof browserPolicy!=='function'||
  typeof now!=='function'||!Number.isSafeInteger(maxRequestMs)||maxRequestMs<1||maxRequestMs>30000)throw fail('BROWSER_PREPARATION_CONFIGURATION');

 /** Short canonical read, then remote policy resolution OUTSIDE the run lock. */
 async function currentAuthority({binding,signal,deadlineMs,expectedPolicySha256}){
  let short;
  try{
   short=await journal.withCurrentRun({binding,signal,deadlineMs},async({current})=>current);
  }catch{throw fail(CHANGED);}
  if(!short||!Array.isArray(short.scopes)||short.scopes.length===0||!Number.isSafeInteger(short.deadlineMs))throw fail(CHANGED);
  let policy;
  try{policy=await browserPolicy({binding,scopes:short.scopes,actorRole,signal,deadlineMs:short.deadlineMs});}
  catch{throw fail(CHANGED);}
  if(canonicalSha256(data(policy))!==expectedPolicySha256)throw fail(CHANGED);
  return Object.freeze({scopes:Object.freeze(short.scopes.map(scope=>Object.freeze(data(scope)))),policyRevision:short.policyRevision,
   deadlineMs:short.deadlineMs,policySha256:expectedPolicySha256,checkedAtMs:now()});
 }
 /** The existing current-authority hook contract: canonical scopes, approver and proposal expiry, or a refusal. */
 async function preparePolicy({phase,selection,selectionSha256,signal,limitDeadline}){
  const request=selection?.request;
  if(!request||typeof request.expiresAtMs!=='number')throw fail(DENIED);
  const binding=selection.binding;
  // `limitDeadline` is the owner's lifetime TIGHTENER (a setter), not a deadline value.
  const authority=await currentAuthority({binding,signal,deadlineMs:now()+maxRequestMs,
   expectedPolicySha256:request.subject.policySha256});
  if(approver.tenantId!==binding.tenantId)throw fail(DENIED);
  const proposalExpiresAt=new Date(Math.min(request.expiresAtMs,authority.deadlineMs)).toISOString();
  if(typeof limitDeadline==='function')limitDeadline(Math.min(request.expiresAtMs,authority.deadlineMs));
  // Exactly the closed current-authority receipt shape; the canonical policy revision stays a separate
  // identity and is never substituted for the browser-policy digest.
  return Object.freeze({authorized:true,selectionSha256,binding:Object.freeze(data(binding)),
   scopes:authority.scopes,requiredApprover:Object.freeze(data(approver)),proposalExpiresAt,
   checkedAtMs:authority.checkedAtMs,expiresAtMs:authority.deadlineMs});
 }
 const owner=createBrowserActionApprovalMetadataOwner({store,preparePolicy,now,maxRequestMs});
 /** Named internal callback: the authenticated host request enters here and nothing else may call it. */
 async function prepare(value){
  let v;
  try{v=own(value,['request','binding'],['deadlineMs','signal']);}catch{throw fail(DENIED);}
  let request;
  try{request=assertBrowserApprovalRequest(v.request);}catch{throw fail(DENIED);}
  const binding=data(v.binding);
  // The request's own complete binding must be the acting one; no path lets a caller retarget it.
  if(canonicalSha256(data(request.subject.binding))!==canonicalSha256(data(binding)))throw fail(DENIED);
  if(request.subject.binding.tenantId!==approver.tenantId)throw fail(DENIED);
  const preparation=browserPreparationFromRequest(request);
  const deadlineMs=v.deadlineMs??now()+maxRequestMs;
  return owner.prepare({operation:BROWSER_ACTION_OPERATION,action:BROWSER_ACTION,binding,
   request:preparation,deadlineMs,signal:v.signal});
 }
 return Object.freeze({prepare,action:BROWSER_ACTION,operation:BROWSER_ACTION_OPERATION});
}
