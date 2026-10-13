/** Client-knowledge admission; the gateway remains the current authorization owner. */
import {types} from 'node:util';
import {canonicalSha256,validateShape as publicShape} from '../../../../packages/contracts/validate.mjs';
import {assertSubject,resolveOperationContract} from '../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {deny} from '../../dispatch/operation-result.mjs';
import {frozenData,ownFields} from '../source-admission.mjs';
export {frozenData,ownFields} from '../source-admission.mjs';
export const operationIds=Object.freeze(['search_memory','read_monday_client_boards']);
const aborted=Object.getOwnPropertyDescriptor(AbortSignal.prototype,'aborted').get;
export const same=(a,b)=>canonicalSha256(a)===canonicalSha256(b);
export function knowledgeContract(reference) {
  const operation=frozenData(ownFields(reference,['id','version']));
  if(!operationIds.includes(operation.id)||operation.version!=='0.2.0')deny('GATEWAY_CONFIGURATION');
  return {operation,contract:resolveOperationContract(operation)};
}
export function readContext(call,now) {
  const fields=ownFields(call,['operation','input','request','authority','normalizationContext'],['signal']);
  const {operation,contract}=knowledgeContract(fields.operation);
  let input,request,authority,normalizationContext;
  try {input=frozenData(fields.input);request=frozenData(fields.request);authority=frozenData(fields.authority);
    normalizationContext=frozenData(fields.normalizationContext);}catch {deny('INVALID_ARGUMENTS');}
  try {
    ownFields(authority,['binding','subject','claims','policyRevision','decision','sourceIds','deadlineMs']);
    publicShape('RunBinding',authority.binding);publicShape('CapabilityClaims',authority.claims);
    publicShape('AuthorizationDecision',authority.decision);assertSubject(authority.subject,authority.binding);
  }catch {deny('ACCESS_DENIED');}
  const {claims,subject,decision}=authority;
  if(!same(authority.binding,claims.binding)||authority.policyRevision!==claims.policyRevision||
      authority.policyRevision!==subject.policyRevision||authority.policyRevision!==decision.policyRevision||
      claims.audience!=='meri-gateway'||!claims.actions.includes('tool.read')||decision.decision!=='allowed'||
      decision.operation!==`${operation.id}@${operation.version}`||decision.decisionId!==subject.authorizationDecisionId||
      !same(decision.actor,{tenantId:authority.binding.tenantId,actorId:authority.binding.actorId})||
      !same(decision.scopes,subject.scopes)||subject.scopes.some(scope=>!claims.scopes.some(parent=>same(scope,parent)))||
      claims.scopes.some(scope=>scope.tenantId!==authority.binding.tenantId||scope.policyRevision!==authority.policyRevision)||
      !Array.isArray(authority.sourceIds)||!same([...authority.sourceIds].sort(),
        [...new Set(contract.descriptor.sourceRequirements.map(source=>source.sourceId))].sort()))deny('ACCESS_DENIED');
  if(operation.id==='search_memory'&&!same(normalizationContext,{tenantId:authority.binding.tenantId,userId:authority.binding.actorId}))deny('ACCESS_DENIED');
  const issued=Date.parse(claims.issuedAt),expiry=Date.parse(claims.expiresAt),signal=fields.signal;
  if(!Number.isSafeInteger(issued)||!Number.isSafeInteger(expiry)||issued>=expiry||!Number.isSafeInteger(authority.deadlineMs))deny('DEADLINE');
  const deadlineMs=Math.min(expiry,authority.deadlineMs);
  if(signal!==undefined) {if(types.isProxy(signal))deny('INVALID_ARGUMENTS');try {aborted.call(signal);}catch {deny('INVALID_ARGUMENTS');}}
  const active=(cutoff=deadlineMs)=>{
    const stamp=now();if(signal!==undefined&&aborted.call(signal))deny('CANCELLED');
    if(!Number.isSafeInteger(stamp)||stamp<0||stamp<issued||stamp>=Math.min(deadlineMs,cutoff))deny('DEADLINE');return stamp;
  };
  active();let normalized;
  try {normalized=contract.normalizeInput(request,normalizationContext);}catch {deny('INVALID_ARGUMENTS');}
  if(!same(normalized.input,input))deny('INVALID_ARGUMENTS');
  if(input.clientId!==null ? subject.kind!=='client'||subject.entityIds[0]!==input.clientId : subject.kind!=='personal')deny('ACCESS_DENIED');
  const metadata=normalized.metadata;
  return {operation,contract,input,request,authority,normalizationContext,metadata,signal,deadlineMs,active,
    argumentsSha256:normalized.argumentsSha256,requestSha256:canonicalSha256({input,metadata})};
}
export function requestPins(context) {
  return Object.freeze({operation:context.operation,input:context.input,metadata:context.metadata,
    normalizationContext:context.normalizationContext,argumentsSha256:context.argumentsSha256,requestSha256:context.requestSha256,
    binding:context.authority.binding,subject:context.authority.subject,policyRevision:context.authority.policyRevision,
    sourceIds:context.authority.sourceIds});
}
export function assertPins(receipt,pins) {
  if(['operation','metadata','normalizationContext','binding','subject','sourceIds'].some(k=>!same(receipt[k],pins[k]))||
      receipt.argumentsSha256!==pins.argumentsSha256||receipt.requestSha256!==pins.requestSha256||
      receipt.policyRevision!==pins.policyRevision)deny('ACCESS_DENIED');
}
export function assertResult(result,context) {
  context.active();try {context.contract.assertOutput(result,{request:context.request,...context.normalizationContext});}
  catch {deny('INVALID_RESULT');}context.active();return result;
}
