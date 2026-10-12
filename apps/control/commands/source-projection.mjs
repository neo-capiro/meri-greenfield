/** Fixed native route projections. These source claims are not current authority. */
import {canonicalSha256} from '../../../packages/contracts/validate.mjs';
import {data,deny,instant,own} from './protocol.mjs';
const names=Object.freeze({'task.create':'create_task','task.update':'update_task','memory.propose':'save_memory','artifact.file':'save_chat_attachments'});
export const commandSourceTool=action=>{if(typeof action!=='string'||!Object.hasOwn(names,action))deny('INVALID_COMMAND');return names[action];};
export function commandSourceBody(command,attachments){
 const a=command.arguments;
 if(command.action==='task.create')return data({title:a.title,...(a.clientId===null?{}:{clientId:a.clientId}),...(a.dueDate===null?{}:{dueDate:a.dueDate})});
 if(command.action==='task.update')return data({taskId:a.taskId,...a.patch});
 if(command.action==='memory.propose'){
  if(a.scope==='personal')deny('PENDING_PRODUCER_UNAVAILABLE');
  return data({content:a.content,scope:a.scope,...(a.key===null?{}:{key:a.key}),...(a.clientId===null?{}:{clientId:a.clientId}),...(a.ttlDays===null?{}:{ttlDays:a.ttlDays})});
 }
 if(command.action==='artifact.file')return data({...a,attachmentIds:attachments.map(x=>x.attachmentId)});
 deny('INVALID_COMMAND');
}
export function commandSourceResult(rawValue,command,attachments){
 const raw=data(rawValue),tool=commandSourceTool(command.action);
 if(command.action==='memory.propose'){
  own(raw,['saved','scope','candidateId','message']);
  if(raw.saved!==false||raw.scope!==command.arguments.scope||typeof raw.message!=='string')deny('INVALID_SOURCE_RESULT');
  return data({candidateId:raw.candidateId,commandSha256:canonicalSha256(command),status:'pending'});
 }
 if(command.action==='task.create'||command.action==='task.update'){
  const flag=command.action==='task.create'?'created':'updated';own(raw,['tool','generatedAt',flag,'task']);
  instant(raw.generatedAt);if(raw.tool!==tool||raw[flag]!==true)deny('INVALID_SOURCE_RESULT');return raw.task;
 }
 own(raw,['tool','status','generatedAt','clientId','clientName','location','savedCount','pendingCount','failedCount','files']);
 instant(raw.generatedAt);
 if(raw.tool!==tool||raw.clientId!==command.arguments.clientId||typeof raw.clientName!=='string'||typeof raw.location!=='string'||!Array.isArray(raw.files)||raw.files.length!==attachments.length)deny('INVALID_SOURCE_RESULT');
 const seen=new Set(),counts={saved:0,pending:0,failed:0};
 const files=raw.files.map(row=>{
  own(row,['attachmentId','fileName','status'],['documentId','location','reason','indexingStatus','reused']);
  const mapped=attachments.find(x=>x.attachmentId===row.attachmentId);
  if(!mapped||seen.has(row.attachmentId)||!Object.hasOwn(counts,row.status))deny('INVALID_SOURCE_RESULT');seen.add(row.attachmentId);counts[row.status]++;
  const {attachmentId:ignored,...observation}=row;return {object:mapped.object,...observation};
 });
 for(const k of Object.keys(counts))if(raw[`${k}Count`]!==counts[k])deny('INVALID_SOURCE_RESULT');
 const status=counts.saved===files.length?'saved':counts.failed===files.length?'failed':counts.pending===files.length?'pending':'partial';
 if(raw.status!==status)deny('INVALID_SOURCE_RESULT');
 return data({commandSha256:canonicalSha256(command),files});
}
