/** Durable one-claim launch, native reconciliation and original stop ownership. */
import {own,data,nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash,validateShape} from '../../../packages/contracts/validate.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {storageMethod} from '../../artifacts/storage/boundary.mjs';
import {capabilityDigest} from './task-verifier.mjs';
import {assertNativeExecution,createExecutionBinding} from '../../control/conversations/execution-boundary.mjs';
export {assertNativeExecution} from '../../control/conversations/execution-boundary.mjs';
export const executionFault=code=>Object.assign(Error('NATIVE_EXECUTION_'+code),{code:'NATIVE_EXECUTION_'+code});
export function createNativeExecutionBroker(configuration){
 const c=own(configuration,['binding','versions','plan','expiresAtMs','journal','tasks','verifier','taskCapability'],['enabled','now','maxRequestMs']);
 const binding=data(c.binding),versions=data(c.versions),plan=data(c.plan);validateShape('RunBinding',binding);validateShape('RuntimeVersions',versions);
 const enabled=c.enabled??false,now=c.now??Date.now,maxRequestMs=c.maxRequestMs??3000;
 if(typeof enabled!=='boolean'||typeof now!=='function'||!Number.isSafeInteger(maxRequestMs)||maxRequestMs<1||maxRequestMs>30000||!Number.isSafeInteger(c.expiresAtMs)||c.expiresAtMs<1||typeof c.taskCapability!=='string')throw executionFault('CONFIGURATION');
 const claim=storageMethod(c.journal,'claim'),read=storageMethod(c.journal,'read'),record=storageMethod(c.journal,'record'),launch=storageMethod(c.tasks,'launch'),inspect=storageMethod(c.tasks,'inspect'),retire=storageMethod(c.tasks,'retire'),verify=storageMethod(c.verifier,'verify');
 const nativeOriginal=createExecutionBinding({binding,versions,plan,expiresAtMs:c.expiresAtMs}),{versions:ignored,...original}=nativeOriginal,executionKey=original.executionKey;
 function request(value,fields){const v=own(value,['binding',...fields],['signal']);nativeSignal(v.signal);if(!enabled||hash(data(v.binding))!==executionKey)throw executionFault('REFUSED');return v;}
 async function operation(signal,body){const life=createOperationLifetime({now,signal,deadlineMs:now()+maxRequestMs,errorFactory:()=>executionFault('UNAVAILABLE')});try{return await body(life);}finally{life.close();}}
 async function fresh(life){const receipt=await life.run(signal=>verify({capability:c.taskCapability,binding,operation:'load',inputSha256:hash({binding}),signal}));
  if(hash(receipt.binding)!==executionKey||receipt.expiresAtMs<c.expiresAtMs||now()>=c.expiresAtMs)throw executionFault('ADMISSION_REFUSED');life.check();}
 async function observe(life,saved,{stop=false}={}){if(!saved.record)throw executionFault('NOT_STARTED');
  // Inspect/retire remain possible with original ownership after revocation/expiry.
  const fact=assertNativeExecution(await life.run(signal=>(stop?retire:inspect)({...nativeOriginal,...(saved.record.native?{taskId:saved.record.native.taskId}:{}),signal})),nativeOriginal);life.check();
  if(saved.record.native&&saved.record.native.taskId!==fact.taskId)throw executionFault('NATIVE_REFUSED');
  return life.run(()=>record({binding,executionId:original.executionId,phase:fact.physicalStopProven?'retired':'started',native:fact},life.check));}
 async function start(value){const input=request(value,['executionKey']);if(input.executionKey!==executionKey)throw executionFault('REFUSED');return operation(input.signal,async life=>{
  await fresh(life);const saved=await life.run(()=>claim(original,life.check));
  if(saved.dispatch){try{await fresh(life);const fact=assertNativeExecution(await life.run(signal=>launch({...nativeOriginal,plan,signal})),nativeOriginal);
   await life.run(()=>record({binding,executionId:original.executionId,phase:fact.physicalStopProven?'retired':'started',native:fact},life.check));
  }catch(error){
   // Claim is consumed permanently. A late/uncertain launch is never dispatched again.
   try{await operation(undefined,l=>l.run(()=>record({binding,executionId:original.executionId,phase:'unknown',native:null},l.check)));}catch{}
   try{await operation(undefined,l=>observe(l,{record:saved.record},{stop:true}));}catch{}
   throw executionFault('LAUNCH_UNKNOWN');
  }}else await observe(life,saved);
  try{await fresh(life);}catch(error){try{await stop();}catch{}throw error;}return {binding,executionId:original.executionId,expiresAtMs:original.expiresAtMs};
 });}
 async function poll(value){const input=request(value,['executionId']);if(input.executionId!==original.executionId)throw executionFault('REFUSED');return operation(input.signal,async life=>{
  const saved=await life.run(()=>read(binding,life.check));let admitted=true;try{await fresh(life);}catch{admitted=false;}
  const observed=await observe(life,saved,{stop:!admitted||['completed','failed','cancelled','paused','waiting-for-approval'].includes(saved.run.state)});
  if(!admitted)throw executionFault('ADMISSION_REFUSED');const state=observed.run.state,native=observed.record.native;
  if(['completed','failed','cancelled','paused','waiting-for-approval'].includes(state)){if(!native.physicalStopProven)throw executionFault('CLEANUP_UNKNOWN');return {binding,executionId:original.executionId,state};}
  if(native.physicalStopProven)throw executionFault('PROCESS_STOPPED_WITHOUT_RUN_OUTCOME');return {binding,executionId:original.executionId,state:'executing'};
 });}
 async function current(value){const input=request(value,['executionId']);if(input.executionId!==original.executionId)throw executionFault('REFUSED');return operation(input.signal,async life=>{try{await fresh(life);const saved=await life.run(()=>read(binding,life.check));const out=await observe(life,saved);await fresh(life);if(out.record.native.physicalStopProven)throw executionFault('NOT_EXECUTING');return data({record:out.record,run:out.run});}catch(error){try{await stop();}catch{}throw error;}});}
 async function stop(){return operation(undefined,async life=>observe(life,await life.run(()=>read(binding,life.check)),{stop:true}));}
 return Object.freeze({start,poll,current,stop,original:nativeOriginal,taskCapabilitySha256:capabilityDigest(c.taskCapability)});
}
