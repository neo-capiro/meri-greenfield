/** Current CONTROL context for fixed native read families; no credential crosses this port. */
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {frozenData,ownFields} from '../sources/source-admission.mjs';
import {deny,parseRawJson} from './operation-result.mjs';
import {NATIVE_READ_FAMILIES} from '../sources/retained-reads/native-families.mjs';
const same=(a,b)=>hash(a)===hash(b);
export const nativeReadGroup=entry=>NATIVE_READ_FAMILIES.includes(entry.contract.binding?.group);
const invocationAware=new WeakSet();
/** Opt-in: a native context port that accepts the durable dispatch's trusted invocation id (run-bound read delegation's call slot). */
export const acceptsInvocationId=ports=>{invocationAware.add(ports);return ports;};
/** The port for one durable call: an invocation-aware port receives `invocationId` on every read; any other port is unchanged. */
export const nativeContextPortsFor=(ports,invocationId)=>invocationId===undefined||ports===undefined||!invocationAware.has(ports)?ports:
 Object.freeze({readCurrent:raw=>ports.readCurrent.call(ports,{...raw,invocationId})});
export async function prepareNativeReadContext({entry,request,authority,ports,lifetime,readDeadline,now,maxBytes}){
 if(!ports)deny('UNAVAILABLE');const {readCurrent}=ownFields(ports,['readCurrent']);if(typeof readCurrent!=='function')deny('GATEWAY_CONFIGURATION');let options;
 const keys=entry.contract.binding.contextKeys??[],lineage=keys.includes('binding')&&keys.includes('subject');
 const semantic=context=>{const {authorizationDecisionId,...subject}=context.subject;return {...context,subject};};
 async function observeAuthority(current){
  if(!same(current.binding,authority.binding)||current.policyRevision!==authority.policyRevision)deny('ACCESS_DENIED');
  const started=now(),proof=frozenData({binding:current.binding,subject:current.subject,operation:entry.descriptor.operation,requestSha256:hash(request),policyRevision:current.policyRevision,sourceIds:current.sourceIds});
  const raw=await lifetime.run(signal=>readCurrent.call(ports,Object.freeze({...proof,request,deadlineMs:readDeadline(),signal}))),receipt=frozenData(parseRawJson(raw,maxBytes,'ACCESS_DENIED'));
  ownFields(receipt,[...Object.keys(proof),'context','checkedAtMs','expiresAtMs']);if(Object.keys(proof).some(key=>!same(receipt[key],proof[key]))||!Number.isSafeInteger(receipt.checkedAtMs)||receipt.checkedAtMs<started||receipt.checkedAtMs>now()||!Number.isSafeInteger(receipt.expiresAtMs)||receipt.expiresAtMs<=now())deny('ACCESS_DENIED');
  const next=receipt.context;try{entry.contract.normalizeInput(request,next);}catch{deny('ACCESS_DENIED');}
  if(lineage){ownFields(next,keys);if(!same(next.binding,current.binding)||!same(next.subject,current.subject)||options&&!same(semantic(next),semantic(options)))deny('ACCESS_DENIED');}
  else if(options&&!same(next,options))deny('ACCESS_DENIED');
  options=next;lifetime.limitDeadline(receipt.expiresAtMs);lifetime.check();
 }
 await observeAuthority(authority);return Object.freeze({authority,handlerNormalization:true,options:(current=authority)=>lineage?{...options,binding:current.binding,subject:current.subject}:options,observeAuthority,async retain(){}});
}
