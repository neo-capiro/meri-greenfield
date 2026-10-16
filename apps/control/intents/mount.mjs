/** The control intent port for the worker's `meri_intents` server (`apps/worker/conversation/intents/runtime.mjs`):
 * `{readAvailability, prepare}` over the preparers the trusted composition built for this run. It adds no
 * authorization of its own: each preparer's canonical owner checks current authority, and execution stays with the
 * existing approval routes. It owns only delivery replay (`journal.mjs`) and the shape of what crosses to the worker.
 *
 * - `readAvailability({signal})` → `{binding, operations, checkedAtMs, expiresAtMs}` (LOCAL PROPOSAL P-INT-2): the
 *   operations a composed owner can prepare. It is not authority; it only decides which tools are listed.
 * - `prepare({operation, arguments, deliveryId, signal})` → the owner's prepare-only result, or a closed failure
 *   `{code}` where UNKNOWN means a preparation may exist and the delivery will never be prepared again.
 *
 * Construction is inert: no pool, listener, owner call or timer. `enabled` defaults to false. */
import {canonicalSha256,validateShape} from '../../../packages/contracts/validate.mjs';
import {data,own,nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {createIntentJournal} from './journal.mjs';
import {intentFault} from './faults.mjs';
import {COMMAND_INTENT_OPERATIONS} from './command-preparer.mjs';
import {SCHEDULE_INTENT_OPERATIONS} from './schedule-preparer.mjs';
import {DOCUMENT_INTENT_OPERATIONS} from './document-preparer.mjs';
const DELIVERY=/^sdk:[a-f0-9]{64}$/u,AVAILABILITY_MS=30000;
const OWNERS=Object.freeze({command:Object.keys(COMMAND_INTENT_OPERATIONS),schedule:SCHEDULE_INTENT_OPERATIONS,document:DOCUMENT_INTENT_OPERATIONS});
const CODES=new Set(['UNAVAILABLE','ACCESS_DENIED','REFUSED','INVALID_ARGUMENTS','DEADLINE','CANCELLED','CONFLICT','UNKNOWN']);
const closed=code=>CODES.has(code)?code:'UNKNOWN';
/** @param {{binding:object,preparers:readonly object[],journalStore:object,now:()=>number,limits:{maxRequestMs:number},enabled?:boolean}} configuration */
export function createIntentMount(configuration){
 const c=own(configuration,['binding','preparers','journalStore','now','limits'],['enabled']),binding=data(c.binding),limits=data(c.limits);
 validateShape('RunBinding',binding);own(limits,['maxRequestMs']);
 if(typeof c.now!=='function'||typeof(c.enabled??false)!=='boolean'||!Number.isSafeInteger(limits.maxRequestMs)||limits.maxRequestMs<1||limits.maxRequestMs>60000||!Array.isArray(c.preparers))throw intentFault('INTENT_CONFIGURATION');
 const journal=createIntentJournal(c.journalStore),byOperation=new Map();
 for(const p of c.preparers){
  // Only owner kinds with a canonical prepare-only path, for this run's exact binding, one preparer per operation.
  if(!OWNERS[p?.owner]?.includes(p.operation?.id)||p.operation.version!=='0.2.0'||typeof p.prepare!=='function'||canonicalSha256(p.binding)!==canonicalSha256(binding)||byOperation.has(p.operation.id))throw intentFault('INTENT_CONFIGURATION');
  byOperation.set(p.operation.id,p);
 }
 const operations=Object.freeze([...byOperation.values()].map(p=>p.operation));
 const lifetime=signal=>createOperationLifetime({deadlineMs:c.now()+limits.maxRequestMs,now:c.now,signal,errorFactory:code=>intentFault(code)});
 return Object.freeze({
  async readAvailability(value={}){
   const {signal}=own(value,[],['signal']);nativeSignal(signal);if(signal?.aborted)throw intentFault('CANCELLED');
   const at=c.now();if(c.enabled!==true)throw intentFault('UNAVAILABLE');
   return data({binding,operations,checkedAtMs:at,expiresAtMs:at+AVAILABILITY_MS});
  },
  async prepare(value){
   const {signal,...raw}=own(value,['operation','arguments','deliveryId'],['signal']);nativeSignal(signal);
   if(c.enabled!==true)throw intentFault('UNAVAILABLE');
   let v;try{v=data(raw);own(v.operation,['id','version']);}catch{throw intentFault('INVALID_ARGUMENTS');}
   const preparer=byOperation.get(v.operation.id);
   if(!preparer||v.operation.version!=='0.2.0')throw intentFault('UNAVAILABLE');
   if(typeof v.deliveryId!=='string'||!DELIVERY.test(v.deliveryId)||v.arguments===null||typeof v.arguments!=='object'||Array.isArray(v.arguments))throw intentFault('INVALID_ARGUMENTS');
   const record=data({operation:preparer.operation,argumentsSha256:canonicalSha256(v.arguments)}),life=lifetime(signal),key={binding,deliveryId:v.deliveryId,record};
   try{
    const begun=await life.run(s=>journal.begin({...key,signal:s}));
    if(begun.replayed)return begun.result;
    let result;
    try{result=data(await life.run(s=>preparer.prepare({arguments:v.arguments,deliveryId:v.deliveryId,signal:s})));}
    catch(error){
     // A failure with no owner effect settles FAILED and replays the same refusal; anything else stays UNKNOWN.
     const none=error?.effect==='none',code=none?closed(error.code):'UNKNOWN';
     try{await life.run(s=>journal.settle({...key,state:none?'FAILED':'UNKNOWN',outcome:none?{code}:null,signal:s}));}catch{}
     throw intentFault(code);
    }
    // A lost settlement acknowledgement leaves the delivery PENDING: the result is withheld as UNKNOWN, never retried.
    // Once settled, the result is released even if the deadline passes now: it is durably the answer for this delivery.
    try{await life.run(s=>journal.settle({...key,state:'PREPARED',outcome:{result},signal:s}));}catch{throw intentFault('UNKNOWN');}
    return result;
   }catch(error){throw intentFault(closed(error?.code));}finally{life.close();}
  },
 });
}
