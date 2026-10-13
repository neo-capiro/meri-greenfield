/** Pure correlation at an internal source boundary; current authorization stays in the gateway. */
import {types} from 'node:util';
import {canonicalSha256,validateShape as publicShape} from '../../../../packages/contracts/validate.mjs';
import {assertSubject,normalizeActionItemsCompleteInput} from '../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {ownFields,frozenData} from '../source-admission.mjs';
import {deny} from '../../dispatch/operation-result.mjs';
export {ownFields,frozenData} from '../source-admission.mjs';
export const operation=Object.freeze({id:'actions.query',version:'0.2.0'});
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const aborted=Object.getOwnPropertyDescriptor(AbortSignal.prototype,'aborted').get;

export function readContext(call,now) {
  const fields=ownFields(call,['input','request','authority'],['signal']);
  const input=frozenData(fields.input),request=frozenData(fields.request),authority=frozenData(fields.authority);
  publicShape('RunBinding',authority.binding);publicShape('CapabilityClaims',authority.claims);
  assertSubject(authority.subject,authority.binding);
  if(canonicalSha256(authority.binding)!==canonicalSha256(authority.claims.binding)||
      authority.policyRevision!==authority.subject.policyRevision||authority.policyRevision!==authority.claims.policyRevision)deny('ACCESS_DENIED');
  let clientResolution=null;
  if(input.mode==='client_scoped') {
    const reference=typeof request.clientId==='string'?request.clientId.trim():null;
    if(!reference||!UUID.test(reference)||authority.subject.kind!=='client'||
        reference.toLowerCase()!==authority.subject.entityIds[0])deny('ACCESS_DENIED');
    clientResolution={reference,clientId:authority.subject.entityIds[0]};
  }
  const options=frozenData({binding:authority.binding,clientResolution});
  if(canonicalSha256(normalizeActionItemsCompleteInput(request,options))!==canonicalSha256(input))deny('INVALID_ARGUMENTS');
  const expiry=Date.parse(authority.claims.expiresAt),issued=Date.parse(authority.claims.issuedAt);
  if(!Number.isSafeInteger(expiry)||!Number.isSafeInteger(issued)||!Number.isSafeInteger(authority.deadlineMs)||issued>=expiry)deny('DEADLINE');
  const deadlineMs=Math.min(expiry,authority.deadlineMs),signal=fields.signal;
  if(signal!==undefined) {
    if(types.isProxy(signal))deny('INVALID_ARGUMENTS');
    try{aborted.call(signal);}catch{deny('INVALID_ARGUMENTS');}
  }
  function active(cutoff=deadlineMs) {
    const stamp=now();
    if(signal!==undefined&&aborted.call(signal))deny('CANCELLED');
    if(!Number.isSafeInteger(stamp)||stamp<0||stamp<issued||stamp>=Math.min(deadlineMs,cutoff))deny('DEADLINE');
    return stamp;
  }
  active();
  return {input,request,authority,options,signal,deadlineMs,active};
}
