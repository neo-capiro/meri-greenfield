/** Admission shared by the three retained source reads; never derives authority from arguments. */
import {canonicalSha256,validateShape} from '../../../../packages/contracts/validate.mjs';
import {assertSubject,resolveOperationContract} from '../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {nativeSignal} from '../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {ownFields,frozenData,assertReadContext} from '../source-admission.mjs';
import {deny} from '../../dispatch/operation-result.mjs';
const same=(a,b)=>canonicalSha256(a)===canonicalSha256(b);
export function retainedCall(operation,call,now){
 const {signal,...fields}=ownFields(call,['input','request','authority','argumentsSha256','normalizationContext'],['signal']);
 nativeSignal(signal);if(signal?.aborted)deny('CANCELLED');
 const c=frozenData(fields),contract=resolveOperationContract(operation),a=c.authority;
 assertReadContext(a,operation,now);
 const normalized=contract.normalizeInput(c.request,c.normalizationContext);
 if(!same(c.input,normalized.input)||c.argumentsSha256!==normalized.argumentsSha256)deny('INVALID_ARGUMENTS');
 const deadlineMs=a.deadlineMs;
 return {...c,operation,contract,signal,deadlineMs};
}
export function credentialProof(c,origin){return frozenData({binding:c.authority.binding,subject:c.authority.subject,
 operation:c.operation,policyRevision:c.authority.policyRevision,sourceIds:c.authority.sourceIds,
 argumentsSha256:c.argumentsSha256,requestSha256:canonicalSha256(c.request),
 normalizationContext:c.normalizationContext,origin});}
