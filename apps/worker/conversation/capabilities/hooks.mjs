// @ts-check
/** Native post-tool hooks collect content-free metadata in memory. They do no IO, authorization,
 * hashing of content, timing, or permission decisions. The activity sends the batch with its result.
 * An unavailable/truncated audit is explicit and cannot turn a completed answer into a failed turn.
 */
/** @typedef {(error:unknown)=>void} LatchPort */
/** @typedef {{tool:string,toolUseId:string,outcome:'completed'|'failed',durationMs:number|null}} ToolAudit */
import {MAX_TOOL_AUDIT_RECORDS} from '../../../../packages/contracts/runtime-0.2/usage.mjs';
export {MAX_TOOL_AUDIT_RECORDS};
const identifier=(/** @type {unknown} */v)=>typeof v==='string'&&/^[a-zA-Z0-9][a-zA-Z0-9_:\-./]{0,199}$/u.test(v);

export function createNativeHookBatch(){
 /** @type {ToolAudit[]} */const tools=[];let omitted=0;
 /** @param {'completed'|'failed'} outcome @returns {import('@anthropic-ai/claude-agent-sdk').HookCallback} */
 const record=outcome=>async input=>{
  const i=/** @type {import('@anthropic-ai/claude-agent-sdk').PostToolUseHookInput} */(input);
  if(!identifier(i?.tool_name)||!identifier(i?.tool_use_id)||tools.length===MAX_TOOL_AUDIT_RECORDS){omitted++;return {};}
  tools.push({tool:i.tool_name,toolUseId:i.tool_use_id,outcome,
   durationMs:Number.isSafeInteger(i.duration_ms)&&/** @type {number} */(i.duration_ms)>=0?/** @type {number} */(i.duration_ms):null});
  return {};
 };
 return Object.freeze({hooks:{PostToolUse:[{hooks:[record('completed')]}],PostToolUseFailure:[{hooks:[record('failed')]}]},
  snapshot(){return {tools:tools.map(record=>({...record})),omitted};}});
}
