/** Durable browser-download capacity over the EXISTING intent journal (meri_intents.preparations).
 * The journal store owns the transaction, count+claim serialization and the exact delivery identity; this module
 * only validates the run/policy inputs and maps states to the closed outcomes the worker uses. No new table,
 * ledger, state or pool: a claim is PENDING until the effect is prepared (PREPARED) or proven refused (FAILED),
 * and PREPARED/UNKNOWN rows keep consuming capacity.
 */
import {own,data,nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {validateShape} from '../../../packages/contracts/validate.mjs';
const fail=code=>{throw Object.assign(new Error(code),{code});};
export function createBrowserDownloadReservations({store}={}){
 if(typeof store?.claimDownload!=='function'||typeof store?.readDownload!=='function'||
  typeof store?.settleDownload!=='function')fail('BROWSER_DOWNLOAD_CAPACITY_CONFIGURATION');
 return Object.freeze({
  /** Claim one original run+filename attempt. `admitted` is the only value that permits an artifact effect. */
  async begin({binding,filename,sha256,maxFiles,signal}){
   const b=data(binding);validateShape('RunBinding',b);nativeSignal(signal);
   const r=data(await store.claimDownload({binding:b,filename,sha256,maxFiles,signal}));
   if(r.limit===true)return Object.freeze({admitted:false,limit:true,count:r.count});
   if(r.claimed===true)return Object.freeze({admitted:true,replayed:false,entry:r.entry});
   if(r.refused===true)return Object.freeze({admitted:false,refused:true,entry:r.entry});
   const state=r.entry?.state;
   if(state==='PREPARED'||state==='PENDING'||state==='UNKNOWN')
    return Object.freeze({admitted:true,replayed:true,state,entry:r.entry});
   fail('BROWSER_DOWNLOAD_CAPACITY_STATE');
  },
  /** Read the one durable attempt of this run+filename, or null. Never claims. */
  async read({binding,filename,signal}){
   const b=data(binding);validateShape('RunBinding',b);nativeSignal(signal);
   return store.readDownload({binding:b,filename,signal});
  },
  /** Accepted effect: PENDING -> PREPARED with the recorded custody, so the slot stays counted. */
  async prepared({binding,filename,sha256,result,release,signal}){
   const b=data(binding);validateShape('RunBinding',b);
   return store.settleDownload({binding:b,filename,sha256,state:'PREPARED',
    outcome:{result,release},signal});
  },
  /** Proven PRE-EFFECT refusal only: PENDING -> FAILED, releasing capacity while retaining the fence. */
  async refused({binding,filename,sha256,code='REFUSED',signal}){
   const b=data(binding);validateShape('RunBinding',b);
   return store.settleDownload({binding:b,filename,sha256,state:'FAILED',outcome:{code},signal});
  },
 });
}
