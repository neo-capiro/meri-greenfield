/** Control's browser tools use the existing execution identity, Core role,
 * tenant settings and allocated host router. This is composition, not a second
 * browser gate: the host still owns approvals, effects, receipts and cleanup. */
import {assertBrowserOperationRequest,assertBrowserOperationResponse,browserOperationBudgetMs,browserOperationCeilingMs} from '../../packages/contracts/runtime-0.2/browser-tools.mjs';
import {validateBrowserPolicy} from '../worker/conversation/browser/policy.mjs';
import {projectCapabilityRole} from './product-ports/capability-policy.mjs';
const fail=()=>{throw Object.assign(Error('BROWSER_OPERATION_UNAVAILABLE'),{code:'BROWSER_OPERATION_UNAVAILABLE'});};
export function createBrowserOperations({hosts,readCapabilityRole,readBrowserPolicy,now=Date.now}){
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
  // The approval owner pins its selected timeout during host preparation; the
  // SDK client also uses that validated metadata. Control is only the outer
  // transport ceiling here, never a replacement 120 s approval decision.
  const budget=operation==='browser-approve'?browserOperationCeilingMs(operation):browserOperationBudgetMs(operation,{policy});
  const until=Math.min(execution.expiresAtMs,now()+budget);
  return Object.freeze({deadlineMs:until,async execute({signal}){
   const result=await hosts.executeBrowserOperation(operation,input,{signal,deadlineMs:until});
   const response={binding:input.binding,result};assertBrowserOperationResponse(response,input.binding);return response;
  }});
 }});
}
