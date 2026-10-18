/** Inert internal call correlation; the existing gateway owns current authorization. */
import {types} from 'node:util';
import {canonicalSha256,validateShape as publicShape} from '../../../../packages/contracts/validate.mjs';
import {assertSubject,resolveOperationContract} from '../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {deny} from '../../dispatch/operation-result.mjs';
import {frozenData,ownFields} from '../source-admission.mjs';
export {frozenData,ownFields} from '../source-admission.mjs';

export const operationIds=Object.freeze(['meeting.list_upcoming_meetings','meeting.query_debriefs','meeting.read_client_meetings']);
const aborted=Object.getOwnPropertyDescriptor(AbortSignal.prototype,'aborted').get;
const same=(left,right)=>canonicalSha256(left)===canonicalSha256(right);
export function meetingContract(reference) {
  const operation=frozenData(ownFields(reference,['id','version']));
  if(!operationIds.includes(operation.id)||operation.version!=='0.2.0')deny('GATEWAY_CONFIGURATION');
  return {operation,contract:resolveOperationContract(operation)};
}
export function readContext(call,now) {
  const fields=ownFields(call,['operation','input','request','authority'],['signal','invocationId']);
  if(fields.invocationId!==undefined&&
      (typeof fields.invocationId!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(fields.invocationId)))deny('INVALID_ARGUMENTS');
  const {operation,contract}=meetingContract(fields.operation);
  let input,request,authority;
  try {input=frozenData(fields.input);request=frozenData(fields.request);authority=frozenData(fields.authority);}
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
  const options=frozenData({nowMs:active()});
  let normalized;
  try {normalized=contract.normalizeInput(request,options);}catch {deny('INVALID_ARGUMENTS');}
  if(!same(normalized.input,input))deny('INVALID_ARGUMENTS');
  const clientId=input.clientId;
  if(clientId!==null ? subject.kind!=='client'||subject.entityIds[0]!==clientId :
      subject.kind!=='personal'||subject.entityIds[0]!==authority.binding.actorId)deny('ACCESS_DENIED');
  return {operation,contract,input,request,authority,options,metadata:normalized.metadata,invocationId:fields.invocationId,
    argumentsSha256:normalized.argumentsSha256,signal,deadlineMs,active};
}
export function assertMeetingResult(result,context) {
  try {context.contract.assertOutput(result,{request:context.request,...context.options});}
  catch {deny('INVALID_RESULT');}
  if(!same(result.binding,context.authority.binding)||!same(result.subject,context.authority.subject)||
      !same([...result.coverage.sourcesRequested].sort(),[...context.authority.sourceIds].sort()))deny('INVALID_RESULT');
  if(context.operation.id==='meeting.list_upcoming_meetings'&&context.input.clientId!==null&&
      result.meetings.some(meeting=>meeting.client?.id!==context.input.clientId))deny('INVALID_RESULT');
  if(context.operation.id==='meeting.query_debriefs'&&
      result.debriefs.some(debrief=>debrief.status!=='approved'))deny('INVALID_RESULT');
  // The transport's returned byte count refers to these exact UTF-8 bytes.
  if(result.source?.provenance?.returnedByteLength!==undefined&&
      result.source.provenance.returnedByteLength!==Buffer.byteLength(result.source.body,'utf8'))deny('INVALID_RESULT');
  context.active();return result;
}
