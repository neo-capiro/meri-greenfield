// @ts-check
/** The one `meri_reads` SDK in-process MCP server for a run (`createSdkMcpServer`); never a second model loop.
 *
 * Correlation (FABLE-GENERAL-READ-TOOLS-20261015 §2.5), generalizing `skills/mcp.mjs`:
 * - PreToolUse (matcher `mcp__meri_reads__.*`) checks the event, tool-use id, session id (pinned on resume/fork), that
 *   the tool is in this run's available list, that the tool-use id is new, and the per-run call budget; it records a
 *   one-time token keyed to the argument hash, derives `deliveryId = 'sdk:' + sha256({binding,sessionId,toolUseId})`
 *   and rewrites the input to `{arguments, _meriInvocation}`. Any failure denies.
 * - The handler consumes the token (exact operation and argument hash), rechecks current availability, calls the
 *   gateway port within the per-call deadline, enforces output bytes, and records a receipt. Every failure is a closed
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
import {failureCode,failureResult} from './results.mjs';
import {createReadLedger,READ_TIMEOUT_MS} from './budget.mjs';
const fault=(/** @type {string} */code)=>Object.assign(Error(code),{code});
const SESSION=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u,TOOL_USE=/^[A-Za-z0-9_-]{1,128}$/u,ALWAYS_LOAD_MAX=24;
const deny=(/** @type {string} */reason)=>({hookSpecificOutput:{hookEventName:/** @type {const} */('PreToolUse'),permissionDecision:/** @type {const} */('deny'),permissionDecisionReason:reason}});
/** @typedef {{id:string,version:string}} OperationRef */
/** @typedef {{deliveryId:string,operation:OperationRef,argumentsSha256:string,resultSha256:string,decisionId:string|null,policyRevision:string|null,executionCatalogSha256:string}} ReadReceipt */
/**
 * @param {{available:{operation:OperationRef,descriptor:any}[],unavailable:string[],binding:unknown,expectedSessionId?:string,
 *  budgets:import('./budget.mjs').ReadBudgets,timeoutMs:number,deadlineMs:number,now:()=>number,executionCatalogSha256:string,
 *  stillAvailable:(operation:OperationRef,signal:AbortSignal)=>Promise<boolean>,
 *  execute:(call:{operation:OperationRef,arguments:unknown,deliveryId:string,signal:AbortSignal})=>Promise<unknown>}} c
 */
export function createGeneralReadServer(c){
 if(!Array.isArray(c.available)||!c.available.length||typeof c.execute!=='function'||typeof c.stillAvailable!=='function'||typeof c.now!=='function'||
  !Number.isSafeInteger(c.timeoutMs)||c.timeoutMs<READ_TIMEOUT_MS.min||c.timeoutMs>READ_TIMEOUT_MS.max||!Number.isSafeInteger(c.deadlineMs)||
  c.expectedSessionId!==undefined&&!SESSION.test(c.expectedSessionId))throw fault('READ_SERVER_CONFIGURATION');
 const binding=data(c.binding),ledger=createReadLedger(c.budgets),correlations=new Map(),seenToolUses=new Set(),receipts=/** @type {ReadReceipt[]} */([]);
 let session=c.expectedSessionId??null,closed=false;
 const byName=new Map(c.available.map(row=>[readToolName(row),row]));
 if(byName.size!==c.available.length)throw fault('READ_TOOL_COLLISION');
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
   if(!await life.run(signal=>c.stillAvailable(row.operation,signal)))throw fault('UNAVAILABLE');
   const result=await life.run(signal=>c.execute({operation:row.operation,arguments:args,deliveryId:entry.deliveryId,signal}));
   if(typeof result!=='string')throw fault('INVALID_RESULT');
   let parsed;try{parsed=data(JSON.parse(result));}catch{throw fault('INVALID_RESULT');}
   ledger.account(result);life.check();
   const subject=/** @type {any} */(parsed)?.subject;
   receipts.push(Object.freeze({deliveryId:entry.deliveryId,operation:row.operation,argumentsSha256:entry.argumentsSha256,resultSha256:canonicalSha256(parsed),
    decisionId:typeof subject?.authorizationDecisionId==='string'?subject.authorizationDecisionId:null,policyRevision:typeof subject?.policyRevision==='string'?subject.policyRevision:null,executionCatalogSha256:c.executionCatalogSha256}));
   return {content:[{type:'text',text:result}]};
  }catch(error){return failureResult(failureCode(error),name);}finally{life?.close();}
 };
 const alwaysLoad=c.available.length<=ALWAYS_LOAD_MAX,tools=c.available.map(row=>defineReadTool(row,handler(row),alwaysLoad));
 for(const t of tools)assertConvertible(t.shape);
 const instructions=['Read-only Meri institutional sources for this conversation. Preserve exact source IDs, versions, hashes and scopes; separate inference; disclose partial or unavailable evidence. An error result establishes no evidence, absence or completeness. No write, external action or artifact is exposed here.',
  `Available: ${c.available.map(row=>row.descriptor.displayName).join('; ')}.`,
  ...(c.unavailable.length?[`Not available in this conversation: ${c.unavailable.join('; ')}.`]:[]),'Other institutional sources are not available in this conversation.'].join('\n');
 const server=createSdkMcpServer({name:READ_SERVER_NAME,version:'1.0.0',instructions,tools:tools.map(t=>t.definition),alwaysLoad,timeout:c.timeoutMs});
 const allowedTools=Object.freeze([...byName.keys()]),allowed=new Set(allowedTools);
 return Object.freeze({server,allowedTools,modes:Object.freeze(Object.fromEntries(tools.map((t,i)=>[allowedTools[i],t.mode]))),
  hooks:Object.freeze({PreToolUse:[{matcher:`${READ_TOOL_PREFIX}.*`,hooks:[hook]}]}),
  /** @type {import('@anthropic-ai/claude-agent-sdk').CanUseTool} */
  canUseTool:async name=>allowed.has(name)?{behavior:'allow'}:{behavior:'deny',message:'Tool unavailable'},
  receipts:()=>Object.freeze([...receipts]),
  async close(){if(!closed){closed=true;correlations.clear();await server.instance.close();}}});
}
