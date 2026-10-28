import {own,data} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {assertNativeMemoryOutcome,nativeMemoryCandidateFromProposal} from '../../../packages/contracts/commands-0.2/native-memory-result.mjs';
import {ProductError} from '../product-access/errors.mjs';
import {nativeDatabaseNotExecuted} from './task-outcome.mjs';
export const nativeMemoryNotExecuted=(raw,p)=>nativeDatabaseNotExecuted(raw,p,['memory.propose']);
export function nativeMemoryOutcome(raw,proposal,decision){
 try{return assertNativeMemoryOutcome(data(own(raw,['execution','result'])),proposal,{
  candidateSha256:hash(nativeMemoryCandidateFromProposal(proposal)),decisionSha256:decision?hash(decision):undefined,decision,same:(a,b)=>hash(a)===hash(b),
 });}catch{throw new ProductError('INTENT_RESULT_NOT_RELEASED','RESULT_NOT_RELEASED');}
}
