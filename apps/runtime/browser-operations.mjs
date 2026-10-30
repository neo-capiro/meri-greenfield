/** Control's browser tools use the existing execution identity, Core role,
 * tenant settings and allocated host router. This is composition, not a second
 * browser gate: the host still owns approvals, effects, receipts and cleanup. */
import {assertBrowserOperationRequest,assertBrowserOperationResponse,browserOperationBudgetMs,browserOperationCeilingMs} from '../../packages/contracts/runtime-0.2/browser-tools.mjs';
import {validateBrowserPolicy} from '../worker/conversation/browser/policy.mjs';
import {canonicalSha256} from '../../packages/contracts/validate.mjs';
import {projectCapabilityRole} from './product-ports/capability-policy.mjs';
const fail=()=>{throw Object.assign(Error('BROWSER_OPERATION_UNAVAILABLE'),{code:'BROWSER_OPERATION_UNAVAILABLE'});};
export function createBrowserOperations({hosts,readCapabilityRole,readBrowserPolicy,custody,now=Date.now}){
 if(typeof hosts?.executeBrowserOperation!=='function'||typeof readCapabilityRole!=='function'||typeof readBrowserPolicy!=='function'||typeof now!=='function')fail();
 return Object.freeze({async prepare({operation,request,execution,scopes,signal,deadlineMs}){
  const input=assertBrowserOperationRequest(operation,request);let policy;
  // Cleanup never authorizes new browsing and must still be attempted after a
  // policy revocation. The caller's canonical execution authentication remains
  // mandatory; an expired execution therefore cannot claim successful cleanup.
  if(operation!=='browser-settle'){
   const started=now(),role=await readCapabilityRole({binding:input.binding,signal,deadlineMs});
   const current=projectCapabilityRole({role:role.actorRole,checkedAtMs:role.checkedAtMs,expiresAtMs:role.expiresAtMs},{started,now:now()});
   policy=validateBrowserPolicy(await readBrowserPolicy({binding:input.binding,scopes,actorRole:current.actorRole,signal,deadlineMs}));
   if(!policy.enabled&&operation!=='browser-prepare')fail();
  }
  signal?.throwIfAborted();
  // A browser CALL is durable: its descriptor is derived here from the authenticated request and the
  // CURRENT policy/scopes, and it is claimed before the host effect runs. Any other route keeps its
  // existing behaviour and creates no custody row.
  const descriptor=input.requestId===undefined?null:{binding:input.binding,requestId:input.requestId,
   tool:input.tool,inputSha256:canonicalSha256(input.args),policySha256:policy===undefined?null:canonicalSha256(policy),scopes};
  // The approval owner pins its selected timeout during host preparation; the
  // SDK client also uses that validated metadata. Control is only the outer
  // transport ceiling here, never a replacement 120 s approval decision.
  const budget=operation==='browser-approve'?browserOperationCeilingMs(operation):browserOperationBudgetMs(operation,{policy});
  const until=Math.min(execution.expiresAtMs,now()+budget);
  return Object.freeze({deadlineMs:until,async execute({signal}){
   if(descriptor===null){
    // Cancellation or elapsed budget immediately after the acknowledged claim never forwards the call.
   signal?.throwIfAborted();
   if(now()>=until)fail();
   const result=await hosts.executeBrowserOperation(operation,input,{signal,deadlineMs:until});
    const response={binding:input.binding,result};assertBrowserOperationResponse(response,input.binding);return response;
   }
   // A real browser call without durable custody refuses: no unclaimed effect is ever dispatched.
   if(typeof custody?.claim!=='function'||typeof custody?.settle!=='function')fail();
   let claim;try{claim=await custody.claim({...descriptor,signal});}catch{throw Object.assign(Error('BROWSER_OPERATION_UNKNOWN'),{code:'BROWSER_OPERATION_UNKNOWN'});}
   if(claim.dispatch!==true){
    signal?.throwIfAborted();
    // PENDING/UNKNOWN/conflict never dispatch. Only an exact retained replay is released, and only
    // while its release window is still current.
    if(claim.variant!=='replayed'||!claim.result||!claim.release||claim.release.expiresAtMs<=now())fail();
    // The retained release must describe THIS authenticated call: the same binding and the same
    // currently authenticated scopes. A rehashed record digest never rescues a corrupted release.
    if(canonicalSha256(claim.release.binding)!==canonicalSha256(input.binding)||
     !Array.isArray(claim.release.scopes)||claim.release.scopes.length!==scopes.length||
     claim.release.scopes.some((scope,index)=>canonicalSha256(scope)!==canonicalSha256(scopes[index])))fail();
    const replayed={binding:input.binding,result:claim.result};assertBrowserOperationResponse(replayed,input.binding);return replayed;
   }
   // Cancellation or elapsed budget immediately after the acknowledged claim never forwards the call.
   signal?.throwIfAborted();
   if(now()>=until)fail();
   const result=await hosts.executeBrowserOperation(operation,input,{signal,deadlineMs:until});
   signal?.throwIfAborted();
   // The owner's acknowledgement is part of the answer: a lost settle is UNKNOWN, never success.
   try{await custody.settle({...descriptor,state:'PREPARED',
    outcome:{result,release:{binding:input.binding,scopes,expiresAtMs:until}}});}
   catch{throw Object.assign(Error('BROWSER_OPERATION_UNKNOWN'),{code:'BROWSER_OPERATION_UNKNOWN'});}
   const response={binding:input.binding,result};assertBrowserOperationResponse(response,input.binding);return response;
  }});
 }});
}
