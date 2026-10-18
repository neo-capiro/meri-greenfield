/** Late-bound bridge for option B's unattended occurrence and consent facts (D016-A #4). The reads composer is built before
 * control owns a pool, so it receives `port.readOccurrence({binding, signal})` and startControl binds the schedule owner once it
 * exists. Unbound, every lookup answers null; an unattended run then has no live session to obtain attended authority. */
import {types} from 'node:util';
const refuse=code=>{throw Object.assign(Error(code),{code});};
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u;
export function createOccurrenceRelay(){
 let read=null,closed=false;
 const port=Object.freeze({async readOccurrence({binding,signal}={}){
  if(closed||read===null)return null;
  if(binding===null||typeof binding!=='object'||typeof binding.tenantId!=='string'||!binding.tenantId||!uuid.test(binding.conversationId??''))refuse('OCCURRENCE_RELAY_REQUEST');
  const check=()=>{if(signal?.aborted)refuse('OCCURRENCE_RELAY_CANCELLED');};
  return read({tenantId:binding.tenantId,conversationId:binding.conversationId},check);
 }});
 return Object.freeze({port,
  bind(owner){if(read!==null||closed)refuse('OCCURRENCE_RELAY_CONFIGURATION');const fn=owner?.readConsentForOccurrence;if(typeof fn!=='function'||types.isProxy(owner)||types.isProxy(fn))refuse('OCCURRENCE_RELAY_CONFIGURATION');read=(selection,check)=>Reflect.apply(fn,owner,[selection,check]);},
  close(){closed=true;read=null;},
  state:()=>closed?'closed':read===null?'unbound':'bound'});
}
