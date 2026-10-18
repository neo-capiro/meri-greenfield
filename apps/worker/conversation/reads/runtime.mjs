// @ts-check
/** Entry for general reads in one conversation run. Reads the trusted availability facts from the gateway port,
 * applies the six gates and, only when at least one read is available, builds the `meri_reads` server and returns
 * the SDK options to mount. Otherwise it returns null: no server is mounted and the default prompt stays true.
 *
 * The port is the gateway general-read mount (`apps/gateway/general-reads/mount.mjs`), supplied by the trusted runtime
 * composition: `readAvailability({signal})` and `execute({operation,arguments,deliveryId,signal})`. No production
 * composition supplies it yet, and without a current native installation receipt the snapshot installs nothing, so
 * zero reads are available today.
 *
 * `mount:'profile'` (G3, the product path through `capabilities/mounts.mjs`): the server is mounted whenever the policy enables
 * general reads and the profile names at least one read (`profileReads`), with every one of those tools, whatever this run's
 * availability. The initial snapshot decides only which mounted reads are exposed for the run (never widened mid-run, exactly as
 * before); a mounted read that is not exposed, or no longer available, answers a typed UNAVAILABLE without reaching the port. A
 * failing or absent snapshot exposes nothing. The SDK options are then a function of the profile alone. */
import catalog from '../../../../packages/contracts/retrieval-0.2/catalog.json' with {type:'json'};
import {own,data,nativeSignal} from '../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256,validateShape} from '../../../../packages/contracts/validate.mjs';
import {createOperationLifetime} from '../../../../packages/runtime/operation-lifetime.mjs';
import {assertAvailabilitySnapshot} from './snapshot.mjs';
import {resolveAvailableReads,profileReads} from './availability.mjs';
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
 *  exclude?:{id:string,version:string}[],signal?:AbortSignal,mount?:'available'|'profile'}} configuration
 */
export async function createGeneralReadRuntime(configuration){
 const c=own(configuration,['binding','scopes','policy','port','now','deadlineMs'],['timeoutMs','expectedSessionId','skill','exclude','signal','mount']);
 const binding=data(c.binding),scopes=data(c.scopes),port=own(c.port,['readAvailability','execute']);nativeSignal(c.signal);validateShape('RunBinding',binding);
 if(!Array.isArray(scopes)||!scopes.length||typeof port.readAvailability!=='function'||typeof port.execute!=='function'||typeof c.now!=='function'||!Number.isSafeInteger(c.deadlineMs)||![undefined,'available','profile'].includes(c.mount))throw fault('READ_CONFIGURATION');
 const profile=c.mount==='profile';
 scopes.forEach(s=>validateShape('Scope',s));const policyRevision=scopes[0].policyRevision;
 if(c.policy?.generalReads!==true)return null;
 const timeoutMs=Math.min(c.timeoutMs??READ_TIMEOUT_MS.max,READ_TIMEOUT_MS.max),budgets=effectiveReadBudgets(c.skill?.budgets);
 /** Fresh snapshot within a bounded wait; any failure is "not available". @param {AbortSignal|undefined} signal */
 const read=async signal=>{const life=createOperationLifetime({deadlineMs:c.now()+SNAPSHOT_MS,now:c.now,signal,errorFactory:fault});
  try{return assertAvailabilitySnapshot(await life.run(s=>port.readAvailability.call(c.port,{signal:s})),{binding,policyRevision,catalogSha256:CATALOG_SHA256,now:c.now});}finally{life.close();}};
 const narrowing={...(c.skill?{narrowTo:c.skill.allowedOperations}:{}),exclude:c.exclude??[]};
 const gates=(/** @type {ReturnType<typeof assertAvailabilitySnapshot>} */snapshot)=>resolveAvailableReads({policy:c.policy,installation:snapshot.installation,discovery:snapshot.discovery,scopes,...narrowing});
 // Profile mount: the tools are fixed by the profile before any availability is read.
 const mounted=profile?profileReads({policy:c.policy,...narrowing}):undefined;if(mounted&&!mounted.length)return null;
 /** @type {ReturnType<typeof assertAvailabilitySnapshot>|undefined} */let initial;try{initial=await read(c.signal);}catch{if(!profile)return null;}
 const {available,unavailable}=initial?gates(initial):{available:[],unavailable:[]};if(!profile&&!available.length)return null;
 const exposed=new Set(available.map(row=>canonicalSha256(row.operation)));
 // Mid-run revocation, expiry or a narrowed grant makes a listed read unavailable; it is never widened mid-run.
 const stillAvailable=async(/** @type {{id:string,version:string}} */operation,/** @type {AbortSignal} */signal)=>{
  if(!exposed.has(canonicalSha256(operation)))return false;
  let snapshot;try{snapshot=await read(signal);}catch{if(signal.aborted)throw fault('CANCELLED');return false;}
  return gates(snapshot).available.some(row=>canonicalSha256(row.operation)===canonicalSha256(operation));
 };
 const server=createGeneralReadServer({available,unavailable,...(mounted?{mounted}:{}),binding,...(c.expectedSessionId?{expectedSessionId:c.expectedSessionId}:{}),budgets,timeoutMs,deadlineMs:c.deadlineMs,now:c.now,
  executionCatalogSha256:initial?.installation.executionCatalogSha256??null,stillAvailable,execute:call=>port.execute.call(c.port,call)});
 return Object.freeze({available:Object.freeze(available.map(row=>row.operation)),
  sdkOptions:Object.freeze({mcpServers:Object.freeze({meri_reads:server.server}),allowedTools:server.allowedTools,canUseTool:server.canUseTool,hooks:server.hooks}),
  receipts:server.receipts,close:()=>server.close()});
}
