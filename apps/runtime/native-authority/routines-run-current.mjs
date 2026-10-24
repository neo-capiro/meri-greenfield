/** Native routine composition over existing schedule custody, lineage, firing consent and Core current reads.
 * No new credential, allocation or authority ledger is created here. */
import {data,nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash,validateShape} from '../../../packages/contracts/validate.mjs';
import {assertNativeConversationScope} from '../../../packages/contracts/runtime-0.2/session.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {createScheduledRunProfile} from './scheduled-run-profile.mjs';
import {occurrenceIdentity} from '../../control/schedules/scheduled-occurrence.mjs';

const same=(a,b)=>hash(a)===hash(b),fault=()=>Object.assign(Error('ROUTINE_CURRENT_UNAVAILABLE'),{code:'ROUTINE_CURRENT_UNAVAILABLE'});
export function createNativeRoutineCurrent({configuration,task,store,scheduleOwner,firing,wires,now=Date.now}){
 if(typeof scheduleOwner?.readOccurrenceForConversation!=='function'||typeof wires?.current!=='function'||typeof firing?.authorize!=='function')throw fault();
 async function select({binding,signal,deadlineMs=now()+configuration.limits.requestMs},body){
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
   const record=await life.run(signal=>profile.read({binding,scopes:run.scopes,expiresAtMs:now()+configuration.agentcore.runWindowMs,deadlineMs:life.deadline(),signal}));
   if(record===null||!same(record.binding,binding)||record.policyRevision!==configuration.agentcore.policyRevision||!same(origin.effect.binding,binding))throw fault();
   life.limitDeadline(record.expiresAtMs);
   return await body({origin,record,run,life});
  }finally{life.close();}
 }
 async function beforeExecution(value){return select(value,async({origin,record,life})=>{
  const id=occurrenceIdentity(origin.occurrence),receipt=await life.run(signal=>firing.authorize({phase:'before_start',occurrence:id.identity,occurrenceKey:id.occurrenceKey,projection:origin.occurrence.projection,signal}));
  if(receipt.authorized!==true||receipt.occurrenceKey!==record.occurrenceKey||!same(receipt.scopes,record.scopes))throw fault();
  life.limitDeadline(receipt.expiresAtMs);life.check();return record;
 });}
 async function forBinding(value){return select(value,async({record,origin,life})=>{
  const current=await life.run(signal=>wires.current({binding:record.binding,scheduleId:record.scheduleId,occurrenceKey:record.occurrenceKey,deadlineMs:life.deadline(),signal}));
  const p=origin.occurrence.projection;
  if(current.generation!==record.generation||!same(current.scopes,record.scopes)||current.policyRevision!==record.policyRevision||
   ['maxCostMicrousd','maxRuntimeSeconds','retryLimit'].some(k=>current.limits[k]!==p[k])||current.effectExpiresAtMs<=now())throw fault();
  life.limitDeadline(current.effectExpiresAtMs);life.check();return {record:data({...record,expiresAtMs:Math.min(record.expiresAtMs,current.effectExpiresAtMs)}),current};
 });}
 // Used only by the canonical worker model-policy read. The SDK keeps its normal model loop and cost enforcement.
 async function modelPolicy(binding,check){
  check();const policy=await store.readModelPolicy(binding,check);check();
  const profile=await select({binding},async({record})=>record);check();
  return profile===null?policy:{...policy,maxBudgetMicroUsd:Math.min(policy.maxBudgetMicroUsd,profile.maxCostMicroUSD)};
 }
 return Object.freeze({beforeExecution,forBinding,modelPolicy});
}
