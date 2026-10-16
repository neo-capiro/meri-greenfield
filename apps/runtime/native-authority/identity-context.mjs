/** Thin join of native authority and the canonical current-run owner, with optional trusted selection. */
import {own,data} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {createCapiroApplicationAuthorityClient} from '../../control/action-host/application-adapters/authority-http.mjs';
import {createApplicationContextAdapters} from '../../control/action-host/application-adapters/context-adapter.mjs';
import {storageMethod} from '../../artifacts/storage/boundary.mjs';
export function createNativeIdentityContext(configuration){
 const {origin,currentOwner,commandContext,fetchImpl,now,limits,enabled=false,selectRun,admitInitialConversation}=own(configuration,['origin','currentOwner','commandContext','fetchImpl','now','limits'],['enabled','selectRun','admitInitialConversation']);
 const l=data(own(limits,['maxRequestMs','maxFactBytes'])),currentRun=storageMethod(currentOwner,'currentRun');
 const client=createCapiroApplicationAuthorityClient({origin,fetchImpl,now,enabled,limits:{maxRequestMs:l.maxRequestMs,maxResponseBytes:l.maxFactBytes}});
 const mapped=createApplicationContextAdapters({client,currentRun,commandContext,now,limits:l,...(selectRun?{selectRun}:{}),...(admitInitialConversation?{admitInitialConversation}:{})});
 const unavailable=()=>{throw Object.assign(Error('NATIVE_AUTHORITY_UNAVAILABLE'),{code:'NATIVE_AUTHORITY_UNAVAILABLE',status:503});};
 return Object.freeze({
  async verifyIdentity(call){if(!enabled)unavailable();try{return await mapped.verifyIdentity(call);}catch{unavailable();}},
  async resolveContext(call){if(!enabled)unavailable();try{return await mapped.resolveContext(call);}catch{unavailable();}},
  async resolveTransitionContext(call){if(!enabled)unavailable();try{return await mapped.resolveTransitionContext(call);}catch{unavailable();}},
 });
}
