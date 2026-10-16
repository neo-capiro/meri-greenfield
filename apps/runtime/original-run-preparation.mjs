/** Original entry over the SAME canonical run issuance; no new journal/issuer, expiry window, material or allocation owner. */
import {own,data,nativeSignal} from '../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash,validateShape} from '../../packages/contracts/validate.mjs';
import {createOperationLifetime} from '../../packages/runtime/operation-lifetime.mjs';
const fail=code=>{throw Object.assign(Error('ORIGINAL_RUN_'+code),{code:'ORIGINAL_RUN_'+code});};
const same=(a,b)=>hash(a)===hash(b),digest=v=>typeof v==='string'&&/^[a-f0-9]{64}$/u.test(v);
export function createOriginalRunPreparation({binding,expiresAtMs,store,issuer,runIssuance,now=Date.now,maxRequestMs=3000}){
 const b=data(binding);validateShape('RunBinding',b);
 if(b.writerFence!==1||!Number.isSafeInteger(expiresAtMs)||expiresAtMs<1||typeof store?.readOptional!=='function'||typeof store?.allocations?.read!=='function'||typeof issuer?.read!=='function'||typeof runIssuance?.prepare!=='function'||typeof now!=='function'||!Number.isSafeInteger(maxRequestMs)||maxRequestMs<1||maxRequestMs>30000)fail('CONFIGURATION');
 const issuanceKey=hash(b);
 return async function prepareOriginal(value={}){
  const {signal,stopOnly=false}=own(value,[],['signal','stopOnly']);nativeSignal(signal);
  if(typeof stopOnly!=='boolean')fail('INPUT');
  // Stop uses the existing cleanup/metadata path. Never compile facts or resolve/generate material to reconstruct an entry.
  if(stopOnly)fail('STOP_ONLY_UNAVAILABLE');
  const life=createOperationLifetime({now,signal,deadlineMs:Math.min(expiresAtMs,now()+maxRequestMs),errorFactory:()=>Object.assign(Error('ORIGINAL_RUN_UNKNOWN'),{code:'ORIGINAL_RUN_UNKNOWN'})});
  async function accepted(){const saved=data(await life.run(()=>store.readOptional(b,{},life.check)));life.check();
   if(!saved||!same(saved.run?.binding,b)||!['queued','starting','running'].includes(saved.run.state)||!saved.request)fail('ACCEPTED_REQUEST_REQUIRED');validateShape('Run',saved.run);return saved;}
  async function allocation(){const row=await life.run(()=>store.allocations.read({binding:b,allocationKey:issuanceKey},life.check));life.check();return row?.record??null;}
  function issued(raw,intent,requireFacts=false){const s=own(raw,['state'],['issuance']);if(!['ABSENT','UNKNOWN','ISSUED'].includes(s.state))fail('ISSUANCE_REFUSED');if(s.state==='UNKNOWN')fail('ISSUANCE_UNKNOWN');
   if(s.state!=='ISSUED'){if(s.issuance!==undefined)fail('ISSUANCE_REFUSED');return null;}
   const r=data(s.issuance);if(!same(Object.fromEntries(Object.keys(intent).map(k=>[k,r[k]])),intent)||!digest(r.capabilitySha256)||(requireFacts||r.factsSha256!==undefined)&&!digest(r.factsSha256))fail('ISSUANCE_REFUSED');return r;}
  function matchAllocated(record,receipt,entry){
   if(!record)return;
   if(!receipt||!digest(receipt.factsSha256)||!same(record.original?.binding,b)||record.original.expiresAtMs!==expiresAtMs||record.original.executionKey!==issuanceKey||!Array.isArray(record.grantIntents)||!record.grantIntents.some(g=>g.grantId===receipt.grantId&&g.capabilitySha256===receipt.capabilitySha256&&g.expiresAtMs===expiresAtMs)||['FORECLOSED','RETIRED'].includes(record.state))fail('STATIC_ORIGINAL_UNAVAILABLE');
   if(entry&&(!same(record.original,entry.original)||!same(record.grantIntents,entry.grantIntents)||record.allocationSha256!==entry.allocationSha256||record.taskRequestSha256!==entry.taskRequestSha256))fail('ALLOCATION_MISMATCH');
  }
  try{
   const saved=await accepted(),intent=data({binding:b,requestSha256:hash(saved.request),expiresAtMs,issuanceKey});
   const before=await allocation(),prior=issued(await life.run(signal=>issuer.read({...intent,signal})),intent);life.check();
   // An allocated static original must be refused BEFORE any canonical issuer/material call can mint replacement authority.
   matchAllocated(before,prior);
   const entry=data(await life.run(signal=>runIssuance.prepare({binding:b,requestSha256:intent.requestSha256,expiresAtMs,signal})));life.check();
   const receipt=issued({state:'ISSUED',issuance:entry.issuance},intent,true);if(entry.factsSha256!==receipt.factsSha256||!same(entry.original?.binding,b)||entry.original.expiresAtMs!==expiresAtMs)fail('ISSUANCE_REFUSED');
   const current=await accepted();if(!same(current.request,saved.request)||!same(current.run.scopes,saved.run.scopes)||current.run.policyRevision!==saved.run.policyRevision||!same(current.run.versions,saved.run.versions))fail('ACCEPTED_REQUEST_CHANGED');
   matchAllocated(await allocation(),receipt,entry);life.check();return entry;
  }finally{life.close();}
 };
}
