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
  const key=hash({binding,clientId:call.selectedClientId,sessionFence:call.sessionFence,credential:hash(call.credential)});
  const life=createOperationLifetime({now,deadlineMs:Math.min(call.deadlineMs,now()+3000),signal:call.signal,errorFactory:code=>code==='DEADLINE'?unavailable():Object.assign(Error('APPLICATION_AUTHORITY_REFUSED'),{status:403})});
  try{
   life.check();const prior=entries.get(key),age=prior===undefined?Infinity:clock()-prior.sendStart;
   if(call.fresh!==true&&!pending.has(key)&&prior&&age>=0&&age<CURRENT_REUSE_MS&&prior.receipt.expiresAtMs>now()&&
    (!call.expect||Object.entries(call.expect).every(([k,v])=>prior.receipt[k]===v))){count('reuse');return prior.receipt;}
   const expected=call.expect??(prior?currentRevisions(prior.receipt):undefined);
   // No reader may cover a fresh request's failure with the previous positive answer.
   if(!pending.has(key)&&pending.size>=1000)throw unavailable();
   entries.delete(key);const generation=++sequence;pending.set(key,generation);
   const sendStart=clock(),wallSend=now();count('fresh');
   try{
    const receipt=currentReceipt(await life.run(signal=>readCurrent({credential:call.credential,...selectors,...(expected?{expect:expected}:{}),deadlineMs:Math.min(call.deadlineMs,now()+3000),signal})));
    life.check();const age=clock()-sendStart;
    if(age>=3000)throw unavailable();
    if(pending.get(key)!==generation)throw unavailable();
    if(receipt.principal.tenantId!==binding.tenantId||receipt.principal.actorId!==binding.actorId||receipt.conversationId!==binding.conversationId||receipt.selectedClientId!==call.selectedClientId||receipt.checkedAtMs<wallSend||receipt.checkedAtMs>now()||receipt.expiresAtMs<=now()||age<0||age>=CURRENT_REUSE_MS||expected&&Object.entries(expected).some(([k,v])=>receipt[k]!==v))refuse();
    if(entries.size>=1000)entries.delete(entries.keys().next().value);
    entries.set(key,{receipt,sendStart});return receipt;
   }catch(error){if(pending.get(key)===generation)entries.delete(key);throw error;}
   finally{if(pending.get(key)===generation)pending.delete(key);}
  }finally{life.close();}
 }
 return Object.freeze({read,status:()=>Object.freeze({freshCalls,reuses,entries:entries.size})});
}
