/** Fixed native route projections. These source claims are not current authority. */
import {data,deny} from './protocol.mjs';
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
