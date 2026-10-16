/** Browser permission gate, decided BEFORE a tool executes, through SDK-native mechanisms only:
 *
 * - `PreToolUse` hook (runs for every call, including pre-approved ones): denies tools the policy does not admit and
 *   navigations/new tabs whose URL fails the effective policy (platform limits, then the deny-by-default destination
 *   allowlist). An admitted call is registered with the page tracker (`page-context.mjs`) so its starting page is
 *   known. For interaction tools it returns `ask`, which forces the SDK permission flow even if a rule elsewhere would
 *   pre-approve the tool; with no permission surface an `ask` is terminal, so the call is refused.
 * - `canUseTool`: interaction tools are never in `allowedTools`, so they reach this callback. It binds the call to the
 *   canonical approval owner (`approval-binding.mjs`): the subject is the run binding, server, tool, tool-use id,
 *   canonical input digest, the allowlisted origin of the page the call starts from and the effective policy digest.
 *   It allows only a consumed `approved` canonical decision for that exact subject, once, and the allowed
 *   `updatedInput` is the digested copy. The port call is raced against the run's AbortSignal and a bounded approval
 *   deadline owned here (`APPROVAL_DEADLINE_MS`): expiry denies with BROWSER_APPROVAL_EXPIRED, abort with
 *   BROWSER_APPROVAL_UNAVAILABLE, the port's signal is aborted on either, and an answer that arrives after the race is
 *   settled is ignored. An unknown page, a missing port, an error or any other answer denies.
 *
 * Neither a PostToolUse hook nor a receipt can stop an action; they only record it. */
import {INTERACTION_TOOLS,checkBrowserUrl} from './policy.mjs';
import {approvalRequest,approvalSubject,createReplayLedger,receiptRefusal} from './approval-binding.mjs';
export {APPROVAL_REQUEST_SCHEMA} from './approval-binding.mjs';
const MAX_APPROVAL_INPUT=16384;
/** Approval deadline bounds in milliseconds; the runtime may configure a value inside them. */
export const APPROVAL_DEADLINE_MS=Object.freeze({default:120000,min:1000,max:900000});
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
/** `pages` is the run's page tracker (`createPageContext`); `policySha256` the digest of the effective policy. */
export function createPermissionGate({binding,policy,policySha256,server,approvals,pages,now,approvalDeadlineMs=APPROVAL_DEADLINE_MS.default}){
 if(!Number.isSafeInteger(approvalDeadlineMs)||approvalDeadlineMs<APPROVAL_DEADLINE_MS.min||approvalDeadlineMs>APPROVAL_DEADLINE_MS.max||typeof now!=='function'||typeof pages?.begin!=='function'||typeof policySha256!=='string')throw Object.assign(new Error('BROWSER_CONFIGURATION'),{code:'BROWSER_CONFIGURATION'});
 const prefix=`mcp__${server}__`,tools=policy.tools,interactions=tools.filter(t=>INTERACTION_TOOLS.includes(t)),ledger=createReplayLedger();
 const actionOf=name=>typeof name==='string'&&name.startsWith(prefix)?name.slice(prefix.length):null;
 const preToolUse=async(input,toolUseID,options)=>{
  try{
   const action=actionOf(input?.tool_name);
   if(options?.signal?.aborted||input?.hook_event_name!=='PreToolUse'||!action||typeof input.tool_use_id!=='string'||toolUseID!==undefined&&toolUseID!==input.tool_use_id)return deny('BROWSER_PERMISSION_INPUT');
   const refused=browserAdmission({policy,tools},action,input.tool_input);
   if(refused)return deny(refused);
   pages.begin(input.tool_use_id);
   return interactions.includes(action)?ask('BROWSER_APPROVAL_REQUIRED'):{};
  }catch{return deny('BROWSER_PERMISSION_INPUT');}
 };
 /** Approval for one admitted interaction call: `{behavior:'allow',...}` only for a consumed canonical approval. */
 async function approve(action,input,options,refusal){
  if(typeof approvals?.decide!=='function'||typeof options.toolUseID!=='string'||options.signal?.aborted)return refusal('BROWSER_APPROVAL_UNAVAILABLE');
  const approvedInput=structuredClone(input??{});
  if(JSON.stringify(approvedInput).length>MAX_APPROVAL_INPUT)return refusal('BROWSER_APPROVAL_INPUT_LIMIT');
  const pageOrigin=pages.originFor(options.toolUseID);if(pageOrigin===null)return refusal('BROWSER_APPROVAL_PAGE_UNKNOWN');
  const page=checkBrowserUrl(policy,pageOrigin);if(!page.ok)return refusal(page.code);
  const requestedAtMs=now(),subject=approvalSubject({binding,server,action,toolUseId:options.toolUseID,input:approvedInput,pageOrigin,policySha256});
  const request=approvalRequest({subject,input:approvedInput,requestedAtMs,expiresAtMs:requestedAtMs+approvalDeadlineMs});
  // The port gets its own copy: nothing it does can change the subject this call is checked against.
  const answer=await decideWithin(approvals,structuredClone(request),options.signal,approvalDeadlineMs);
  if(answer===EXPIRED||now()>request.expiresAtMs)return refusal('BROWSER_APPROVAL_EXPIRED');
  if(answer===ABORTED||options.signal?.aborted)return refusal('BROWSER_APPROVAL_UNAVAILABLE');
  const refused=receiptRefusal(answer,request,now());if(refused)return refusal(refused);
  if(!ledger.claim(answer))return refusal('BROWSER_APPROVAL_REPLAY');
  return {behavior:'allow',updatedInput:approvedInput,toolUseID:options.toolUseID};
 }
 /** Composable SDK `canUseTool`: returns undefined for tools that are not this server's. A refused call never ran,
  * so its page is restored in the tracker. */
 const canUseTool=async(name,input,options={})=>{
  const action=actionOf(name);
  if(action===null)return undefined;
  const refusal=message=>({behavior:'deny',message,...(typeof options.toolUseID==='string'?{toolUseID:options.toolUseID}:{})});
  let decision;
  try{
   if(options.mcpServer!==undefined&&options.mcpServer?.name!==server)decision=refusal('BROWSER_SERVER_MISMATCH');
   else{const refused=browserAdmission({policy,tools},action,input);
    decision=refused?refusal(refused):interactions.includes(action)?await approve(action,input,options,refusal):{behavior:'allow',updatedInput:input};}
  }catch{decision=refusal('BROWSER_APPROVAL_UNAVAILABLE');}
  if(decision.behavior!=='allow')pages.cancel(options.toolUseID);
  return decision;
 };
 return Object.freeze({preToolUse,canUseTool,preApproved:Object.freeze(tools.filter(t=>!INTERACTION_TOOLS.includes(t))),interactions:Object.freeze(interactions)});
}
