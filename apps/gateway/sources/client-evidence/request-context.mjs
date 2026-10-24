/** Inert internal call correlation; the existing gateway owns current authorization. */
import {types} from 'node:util';
import {canonicalSha256} from '../../../../packages/contracts/validate.mjs';
import {resolveOperationContract} from '../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {deny} from '../../dispatch/operation-result.mjs';
import {frozenData,ownFields,assertReadContext} from '../source-admission.mjs';
export {frozenData,ownFields} from '../source-admission.mjs';

export const operationIds=Object.freeze(['get_client_context','read_client_documents']);
const aborted=Object.getOwnPropertyDescriptor(AbortSignal.prototype,'aborted').get;
const same=(left,right)=>canonicalSha256(left)===canonicalSha256(right);
const profileClockSkewMs=5000;
export function clientEvidenceContract(reference) {
  const operation=frozenData(ownFields(reference,['id','version']));
  if(!operationIds.includes(operation.id)||operation.version!==(operation.id==='get_client_context'?'0.3.0':'0.2.0'))deny('GATEWAY_CONFIGURATION');
  return {operation,contract:resolveOperationContract(operation)};
}
export function readContext(call,now) {
  const fields=ownFields(call,['operation','input','request','authority','normalizationContext'],['signal','invocationId']);
  if(fields.invocationId!==undefined&&
      (typeof fields.invocationId!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(fields.invocationId)))deny('INVALID_ARGUMENTS');
  const {operation,contract}=clientEvidenceContract(fields.operation);
  let input,request,authority,options;
  try {input=frozenData(fields.input);request=frozenData(fields.request);authority=frozenData(fields.authority);options=frozenData(fields.normalizationContext);}
  catch {deny('INVALID_ARGUMENTS');}
  assertReadContext(authority,operation,now);
  const {subject}=authority;
 const deadlineMs=authority.deadlineMs,signal=fields.signal;
  if(signal!==undefined) {
    if(types.isProxy(signal))deny('INVALID_ARGUMENTS');
    try {aborted.call(signal);}catch {deny('INVALID_ARGUMENTS');}
  }
  const active=(cutoff=deadlineMs)=>{
    const stamp=now();
    if(signal!==undefined&&aborted.call(signal))deny('CANCELLED');
    if(!Number.isSafeInteger(stamp)||stamp<0||stamp>=Math.min(deadlineMs,cutoff))deny('DEADLINE');
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
  return {operation,contract,input,request,authority,options,metadata:normalized.metadata,invocationId:fields.invocationId,
    argumentsSha256:normalized.argumentsSha256,signal,deadlineMs,active};
}
export function assertClientEvidenceResult(result,context,{receivedAtMs,deadlineMs=context.deadlineMs}={}) {
  try {context.contract.assertOutput(result,{request:context.request,...context.options});}
  catch {deny('INVALID_RESULT');}
  if(context.operation.id==='get_client_context') {
    if(result.context.client.tenantId!==context.authority.binding.tenantId)deny('INVALID_RESULT');
    const receivedAt=receivedAtMs??context.active(),startedAt=Date.parse(result.readWindow.startedAt),
      completedAt=Date.parse(result.readWindow.completedAt);
    if(!Number.isSafeInteger(receivedAt)||!Number.isSafeInteger(deadlineMs)||
        startedAt<Date.parse(context.options.asOf)-profileClockSkewMs||
        completedAt>receivedAt+profileClockSkewMs||
        completedAt>Math.min(context.deadlineMs,deadlineMs)+profileClockSkewMs)deny('INVALID_RESULT');
  }else if(!same(result.binding,context.authority.binding)||!same(result.subject,context.authority.subject))deny('INVALID_RESULT');
  context.active();return result;
}
