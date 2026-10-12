// Private unconditional patch intent; no public action expansion or access grant.
import {snapshotOperationData} from '../retrieval-0.2/operation-contracts.mjs';
const fail=()=>{throw new Error('Invalid task update intent');};
const instant=value=>{const n=Date.parse(value);if(!Number.isSafeInteger(n)||new Date(n).toISOString()!==value)fail();return n;};
const day=value=>{if(instant(value)%86400000!==0)fail();return value;};
export function createTaskUpdateValidators({validateShape,validatePublicShape,canonicalSha256}) {
 const same=(a,b)=>canonicalSha256(a)===canonicalSha256(b);
 function context(value){const c=snapshotOperationData(value);validateShape('TaskUpdateContext',c);return c;}
 function normalizeTaskUpdateInput(value,options){
  context(options);const raw=snapshotOperationData(value);validateShape('TaskUpdateRaw',raw);
  const taskId=raw.taskId.trim().toLowerCase(),patch={};
  if(raw.title?.trim()){const title=raw.title.trim();if(title.length>240)fail();patch.title=title;}
  if(raw.status?.trim()){const status=raw.status.trim().toLowerCase();patch.status=status==='open'?'todo':status;}
  if(raw.dueDate?.trim()){const date=raw.dueDate.trim();patch.dueDate=day(date.length===10?`${date}T00:00:00.000Z`:date);}
  const input={taskId,mode:'unconditional_patch',patch};validateShape('TaskUpdateArguments',input);return input;
 }
 function assertTaskUpdateCommand(value,options){
  const cmd=snapshotOperationData(value),c=context(options);validateShape('TaskUpdateCommand',cmd);
  if(!same(cmd.binding,c.binding)||cmd.scopes.some(s=>s.tenantId!==cmd.binding.tenantId))fail();
  if(cmd.arguments.taskId!==cmd.arguments.taskId.toLowerCase())fail();
  const {title,dueDate}=cmd.arguments.patch;if(title!==undefined&&(title.trim()!==title||title.length>240))fail();if(dueDate!==undefined)day(dueDate);return cmd;
 }
 function assertTaskUpdateProposal(value,options){
  const p=snapshotOperationData(value);validateShape('TaskUpdateApprovalProposal',p);assertTaskUpdateCommand(p.command,options);
  if(canonicalSha256(p.command)!==p.commandSha256||instant(p.expiresAt)<=instant(p.createdAt)||p.requiredApprover.tenantId!==p.command.binding.tenantId)fail();return p;
 }
 function assertTaskUpdateExecution(proposalValue,value,options){
  const p=assertTaskUpdateProposal(proposalValue,options),e=snapshotOperationData(value);validatePublicShape('CommandExecutionRequest',e);
  if(e.proposalId!==p.proposalId||e.commandSha256!==p.commandSha256||e.idempotencyKey!==p.command.idempotencyKey)fail();
  for(const key of ['tenantId','actorId','conversationId','runId'])if(e.executorBinding[key]!==p.command.binding[key])fail();return e;
 }
 function assertTaskUpdateResult(value,commandValue,options){
  const c=assertTaskUpdateCommand(commandValue,options),r=snapshotOperationData(value);validateShape('TaskUpdateResult',r);instant(r.updatedAt);if(r.dueDate!==null)day(r.dueDate);
  if(r.id.toLowerCase()!==c.arguments.taskId)fail();for(const [key,v]of Object.entries(c.arguments.patch))if(r[key]!==v)fail();return r;
 }
 return Object.freeze({normalizeTaskUpdateInput,assertTaskUpdateCommand,assertTaskUpdateProposal,assertTaskUpdateExecution,assertTaskUpdateResult});
}
