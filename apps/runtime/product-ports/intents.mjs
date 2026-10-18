/** Conversation write-intent approvals family (lane 3) for the production product-port composer.
 *
 * `createIntentsFamily(context)` is an ordinary synchronous factory over the trusted control context
 * `{configuration,pool,client,native,now,canonicalProductPorts,artifactRecovery?}`. Construction is inert: it opens no connection,
 * reads no secret, runs no SQL and makes no native call. It composes `apps/control/intents/compose.mjs` only when
 * `configuration.intents.enabled === true` (absent ⇒ disabled) AND the canonical membership gate is supplied by the prepared
 * candidate. Otherwise it contributes NO `intentApplication` port: the fixed product mount then answers the two intent routes
 * `503 INTENTS_UNAVAILABLE / NOT_DISPATCHED` and product readiness reports `intents.application: unavailable`. A port that only
 * answered 503 would make readiness claim `composed`, so a disabled family deliberately supplies nothing.
 *
 * Enabling asserts that Core serves `approval/record` and `approval/decision` (P-INT-10) and that the `meri_intents` and
 * `meri_commands` migrations are applied. No execution broker for conversation intents exists yet, so `issueExecution`,
 * `commandOptionsFor` and `contextFor` refuse with the typed `EXECUTION_OWNER_UNAVAILABLE` (`NOT_DISPATCHED`): an approval is
 * recorded by Core and nothing executes; history shows the decision with `execution:'unavailable'`.
 *
 * Shared approval store. One native decision adapter (`createNativeIntentApprovals`) exists per trusted context, memoized by the
 * context object (`assembleControl` passes the same frozen context to every family). `intentsComposition(context)` returns it:
 *  - `approvalStore` `{getCurrent}`: the approval guard input for any per-run command executor (task-update services, a future
 *    intent executor), so the executor rechecks the SAME Core decision the decide route recorded;
 *  - `readDecision(value)`: for the lifecycle's `approvals.readDecision` (see `lifecycle.mjs`);
 *  - `state`: `disabled` | `unavailable` | `composed` for the decide/list surface. Consumers that would claim readiness must
 *    require `state === 'composed'`; the adapter itself is inert and is built whenever `native.call` exists. */
import {types} from 'node:util';
import {own} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {composeIntentApprovals} from '../../control/intents/compose.mjs';
import {createNativeIntentApprovals} from '../../control/intents/native-approvals.mjs';
import {createPostgresCommandJournal} from '../../control/commands/postgres-command-journal.mjs';
import {ProductError} from '../../control/product-access/errors.mjs';
const fault=code=>Object.assign(new Error(code),{code});
/** Bound for one Core decision receipt (the sessions owner uses the same fact bound). */
export const INTENT_FACT_BYTES=131072;
const CONTEXT_KEYS=['configuration','pool','client','native','now','canonicalProductPorts'];
const integer=(n,min,max)=>Number.isSafeInteger(n)&&n>=min&&n<=max;
/** Closed `intents` control configuration. Absent ⇒ `{enabled:false}`; present ⇒ exactly `{enabled:boolean}`. */
export function compileIntentsConfiguration(configuration){
 if(configuration===null||typeof configuration!=='object'||types.isProxy(configuration))throw fault('INTENTS_CONFIGURATION');
 const d=Object.getOwnPropertyDescriptor(configuration,'intents');
 if(d===undefined)return Object.freeze({enabled:false});
 if(!Object.hasOwn(d,'value'))throw fault('INTENTS_CONFIGURATION');
 let value;try{value=own(d.value,['enabled']);}catch{throw fault('INTENTS_CONFIGURATION');}
 if(typeof value.enabled!=='boolean')throw fault('INTENTS_CONFIGURATION');
 return Object.freeze({enabled:value.enabled});
}
/** Route bounds derived from the validated control limits; never wider than the product HTTP owner's own ceilings. */
function intentLimits(configuration){
 const l=configuration.limits,n=configuration.native;
 if(!integer(l?.requestMs,1,30000)||!integer(l?.requestBytes,1,16777216)||!integer(n?.maxResponseBytes,1,16777216))throw fault('INTENTS_CONFIGURATION');
 return Object.freeze({maxRequestMs:Math.min(l.requestMs,30000),maxRequestBytes:Math.min(l.requestBytes,1048576),maxResponseBytes:n.maxResponseBytes,maxFactBytes:INTENT_FACT_BYTES});
}
/** Typed refusal for every execution-owner port until Core's conversation-intent execution broker exists. */
export const executionOwnerUnavailable=()=>Object.assign(new ProductError('EXECUTION_OWNER_UNAVAILABLE','NOT_DISPATCHED'),{code:'EXECUTION_OWNER_UNAVAILABLE'});
const unavailableExecution=Object.freeze({
 async contextFor(){throw executionOwnerUnavailable();},
 async commandOptionsFor(){throw executionOwnerUnavailable();},
 async issueExecution(){throw executionOwnerUnavailable();},
});
const ownedValue=(value,name)=>{const d=value!==null&&typeof value==='object'?Object.getOwnPropertyDescriptor(value,name):undefined;return d&&Object.hasOwn(d,'value')?d.value:undefined;};
const compositions=new WeakMap();
function compose(context){
 let c;try{c=own(context,CONTEXT_KEYS,['artifactRecovery']);}catch{throw fault('PRODUCT_PORTS_CONFIGURATION');}
 const intents=compileIntentsConfiguration(c.configuration);
 // The trusted native client: the fenced startup client carries `call` as an own method; a prototype method is accepted too.
 const call=c.native!==null&&typeof c.native==='object'&&!types.isProxy(c.native)&&typeof c.native.call==='function'?c.native.call:undefined,now=c.now;
 if(typeof now!=='function')throw fault('PRODUCT_PORTS_CONFIGURATION');
 // The one decision adapter for this control process. Inert: it holds the native call and calls it only when a port is used.
 const decisions=typeof call==='function'?createNativeIntentApprovals({call:(operation,input,options)=>call.call(c.native,operation,input,options),now,maxFactBytes:INTENT_FACT_BYTES}):null;
 const shared={decisions,
  approvalStore:decisions?Object.freeze({getCurrent:value=>decisions.getCurrent(value)}):null,
  readDecision:decisions?value=>decisions.readDecision(value):null};
 if(!intents.enabled)return Object.freeze({...shared,state:'disabled',reason:'INTENTS_DISABLED',application:null,owner:null});
 const limits=intentLimits(c.configuration),gate=ownedValue(c.canonicalProductPorts,'conversationMembership');
 if(!decisions)return Object.freeze({...shared,state:'unavailable',reason:'NATIVE_UNAVAILABLE',application:null,owner:null});
 if(!gate)return Object.freeze({...shared,state:'unavailable',reason:'MEMBERSHIP_GATE_UNAVAILABLE',application:null,owner:null});
 if(!c.pool||typeof c.pool!=='object'||types.isProxy(c.pool)||typeof c.pool.connect!=='function')throw fault('PRODUCT_PORTS_CONFIGURATION');
 const composed=composeIntentApprovals({pool:c.pool,native:c.native,decisions,commandJournal:createPostgresCommandJournal({pool:c.pool}),
  contextFor:unavailableExecution.contextFor,commandOptionsFor:unavailableExecution.commandOptionsFor,issueExecution:unavailableExecution.issueExecution,
  gate,now,limits,enabled:true});
 return Object.freeze({...shared,state:'composed',reason:null,application:composed.app,owner:composed.owner});
}
/** The memoized per-context intents composition (shared approval store, decision reader and, when enabled, the application). */
export function intentsComposition(context){
 if(context===null||typeof context!=='object'||types.isProxy(context))throw fault('PRODUCT_PORTS_CONFIGURATION');
 let value=compositions.get(context);if(value===undefined){value=compose(context);compositions.set(context,value);}return value;
}
/** Family factory for `PRODUCT_FAMILIES`: `['intents', createIntentsFamily]`. `shared` is ignored by the composer. */
export function createIntentsFamily(context){
 const shared=intentsComposition(context);
 return {ports:shared.application?{intentApplication:shared.application}:{},shared};
}
