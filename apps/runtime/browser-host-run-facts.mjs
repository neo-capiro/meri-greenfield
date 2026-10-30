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
  if(!state||!Number.isSafeInteger(state.deadlineMs)||!Number.isSafeInteger(state.currentUntilMs)||state.browserAdmitted!==true)fail('BROWSER_HOST_FACTS_REFUSED');
  const saved=state.savedRequest??null;
  const sameBinding=state.originalBinding===undefined||same(state.originalBinding,binding);
  // A later binding is the canonical takeover successor: it keeps browser custody but must not inherit the
  // original run's saved selection, so no siteWorkflow is claimed for it.
  const siteWorkflow=saved?.siteWorkflow===undefined||saved===null||!sameBinding?undefined:assertSiteWorkflowSelection(saved.siteWorkflow);
  const common={schema:BROWSER_HOST_FACTS_SCHEMA,binding,scopes:state.scopes,deadlineMs:state.deadlineMs,
   currentUntilMs:Math.min(state.currentUntilMs,state.deadlineMs),...(siteWorkflow===undefined?{}:{siteWorkflow})};
  if(state.phase!=='active'){
   // Held/successor: the browser operation host may still act under custody, but SDK and Bash are denied
   // and there is no fresh policy snapshot to report.
   if(state.sdkAdmitted!==false||state.bashAdmitted!==false)fail('BROWSER_HOST_FACTS_REFUSED');
   return assertBrowserHostFacts({...common,phase:state.phase,admitted:{sdk:false,bash:false,browser:true},
    ...(state.browserCustody===undefined?{}:{browserCustody:state.browserCustody}),
    ...(state.browserHandoff===undefined?{}:{browserHandoff:state.browserHandoff})},{binding});
  }
  if(!sameBinding)fail('BROWSER_HOST_FACTS_REFUSED');
  const capabilityPolicy=assertCapabilityPolicy(data(state.capabilityPolicy??{}));
  const browserPolicy=validateBrowserPolicy(data(state.browserPolicy??{}));
  return assertBrowserHostFacts({...common,phase:'active',admitted:{sdk:true,bash:state.bashAdmitted,browser:true},
   capabilityPolicy,capabilityPolicySha256:canonicalSha256(capabilityPolicy),
   browserPolicy,browserPolicySha256:canonicalSha256(browserPolicy),
   ...(state.browserHandoff===undefined?{}:{browserHandoff:state.browserHandoff})},{binding});
 }});
}
/** The live `siteWorkflows.resolve({binding,signal})` port.
 *
 * `service.siteWorkflowResolve` authenticates an ACTION-SESSION credential (conversations/service.mjs
 * `operation()` -> sessions.authenticateSession). `nativeCredentialFor` returns a Core-native identity
 * credential and is the wrong class, so it must never be passed to that service. The port therefore
 * requires an action-session issuer for the exact run and refuses without one; selectedClientId comes
 * from the SAVED canonical scopes because a RunBinding carries none. */
export function createBrowserHostSiteWorkflowPort({store,admission}={}){
 if(typeof store?.read!=='function'||typeof admission?.resolve!=='function')fail('BROWSER_HOST_SITE_WORKFLOW_UNAVAILABLE');
 return Object.freeze({async resolve({binding,signal}={}){
  signal?.throwIfAborted();
  // The exact saved selection/scopes/versions come from the canonical run row; the Core admission owner
  // obtains the native credential itself and performs the fixed Core read with digest/selection checks.
  const saved=await store.read(binding,{after:0,limit:1},()=>signal?.throwIfAborted());
  if(!same(saved?.run?.binding,binding))fail('BROWSER_HOST_SITE_WORKFLOW_UNAVAILABLE');
  if(saved.request?.siteWorkflow===undefined)fail('BROWSER_HOST_SITE_WORKFLOW_UNAVAILABLE');
  const selection=assertSiteWorkflowSelection(saved.request.siteWorkflow);
  const resolved=await admission.resolve({binding,selection,scopes:saved.run.scopes,versions:saved.run.versions,signal});
  // SESSION_CHANGED parity with the existing service: the canonical row must be unchanged afterwards.
  const latest=await store.read(binding,{after:0,limit:1},()=>signal?.throwIfAborted());
  if(!same(latest?.run?.binding,binding)||!same(latest?.request,saved.request)||!same(latest?.run?.scopes,saved.run.scopes))fail('BROWSER_HOST_SITE_WORKFLOW_UNAVAILABLE');
  return resolved;
 }});
}
