/** Host-local readRun join: builds the canonical browser host configuration and its runtime port from
 * a LIVE host-currentness facts read on the SAME pinned physical host, and maps the trusted callbacks
 * onto the real currentness client.
 *
 * Trusted host-local inputs only: the already-constructed createHostCurrentnessClient plus the host's
 * cwd/installation/egress/processes/artifacts. Nothing here comes from a wire message, a tool call or a
 * model answer, and no transport, DTO or policy logic is copied — the client and the runtime port own it.
 *
 * Lifetime: every retained closure uses the SIGNAL OF ITS OWN CALLBACK plus a shared terminal-host check.
 * The readRun/prepare signal closes as soon as preparation returns, so it is never captured as the
 * lifetime of later approvals, receipts or workflow reads.
 */
import {posix} from 'node:path';
import {canonicalSha256,validateShape} from '../../../../../packages/contracts/validate.mjs';
import {data,own,nativeSignal} from '../../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {assertHostAllocation} from '../binding.mjs';
import {assertBrowserHostFacts} from '../../../../../packages/contracts/runtime-0.2/browser-host-facts.mjs';
import {createBrowserHostRuntimePort} from '../browser-runtime-port.mjs';

const REFUSED='BROWSER_HOST_READ_RUN_REFUSED';
const refuse=()=>{throw Object.assign(Error(REFUSED),{code:REFUSED});};

export function createBrowserHostReadRun(raw){
 let allocation,binding,cwd,client,installation,egress,processes,artifacts,approvalDeadlineMs,sessions,terminalSignal;
 try{
  // The trusted owners are live objects, not inert data: only their presence is taken here.
  const v=own(raw,['allocation','binding','cwd','client','installation','egress','processes','artifacts'],
   ['approvalDeadlineMs','sessions','terminalSignal']);
  allocation=assertHostAllocation(v.allocation);
  binding=data(v.binding);validateShape('RunBinding',binding);
  if(typeof v.cwd!=='string'||!posix.isAbsolute(v.cwd)||posix.resolve(v.cwd)!==v.cwd||
   v.cwd.includes('\0')||!v.cwd.endsWith('/'+binding.conversationId))refuse();
  cwd=v.cwd;
  client=v.client;
  if(!client||typeof client.readFacts!=='function'||typeof client.resolveBrowserWorkflow!=='function'||
   typeof client.decideBrowserApproval!=='function'||typeof client.recordBrowserReceipt!=='function'||typeof client.recordBrowserDownloadReceipt!=='function' )refuse();
  installation=v.installation;egress=v.egress;processes=v.processes;artifacts=v.artifacts;
  if(!installation||!egress||!processes||!artifacts||typeof artifacts.ingest!=='function')refuse();
  approvalDeadlineMs=v.approvalDeadlineMs;sessions=v.sessions;
  if(v.terminalSignal!==undefined){nativeSignal(v.terminalSignal);terminalSignal=v.terminalSignal;}
  if(allocation.tenantId!==binding.tenantId||allocation.conversationId!==binding.conversationId)refuse();
 }catch{refuse();}
 const pinnedSha=canonicalSha256(binding);
 // Exclusive binding: an identical full binding only; a successor of the same conversation is refused.
 const assertBinding=value=>{
  let candidate;try{candidate=data(value);validateShape('RunBinding',candidate);}catch{refuse();}
  if(canonicalSha256(candidate)!==pinnedSha)refuse();
  return candidate;
 };
 /** ONE shared lifetime check for every retained callback. The CALLER signal must be live and the
  * terminal host signal must not have fired; when both exist the exchange runs on their combination, so a
  * host shutdown DURING a real exchange aborts it. With no terminal signal the caller's own signal is
  * forwarded unchanged (callers and owners rely on that identity). Nothing captures the prepare signal. */
 const live=signal=>{
  try{nativeSignal(signal);}catch{refuse();}
  if(signal?.aborted||terminalSignal?.aborted===true)refuse();
  return terminalSignal===undefined?signal:AbortSignal.any([signal,terminalSignal].filter(Boolean));
 };
 /** Post-await recheck: a positive answer is never released after the combined lifetime died. */
 const settle=signal=>{
  if(signal?.aborted||terminalSignal?.aborted===true)refuse();
  return signal;
 };
 async function factsAt(signal){
  const answer=await client.readFacts({allocation:data(allocation),binding:data(binding),signal});
  const facts=assertBrowserHostFacts(answer?.facts,{binding});
  if(canonicalSha256(facts.binding)!==pinnedSha)refuse();
  return facts;
 }
 /** Fresh canonical browser policy for this pinned host; a held/no-policy read refuses new work. */
 async function policy({binding:requested,signal}={}){
  assertBinding(requested);const life=live(signal);
  const facts=await factsAt(life);settle(life);
  if(facts.browserPolicy===undefined)refuse(); // active policy only: nothing is cached or invented
  return data(facts.browserPolicy);
 }
 const approvals=Object.freeze({
  /** The original approval request goes through UNCHANGED; only a permitted answer yields its RAW
   * canonical receipt — the exact shape the existing permission gate validates. */
  async decide(originalRequest,options){
   const {signal}=own(options??{},[],['signal']);const life=live(signal);
   const answer=await client.decideBrowserApproval(originalRequest,{signal:life});
   settle(life); // no positive release after the combined lifetime died
   if(!answer||answer.permitted!==true||!answer.receipt)refuse();
   return answer.receipt;
  }});
 const receipts=Object.freeze({
  /** The original receipt goes through unchanged and the actual acknowledged event is returned. */
  async record(originalReceipt,options){
   const {signal}=own(options??{},[],['signal']);const life=live(signal);
   // The canonical download receipt goes to its OWN named route; an action receipt keeps the existing one.
   const ack=originalReceipt?.kind==='browser.download'
    ? await client.recordBrowserDownloadReceipt(originalReceipt,{signal:life})
    : await client.recordBrowserReceipt(originalReceipt,{signal:life});
   settle(life); // a durable ack that arrives after cancellation is reported, never re-effected here
   return ack;
  }});
 const siteWorkflows=Object.freeze({
  /** For the trusted prepareCurrentSiteWorkflow owner: exactly {manifest,manifestSha256,enabled}. The
   * client has already validated the manifest against a fresh policy maximum and the saved selection. */
  async resolve({binding:requested,signal}={}){
   assertBinding(requested);const life=live(signal);
   const answer=await client.resolveBrowserWorkflow({binding:data(binding),signal:life});
   settle(life);
   const workflow=answer?.workflow;
   if(!workflow)refuse();
   return Object.freeze({manifest:workflow.manifest,manifestSha256:workflow.manifestSha256,
    enabled:workflow.enabled});
  }});
 /** The canonical readRun the existing operation host expects. `deadlineMs` is the ORIGINAL run
  * deadline from the facts document, never the rolling currentness cutoff; the port is constructed per
  * call from that facts document's own canonical scopes. */
 async function readRun({binding:requested,signal}={}){
  assertBinding(requested);const life=live(signal);
  const facts=await factsAt(life);settle(life);
  const port=createBrowserHostRuntimePort({
   binding:data(facts.binding),cwd,installation,policy,egress,processes,
   approvals,artifacts,receipts,sourceScopes:facts.scopes,modelTransport:'host-owned',
   ...(approvalDeadlineMs===undefined?{}:{approvalDeadlineMs}),
   ...(sessions===undefined?{}:{sessions})});
  return Object.freeze({
   binding:data(facts.binding),cwd,deadlineMs:facts.deadlineMs,port,
   ...(facts.siteWorkflow===undefined?{}:{siteWorkflow:facts.siteWorkflow}),
   siteWorkflows,
   ...(facts.browserHandoff===undefined?{}:{browserHandoff:facts.browserHandoff})});
 }
 return Object.freeze({readRun,siteWorkflows,policy,approvals,receipts,binding:data(binding)});
}
