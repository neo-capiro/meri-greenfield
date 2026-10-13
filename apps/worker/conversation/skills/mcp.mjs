/** Fixed original read tools through the adopted SDK server, never an alternate agent loop. */
import {createSdkMcpServer,tool} from '@anthropic-ai/claude-agent-sdk';
import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {own,data} from '../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {resolveOperationContract} from '../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {canonicalSha256,validateShape} from '../../../../packages/contracts/validate.mjs';
import {selectSkill} from '../../../../packages/skills/index.mjs';
const fault=code=>Object.assign(Error(code),{code});
export const sdkToolName=operation=>operation.id.replaceAll('.','_');
export function createOriginalSkillServer({selected,read,timeoutMs,binding,expectedSessionId}) {
 const original=selectSkill(selected.pin.skillId,selected.pin.skillVersion);
 if(!['quick_skill.relationship_brief','quick_skill.commitments_audit'].includes(original.pin.skillId)||
 canonicalSha256(selected)!==canonicalSha256(original)||typeof read!=='function'||!Number.isSafeInteger(timeoutMs)||timeoutMs<1||timeoutMs>60000)throw fault('SKILL_SERVER_CONFIGURATION');
 validateShape('RunBinding',binding);const correlations=new Map();let session=expectedSessionId??null;
 const hook=async(raw,toolUseID,options)=>{try{if(options.signal?.aborted)throw fault('CANCELLED');const input=data(raw),op=original.manifest.allowedOperations.find(o=>`mcp__meri_original_reads__${sdkToolName(o)}`===input.tool_name);
  if(input.hook_event_name!=='PreToolUse'||!op||typeof input.tool_use_id!=='string'||!/^[A-Za-z0-9_-]{1,128}$/u.test(input.tool_use_id)||toolUseID!==undefined&&toolUseID!==input.tool_use_id||typeof input.session_id!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u.test(input.session_id)||session!==null&&session!==input.session_id||correlations.size>=original.manifest.budgets.maxToolCalls)throw fault('SKILL_HOOK_REFUSED');
  const value=data(input.tool_input);own(value,['arguments'],['_meriInvocation']);session??=input.session_id;const token=randomUUID(),deliveryId='sdk:'+canonicalSha256({binding,sessionId:session,toolUseId:input.tool_use_id});correlations.set(token,{operation:op,argumentsSha256:canonicalSha256(value.arguments),deliveryId});
  return {hookSpecificOutput:{hookEventName:'PreToolUse',updatedInput:{arguments:value.arguments,_meriInvocation:token}}};
 }catch{return {hookSpecificOutput:{hookEventName:'PreToolUse',permissionDecision:'deny',permissionDecisionReason:'Original task correlation unavailable'}};}};
 const definitions=original.manifest.allowedOperations.map(operation=>{const {descriptor}=resolveOperationContract(operation);
  return tool(sdkToolName(operation),`${descriptor.displayName}. ${descriptor.whenToUse} Canonical input schema ${descriptor.inputSchema.id}, SHA256 ${descriptor.inputSchema.sha256}. Supply literal arguments only; credentials and scope authority remain with the gateway.`,
   {arguments:z.record(z.string(),z.json()),_meriInvocation:z.string().optional().describe('Reserved correlation supplied only by the trusted SDK hook')},async(raw,extra)=>{
    try{const {arguments:args,_meriInvocation:token}=own(data(raw),['arguments'],['_meriInvocation']),entry=correlations.get(token);
     if(!entry||canonicalSha256(entry.operation)!==canonicalSha256(operation)||entry.argumentsSha256!==canonicalSha256(args))throw fault('SKILL_HOOK_REFUSED');correlations.delete(token);
     const result=await read(operation,args,extra?.signal,entry.deliveryId);
     if(typeof result!=='string'||Buffer.byteLength(result)>original.manifest.budgets.maxOutputBytes)throw fault('SKILL_RESULT_LIMIT');
     return {content:[{type:'text',text:result}]};
    }catch{return {isError:true,content:[{type:'text',text:'SOURCE_READ_REFUSED: evidence unavailable; no completeness, absence or verification established.'}]};}
   },{annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:true},alwaysLoad:true});
 });
 if(new Set(definitions.map(d=>d.name)).size!==definitions.length)throw fault('SKILL_TOOL_COLLISION');
 const server=createSdkMcpServer({name:'meri_original_reads',version:'1.0.0',instructions:'Read-only original selected-skill sources. Preserve exact source IDs/versions/hashes/scopes, separate inference, and disclose partial or unavailable evidence. No artifact write or external mutation is exposed.',tools:definitions,alwaysLoad:true,timeout:Math.max(1000,timeoutMs)});
 const allowedTools=definitions.map(d=>`mcp__meri_original_reads__${d.name}`);let closed=false;
 return Object.freeze({server,hooks:{PreToolUse:[{matcher:'mcp__meri_original_reads__.*',hooks:[hook]}]},allowedTools:Object.freeze(allowedTools),canUseTool:async(name,input)=>allowedTools.includes(name)?{behavior:'allow',updatedInput:input}:{behavior:'deny',message:'Tool unavailable'},
  async close(){if(!closed){closed=true;correlations.clear();await server.instance.close();}}});
}
