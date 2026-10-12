/** Correlates current trusted approval facts; does not choose approvers or rights. */
import {canonicalSha256,validateShape} from '../../../packages/contracts/validate.mjs';
import {data,deny,instant,own} from './protocol.mjs';
export function createCommandApprovalGuard({getCurrent,now,maxFactBytes}){
 if(typeof getCurrent!=='function'||typeof now!=='function'||!Number.isSafeInteger(maxFactBytes)||maxFactBytes<1)deny('COMMAND_CONFIGURATION');
 return Object.freeze({async check(proposal,authority,lifetime){
  const started=now(),raw=await lifetime.run(signal=>getCurrent({proposalId:proposal.proposalId,commandSha256:proposal.commandSha256,binding:authority.binding,signal}));
  if(typeof raw!=='string'||Buffer.byteLength(raw)>maxFactBytes)deny('COMMAND_APPROVAL_REFUSED');
  const fact=data(JSON.parse(raw));own(fact,['decision','checkedAtMs','revoked']);validateShape('ApprovalDecision',fact.decision);
  const d=fact.decision,at=now();
  if(fact.revoked!==false||!Number.isSafeInteger(fact.checkedAtMs)||fact.checkedAtMs<started||fact.checkedAtMs>at||d.decision!=='approved'||
   d.proposalId!==proposal.proposalId||d.commandSha256!==proposal.commandSha256||canonicalSha256(d.approver)!==canonicalSha256(proposal.requiredApprover)||
   d.policyRevision!==authority.policyRevision||instant(d.decidedAt)<instant(proposal.createdAt)||instant(d.decidedAt)>at||
   instant(proposal.createdAt)>at||instant(d.expiresAt)<=at||instant(proposal.expiresAt)<=at)deny('COMMAND_APPROVAL_REFUSED');
  lifetime.limitDeadline(Math.min(instant(d.expiresAt),instant(proposal.expiresAt)));lifetime.check();return fact;
 }});
}
