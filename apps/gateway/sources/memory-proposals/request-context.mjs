/** Internal dispatch data admission. This does not authenticate a caller. */
import { types } from 'node:util';
import { canonicalSha256, validateShape as publicShape } from '../../../../packages/contracts/validate.mjs';
import { assertSubject, validateShape } from '../../../../packages/contracts/retrieval-0.2/validate.mjs';
import { snapshotOperationData } from '../../../../packages/contracts/retrieval-0.2/operation-contracts.mjs';
import { deny } from '../../dispatch/operation-result.mjs';

export const operation = Object.freeze({id:'memory.list_own_proposals',version:'0.2.0'});
export function ownFields(value, required, optional=[]) {
  if (!value || typeof value!=='object' || types.isProxy(value) || Array.isArray(value) ||
      ![Object.prototype,null].includes(Object.getPrototypeOf(value))) deny('INVALID_ARGUMENTS');
  const descriptors=Object.getOwnPropertyDescriptors(value), names=Reflect.ownKeys(descriptors);
  if (names.some(key=>typeof key!=='string'||!required.concat(optional).includes(key)||
      !descriptors[key].enumerable||!Object.hasOwn(descriptors[key],'value'))||required.some(key=>!Object.hasOwn(descriptors,key))) deny('INVALID_ARGUMENTS');
  return Object.fromEntries(names.map(key=>[key,descriptors[key].value]));
}
export function frozenData(value) {
  const copied=snapshotOperationData(value), pending=[copied];
  while(pending.length){const item=pending.pop();if(item&&typeof item==='object'){pending.push(...Object.values(item));Object.freeze(item);}}
  return copied;
}
export function readContext(call, now) {
  const fields=ownFields(call,['input','authority'],['signal']);
  const input=frozenData(fields.input), authority=frozenData(fields.authority);
  validateShape('MemoryProposalSelection',input);
  publicShape('RunBinding',authority.binding);publicShape('CapabilityClaims',authority.claims);
  assertSubject(authority.subject,authority.binding);
  if(!['personal','client'].includes(authority.subject.kind)||authority.policyRevision!==authority.subject.policyRevision||
      canonicalSha256(authority.binding)!==canonicalSha256(authority.claims.binding)||
      input.clientId!==(authority.subject.kind==='client'?authority.subject.entityIds[0]:null)) deny('ACCESS_DENIED');
  const expiry=Date.parse(authority.claims.expiresAt), deadlineMs=Math.min(authority.deadlineMs,expiry);
  if(!Number.isSafeInteger(authority.deadlineMs)||!Number.isSafeInteger(expiry)||!Number.isSafeInteger(now())||deadlineMs<=now()) deny('DEADLINE');
  if(fields.signal!==undefined){
    if(types.isProxy(fields.signal))deny('INVALID_ARGUMENTS');
    try{Object.getOwnPropertyDescriptor(AbortSignal.prototype,'aborted').get.call(fields.signal);}catch{deny('INVALID_ARGUMENTS');}
    if(fields.signal.aborted)deny('CANCELLED');
  }
  return {input,authority,signal:fields.signal,deadlineMs};
}
