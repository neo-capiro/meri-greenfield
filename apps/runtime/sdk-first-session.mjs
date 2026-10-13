/** Fresh SDK mirror key capture; the existing native owner still verifies registration. */
import {createNativeBoundSdkSessionStore} from './native-authority/session-client.mjs';
import {assertSdkSessionKey} from '../../packages/contracts/runtime-0.2/session.mjs';
import {own} from '../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {storageMethod} from '../artifacts/storage/boundary.mjs';
import {fault} from './config.mjs';
import {copySessionEntries} from '../worker/qualification/checkpoint/bound-session-store.mjs';

export function createFirstRuntimeSdkSession(configuration){
 const {client,binding}=own(configuration,['client','binding']);
 const methods=Object.freeze(Object.fromEntries(['register','load','append','listSubkeys'].map(name=>[name,storageMethod(client,name)])));
 let bound,registration,closed=false,failed=false;
 function first(key){
  if(closed)throw fault('RUNNER_SESSION_STOPPED');
  if(bound)return bound;
  const main=assertSdkSessionKey(key,{main:true});
  // Registration is attempted once. The same canonical adapter queues every
  // observed batch behind it and retains its existing bounds/UNKNOWN barrier.
  const admitted={register:methods.register,...Object.fromEntries(['load','append','listSubkeys'].map(name=>[name,async(input,options)=>{
   await registration;
   if(closed||options?.signal?.aborted)throw fault('RUNNER_SESSION_STOPPED');
   return methods[name](input,options);
  }]))};
  bound=createNativeBoundSdkSessionStore({client:admitted,binding,sessionKey:main});
  registration=Promise.resolve().then(()=>{
   if(closed)throw fault('RUNNER_SESSION_STOPPED');
   return bound.register();
  });
  // Failure is subsequently observed by each queued call and settle; never
  // leave an unhandled rejection if cleanup happens before the first dispatch.
  registration.catch(()=>{});
  return bound;
 }
 const store=Object.freeze({
  async append(key,entries){try{if(failed)throw fault('RUNNER_SDK_SESSION_UNKNOWN');const captured=copySessionEntries(entries);return await first(key).store.append(key,captured);}catch(error){failed=true;throw error;}},
  async load(){throw fault('RUNNER_SDK_FIRST_LOAD_REFUSED');},
  async listSubkeys(){throw fault('RUNNER_SDK_FIRST_LOAD_REFUSED');},
 });
 const settle=async()=>{
  if(!bound)throw fault('RUNNER_SDK_REGISTRATION_UNAVAILABLE');
  const result=await bound.settleObservedCalls();
  if(failed||result.uncertain||result.appendFailures||result.rejectedAppends)throw fault('RUNNER_SDK_SESSION_UNKNOWN');
  await registration;
 };
 const close=async()=>{closed=true;if(bound){bound.closeMirror();await settle();}};
 return Object.freeze({store,settle,close});
}
