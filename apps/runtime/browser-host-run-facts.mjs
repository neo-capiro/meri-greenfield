/** Control-side canonical run facts for one allocated browser host. It is the producer behind the
 * /meri/host/facts/v1 answer: the same acknowledged transaction that the host peer resubmits to, the
 * same canonical currentness read, and the saved site-workflow selection resolved through the existing
 * admission owner. It returns PLAIN DATA only - never a port, function or credential - so the host can
 * compose cwd/installation/egress/observers locally without ever receiving Control authority. */
import {canonicalSha256} from '../../packages/contracts/validate.mjs';
import {data} from '../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {assertCapabilityPolicy} from '../worker/conversation/capabilities/policy.mjs';
import {validateBrowserPolicy} from '../worker/conversation/browser/policy.mjs';
import {assertSiteWorkflowSelection} from '../../packages/contracts/site-workflow-selection.mjs';
import {assertBrowserHostFacts,BROWSER_HOST_FACTS_SCHEMA} from '../../packages/contracts/runtime-0.2/browser-host-facts.mjs';
const fail=code=>{throw Object.assign(new Error(code),{code});};
const same=(a,b)=>{try{return JSON.stringify(a)===JSON.stringify(b);}catch{return false;}};
/** Canonical facts for the protected nonce transaction: it consumes the CALLER'S client, so the same
 * acknowledged transaction that authenticated the peer and consumed the nonce also owns this read.
 * Selection comes from the canonical saved request inside that read (never a second store.read before
 * authentication), scopes come from the same execution read, and the policy VALUES are validated with
 * the shared app validators before the wire digests are computed. */
export function createBrowserHostRunFacts({currentness}={}){
 if(typeof currentness?.readFacts!=='function')fail('BROWSER_HOST_FACTS_REFUSED');
 return Object.freeze({async readCanonicalFacts(client,{allocation,binding,custody=null,signal}={}){
  if(!client||typeof client.query!=='function'||!allocation||typeof allocation!=='object'||!binding||typeof binding!=='object')fail('BROWSER_HOST_FACTS_REFUSED');
  signal?.throwIfAborted();
  const state=await currentness.readFacts(client,{allocation,binding,custody,signal});
  if(state?.phase!=='active'||state.browserAdmitted!==true||!Number.isSafeInteger(state.deadlineMs))fail('BROWSER_HOST_FACTS_REFUSED');
  // A later binding is a takeover successor; its selection is not the original's, and this path has no
  // canonical successor selection source yet, so it refuses instead of silently reusing the original.
  if(state.originalBinding!==undefined&&!same(state.originalBinding,binding))fail('BROWSER_HOST_FACTS_REFUSED');
  const capabilityPolicy=assertCapabilityPolicy(data(state.capabilityPolicy??{}));
  const browserPolicy=validateBrowserPolicy(data(state.browserPolicy??{}));
  const saved=state.savedRequest??null;
  const siteWorkflow=saved?.siteWorkflow===undefined||saved===null?undefined:assertSiteWorkflowSelection(saved.siteWorkflow);
  return assertBrowserHostFacts({schema:BROWSER_HOST_FACTS_SCHEMA,binding,scopes:state.scopes,deadlineMs:state.deadlineMs,
   currentUntilMs:Math.min(state.currentUntilMs,state.deadlineMs),phase:'active',
   admitted:{sdk:state.sdkAdmitted,bash:state.bashAdmitted,browser:state.browserAdmitted},
   capabilityPolicy,capabilityPolicySha256:canonicalSha256(capabilityPolicy),
   browserPolicy,browserPolicySha256:canonicalSha256(browserPolicy),
   ...(siteWorkflow===undefined?{}:{siteWorkflow})},{binding});
 }});
}
/** The live `siteWorkflows.resolve({binding,signal})` port: selectedClientId comes from the SAVED
 * canonical scopes (a RunBinding has no scopes), then the existing conversation service re-reads the
 * saved selection, current scopes/versions and rechecks SESSION_CHANGED on every call. */
export function createBrowserHostSiteWorkflowPort({store,service,nativeCredentials}={}){
 if(typeof store?.read!=='function'||typeof service?.siteWorkflowResolve!=='function'||
  typeof nativeCredentials?.nativeCredentialFor!=='function')fail('BROWSER_HOST_SITE_WORKFLOW_UNAVAILABLE');
 return Object.freeze({async resolve({binding,signal}={}){
  signal?.throwIfAborted();
  const saved=await store.read(binding,{after:0,limit:1},()=>signal?.throwIfAborted());
  if(!same(saved?.run?.binding,binding))fail('BROWSER_HOST_SITE_WORKFLOW_UNAVAILABLE');
  const scopes=saved.run.scopes,selectedClientId=scopes.length===1&&scopes[0].kind==='client'?scopes[0].resourceId:null;
  const credential=await nativeCredentials.nativeCredentialFor({binding,selectedClientId,signal});
  if(typeof credential?.credential!=='string'||!credential.credential)fail('BROWSER_HOST_SITE_WORKFLOW_UNAVAILABLE');
  return service.siteWorkflowResolve({credential:credential.credential,binding,signal});
 }});
}
