/** Control's browser APPROVAL preparation and human wait.
 *
 * Two things live here, both request-local and both built from owners Control already has:
 *   - prepare(): turns the exact `meri-browser-approval-request/3` the authenticated host captured into
 *     retained metadata through the existing preparation producer. The exporting role, the canonical
 *     browser policy and the run's currentness are re-read for EVERY authority phase, so a change during
 *     preparation refuses instead of being frozen from host or configuration claims.
 *   - wait(): polls the canonical Core status until the proposal is terminal and consumes ONCE, only for a
 *     real approval. A status answer is never a permit, a lost consume acknowledgement leaves the original
 *     identity in place for status-only recovery, and nothing is synthesized locally.
 * Activation stays held: constructing this owner creates no listener, credential or schedule.
 */
import {createBrowserPreparationProducer} from '../control/commands/approval-metadata/browser-preparation-producer.mjs';
import {createTransactionalApprovalMetadataStore} from '../control/commands/approval-metadata/postgres-store.mjs';
import {projectCapabilityRole} from './product-ports/capability-policy.mjs';
const fail=code=>{throw Object.assign(new Error(code),{code});};
const DENIED='BROWSER_APPROVAL_REFUSED',CHANGED='BROWSER_PREPARATION_AUTHORITY_CHANGED';
const TERMINAL=new Set(['approved','rejected','revoked','expired']);
export function createBrowserApprovalOwner({journal,pool,approver,readCapabilityRole,readBrowserPolicy,ports,now=Date.now,limits={},wait={}}={}){
 if(typeof journal?.withCurrentRun!=='function'||!pool||typeof pool.connect!=='function'||
  typeof readCapabilityRole!=='function'||typeof readBrowserPolicy!=='function'||typeof now!=='function'||
  typeof ports?.status!=='function'||typeof ports?.consume!=='function')fail('BROWSER_APPROVAL_CONFIGURATION');
 const self=data(approver);
 if(self.tenantId===undefined||self.actorId===undefined)fail('BROWSER_APPROVAL_CONFIGURATION');
 const store=createTransactionalApprovalMetadataStore({pool});
 const requestMs=Number.isSafeInteger(limits.requestMs)?limits.requestMs:3000;
 const pollMs=Number.isSafeInteger(wait.pollMs)&&wait.pollMs>=50?wait.pollMs:500;
 const sleep=wait.sleep??(ms=>new Promise(resolve=>setTimeout(resolve,ms)));

 /** Fresh exporting role and canonical browser policy for ONE authority phase. */
 async function authority({binding,signal,deadlineMs}){
  const started=now();
  let role;
  try{role=await readCapabilityRole({binding,signal,deadlineMs:now()+requestMs});}catch{throw fail(CHANGED);}
  const current=projectCapabilityRole({role:role.actorRole,checkedAtMs:role.checkedAtMs,expiresAtMs:role.expiresAtMs},{started,now:now()});
  return Object.freeze({actorRole:current.actorRole,async policy(scopes){
   try{return await readBrowserPolicy({binding,scopes,actorRole:current.actorRole,signal,deadlineMs:now()+requestMs});}
   catch{throw fail(CHANGED);}
  }});
 }

 /** Retained preparation for exactly this request. Nothing here issues a permit. */
 async function prepare({request,binding,signal,deadlineMs}={}){
  const until=deadlineMs??now()+requestMs;
  const resolved=await authority({binding,signal,deadlineMs:until});
  const producer=createBrowserPreparationProducer({journal,browserPolicy:({scopes})=>resolved.policy(scopes),
   store,approver:self,actorRole:resolved.actorRole,now,maxRequestMs:requestMs});
  const prepared=await producer.prepare({request,binding,deadlineMs:until,signal});
  const proposalId=prepared.proposalId??prepared.record?.proposalId;
  return Object.freeze({proposalId,subjectSha256:prepared.record?.request?.subjectSha256??prepared.request?.subjectSha256,
   binding,prepared});
 }

 /** Bounded, abortable wait for a REAL decision, then exactly one consume. */
 async function settle({proposalId,subjectSha256,binding,signal,deadlineMs}={}){
  const until=deadlineMs??now()+requestMs;
  let consumed=false,last=null;
  while(now()<until){
   signal?.throwIfAborted();
   let answer;
   try{answer=await ports.status({proposalId,subjectSha256,binding,signal,deadlineMs:Math.min(until,now()+requestMs)});}
   catch(error){if(signal?.aborted)throw error;throw fail('BROWSER_APPROVAL_UNKNOWN');}
   last=answer;
   const decision=answer?.status?.decision??null;
   const state=decision?.decision;
   if(state==='approved'){
    if(consumed)// A second consume is never attempted; recovery is status-only.
     return Object.freeze({permitted:false,unknown:true,status:answer.status,consumed:true});
    consumed=true;
    try{
     const receipt=await ports.consume({proposalId,subjectSha256,binding,signal,deadlineMs:Math.min(until,now()+requestMs)});
     if(receipt.permitted)return Object.freeze({permitted:true,receipt:receipt.receipt,consumed:true});
     last=receipt;
    }catch(error){
     if(signal?.aborted)throw error;
     // The consume POST may have landed. Only canonical status recovery follows; never a retry.
     return Object.freeze({permitted:false,unknown:true,status:last?.status??null,consumed:true});
    }
   }
   if(TERMINAL.has(state))return Object.freeze({permitted:false,status:answer.status,consumed,terminal:state});
   await sleep(Math.min(pollMs,Math.max(0,until-now())));
  }
  return Object.freeze({permitted:false,status:last?.status??null,consumed,expired:true});
 }
 return Object.freeze({prepare,settle});
}
function data(value){
 if(value===null||typeof value!=='object'||Array.isArray(value))fail('BROWSER_APPROVAL_CONFIGURATION');
 return Object.freeze({...value});
}
