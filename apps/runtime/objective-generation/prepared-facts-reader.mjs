/** Control-local read of ONE already-issued Objective entry. No fact compilation, issuance, or task route. */
import {own,data,hash,issuedObjectiveSelection,assertPreparedObjectiveSelection,typedFault} from '../../../packages/runtime/objective-generation-custody.mjs';
import {nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {validateShape} from '../../../packages/contracts/validate.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {storageMethod} from '../../artifacts/storage/boundary.mjs';

const refuse=()=>{throw typedFault();};
const same=(a,b)=>hash(a)===hash(b);
const digest=value=>typeof value==='string'&&/^[a-f0-9]{64}$/u.test(value);

/** `coreCurrent.readCurrent` is a trusted, authenticated normalizer of Core's current GET readback.
 * It returns {binding,sourceRequestSha256,objectiveGeneration,objectiveStrategy,checkedAtMs,expiresAtMs}.
 * `taskProof.verifyTask` is the existing admitted ECS task proof, pinned to its runner/image at construction.
 * Neither port may be supplied by a worker, model, or caller of read(). */
export function createObjectivePreparedFactsReader(configuration){
 const c=own(configuration,['issued','store','issuance'],['taskProof','coreCurrent','enabled','now','maxRequestMs']);
 const issued=data(c.issued),original=issued.original,receipt=issued.issuance,binding=original?.binding,now=c.now??Date.now,maxRequestMs=c.maxRequestMs??3000,enabled=c.enabled??false;
 const readRun=storageMethod(c.store,'read'),readAllocation=storageMethod(c.store.allocations,'read'),readIssuance=storageMethod(c.issuance,'readIssuance');
 if(typeof now!=='function'||typeof enabled!=='boolean'||!Number.isSafeInteger(maxRequestMs)||maxRequestMs<1||maxRequestMs>30000)refuse();
 validateShape('RunBinding',binding);
 if(!receipt||!digest(issued.factsSha256)||receipt.factsSha256!==issued.factsSha256||receipt.issuanceKey!==hash(binding)||!same(receipt.binding,binding)||original.executionKey!==hash(binding)||original.expiresAtMs!==receipt.expiresAtMs||!digest(receipt.requestSha256)||!digest(issued.allocationSha256)||!digest(issued.taskRequestSha256)||!Array.isArray(issued.grantIntents)||!issued.qualification||typeof original.versions?.imageDigest!=='string'||!/^sha256:[a-f0-9]{64}$/u.test(original.versions.imageDigest))refuse();
 const {issuance:ignored,factsSha256:ignoredHash,...facts}=issued;
 if(hash(facts)!==issued.factsSha256)refuse();
 const readCore=c.coreCurrent===undefined?null:storageMethod(c.coreCurrent,'readCurrent');
 const verifyTask=c.taskProof===undefined?null:storageMethod(c.taskProof,'verifyTask');
 const available=()=>enabled&&readCore!==null&&verifyTask!==null&&issued.objectiveGeneration!==undefined&&issued.objectiveStrategy!==undefined;

 async function read(value){
  const v=own(value,['binding'],['signal']);nativeSignal(v.signal);
  if(!available()||!same(v.binding,binding)||now()>=receipt.expiresAtMs)refuse();
  const life=createOperationLifetime({now,signal:v.signal,deadlineMs:Math.min(now()+maxRequestMs,receipt.expiresAtMs),errorFactory:typedFault});
  let firstRun,firstAllocation;
  async function accepted(){
   const saved=data(await life.run(()=>readRun(binding,{},life.check)));life.check();
   const r=data(saved.run),run=data({binding:r.binding,state:r.state,scopes:r.scopes,policyRevision:r.policyRevision,versions:r.versions});
   if(!same(run.binding,binding)||!['queued','starting','running'].includes(run.state)||!same(run.versions,original.versions)||run.policyRevision!==issued.qualification.policyRevision||!Array.isArray(run.scopes)||run.scopes.length<1||hash(saved.request)!==receipt.requestSha256)refuse();
   issuedObjectiveSelection(issued,{binding,acceptedRequest:saved.request});
   return data({request:saved.request,run});
  }
  async function currentIssuance(){
   const current=data(await life.run(signal=>readIssuance(receipt,{signal})));life.check();if(!same(current,receipt))refuse();
  }
  async function allocation(){
   const saved=await life.run(()=>readAllocation({binding,allocationKey:original.executionKey},life.check));life.check();
   const record=data(saved?.record);
   if(!record||record.state!=='ADMITTED'||!same(record.original,original)||record.allocationSha256!==issued.allocationSha256||record.taskRequestSha256!==issued.taskRequestSha256||!same(record.grantIntents,issued.grantIntents)||typeof record.resource?.taskArn!=='string'||!record.resource.taskArn)refuse();
   return data({record,taskArn:record.resource.taskArn});
  }
  try{
   firstRun=await accepted();await currentIssuance();firstAllocation=await allocation();
   const taskStarted=now(),proof=data(own(await life.run(signal=>verifyTask({original,resource:firstAllocation.record.resource,signal})),['taskArn','imageSha256','runnerSha256','checkedAtMs','expiresAtMs']));life.check();
   if(proof.taskArn!==firstAllocation.taskArn||proof.imageSha256!==original.versions.imageDigest.slice(7)||!digest(proof.runnerSha256)||!Number.isSafeInteger(proof.checkedAtMs)||proof.checkedAtMs<taskStarted||proof.checkedAtMs>now()||!Number.isSafeInteger(proof.expiresAtMs)||proof.expiresAtMs<original.expiresAtMs)refuse();
   const secondRun=await accepted(),secondAllocation=await allocation();await currentIssuance();
   if(!same(secondRun,firstRun)||!same(secondAllocation,firstAllocation))refuse();
   const coreStarted=now(),core=data(own(await life.run(signal=>readCore({binding,generationJobId:issued.objectiveGeneration.sourceAdmission.generationJobId,sourceRequestSha256:receipt.requestSha256,signal})),['binding','sourceRequestSha256','objectiveGeneration','objectiveStrategy','checkedAtMs','expiresAtMs']));life.check();
   if(!same(core.binding,binding)||core.sourceRequestSha256!==receipt.requestSha256||!same(core.objectiveGeneration,issued.objectiveGeneration)||!same(core.objectiveStrategy,issued.objectiveStrategy)||!Number.isSafeInteger(core.checkedAtMs)||core.checkedAtMs<coreStarted||core.checkedAtMs>now()||!Number.isSafeInteger(core.expiresAtMs)||core.expiresAtMs<=now())refuse();
   life.limitDeadline(core.expiresAtMs);
   assertPreparedObjectiveSelection({objectiveGeneration:core.objectiveGeneration,objectiveStrategy:core.objectiveStrategy},{binding,acceptedRequest:firstRun.request,expiresAtMs:receipt.expiresAtMs,nowMs:now()});
   await currentIssuance();const finalAllocation=await allocation(),finalRun=await accepted();
   if(!same(finalAllocation,firstAllocation)||!same(finalRun,firstRun))refuse();life.check();return data(issued);
  }catch{refuse();}finally{life.close();}
 }
 return Object.freeze({available,read});
}
