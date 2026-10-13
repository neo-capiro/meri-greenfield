/** Correlation only: existing gateway/current producer policy owns authorization. */
import {types} from 'node:util';
import {canonicalSha256,validateShape as publicShape} from '../../../../packages/contracts/validate.mjs';
import {assertSubject,resolveOperationContract} from '../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {assertResultLineage,deny} from '../../dispatch/operation-result.mjs';
import {frozenData,ownFields} from '../source-admission.mjs';
export {frozenData,ownFields} from '../source-admission.mjs';
export const operationIds=Object.freeze(['resolve_entity','find_contacts']);
const same=(left,right)=>canonicalSha256(left)===canonicalSha256(right);
const aborted=Object.getOwnPropertyDescriptor(AbortSignal.prototype,'aborted').get;
export function identityContactsContract(reference){
 const operation=frozenData(ownFields(reference,['id','version']));
 if(!operationIds.includes(operation.id)||operation.version!=='0.2.0')deny('GATEWAY_CONFIGURATION');
 return {operation,contract:resolveOperationContract(operation)};
}
export function readContext(call,now){
 const fields=ownFields(call,['operation','input','request','authority','normalizationContext'],['signal']);
 const {operation,contract}=identityContactsContract(fields.operation);
 const input=frozenData(fields.input),request=frozenData(fields.request),normalizationContext=frozenData(fields.normalizationContext);
 let authority;
 try{
  authority=frozenData(fields.authority);ownFields(authority,['binding','subject','claims','policyRevision','decision','sourceIds','deadlineMs']);
  publicShape('RunBinding',authority.binding);publicShape('CapabilityClaims',authority.claims);
  publicShape('AuthorizationDecision',authority.decision);assertSubject(authority.subject,authority.binding);
 }catch{deny('ACCESS_DENIED');}
 const {binding,subject,claims,decision}=authority;
 if(!same(claims.binding,binding)||authority.policyRevision!==subject.policyRevision||authority.policyRevision!==claims.policyRevision||
    authority.policyRevision!==decision.policyRevision||claims.audience!=='meri-gateway'||!claims.actions.includes('tool.read')||
    decision.decision!=='allowed'||decision.operation!==`${operation.id}@${operation.version}`||decision.decisionId!==subject.authorizationDecisionId||
    !same(decision.actor,{tenantId:binding.tenantId,actorId:binding.actorId})||!same(decision.scopes,subject.scopes)||
    claims.scopes.some(scope=>scope.tenantId!==binding.tenantId||scope.policyRevision!==authority.policyRevision)||
    subject.scopes.some(scope=>!claims.scopes.some(parent=>same(scope,parent)))||
    !Array.isArray(authority.sourceIds)||!same([...authority.sourceIds].sort(),
      [...new Set(contract.descriptor.sourceRequirements.map(source=>source.sourceId))].sort()))deny('ACCESS_DENIED');
 const issued=Date.parse(claims.issuedAt),expires=Date.parse(claims.expiresAt),deadlineMs=Math.min(authority.deadlineMs,expires),signal=fields.signal;
 if(!Number.isSafeInteger(issued)||!Number.isSafeInteger(expires)||issued>=expires||!Number.isSafeInteger(authority.deadlineMs))deny('DEADLINE');
 if(signal!==undefined){if(types.isProxy(signal))deny('INVALID_ARGUMENTS');try{aborted.call(signal);}catch{deny('INVALID_ARGUMENTS');}}
 function active(cutoff=deadlineMs){const stamp=now();if(signal!==undefined&&aborted.call(signal))deny('CANCELLED');
  if(!Number.isSafeInteger(stamp)||stamp<0||stamp<issued||stamp>=Math.min(cutoff,deadlineMs))deny('DEADLINE');return stamp;}
 active();let normalized;try{normalized=contract.normalizeInput(request,normalizationContext);}catch{deny('INVALID_ARGUMENTS');}
 if(!same(normalized.input,input))deny('INVALID_ARGUMENTS');
 if(operation.id==='find_contacts'&&input.clientId!==null&&(subject.kind!=='client'||subject.entityIds[0]!==input.clientId))deny('ACCESS_DENIED');
 return {operation,contract,input,request,authority,normalizationContext,metadata:normalized.metadata,
  argumentsSha256:normalized.argumentsSha256,requestSha256:canonicalSha256({input,metadata:normalized.metadata}),deadlineMs,signal,active};
}
export function assertIdentityContactsResult(value,context){
 try{
  ownFields(value,['binding','subject','operation','argumentsSha256','result']);assertResultLineage(value,context.authority);
  if(!same(value.operation,context.operation)||value.argumentsSha256!==context.argumentsSha256)deny('INVALID_RESULT');
  context.contract.assertOutput(value.result,{request:context.request,...context.normalizationContext});
  if(context.operation.id==='find_contacts'&&context.input.clientId!==null&&value.result.clientId!==context.authority.subject.entityIds[0])deny('INVALID_RESULT');
 }catch{deny('INVALID_RESULT');}
 context.active();return value;
}
