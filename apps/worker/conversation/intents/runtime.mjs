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
 * call answers a typed UNAVAILABLE without reaching the port. The SDK options are then a function of the profile alone. A failed
 * offer is never silent: `diagnostic` receives one closed `{code, layer, elapsedMs}` fact (the layer whose bound answered: this
 * worker, the runner client or control); an unanswered (transient) offer also makes the server tell the model that whether a
 * request can be prepared could not be checked, never that the capability is off. The same applies to a mid-run re-check. */
import {own,data,nativeSignal} from '../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256,validateShape} from '../../../../packages/contracts/validate.mjs';
import {createOperationLifetime} from '../../../../packages/runtime/operation-lifetime.mjs';
import {INTENT_AVAILABILITY_WORKER_MS} from '../../../../packages/runtime/runner-load-budget.mjs';
import {resolveOperationContract} from '../../../../packages/contracts/retrieval-0.2/validate.mjs';
import catalog from '../../../../packages/contracts/retrieval-0.3/catalog.json' with {type:'json'};
import {INTENT_ROWS,INTENT_SERVER_NAME,assertIntentCatalog} from './catalog.mjs';
import {createIntentServer,INTENT_TIMEOUT_MS} from './server.mjs';
const fault=(/** @type {string} */code)=>Object.assign(Error(code),{code});
/** The canonical authority for an admissible intent operation version: the catalog owner's own resolver, so an exact
 * `id@version` is admitted only when it resolves to its registered descriptor and immutable schema. A retained 0.2
 * reference and the current 0.3 successor both survive the snapshot whole, while a version-mismatched or unregistered
 * operation still refuses it. Which admitted operation becomes a visible tool is decided separately by the exact
 * `id@version` intersection with INTENT_ROWS below. */
const registered=(/** @type {{id:string,version:string}} */operation)=>{try{resolveOperationContract(operation);return true;}catch{return false;}};
/** Names the catalog itself publishes as deferred originals: declared capabilities with no operation contract at any
 * version. A port may honestly report one (it is not an operation, so it can never become a visible tool), and
 * refusing the whole snapshot over it would disable every intent the port does back. Derived from the catalog's own
 * `originals`/`disposition` data, so this is the same authority, not a copied list. */
const declaredOriginals=new Set(catalog.originals.filter(o=>o.disposition==='deferred').map(o=>o.id));
const admissible=(/** @type {{id:string,version:string}} */operation)=>registered(operation)||declaredOriginals.has(operation.id);
const OPERATION=/^[a-z][a-z_]{0,62}$/u;
const key=(/** @type {{id:string,version:string}} */o)=>canonicalSha256({id:o.id,version:o.version});
/** The closed fact of a failed offer: an own string `code` (else UNAVAILABLE), the layer that decided it (the runner client marks
 * its own and control's answers; anything else was decided here) and the elapsed time. Never a message or stack.
 * @param {unknown} error @param {number} elapsedMs @returns {{code:string,layer:'worker'|'runner'|'control',elapsedMs:number}} */
const offerFailure=(error,elapsedMs)=>{
 const ownValue=(/** @type {string} */name)=>error!==null&&typeof error==='object'?Object.getOwnPropertyDescriptor(error,name)?.value:undefined,code=ownValue('code'),layer=ownValue('layer');
 return Object.freeze({code:typeof code==='string'?code:'UNAVAILABLE',layer:layer==='runner'||layer==='control'?layer:'worker',elapsedMs});
};
/** A failure that says the offer was not answered rather than refused: a deadline or cancellation at any layer, or the runner
 * client's own UNAVAILABLE (transport loss before control answered). Control's UNAVAILABLE is an answer (intents off, nothing
 * composed), and an absent port, ACCESS_DENIED or a malformed offer is decided: those keep the plain "not available" wording and
 * never invite a retry. @param {{code:string,layer:string}} failure */
const transient=failure=>failure.code==='DEADLINE'||failure.code==='CANCELLED'||failure.code==='UNAVAILABLE'&&failure.layer==='runner';
/** Validate the port's availability facts for this run; anything malformed, foreign or stale refuses.
 * @param {unknown} raw @param {any} binding @param {number} at @returns {Set<string>} */
export function assertIntentAvailability(raw,binding,at){
 try{
  const s=/** @type {any} */(data(own(raw,['binding','operations','checkedAtMs','expiresAtMs'])));
  if(canonicalSha256(s.binding)!==canonicalSha256(binding)||!Array.isArray(s.operations)||s.operations.length>INTENT_ROWS.length||
   !Number.isSafeInteger(s.checkedAtMs)||!Number.isSafeInteger(s.expiresAtMs)||s.checkedAtMs>at||s.expiresAtMs<=at)throw 0;
  const keys=new Set();
  for(const o of s.operations){own(o,['id','version']);if(typeof o.id!=='string'||!OPERATION.test(o.id)||!admissible(o)||keys.has(key(o)))throw 0;keys.add(key(o));}
  return keys;
 }catch{throw fault('INTENT_AVAILABILITY_REFUSED');}
}
/**
 * @param {{binding:unknown,scopes:any[],policy:{governedIntents?:boolean},port:{readAvailability:Function,prepare:Function},now:()=>number,deadlineMs:number,
 *  timeoutMs?:number,expectedSessionId?:string,signal?:AbortSignal,mount?:'available'|'profile',diagnostic?:(failure:{code:string,layer:'worker'|'runner'|'control',elapsedMs:number})=>void}} configuration
 */
export async function createIntentRuntime(configuration){
 const c=own(configuration,['binding','scopes','policy','port','now','deadlineMs'],['timeoutMs','expectedSessionId','signal','mount','diagnostic']);
 const binding=data(c.binding),scopes=data(c.scopes),port=own(c.port,['readAvailability','prepare']);nativeSignal(c.signal);validateShape('RunBinding',binding);
 if(!Array.isArray(scopes)||!scopes.length||typeof port.readAvailability!=='function'||typeof port.prepare!=='function'||typeof c.now!=='function'||!Number.isSafeInteger(c.deadlineMs)||![undefined,'available','profile'].includes(c.mount)||
  c.diagnostic!==undefined&&typeof c.diagnostic!=='function')throw fault('INTENT_CONFIGURATION');
 const profile=c.mount==='profile';
 scopes.forEach(s=>{validateShape('Scope',s);if(s.tenantId!==binding.tenantId)throw fault('INTENT_CONFIGURATION');});
 if(c.policy?.governedIntents!==true)return null;
 assertIntentCatalog();
 const timeoutMs=Math.min(c.timeoutMs??INTENT_TIMEOUT_MS.max,INTENT_TIMEOUT_MS.max);
 /** @param {AbortSignal|undefined} signal */
 const read=async signal=>{const life=createOperationLifetime({deadlineMs:c.now()+INTENT_AVAILABILITY_WORKER_MS,now:c.now,signal,errorFactory:fault});
  try{return assertIntentAvailability(await life.run(s=>port.readAvailability.call(c.port,{signal:s})),binding,c.now());}finally{life.close();}};
 const gates=(/** @type {Set<string>} */offered)=>INTENT_ROWS.filter(r=>r.unavailable===null&&offered.has(key(r.operation)));
 /** Report one failed offer (initial or mid-run) through `diagnostic` and return its closed fact. @param {unknown} error @param {number} started */
 const report=(error,started)=>{const failure=offerFailure(error,c.now()-started);try{c.diagnostic?.(failure);}catch{}return failure;};
 // Profile mount (G3): every owner-backed intent row is mounted whatever this run's offer; a failing offer exposes nothing and is
 // reported once; an unanswered (transient) one also marks the server `unchecked`, so the model asks for a retry instead of
 // reporting the capability as off, while a decided refusal keeps the plain "not available" answer.
 const mounted=profile?INTENT_ROWS.filter(r=>r.unavailable===null):undefined;
 /** @type {Set<string>} */let initial=new Set();let unchecked=false;const started=c.now();
 try{initial=await read(c.signal);}catch(error){if(!profile)return null;unchecked=transient(report(error,started));}
 const available=gates(initial);if(!profile&&!available.length)return null;
 const exposed=new Set(available.map(r=>key(r.operation)));
 // Mid-run revocation or a narrowed composition makes a listed intent unavailable; it is never widened mid-run. A mid-run offer
 // loss is reported the same way; when transient this one call answers "could not be checked" instead of "not available".
 const stillAvailable=async(/** @type {{id:string,version:string}} */operation,/** @type {AbortSignal} */signal)=>{
  if(!exposed.has(key(operation)))return false;
  const started=c.now();let offered;
  try{offered=await read(signal);}catch(error){if(signal.aborted)throw fault('CANCELLED');if(transient(report(error,started)))throw Object.assign(fault('UNAVAILABLE'),{unchecked:true});return false;}
  return gates(offered).some(r=>key(r.operation)===key(operation));
 };
 const server=createIntentServer({available,...(mounted?{mounted,unchecked}:{}),binding,scopes,...(c.expectedSessionId?{expectedSessionId:c.expectedSessionId}:{}),timeoutMs,deadlineMs:c.deadlineMs,now:c.now,stillAvailable,
  prepare:call=>port.prepare.call(c.port,call)});
 return Object.freeze({available:Object.freeze(available.map(r=>r.operation)),
  sdkOptions:Object.freeze({mcpServers:Object.freeze({[INTENT_SERVER_NAME]:server.server}),allowedTools:server.allowedTools,canUseTool:server.canUseTool,hooks:server.hooks}),
  receipts:server.receipts,close:()=>server.close()});
}
