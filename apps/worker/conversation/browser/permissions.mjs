/** Browser permission gate, decided BEFORE a tool executes, through SDK-native mechanisms only:
 *
 * - `PreToolUse` hook (runs for every call, including pre-approved ones): denies tools the policy does not admit and
 *   navigations/new tabs whose URL fails the effective policy (platform limits, then the deny-by-default destination
 *   allowlist).
 *   For interaction tools it returns `ask`, which forces the SDK permission flow even if a rule elsewhere would
 *   pre-approve the tool; with no permission surface an `ask` is terminal, so the call is refused.
 * - `canUseTool`: interaction tools are never in `allowedTools`, so they reach this callback, which asks the injected
 *   approvals port and allows only an explicit approval for this exact tool-use id. Missing port, error, abort,
 *   timeout or any other answer denies.
 *
 * Neither a PostToolUse hook nor a receipt can stop an action; they only record it. */
import {INTERACTION_TOOLS,checkBrowserUrl} from './policy.mjs';
const MAX_APPROVAL_INPUT=16384;
const deny=reason=>({hookSpecificOutput:{hookEventName:'PreToolUse',permissionDecision:'deny',permissionDecisionReason:reason}});
const ask=reason=>({hookSpecificOutput:{hookEventName:'PreToolUse',permissionDecision:'ask',permissionDecisionReason:reason}});
/** URL a navigation-capable tool would load, or undefined when the tool loads none. `browser_tabs` loads a URL only
 * for `action:'new'` (default about:blank). */
function targetUrl(action,input){
 if(action==='browser_navigate')return {url:input?.url};
 if(action==='browser_tabs'&&input?.action==='new')return {url:input.url??'about:blank'};
 return undefined;
}
/** Shared admission used by both gates: returns null when admitted, otherwise a stable refusal code. */
function browserAdmission({policy,tools},action,input){
 if(!tools.includes(action))return 'BROWSER_TOOL_NOT_ADMITTED';
 const target=targetUrl(action,input);
 if(target){const decision=checkBrowserUrl(policy,target.url,{allowBlank:true});if(!decision.ok)return decision.code;}
 return null;
}
export function createPermissionGate({binding,policy,server,approvals}){
 const prefix=`mcp__${server}__`,tools=policy.tools,interactions=tools.filter(t=>INTERACTION_TOOLS.includes(t));
 const actionOf=name=>typeof name==='string'&&name.startsWith(prefix)?name.slice(prefix.length):null;
 const preToolUse=async(input,toolUseID,options)=>{
  try{
   const action=actionOf(input?.tool_name);
   if(options?.signal?.aborted||input?.hook_event_name!=='PreToolUse'||!action||typeof input.tool_use_id!=='string'||toolUseID!==undefined&&toolUseID!==input.tool_use_id)return deny('BROWSER_PERMISSION_INPUT');
   const refused=browserAdmission({policy,tools},action,input.tool_input);
   if(refused)return deny(refused);
   return interactions.includes(action)?ask('BROWSER_APPROVAL_REQUIRED'):{};
  }catch{return deny('BROWSER_PERMISSION_INPUT');}
 };
 /** Composable SDK `canUseTool`: returns undefined for tools that are not this server's, so it chains after other
  * deciders (default deny). */
 const canUseTool=async(name,input,options={})=>{
  const action=actionOf(name);
  if(action===null)return undefined;
  const refusal=message=>({behavior:'deny',message,...(typeof options.toolUseID==='string'?{toolUseID:options.toolUseID}:{})});
  try{
   if(options.mcpServer!==undefined&&options.mcpServer?.name!==server)return refusal('BROWSER_SERVER_MISMATCH');
   const refused=browserAdmission({policy,tools},action,input);
   if(refused)return refusal(refused);
   if(!interactions.includes(action))return {behavior:'allow',updatedInput:input};
   if(typeof approvals?.decide!=='function'||typeof options.toolUseID!=='string'||options.signal?.aborted)return refusal('BROWSER_APPROVAL_UNAVAILABLE');
   const request={schema:'meri-browser-approval-request/1',binding:structuredClone(binding),toolUseId:options.toolUseID,action,input:structuredClone(input??{})};
   if(JSON.stringify(request.input).length>MAX_APPROVAL_INPUT)return refusal('BROWSER_APPROVAL_INPUT_LIMIT');
   const answer=await approvals.decide(request,{signal:options.signal});
   if(options.signal?.aborted)return refusal('BROWSER_APPROVAL_UNAVAILABLE');
   if(answer?.decision==='approve'&&answer.toolUseId===options.toolUseID)return {behavior:'allow',updatedInput:input,toolUseID:options.toolUseID};
   return refusal('BROWSER_APPROVAL_DENIED');
  }catch{return refusal('BROWSER_APPROVAL_UNAVAILABLE');}
 };
 return Object.freeze({preToolUse,canUseTool,preApproved:Object.freeze(tools.filter(t=>!INTERACTION_TOOLS.includes(t))),interactions:Object.freeze(interactions)});
}
