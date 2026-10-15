/** Durable issuance store port for the per-run issuer (S1). Contract: `claim` is linearizable on the issuance key and returns the
 * existing row for a replay; `complete` moves a claimed key to ISSUED with the capability digest and the opaque material reference
 * exactly once; `bindFacts` is an immutable compare-or-set; `read` never answers ABSENT for a key that was ever claimed; `materialRef`
 * returns the reference only for an ISSUED row. A claimed key whose completion was lost reads UNKNOWN until reconciled. The product
 * adapter needs its own centrally allocated schema (requested, not taken); this module holds the contract and the disposable
 * in-process adapter that proves it, including simulated crashes at each boundary. */
import {own,data} from '../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash} from '../../packages/contracts/validate.mjs';
const fail=code=>{throw Object.assign(Error('ISSUANCE_STORE_'+code),{code:'ISSUANCE_STORE_'+code});};
export const rowStates=Object.freeze(['CLAIMED','ISSUED']);
export function createMemoryIssuanceStore({crashAt=null}={}){
 const rows=new Map(),crash={at:crashAt};const boundary=name=>{if(crash.at===name){crash.at=null;throw Object.assign(Error('SYNTHETIC_CRASH_'+name),{code:'SYNTHETIC_CRASH'});}};
 return Object.freeze({
  crash,
  async read({issuanceKey}){const r=rows.get(issuanceKey);return r?structuredClone(r):null;},
  async claim(intent){const i=data(own(intent,['issuanceKey','binding','requestSha256','expiresAtMs']));boundary('before-claim');const r=rows.get(i.issuanceKey);if(r){if(hash({binding:r.binding,requestSha256:r.requestSha256,expiresAtMs:r.expiresAtMs})!==hash({binding:i.binding,requestSha256:i.requestSha256,expiresAtMs:i.expiresAtMs}))fail('INTENT_CONFLICT');return structuredClone(r);}
   const row={state:'CLAIMED',...i,claimedAt:Date.now()};rows.set(i.issuanceKey,row);boundary('after-claim');return {...structuredClone(row),fresh:true};},
  async complete({issuanceKey,grantId,capabilitySha256,materialRef}){const r=rows.get(issuanceKey);if(!r)fail('NOT_CLAIMED');if(r.state==='ISSUED'){if(r.capabilitySha256!==capabilitySha256||r.grantId!==grantId)fail('ISSUED_CONFLICT');return structuredClone(r);}
   boundary('before-complete');Object.assign(r,{state:'ISSUED',grantId,capabilitySha256,materialRef});boundary('after-complete');return structuredClone(r);},
  async bindFacts({issuanceKey,factsSha256}){const r=rows.get(issuanceKey);if(!r||r.state!=='ISSUED')fail('NOT_ISSUED');if(r.factsSha256!==undefined&&r.factsSha256!==factsSha256)fail('FACTS_CONFLICT');boundary('before-bind');r.factsSha256=factsSha256;boundary('after-bind');return structuredClone(r);},
  async materialRef({issuanceKey}){const r=rows.get(issuanceKey);if(!r||r.state!=='ISSUED')fail('NOT_ISSUED');return r.materialRef;},
  snapshot(){return new Map([...rows].map(([k,v])=>[k,structuredClone(v)]));},
  size(){return rows.size;}
 });
}
