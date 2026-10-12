/** Internal dispatch data admission. This does not authenticate a caller. */
import { types } from 'node:util';
import { canonicalSha256, validateShape as publicShape } from '../../../../packages/contracts/validate.mjs';
import { assertSubject, validateShape } from '../../../../packages/contracts/retrieval-0.2/validate.mjs';
import { ownFields, frozenData } from '../source-admission.mjs';
export { ownFields, frozenData } from '../source-admission.mjs';
import { deny } from '../../dispatch/operation-result.mjs';

export const operation = Object.freeze({id:'memory.list_own_proposals',version:'0.2.0'});
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
