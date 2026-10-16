/** Correlation only. A genuine current Core role/principal owner is still required. */
import {canonicalSha256,validateShape} from '../../../../packages/contracts/validate.mjs';
import {assertSubject,resolveOperationContract} from '../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {deny} from '../../dispatch/operation-result.mjs';
import {frozenData,ownFields} from '../source-admission.mjs';
import {retainedCall} from '../retained-reads/call-context.mjs';
const same=(a,b)=>canonicalSha256(a)===canonicalSha256(b);
export function acquisitionOperation(reference){
 const operation=frozenData(ownFields(reference,['id','version']));
 try{if(operation.version!=='0.2.0'||resolveOperationContract(operation).binding?.group!=='acquisition-personnel')deny('GATEWAY_CONFIGURATION');}
 catch{deny('GATEWAY_CONFIGURATION');}
 return operation;
}
export function acquisitionCall(operation,call,now){
 const {signal,...fields}=ownFields(call,['input','request','authority','argumentsSha256'],['normalizationContext','signal']);
 if(fields.normalizationContext===undefined||fields.normalizationContext===null)deny('UNAVAILABLE');
 const data=frozenData(fields);
 if(!Object.hasOwn(data.normalizationContext,'actorRole'))deny('UNAVAILABLE');
 try{resolveOperationContract(operation).normalizeInput(data.request,data.normalizationContext);}catch{deny('INVALID_ARGUMENTS');}
 // Admit only inert data before examining authority; never execute caller getters.
 const a=data.authority;
 try{ownFields(a,['binding','subject','claims','policyRevision','decision','sourceIds','deadlineMs']);
  validateShape('RunBinding',a.binding);validateShape('CapabilityClaims',a.claims);assertSubject(a.subject,a.binding);
  validateShape('AuthorizationDecision',a.decision);
  if(a.claims.audience!=='meri-gateway'||!a.claims.actions.includes('tool.read')||a.decision.decision!=='allowed'||
   a.decision.operation!==`${operation.id}@${operation.version}`||a.decision.decisionId!==a.subject.authorizationDecisionId||
   a.decision.policyRevision!==a.policyRevision||!same(a.decision.actor,{tenantId:a.binding.tenantId,actorId:a.binding.actorId})||
   !same(a.decision.scopes,a.subject.scopes)||a.subject.scopes.some(scope=>!a.claims.scopes.some(parent=>same(scope,parent)))||
   a.claims.scopes.some(scope=>scope.tenantId!==a.binding.tenantId||scope.policyRevision!==a.policyRevision))deny('ACCESS_DENIED');
 }catch{deny('ACCESS_DENIED');}
 const context=retainedCall(operation,{...data,...(signal===undefined?{}:{signal})},now);
 if(Date.parse(a.claims.issuedAt)>now()||Date.parse(a.claims.issuedAt)>=Date.parse(a.claims.expiresAt))deny('ACCESS_DENIED');
 return context;
}
