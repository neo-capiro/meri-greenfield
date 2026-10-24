/** Correlation only: existing gateway/current producer policy owns authorization. */
import {types} from 'node:util';
import {canonicalSha256} from '../../../../packages/contracts/validate.mjs';
import {resolveOperationContract} from '../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {assertResultLineage,deny} from '../../dispatch/operation-result.mjs';
import {frozenData,ownFields,assertReadContext} from '../source-admission.mjs';
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
 const fields=ownFields(call,['operation','input','request','authority','normalizationContext'],['signal','invocationId']);
 if(fields.invocationId!==undefined&&
    (typeof fields.invocationId!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(fields.invocationId)))deny('INVALID_ARGUMENTS');
 const {operation,contract}=identityContactsContract(fields.operation);
 const input=frozenData(fields.input),request=frozenData(fields.request),normalizationContext=frozenData(fields.normalizationContext);
 const authority=frozenData(fields.authority);assertReadContext(authority,operation,now);
 const {binding,subject}=authority;
 const deadlineMs=authority.deadlineMs,signal=fields.signal;
 if(signal!==undefined){if(types.isProxy(signal))deny('INVALID_ARGUMENTS');try{aborted.call(signal);}catch{deny('INVALID_ARGUMENTS');}}
 function active(cutoff=deadlineMs){const stamp=now();if(signal!==undefined&&aborted.call(signal))deny('CANCELLED');
  if(!Number.isSafeInteger(stamp)||stamp<0||stamp>=Math.min(cutoff,deadlineMs))deny('DEADLINE');return stamp;}
 active();let normalized;try{normalized=contract.normalizeInput(request,normalizationContext);}catch{deny('INVALID_ARGUMENTS');}
 if(!same(normalized.input,input))deny('INVALID_ARGUMENTS');
 if(operation.id==='find_contacts'&&input.clientId!==null&&(subject.kind!=='client'||subject.entityIds[0]!==input.clientId))deny('ACCESS_DENIED');
 return {operation,contract,input,request,authority,normalizationContext,metadata:normalized.metadata,invocationId:fields.invocationId,
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
