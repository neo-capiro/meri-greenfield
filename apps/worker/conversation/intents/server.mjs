// @ts-check
/** The one `meri_intents` SDK in-process MCP server for a run (`createSdkMcpServer`); never a second model loop and
 * never globally read-only. Pure Research Portfolio management reads return current data without a proposal; other calls prepare:
 * each call goes to the trusted intent port, which reaches the capability's canonical
 * owner and returns an immutable proposal (approval required) or an immutable draft version. Effects run only later,
 * through the existing approval control with fresh current authority; nothing here can approve or execute.
 *
 * Correlation follows `reads/server.mjs`: PreToolUse (matcher `mcp__meri_intents__.*`) checks the event, tool-use id,
 * session id (pinned on resume/fork), that the tool and selected operation are available, that the tool-use id is new
 * and the per-run call budget; it derives the delivery identity (`intentDeliveryId`) and rewrites the input with a
 * one-time token. The handler consumes the token (exact operation and argument hash), rechecks current availability, calls
 * the port within the per-call deadline and admits only a prepare-only result (`prepared.mjs`).
 *
 * UNKNOWN: a port answer of UNKNOWN, or a deadline/cancellation after the port call started, is reported as UNKNOWN
 * and recorded as such; it is never retried here, and a repeat with the same identity is answered by the journal. */
import {createSdkMcpServer} from '@anthropic-ai/claude-agent-sdk';
import {randomUUID} from 'node:crypto';
import {own,data} from '../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256} from '../../../../packages/contracts/validate.mjs';
import {researchActionValidators,officeEditValidators} from '../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {createOperationLifetime} from '../../../../packages/runtime/operation-lifetime.mjs';
import {INTENT_SERVER_NAME,INTENT_TOOL_PREFIX,intentToolName} from './catalog.mjs';
import {defineIntentTool} from './tools.mjs';
import {conversationBound,intentRowBinding} from './schema.mjs';
import {assertPreparedResult} from './prepared.mjs';
import {intentFailureCode,intentFailureResult,preparedResult} from './results.mjs';
const fault=(/** @type {string} */code)=>Object.assign(Error(code),{code});
const SESSION=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u,TOOL_USE=/^[A-Za-z0-9_-]{1,128}$/u;
/** Delivery identity of one tool use: tenant, actor and conversation, the SDK session and the tool-use id. It omits the
 * run and attempt, so the same tool use replayed by a later attempt or a resume of the same SDK session reaches the
 * port's replay journal under the same identity (and is answered from it); a fork has a new session, so a new identity.
 * @param {any} binding @param {string} sessionId @param {string} toolUseId */
export const intentDeliveryId=(binding,sessionId,toolUseId)=>'sdk:'+canonicalSha256({tenantId:binding.tenantId,actorId:binding.actorId,conversationId:binding.conversationId,sessionId,toolUseId,server:INTENT_SERVER_NAME});
/** Per-call deadline bounds (the SDK server `timeout`). */
export const INTENT_TIMEOUT_MS=Object.freeze({min:1000,max:60000});
/** PROPOSAL P-INT-4 (unqualified upper bound, pending dot): write requests one run may prepare. */
export const MAX_INTENT_CALLS=8;
const deny=(/** @type {string} */reason)=>({hookSpecificOutput:{hookEventName:/** @type {const} */('PreToolUse'),permissionDecision:/** @type {const} */('deny'),permissionDecisionReason:reason}});
/** @typedef {{id:string,version:string}} OperationRef */
/** @typedef {{deliveryId:string,operation:OperationRef,argumentsSha256:string,outcome:'prepared'|'unknown',status:'approval_required'|'draft'|'analysis_pending'|'review_pending'|'read'|null,reference:string|null,resultSha256:string|null}} IntentReceipt */
/** Why a mounted tool answers UNAVAILABLE when the run's offer was not answered: the model must ask for a retry, not report writes off. */
const UNCHECKED_REASON='could not check whether this request can be prepared right now: preparing a request for the user\'s approval did not get an answer in time, so nothing was prepared. This is temporary, not a disabled capability; ask the user to try again in a new message';
/** A `stillAvailable` refusal marked `unchecked` (a transient mid-run loss) takes the same reason. */
const uncheckedRefusal=(/** @type {unknown} */error)=>error!==null&&typeof error==='object'&&Object.getOwnPropertyDescriptor(error,'unchecked')?.value===true;
/** The port's bounded detail on a refusal (one printable line, never values): an INVALID_ARGUMENTS field path, shown to the model
 * so it corrects the named fields instead of guessing, or a REFUSED owner's account of who answered and with what. Anything else is dropped. */
const DETAIL=/^[^\p{C}]{1,400}$/u;
const refusalDetail=(/** @type {unknown} */error)=>{const d=error!==null&&typeof error==='object'?Object.getOwnPropertyDescriptor(error,'detail')?.value:undefined;return typeof d==='string'&&DETAIL.test(d)?d:undefined;};
/**
 * `mounted` (G3 profile mount): the rows to register, a superset of `available` (which may then be empty); a mounted row outside
 * `available` answers UNAVAILABLE through `stillAvailable`. Without it exactly the available rows are registered, as before.
 * `unchecked` (profile mount only, with nothing available): the run's offer was not answered rather than refused or empty, so the
 * instructions and every UNAVAILABLE answer say whether a request can be prepared could not be checked.
 * `formats` (by exact `id@version` key, see `runtime.mjs`): the offer's declared document formats, advertised by the tool schema.
 * @param {{available:readonly import('./catalog.mjs').IntentRow[],mounted?:readonly import('./catalog.mjs').IntentRow[],unchecked?:boolean,formats?:Map<string,readonly string[]>,binding:any,scopes:any[],expectedSessionId?:string,maxCalls?:number,timeoutMs:number,deadlineMs:number,now:()=>number,
 *  stillAvailable:(operation:OperationRef,signal:AbortSignal)=>Promise<boolean>,
 *  prepare:(call:{operation:OperationRef,arguments:unknown,deliveryId:string,signal:AbortSignal})=>Promise<unknown>}} c
 */
export function createIntentServer(c){
 const maxCalls=c.maxCalls??MAX_INTENT_CALLS,profile=c.mounted!==undefined,registered=profile?c.mounted:c.available,unchecked=c.unchecked===true;
 if(!Array.isArray(c.available)||!Array.isArray(registered)||!registered.length||!profile&&!c.available.length||registered.some(r=>r.unavailable!==null)||c.available.some(r=>!registered.includes(r))||typeof c.prepare!=='function'||typeof c.stillAvailable!=='function'||typeof c.now!=='function'||
  !Number.isSafeInteger(c.timeoutMs)||c.timeoutMs<INTENT_TIMEOUT_MS.min||c.timeoutMs>INTENT_TIMEOUT_MS.max||!Number.isSafeInteger(c.deadlineMs)||
  !Number.isSafeInteger(maxCalls)||maxCalls<1||maxCalls>MAX_INTENT_CALLS||c.expectedSessionId!==undefined&&!SESSION.test(c.expectedSessionId)||
  c.unchecked!==undefined&&typeof c.unchecked!=='boolean'||unchecked&&(!profile||c.available.length)||c.formats!==undefined&&!(c.formats instanceof Map))throw fault('INTENT_SERVER_CONFIGURATION');
 const binding=data(c.binding),correlations=new Map(),seenToolUses=new Set(),receipts=/** @type {IntentReceipt[]} */([]);
 let session=c.expectedSessionId??null,closed=false,admitted=0;
 /** @type {Map<string,import('./catalog.mjs').IntentRow[]>} */
 const byTool=new Map();for(const r of registered)byTool.set(intentToolName(r.tool),[...(byTool.get(intentToolName(r.tool))??[]),r]);
 const rowFor=(/** @type {string} */name,/** @type {unknown} */id)=>byTool.get(name)?.find(r=>r.operation.id===id);
 // A request whose canonical schema names its conversation gets this run's: the model is never told the conversation id and
 // must never choose one (the 2 Nov new-conversation runs failed in the worker on a guessed id before any port call).
 const bound=new Map(registered.map(r=>[r,conversationBound(r)]));
 const bind=(/** @type {import('./catalog.mjs').IntentRow} */row,/** @type {unknown} */args)=>bound.get(row)&&args!==null&&typeof args==='object'&&!Array.isArray(args)?{...args,conversationId:binding.conversationId}:args;
 // A bound row's plain fields are completed into the owner's canonical request here, after the hook correlated the model's
 // own arguments and the SDK admitted them against the advertised fields; the port (and its journal) receives the completed request.
 const completions=new Map(registered.map(r=>[r,intentRowBinding(r)]));
 const complete=(/** @type {import('./catalog.mjs').IntentRow} */row,/** @type {unknown} */args)=>{const fn=completions.get(row);return fn?fn(args):args;};
 /** @type {import('@anthropic-ai/claude-agent-sdk').HookCallback} */
 const hook=async(raw,toolUseID,options)=>{try{
  if(closed||options?.signal?.aborted)throw fault('CANCELLED');
  const input=/** @type {any} */(data(raw)),value=input?.hook_event_name==='PreToolUse'?own(input.tool_input,['operation','arguments'],['_meriInvocation']):null,row=value&&rowFor(input.tool_name,value.operation);
  if(!row||typeof input.tool_use_id!=='string'||!TOOL_USE.test(input.tool_use_id)||toolUseID!==undefined&&toolUseID!==input.tool_use_id||
   typeof input.session_id!=='string'||!SESSION.test(input.session_id)||session!==null&&session!==input.session_id||seenToolUses.has(input.tool_use_id))throw fault('INTENT_HOOK_REFUSED');
  if(admitted>=maxCalls)throw fault('RESOURCE_LIMIT');
  admitted++;session??=input.session_id;seenToolUses.add(input.tool_use_id);
  const token=randomUUID(),deliveryId=intentDeliveryId(binding,session,input.tool_use_id),args=bind(row,value.arguments);
  correlations.set(token,{operation:row.operation,argumentsSha256:canonicalSha256(args),deliveryId});
  return {hookSpecificOutput:{hookEventName:'PreToolUse',updatedInput:{operation:value.operation,arguments:args,_meriInvocation:token}}};
 }catch(error){return deny(intentFailureCode(error)==='RESOURCE_LIMIT'?'RESOURCE_LIMIT: the write-request limit for this run is reached. Nothing has been changed.':'Write-request correlation unavailable');}};
 /** @param {string} name */
 const handler=name=>async(/** @type {any} */raw,/** @type {any} */extra)=>{
  let life,started=false,entry;
  try{
   const {operation:id,arguments:args,_meriInvocation:token}=own(data(raw),['operation','arguments'],['_meriInvocation']),row=rowFor(name,id);entry=correlations.get(token);
   if(!row||!entry||canonicalSha256(entry.operation)!==canonicalSha256(row.operation)||entry.argumentsSha256!==canonicalSha256(args))throw fault('ACCESS_DENIED');
   correlations.delete(token);if(closed)throw fault('UNAVAILABLE');
   life=createOperationLifetime({deadlineMs:Math.min(c.now()+c.timeoutMs,c.deadlineMs),now:c.now,signal:extra?.signal,errorFactory:fault});
   if(!await life.run(signal=>c.stillAvailable(row.operation,signal)))throw fault('UNAVAILABLE');
   // Only a request the canonical validators admit as a read skips the journal. A request they refuse is still sent to the port,
   // which journals and explains the INVALID_ARGUMENTS refusal; it is never an INTERNAL_ERROR decided here without a row.
   try{started=!(row.owner==='research-action'&&researchActionValidators.isManagementRead(row.operation.id,args,{binding})||row.owner==='office'&&officeEditValidators.isRead(args));}catch{started=true;}
   const result=await life.run(signal=>c.prepare({operation:row.operation,arguments:complete(row,args),deliveryId:entry.deliveryId,signal}));life.check();
   const prepared=assertPreparedResult(row.owner,row.operation,result,binding,{scopes:c.scopes,nowMs:c.now()}),json=JSON.stringify(prepared.value);
   // A read answers the exact arguments it was asked with: the office read is the one closed `{action:'read'}`.
   if(prepared.status==='read'&&canonicalSha256(row.owner==='office'?{action:'read'}:prepared.value.request)!==entry.argumentsSha256)throw fault('INVALID_RESULT');
   if(prepared.status!=='read')receipts.push(Object.freeze({deliveryId:entry.deliveryId,operation:row.operation,argumentsSha256:entry.argumentsSha256,outcome:'prepared',status:prepared.status,reference:prepared.reference,resultSha256:canonicalSha256(prepared.value)}));
   return preparedResult(json,prepared.status,row.operation.id,{officeEditing:c.available.some(r=>r.owner==='office')});
  }catch(error){
   let code=intentFailureCode(error);
   // Once the port call started, a timeout or cancellation cannot show that nothing was prepared.
   if(started&&(code==='DEADLINE'||code==='CANCELLED'))code='UNKNOWN';
   if(code==='UNKNOWN'&&entry)receipts.push(Object.freeze({deliveryId:entry.deliveryId,operation:entry.operation,argumentsSha256:entry.argumentsSha256,outcome:'unknown',status:null,reference:null,resultSha256:null}));
   return intentFailureResult(code,name,code==='UNAVAILABLE'&&(unchecked||uncheckedRefusal(error))?UNCHECKED_REASON:code==='INVALID_ARGUMENTS'||code==='REFUSED'?refusalDetail(error):undefined);
  }finally{life?.close();}
 };
 const tools=[...byTool].map(([name,rows])=>defineIntentTool(rows[0].tool,rows,handler(name),c.formats));
 const instructions=['Requests prepared for the user\'s approval in this conversation. Each call returns an immutable proposal awaiting the user\'s approval or an immutable draft; nothing here applies a change. Memory preparation creates no candidate and publishes nothing. Approved memory submission creates a pending candidate; historical review_pending receipts describe a candidate submitted for review, not active memory.',
  ...(profile?[c.available.length?`Available now: ${c.available.map(r=>r.operation.id).join(', ')}.`:unchecked?'Whether a request can be prepared for the user\'s approval could not be checked right now, so no request can be prepared in this message. This is temporary, not a disabled capability; ask the user to try again in a new message.':'No write request can be prepared in this conversation right now.','Any other request listed here cannot be prepared in this conversation and will say so.']:[`Available: ${c.available.map(r=>r.operation.id).join(', ')}.`]),'Any other write, external action or memory change is not available in this conversation.'].join('\n');
 const server=createSdkMcpServer({name:INTENT_SERVER_NAME,version:'1.0.0',instructions,tools:tools.map(t=>t.definition),alwaysLoad:true,timeout:c.timeoutMs});
 const allowedTools=Object.freeze(tools.map(t=>t.name)),allowed=new Set(allowedTools);
 return Object.freeze({server,allowedTools,
  hooks:Object.freeze({PreToolUse:[{matcher:`${INTENT_TOOL_PREFIX}.*`,hooks:[hook]}]}),
  /** @type {import('@anthropic-ai/claude-agent-sdk').CanUseTool} */
  canUseTool:async name=>allowed.has(name)?{behavior:'allow'}:{behavior:'deny',message:'Not available in this conversation'},
  receipts:()=>Object.freeze([...receipts]),
  async close(){if(!closed){closed=true;correlations.clear();await server.instance.close();}}});
}
