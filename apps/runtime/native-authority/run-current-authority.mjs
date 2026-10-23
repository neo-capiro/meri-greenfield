/** O208: process-private positive Core receipts for one fenced run/session. No timer, persistence or stale fallback. */
import {performance} from 'node:perf_hooks';
import {types} from 'node:util';
import {canonicalSha256 as hash,validateShape} from '../../../packages/contracts/validate.mjs';
import {own,data,nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {markAuthorityUnavailable} from '../../../packages/runtime/authority-availability.mjs';
import {currentReceipt,currentRequest,currentRevisions} from '../../control/action-host/application-adapters/current-receipt.mjs';
import {currentTurnTelemetry} from '../telemetry/turn-context.mjs';
const refuse=()=>{throw Object.assign(Error('APPLICATION_AUTHORITY_REFUSED'),{status:403});};
const unavailable=()=>markAuthorityUnavailable(Object.assign(Error('APPLICATION_AUTHORITY_UNAVAILABLE'),{status:503}));
export const CURRENT_REUSE_MS=20000;
/** Longest wait for one Core /current answer. Live Core does a Clerk read plus a RepeatableRead transaction; 3 s discarded slow 2xx answers. */
export const CURRENT_MAX_WAIT_MS=8000;
export function createRunCurrentAuthority(configuration){
 const {client,now=Date.now,monotonic=()=>performance.now(),record=kind=>currentTurnTelemetry()?.recordAuthority?.(kind)}=own(configuration,['client'],['now','monotonic','record']);
 if(!client||typeof client!=='object'||types.isProxy(client))refuse();const reader=Object.getOwnPropertyDescriptor(client,'readCurrent');
 if(!reader||!Object.hasOwn(reader,'value')||[reader.value,now,monotonic,record].some(fn=>typeof fn!=='function'||types.isProxy(fn)))refuse();
 const readCurrent=call=>Reflect.apply(reader.value,client,[call]);
 const entries=new Map(),pending=new Map();let sequence=0,freshCalls=0,reuses=0;
 const count=kind=>{if(kind==='fresh')freshCalls++;else reuses++;try{record(kind);}catch{}};
 const clock=()=>{const at=monotonic();if(typeof at!=='number'||!Number.isFinite(at)||at<0)refuse();return at;};
 async function read(raw){
  const call=own(raw,['credential','binding','selectedClientId','sessionFence','deadlineMs'],['signal','fresh','expect']);nativeSignal(call.signal);
  const binding=data(call.binding);validateShape('RunBinding',binding);
  const selectors=currentRequest({conversationId:binding.conversationId,clientId:call.selectedClientId,...(call.expect===undefined?{}:{expect:call.expect})});
  if(typeof call.credential!=='string'||!/^\S{1,8192}$/u.test(call.credential)||typeof call.sessionFence!=='string'||!call.sessionFence||call.sessionFence.length>512||call.fresh!==undefined&&typeof call.fresh!=='boolean'||!Number.isSafeInteger(call.deadlineMs))refuse();
  const key=hash({binding,clientId:call.selectedClientId,sessionFence:call.sessionFence,credential:hash(call.credential),expect:selectors.expect??null});
  const life=createOperationLifetime({now,deadlineMs:Math.min(call.deadlineMs,now()+CURRENT_MAX_WAIT_MS),signal:call.signal,errorFactory:code=>code==='DEADLINE'?unavailable():Object.assign(Error('APPLICATION_AUTHORITY_REFUSED'),{status:403,code:'CURRENT_CANCELLED'})});
  try{
   life.check();const prior=entries.get(key),age=prior===undefined?Infinity:clock()-prior.sendStart;
   if(call.fresh!==true&&!pending.has(key)&&prior&&age>=0&&age<CURRENT_REUSE_MS&&prior.receipt.expiresAtMs>now()&&
    (!selectors.expect||Object.entries(selectors.expect).every(([k,v])=>prior.receipt[k]===v))){count('reuse');return prior.receipt;}
   const expected=selectors.expect??(prior?currentRevisions(prior.receipt):undefined);
   // No reader may cover a fresh request's failure with the previous positive answer.
   if(!pending.has(key)&&pending.size>=1000)throw unavailable();
   entries.delete(key);let group=pending.get(key);
   if(!group){group={active:0,latest:0,epoch:0};pending.set(key,group);}
   const generation=++sequence,epoch=group.epoch;group.active++;group.latest=generation;
   try{
    const sendStart=clock(),wallSend=now();count('fresh');
    let receipt;
    try{
     receipt=currentReceipt(await life.run(signal=>readCurrent({credential:call.credential,...selectors,...(expected?{expect:expected}:{}),deadlineMs:Math.min(call.deadlineMs,now()+CURRENT_MAX_WAIT_MS),signal})));
     life.check();const age=clock()-sendStart;
     if(age>=CURRENT_MAX_WAIT_MS)throw unavailable();
     {const why=receipt.principal.tenantId!==binding.tenantId||receipt.principal.actorId!==binding.actorId?'RECEIPT_PRINCIPAL':receipt.conversationId!==binding.conversationId?'RECEIPT_CONVERSATION':receipt.selectedClientId!==call.selectedClientId?'RECEIPT_CLIENT':receipt.checkedAtMs<wallSend?'RECEIPT_CLOCK_BEHIND':receipt.checkedAtMs>now()?'RECEIPT_CLOCK_AHEAD':receipt.expiresAtMs<=now()?'RECEIPT_EXPIRED':age<0||age>=CURRENT_REUSE_MS?'RECEIPT_AGE':expected&&Object.entries(expected).some(([k,v])=>receipt[k]!==v)?'RECEIPT_PIN':null;if(why)throw Object.assign(Error('APPLICATION_AUTHORITY_REFUSED'),{status:403,code:why});}
    }catch(error){
     // The caller's own cancellation is not a Core observation: it must not bar concurrent fresh positives.
     if(!call.signal?.aborted)group.epoch++;entries.delete(key);throw error;}
    // Another successful fresh observation cannot refuse this caller's independently fresh admission.
    // A refusal/timeout still bars every older in-flight positive, without deleting a later fresh recovery.
    if(group.epoch!==epoch)throw unavailable();
    if(group.latest===generation){
     if(entries.size>=1000)entries.delete(entries.keys().next().value);
     entries.set(key,{receipt,sendStart});
    }
    return receipt;
   }finally{if(--group.active===0&&pending.get(key)===group)pending.delete(key);}
  }finally{life.close();}
 }
 return Object.freeze({read,status:()=>Object.freeze({freshCalls,reuses,entries:entries.size})});
}
