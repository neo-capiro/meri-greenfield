import {conversationClientFromScopes} from '../../packages/contracts/conversation-scope.mjs';
/** Trusted stop-only join over existing immutable rows. Current render facts never
 * reconstruct historical ownership; no issuer/material/preparation port is exposed. */
import {own,data,nativeSignal} from '../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash,validateShape} from '../../packages/contracts/validate.mjs';
import {createOperationLifetime} from '../../packages/runtime/operation-lifetime.mjs';
import {matchHistoricalStopAllocation} from './native-authority/historical-stop-facts.mjs';
import {assertPreparedObjectiveSelection} from '../../packages/runtime/objective-generation-custody.mjs';
import {createOriginalRetirement} from './native-authority/remote-composition.mjs';
const fail=()=>{throw Object.assign(Error('HISTORICAL_RETIREMENT_UNKNOWN'),{code:'HISTORICAL_RETIREMENT_UNKNOWN'});};
const same=(a,b)=>hash(a)===hash(b);
export function createHistoricalRunRetirement({store,issuanceStore,initialBindings,principal,selectedClientId,pool,limits,now=Date.now,retireOriginal=createOriginalRetirement}){
 return async function retire(value){
  const {binding,client,signal}=own(value,['binding','client'],['signal']);nativeSignal(signal);validateShape('RunBinding',binding);
  if(binding.tenantId!==principal.tenantId||binding.actorId!==principal.actorId)fail();
  const life=createOperationLifetime({now,signal,deadlineMs:now()+limits.maxRequestMs,errorFactory:()=>Object.assign(Error('HISTORICAL_RETIREMENT_UNKNOWN'),{code:'HISTORICAL_RETIREMENT_UNKNOWN'})});
  try{
   const saved=await life.run(()=>store.readOptional(binding,{},life.check));life.check();
   const clientId=saved?conversationClientFromScopes(saved.run.scopes,binding):undefined;
   if(!saved||!same(saved.run.binding,binding)||clientId===undefined||!initialBindings&&clientId!==selectedClientId)fail();
   const record=(await life.run(()=>store.allocations.read({binding,allocationKey:hash(binding)},life.check)))?.record;life.check();
   if(!record?.retirementFacts)fail();
   const facts=matchHistoricalStopAllocation(record.retirementFacts,record),i=facts.issuance;
   if(facts.schemaVersion!==2||!same(facts.original.binding,binding)||!same(facts.original.versions,saved.run.versions)||facts.qualification.policyRevision!==saved.run.policyRevision||i.requestSha256!==hash(saved.request))fail();
   if(facts.issuedFacts.objectiveStrategy!==undefined){const f=facts.issuedFacts;
    assertPreparedObjectiveSelection({objectiveGeneration:f.objectiveGeneration,objectiveStrategy:f.objectiveStrategy},{binding,acceptedRequest:saved.request,expiresAtMs:facts.original.expiresAtMs});
    if(f.objectiveGeneration.sourceAdmission.canonical.clientId!==clientId)fail();
   }
   if(binding.writerFence===1&&initialBindings){
    const a=await life.run(()=>initialBindings.read({binding},life.check));life.check();
    if(!a||a.schemaVersion!==1||a.state!=='ADMITTED'||!same(a.binding,binding)||a.selectedClientId!==clientId||a.policyRevision!==saved.run.policyRevision||!same(a.versions,saved.run.versions)||a.expiresAtMs!==facts.original.expiresAtMs)fail();
   }else if(binding.writerFence>1){
    const r=await life.run(()=>store.nextRuns.readTarget(binding,life.check));life.check();
    if(!r||r.state!=='ACCEPTED'||!same(r.target,binding)||!same(r.scopes,saved.run.scopes)||r.policyRevision!==saved.run.policyRevision)fail();
   }
   const issued=await life.run(()=>issuanceStore.read({issuanceKey:i.issuanceKey}));life.check();
   if(issued?.state!=='ISSUED'||Object.keys(i).some(k=>!same(i[k],issued[k])))fail();
   // Only the existing canonical allocator may revoke and establish physical Stop.
   return await life.run(()=>retireOriginal({store,pool,client,limits,now,retirementFacts:data(facts)}).stop());
  }finally{life.close();}
 };
}
