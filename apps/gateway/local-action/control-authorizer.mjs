/** Current local read authority for the existing control protocol; no second approval policy. */
import {types} from 'node:util';
import {canonicalSha256,validateShape} from '../../../packages/contracts/validate.mjs';
import {resolveOperationContract} from '../../../packages/contracts/retrieval-0.2/validate.mjs';
import {createCurrentToolAuthority} from '../authorization/current-tool-authority.mjs';
import {ownFields,frozenData} from '../sources/source-admission.mjs';
import {deny,safeFailure} from '../dispatch/operation-result.mjs';
import {assertLocalActionIdentity} from './identity.mjs';
const contract=resolveOperationContract({id:'actions.query',version:'0.2.0'}),same=(a,b)=>canonicalSha256(a)===canonicalSha256(b);
const phases=['before_claim','before_dispatch','before_store','before_release','before_error_release','before_read'];
export function createLocalLookupAuthorizer(configuration){
 const {identity,credential,assertStoredBinding,now,maxFactBytes=65536}=ownFields(configuration,['identity','credential','assertStoredBinding','now'],['maxFactBytes']);
 assertLocalActionIdentity(identity);if(typeof credential!=='string'||typeof assertStoredBinding!=='function'||typeof now!=='function')deny('GATEWAY_CONFIGURATION');
 const authority=createCurrentToolAuthority({ports:identity.authorityPorts,now,maxFactBytes});
 return async function authorize(call){
  try {
  const {phase,binding:value,signal,limitDeadline}=ownFields(call,['phase','binding','limitDeadline'],['signal']);
  if(!phases.includes(phase)||typeof limitDeadline!=='function')deny('ACCESS_DENIED');
  if(signal!==undefined){if(types.isProxy(signal))deny('ACCESS_DENIED');try{Object.getOwnPropertyDescriptor(AbortSignal.prototype,'aborted').get.call(signal);}catch{deny('ACCESS_DENIED');}}
  const binding=frozenData(value);ownFields(binding,['original','current','scopes','resultReference','resultSha256','bindingSha256']);
  const {bindingSha256,...unsigned}=binding;if(canonicalSha256(unsigned)!==bindingSha256)deny('ACCESS_DENIED');
  validateShape('RunBinding',binding.current);
  if(typeof binding.resultReference!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu.test(binding.resultReference)||
      (binding.resultSha256!==null&&(typeof binding.resultSha256!=='string'||!/^[0-9a-f]{64}$/u.test(binding.resultSha256))))deny('ACCESS_DENIED');
  const state=identity.status();if(!same(binding.current,state.binding)||!same(binding.scopes,state.scopes))deny('ACCESS_DENIED');
  if(binding.original===null){if(phase!=='before_read')deny('ACCESS_DENIED');}
  else {
   const original=assertStoredBinding(binding.original);if(!same(original,binding.original)||binding.resultReference!==original.context.resultReference||original.context.selectedClientId!==state.clientId||
      ['tenantId','actorId','conversationId','runId'].some(k=>original.context.binding[k]!==state.binding[k]))deny('ACCESS_DENIED');
   if(!['before_release'].includes(phase)&&!same(original.context.binding,state.binding))deny('ACCESS_DENIED');
  }
  const normalized=contract.normalizeInput({clientId:state.clientId},{binding:state.binding,clientResolution:{reference:state.clientId,clientId:state.clientId}});
  const current=await authority.check({credential,descriptor:contract.descriptor,input:normalized.input,signal,limitDeadline});
  const stamp=now();if(signal?.aborted||!Number.isSafeInteger(stamp)||stamp>=current.deadlineMs||!same(current.binding,binding.current)||!same(current.subject.scopes,binding.scopes))deny('ACCESS_DENIED');
  return frozenData({authorized:true,bindingSha256,expiresAtMs:current.deadlineMs});
  } catch(error) {
   // Canonical gateway denials intentionally have no public .code; the existing
   // control callback protocol requires a closed own code. Never forward text.
   const owned=safeFailure(error).message;
   const code=['ACCESS_DENIED','DEADLINE','CANCELLED'].includes(owned)?owned:'LOOKUP_UNAVAILABLE';
   throw Object.assign(new Error(code),{code});
  }
 };
}
