/** Native routine composition over existing schedule custody, lineage, firing consent and Core current reads.
 * No new credential, allocation or authority ledger is created here. */
import {data,nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash,validateShape} from '../../../packages/contracts/validate.mjs';
import {assertNativeConversationScope} from '../../../packages/contracts/runtime-0.2/session.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {createScheduledRunProfile} from './scheduled-run-profile.mjs';
import {occurrenceIdentity} from '../../control/schedules/scheduled-occurrence.mjs';
import {setTimeout as pause} from 'node:timers/promises';
import {accountSdkSnapshot} from '../../control/conversations/usage.mjs';

const same=(a,b)=>hash(a)===hash(b),fault=()=>Object.assign(Error('ROUTINE_CURRENT_UNAVAILABLE'),{code:'ROUTINE_CURRENT_UNAVAILABLE'});
export function createNativeRoutineCurrent({configuration,task,store,scheduleOwner,firing,wires,now=Date.now}){
 if(typeof scheduleOwner?.readOccurrenceForConversation!=='function'||typeof wires?.current!=='function'||typeof firing?.authorize!=='function')throw fault();
 async function select({binding,signal,deadlineMs=now()+configuration.limits.requestMs},body,{transition=false}={}){
  validateShape('RunBinding',binding);nativeSignal(signal);
  const life=createOperationLifetime({now,signal,deadlineMs:Math.min(deadlineMs,now()+configuration.limits.requestMs),errorFactory:fault});
  try{
   const origin=await life.run(()=>scheduleOwner.readOccurrenceForConversation({tenantId:binding.tenantId,conversationId:binding.conversationId},life.check));
   if(origin===null){if(await life.run(()=>scheduleOwner.readOccurrenceForConversation({tenantId:binding.tenantId,conversationId:binding.conversationId},life.check))!==null)throw fault();return null;}
   const {run}=await life.run(()=>store.read(binding,{after:0,limit:1},life.check));
   const selectedClientId=run.scopes.length===1&&run.scopes[0].kind==='client'?run.scopes[0].resourceId:null;
   assertNativeConversationScope({binding,scopes:run.scopes,selectedClientId});
   const modelPolicy=await life.run(()=>store.readModelPolicy(binding,life.check));
   const profile=createScheduledRunProfile({scheduleOwner,store,task,selectedClientId,maxCostMicroUSD:modelPolicy.maxBudgetMicroUsd,now,maxRequestMs:configuration.limits.requestMs});
   const record=await life.run(signal=>profile[transition?'readTransition':'read']({binding,scopes:run.scopes,expiresAtMs:now()+configuration.agentcore.runWindowMs,deadlineMs:life.deadline(),signal}));
   if(record===null||!same(record.binding,binding)||record.policyRevision!==configuration.agentcore.policyRevision)throw fault();
   life.limitDeadline(record.expiresAtMs);
   return await body({origin,record,run,life});
  }finally{life.close();}
 }
 async function beforeExecution(value){return select(value,async({origin,record,life})=>{
  const id=occurrenceIdentity(origin.occurrence),receipt=await life.run(signal=>firing.authorize({phase:'before_start',occurrence:id.identity,occurrenceKey:id.occurrenceKey,projection:origin.occurrence.projection,signal}));
  if(receipt.authorized!==true||receipt.occurrenceKey!==record.occurrenceKey||!same(receipt.scopes,record.scopes))throw fault();
  life.limitDeadline(receipt.expiresAtMs);life.check();return record;
 });}
 async function current(value,transition=false){return select(value,async({record,origin,life})=>{
  const current=await life.run(signal=>wires.current({binding:record.binding,scheduleId:record.scheduleId,occurrenceKey:record.occurrenceKey,deadlineMs:life.deadline(),signal}));
  const p=origin.occurrence.projection;
  if(current.generation!==record.generation||!same(current.scopes,record.scopes)||current.policyRevision!==record.policyRevision||
   ['maxCostMicrousd','maxRuntimeSeconds','retryLimit'].some(k=>current.limits[k]!==p[k])||current.effectExpiresAtMs<=now())throw fault();
  life.limitDeadline(current.effectExpiresAtMs);life.check();return {record:data({...record,expiresAtMs:Math.min(record.expiresAtMs,current.effectExpiresAtMs)}),current};
 },{transition});}
 async function admitExecution(value){
  if(value.binding.writerFence===1)return beforeExecution(value);
  const selected=await current(value,true);return selected===null?null:selected.record;
 }
 async function beforeInvocation({binding,signal,deadlineMs}){
  if(binding.writerFence===1)return;
  for(;;){
   const selected=await current({binding,signal,deadlineMs},true);if(selected===null)return;
   const {record}=selected,check=()=>{signal.throwIfAborted();if(now()>=Math.min(deadlineMs,record.expiresAtMs))throw fault();};check();
   const lineage=await store.lifecycle.execution({binding,scopes:record.scopes,selectedClientId:record.selectedClientId},check);check();
   if(!lineage||lineage.continuation.mode!=='resume')throw fault();
   const envelope=lineage.continuation,control=await store.lifecycle.get({binding:envelope.sdkSession.binding,scopes:record.scopes,selectedClientId:record.selectedClientId,controlId:envelope.controlId},check);check();
   if(control.state==='APPLIED'){await beforeExecution({binding,signal,deadlineMs});return;}
   if(control.state!=='DISPATCHING'||!same(control.target?.binding,binding))throw fault();
   // Temporal can start the successor before the start acknowledgment commits APPLIED. Keep the durable claim preparing;
   // no SDK invocation or data release occurs until the existing control journal commits that exact transition.
   await pause(Math.min(1000,deadlineMs-now(),record.expiresAtMs-now()),undefined,{signal});
  }
 }
 // Used only by the canonical worker model-policy read. The SDK keeps its normal model loop and cost enforcement.
 async function modelPolicy(binding,check){
  check();const policy=await store.readModelPolicy(binding,check);check();
  const profile=await select({binding},async({record,life})=>{
   let spent=0;
   if(binding.writerFence>1){
    const saved=await life.run(()=>store.lifecycle.execution({binding,scopes:record.scopes,selectedClientId:record.selectedClientId},life.check));
    const source=saved?.continuation;
    if(source?.kind!=='native-session'||source.mode!=='resume')throw fault();
    const usage=await life.run(()=>store.readUsage(source.sdkSession.binding,life.check));
    if(usage?.status!=='recorded'||usage.cumulative?.sessionId!==source.sdkSession.key.sessionId)throw fault();
    // The native total is cumulative across this occurrence's same-session resume chain. maxBudgetUsd itself is per query.
    const cumulative=accountSdkSnapshot(usage.cumulative,{mode:'new'});
    if(cumulative.status!=='recorded'||!Number.isSafeInteger(cumulative.chargeMicroUsd))throw fault();spent=cumulative.chargeMicroUsd;
   }
   const remaining=record.maxCostMicroUSD-spent;if(!Number.isSafeInteger(remaining)||remaining<1)throw fault();return remaining;
  });check();
  return profile===null?policy:{...policy,maxBudgetMicroUsd:Math.min(policy.maxBudgetMicroUsd,profile)};
 }
 return Object.freeze({beforeExecution,admitExecution,beforeInvocation,forBinding:value=>current(value),forTransition:value=>current(value,true),modelPolicy});
}
