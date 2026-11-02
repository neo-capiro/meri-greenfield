/** Host-owned takeover retirement for a provisioned browser-only host. The SDK of this run lives in the AgentCore
 * runtime, not on this host, so "retire the SDK before the user takes the browser" is observed through Control's
 * canonical facts rather than performed here: Control records the custody the host prepared, the runtime stops the
 * source query, and the facts document for this run leaves the `active` phase with SDK and Bash denied and the same
 * custody attached. `retain` re-reads Control's hold verification for this exact host before the lease is granted. */
import {canonicalSha256} from '../../../packages/contracts/validate.mjs';
import {assertBrowserHostFacts} from '../../../packages/contracts/runtime-0.2/browser-host-facts.mjs';
import {assertBrowserCustody} from '../../../packages/runtime/browser-custody.mjs';
import {assertHostAllocation,assertHostRunBinding} from '../../worker/conversation/host/binding.mjs';

const REFUSED='BROWSER_HOST_RETIREMENT_REFUSED';
const fault=()=>Object.assign(new Error(REFUSED),{code:REFUSED});
const fail=()=>{throw fault();};
const sleep=(ms,signal)=>new Promise((resolve,reject)=>{
 if(signal?.aborted){reject(fault());return;}
 const timer=setTimeout(()=>{signal?.removeEventListener('abort',abort);resolve();},ms);
 const abort=()=>{clearTimeout(timer);reject(fault());};
 signal?.addEventListener('abort',abort,{once:true});
});
const sameCustody=(a,b)=>['controlId','ownerInstanceId','hostId','generation','leaseEpoch'].every(key=>a[key]===b[key])&&canonicalSha256(a.binding)===canonicalSha256(b.binding);

export function createBrowserHostRetirement({allocation,binding,client,now=Date.now,pollMs=250}={}){
 const a=assertHostAllocation(allocation),b=assertHostRunBinding(a,binding);
 if(a.hostMode!=='browser-only'||typeof client?.readFacts!=='function'||typeof client?.holdBrowser!=='function'||
  typeof now!=='function'||!Number.isSafeInteger(pollMs)||pollMs<10||pollMs>5000)fail();
 let prepared=null;
 const ownCustody=custody=>{
  const c=assertBrowserCustody(custody,{binding:b});
  if(c.hostId!==a.hostId||c.generation!==a.generation||c.expiresAtMs<=now())fail();
  return c;
 };
 const facts=async signal=>{
  const answer=await client.readFacts({allocation:structuredClone(a),binding:structuredClone(b),signal});
  return assertBrowserHostFacts(answer?.facts,{binding:b});
 };
 return Object.freeze({
  /** The custody the session host minted is pinned here; nothing is sent, Control learns it through the operation answer. */
  async prepare({custody}={}){
   if(prepared!==null)fail();
   prepared=ownCustody(custody);
   return Object.freeze({prepared:true});
  },
  /** Remote SDK absence: Control's facts leave `active`, deny SDK and Bash and carry this exact custody. */
  async wait({custody,signal}={}){
   const c=ownCustody(custody);
   if(prepared===null||!sameCustody(prepared,c))fail();
   for(;;){
    if(signal?.aborted||now()>=Math.min(c.expiresAtMs,a.leaseDeadlineMs))fail();
    const f=await facts(signal);
    if(f.phase!=='active'&&f.admitted.sdk===false&&f.admitted.bash===false&&f.browserCustody!==undefined&&
     sameCustody(assertBrowserCustody(f.browserCustody,{binding:b}),c))return Object.freeze({retired:true,phase:f.phase});
    await sleep(pollMs,signal);
   }
  },
  /** Control's own hold verification for this host: the applied takeover is still unreturned for this exact custody. */
  async retain({custody,signal}={}){
   const c=ownCustody(custody);
   if(prepared===null||!sameCustody(prepared,c))fail();
   const answer=await client.holdBrowser({binding:structuredClone(b),signal});
   const held=assertBrowserCustody(answer?.custody,{binding:b});
   if(answer?.outcome!=='APPLIED'||!sameCustody(held,c))fail();
   return Object.freeze({retained:true});
  },
 });
}
