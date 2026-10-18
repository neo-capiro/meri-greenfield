// @ts-check
/** Entry for general reads in one conversation run. Reads the trusted availability facts from the gateway port,
 * applies the six gates and, only when at least one read is available, builds the `meri_reads` server and returns
 * the SDK options to mount. Otherwise it returns null: no server is mounted and the default prompt stays true.
 *
 * The port is the gateway general-read mount (`apps/gateway/general-reads/mount.mjs`), supplied by the trusted runtime
 * composition: `readAvailability({signal})` and `execute({operation,arguments,deliveryId,signal})`. No production
 * composition supplies it yet, and without a current native installation receipt the snapshot installs nothing, so
 * zero reads are available today. */
import catalog from '../../../../packages/contracts/retrieval-0.2/catalog.json' with {type:'json'};
import {own,data,nativeSignal} from '../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256,validateShape} from '../../../../packages/contracts/validate.mjs';
import {createOperationLifetime} from '../../../../packages/runtime/operation-lifetime.mjs';
import {assertAvailabilitySnapshot} from './snapshot.mjs';
import {resolveAvailableReads} from './availability.mjs';
import {createGeneralReadServer} from './server.mjs';
import {effectiveReadBudgets,READ_TIMEOUT_MS} from './budget.mjs';
const fault=(/** @type {string} */code)=>Object.assign(Error(code),{code});
const CATALOG_SHA256=canonicalSha256(catalog),SNAPSHOT_MS=3000;
/** Session id the SDK must report when continuing: the resumed checkpoint session, or the fork target.
 * @param {any} lineage @returns {string|undefined} */
export function continuationSessionId(lineage){
 if(lineage?.continuation)return lineage.continuation.mode==='resume'?lineage.continuation.checkpoint.sessionId:lineage.continuation.targetSessionId;
 if(lineage?.nextTurn)return lineage.nextTurn.checkpoint.sessionId;
 return undefined;
}
/**
 * @param {{binding:unknown,scopes:any[],policy:{generalReads:boolean,readFamilies:readonly string[]},port:{readAvailability:Function,execute:Function},
 *  now:()=>number,deadlineMs:number,timeoutMs?:number,expectedSessionId?:string,skill?:{allowedOperations:{id:string,version:string}[],budgets:{maxToolCalls:number,maxOutputBytes:number}},
 *  exclude?:{id:string,version:string}[],runBudgets?:{maxToolCalls:number},signal?:AbortSignal}} configuration
 */
export async function createGeneralReadRuntime(configuration){
 const c=own(configuration,['binding','scopes','policy','port','now','deadlineMs'],['timeoutMs','expectedSessionId','skill','exclude','runBudgets','signal']);
 const binding=data(c.binding),scopes=data(c.scopes),port=own(c.port,['readAvailability','execute']);nativeSignal(c.signal);validateShape('RunBinding',binding);
 if(!Array.isArray(scopes)||!scopes.length||typeof port.readAvailability!=='function'||typeof port.execute!=='function'||typeof c.now!=='function'||!Number.isSafeInteger(c.deadlineMs))throw fault('READ_CONFIGURATION');
 scopes.forEach(s=>validateShape('Scope',s));const policyRevision=scopes[0].policyRevision;
 if(c.policy?.generalReads!==true)return null;
 const timeoutMs=Math.min(c.timeoutMs??READ_TIMEOUT_MS.max,READ_TIMEOUT_MS.max),budgets=effectiveReadBudgets(c.skill?.budgets,c.runBudgets);
 /** Fresh snapshot within a bounded wait; any failure is "not available". @param {AbortSignal|undefined} signal */
 const read=async signal=>{const life=createOperationLifetime({deadlineMs:c.now()+SNAPSHOT_MS,now:c.now,signal,errorFactory:fault});
  try{return assertAvailabilitySnapshot(await life.run(s=>port.readAvailability.call(c.port,{signal:s})),{binding,policyRevision,catalogSha256:CATALOG_SHA256,now:c.now});}finally{life.close();}};
 const gates=(/** @type {ReturnType<typeof assertAvailabilitySnapshot>} */snapshot)=>resolveAvailableReads({policy:c.policy,installation:snapshot.installation,discovery:snapshot.discovery,scopes,
  ...(c.skill?{narrowTo:c.skill.allowedOperations}:{}),exclude:c.exclude??[]});
 let initial;try{initial=await read(c.signal);}catch{return null;}
 const {available,unavailable}=gates(initial);if(!available.length)return null;
 const exposed=new Set(available.map(row=>canonicalSha256(row.operation)));
 // Mid-run revocation, expiry or a narrowed grant makes a listed read unavailable; it is never widened mid-run.
 const stillAvailable=async(/** @type {{id:string,version:string}} */operation,/** @type {AbortSignal} */signal)=>{
  if(!exposed.has(canonicalSha256(operation)))return false;
  let snapshot;try{snapshot=await read(signal);}catch{if(signal.aborted)throw fault('CANCELLED');return false;}
  return gates(snapshot).available.some(row=>canonicalSha256(row.operation)===canonicalSha256(operation));
 };
 const server=createGeneralReadServer({available,unavailable,binding,...(c.expectedSessionId?{expectedSessionId:c.expectedSessionId}:{}),budgets,timeoutMs,deadlineMs:c.deadlineMs,now:c.now,
  executionCatalogSha256:initial.installation.executionCatalogSha256,stillAvailable,execute:call=>port.execute.call(c.port,call)});
 return Object.freeze({available:Object.freeze(available.map(row=>row.operation)),
  sdkOptions:Object.freeze({mcpServers:Object.freeze({meri_reads:server.server}),allowedTools:server.allowedTools,canUseTool:server.canUseTool,hooks:server.hooks}),
  receipts:server.receipts,close:()=>server.close()});
}
