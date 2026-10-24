/** Correlate native SDK init with the first SessionStore key before the existing registration API. */
import {createNativeBoundSdkSessionStore} from './sdk-session-client.mjs';
import {assertSdkSessionKey} from '../../packages/contracts/runtime-0.2/session.mjs';
import {own,nativeSignal} from '../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {storageMethod} from '../artifacts/storage/boundary.mjs';
import {fault} from './config.mjs';
import {copySessionEntries} from '../worker/qualification/checkpoint/bound-session-store.mjs';

export function createFirstRuntimeSdkSession(configuration){
 const {client,binding,signal,timeoutMs}=own(configuration,['client','binding'],['signal','timeoutMs']);nativeSignal(signal);
 if(timeoutMs!==undefined&&(!Number.isSafeInteger(timeoutMs)||timeoutMs<1||timeoutMs>23000))throw fault('RUNNER_SESSION_CONFIGURATION');
 const lifetime=new AbortController(),currentSignal=signal===undefined?lifetime.signal:AbortSignal.any([signal,lifetime.signal]);
 const methods=Object.freeze(Object.fromEntries(['register','load','append','listSubkeys'].map(name=>[name,storageMethod(client,name)])));
 let bound,registration,closed=false,failed=false,sessionId;const initialized=Promise.withResolvers();initialized.promise.catch(()=>{});
 function observeInit(frame){
  if(closed||failed||frame?.type!=='system'||frame.subtype!=='init'||typeof frame.session_id!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/iu.test(frame.session_id)||sessionId!==undefined&&sessionId!==frame.session_id){failed=true;initialized.reject(fault('RUNNER_SDK_INIT_REFUSED'));throw fault('RUNNER_SDK_INIT_REFUSED');}
  sessionId=frame.session_id;initialized.resolve(sessionId);
 }
 function first(key){
  if(closed||currentSignal.aborted)throw fault('RUNNER_SESSION_STOPPED');
  if(bound)return bound;
  const main=assertSdkSessionKey(key,{main:true});
  // Registration is attempted once. The same canonical adapter queues every
  // observed batch behind it and retains its existing bounds/UNKNOWN barrier.
  const admitted={register:methods.register,...Object.fromEntries(['load','append','listSubkeys'].map(name=>[name,async(input,options)=>{
   await registration;
   if(closed||currentSignal.aborted||options?.signal?.aborted)throw fault('RUNNER_SESSION_STOPPED');
   return methods[name](input,{...options,signal:options?.signal===undefined?currentSignal:AbortSignal.any([currentSignal,options.signal])});
  }]))};
  bound=createNativeBoundSdkSessionStore({client:admitted,binding,sessionKey:main,...(timeoutMs===undefined?{}:{timeoutMs})});
  registration=initialized.promise.then(()=>{
   if(closed||currentSignal.aborted)throw fault('RUNNER_SESSION_STOPPED');
   if(main.sessionId!==sessionId)throw fault('RUNNER_SDK_INIT_REFUSED');
   return bound.register({signal:currentSignal});
  });
  // Failure is subsequently observed by each queued call and settle; never
  // leave an unhandled rejection if cleanup happens before the first dispatch.
  registration.catch(()=>{});
  return bound;
 }
 const store=Object.freeze({
  observeInit,
  async append(key,entries){try{if(failed)throw fault('RUNNER_SDK_SESSION_UNKNOWN');const captured=copySessionEntries(entries);return await first(key).store.append(key,captured);}catch(error){failed=true;throw error;}},
  async load(){throw fault('RUNNER_SDK_FIRST_LOAD_REFUSED');},
  async listSubkeys(){throw fault('RUNNER_SDK_FIRST_LOAD_REFUSED');},
 });
 const settle=async()=>{
  if(!bound)throw fault('RUNNER_SDK_REGISTRATION_UNAVAILABLE');
  const result=await bound.settleObservedCalls();
  if(currentSignal.aborted||failed||result.uncertain||result.appendFailures||result.rejectedAppends)throw fault('RUNNER_SDK_SESSION_UNKNOWN');
  await registration;
 };
 const close=async()=>{closed=true;lifetime.abort();initialized.reject(fault('RUNNER_SESSION_STOPPED'));if(bound){bound.closeMirror();const result=await bound.settleObservedCalls();if(failed||result.uncertain||result.appendFailures||result.rejectedAppends)throw fault('RUNNER_SDK_SESSION_UNKNOWN');await registration;}};
 return Object.freeze({store,settle,close});
}
