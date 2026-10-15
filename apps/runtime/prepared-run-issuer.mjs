/** Durable per-run issuer (S1): the issuer port consumed by prepared-run-issuance.mjs, over an explicit durable store port and the
 * approved capability-material authority port. `issue` claims the exact key durably before asking the authority to generate; a
 * replay returns the issued identity and never generates a replacement; a claim whose completion was lost reads UNKNOWN until the
 * authority's own reconciliation answers; `resolve` retrieves existing material by reference and fails closed on absent, expired,
 * revoked or unknown. The raw material is never stored here, never logged and never part of a receipt. */
import {own,data,nativeSignal} from '../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash} from '../../packages/contracts/validate.mjs';
import {createOperationLifetime} from '../../packages/runtime/operation-lifetime.mjs';
import {storageMethod} from '../artifacts/storage/boundary.mjs';
import {capabilityDigest,matchesCapability} from './native-authority/task-verifier.mjs';
const fail=code=>{throw Object.assign(Error('PREPARED_RUN_ISSUER_'+code),{code:'PREPARED_RUN_ISSUER_'+code});};
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u.test(v);
function intentOf(value){if(!value||typeof value!=='object')fail('REFUSED');const v=data({issuanceKey:value.issuanceKey,binding:value.binding,requestSha256:value.requestSha256,expiresAtMs:value.expiresAtMs});
 if(typeof v.issuanceKey!=='string'||!v.binding||typeof v.binding!=='object'||v.issuanceKey!==hash(v.binding)||typeof v.requestSha256!=='string'||!/^[a-f0-9]{64}$/u.test(v.requestSha256)||!Number.isSafeInteger(v.expiresAtMs))fail('REFUSED');return v;}
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const issuanceOf=r=>({issuanceKey:r.issuanceKey,binding:r.binding,requestSha256:r.requestSha256,expiresAtMs:r.expiresAtMs,grantId:r.grantId,capabilitySha256:r.capabilitySha256,...(r.factsSha256!==undefined?{factsSha256:r.factsSha256}:{})});
export function createPreparedRunIssuer({store,authority,now=Date.now,maxRequestMs=3000}){
 const claim=storageMethod(store,'claim'),read=storageMethod(store,'read'),complete=storageMethod(store,'complete'),bind=storageMethod(store,'bindFacts'),materialRef=storageMethod(store,'materialRef');
 const generate=storageMethod(authority,'generate'),retrieve=storageMethod(authority,'retrieve'),status=storageMethod(authority,'status');
 if(typeof now!=='function'||!Number.isSafeInteger(maxRequestMs)||maxRequestMs<1||maxRequestMs>30000)fail('CONFIGURATION');
 const life=(signal,expiresAtMs)=>createOperationLifetime({now,signal,deadlineMs:Math.min(expiresAtMs,now()+maxRequestMs),errorFactory:()=>Object.assign(Error('PREPARED_RUN_ISSUER_UNKNOWN'),{code:'PREPARED_RUN_ISSUER_UNKNOWN'})});
 const stateOf=row=>!row?{state:'ABSENT'}:row.state==='ISSUED'?{state:'ISSUED',issuance:issuanceOf(row)}:{state:'UNKNOWN'};
 async function readState(value){const i=intentOf(value);nativeSignal(value.signal);const l=life(value.signal,i.expiresAtMs);try{const row=await l.run(()=>read({issuanceKey:i.issuanceKey}));l.check();if(row&&hash({binding:row.binding,requestSha256:row.requestSha256,expiresAtMs:row.expiresAtMs})!==hash({binding:i.binding,requestSha256:i.requestSha256,expiresAtMs:i.expiresAtMs}))fail('INTENT_CONFLICT');return stateOf(row);}finally{l.close();}}
 /** Claim durably, then generate once through the authority, then complete; any failure between claim and completion leaves the
  * durable CLAIMED row, which reads UNKNOWN until `reconcile` asks the authority whether material exists for the key. */
 async function issue(value){const i=intentOf(value);nativeSignal(value.signal);if(i.expiresAtMs<=now())fail('EXPIRED');const deadlineMs=Math.min(i.expiresAtMs,now()+maxRequestMs),l=life(value.signal,i.expiresAtMs);
  try{const row=await l.run(()=>claim(i));l.check();if(row.state==='ISSUED')return stateOf(row);
   if(row.fresh!==true){
    // Another caller holds the durable claim: wait for its completion within the lifetime; a claim that never completes is UNKNOWN, never regenerated.
    for(;;){l.check();const current=await l.run(()=>read({issuanceKey:i.issuanceKey}));if(current?.state==='ISSUED')return stateOf(current);if(now()+10>=deadlineMs)fail('UNKNOWN');await l.run(()=>sleep(10));}
   }
   const material=data(own(await l.run(signal=>generate({issuanceKey:i.issuanceKey,binding:i.binding,expiresAtMs:i.expiresAtMs,signal})),['grantId','capability','materialRef']));l.check();
   if(!uuid(material.grantId)||typeof material.capability!=='string'||!material.capability||typeof material.materialRef!=='string'||!material.materialRef)fail('AUTHORITY_REFUSED');
   const done=await l.run(()=>complete({issuanceKey:i.issuanceKey,grantId:material.grantId,capabilitySha256:capabilityDigest(material.capability),materialRef:material.materialRef}));l.check();return stateOf(done);}
  catch(error){if(typeof error?.code==='string'&&error.code.startsWith('PREPARED_RUN_ISSUER_'))throw error;if(error?.code==='ISSUANCE_STORE_INTENT_CONFLICT')fail('INTENT_CONFLICT');fail('UNKNOWN');}finally{l.close();}}
 async function bindFacts(value){const {signal,...rest}=own(value,['issuanceKey','binding','requestSha256','expiresAtMs','capabilitySha256','grantId','factsSha256'],['signal']);nativeSignal(signal);const v=data(rest),i=intentOf(v);const l=life(signal,i.expiresAtMs);
  try{const current=await l.run(()=>read({issuanceKey:i.issuanceKey}));l.check();if(!current||current.state!=='ISSUED'||current.grantId!==v.grantId||current.capabilitySha256!==v.capabilitySha256)fail('REFUSED');
   const row=await l.run(()=>bind({issuanceKey:i.issuanceKey,factsSha256:v.factsSha256}));l.check();return issuanceOf(row);}
  catch(error){if(typeof error?.code==='string'&&error.code.startsWith('PREPARED_RUN_ISSUER_'))throw error;if(error?.code==='ISSUANCE_STORE_FACTS_CONFLICT')fail('FACTS_CONFLICT');fail('UNKNOWN');}finally{l.close();}}
 /** Retrieve the existing opaque material by reference; the authority answers ABSENT, EXPIRED, REVOKED or UNKNOWN and the issuer never regenerates. */
 async function resolve(value){const {signal,...rest}=own(value,['issuanceKey','binding','requestSha256','expiresAtMs','grantId','capabilitySha256'],['factsSha256','signal']);nativeSignal(signal);const v=data(rest),i=intentOf(v);if(i.expiresAtMs<=now())fail('EXPIRED');const l=life(signal,i.expiresAtMs);
  try{const current=await l.run(()=>read({issuanceKey:i.issuanceKey}));l.check();if(!current||current.state!=='ISSUED'||current.grantId!==v.grantId||current.capabilitySha256!==v.capabilitySha256)fail('REFUSED');
   const ref=await l.run(()=>materialRef({issuanceKey:i.issuanceKey}));const answer=data(own(await l.run(signal=>retrieve({materialRef:ref,grantId:v.grantId,signal})),['state'],['capability']));l.check();
   if(answer.state!=='PRESENT'||typeof answer.capability!=='string'||!matchesCapability(answer.capability,v.capabilitySha256))fail(answer.state==='REVOKED'?'REVOKED':answer.state==='EXPIRED'?'EXPIRED':answer.state==='ABSENT'?'ABSENT':'UNKNOWN');return answer.capability;}
  catch(error){if(typeof error?.code==='string'&&error.code.startsWith('PREPARED_RUN_ISSUER_'))throw error;fail('UNKNOWN');}finally{l.close();}}
 /** After a crash between claim and completion: ask the authority whether material exists for the key; complete or stay UNKNOWN. Never generates. */
 async function reconcile(value){const i=intentOf(value);nativeSignal(value.signal);const l=life(value.signal,i.expiresAtMs);
  try{const row=await l.run(()=>read({issuanceKey:i.issuanceKey}));l.check();if(!row)return {state:'ABSENT'};if(row.state==='ISSUED')return stateOf(row);
   const s=data(own(await l.run(signal=>status({issuanceKey:i.issuanceKey,signal})),['state'],['grantId','capabilitySha256','materialRef']));l.check();
   if(s.state!=='PRESENT')return {state:'UNKNOWN'};const done=await l.run(()=>complete({issuanceKey:i.issuanceKey,grantId:s.grantId,capabilitySha256:s.capabilitySha256,materialRef:s.materialRef}));l.check();return stateOf(done);}
  catch(error){if(typeof error?.code==='string'&&error.code.startsWith('PREPARED_RUN_ISSUER_'))throw error;return {state:'UNKNOWN'};}finally{l.close();}}
 return Object.freeze({read:readState,issue,bindFacts,resolve,reconcile});
}
