/** Inert correlation only; current authorization and budget remain gateway-owned. */
import {types} from 'node:util';
import {canonicalSha256} from '../../../../packages/contracts/validate.mjs';
import {resolveOperationContract} from '../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {deny} from '../../dispatch/operation-result.mjs';
import {ownFields,frozenData,assertReadContext} from '../source-admission.mjs';
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
  if(fields.invocationId!==undefined&&(typeof fields.invocationId!=='string'||
      !/^[A-Za-z0-9_-]{1,128}$/u.test(fields.invocationId)))deny('ACCESS_DENIED');
  const input=frozenData(fields.input),request=frozenData(fields.request);
 const authority=frozenData(fields.authority);assertReadContext(authority,operation,now);
 const {binding,subject}=authority;
 const deadlineMs=authority.deadlineMs,signal=fields.signal;
  if(signal!==undefined){if(types.isProxy(signal))deny('INVALID_ARGUMENTS');try{aborted.call(signal);}catch{deny('INVALID_ARGUMENTS');}}
  const active=(cutoff=deadlineMs)=>{const stamp=now();if(signal!==undefined&&aborted.call(signal))deny('CANCELLED');
    if(!Number.isSafeInteger(stamp)||stamp<0||stamp>=Math.min(cutoff,deadlineMs))deny('DEADLINE');return stamp;};
  const stamp=active();
  const suppliedContext=fields.normalizationContext===undefined?
    frozenData(operation.id==='query_tasks'?{nowMs:stamp,actorId:binding.actorId}:{actorId:binding.actorId}):frozenData(fields.normalizationContext);
  ownFields(suppliedContext,operation.id==='query_tasks'?['nowMs','actorId']:['actorId'],operation.id==='query_tasks'?[]:['nowMs']);
  if(suppliedContext.actorId!==binding.actorId||Object.hasOwn(suppliedContext,'nowMs')&&
      (!Number.isSafeInteger(suppliedContext.nowMs)||suppliedContext.nowMs<0||suppliedContext.nowMs>stamp))deny('ACCESS_DENIED');
  const normalizationContext=operation.id==='query_tasks'?suppliedContext:frozenData({actorId:suppliedContext.actorId});
  let normalized;try{normalized=contract.normalizeInput(request,normalizationContext);}catch{deny('INVALID_ARGUMENTS');}
  if(!same(input,normalized.input))deny('INVALID_ARGUMENTS');
  // Core's authorized_tasks read applies current actor/client walls per result.
  // General retains its canonical personal subject; it needs no synthetic roster.
  if(input.clientId===null){if(operation.id!=='query_tasks'||!['portfolio','personal'].includes(subject.kind))deny('ACCESS_DENIED');}
  else if(subject.kind!=='client'||subject.entityType!=='client'||subject.entityIds.length!==1||subject.entityIds[0]!==input.clientId)deny('ACCESS_DENIED');
  active();return {operation,contract,input,request,authority,normalizationContext,argumentsSha256:normalized.argumentsSha256,
    invocationId:fields.invocationId,deadlineMs,signal,active};
}
