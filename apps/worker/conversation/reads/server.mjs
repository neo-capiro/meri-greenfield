// @ts-check
/** The one `meri_reads` SDK in-process MCP server for a run (`createSdkMcpServer`); never a second model loop.
 *
 * Correlation (FABLE-GENERAL-READ-TOOLS-20261015 §2.5), generalizing `skills/mcp.mjs`:
 * - PreToolUse (matcher `mcp__meri_reads__.*`) checks the event, tool-use id, session id (pinned on resume/fork), that
 *   the tool is in this run's available list, that the tool-use id is new, and the per-run call budget; it records a
 *   one-time token keyed to the argument hash, derives `deliveryId = 'sdk:' + sha256({binding,sessionId,toolUseId})`
 *   and rewrites the input to `{arguments, _meriInvocation}`. Any failure denies.
 * - The handler consumes the token (exact operation and argument hash), refuses a registered read outside the set
 *   available at mount, calls the gateway port within the per-call deadline (control re-checks installation, discovery
 *   and current authority on every execute), enforces output bytes, and records a receipt. Every failure is a closed
 *   `isError` text (`results.mjs`).
 * - `canUseTool` allows only this server's exact names and denies everything else; options composition chains it with
 *   the capability fragment, and the names are pre-approved in `allowedTools`, so the SDK hook chain (correlation and
 *   any audit hook) and the handler token check must all pass for a call to reach the gateway. */
import {createSdkMcpServer} from '@anthropic-ai/claude-agent-sdk';
import {randomUUID} from 'node:crypto';
import {own,data} from '../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256} from '../../../../packages/contracts/validate.mjs';
import {createOperationLifetime} from '../../../../packages/runtime/operation-lifetime.mjs';
import {READ_SERVER_NAME,READ_TOOL_PREFIX,readToolName,defineReadTool,assertConvertible} from './tools.mjs';
import {RESULT_STATE_GUIDANCE} from './family-guidance.mjs';
import {failureCode,failureResult,readNotices} from './results.mjs';
import {createReadLedger,READ_TIMEOUT_MS} from './budget.mjs';
const fault=(/** @type {string} */code)=>Object.assign(Error(code),{code});
const SESSION=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u,TOOL_USE=/^[A-Za-z0-9_-]{1,128}$/u,ALWAYS_LOAD_MAX=24;
const deny=(/** @type {string} */reason)=>({hookSpecificOutput:{hookEventName:/** @type {const} */('PreToolUse'),permissionDecision:/** @type {const} */('deny'),permissionDecisionReason:reason}});
/** @typedef {{id:string,version:string}} OperationRef */
/** @typedef {{deliveryId:string,operation:OperationRef,argumentsSha256:string,resultSha256:string,decisionId:string|null,policyRevision:string|null,executionCatalogSha256:string}} ReadReceipt */
/**
 * `mounted` (G3 profile mount, runtime.mjs `mount:'profile'`): the tools to register, a superset of `available`, which may then be
 * empty. A mounted tool outside `available` is listed but deferred (never always-loaded) and its calls answer UNAVAILABLE.
 * Without `mounted` exactly the available tools are registered, as before.
 * @param {{available:{operation:OperationRef,descriptor:any}[],unavailable:string[],mounted?:{operation:OperationRef,descriptor:any}[],binding:unknown,expectedSessionId?:string,
 *  budgets:import('./budget.mjs').ReadBudgets,timeoutMs:number,deadlineMs:number,now:()=>number,executionCatalogSha256:string|null,
 *  execute:(call:{operation:OperationRef,arguments:unknown,deliveryId:string,signal:AbortSignal})=>Promise<unknown>}} c
 */
export function createGeneralReadServer(c){
 const profile=c.mounted!==undefined,registered=profile?c.mounted:c.available;
 if(!Array.isArray(c.available)||!Array.isArray(registered)||!registered.length||!profile&&!c.available.length||typeof c.execute!=='function'||typeof c.now!=='function'||
  !Number.isSafeInteger(c.timeoutMs)||c.timeoutMs<READ_TIMEOUT_MS.min||c.timeoutMs>READ_TIMEOUT_MS.max||!Number.isSafeInteger(c.deadlineMs)||
  c.expectedSessionId!==undefined&&!SESSION.test(c.expectedSessionId))throw fault('READ_SERVER_CONFIGURATION');
 const binding=data(c.binding),ledger=createReadLedger(c.budgets),correlations=new Map(),seenToolUses=new Set(),receipts=/** @type {ReadReceipt[]} */([]);
 let session=c.expectedSessionId??null,closed=false;
 const byName=new Map(registered.map(row=>[readToolName(row),row]));
 if(byName.size!==registered.length)throw fault('READ_TOOL_COLLISION');
 const availableNames=new Set(c.available.map(readToolName));if([...availableNames].some(name=>!byName.has(name)))throw fault('READ_SERVER_CONFIGURATION');
 /** @type {import('@anthropic-ai/claude-agent-sdk').HookCallback} */
 const hook=async(raw,toolUseID,options)=>{try{
  if(closed||options?.signal?.aborted)throw fault('CANCELLED');
  const input=/** @type {any} */(data(raw)),row=byName.get(input.tool_name);
  if(input.hook_event_name!=='PreToolUse'||!row||typeof input.tool_use_id!=='string'||!TOOL_USE.test(input.tool_use_id)||toolUseID!==undefined&&toolUseID!==input.tool_use_id||
   typeof input.session_id!=='string'||!SESSION.test(input.session_id)||session!==null&&session!==input.session_id||seenToolUses.has(input.tool_use_id))throw fault('READ_HOOK_REFUSED');
  const value=own(input.tool_input,['arguments'],['_meriInvocation']);ledger.admit();
  session??=input.session_id;seenToolUses.add(input.tool_use_id);
  const token=randomUUID(),deliveryId='sdk:'+canonicalSha256({binding,sessionId:session,toolUseId:input.tool_use_id});
  correlations.set(token,{operation:row.operation,argumentsSha256:canonicalSha256(value.arguments),deliveryId});
  return {hookSpecificOutput:{hookEventName:'PreToolUse',updatedInput:{arguments:value.arguments,_meriInvocation:token}}};
 }catch(error){return deny(failureCode(error)==='RESOURCE_LIMIT'?'RESOURCE_LIMIT: the general read call limit for this run is reached. No evidence, absence or completeness is established.':'General read correlation unavailable');}};
 /** @param {{operation:OperationRef,descriptor:any}} row */
 const handler=row=>async(/** @type {any} */raw,/** @type {any} */extra)=>{
  const name=readToolName(row);let life;
  try{
   const {arguments:args,_meriInvocation:token}=own(data(raw),['arguments'],['_meriInvocation']),entry=correlations.get(token);
   if(!entry||canonicalSha256(entry.operation)!==canonicalSha256(row.operation)||entry.argumentsSha256!==canonicalSha256(args))throw fault('ACCESS_DENIED');
   correlations.delete(token);if(closed)throw fault('UNAVAILABLE');
   life=createOperationLifetime({deadlineMs:Math.min(c.now()+c.timeoutMs,c.deadlineMs),now:c.now,signal:extra?.signal,errorFactory:fault});
   if(!availableNames.has(name))throw fault('UNAVAILABLE');
   const result=await life.run(signal=>c.execute({operation:row.operation,arguments:args,deliveryId:entry.deliveryId,signal}));
   if(typeof result!=='string')throw fault('INVALID_RESULT');
   let parsed;try{parsed=data(JSON.parse(result));}catch{throw fault('INVALID_RESULT');}
   const notices=readNotices(row.operation,result,parsed);
   ledger.account([result,...notices.map(n=>n.text)].join(''));life.check();
   const subject=/** @type {any} */(parsed)?.subject;
   receipts.push(Object.freeze({deliveryId:entry.deliveryId,operation:row.operation,argumentsSha256:entry.argumentsSha256,resultSha256:canonicalSha256(parsed),
    decisionId:typeof subject?.authorizationDecisionId==='string'?subject.authorizationDecisionId:null,policyRevision:typeof subject?.policyRevision==='string'?subject.policyRevision:null,executionCatalogSha256:c.executionCatalogSha256}));
   return {content:[{type:'text',text:result},...notices]};
  }catch(error){return failureResult(failureCode(error),name);}finally{life?.close();}
 };
 // Profile mount: only reads exposed for this run may load eagerly; the others stay deferred and answer UNAVAILABLE.
 // Structured families route counts and filters to text-to-SQL first only when both SQL tools can answer in this run.
 const sqlPrimary=['describe_capiro_data','query_capiro_data'].every(id=>c.available.some(row=>row.operation.id===id));
 const alwaysLoad=c.available.length<=ALWAYS_LOAD_MAX,tools=registered.map(row=>defineReadTool(row,handler(row),alwaysLoad&&availableNames.has(readToolName(row)),{sqlPrimary}));
 for(const t of tools)assertConvertible(t.shape);
 const instructions=['Read-only Meri institutional sources for this conversation. Preserve exact source IDs, versions, hashes and scopes; separate inference; disclose partial or unavailable evidence. An error result establishes no evidence, absence or completeness. No write, external action or artifact is exposed here.',
  RESULT_STATE_GUIDANCE,
  'In General, client profile, documents, meeting sources, knowledge search and tracked bills require one explicit client UUID. Resolve a named client with lookup_client_registry first and use its returned UUID; ask the user to disambiguate multiple matches. A registry result does not grant access and these reads do not search across all clients. In a selected-client conversation, keep that selected client.',
  ...(profile?[c.available.length?`Available now: ${c.available.map(row=>row.descriptor.displayName).join('; ')}.`:'No institutional source tool is available in this conversation right now.',
   'Every other tool of this server answers UNAVAILABLE in this conversation.']
   :[`Available: ${c.available.map(row=>row.descriptor.displayName).join('; ')}.`,...(c.unavailable.length?[`Not available in this conversation: ${c.unavailable.join('; ')}.`]:[])]),
  'Other institutional sources are not available in this conversation.'].join('\n');
 const server=createSdkMcpServer({name:READ_SERVER_NAME,version:'1.0.0',instructions,tools:tools.map(t=>t.definition),alwaysLoad:!profile&&alwaysLoad,timeout:c.timeoutMs});
 const allowedTools=Object.freeze([...byName.keys()]),allowed=new Set(allowedTools);
 return Object.freeze({server,allowedTools,modes:Object.freeze(Object.fromEntries(tools.map((t,i)=>[allowedTools[i],t.mode]))),
  hooks:Object.freeze({PreToolUse:[{matcher:`${READ_TOOL_PREFIX}.*`,hooks:[hook]}]}),
  /** @type {import('@anthropic-ai/claude-agent-sdk').CanUseTool} */
  canUseTool:async name=>allowed.has(name)?{behavior:'allow'}:{behavior:'deny',message:'Tool unavailable'},
  receipts:()=>Object.freeze([...receipts]),
  async close(){if(!closed){closed=true;correlations.clear();await server.instance.close();}}});
}
