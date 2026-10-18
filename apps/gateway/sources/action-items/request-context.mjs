/** Pure correlation at an internal source boundary; current authorization stays in the gateway. */
import {types} from 'node:util';
import {canonicalSha256,validateShape as publicShape} from '../../../../packages/contracts/validate.mjs';
import {assertSubject,resolveOperationContract} from '../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {ownFields,frozenData} from '../source-admission.mjs';
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
  ownFields(authority,['binding','subject','claims','policyRevision','decision','sourceIds','deadlineMs']);
  publicShape('RunBinding',authority.binding);publicShape('CapabilityClaims',authority.claims);
  publicShape('AuthorizationDecision',authority.decision);
  assertSubject(authority.subject,authority.binding);
  const {binding,subject,claims,decision}=authority;
  if(!same(binding,claims.binding)||authority.policyRevision!==subject.policyRevision||
      authority.policyRevision!==claims.policyRevision||authority.policyRevision!==decision.policyRevision||
      claims.audience!=='meri-gateway'||!claims.actions.includes('tool.read')||
      decision.decision!=='allowed'||decision.operation!==`${operation.id}@${operation.version}`||
      decision.decisionId!==subject.authorizationDecisionId||
      !same(decision.actor,{tenantId:binding.tenantId,actorId:binding.actorId})||
      !same(decision.scopes,subject.scopes)||
      claims.scopes.some(scope=>scope.tenantId!==binding.tenantId||scope.policyRevision!==authority.policyRevision)||
      subject.scopes.some(scope=>!claims.scopes.some(parent=>same(scope,parent)))||
      !Array.isArray(authority.sourceIds)||!same([...authority.sourceIds].sort(),
        [...new Set(contract.descriptor.sourceRequirements.map(source=>source.sourceId))].sort()))deny('ACCESS_DENIED');
  const reference=typeof request.clientId==='string'?request.clientId.trim():null;
  if(input.mode!=='client_scoped'||!reference||!UUID.test(reference)||subject.kind!=='client'||
      subject.entityType!=='client'||reference.toLowerCase()!==subject.entityIds[0]||
      input.selection?.clientId!==subject.entityIds[0])deny('ACCESS_DENIED');
  const clientResolution={reference,clientId:subject.entityIds[0]};
  const options=frozenData({binding:authority.binding,clientResolution});
  let normalized;try{normalized=contract.normalizeInput(request,options);}catch{deny('INVALID_ARGUMENTS');}
  if(!same(normalized.input,input)||normalized.metadata!==null)deny('INVALID_ARGUMENTS');
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
  return {input,request,authority,options,metadata:normalized.metadata,invocationId:fields.invocationId,
    argumentsSha256:normalized.argumentsSha256,requestSha256:canonicalSha256({input,metadata:normalized.metadata}),
    signal,deadlineMs,active};
}
