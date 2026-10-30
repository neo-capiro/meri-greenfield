/** Control-side canonical run facts for one allocated browser host. It is the producer behind the
 * /meri/host/facts/v1 answer: the same acknowledged transaction that the host peer resubmits to, the
 * same canonical currentness read, and the saved site-workflow selection resolved through the existing
 * admission owner. It returns PLAIN DATA only - never a port, function or credential - so the host can
 * compose cwd/installation/egress/observers locally without ever receiving Control authority. */
import {transact} from '../control/product-persistence/transaction.mjs';
import {assertBrowserHostFacts,BROWSER_HOST_FACTS_SCHEMA} from '../../packages/contracts/runtime-0.2/browser-host-facts.mjs';
const fail=code=>{throw Object.assign(new Error(code),{code});};
/** `siteWorkflowAdmission` is the existing Core-backed admission port; absent, no workflow selection is
 * claimed. A selection that Core reports as not enabled is never turned into facts. */
export function createBrowserHostRunFacts({pool,currentness,siteWorkflowAdmission=null,runTransaction=transact,now=Date.now,maxRequestMs=3000}={}){
 if(!pool||typeof pool.connect!=='function'||typeof currentness?.readHost!=='function'||typeof runTransaction!=='function'||
  typeof now!=='function'||!Number.isSafeInteger(maxRequestMs)||maxRequestMs<1||maxRequestMs>30000)fail('BROWSER_HOST_FACTS_REFUSED');
 if(siteWorkflowAdmission!==null&&typeof siteWorkflowAdmission?.resolve!=='function')fail('BROWSER_HOST_FACTS_REFUSED');
 async function selection({binding,signal}){
  if(siteWorkflowAdmission===null)return null;
  const value=await siteWorkflowAdmission.resolve({binding,signal});
  if(value===null||value===undefined)return null;
  if(value.enabled!==true)return null;
  return Object.freeze({manifest:value.manifest,manifestSha256:value.manifestSha256,enabled:true});
 }
 return Object.freeze({async readCanonicalFacts({allocation,binding,custody=null,signal}={}){
  if(!allocation||typeof allocation!=='object'||!binding||typeof binding!=='object')fail('BROWSER_HOST_FACTS_REFUSED');
  signal?.throwIfAborted();
  // The saved selection is a Core read; it is resolved before the transaction so no Core call is made
  // while the canonical run lock is held.
  const siteWorkflow=await selection({binding,signal});signal?.throwIfAborted();
  const state=await runTransaction(pool,async client=>currentness.readHost(client,{allocation,binding,custody,signal}),
   {check:()=>signal?.throwIfAborted(),unavailable:'BROWSER_HOST_FACTS_REFUSED',uncertain:'BROWSER_HOST_FACTS_UNKNOWN'});
  if(state?.phase!=='active'||state.browserAdmitted!==true)fail('BROWSER_HOST_FACTS_REFUSED');
  const deadlineMs=Number.isSafeInteger(state.deadlineMs)?state.deadlineMs:state.currentUntilMs;
  return assertBrowserHostFacts({schema:BROWSER_HOST_FACTS_SCHEMA,binding,scopes:state.scopes,deadlineMs,
   currentUntilMs:Math.min(state.currentUntilMs,deadlineMs),phase:'active',
   admitted:{sdk:state.sdkAdmitted,bash:state.bashAdmitted,browser:state.browserAdmitted},
   capabilityPolicy:state.capabilityPolicy,browserPolicy:state.browserPolicy,
   ...(siteWorkflow?{siteWorkflow}:{})},{binding});
 }});
}
