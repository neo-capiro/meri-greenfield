/** Synthetic atomic Core effect owner for intent HTTP/public-boundary tests. */
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
export function nativeTaskPortFixture({now,afterExecute}={}){
 const rows=new Map(),state={effects:0,dispatches:0};
 const port={async execute({proposal,decision}){
  state.dispatches++;
  if(!rows.has(proposal.proposalId)){
   const c=proposal.command,completedAt=new Date(now()).toISOString();
   rows.set(proposal.proposalId,{execution:{kind:'native-task',proposalId:proposal.proposalId,commandSha256:proposal.commandSha256,idempotencyKey:c.idempotencyKey,binding:c.binding,completedAt,approvalDecisionSha256:hash(decision)},
    result:{id:'00000000-0000-4000-8000-000000000900',...c.arguments,status:'todo',createdAt:completedAt}});state.effects++;
  }
  await afterExecute?.();return {status:'observed',outcome:structuredClone(rows.get(proposal.proposalId))};
 },async read({proposal}){return rows.has(proposal.proposalId)?{state:'OUTCOME',outcome:structuredClone(rows.get(proposal.proposalId))}:null;}};
 return {port,rows,state};
}
