/** Exact observed SDK key -> native registered owner -> existing bounded SDK adapter. */
import {canonicalSha256} from '../../packages/contracts/validate.mjs';
import {createNativeSdkSessionClient,createNativeBoundSdkSessionStore} from './native-authority/session-client.mjs';
import {fault} from './config.mjs';
import {own,data,nativeSignal} from '../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {storageMethod} from '../artifacts/storage/boundary.mjs';
import {createOperationLifetime} from '../../packages/runtime/operation-lifetime.mjs';
import {createFirstRuntimeSdkSession} from './sdk-first-session.mjs';
import {createContinuationRuntimeSdkSession} from './sdk-continuation-session.mjs';
export function createRuntimeSdkSessionFactory(configuration){
 const {origin,credential,binding,fetchImpl=fetch,now=Date.now}=own(configuration,['origin','credential','binding'],['fetchImpl','now']);
 const pinnedBinding=data(binding),client=createNativeSdkSessionClient({origin,credential,binding:pinnedBinding,fetchImpl,now});
 return async value=>{
  const {binding:currentBinding,sessionKey,signal,runtimeSignal,continuation,nextTurn}=own(value,['binding'],['sessionKey','signal','runtimeSignal','continuation','nextTurn']);
  if(continuation!==undefined&&nextTurn!==undefined)throw fault('RUNNER_SDK_RESTORE_REFUSED');
  if(canonicalSha256(data(currentBinding))!==canonicalSha256(pinnedBinding)||sessionKey===undefined)throw fault('RUNNER_SDK_REGISTRATION_UNAVAILABLE');
  if(sessionKey===null){nativeSignal(signal);nativeSignal(runtimeSignal);if(continuation!==undefined||nextTurn!==undefined||signal?.aborted||runtimeSignal?.aborted)throw fault('RUNNER_SDK_REGISTRATION_UNAVAILABLE');return createFirstRuntimeSdkSession({client,binding:pinnedBinding,signal:runtimeSignal});}
  if(continuation!==undefined||nextTurn!==undefined)return createContinuationRuntimeSdkSession({client,binding:pinnedBinding,sessionKey,...(nextTurn===undefined?{continuation}:{nextTurn}),signal,runtimeSignal});
  const bound=createNativeBoundSdkSessionStore({client,binding:pinnedBinding,sessionKey});
  const settle=async()=>{const result=await bound.settleObservedCalls();if(result.uncertain)throw fault('RUNNER_SDK_SESSION_UNKNOWN');};
  const close=async()=>{bound.closeMirror();await settle();};
  try{await bound.register({signal});return Object.freeze({store:bound.store,settle,close});}
  catch(error){bound.closeMirror();await bound.settleObservedCalls();throw error;}
 };
}

/** Own only mirrors returned by this runner's compiled factory, including late results. */
export function createOwnedRuntimeSdkSession(configuration){
 const {factory,now=Date.now,cleanupMs=1000}=own(configuration,['factory'],['now','cleanupMs']);
 if(typeof factory!=='function'||typeof now!=='function'||!Number.isSafeInteger(cleanupMs)||cleanupMs<1||cleanupMs>30000)throw fault('RUNNER_SESSION_CONFIGURATION');
 const records=new WeakMap(),failures=[];let closed=false,current,pending=0;
 function capture(value){let r=records.get(value);if(r)return r;const v=own(value,['store','settle','close']);r={store:v.store,settle:storageMethod(value,'settle'),close:storageMethod(value,'close'),retirement:null};records.set(value,r);return r;}
 async function bounded(method,signal){const deadlineMs=now()+cleanupMs,life=createOperationLifetime({now,deadlineMs,signal,errorFactory:()=>fault('RUNNER_CLEANUP_UNKNOWN')});try{return await life.run(signal=>method({signal,deadlineMs}));}finally{life.close();}}
 function retire(record){return record.retirement??=(async()=>{try{await bounded(record.close);}catch(error){failures.push('RUNNER_CLEANUP_UNKNOWN');throw error;}})();}
 return Object.freeze({async prepare(value){const input=own(value,['binding','sessionKey'],['signal','runtimeSignal','continuation','nextTurn']);nativeSignal(input.signal);nativeSignal(input.runtimeSignal);if(input.nextTurn!==undefined&&input.continuation!==undefined||closed||current||pending>0)throw fault('RUNNER_SESSION_CONFIGURATION');let abandoned=false;
  const abort=()=>{abandoned=true;};input.signal?.addEventListener('abort',abort,{once:true});pending++;
  const work=Promise.resolve().then(()=>{if(closed||input.signal?.aborted)throw fault('RUNNER_SESSION_STOPPED');return factory(input);});
  work.then(value=>{if(abandoned||closed)try{void retire(capture(value)).catch(()=>{});}catch{failures.push('RUNNER_CLEANUP_UNKNOWN');}},()=>{});
  try{const record=capture(await work);if(abandoned||closed||input.signal?.aborted){void retire(record).catch(()=>{});throw fault('RUNNER_SESSION_STOPPED');}current=record;return record.store;}
  finally{pending--;input.signal?.removeEventListener('abort',abort);}
 },async settle(signal){if(current)await bounded(current.settle,signal);},async close(){closed=true;if(current)await retire(current);},cleanupStatus(){return {pendingInitializations:pending,closed,failures:[...failures],physicalStopProven:false};}});
}
