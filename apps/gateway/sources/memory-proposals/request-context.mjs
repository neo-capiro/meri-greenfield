/** Exact selected-client proposal source correlation. The dispatcher owns current
 * authorization, continuation admission, reservation, settlement and release. */
import {types} from 'node:util';
import {canonicalSha256} from '../../../../packages/contracts/validate.mjs';
import {resolveOperationContract,validateShape} from '../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {ownFields,frozenData,assertReadContext} from '../source-admission.mjs';
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
 assertReadContext(authority,operation,now);
 const {binding,subject}=authority;
 if(subject.kind!=='client'||subject.entityType!=='client'||subject.entityIds.length!==1||input.clientId!==subject.entityIds[0]||subject.scopes.length!==1||subject.scopes[0].kind!=='client'||subject.scopes[0].resourceId!==input.clientId)deny('ACCESS_DENIED');
 const deadlineMs=authority.deadlineMs,signal=fields.signal;
 if(signal!==undefined){
  if(types.isProxy(signal))deny('INVALID_ARGUMENTS');
  try{aborted.call(signal);}catch{deny('INVALID_ARGUMENTS');}
 }
 function active(cutoff=deadlineMs){
  const stamp=now();
  if(signal!==undefined&&aborted.call(signal))deny('CANCELLED');
  if(!Number.isSafeInteger(stamp)||stamp>=Math.min(deadlineMs,cutoff))deny('DEADLINE');
  return stamp;
 }
 active();
 const metadata=null,argumentsSha256=canonicalSha256(input);
 return {input,authority,metadata,argumentsSha256,requestSha256:canonicalSha256({input,metadata}),
  invocationId:fields.invocationId,signal,deadlineMs,active};
}
