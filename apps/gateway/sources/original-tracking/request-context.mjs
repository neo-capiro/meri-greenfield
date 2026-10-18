/** Inert correlation only; current authorization and budget remain gateway-owned. */
import {types} from 'node:util';
import {canonicalSha256,validateShape as publicShape} from '../../../../packages/contracts/validate.mjs';
import {assertSubject,resolveOperationContract} from '../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {deny} from '../../dispatch/operation-result.mjs';
import {ownFields,frozenData} from '../source-admission.mjs';
export {ownFields,frozenData} from '../source-admission.mjs';
const same=(a,b)=>canonicalSha256(a)===canonicalSha256(b);
const aborted=Object.getOwnPropertyDescriptor(AbortSignal.prototype,'aborted').get;
export function originalTrackingContract(reference) {
  const operation=frozenData(ownFields(reference,['id','version']));
  if(!['query_tasks','query_action_items'].includes(operation.id)||operation.version!=='0.2.0')deny('GATEWAY_CONFIGURATION');
  const contract=resolveOperationContract(operation);
  return {operation,contract};
}
export function assertOriginalSourceIdentity(value,contract) {
  let identity;
  try {identity=frozenData(ownFields(value,['sourceId','authority','purpose']));}catch{deny('GATEWAY_CONFIGURATION');}
  if(contract.descriptor.sourceRequirements.length!==1||!same(identity,contract.descriptor.sourceRequirements[0]))deny('GATEWAY_CONFIGURATION');
  return identity;
}
export function readContext(call,now) {
  const fields=ownFields(call,['operation','input','request','authority'],['signal','normalizationContext','invocationId']);
  const {operation,contract}=originalTrackingContract(fields.operation);
  if(fields.invocationId!==undefined&&(operation.id!=='query_action_items'||
      typeof fields.invocationId!=='string'||!/^[A-Za-z0-9_-]{1,128}$/u.test(fields.invocationId)))deny('ACCESS_DENIED');
  const input=frozenData(fields.input),request=frozenData(fields.request);
  let authority;
  try {
    authority=frozenData(fields.authority);
    ownFields(authority,['binding','subject','claims','policyRevision','decision','sourceIds','deadlineMs']);
    publicShape('RunBinding',authority.binding);publicShape('CapabilityClaims',authority.claims);
    publicShape('AuthorizationDecision',authority.decision);assertSubject(authority.subject,authority.binding);
  }catch{deny('ACCESS_DENIED');}
  const {binding,claims,subject,decision}=authority;
  if(!same(binding,claims.binding)||authority.policyRevision!==claims.policyRevision||authority.policyRevision!==subject.policyRevision||
      authority.policyRevision!==decision.policyRevision||claims.audience!=='meri-gateway'||!claims.actions.includes('tool.read')||
      decision.decision!=='allowed'||decision.operation!==`${operation.id}@${operation.version}`||decision.decisionId!==subject.authorizationDecisionId||
      !same(decision.actor,{tenantId:binding.tenantId,actorId:binding.actorId})||!same(decision.scopes,subject.scopes)||
      claims.scopes.some(scope=>scope.tenantId!==binding.tenantId||scope.policyRevision!==authority.policyRevision)||
      subject.scopes.some(scope=>!claims.scopes.some(parent=>same(parent,scope)))||
      !Array.isArray(authority.sourceIds)||!same([...authority.sourceIds].sort(),contract.descriptor.sourceRequirements.map(s=>s.sourceId).sort()))deny('ACCESS_DENIED');
  const issued=Date.parse(claims.issuedAt),expires=Date.parse(claims.expiresAt),signal=fields.signal;
  if(!Number.isSafeInteger(issued)||!Number.isSafeInteger(expires)||issued>=expires||!Number.isSafeInteger(authority.deadlineMs))deny('DEADLINE');
  const deadlineMs=Math.min(authority.deadlineMs,expires);
  if(signal!==undefined){if(types.isProxy(signal))deny('INVALID_ARGUMENTS');try{aborted.call(signal);}catch{deny('INVALID_ARGUMENTS');}}
  const active=(cutoff=deadlineMs)=>{const stamp=now();if(signal!==undefined&&aborted.call(signal))deny('CANCELLED');
    if(!Number.isSafeInteger(stamp)||stamp<issued||stamp<0||stamp>=Math.min(cutoff,deadlineMs))deny('DEADLINE');return stamp;};
  const stamp=active();
  const suppliedContext=fields.normalizationContext===undefined?
    frozenData(operation.id==='query_tasks'?{nowMs:stamp,actorId:binding.actorId}:{actorId:binding.actorId}):frozenData(fields.normalizationContext);
  ownFields(suppliedContext,operation.id==='query_tasks'?['nowMs','actorId']:['actorId'],operation.id==='query_tasks'?[]:['nowMs']);
  if(suppliedContext.actorId!==binding.actorId||Object.hasOwn(suppliedContext,'nowMs')&&
      (!Number.isSafeInteger(suppliedContext.nowMs)||suppliedContext.nowMs<issued||suppliedContext.nowMs>stamp))deny('ACCESS_DENIED');
  const normalizationContext=operation.id==='query_tasks'?suppliedContext:frozenData({actorId:suppliedContext.actorId});
  let normalized;try{normalized=contract.normalizeInput(request,normalizationContext);}catch{deny('INVALID_ARGUMENTS');}
  if(!same(input,normalized.input))deny('INVALID_ARGUMENTS');
  if(input.clientId===null){if(operation.id!=='query_tasks'||subject.kind!=='portfolio')deny('ACCESS_DENIED');}
  else if(subject.kind!=='client'||subject.entityType!=='client'||subject.entityIds.length!==1||subject.entityIds[0]!==input.clientId)deny('ACCESS_DENIED');
  active();return {operation,contract,input,request,authority,normalizationContext,argumentsSha256:normalized.argumentsSha256,
    invocationId:fields.invocationId,deadlineMs,signal,active};
}
