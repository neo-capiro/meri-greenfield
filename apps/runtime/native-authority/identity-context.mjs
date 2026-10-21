/** Thin join of native authority and the canonical current-run owner, with optional trusted selection. */
import {own,data} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {createCapiroApplicationAuthorityClient} from '../../control/action-host/application-adapters/authority-http.mjs';
import {createApplicationContextAdapters,refusalDiagnostic} from '../../control/action-host/application-adapters/context-adapter.mjs';
import {storageMethod} from '../../artifacts/storage/boundary.mjs';
import {carryAuthorityUnavailable} from '../../../packages/runtime/authority-availability.mjs';
export function createNativeIdentityContext(configuration){
 const {origin,currentOwner,commandContext,fetchImpl,now,limits,enabled=false,selectRun,admitInitialConversation}=own(configuration,['origin','currentOwner','commandContext','fetchImpl','now','limits'],['enabled','selectRun','admitInitialConversation']);
 const l=data(own(limits,['maxRequestMs','maxFactBytes'])),currentRun=storageMethod(currentOwner,'currentRun');
 const client=createCapiroApplicationAuthorityClient({origin,fetchImpl,now,enabled,limits:{maxRequestMs:l.maxRequestMs,maxResponseBytes:l.maxFactBytes}});
 const mapped=createApplicationContextAdapters({client,currentRun,commandContext,now,limits:l,...(selectRun?{selectRun}:{}),...(admitInitialConversation?{admitInitialConversation}:{})});
 // One public code for every failure; a dependency that did not answer keeps its transient mark. The context adapter's refusal
 // step and owned reason code (fixed vocabularies) ride along for the session owner's refusal line only.
 const unavailable=cause=>{const error=Object.assign(Error('NATIVE_AUTHORITY_UNAVAILABLE'),{code:'NATIVE_AUTHORITY_UNAVAILABLE',status:503},refusalDiagnostic(cause));throw carryAuthorityUnavailable(cause,error);};
 return Object.freeze({
  async verifyIdentity(call){if(!enabled)unavailable();try{return await mapped.verifyIdentity(call);}catch(error){unavailable(error);}},
  async resolveContext(call){if(!enabled)unavailable();try{return await mapped.resolveContext(call);}catch(error){unavailable(error);}},
  async resolveTransitionContext(call){if(!enabled)unavailable();try{return await mapped.resolveTransitionContext(call);}catch(error){unavailable(error);}},
 });
}
