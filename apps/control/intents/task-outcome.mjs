/** Correlates Core's retained native task result; this creates no receipt or authority. */
import {own,data} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {validateCommandShape,assertTaskUpdateResult} from '../../../packages/contracts/commands-0.2/validate.mjs';
import {ProductError} from '../product-access/errors.mjs';
const same=(a,b)=>hash(a)===hash(b);
const instant=value=>{const at=Date.parse(value);if(!Number.isSafeInteger(at)||new Date(at).toISOString()!==value)throw Error();return at;};
/** Core proves expiry and absence under the same proposal lock used by execution. A local timeout is never this proof. */
export function nativeTaskNotExecuted(raw,proposal){
 try{
  const value=data(own(raw,['state','proposalId','commandSha256','idempotencyKey','binding','reason','checkedAt'])),c=proposal.command;
  if(value.state!=='NOT_EXECUTED'||value.reason!=='expired'||!['task.create','task.update'].includes(c.action)||
   value.proposalId!==proposal.proposalId||value.commandSha256!==proposal.commandSha256||value.idempotencyKey!==c.idempotencyKey||
   !same(value.binding,c.binding)||instant(value.checkedAt)<instant(proposal.expiresAt))throw Error();
  return value;
 }catch{throw new ProductError('INTENT_RESULT_NOT_RELEASED','RESULT_NOT_RELEASED');}
}
export function nativeTaskOutcome(raw,proposal,decision){
 try{
  const value=data(own(raw,['execution','result'])),e=own(value.execution,['kind','proposalId','commandSha256','idempotencyKey','binding','completedAt','approvalDecisionSha256']),c=proposal.command;
  if(e.kind!=='native-task'||e.proposalId!==proposal.proposalId||e.commandSha256!==proposal.commandSha256||e.idempotencyKey!==c.idempotencyKey||!same(e.binding,c.binding)||
   !/^[a-f0-9]{64}$/u.test(e.approvalDecisionSha256)||decision&&e.approvalDecisionSha256!==hash(decision))throw Error();
  const completed=instant(e.completedAt);
  if(completed<Date.parse(proposal.createdAt)||decision&&completed<Date.parse(decision.decidedAt))throw Error();
  if(c.action==='task.create'){
   validateCommandShape('TaskCreateResult',value.result);instant(value.result.createdAt);
   if(['title','clientId','dueDate'].some(key=>value.result[key]!==c.arguments[key]))throw Error();
  }else if(c.action==='task.update')assertTaskUpdateResult(value.result,c,{binding:c.binding});
  else throw Error();
  return value;
 }catch{throw new ProductError('INTENT_RESULT_NOT_RELEASED','RESULT_NOT_RELEASED');}
}
