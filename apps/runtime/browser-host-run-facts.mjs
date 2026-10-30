/** Control-side canonical run facts for one allocated browser host. It is the producer behind the
 * /meri/host/facts/v1 answer: the same acknowledged transaction that the host peer resubmits to, the
 * same canonical currentness read, and the saved site-workflow selection resolved through the existing
 * admission owner. It returns PLAIN DATA only - never a port, function or credential - so the host can
 * compose cwd/installation/egress/observers locally without ever receiving Control authority. */
import {transact} from '../control/product-persistence/transaction.mjs';
import {assertSiteWorkflowSelection} from '../../packages/contracts/site-workflow-selection.mjs';
import {assertBrowserHostFacts,BROWSER_HOST_FACTS_SCHEMA} from '../../packages/contracts/runtime-0.2/browser-host-facts.mjs';
const fail=code=>{throw Object.assign(new Error(code),{code});};
const same=(a,b)=>{try{return JSON.stringify(a)===JSON.stringify(b);}catch{return false;}};
/** The canonical saved SiteWorkflowSelection for an exact binding, read through the conversation store's
 * own reader and validated by the shared contract. It is saved state, not a resolved manifest. */
export function createBrowserHostSavedSelection({store}={}){
 if(!store||typeof store.read!=='function')fail('BROWSER_HOST_FACTS_REFUSED');
 return Object.freeze({async readSavedSelection({binding,signal}={}){
  signal?.throwIfAborted();
  const saved=await store.read(binding,{after:0,limit:1},()=>signal?.throwIfAborted());
  if(!same(saved?.run?.binding,binding))fail('BROWSER_HOST_FACTS_REFUSED');
  if(saved.request?.siteWorkflow===undefined)return null;
  return Object.freeze({selection:assertSiteWorkflowSelection(saved.request.siteWorkflow),scopes:saved.run.scopes,versions:saved.run.versions});
 }});
}
/** Canonical facts on the CALLER'S transaction client: the identical currentness checks, no transaction
 * of its own, no copied authority. The execution deadline is required - a missing deadline is a source
 * gap, never silently replaced by the currentness cutoff. */
export function createBrowserHostRunFacts({currentness}={}){
 if(typeof currentness?.readFacts!=='function')fail('BROWSER_HOST_FACTS_REFUSED');
 return Object.freeze({async readCanonicalFacts(client,{allocation,binding,custody=null,selection=null,signal}={}){
  if(!client||typeof client.query!=='function'||!allocation||typeof allocation!=='object'||!binding||typeof binding!=='object')fail('BROWSER_HOST_FACTS_REFUSED');
  signal?.throwIfAborted();
  const state=await currentness.readFacts(client,{allocation,binding,custody,signal});
  if(state?.phase!=='active'||state.browserAdmitted!==true||!Number.isSafeInteger(state.deadlineMs))fail('BROWSER_HOST_FACTS_REFUSED');
  return assertBrowserHostFacts({schema:BROWSER_HOST_FACTS_SCHEMA,binding,scopes:state.scopes,deadlineMs:state.deadlineMs,
   currentUntilMs:Math.min(state.currentUntilMs,state.deadlineMs),phase:'active',
   admitted:{sdk:state.sdkAdmitted,bash:state.bashAdmitted,browser:state.browserAdmitted},
   capabilityPolicy:state.capabilityPolicy,browserPolicy:state.browserPolicy,
   ...(selection?.selection===undefined?{}:{siteWorkflow:selection.selection}),
   ...(state.browserHandoff===undefined?{}:{browserHandoff:state.browserHandoff})},{binding});
 }});
}
/** Whole facts answer for one bound host read: the saved selection is read through its canonical owner
 * first, then the facts transaction runs over the caller's acknowledged client. No nested transaction
 * and no canonical lock held across an unrelated owner call. */
export function createBrowserHostFactAnswer({pool,savedSelection,facts,runTransaction=transact}={}){
 if(!pool||typeof pool.connect!=='function'||typeof savedSelection?.readSavedSelection!=='function'||
  typeof facts?.readCanonicalFacts!=='function'||typeof runTransaction!=='function')fail('BROWSER_HOST_FACTS_REFUSED');
 return Object.freeze({async read({allocation,binding,custody=null,signal}={}){
  const selection=await savedSelection.readSavedSelection({binding,signal});signal?.throwIfAborted();
  return runTransaction(pool,client=>facts.readCanonicalFacts(client,{allocation,binding,custody,selection,signal}),
   {check:()=>signal?.throwIfAborted(),unavailable:'BROWSER_HOST_FACTS_REFUSED',uncertain:'BROWSER_HOST_FACTS_UNKNOWN'});
 }});
}
/** The live `siteWorkflows.resolve({binding,signal})` port: it reaches the existing conversation service,
 * which re-reads the saved selection, current scopes/versions and rechecks SESSION_CHANGED, using a
 * Control-side native credential the host never receives. */
export function createBrowserHostSiteWorkflowPort({service,nativeCredentials}={}){
 if(typeof service?.siteWorkflowResolve!=='function'||typeof nativeCredentials?.nativeCredentialFor!=='function')fail('BROWSER_HOST_SITE_WORKFLOW_UNAVAILABLE');
 return Object.freeze({async resolve({binding,signal}={}){
  signal?.throwIfAborted();
  const scopes=Array.isArray(binding?.scopes)?binding.scopes:undefined;
  const selectedClientId=scopes?.length===1&&scopes[0]?.kind==='client'?scopes[0].resourceId:null;
  const credential=await nativeCredentials.nativeCredentialFor({binding,selectedClientId,signal});
  if(typeof credential?.credential!=='string'||!credential.credential)fail('BROWSER_HOST_SITE_WORKFLOW_UNAVAILABLE');
  return service.siteWorkflowResolve({credential:credential.credential,binding,signal});
 }});
}
