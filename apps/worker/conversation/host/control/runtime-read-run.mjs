/** Host-local readRun join: the canonical configuration the browser operation host needs, derived from
 * a LIVE host-currentness facts read on the SAME pinned physical host.
 *
 * Everything here is trusted host-local: the caller passes the already-constructed
 * createHostCurrentnessClient, the already-constructed createBrowserHostRuntimePort, and the pinned
 * allocation/full binding/cwd for THIS conversation. None of it is taken from a wire message, a tool
 * call or a model answer, and no transport, DTO or policy logic is copied — the client and port own it.
 *
 * Lifetime: every retained closure takes the SIGNAL OF ITS OWN CALLBACK. The readRun/prepare operation's
 * signal closes as soon as preparation returns, so it must never be captured as the lifetime of later
 * approvals, receipts or workflow reads.
 */
import {canonicalSha256,validateShape} from '../../../../../packages/contracts/validate.mjs';
import {data,own} from '../../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {nativeSignal} from '../../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {assertHostAllocation} from '../binding.mjs';
import {assertBrowserHostFacts} from '../../../../../packages/contracts/runtime-0.2/browser-host-facts.mjs';

const refuse=code=>{throw Object.assign(Error(code),{code});};
const REFUSED='BROWSER_HOST_READ_RUN_REFUSED';
const posix=await import('node:path').then(m=>m.posix);

export function createBrowserHostReadRun(raw){
 let allocation,binding,cwd,client,port;
 try{
  // The trusted ports are live objects, not inert data: only their presence is taken here.
  const v=own(raw,['allocation','binding','cwd','client','port']);
  allocation=assertHostAllocation(v.allocation);
  binding=data(v.binding);validateShape('RunBinding',binding);
  if(typeof v.cwd!=='string'||!posix.isAbsolute(v.cwd)||posix.resolve(v.cwd)!==v.cwd||
   v.cwd.includes('\0')||!v.cwd.endsWith('/'+binding.conversationId))refuse(REFUSED);
  cwd=v.cwd;
  client=v.client;port=v.port;
  if(!client||typeof client.readFacts!=='function'||typeof client.resolveBrowserWorkflow!=='function'||
   !port||typeof port!=='object'||!port.approvals||typeof port.approvals.decide!=='function'||
   !port.receipts||typeof port.receipts.record!=='function'||!port.artifacts||
   typeof port.artifacts.ingest!=='function')refuse(REFUSED);
  if(allocation.tenantId!==binding.tenantId||allocation.conversationId!==binding.conversationId)refuse(REFUSED);
 }catch(error){throw Object.assign(Error(REFUSED),{code:REFUSED,cause:error});}
 const pinnedSha=canonicalSha256(binding);
 // Exclusive binding: an identical full binding only; a successor of the same conversation is refused.
 const assertBinding=value=>{
  let candidate;try{candidate=data(value);validateShape('RunBinding',candidate);}catch{refuse(REFUSED);}
  if(canonicalSha256(candidate)!==pinnedSha)refuse(REFUSED);
  return candidate;
 };
 const signalOf=signal=>{nativeSignal(signal);if(signal?.aborted)refuse(REFUSED);return signal;};
 /** Canonical workflow resolution for the trusted prepareCurrentSiteWorkflow owner. The answered
  * payload is unwrapped to exactly {manifest, manifestSha256, enabled}; the client already validated
  * the manifest against a fresh canonical policy maximum and its recomputed digest. */
 const siteWorkflows=Object.freeze({
  async resolve({binding:requested,signal}={}){
   assertBinding(requested);signalOf(signal);
   const answer=await client.resolveBrowserWorkflow({binding:data(binding),signal});
   const workflow=answer?.workflow;
   if(!workflow)refuse(REFUSED);
   return Object.freeze({manifest:workflow.manifest,manifestSha256:workflow.manifestSha256,
    enabled:workflow.enabled});
  }});
 /** The canonical readRun the existing operation host expects. `deadlineMs` is the ORIGINAL run
  * deadline from the facts document, never the rolling currentness cutoff. */
 async function readRun({binding:requested,signal}={}){
  assertBinding(requested);signalOf(signal);
  const answer=await client.readFacts({allocation:data(allocation),binding:data(binding),signal});
  const facts=assertBrowserHostFacts(answer?.facts,{binding});
  if(canonicalSha256(facts.binding)!==pinnedSha)refuse(REFUSED);
  return Object.freeze({
   binding:data(facts.binding),cwd,deadlineMs:facts.deadlineMs,port,
   ...(facts.siteWorkflow===undefined?{}:{siteWorkflow:facts.siteWorkflow}),
   siteWorkflows,
   ...(facts.browserHandoff===undefined?{}:{browserHandoff:facts.browserHandoff})});
 }
 return Object.freeze({readRun,siteWorkflows,binding:data(binding)});
}
