// @ts-check
/** Audit, compaction and subagent lifecycle hooks. Every event carries hashes, names and timings only:
 * raw tool input, tool output, errors and compaction summaries never reach the run owner's events.
 * Any failure (malformed hook input, projection or a refused publication) fails closed twice: the tool is denied or
 * the SDK loop is told to stop, AND the failure is latched through `latch` so the activity cannot complete, capture a
 * checkpoint or publish further output afterwards. */
import {canonicalSha256} from '../../../../packages/contracts/validate.mjs';
/** @typedef {(type:string,data:Record<string,unknown>,signal:AbortSignal)=>Promise<void>} PublishPort */
/** @typedef {(error:unknown)=>void} LatchPort */
/** @typedef {{publish:PublishPort,latch:LatchPort}} HookPorts */
/** @returns {HookPorts} */
const ports=(/** @type {unknown} */value)=>{const p=/** @type {Partial<HookPorts>} */(value);if(typeof p?.publish!=='function'||typeof p?.latch!=='function')throw Object.assign(Error('CAPABILITY_CONFIGURATION'),{code:'CAPABILITY_CONFIGURATION'});return /** @type {HookPorts} */(p);};
/** A string field the SDK hook type requires: a malformed value is refused (and latched), never digested as '' or null.
 * @param {unknown} v @param {string} code @returns {string} */
const required=(v,code)=>{if(typeof v!=='string')throw Error(code);return v;};
const text=(/** @type {unknown} */v)=>typeof v==='string'?v:null,duration=(/** @type {unknown} */v)=>Number.isSafeInteger(v)&&/** @type {number} */(v)>=0?v:null;
const STOP=Object.freeze({continue:false,stopReason:'AUDIT_UNAVAILABLE'}),DENY=Object.freeze({hookSpecificOutput:/** @type {const} */({hookEventName:'PreToolUse',permissionDecision:'deny',permissionDecisionReason:'Audit unavailable'})});
/** @param {import('@anthropic-ai/claude-agent-sdk').HookInput} input */
const origin=input=>({agentId:text(/** @type {{agent_id?:unknown}} */(input).agent_id),agentType:text(/** @type {{agent_type?:unknown}} */(input).agent_type)});
/** @param {HookPorts} p @param {(input:import('@anthropic-ai/claude-agent-sdk').HookInput)=>[string,Record<string,unknown>]} project @param {unknown} onFailure */
const hook=({publish,latch},project,onFailure)=>/** @type {import('@anthropic-ai/claude-agent-sdk').HookCallback} */(async(input,_toolUseID,options)=>{try{const [type,data]=project(input);await publish(type,data,options?.signal);return {};}catch(error){latch(error);return /** @type {import('@anthropic-ai/claude-agent-sdk').HookJSONOutput} */(onFailure);}});
/** @param {import('@anthropic-ai/claude-agent-sdk').HookInput} input @param {'requested'|'completed'|'failed'} phase */
function toolAudit(input,phase){const i=/** @type {import('@anthropic-ai/claude-agent-sdk').PreToolUseHookInput} */(input);
 if(typeof i.tool_name!=='string'||!i.tool_name||typeof i.tool_use_id!=='string'||!i.tool_use_id)throw Error('AUDIT_INPUT_REFUSED');
 return {phase,toolUseId:i.tool_use_id,tool:i.tool_name,inputSha256:canonicalSha256(i.tool_input??null),...origin(input)};}
/** PreToolUse/PostToolUse/PostToolUseFailure → `tool.audit`. @param {HookPorts} value */
export function createAuditHooks(/** @type {unknown} */value){
 const p=ports(value);
 return Object.freeze({
  PreToolUse:[{hooks:[hook(p,input=>['tool.audit',toolAudit(input,'requested')],DENY)]}],
  PostToolUse:[{hooks:[hook(p,input=>{const i=/** @type {import('@anthropic-ai/claude-agent-sdk').PostToolUseHookInput} */(input);return ['tool.audit',{...toolAudit(input,'completed'),responseSha256:canonicalSha256(i.tool_response??null),durationMs:duration(i.duration_ms)}];},STOP)]}],
  PostToolUseFailure:[{hooks:[hook(p,input=>{const i=/** @type {import('@anthropic-ai/claude-agent-sdk').PostToolUseFailureHookInput} */(input);return ['tool.audit',{...toolAudit(input,'failed'),errorSha256:canonicalSha256(required(i.error,'AUDIT_INPUT_REFUSED')),interrupted:i.is_interrupt===true,durationMs:duration(i.duration_ms)}];},STOP)]}]});
}
/** PreCompact/PostCompact → `compaction.boundary`; the summary is hashed and measured, never published. @param {HookPorts} value */
export function createCompactionHooks(/** @type {unknown} */value){
 const p=ports(value);
 const trigger=(/** @type {unknown} */v)=>{if(v!=='manual'&&v!=='auto')throw Error('COMPACTION_INPUT_REFUSED');return v;};
 return Object.freeze({
  PreCompact:[{hooks:[hook(p,input=>{const i=/** @type {import('@anthropic-ai/claude-agent-sdk').PreCompactHookInput} */(input);return ['compaction.boundary',{phase:'pre',trigger:trigger(i.trigger),...origin(input)}];},STOP)]}],
  PostCompact:[{hooks:[hook(p,input=>{const i=/** @type {import('@anthropic-ai/claude-agent-sdk').PostCompactHookInput} */(input);const summary=required(i.compact_summary,'COMPACTION_INPUT_REFUSED');return ['compaction.boundary',{phase:'post',trigger:trigger(i.trigger),summarySha256:canonicalSha256(summary),summaryBytes:Buffer.byteLength(summary),...origin(input)}];},STOP)]}]});
}
/** SubagentStart/SubagentStop → `subagent.lifecycle`; the last assistant message is never published. @param {HookPorts} value */
export function createSubagentLifecycleHooks(/** @type {unknown} */value){
 const p=ports(value);
 const identity=(/** @type {import('@anthropic-ai/claude-agent-sdk').HookInput} */input,/** @type {'started'|'stopped'} */phase)=>{const o=origin(input);if(!o.agentId||!o.agentType)throw Error('SUBAGENT_INPUT_REFUSED');return {phase,...o};};
 return Object.freeze({
  SubagentStart:[{hooks:[hook(p,input=>['subagent.lifecycle',identity(input,'started')],STOP)]}],
  SubagentStop:[{hooks:[hook(p,input=>['subagent.lifecycle',identity(input,'stopped')],STOP)]}]});
}
