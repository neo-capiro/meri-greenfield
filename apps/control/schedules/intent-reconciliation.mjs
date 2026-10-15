/** Exact provider reconciliation of a schedule intent left DISPATCHING or UNKNOWN by a dropped acknowledgement. It reads the stored
 * intent, observes the provider state of the intent's own Temporal schedule ID (and, for request_cancel, its own listed workflow
 * runs) and acknowledges only when that exact effect is present: for create/update, the complete provider-normalized schedule
 * (schedule-effect.mjs: spec, action with its argument/timeouts/retry, policies and state) equals the approved one; a pause
 * carries this intent's note; a delete is the SDK's typed not-found. A create/update whose approved effect describe cannot
 * return faithfully stays UNRESOLVED (SCHEDULE_INTENT_EFFECT_NOT_COMPARABLE). Nothing is re-sent, retried or replaced.
 * Absent or unreadable evidence leaves the durable barrier in place (UNRESOLVED). Recording a proven never-applied intent needs a
 * terminal state the reviewed schema lacks (proposal P-L6-1); until then it, too, stays UNRESOLVED and keeps blocking edits.
 * A trusted reconciliation entry point: it records evidence of an already-approved effect and adds no new authority or effect. */
import {types} from 'node:util';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {assertScheduleIntent,canonicalSha256,frozenScheduleData,denySchedule,scheduleErrorCode} from '../../../packages/contracts/schedules-0.2/lifecycle-validation.mjs';
import {sdkMethod,exactHandle} from './temporal-schedule-mutations.mjs';
import {approvedScheduleEffect,describedScheduleEffect} from './schedule-effect.mjs';

const OPTIONS=['scheduleClient','workflowClient','scheduleOwner','scheduleNotFoundError','clock','maxRequestMs'];
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;
function optionsData(value,allowed,required) {
 if(!value||typeof value!=='object'||types.isProxy(value)||Object.getPrototypeOf(value)!==Object.prototype)denySchedule('SCHEDULE_RECONCILE_OPTIONS');
 const out={};for(const key of Reflect.ownKeys(value)){const d=Object.getOwnPropertyDescriptor(value,key);if(!allowed.includes(key)||!d.enumerable||!Object.hasOwn(d,'value'))denySchedule('SCHEDULE_RECONCILE_OPTIONS');out[key]=d.value;}
 if(required.some(k=>!Object.hasOwn(out,k)))denySchedule('SCHEDULE_RECONCILE_OPTIONS');return out;
}
// Read selected SDK data fields only; never execute getters or touch memo/raw.
function field(value,name,optional=false) {
 if(!value||typeof value!=='object'||types.isProxy(value))denySchedule('SCHEDULE_RECONCILE_EVIDENCE');
 const d=Object.getOwnPropertyDescriptor(value,name);
 if(!d){if(optional)return undefined;denySchedule('SCHEDULE_RECONCILE_EVIDENCE');}
 if(!Object.hasOwn(d,'value'))denySchedule('SCHEDULE_RECONCILE_EVIDENCE');return d.value;
}

export function createScheduleIntentReconciler(options) {
 const o=optionsData(options,OPTIONS,OPTIONS.slice(0,4)),clock=o.clock??Date.now,maxRequestMs=o.maxRequestMs??10000,NotFound=o.scheduleNotFoundError;
 const readIntent=sdkMethod(o.scheduleOwner,'readIntent'),acknowledge=sdkMethod(o.scheduleOwner,'acknowledgeReconciled');
 if(typeof NotFound!=='function'||typeof clock!=='function'||!Number.isSafeInteger(maxRequestMs)||maxRequestMs<1||maxRequestMs>60000)denySchedule('SCHEDULE_RECONCILE_OPTIONS');
 const scheduleConnection=o.scheduleClient.connection,workflowConnection=o.workflowClient.connection;

 async function reconcile(request) {
  const {tenantId,intentId,signal}=optionsData(request,['tenantId','intentId','signal'],['tenantId','intentId']);
  if(typeof tenantId!=='string'||!tenantId||tenantId.length>128||typeof intentId!=='string'||!uuid.test(intentId))denySchedule('SCHEDULE_RECONCILE_OPTIONS');
  if(signal!==undefined&&(types.isProxy(signal)||!(signal instanceof AbortSignal)))denySchedule('SCHEDULE_RECONCILE_OPTIONS');
  const deadline=clock()+maxRequestMs,life=createOperationLifetime({deadlineMs:deadline,now:clock,signal,errorFactory:code=>Object.assign(Error(code),{code})});
  const rpc=(connection,action)=>life.run(rpcSignal=>sdkMethod(connection,'withDeadline')(deadline,()=>{life.check();return sdkMethod(connection,'withAbortSignal')(rpcSignal,()=>{life.check();return action();});}));
  const describeSchedule=id=>rpc(scheduleConnection,()=>{const h=exactHandle(o.scheduleClient,id,life),describe=sdkMethod(h,'describe');life.check();return describe();});
  async function scheduleStatePresent(i,approved) {
   const id=i.projection.temporalScheduleId;
   if(i.operation==='cancel_scheduled_task') {
    const c=i.cancel;
    if(c.mode==='delete') {
     try{await describeSchedule(id);return false;}catch(error){if(!(error instanceof NotFound))throw error;}
    } else {
     const d=await describeSchedule(id),state=field(d,'state');
     if(field(d,'scheduleId')!==id||field(state,'paused')!==true||field(state,'note',true)!==c.note)return false;
    }
    // request_cancel cannot read back a cancel request; a listed run that is no longer RUNNING has the requested effect.
    if(c.running==='request_cancel')for(const run of c.runs) {
     const d=await rpc(workflowConnection,()=>{const h=sdkMethod(o.workflowClient,'getHandle')(run.workflowId,run.runId);life.check();return sdkMethod(h,'describe')();});
     if(field(d,'workflowId')!==run.workflowId||field(d,'runId')!==run.runId||field(field(d,'status'),'name')==='RUNNING')return false;
    }
    return true;
   }
   let d;try{d=await describeSchedule(id);}catch(error){if(error instanceof NotFound)return false;throw error;}
   return canonicalSha256(describedScheduleEffect(d))===canonicalSha256(approved);
  }
  // The complete approved create/update effect, derived before any provider read; null for a cancel.
  function approvedEffect(i) {
   if(i.operation==='cancel_scheduled_task')return null;
   try{return approvedScheduleEffect(i);}catch(error){if(scheduleErrorCode(error)==='SCHEDULE_EFFECT_NOT_COMPARABLE')return undefined;throw error;}
  }
  const outcome=(i,value,code,reconciled)=>frozenScheduleData({intentId,operation:i.operation,generation:i.generation,outcome:value,code,reconciled});
  try {
   const row=await life.run(()=>readIntent({tenantId,intentId},life.check));
   if(row===null)denySchedule('SCHEDULE_INTENT_ABSENT');
   const i=assertScheduleIntent(row.intent,tenantId);
   if(i.intentId!==intentId||canonicalSha256(i)!==row.intentSha256)denySchedule('SCHEDULE_CORRUPT');
   if(row.state==='ACKNOWLEDGED')return outcome(i,'ACKNOWLEDGED',null,false);
   // CLAIMED never reached DISPATCHING, so no provider effect was attempted; that proof cannot be recorded yet (P-L6-1).
   if(row.state==='CLAIMED')return outcome(i,'UNRESOLVED','SCHEDULE_INTENT_NEVER_DISPATCHED',false);
   const approved=approvedEffect(i);
   if(approved===undefined)return outcome(i,'UNRESOLVED','SCHEDULE_INTENT_EFFECT_NOT_COMPARABLE',false);
   if(!await scheduleStatePresent(i,approved))return outcome(i,'UNRESOLVED','SCHEDULE_INTENT_EFFECT_NOT_OBSERVED',false);
   const receipt=frozenScheduleData(await life.run(()=>acknowledge({tenantId,intentId,intentSha256:row.intentSha256},life.check)));
   if(receipt.intentId!==intentId||receipt.state!=='ACKNOWLEDGED')denySchedule('SCHEDULE_OWNER_RECEIPT');
   return outcome(i,'ACKNOWLEDGED',null,true);
  } catch(error) {
   const code=['DEADLINE','CANCELLED'].includes(scheduleErrorCode(error))?scheduleErrorCode(error):'SCHEDULE_RECONCILE_FAILED';
   throw Object.assign(new Error(code),{code,outcome:'UNRESOLVED',intentId});
  } finally {life.close();}
 }
 return Object.freeze({reconcile});
}
