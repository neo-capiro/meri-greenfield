/** Bounded Objective v2 envelope over the actual existing prepared-facts reader.
 * The per-read Core wrapper retains every validated current-proof expiry that
 * the older reader internally checks but does not expose in its raw fact result.
 * No source mount, issuer, resolveFacts or fallback reader is introduced. */
import {own,data,nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {storageMethod} from '../../artifacts/storage/boundary.mjs';
import {createObjectivePreparedFactsReader} from '../objective-generation/prepared-facts-reader.mjs';
import {objectiveSourceUnavailable} from './projection.mjs';
const refuse=()=>{throw objectiveSourceUnavailable();};

export function createObjectiveSourcePreparedReader(configuration={}){
 let enabled=false,issued,ports,readCore,now=Date.now,maxRequestMs=3000;
 try{
  const c=own(configuration,[],['issued','store','issuance','taskProof','coreCurrent','enabled','now','maxRequestMs']);
  if(c.enabled===true){
   now=c.now??Date.now;maxRequestMs=c.maxRequestMs??3000;
   if(typeof now!=='function'||!Number.isSafeInteger(maxRequestMs)||maxRequestMs<1||maxRequestMs>3000)refuse();
   issued=data(c.issued);readCore=storageMethod(c.coreCurrent,'readCurrent');
   ports={store:c.store,issuance:c.issuance,taskProof:c.taskProof};
   // Inert construction validates genuine owner interfaces and fixed source.
   const probe=createObjectivePreparedFactsReader({...ports,issued,coreCurrent:c.coreCurrent,enabled:true,now,maxRequestMs});
   if(probe.available()!==true)refuse();enabled=true;
  }
 }catch{enabled=false;}
 const available=()=>enabled;
 async function read(value){
  let life;
  try{
   if(!enabled)refuse();const v=own(value,['binding'],['signal']);nativeSignal(v.signal);
   if(hash(v.binding)!==hash(issued.original.binding))refuse();
   let previous=now();if(!Number.isSafeInteger(previous)||previous<0)refuse();const startedAtMs=previous;
   const clock=()=>{const at=now();if(!Number.isSafeInteger(at)||at<previous)refuse();previous=at;return at;};
   const deadlineMs=Math.min(startedAtMs+maxRequestMs,issued.issuance.expiresAtMs);
   life=createOperationLifetime({now:clock,signal:v.signal,deadlineMs,errorFactory:objectiveSourceUnavailable});
   let proofExpiry=deadlineMs,observed=false;
   const coreCurrent={async readCurrent(query){
    const began=clock(),proof=data(own(await life.run(signal=>readCore({...query,signal})),['binding','sourceRequestSha256','objectiveGeneration','objectiveStrategy','checkedAtMs','expiresAtMs']));life.check();
    if(!Number.isSafeInteger(proof.checkedAtMs)||proof.checkedAtMs<began||proof.checkedAtMs>clock()||
       !Number.isSafeInteger(proof.expiresAtMs)||proof.expiresAtMs<=clock())refuse();
    proofExpiry=Math.min(proofExpiry,proof.expiresAtMs);life.limitDeadline(proof.expiresAtMs);observed=true;return proof;
   }};
   // Each request gets its own observed proof deadline and real reader instance.
   const actual=createObjectivePreparedFactsReader({...ports,issued,coreCurrent,enabled:true,now:clock,maxRequestMs});
   const result=data(await life.run(signal=>actual.read({binding:v.binding,signal})));life.check();
   const checkedAtMs=clock(),expiresAtMs=Math.min(deadlineMs,proofExpiry,issued.issuance.expiresAtMs);
   if(!observed||hash(result)!==hash(issued)||checkedAtMs<startedAtMs||expiresAtMs<=checkedAtMs)refuse();
   return data({issued:result,checkedAtMs,expiresAtMs});
  }catch{refuse();}finally{life?.close();}
 }
 return Object.freeze({available,read});
}
