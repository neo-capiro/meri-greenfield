/** Existing issued Objective selection joined to the canonical run model settings. No model grant or proxy. */
import {own,data,nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash,validateShape} from '../../../packages/contracts/validate.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {storageMethod} from '../../artifacts/storage/boundary.mjs';
import {typedFault} from '../../../packages/runtime/objective-generation-custody.mjs';
import {SDK_MODEL_CONFIGURATION} from '../../control/conversations/usage.mjs';
const refuse=()=>{throw typedFault();},same=(a,b)=>hash(a)===hash(b),digest=v=>typeof v==='string'&&/^[a-f0-9]{64}$/u.test(v),uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u.test(v);
function selection(value){const s=data(own(value,['provider','model']));if(Object.values(s).some(v=>typeof v!=='string'||!v.trim()||v.length>128))refuse();return s;}
export function createObjectiveQuerySelectionReader(configuration){
 const c=own(configuration,[],['preparedFacts','store','enabled','now','maxRequestMs']),now=c.now??Date.now,maxRequestMs=c.maxRequestMs??3000,enabled=c.enabled??false;
 if(typeof enabled!=='boolean'||typeof now!=='function'||!Number.isSafeInteger(maxRequestMs)||maxRequestMs<1||maxRequestMs>30000)refuse();
 const readFacts=c.preparedFacts===undefined?null:storageMethod(c.preparedFacts,'read'),factsAvailable=c.preparedFacts===undefined?null:storageMethod(c.preparedFacts,'available'),readPolicy=c.store===undefined?null:storageMethod(c.store,'readModelPolicy');
 const available=()=>{try{return enabled&&readFacts!==null&&readPolicy!==null&&factsAvailable()===true;}catch{return false;}};
 async function read(value){
  const v=own(value,['binding','sourceRequestSha256'],['signal']);nativeSignal(v.signal);if(!available())refuse();validateShape('RunBinding',v.binding);if(!digest(v.sourceRequestSha256))refuse();
  const life=createOperationLifetime({now,signal:v.signal,deadlineMs:now()+maxRequestMs,errorFactory:typedFault});
  try{
   const entry=data(await life.run(signal=>readFacts({binding:v.binding,signal})));life.check();
   const issuance=data(own(entry.issuance,['issuanceKey','binding','requestSha256','expiresAtMs','grantId','capabilitySha256','factsSha256']));
   const {issuance:ignored,factsSha256:ignoredHash,...facts}=entry;
   if(!same(issuance.binding,v.binding)||issuance.issuanceKey!==hash(v.binding)||issuance.requestSha256!==v.sourceRequestSha256||
      !digest(issuance.factsSha256)||issuance.factsSha256!==entry.factsSha256||hash(facts)!==entry.factsSha256||
      !uuid(issuance.grantId)||!digest(issuance.capabilitySha256)||!Number.isSafeInteger(issuance.expiresAtMs)||issuance.expiresAtMs<=now()||
      !same(entry.original?.binding,v.binding)||entry.original?.expiresAtMs!==issuance.expiresAtMs||entry.original?.executionKey!==hash(v.binding)||
      entry.grantId!==issuance.grantId||!entry.objectiveGeneration||!entry.objectiveStrategy)refuse();
   life.limitDeadline(issuance.expiresAtMs);
   const expected=selection(entry.objectiveStrategy.executionSelection),actual={provider:SDK_MODEL_CONFIGURATION.usageBasis.provider,model:SDK_MODEL_CONFIGURATION.model};
   if(!same(expected,actual))refuse();
   // The same existing run/settings reader supplies the activity's limits and model basis.
   await life.run(()=>readPolicy(v.binding,life.check));
   const current=data(await life.run(signal=>readFacts({binding:v.binding,signal})));life.check();if(!same(current,entry)||!available())refuse();
   return data({binding:v.binding,sourceRequestSha256:v.sourceRequestSha256,...actual,checkedAtMs:now(),expiresAtMs:issuance.expiresAtMs});
  }catch{refuse();}finally{life.close();}
 }
 return Object.freeze({available,read});
}
