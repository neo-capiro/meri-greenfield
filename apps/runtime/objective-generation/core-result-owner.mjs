/** Trusted in-process Core bridge. The existing retained reader owns custody and current read authority. */
import {own,data,hash,typedFault} from '../../../packages/runtime/objective-generation-custody.mjs';
import {nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {storageMethod,uuid,digest,validateShape} from '../../artifacts/storage/boundary.mjs';
const refuse=()=>{throw typedFault();};
export function createCoreObjectiveGenerationResultOwner(configuration){
 const c=own(configuration,['source'],['reader','enabled','now','maxRequestMs']),source=data(own(c.source,['generationJobId','binding','sourceAdmissionSha256']));
 const enabled=c.enabled??false,now=c.now??Date.now,maxRequestMs=c.maxRequestMs??3000;
 uuid(source.generationJobId);digest(source.sourceAdmissionSha256);validateShape('RunBinding',source.binding);
 if(typeof enabled!=='boolean'||typeof now!=='function'||!Number.isSafeInteger(maxRequestMs)||maxRequestMs<1||maxRequestMs>3000)refuse();
 const retained=c.reader===undefined?null:{read:storageMethod(c.reader,'read'),available:storageMethod(c.reader,'available')};
 const available=()=>enabled&&retained!==null&&retained.available()===true;
 async function read(value,options={}){
  const input=data(own(value,['generationJobId','binding','sourceAdmissionSha256'])),o=own(options,[],['signal']);nativeSignal(o.signal);
  if(hash(input)!==hash(source)||!available())refuse();
  const began=now(),deadlineMs=began+maxRequestMs,life=createOperationLifetime({now,signal:o.signal,deadlineMs,errorFactory:typedFault});
  try{
   // Only this canonical owner can return a validated retained result. No caller result/path/hash is forwarded.
   const result=data(await life.run(signal=>retained.read({generationJobId:source.generationJobId,signal}))),observedAtMs=now();
   if(result.generationJobId!==source.generationJobId||result.sourceAdmissionSha256!==source.sourceAdmissionSha256||hash(result.binding)!==hash(source.binding)||
    !Number.isSafeInteger(result.checkedAtMs)||result.checkedAtMs<began||result.checkedAtMs>observedAtMs||!Number.isSafeInteger(result.expiresAtMs)||result.expiresAtMs<=observedAtMs)refuse();
   life.limitDeadline(result.expiresAtMs);life.check();return result;
  }finally{life.close();}
 }
 return Object.freeze({available,read});
}
