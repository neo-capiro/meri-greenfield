/** Exact observed SDK key -> native registered owner -> existing bounded SDK adapter. */
import {canonicalSha256} from '../../packages/contracts/validate.mjs';
import {createNativeSdkSessionClient,createNativeBoundSdkSessionStore} from './native-authority/session-client.mjs';
import {fault} from './config.mjs';
import {own,data} from '../../packages/contracts/commands-0.2/execution-boundary.mjs';
export function createRuntimeSdkSessionFactory(configuration){
 const {origin,credential,binding,fetchImpl=fetch,now=Date.now}=own(configuration,['origin','credential','binding'],['fetchImpl','now']);
 const pinnedBinding=data(binding),client=createNativeSdkSessionClient({origin,credential,binding:pinnedBinding,fetchImpl,now});
 return async value=>{
  const {binding:currentBinding,sessionKey,signal}=own(value,['binding'],['sessionKey','signal','continuation']);
  if(canonicalSha256(data(currentBinding))!==canonicalSha256(pinnedBinding)||sessionKey===undefined)throw fault('RUNNER_SDK_REGISTRATION_UNAVAILABLE');
  const bound=createNativeBoundSdkSessionStore({client,binding:pinnedBinding,sessionKey});
  const settle=async()=>{const result=await bound.settleObservedCalls();if(result.uncertain)throw fault('RUNNER_SDK_SESSION_UNKNOWN');};
  const close=async()=>{bound.closeMirror();await settle();};
  try{await bound.register({signal});return Object.freeze({store:bound.store,settle,close});}
  catch(error){bound.closeMirror();await bound.settleObservedCalls();throw error;}
 };
}
