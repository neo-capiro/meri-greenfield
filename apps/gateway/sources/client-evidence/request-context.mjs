/** Inert internal call correlation; the existing gateway owns current authorization. */
import {types} from 'node:util';
import {canonicalSha256,validateShape as publicShape} from '../../../../packages/contracts/validate.mjs';
import {assertSubject,resolveOperationContract} from '../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {deny} from '../../dispatch/operation-result.mjs';
import {frozenData,ownFields} from '../source-admission.mjs';
export {frozenData,ownFields} from '../source-admission.mjs';

export const operationIds=Object.freeze(['get_client_context','read_client_documents']);
const aborted=Object.getOwnPropertyDescriptor(AbortSignal.prototype,'aborted').get;
const same=(left,right)=>canonicalSha256(left)===canonicalSha256(right);
export function clientEvidenceContract(reference) {
  const operation=frozenData(ownFields(reference,['id','version']));
  if(!operationIds.includes(operation.id)||operation.version!=='0.2.0')deny('GATEWAY_CONFIGURATION');
  return {operation,contract:resolveOperationContract(operation)};
}
export function readContext(call,now) {
  const fields=ownFields(call,['operation','input','request','authority','normalizationContext'],['signal']);
  const {operation,contract}=clientEvidenceContract(fields.operation);
  let input,request,authority,options;
  try {input=frozenData(fields.input);request=frozenData(fields.request);authority=frozenData(fields.authority);options=frozenData(fields.normalizationContext);}
  catch {deny('INVALID_ARGUMENTS');}
  ownFields(authority,['binding','subject','claims','policyRevision','decision','sourceIds','deadlineMs']);
  try {
    publicShape('RunBinding',authority.binding);publicShape('CapabilityClaims',authority.claims);
    publicShape('AuthorizationDecision',authority.decision);assertSubject(authority.subject,authority.binding);
  } catch {deny('ACCESS_DENIED');}
  const {claims,subject,decision}=authority;
  if(!same(authority.binding,claims.binding)||authority.policyRevision!==claims.policyRevision||
      authority.policyRevision!==subject.policyRevision||authority.policyRevision!==decision.policyRevision||
      claims.audience!=='meri-gateway'||!claims.actions.includes('tool.read')||decision.decision!=='allowed'||
      decision.operation!==`${operation.id}@${operation.version}`||decision.decisionId!==subject.authorizationDecisionId||
      !same(decision.actor,{tenantId:authority.binding.tenantId,actorId:authority.binding.actorId})||
      !same(decision.scopes,subject.scopes)||subject.scopes.some(scope=>!claims.scopes.some(candidate=>same(candidate,scope)))||
      !Array.isArray(authority.sourceIds)||!same([...authority.sourceIds].sort(),
        [...new Set(contract.descriptor.sourceRequirements.map(source=>source.sourceId))].sort()))deny('ACCESS_DENIED');
  const issued=Date.parse(claims.issuedAt),expiry=Date.parse(claims.expiresAt);
  if(!Number.isSafeInteger(issued)||!Number.isSafeInteger(expiry)||issued>=expiry||
      !Number.isSafeInteger(authority.deadlineMs)||authority.deadlineMs<0)deny('DEADLINE');
  const deadlineMs=Math.min(authority.deadlineMs,expiry),signal=fields.signal;
  if(signal!==undefined) {
    if(types.isProxy(signal))deny('INVALID_ARGUMENTS');
    try {aborted.call(signal);}catch {deny('INVALID_ARGUMENTS');}
  }
  const active=(cutoff=deadlineMs)=>{
    const stamp=now();
    if(signal!==undefined&&aborted.call(signal))deny('CANCELLED');
    if(!Number.isSafeInteger(stamp)||stamp<0||stamp<issued||stamp>=Math.min(deadlineMs,cutoff))deny('DEADLINE');
    return stamp;
  };
  active();
  if(operation.id==='read_client_documents'&&(!same(options.binding,authority.binding)||!same(options.subject,authority.subject)))deny('ACCESS_DENIED');
  if(operation.id==='get_client_context'&&(!Number.isSafeInteger(Date.parse(options.asOf))||Date.parse(options.asOf)>active()))deny('INVALID_ARGUMENTS');
  let normalized;
  try {normalized=contract.normalizeInput(request,options);}catch {deny('INVALID_ARGUMENTS');}
  if(!same(normalized.input,input))deny('INVALID_ARGUMENTS');
  const clientId=input.clientId;
  if(subject.kind!=='client'||subject.entityType!=='client'||subject.entityIds[0]!==clientId)deny('ACCESS_DENIED');
  return {operation,contract,input,request,authority,options,metadata:normalized.metadata,
    argumentsSha256:normalized.argumentsSha256,signal,deadlineMs,active};
}
export function assertClientEvidenceResult(result,context) {
  try {context.contract.assertOutput(result,{request:context.request,...context.options});}
  catch {deny('INVALID_RESULT');}
  if(context.operation.id==='get_client_context') {
    if(result.context.client.tenantId!==context.authority.binding.tenantId)deny('INVALID_RESULT');
  }else if(!same(result.binding,context.authority.binding)||!same(result.subject,context.authority.subject))deny('INVALID_RESULT');
  context.active();return result;
}
