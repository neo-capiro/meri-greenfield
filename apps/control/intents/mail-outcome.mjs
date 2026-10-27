import {own,data} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {assertMailSendProposal,assertMailSendResult} from '../../../packages/contracts/commands-0.2/validate.mjs';
import {ProductError} from '../product-access/errors.mjs';
/** Only Core's durable mail attempt is evidence. No local clock or HTTP success manufactures delivery. */
export function nativeMailOutcome(raw,proposal,decision){
 try{
  const p=assertMailSendProposal(proposal,{binding:proposal.command.binding});
  const v=data(own(raw,['execution','result'])),e=own(v.execution,['kind','proposalId','commandSha256','idempotencyKey','binding','approvalDecisionSha256']);
  if(e.kind!=='native-mail'||e.proposalId!==p.proposalId||e.commandSha256!==p.commandSha256||
   e.idempotencyKey!==p.command.idempotencyKey||hash(e.binding)!==hash(p.command.binding)||
   !/^[a-f0-9]{64}$/u.test(e.approvalDecisionSha256)||decision&&e.approvalDecisionSha256!==hash(decision))throw Error();
  assertMailSendResult(v.result,p.command,p.proposalId);return v;
 }catch{throw new ProductError('INTENT_RESULT_NOT_RELEASED','RESULT_NOT_RELEASED');}
}
