/** Per-run preparation over existing compilers. No capability generation or admission here.
 * Trusted issuer contract: read is durable/linearizable; issue durably claims the key
 * BEFORE generation and is atomic/idempotent across callers. An uncertain claim reads
 * UNKNOWN until reconciled, never ABSENT. bindFacts is immutable compare-or-set.
 * resolve retrieves an existing opaque value; it must never generate a replacement.
 * Ports are owner implementations, never browser/model supplied callbacks.
 */
import {own,data,nativeSignal} from '../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash,validateShape} from '../../packages/contracts/validate.mjs';
import {createOperationLifetime} from '../../packages/runtime/operation-lifetime.mjs';
import {storageMethod} from '../artifacts/storage/boundary.mjs';
import {compileNativeBrokerPlan} from './native-authority/broker-stack.mjs';
import {createNativeTaskAllocator} from './native-authority/task-allocator.mjs';
import {compileNativeTaskAccess,matchesCapability} from './native-authority/task-verifier.mjs';
import {createNativeAllocationAdmission} from '../gateway/budget/native-allocation-admission.mjs';
import {allocation} from '../gateway/budget/tool-budget-binding.mjs';
const fail=code=>{throw Object.assign(Error('PREPARED_RUN_'+code),{code:'PREPARED_RUN_'+code});};
const digest=v=>typeof v==='string'&&/^[a-f0-9]{64}$/u.test(v);
const same=(a,b)=>hash(a)===hash(b);
function intentOf(value){
 const v=own(value,['binding','requestSha256','expiresAtMs'],['issuanceKey']),i=data({binding:v.binding,requestSha256:v.requestSha256,expiresAtMs:v.expiresAtMs});validateShape('RunBinding',i.binding);
 if(!digest(i.requestSha256)||!Number.isSafeInteger(i.expiresAtMs)||i.expiresAtMs<1)fail('REFUSED');
 if(v.issuanceKey!==undefined&&v.issuanceKey!==hash(i.binding))fail('REFUSED');return data({...i,issuanceKey:hash(i.binding)});
}
function receiptOf(value,intent){
 const r=data(own(value,['issuanceKey','binding','requestSha256','expiresAtMs','grantId','capabilitySha256'],['factsSha256']));
 if(!same(Object.fromEntries(Object.keys(intent).map(k=>[k,r[k]])),intent)||!digest(r.capabilitySha256)||!/^([a-f0-9]{8}-){1}[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u.test(r.grantId)||r.factsSha256!==undefined&&!digest(r.factsSha256))fail('ISSUER_REFUSED');
 return r;
}
/** Inert fact compiler: calls no database/cloud/provider port and retains original expiry. */
export function compilePreparedRunFacts(value,{intent,issuance,now=Date.now}){
 const i=intentOf(intent),r=receiptOf(issuance,i),c=data(own(value,['runtime','plan','preparationIntent','allocationJson','qualification','grantIntents','grantId','operations','taskRequest','containerName','controlCapabilitySha256']));
 const compiled=compileNativeBrokerPlan({runtime:c.runtime,plan:c.plan,preparationIntent:c.preparationIntent}),a=allocation(c.allocationJson);
 if(!same(compiled.original.binding,i.binding)||compiled.original.expiresAtMs!==i.expiresAtMs||i.expiresAtMs<=now()||!digest(c.controlCapabilitySha256)||r.capabilitySha256===c.controlCapabilitySha256||c.grantId!==r.grantId||c.runtime.maxTurns>a.budgets.maxTurns||c.runtime.maxCostMicroUSD>a.budgets.maxCostMicroUSD||c.runtime.maxOutputBytes>a.budgets.maxOutputBytes||i.expiresAtMs>Date.parse(a.schedule.expiresAt))fail('FACTS_REFUSED');
 const taskGrant=c.grantIntents.find(g=>g.grantId===r.grantId);
 if(!taskGrant||taskGrant.capabilitySha256!==r.capabilitySha256||taskGrant.expiresAtMs!==i.expiresAtMs||c.grantIntents.some(g=>g.capabilitySha256===c.controlCapabilitySha256||g.expiresAtMs!==i.expiresAtMs))fail('FACTS_REFUSED');
 compileNativeTaskAccess({identityCredential:'inert-issuance-validation',taskCapabilitySha256:r.capabilitySha256,operations:c.operations});
 const noEffect=()=>{fail('UNEXPECTED_EFFECT');},limits={maxRequestMs:3000,maxFactBytes:131072};
 createNativeAllocationAdmission({pool:{connect:noEffect},allocationJson:c.allocationJson,qualification:c.qualification,grantIntents:c.grantIntents,binding:i.binding,now,limits});
 const allocator=createNativeTaskAllocator({journal:{claim:noEffect,read:noEffect,record:noEffect},authority:{verify:noEffect},admission:{admit:noEffect,read:noEffect,revoke:noEffect},client:{send:noEffect},original:compiled.original,taskRequest:c.taskRequest,qualification:c.qualification,grantIntents:c.grantIntents,allocationSha256:hash(a),containerName:c.containerName});
 const facts=data({original:compiled.original,allocationSha256:hash(a),taskRequestSha256:allocator.intent.taskRequestSha256,qualification:c.qualification,grantIntents:c.grantIntents,grantId:c.grantId,operations:c.operations,controlCapabilitySha256:c.controlCapabilitySha256});
 return data({...facts,factsSha256:hash(facts)});
}
export function createPreparedRunIssuance(configuration){
 const c=own(configuration,['issuer','facts'],['sourceOwners','now','maxRequestMs']),now=c.now??Date.now,maxRequestMs=c.maxRequestMs??3000;
 if(typeof now!=='function'||!Number.isSafeInteger(maxRequestMs)||maxRequestMs<1||maxRequestMs>30000)fail('CONFIGURATION');
 const read=storageMethod(c.issuer,'read'),issue=storageMethod(c.issuer,'issue'),bindFacts=storageMethod(c.issuer,'bindFacts'),resolve=storageMethod(c.issuer,'resolve'),compile=storageMethod(c.facts,'compile'),uncertain=new Set();
 let readAllocation,revoke;
 if(c.sourceOwners){const s=own(c.sourceOwners,['allocations','admission']);readAllocation=storageMethod(s.allocations,'read');revoke=storageMethod(s.admission,'revoke');}
 async function retired(source,target,life){
  if(source===undefined)return;
  if(!readAllocation)fail('SOURCE_REQUIRED');
  const s=data(own(source,['original','grantIntents'])),o=own(s.original,['binding','executionKey','executionId','planSha256','expiresAtMs','versions']),b=o.binding;validateShape('RunBinding',b);validateShape('RuntimeVersions',o.versions);
  if(o.executionId!==o.executionKey||!digest(o.planSha256)||!Number.isSafeInteger(o.expiresAtMs)||o.expiresAtMs<1)fail('SOURCE_REFUSED');
  if(b.tenantId!==target.tenantId||b.actorId!==target.actorId||b.conversationId!==target.conversationId||b.runId===target.runId||b.attemptId===target.attemptId||b.workerId===target.workerId||b.writerFence>=target.writerFence||s.original.executionKey!==hash(b)||!Array.isArray(s.grantIntents)||!s.grantIntents.length)fail('SOURCE_REFUSED');
  const saved=await life.run(()=>readAllocation({binding:b,allocationKey:s.original.executionKey},life.check));life.check();
  const record=saved?.record;
  if(!record||record.state!=='RETIRED'||!same(record.original,s.original)||!same(record.grantIntents,s.grantIntents)||record.resource?.physicalStopProven!==true||typeof record.resource.taskArn!=='string')fail('SOURCE_NOT_RETIRED');
  const proof=data(own(await life.run(signal=>revoke({taskArn:record.resource.taskArn,signal})),['state','taskArn','grantIds','revocationProven'],['authorityAbsent']));life.check();
  if(proof.state!=='REVOKED'||proof.revocationProven!==true||proof.taskArn!==record.resource.taskArn||!Array.isArray(proof.grantIds)||!same([...proof.grantIds].sort(),s.grantIntents.map(g=>g.grantId).sort()))fail('SOURCE_NOT_REVOKED');
 }
 function stateOf(value,intent){const s=own(value,['state'],['issuance']);if(!['ABSENT','UNKNOWN','ISSUED'].includes(s.state)||s.state!=='ISSUED'&&s.issuance!==undefined)fail('ISSUER_REFUSED');return s.state==='ISSUED'?receiptOf(s.issuance,intent):null;}
 async function prepare(value){
  const v=own(value,['binding','requestSha256','expiresAtMs'],['source','signal']);nativeSignal(v.signal);const intent=intentOf({binding:v.binding,requestSha256:v.requestSha256,expiresAtMs:v.expiresAtMs}),source=v.source===undefined?undefined:data(own(v.source,['original','grantIntents']));
  const life=createOperationLifetime({now,signal:v.signal,deadlineMs:Math.min(intent.expiresAtMs,now()+maxRequestMs),errorFactory:()=>Object.assign(Error('PREPARED_RUN_UNKNOWN'),{code:'PREPARED_RUN_UNKNOWN'})});
  try{
   life.check();if(intent.binding.writerFence>1&&source===undefined)fail('SOURCE_REQUIRED');await retired(source,intent.binding,life);
   let state=await life.run(signal=>read({...intent,signal})),issuance=stateOf(state,intent);life.check();
   if(!issuance){
    if(state.state!=='ABSENT'||uncertain.has(intent.issuanceKey))fail('ISSUANCE_UNKNOWN');
    uncertain.add(intent.issuanceKey);
    try{state=await life.run(signal=>issue({...intent,signal}));issuance=stateOf(state,intent);}catch{state=await life.run(signal=>read({...intent,signal}));issuance=stateOf(state,intent);}
    if(!issuance)fail('ISSUANCE_UNKNOWN');
   }
   uncertain.delete(intent.issuanceKey);life.check();if(source?.grantIntents.some(g=>g.capabilitySha256===issuance.capabilitySha256||g.grantId===issuance.grantId))fail('SOURCE_CAPABILITY_REUSE');
   const raw=await life.run(signal=>compile({intent,issuance,signal})),facts=compilePreparedRunFacts(raw,{intent,issuance,now});life.check();
   if(source&&facts.grantIntents.some(target=>source.grantIntents.some(prior=>target.grantId===prior.grantId||target.capabilitySha256===prior.capabilitySha256)))fail('SOURCE_CAPABILITY_REUSE');
   const bound=receiptOf(await life.run(signal=>bindFacts({...intent,capabilitySha256:issuance.capabilitySha256,grantId:issuance.grantId,factsSha256:facts.factsSha256,signal})),intent);
   if(bound.capabilitySha256!==issuance.capabilitySha256||bound.grantId!==issuance.grantId||bound.factsSha256!==facts.factsSha256||issuance.factsSha256!==undefined&&issuance.factsSha256!==facts.factsSha256)fail('FACTS_REPLAY_REFUSED');
   await retired(source,intent.binding,life);life.check();return data({issuance:bound,...facts});
  }catch(error){if(typeof error?.code==='string'&&/^PREPARED_RUN_[A-Z_]+$/u.test(error.code))throw error;fail('UNKNOWN');}finally{life.close();}
 }
 async function resolveCapability(value,{signal}={}){
  nativeSignal(signal);const r=data(value),intent=intentOf({binding:r.binding,requestSha256:r.requestSha256,expiresAtMs:r.expiresAtMs}),receipt=receiptOf(r,intent);
  if(!receipt.factsSha256)fail('FACTS_REQUIRED');
  const life=createOperationLifetime({now,signal,deadlineMs:Math.min(receipt.expiresAtMs,now()+maxRequestMs),errorFactory:()=>Error('PREPARED_RUN_UNKNOWN')});
  try{life.check();const current=stateOf(await life.run(signal=>read({...intent,signal})),intent);if(!current||!same(current,receipt))fail('ISSUER_REFUSED');const capability=await life.run(signal=>resolve({...receipt,signal}));life.check();if(!matchesCapability(capability,receipt.capabilitySha256))fail('CAPABILITY_REFUSED');return capability;}catch(error){if(typeof error?.code==='string'&&/^PREPARED_RUN_[A-Z_]+$/u.test(error.code))throw error;fail('UNKNOWN');}finally{life.close();}
 }
 /** Trusted in-memory composition only. This configuration contains the proxy
  * credential and must never be serialized into a receipt or log. Recompilation
  * must match the issuer's durable fact hash before an allocator receives it. */
 async function resolveFacts(value,{signal}={}){
  nativeSignal(signal);const r=data(value),intent=intentOf({binding:r.binding,requestSha256:r.requestSha256,expiresAtMs:r.expiresAtMs}),receipt=receiptOf(r,intent);
  if(!receipt.factsSha256)fail('FACTS_REQUIRED');
  const life=createOperationLifetime({now,signal,deadlineMs:Math.min(receipt.expiresAtMs,now()+maxRequestMs),errorFactory:()=>Error('PREPARED_RUN_UNKNOWN')});
  try{
   life.check();const current=stateOf(await life.run(signal=>read({...intent,signal})),intent);if(!current||!same(current,receipt))fail('ISSUER_REFUSED');
   const configuration=data(await life.run(signal=>compile({intent,issuance:current,signal}))),facts=compilePreparedRunFacts(configuration,{intent,issuance:current,now});life.check();
   if(facts.factsSha256!==receipt.factsSha256)fail('FACTS_REPLAY_REFUSED');return configuration;
  }catch(error){if(typeof error?.code==='string'&&/^PREPARED_RUN_[A-Z_]+$/u.test(error.code))throw error;fail('UNKNOWN');}finally{life.close();}
 }
 return Object.freeze({prepare,resolveCapability,resolveFacts});
}
