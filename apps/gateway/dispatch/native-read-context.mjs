/** Current CONTROL context for fixed native read families; no credential crosses this port. */
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {frozenData,ownFields} from '../sources/source-admission.mjs';
import {deny,parseRawJson} from './operation-result.mjs';
const same=(a,b)=>hash(a)===hash(b);
export const nativeReadGroup=entry=>['bill-text','public-reports','acquisition-personnel','disclosures'].includes(entry.contract.binding?.group);
export async function prepareNativeReadContext({entry,request,authority,ports,lifetime,readDeadline,now,maxBytes}){
 if(!ports)deny('UNAVAILABLE');const {readCurrent}=ownFields(ports,['readCurrent']);if(typeof readCurrent!=='function')deny('GATEWAY_CONFIGURATION');let options;
 async function observeAuthority(current){
  if(!same(current.binding,authority.binding)||current.policyRevision!==authority.policyRevision)deny('ACCESS_DENIED');
  const started=now(),proof=frozenData({binding:current.binding,subject:current.subject,operation:entry.descriptor.operation,requestSha256:hash(request),policyRevision:current.policyRevision,sourceIds:current.sourceIds});
  const raw=await lifetime.run(signal=>readCurrent.call(ports,Object.freeze({...proof,request,deadlineMs:readDeadline(),signal}))),receipt=frozenData(parseRawJson(raw,maxBytes,'ACCESS_DENIED'));
  ownFields(receipt,[...Object.keys(proof),'context','checkedAtMs','expiresAtMs']);if(Object.keys(proof).some(key=>!same(receipt[key],proof[key]))||!Number.isSafeInteger(receipt.checkedAtMs)||receipt.checkedAtMs<started||receipt.checkedAtMs>now()||!Number.isSafeInteger(receipt.expiresAtMs)||receipt.expiresAtMs<=now())deny('ACCESS_DENIED');
  const next=receipt.context;try{entry.contract.normalizeInput(request,next);}catch{deny('ACCESS_DENIED');}if(options&&!same(next,options))deny('ACCESS_DENIED');options=next;lifetime.limitDeadline(receipt.expiresAtMs);lifetime.check();
 }
 await observeAuthority(authority);return Object.freeze({authority,handlerNormalization:true,options:()=>options,observeAuthority,async retain(){}});
}
