// @ts-check
/** Entry for governed write requests in one conversation run. Only when the run's capability policy enables
 * `governedIntents` does it read the trusted intent port's availability, intersect it with the intent catalog's
 * owner-backed rows, and build the `meri_intents` server; otherwise, or when nothing is available, it returns null and
 * no server is mounted.
 *
 * The port is the control intent mount (`apps/control/intents/mount.mjs`), supplied by the trusted runtime composition:
 * `readAvailability({signal})` → `{binding, operations, checkedAtMs, expiresAtMs}` (LOCAL PROPOSAL P-INT-2) and
 * `prepare({operation, arguments, deliveryId, signal})`. No production composition supplies it yet. Rows the catalog
 * marks unavailable are never registered, whatever the port claims.
 *
 * `mount:'profile'` (G3, the product path through `capabilities/mounts.mjs`): with `governedIntents` the server is ALWAYS mounted with
 * every owner-backed row; the initial offer only decides which rows are exposed for the run (never widened mid-run), and every other
 * call answers a typed UNAVAILABLE without reaching the port. The SDK options are then a function of the profile alone. */
import {own,data,nativeSignal} from '../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256,validateShape} from '../../../../packages/contracts/validate.mjs';
import {createOperationLifetime} from '../../../../packages/runtime/operation-lifetime.mjs';
import {INTENT_ROWS,INTENT_SERVER_NAME,assertIntentCatalog} from './catalog.mjs';
import {createIntentServer,INTENT_TIMEOUT_MS} from './server.mjs';
const fault=(/** @type {string} */code)=>Object.assign(Error(code),{code});
const SNAPSHOT_MS=3000,OPERATION=/^[a-z][a-z_]{0,62}$/u;
const key=(/** @type {{id:string,version:string}} */o)=>canonicalSha256({id:o.id,version:o.version});
/** Validate the port's availability facts for this run; anything malformed, foreign or stale refuses.
 * @param {unknown} raw @param {any} binding @param {number} at @returns {Set<string>} */
export function assertIntentAvailability(raw,binding,at){
 try{
  const s=/** @type {any} */(data(own(raw,['binding','operations','checkedAtMs','expiresAtMs'])));
  if(canonicalSha256(s.binding)!==canonicalSha256(binding)||!Array.isArray(s.operations)||s.operations.length>INTENT_ROWS.length||
   !Number.isSafeInteger(s.checkedAtMs)||!Number.isSafeInteger(s.expiresAtMs)||s.checkedAtMs>at||s.expiresAtMs<=at)throw 0;
  const keys=new Set();
  for(const o of s.operations){own(o,['id','version']);if(typeof o.id!=='string'||!OPERATION.test(o.id)||o.version!=='0.2.0'||keys.has(key(o)))throw 0;keys.add(key(o));}
  return keys;
 }catch{throw fault('INTENT_AVAILABILITY_REFUSED');}
}
/**
 * @param {{binding:unknown,scopes:any[],policy:{governedIntents?:boolean},port:{readAvailability:Function,prepare:Function},now:()=>number,deadlineMs:number,
 *  timeoutMs?:number,expectedSessionId?:string,signal?:AbortSignal,mount?:'available'|'profile'}} configuration
 */
export async function createIntentRuntime(configuration){
 const c=own(configuration,['binding','scopes','policy','port','now','deadlineMs'],['timeoutMs','expectedSessionId','signal','mount']);
 const binding=data(c.binding),scopes=data(c.scopes),port=own(c.port,['readAvailability','prepare']);nativeSignal(c.signal);validateShape('RunBinding',binding);
 if(!Array.isArray(scopes)||!scopes.length||typeof port.readAvailability!=='function'||typeof port.prepare!=='function'||typeof c.now!=='function'||!Number.isSafeInteger(c.deadlineMs)||![undefined,'available','profile'].includes(c.mount))throw fault('INTENT_CONFIGURATION');
 const profile=c.mount==='profile';
 scopes.forEach(s=>{validateShape('Scope',s);if(s.tenantId!==binding.tenantId)throw fault('INTENT_CONFIGURATION');});
 if(c.policy?.governedIntents!==true)return null;
 assertIntentCatalog();
 const timeoutMs=Math.min(c.timeoutMs??INTENT_TIMEOUT_MS.max,INTENT_TIMEOUT_MS.max);
 /** @param {AbortSignal|undefined} signal */
 const read=async signal=>{const life=createOperationLifetime({deadlineMs:c.now()+SNAPSHOT_MS,now:c.now,signal,errorFactory:fault});
  try{return assertIntentAvailability(await life.run(s=>port.readAvailability.call(c.port,{signal:s})),binding,c.now());}finally{life.close();}};
 const gates=(/** @type {Set<string>} */offered)=>INTENT_ROWS.filter(r=>r.unavailable===null&&offered.has(key(r.operation)));
 // Profile mount (G3): every owner-backed intent row is mounted whatever this run's offer; a failing offer exposes nothing.
 const mounted=profile?INTENT_ROWS.filter(r=>r.unavailable===null):undefined;
 /** @type {Set<string>} */let initial=new Set();try{initial=await read(c.signal);}catch{if(!profile)return null;}
 const available=gates(initial);if(!profile&&!available.length)return null;
 const exposed=new Set(available.map(r=>key(r.operation)));
 // Mid-run revocation or a narrowed composition makes a listed intent unavailable; it is never widened mid-run.
 const stillAvailable=async(/** @type {{id:string,version:string}} */operation,/** @type {AbortSignal} */signal)=>{
  if(!exposed.has(key(operation)))return false;
  let offered;try{offered=await read(signal);}catch{if(signal.aborted)throw fault('CANCELLED');return false;}
  return gates(offered).some(r=>key(r.operation)===key(operation));
 };
 const server=createIntentServer({available,...(mounted?{mounted}:{}),binding,scopes,...(c.expectedSessionId?{expectedSessionId:c.expectedSessionId}:{}),timeoutMs,deadlineMs:c.deadlineMs,now:c.now,stillAvailable,
  prepare:call=>port.prepare.call(c.port,call)});
 return Object.freeze({available:Object.freeze(available.map(r=>r.operation)),
  sdkOptions:Object.freeze({mcpServers:Object.freeze({[INTENT_SERVER_NAME]:server.server}),allowedTools:server.allowedTools,canUseTool:server.canUseTool,hooks:server.hooks}),
  receipts:server.receipts,close:()=>server.close()});
}
