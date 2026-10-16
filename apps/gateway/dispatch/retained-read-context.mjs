/** Local trusted-port proposal. No port is installed or authority created here. */
import {canonicalSha256} from '../../../packages/contracts/validate.mjs';
import {frozenData,ownFields} from '../sources/source-admission.mjs';
import {deny,parseRawJson} from './operation-result.mjs';
export const retainedReadGroup=entry=>['research-portfolio','florida-budget'].includes(entry.contract.binding?.group);
const same=(a,b)=>canonicalSha256(a)===canonicalSha256(b);
export async function prepareRetainedReadContext({entry,request,authority,ports,lifetime,readDeadline,now,maxBytes}){
 if(!ports)deny('UNAVAILABLE');
 const {readCurrent}=ownFields(ports,['readCurrent']);
 if(typeof readCurrent!=='function')deny('GATEWAY_CONFIGURATION');
 const florida=entry.contract.binding.group==='florida-budget',observationAt=new Date(now()).toISOString();
 let options;
 async function observeAuthority(current){
  const started=now(),proof=frozenData({binding:current.binding,subject:current.subject,operation:entry.descriptor.operation,
   requestSha256:canonicalSha256(request),policyRevision:current.policyRevision,sourceIds:current.sourceIds});
  const raw=await lifetime.run(signal=>readCurrent.call(ports,Object.freeze({...proof,request,
   observationAt:florida?observationAt:null,deadlineMs:readDeadline(),signal})));
  const receipt=frozenData(parseRawJson(raw,maxBytes,'ACCESS_DENIED'));
  ownFields(receipt,[...Object.keys(proof),'context','checkedAtMs','expiresAtMs']);
  if(Object.keys(proof).some(key=>!same(receipt[key],proof[key]))||
   !Number.isSafeInteger(receipt.checkedAtMs)||receipt.checkedAtMs<started||receipt.checkedAtMs>now()||
   !Number.isSafeInteger(receipt.expiresAtMs)||receipt.expiresAtMs<=now())deny('ACCESS_DENIED');
  const next=receipt.context;
  if(florida){if(next.asOf!==observationAt||options&&!same(next,options))deny('ACCESS_DENIED');}
  else if(!same(next,{binding:current.binding,subject:current.subject}))deny('ACCESS_DENIED');
  // Canonical normalization validates the entire trusted context and selectors.
  try{entry.contract.normalizeInput(request,next);}catch{deny('INVALID_ARGUMENTS');}
  options=next;lifetime.limitDeadline(receipt.expiresAtMs);lifetime.check();
 }
 await observeAuthority(authority);
 return Object.freeze({authority,handlerNormalization:true,
  options:(current=authority)=>florida?options:{binding:current.binding,subject:current.subject},
  observeAuthority,async retain(){}});
}
