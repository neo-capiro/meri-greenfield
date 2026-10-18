/** Exact selected-client proposal source correlation. The dispatcher owns current
 * authorization, continuation admission, reservation, settlement and release. */
import {types} from 'node:util';
import {canonicalSha256,validateShape as publicShape} from '../../../../packages/contracts/validate.mjs';
import {assertSubject,resolveOperationContract,validateShape} from '../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {ownFields,frozenData} from '../source-admission.mjs';
import {deny} from '../../dispatch/operation-result.mjs';

export {ownFields,frozenData} from '../source-admission.mjs';
export const operation=Object.freeze({id:'memory.list_own_proposals',version:'0.2.0'});
const contract=resolveOperationContract(operation);
const same=(a,b)=>canonicalSha256(a)===canonicalSha256(b);
const CALL_KEY=/^[A-Za-z0-9_-]{1,128}$/u;
const aborted=Object.getOwnPropertyDescriptor(AbortSignal.prototype,'aborted').get;

export function readContext(call,now){
 const fields=ownFields(call,['input','authority','invocationId'],['signal']);
 if(typeof now!=='function'||typeof fields.invocationId!=='string'||!CALL_KEY.test(fields.invocationId))deny('ACCESS_DENIED');
 const input=frozenData(fields.input),authority=frozenData(fields.authority);
 validateShape('MemoryProposalSelection',input);
 ownFields(authority,['binding','subject','claims','policyRevision','decision','sourceIds','deadlineMs']);
 publicShape('RunBinding',authority.binding);publicShape('CapabilityClaims',authority.claims);
 publicShape('AuthorizationDecision',authority.decision);
 assertSubject(authority.subject,authority.binding);
 const {binding,subject,claims,decision}=authority;
 if(!same(binding,claims.binding)||authority.policyRevision!==subject.policyRevision||
    authority.policyRevision!==claims.policyRevision||authority.policyRevision!==decision.policyRevision||
    claims.audience!=='meri-gateway'||!claims.actions.includes('tool.read')||
    decision.decision!=='allowed'||decision.operation!==`${operation.id}@${operation.version}`||
    decision.decisionId!==subject.authorizationDecisionId||
    !same(decision.actor,{tenantId:binding.tenantId,actorId:binding.actorId})||
    !same(decision.scopes,subject.scopes)||
    !Array.isArray(authority.sourceIds)||!same([...authority.sourceIds].sort(),
     [...new Set(contract.descriptor.sourceRequirements.map(source=>source.sourceId))].sort())||
    subject.kind!=='client'||subject.entityType!=='client'||subject.entityIds.length!==1||
    input.clientId!==subject.entityIds[0]||subject.scopes.length!==1||
    subject.scopes[0].kind!=='client'||subject.scopes[0].resourceId!==input.clientId||
    !claims.scopes.some(scope=>same(scope,subject.scopes[0]))||
    claims.scopes.some(scope=>scope.tenantId!==binding.tenantId||scope.policyRevision!==authority.policyRevision))deny('ACCESS_DENIED');
 const expiry=Date.parse(claims.expiresAt),issued=Date.parse(claims.issuedAt);
 if(!Number.isSafeInteger(expiry)||!Number.isSafeInteger(issued)||issued>=expiry||
    !Number.isSafeInteger(authority.deadlineMs))deny('DEADLINE');
 const deadlineMs=Math.min(expiry,authority.deadlineMs),signal=fields.signal;
 if(signal!==undefined){
  if(types.isProxy(signal))deny('INVALID_ARGUMENTS');
  try{aborted.call(signal);}catch{deny('INVALID_ARGUMENTS');}
 }
 function active(cutoff=deadlineMs){
  const stamp=now();
  if(signal!==undefined&&aborted.call(signal))deny('CANCELLED');
  if(!Number.isSafeInteger(stamp)||stamp<issued||stamp>=Math.min(deadlineMs,cutoff))deny('DEADLINE');
  return stamp;
 }
 active();
 const metadata=null,argumentsSha256=canonicalSha256(input);
 return {input,authority,metadata,argumentsSha256,requestSha256:canonicalSha256({input,metadata}),
  invocationId:fields.invocationId,signal,deadlineMs,active};
}
