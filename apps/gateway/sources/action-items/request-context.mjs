/** Pure correlation at an internal source boundary; current authorization stays in the gateway. */
import {types} from 'node:util';
import {canonicalSha256} from '../../../../packages/contracts/validate.mjs';
import {resolveOperationContract} from '../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {ownFields,frozenData,assertReadContext} from '../source-admission.mjs';
import {deny} from '../../dispatch/operation-result.mjs';
export {ownFields,frozenData} from '../source-admission.mjs';
export const operation=Object.freeze({id:'actions.query',version:'0.2.0'});
export const contract=resolveOperationContract(operation);
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const aborted=Object.getOwnPropertyDescriptor(AbortSignal.prototype,'aborted').get;
const same=(left,right)=>canonicalSha256(left)===canonicalSha256(right);

export function readContext(call,now) {
  const fields=ownFields(call,['input','request','authority','invocationId'],['signal']);
  if(typeof fields.invocationId!=='string'||!/^[A-Za-z0-9_-]{1,128}$/u.test(fields.invocationId))deny('ACCESS_DENIED');
  const input=frozenData(fields.input),request=frozenData(fields.request),authority=frozenData(fields.authority);
  assertReadContext(authority,operation,now);
 const {binding,subject}=authority;
  const reference=typeof request.clientId==='string'?request.clientId.trim():null;
  if(input.mode!=='client_scoped'||!reference||!UUID.test(reference)||subject.kind!=='client'||
      subject.entityType!=='client'||reference.toLowerCase()!==subject.entityIds[0]||
      input.selection?.clientId!==subject.entityIds[0])deny('ACCESS_DENIED');
  const clientResolution={reference,clientId:subject.entityIds[0]};
  const options=frozenData({binding:authority.binding,clientResolution});
  let normalized;try{normalized=contract.normalizeInput(request,options);}catch{deny('INVALID_ARGUMENTS');}
  if(!same(normalized.input,input)||normalized.metadata!==null)deny('INVALID_ARGUMENTS');
 const deadlineMs=authority.deadlineMs,signal=fields.signal;
  if(signal!==undefined) {
    if(types.isProxy(signal))deny('INVALID_ARGUMENTS');
    try{aborted.call(signal);}catch{deny('INVALID_ARGUMENTS');}
  }
  function active(cutoff=deadlineMs) {
    const stamp=now();
    if(signal!==undefined&&aborted.call(signal))deny('CANCELLED');
    if(!Number.isSafeInteger(stamp)||stamp<0||stamp>=Math.min(deadlineMs,cutoff))deny('DEADLINE');
    return stamp;
  }
  active();
  return {input,request,authority,options,metadata:normalized.metadata,invocationId:fields.invocationId,
    argumentsSha256:normalized.argumentsSha256,requestSha256:canonicalSha256({input,metadata:normalized.metadata}),
    signal,deadlineMs,active};
}
