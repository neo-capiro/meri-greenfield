/** Late-bound bridge for the live-session read relay (RC1 option A; dot's source ack 6245772555). Control startup builds the
 * reads composer before the action-session owner exists (that owner is assembled inside startControl), so the composer
 * receives `port` and startControl binds the owner's `nativeCredentialFor` once assembly exists. Until bound, or after the
 * owner refuses, every call refuses: reads then answer UNAVAILABLE and nothing falls back to any other credential. */
import {types} from 'node:util';
import {borrowedRunSession} from '../control/action-host/session/owner.mjs';
const borrowers=new WeakMap();
export const originatingRelaySession=port=>borrowers.get(port);
const authoritySessions=new WeakMap();
/** Exact control transport provenance, late-bound once to the canonical owner; no second session registry. */
export function bindCurrentAuthoritySessions(fetchImpl,sessions){
 if(typeof fetchImpl!=='function'||authoritySessions.has(fetchImpl))refuse('READ_RELAY_CONFIGURATION');
 const borrow=borrowedRunSession(sessions);if(!borrow)refuse('READ_RELAY_CONFIGURATION');
 authoritySessions.set(fetchImpl,borrow);return ()=>{if(authoritySessions.get(fetchImpl)===borrow)authoritySessions.delete(fetchImpl);};
}
export const originatingAuthoritySession=fetchImpl=>authoritySessions.get(fetchImpl);
const refuse=(code='SESSION_UNAVAILABLE')=>{throw Object.assign(Error(code),{code});};
export function createReadCredentialRelay(){
 let target=null,closed=false,borrow;
 const port=Object.freeze({nativeCredentialFor(input){if(closed||target===null)refuse();return target(input);}});
 borrowers.set(port,input=>{if(closed||!borrow)refuse();return borrow(input);});
 return Object.freeze({port,
  bind(owner){if(target!==null||closed)refuse('READ_RELAY_CONFIGURATION');const fn=owner?.nativeCredentialFor;if(typeof fn!=='function'||types.isProxy(owner)||types.isProxy(fn))refuse('READ_RELAY_CONFIGURATION');target=input=>Reflect.apply(fn,owner,[input]);borrow=borrowedRunSession(owner);},
  close(){closed=true;target=null;borrow=undefined;},
  state:()=>closed?'closed':target===null?'unbound':'bound'});
}
