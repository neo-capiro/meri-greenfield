/** Admission shared by the three retained source reads; never derives authority from arguments. */
import {canonicalSha256,validateShape} from '../../../../packages/contracts/validate.mjs';
import {assertSubject,resolveOperationContract} from '../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {nativeSignal} from '../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {ownFields,frozenData} from '../source-admission.mjs';
import {deny} from '../../dispatch/operation-result.mjs';
const same=(a,b)=>canonicalSha256(a)===canonicalSha256(b);
export function retainedCall(operation,call,now){
 const {signal,...fields}=ownFields(call,['input','request','authority','argumentsSha256','normalizationContext'],['signal']);
 nativeSignal(signal);if(signal?.aborted)deny('CANCELLED');
 const c=frozenData(fields),contract=resolveOperationContract(operation),a=c.authority;
 validateShape('RunBinding',a.binding);validateShape('CapabilityClaims',a.claims);assertSubject(a.subject,a.binding);
 if(!same(a.binding,a.claims.binding)||a.policyRevision!==a.claims.policyRevision||a.policyRevision!==a.subject.policyRevision||
  !same([...a.sourceIds].sort(),[...new Set(contract.descriptor.sourceRequirements.map(s=>s.sourceId))].sort()))deny('ACCESS_DENIED');
 const normalized=contract.normalizeInput(c.request,c.normalizationContext);
 if(!same(c.input,normalized.input)||c.argumentsSha256!==normalized.argumentsSha256)deny('INVALID_ARGUMENTS');
 const expires=Date.parse(a.claims.expiresAt),deadlineMs=Math.min(a.deadlineMs,expires);
 if(!Number.isSafeInteger(a.deadlineMs)||!Number.isSafeInteger(expires)||!Number.isSafeInteger(now())||deadlineMs<=now())deny('DEADLINE');
 return {...c,operation,contract,signal,deadlineMs};
}
export function credentialProof(c,origin){return frozenData({binding:c.authority.binding,subject:c.authority.subject,
 operation:c.operation,policyRevision:c.authority.policyRevision,sourceIds:c.authority.sourceIds,
 argumentsSha256:c.argumentsSha256,requestSha256:canonicalSha256(c.request),
 normalizationContext:c.normalizationContext,origin});}
