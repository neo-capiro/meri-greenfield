import canonicalize from 'canonicalize';
import {createTaskUpdateValidators} from '../commands-0.2/task-update-validation.mjs';
import {validators} from './generated-validator.mjs';
import {fail} from './boundary.mjs';
const same=(a,b)=>canonicalize(a)===canonicalize(b);
const sha=async value=>Array.from(new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256',new TextEncoder().encode(canonicalize(value)))),byte=>byte.toString(16).padStart(2,'0')).join('');
const check=(name,value)=>{if(!validators[name]?.(value))fail('TASK_COMMAND_SHAPE');return value;};
const normalizer=createTaskUpdateValidators({validateShape:check,validatePublicShape:check,canonicalSha256:()=>fail('TASK_COMMAND_INTERNAL')}).normalizeTaskUpdateInput;
const stableKeys=['tenantId','actorId','conversationId','runId'];
const instant=value=>{const at=Date.parse(value);if(!Number.isSafeInteger(at)||new Date(at).toISOString()!==value)fail('TASK_COMMAND_CORRELATION');return at;};
const stable=(binding,expected)=>{if(stableKeys.some(key=>binding[key]!==expected[key]))fail('TASK_COMMAND_CORRELATION');};
const scopes=(binding,values)=>{if(values.some(scope=>scope.tenantId!==binding.tenantId))fail('TASK_COMMAND_CORRELATION');};
export function normalizeArguments(raw,binding){try{return normalizer(raw,{binding});}catch{fail('TASK_COMMAND_ARGUMENTS');}}
export async function proposal(value){
 check('TaskUpdateApprovalProposal',value);const c=value.command;
 if(await sha(c)!==value.commandSha256||value.requiredApprover.tenantId!==c.binding.tenantId||instant(value.expiresAt)<=instant(value.createdAt))fail('TASK_COMMAND_CORRELATION');
 scopes(c.binding,c.scopes);
 if(c.arguments.taskId!==c.arguments.taskId.toLowerCase()||!same(c.arguments,normalizeArguments({taskId:c.arguments.taskId,...c.arguments.patch},c.binding)))fail('TASK_COMMAND_CORRELATION');
 return value;
}
export async function correlatePrepare(value,expectation){
 const p=await proposal(value.proposal);stable(p.command.binding,expectation.binding);
 check('TaskCommandPrepareRequest',expectation.request);
 if(!same(p.command.arguments,normalizeArguments(expectation.request.arguments,p.command.binding)))fail('TASK_COMMAND_CORRELATION');
}
export async function correlateExecute(value,expectation){
 const selected=await proposal(expectation.proposal);stable(selected.command.binding,expectation.binding);
 if(value.status==='indeterminate')return;
 const {receipt,result}=value.outcome,c=selected.command;stable(receipt.binding,expectation.binding);scopes(receipt.binding,receipt.scopes);
 if(receipt.outcome!=='succeeded'||receipt.commandId!==c.commandId||receipt.commandSha256!==selected.commandSha256||receipt.idempotencyKey!==c.idempotencyKey||!same(receipt.scopes,c.scopes)||result.id.toLowerCase()!==c.arguments.taskId)fail('TASK_COMMAND_CORRELATION');
 instant(receipt.completedAt);instant(result.updatedAt);if(result.dueDate!==null&&instant(result.dueDate)%86400000!==0)fail('TASK_COMMAND_CORRELATION');
 for(const [key,value]of Object.entries(c.arguments.patch))if(result[key]!==value)fail('TASK_COMMAND_CORRELATION');
}
export {check};
