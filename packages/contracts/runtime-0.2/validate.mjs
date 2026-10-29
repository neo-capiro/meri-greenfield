/** Private run-owner wire. Reuses existing domain validators; exports no browser API. */
import {data,own} from '../commands-0.2/execution-boundary.mjs';
import {validateShape,canonicalSha256} from '../validate.mjs';
import {assertUsageInput} from './usage.mjs';
import {assertUploadSelections} from '../upload-selection.mjs';
export const same=(a,b)=>canonicalSha256(a)===canonicalSha256(b);
export const runOwnerOperations=Object.freeze({load:'loadForExecution',publish:'publish','next-controls':'nextControls','claim-control':'claimControl','ack-control':'ackControl','record-checkpoint':'recordCheckpoint','record-usage':'recordUsage','upload-source':'readUploadSource','procedure-resolve':'procedureResolve','site-workflow-resolve':'siteWorkflowResolve'});
// Optional new reads do not make historical prepared-candidate configurations invalid.
export const requiredRunOwnerOperations=Object.freeze(Object.keys(runOwnerOperations).filter(name=>name!=='upload-source'&&name!=='procedure-resolve'&&name!=='site-workflow-resolve'));
export function assertRunOwnerRequest(operation,value){const v=data(value);if(!Object.hasOwn(runOwnerOperations,operation))throw Error('RUNTIME_OPERATION_REFUSED');if(operation==='load')own(v,['binding']);else if(operation==='next-controls')own(v,['binding'],['after']);else if(operation==='publish'){own(v,['binding','event']);own(v.event,['eventId','createdAt','type','data']);if(!['run.status','message.delta','question.pending','question.answered'].includes(v.event.type))throw Error('RUNTIME_EVENT_REFUSED');}
// A procedure admission is resolved for the persisted selection on the server: the request carries the closed
// {binding} only, so no selector, scope, budget or version can arrive as request authority.
else if(operation==='procedure-resolve'||operation==='site-workflow-resolve')own(v,['binding']);
else{own(v,['binding','input']);if(operation==='record-usage')assertUsageInput(v.input);if(operation==='upload-source'){own(v.input,['selection','page']);assertUploadSelections([v.input.selection]);if(!Number.isSafeInteger(v.input.page)||v.input.page<0||v.input.page>255)throw Error('RUNTIME_UPLOAD_SOURCE_REFUSED');}}validateShape('RunBinding',v.binding);return v;}
export function assertWorkerAuthorization(value,{binding,operation,inputSha256,started,now}){
 const v=data(value);own(v,['binding','operation','inputSha256','identityCredential','scopes','selectedClientId','policyRevision','authorizationDecisionId','checkedAtMs','expiresAtMs']);validateShape('RunBinding',v.binding);
 if(!same(v.binding,binding)||v.operation!==operation||v.inputSha256!==inputSha256||typeof v.identityCredential!=='string'||!v.identityCredential||v.identityCredential.length>8192||!Array.isArray(v.scopes)||!v.scopes.length||v.scopes.length>100||typeof v.policyRevision!=='string'||typeof v.authorizationDecisionId!=='string'||!v.authorizationDecisionId||!Number.isSafeInteger(v.checkedAtMs)||v.checkedAtMs<started||v.checkedAtMs>now()||!Number.isSafeInteger(v.expiresAtMs)||v.expiresAtMs<=now())throw Error('WORKER_AUTHORITY_REFUSED');
 for(const s of v.scopes){validateShape('Scope',s);if(s.tenantId!==binding.tenantId||s.policyRevision!==v.policyRevision)throw Error('WORKER_AUTHORITY_REFUSED');}if(!v.scopes.some(s=>s.kind==='client'&&s.resourceId===v.selectedClientId)||new Set(v.scopes.map(canonicalSha256)).size!==v.scopes.length)throw Error('WORKER_AUTHORITY_REFUSED');return v;
}
