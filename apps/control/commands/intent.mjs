/** Reuses canonical payload and approval/receipt contracts; no policy decisions. */
import {assertCommandExecution,assertProposalIntegrity,canonicalSha256,validateShape} from '../../../packages/contracts/validate.mjs';
import * as payloads from '../../../packages/contracts/commands-0.2/validate.mjs';
import {data,deny,instant,own} from './protocol.mjs';
const same=(a,b)=>canonicalSha256(a)===canonicalSha256(b);
export function createCommandIntentValidator({taskUpdate}){
 if(!taskUpdate||['assertTaskUpdateCommand','assertTaskUpdateProposal','assertTaskUpdateExecution','assertTaskUpdateResult'].some(k=>typeof taskUpdate[k]!=='function'))deny('COMMAND_CONFIGURATION');
 function inspect(proposalValue,executionValue,contextValue){
  const proposal=data(proposalValue),execution=data(executionValue),context=data(contextValue),c=proposal.command;
  if(c?.action==='task.update'){taskUpdate.assertTaskUpdateProposal(proposal,context);taskUpdate.assertTaskUpdateExecution(proposal,execution,context);}
  else{assertProposalIntegrity(proposal);assertCommandExecution(proposal,execution);
   if(c.action==='task.create')payloads.assertTaskCreateCommand(c,context);
   else if(c.action==='artifact.file')payloads.assertArtifactFileCommand(c,context);
   else if(c.action==='memory.propose')payloads.assertMemoryProposeCommand(c,context);
   else deny('INVALID_COMMAND');
  }
  if(instant(proposal.expiresAt)<=instant(proposal.createdAt))deny('INVALID_COMMAND');
  return data({proposal,execution,context});
 }
 function result(value,command,context){
  if(command.action==='task.update')return taskUpdate.assertTaskUpdateResult(value,command,context);
  if(command.action==='task.create')return payloads.assertTaskCreateResult(value,command,context);
  if(command.action==='memory.propose')return payloads.assertMemoryProposeResult(value,command,context);
  if(command.action==='artifact.file')return payloads.assertArtifactFileResult(value,command,context);
  deny('INVALID_COMMAND');
 }
 function outcome(value,command,context){
  const v=data(value);own(v,['receipt','result']);validateShape('CommandReceipt',v.receipt);
  const r=v.receipt;instant(r.completedAt);
  if(r.commandId!==command.commandId||r.commandSha256!==canonicalSha256(command)||r.idempotencyKey!==command.idempotencyKey||!same(r.scopes,command.scopes))deny('INVALID_OUTCOME');
  for(const k of ['tenantId','actorId','conversationId','runId'])if(r.binding[k]!==command.binding[k])deny('INVALID_OUTCOME');
  result(v.result,command,context);
  const expected=command.action==='artifact.file'&&!v.result.files.every(f=>f.status==='saved')?'indeterminate':'succeeded';
  if(r.outcome!==expected||r.sourceTransactionId!==null)deny('INVALID_OUTCOME');return v;
 }
 return Object.freeze({inspect,result,outcome});
}
