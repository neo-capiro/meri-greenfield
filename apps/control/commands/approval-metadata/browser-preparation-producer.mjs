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
 browserPreparationFromRequest,browserPreparationProposalId,browserCommandSha256}
 from '../../../../packages/contracts/runtime-0.2/browser-approval-preparation.mjs';
import {immutablePayload} from './binding.mjs';
import {assertBrowserPreparationResult} from './browser-preparation-result.mjs';
import {createBrowserActionApprovalMetadataOwner} from './browser-owner.mjs';

const fail=code=>{throw Object.assign(Error(code),{code});};
const DENIED='BROWSER_PREPARATION_REFUSED';
const CHANGED='BROWSER_PREPARATION_AUTHORITY_CHANGED';

export function createBrowserPreparationProducer(configuration){
 const c=own(configuration,['journal','browserPolicy','store','approver','actorRole'],['now','maxRequestMs','newId']);
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
 let boundPreparation=null;
 async function preparePolicy({phase,selection,selectionSha256,signal,limitDeadline}){
  // `before_read` carries no request in the existing owner contract; a request-bound read supplies the
  // ORIGINAL canonical preparation for this call so authority is resolved for the same subject.
  const request=selection?.request??(phase==='before_read'?boundPreparation:null);
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
 const owner=createBrowserActionApprovalMetadataOwner({store,preparePolicy,now,maxRequestMs,
  ...(typeof c.newId==='function'?{newId:c.newId}:{})});
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
 /** Read the retained preparation WITH current authority, without writing, consuming or dispatching.
  *  The original request and binding are required; the stored row is re-validated against them. */
 async function readPrepared(value){
  let v;
  try{v=own(value,['request','binding','deadlineMs'],['signal']);}catch{throw fail(DENIED);}
  let request,preparation;
  try{request=assertBrowserApprovalRequest(v.request);preparation=browserPreparationFromRequest(request);}
  catch{throw fail(DENIED);}
  const binding=data(v.binding);
  if(canonicalSha256(data(request.subject.binding))!==canonicalSha256(data(binding)))throw fail(DENIED);
  if(request.subject.binding.tenantId!==approver.tenantId)throw fail(DENIED);
  const proposalId=browserPreparationProposalId({binding,toolUseId:preparation.subject.toolUseId});
  const requestSha256=canonicalSha256(request);
  // Identity-only selector: the raw row tells us which command digest to ask the owner for. It is never
  // treated as authority — owner.read re-resolves authority before AND after the row is read.
  let raw;
  try{raw=await store.read({tenantId:binding.tenantId,actorId:binding.actorId,proposalId},
   ()=>{if(v.signal?.aborted)throw fail('CANCELLED');});}
  catch{throw fail('BROWSER_APPROVAL_UNKNOWN');}
  if(raw===null||raw===undefined)throw fail('BROWSER_APPROVAL_UNKNOWN');
  let commandSha256;
  try{commandSha256=immutablePayload(raw).commandSha256;}catch{throw fail(DENIED);}
  boundPreparation=preparation;
  let record;
  try{
   record=await owner.read({proposalId,commandSha256,operation:BROWSER_ACTION_OPERATION,action:BROWSER_ACTION,
    binding,deadlineMs:v.deadlineMs??now()+maxRequestMs,...(v.signal===undefined?{}:{signal:v.signal})});
  }finally{boundPreparation=null;}
  // The retained identity is the STORED canonical record: the owner's fresh observation fields are not
  // allowed to replace it (that would change the fingerprint on every recovery).
  const stored=(({checkedAtMs:_checked,resolved:_resolved,...canonical})=>canonical)(data(record));
  let result;
  try{result=assertBrowserPreparationResult({proposalId,subjectSha256:preparation.subjectSha256,requestSha256,
   record:stored,recordSha256:canonicalSha256(stored)},{binding,toolUseId:preparation.subject.toolUseId});}
  catch{throw fail(DENIED);}
  return result;
 }
 return Object.freeze({prepare,readPrepared,action:BROWSER_ACTION,operation:BROWSER_ACTION_OPERATION});
}
