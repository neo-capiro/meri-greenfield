/** Correlates the existing Core execution receipt and exact per-object filing observations. Mints no authority or receipt. */
import {own,data} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {assertArtifactFileResult} from '../../../packages/contracts/commands-0.2/validate.mjs';
import {ProductError} from '../product-access/errors.mjs';
const same=(a,b)=>hash(a)===hash(b);
export function nativeArtifactFileOutcome(raw,proposal,decision){
 try{
  const value=data(own(raw,['execution','result'])),e=own(value.execution,['kind','proposalId','commandSha256','idempotencyKey','binding','completedAt','approvalDecisionSha256']),c=proposal.command;
  if(e.kind!=='native-artifact-file'||e.proposalId!==proposal.proposalId||e.commandSha256!==proposal.commandSha256||e.idempotencyKey!==c.idempotencyKey||!same(e.binding,c.binding)||
   !/^[a-f0-9]{64}$/u.test(e.approvalDecisionSha256)||decision&&e.approvalDecisionSha256!==hash(decision))throw Error();
  const completed=Date.parse(e.completedAt);
  if(!Number.isSafeInteger(completed)||new Date(completed).toISOString()!==e.completedAt||completed<Date.parse(proposal.createdAt)||decision&&completed<Date.parse(decision.decidedAt))throw Error();
  assertArtifactFileResult(value.result,c,{binding:c.binding,destination:{clientId:c.arguments.clientId,conversationId:c.binding.conversationId}});
  return value;
 }catch{throw new ProductError('INTENT_RESULT_NOT_RELEASED','RESULT_NOT_RELEASED');}
}
