/** Browser permission gate, decided BEFORE a tool executes, through SDK-native mechanisms only:
 *
 * - `PreToolUse` hook (runs for every call, including pre-approved ones): denies tools the policy does not admit and
 *   navigations/new tabs whose URL fails the effective policy (platform limits, then the deny-by-default destination
 *   allowlist).
 *   For interaction tools it returns `ask`, which forces the SDK permission flow even if a rule elsewhere would
 *   pre-approve the tool; with no permission surface an `ask` is terminal, so the call is refused.
 * - `canUseTool`: interaction tools are never in `allowedTools`, so they reach this callback, which asks the injected
 *   approvals port and allows only an explicit approval for this exact tool-use id AND the canonical SHA-256 digest of
 *   the exact input that will run (the allowed `updatedInput` is the digested copy). The port call is raced against
 *   the run's AbortSignal and a bounded approval deadline owned here (`APPROVAL_DEADLINE_MS`): expiry denies with
 *   BROWSER_APPROVAL_EXPIRED, abort with BROWSER_APPROVAL_UNAVAILABLE, the port's signal is aborted on either, and an
 *   answer that arrives after the race is settled is ignored. Missing port, error or any other answer denies.
 *
 * This fragment does not make an approval durable or single-use: authenticating the approver, binding the run/attempt
 * and fence, revocation, one-time consumption and replay belong to the canonical approval owner behind the port.
 * Neither a PostToolUse hook nor a receipt can stop an action; they only record it. */
import {canonicalSha256} from '../../../../packages/contracts/validate.mjs';
import {INTERACTION_TOOLS,checkBrowserUrl} from './policy.mjs';
const MAX_APPROVAL_INPUT=16384;
/** Approval deadline bounds in milliseconds; the runtime may configure a value inside them. */
export const APPROVAL_DEADLINE_MS=Object.freeze({default:120000,min:1000,max:900000});
export const APPROVAL_REQUEST_SCHEMA='meri-browser-approval-request/2';
const EXPIRED=Symbol('approval-expired'),ABORTED=Symbol('approval-aborted');
/** Races `approvals.decide` against `signal` and the deadline; returns the port's answer, EXPIRED or ABORTED. */
async function decideWithin(approvals,request,signal,deadlineMs){
 const expiry=new AbortController(),portSignal=signal?AbortSignal.any([signal,expiry.signal]):expiry.signal;
 let timer,onAbort;
 const stopped=new Promise(resolve=>{
  timer=setTimeout(()=>{expiry.abort(new Error('BROWSER_APPROVAL_EXPIRED'));resolve(EXPIRED);},deadlineMs);
  if(signal){onAbort=()=>resolve(ABORTED);signal.addEventListener('abort',onAbort,{once:true});}
 });
 const answer=Promise.resolve().then(()=>approvals.decide(request,{signal:portSignal}));
 answer.catch(()=>{});// a rejection after the race is settled is ignored, not unhandled
 try{return await Promise.race([answer,stopped]);}
 finally{clearTimeout(timer);signal?.removeEventListener('abort',onAbort);}
}
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
export function createPermissionGate({binding,policy,server,approvals,now,approvalDeadlineMs=APPROVAL_DEADLINE_MS.default}){
 if(!Number.isSafeInteger(approvalDeadlineMs)||approvalDeadlineMs<APPROVAL_DEADLINE_MS.min||approvalDeadlineMs>APPROVAL_DEADLINE_MS.max||typeof now!=='function')throw Object.assign(new Error('BROWSER_CONFIGURATION'),{code:'BROWSER_CONFIGURATION'});
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
   const approvedInput=structuredClone(input??{});
   if(JSON.stringify(approvedInput).length>MAX_APPROVAL_INPUT)return refusal('BROWSER_APPROVAL_INPUT_LIMIT');
   const inputDigest=canonicalSha256(approvedInput);
   const request={schema:APPROVAL_REQUEST_SCHEMA,binding:structuredClone(binding),toolUseId:options.toolUseID,action,input:structuredClone(approvedInput),inputDigest,expiresAtMs:now()+approvalDeadlineMs};
   const answer=await decideWithin(approvals,request,options.signal,approvalDeadlineMs);
   if(answer===EXPIRED||now()>request.expiresAtMs)return refusal('BROWSER_APPROVAL_EXPIRED');
   if(answer===ABORTED||options.signal?.aborted)return refusal('BROWSER_APPROVAL_UNAVAILABLE');
   if(answer?.decision==='approve'&&answer.toolUseId===options.toolUseID&&answer.inputDigest===inputDigest)return {behavior:'allow',updatedInput:approvedInput,toolUseID:options.toolUseID};
   return refusal('BROWSER_APPROVAL_DENIED');
  }catch{return refusal('BROWSER_APPROVAL_UNAVAILABLE');}
 };
 return Object.freeze({preToolUse,canUseTool,preApproved:Object.freeze(tools.filter(t=>!INTERACTION_TOOLS.includes(t))),interactions:Object.freeze(interactions)});
}
