/** Review-owned synthetic identity and canonical page; no source/network data. */
import {canonicalSha256 as hash,validateShape} from '../../../../../packages/contracts/validate.mjs';
import {resolveOperationContract} from '../../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {page as previousPage} from '../../capability-successor-20261012/action-review/fixture.mjs';
export {hash,validateShape};
export const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
export const NOW=Date.parse('2026-10-12T12:00:00.000Z');
export const binding=()=>({tenantId:'synthetic-tenant',actorId:'synthetic-actor',conversationId:id(1),runId:id(2),attemptId:id(3),workerId:id(4),writerFence:1});
export const scopes=()=>[{tenantId:'synthetic-tenant',kind:'client',resourceId:id(10),policyRevision:'revision-1'}];
export const subject=()=>({kind:'client',entityType:'client',entityIds:[id(10)],tenantId:'synthetic-tenant',actorId:'synthetic-actor',authorizationDecisionId:id(11),policyRevision:'revision-1',scopes:scopes(),rosterVersionId:null});
export const operation=Object.freeze({id:'actions.query',version:'0.2.0'});
export function context(){return {lookupId:id(20),resultReference:id(21),requestId:id(22),binding:binding(),scopes:scopes(),selectedClientId:id(10),deliveryJson:JSON.stringify({invocationId:'synthetic-selected-lookup'}),slots:{started:{eventId:id(30),sequence:41},terminal:{eventId:id(31),sequence:42}},deadlineMs:NOW+10000};}
export const readContext=()=>({currentBinding:binding(),scopes:scopes(),deadlineMs:NOW+10000});
export function envelope(request={},c=context()){
 const args={...request,clientId:c.selectedClientId},options={binding:c.binding,clientResolution:{reference:c.selectedClientId,clientId:c.selectedClientId}};
 const contract=resolveOperationContract(operation),normalized=contract.normalizeInput(args,options);
 const page=previousPage(args,{actions:[],binding:c.binding,subject:subject()});page.requestId=c.requestId;
 contract.assertOutput(page,{...options,request:args});
 return {binding:structuredClone(c.binding),subject:subject(),operation,argumentsSha256:normalized.argumentsSha256,result:page};
}
export function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};}
