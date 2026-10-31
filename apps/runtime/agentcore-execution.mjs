/** Control's invocation owner. Durable runs remain in the existing conversation journal. */
import {createHmac,randomUUID,timingSafeEqual} from 'node:crypto';
import {currentTurnTelemetry} from './telemetry/turn-context.mjs';
import {canonicalSha256 as hash,validateShape} from '../../packages/contracts/validate.mjs';
import {own} from '../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {assertExecutionIdentity,executionIdentity,createExecutionBinding,isExecutionOutcome} from '../control/conversations/execution-boundary.mjs';
import {markAuthorityUnavailable} from '../../packages/runtime/authority-availability.mjs';

const same=(a,b)=>hash(a)===hash(b);
const refuse=code=>{throw Object.assign(Error(code),{code});};
const checkSignal=signal=>()=>signal?.throwIfAborted();

export function createAgentCoreExecutionOwner({store,provider,versions,plan,credentialSecret,admit,contextFor,beforeInvocation,nativeNeed,nativeReady,
 now=Date.now,newId=randomUUID,onUnknown=()=>{}}){
 validateShape('RuntimeVersions',versions);
 if(typeof credentialSecret!=='string'||credentialSecret.length<32||typeof admit!=='function'||typeof contextFor!=='function'||beforeInvocation!==undefined&&typeof beforeInvocation!=='function'||nativeNeed!==undefined&&typeof nativeNeed!=='function'||nativeReady!==undefined&&typeof nativeReady!=='function')refuse('EXECUTION_CONFIGURATION');
 const journal=store.executions,pending=new Map(),observation=new AbortController();let closed=false;
 const credentialFor=execution=>'meri_execution_'+createHmac('sha256',credentialSecret)
  .update('meri-agentcore-execution-v1\0').update(hash(assertExecutionIdentity(execution))).digest('base64url');
 const acknowledge=record=>({binding:record.binding,executionId:record.executionId,expiresAtMs:record.expiresAtMs});
 async function existing(binding,signal){validateShape('RunBinding',binding);try{
  const saved=await journal.read(binding,checkSignal(signal));checkSignal(signal)();return saved;
 }catch(error){
  if(['STORE_UNAVAILABLE','STORE_COMMIT_UNKNOWN','STORE_RELEASE_UNKNOWN','EXECUTION_STORE_UNAVAILABLE','EXECUTION_STORE_COMMIT_UNKNOWN'].includes(error?.code))markAuthorityUnavailable(error);
  throw error;
 }}
 async function chooseSession(binding,run,signal){
  const reservation=await store.nextRuns.readTarget(binding,checkSignal(signal));checkSignal(signal)();
  if(reservation){
   const predecessor=await existing(reservation.source,signal),record=predecessor.record;
   if(record&&record.phase==='settled'&&!record.native.stopped&&
    record.binding.tenantId===binding.tenantId&&record.binding.actorId===binding.actorId&&record.binding.conversationId===binding.conversationId&&
    same(predecessor.run.scopes,run.scopes)&&same(predecessor.run.versions,versions)&&
    record.planSha256===hash({binding:record.binding,versions,plan})&&reservation.facts.execution?.recordSha256===hash(record))return record.runtimeSessionId;
  }
  return newId();
 }
 async function observeInvocation(execution,settings){
  try{
   if(beforeInvocation&&execution.binding.writerFence>1){
    await beforeInvocation({binding:execution.binding,signal:observation.signal,deadlineMs:execution.expiresAtMs});
    observation.signal.throwIfAborted();
    const admitted=await existing(execution.binding,observation.signal);
    if(admitted.record?.phase!=='launching'||!['queued','starting','running'].includes(admitted.run.state)||execution.expiresAtMs<=now())refuse('EXECUTION_ADMISSION_REFUSED');
   }
   let native=null;
   if(nativeReady)native=await nativeReady({binding:execution.binding,executionId:execution.executionId,
    signal:observation.signal,deadlineMs:execution.expiresAtMs});
   observation.signal.throwIfAborted();
   const checkFinal=finalRun=>
    finalRun.record?.executionId!==execution.executionId||finalRun.record?.phase!=='launching'||
    !['queued','starting','running'].includes(finalRun.run?.state)||hash(finalRun.record?.binding)!==hash(execution.binding)||
    hash(finalRun.run?.binding)!==hash(execution.binding)||!Number.isSafeInteger(finalRun.record?.expiresAtMs)||
    finalRun.record.expiresAtMs<=now()||execution.expiresAtMs<=now();
   if(checkFinal(await existing(execution.binding,observation.signal)))refuse('EXECUTION_ADMISSION_REFUSED');
   if(nativeReady)native=await nativeReady({binding:execution.binding,executionId:execution.executionId,
    signal:observation.signal,deadlineMs:execution.expiresAtMs});
   observation.signal.throwIfAborted();
   if(checkFinal(await existing(execution.binding,observation.signal)))refuse('EXECUTION_ADMISSION_REFUSED');
   if(native!==null&&(!['ready','none'].includes(native?.status)||
    native.status==='ready'&&(!Number.isSafeInteger(native.currentUntilMs)||native.currentUntilMs<=now()||
     !Number.isSafeInteger(native.leaseDeadlineMs)||native.leaseDeadlineMs<=now())))refuse('EXECUTION_ADMISSION_REFUSED');
   observation.signal.throwIfAborted();
   const result=await provider.invoke({execution,versions,credential:credentialFor(execution),...settings,signal:observation.signal});
   own(result,['execution','state','settled']);
   if(!same(result.execution,execution)||!isExecutionOutcome(result.state)||result.settled!==true)refuse('EXECUTION_RESPONSE_REFUSED');
   const saved=await existing(execution.binding);
   if(saved.record?.phase!=='settled'||saved.record.native.state!==result.state)refuse('EXECUTION_NOT_SETTLED');
  }catch{
   // A transport failure says nothing about the SDK process. Never dispatch a replacement or fake completion.
   try{const saved=await existing(execution.binding);
    if(saved.record&&!['settled','stopping'].includes(saved.record.phase))
     await journal.record({binding:execution.binding,executionId:execution.executionId,phase:'unknown',native:null},()=>{});
   }catch{}
   try{onUnknown('AGENTCORE_INVOCATION_UNKNOWN');}catch{}
  }finally{pending.delete(execution.executionId);}
 }
 async function nativePrerequisite({binding,executionId,signal}){
  validateShape('RunBinding',binding);
  const saved=await existing(binding,signal),record=saved.record;
  if(!record||record.executionId!==executionId)refuse('EXECUTION_NOT_FOUND');
  if(nativeNeed===undefined)return {kind:'none'};
  const need=own(await nativeNeed({binding,executionId,signal,deadlineMs:record.expiresAtMs}),['kind'],['hostMode','policySha256','uploadCount']);
  if(!['none','native-processing'].includes(need.kind))refuse('EXECUTION_NATIVE_PREREQUISITE_REFUSED');
  if(need.kind==='none')return {kind:'none'};
  if(need.hostMode!=='native-processing'||!/^[a-f0-9]{64}$/u.test(need.policySha256)||
   !Number.isSafeInteger(need.uploadCount)||need.uploadCount<1)refuse('EXECUTION_NATIVE_PREREQUISITE_REFUSED');
  return {kind:'native-processing',hostMode:'native-processing',policySha256:need.policySha256,uploadCount:need.uploadCount};
 }
 async function kickoff({binding,executionKey,signal}){
  if(closed||executionKey!==hash(binding))refuse('EXECUTION_REFUSED');
  const saved=await existing(binding,signal);
  if(saved.record)return acknowledge(saved.record); // Retries observe the one durable claim; they never invoke again.
  const admission=await admit({binding,signal}),run=admission.run;
  if(!same(run.binding,binding)||!same(run.versions,versions)||run.state!=='queued'||admission.expiresAtMs<=now())refuse('EXECUTION_ADMISSION_REFUSED');
  const settings=own(admission.settings??{},[],['sourceEnabled','approvedReads','intents']);
  const runtimeSessionId=await chooseSession(binding,run,signal);
  const {versions:ignored,...execution}=createExecutionBinding({binding,versions,plan,expiresAtMs:admission.expiresAtMs,runtimeSessionId});
  let claimed;
  try{claimed=await journal.claim(execution,checkSignal(signal));}
  catch(error){
   // Concurrent kickoff requests may propose different fresh session IDs. The durable
   // winner owns the only invocation; a losing request observes it, never replaces it.
   const winner=await existing(binding,signal);
   if(winner.record&&winner.record.planSha256===execution.planSha256&&same(winner.run.versions,versions))return acknowledge(winner.record);
   throw error;
  }
  if(claimed.dispatch){
   // Invocation lifetime belongs to the durable run. Losing the kickoff HTTP response does not cancel its SDK query.
   const running=observeInvocation(execution,settings);pending.set(execution.executionId,running);
  }
  return acknowledge(claimed.record);
 }
 async function status({binding,executionId,signal}){
  const saved=await existing(binding,signal),record=saved.record;
  if(!record||record.executionId!==executionId)refuse('EXECUTION_NOT_FOUND');
  return {...acknowledge(record),state:record.phase==='settled'?record.native.state:record.phase==='launching'?'preparing':'executing'};
 }
 async function authenticate({credential,binding,signal,allowSettled=false}){
  const saved=await existing(binding,signal),record=saved.record;
  if(!record||record.expiresAtMs<=now()||record.phase==='stopping'||record.phase==='settled'&&!allowSettled)refuse('EXECUTION_AUTHORITY_REFUSED');
  const execution=executionIdentity(record),expected=Buffer.from(credentialFor(execution)),actual=Buffer.from(typeof credential==='string'?credential:'');
  if(actual.length!==expected.length||!timingSafeEqual(actual,expected))refuse('EXECUTION_AUTHORITY_REFUSED');
  const context=await contextFor({binding,run:saved.run,signal});checkSignal(signal)();
  // Bind the validated execution, never an unverified request's owner fields.
  try{currentTurnTelemetry()?.bind(execution.binding);}catch{}
  return {execution,versions:saved.run.versions,state:saved.run.state,scopes:saved.run.scopes,
   selectedClientId:context.selectedClientId,policyRevision:saved.run.policyRevision};
 }
 async function admitted({credential,execution,versions:requestedVersions,signal}){
  assertExecutionIdentity(execution);
  const current=await authenticate({credential,binding:execution.binding,signal});
  if(!same(current.execution,execution)||!same(requestedVersions,current.versions))refuse('EXECUTION_AUTHORITY_REFUSED');
  await journal.record({binding:execution.binding,executionId:execution.executionId,phase:'started',native:null},checkSignal(signal));
  return current;
 }
 async function settle({credential,execution,state,signal}){
  assertExecutionIdentity(execution);
  const current=await authenticate({credential,binding:execution.binding,signal,allowSettled:true});
  if(!same(current.execution,execution)||!isExecutionOutcome(state)||current.state!==state)refuse('EXECUTION_SETTLEMENT_REFUSED');
  await journal.record({binding:execution.binding,executionId:execution.executionId,phase:'settled',native:{state}},checkSignal(signal));
  return {execution,state,settled:true};
 }
 return Object.freeze({kickoff,status,nativePrerequisite,authenticate,admitted,settle,
  stopExecution:input=>provider.stop(input),
  async close(){closed=true;observation.abort();await Promise.allSettled(pending.values());}});
}
