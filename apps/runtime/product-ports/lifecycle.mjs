import {isResumeIntent,continuationMode} from '../../control/conversations/lifecycle/browser-custody.mjs';
/** Approval custody and native lifecycle admission over the existing run owners.
 * SDK settlement is not VM termination. Core currentness remains the candidate's
 * transitionAuthority; no allocation, proxy, grant or second admission store. */
import {types} from 'node:util';
import {randomUUID} from 'node:crypto';
import {own,data} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {validateShape,canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {assertNativeSessionReference,assertNativeConversationScope} from '../../../packages/contracts/runtime-0.2/session.mjs';
import {assertForkBootstrapReceipt} from '../../../packages/contracts/conversation-lifecycle/validate.mjs';
import {continuesSession} from '../../../packages/contracts/session-continuity.mjs';
import {createPostgresCommandProposalReader} from '../../control/intents/postgres-journal.mjs';
import {intentsComposition} from './intents.mjs';
const fault=code=>Object.assign(new Error(code),{code});
const refused=()=>fault('APPROVAL_REFUSED');
const ordinary=fn=>typeof fn==='function'&&!types.isProxy(fn);
const same=(a,b)=>hash(a)===hash(b),deny=()=>{throw fault('CONTINUATION_REFUSED');};
export function createJournalProposalReader({pool}){
 const reader=createPostgresCommandProposalReader({pool});
 return async function readProposal(value){
  let v;try{v=own(value,['proposalId','binding','scopes'],['signal']);validateShape('RunBinding',data(v.binding));}catch{throw refused();}
  const b=v.binding;
  const proposal=await reader.readProposal({tenantId:b.tenantId,actorId:b.actorId,conversationId:b.conversationId,proposalId:v.proposalId,...(v.signal===undefined?{}:{signal:v.signal})});
  if(proposal===null||proposal.command.binding.runId!==b.runId)throw refused();
  return proposal;
 };
}
/** New work is nominated once by the existing DISPATCHING control. An unknown
 * result remains that control's barrier; this owner neither retries nor dispatches. */
export function createNativeLifecycleAdmission({store,versions,runWindowMs,admitFork,now=Date.now,newId=randomUUID}){
 validateShape('RuntimeVersions',versions);versions=data(versions);
 if(!Number.isSafeInteger(runWindowMs)||runWindowMs<1||runWindowMs>28800000||!ordinary(now)||!ordinary(newId)||admitFork!==undefined&&!ordinary(admitFork)||typeof store?.read!=='function'||typeof store?.nextRuns?.current!=='function'||typeof store?.lifecycle?.get!=='function'||typeof store?.lifecycle?.readSessionCapture!=='function')throw fault('LIFECYCLE_CONFIGURATION');
 async function source(v,b,check){
  validateShape('RunBinding',b);assertNativeSessionReference(v.sdkSession);assertNativeConversationScope({binding:b,scopes:v.scopes,selectedClientId:v.selectedClientId});
  if(!same(v.sdkSession.binding,b))deny();check();
  const saved=await store.read(b,{},check),latest=await store.nextRuns.current(b,check);check();
  if(!same(saved.run.binding,b)||!same(saved.run.scopes,v.scopes)||!continuesSession(saved.run.versions,versions)||!['paused','waiting-for-approval','completed'].includes(saved.run.state)||latest.reserved!==false||!same(latest.binding,b)||!same(latest.scopes,v.scopes)||latest.policyRevision!==saved.run.policyRevision)deny();
  const capture=await store.lifecycle.readSessionCapture({binding:b,scopes:v.scopes,selectedClientId:v.selectedClientId,checkpointId:b.runId},check);check();
  if(!same(capture.proof.sdkSession,v.sdkSession))deny();
  const control=await store.lifecycle.get({binding:b,scopes:v.scopes,selectedClientId:v.selectedClientId,controlId:v.controlId},check);check();
  if(control.state!=='DISPATCHING'||!(isResumeIntent(control.input.intent)||control.input.intent==='fork')||control.input.checkpointId!==b.runId||control.input.checkpointSha256!==capture.proof.checkpointSha256)deny();
  return {saved,capture,control};
 }
 const checking=signal=>()=>{if(signal?.aborted)throw fault('CONTINUATION_CANCELLED');};
 async function retire(value){
  const v=own(value,['controlId','binding','sdkSession','scopes','selectedClientId'],['signal']),check=checking(v.signal);
  const {saved,control}=await source(v,v.binding,check);
  if(!isResumeIntent(control.input.intent)||!['paused','waiting-for-approval'].includes(saved.run.state))deny();
  // This is eligibility for the journal's atomic writer-range closure, never a stop receipt.
  return {binding:v.binding,retirementReceiptId:newId(),expiresAtMs:now()+runWindowMs};
 }
 async function admit(value){
  const v=own(value,['controlId','mode','sourceBinding','sdkSession','checkpointSha256','request','scopes','selectedClientId','versions'],['signal']),check=checking(v.signal);
  const {saved,capture,control}=await source(v,v.sourceBinding,check);
  if(continuationMode(control.input.intent)!==v.mode||v.checkpointSha256!==capture.proof.checkpointSha256||!same(v.request,saved.request)||!same(v.versions,saved.run.versions))deny();
  if(control.target)return data(control.target);
  const b=v.sourceBinding;let binding,bootstrap,targetSessionId=null,expiresAtMs=now()+runWindowMs;
  if(v.mode==='resume'){
   if(!['paused','waiting-for-approval'].includes(saved.run.state))deny();
   binding={...b,runId:newId(),attemptId:newId(),workerId:newId(),writerFence:b.writerFence+1};
  }else if(v.mode==='fork'){
   if(!admitFork)throw fault('CONTINUATION_FORK_UNAVAILABLE');
   const target=own(await admitFork({controlId:v.controlId,sourceBinding:b,scopes:v.scopes,selectedClientId:v.selectedClientId,versions,signal:v.signal}),['binding','bootstrap','expiresAtMs']);check();
   binding=data(target.binding);bootstrap=assertForkBootstrapReceipt(target.bootstrap,{controlId:v.controlId,sourceBinding:b,targetBinding:binding,selectedClientId:v.selectedClientId});
   if(binding.writerFence!==1)deny();expiresAtMs=Math.min(expiresAtMs,target.expiresAtMs);targetSessionId=newId();if(targetSessionId===v.sdkSession.key.sessionId)deny();
  }else deny();
  validateShape('RunBinding',binding);
  if(binding.tenantId!==b.tenantId||binding.actorId!==b.actorId||['runId','attemptId','workerId'].some(k=>binding[k]===b[k])||!Number.isSafeInteger(expiresAtMs)||expiresAtMs<=now())deny();check();
  return {binding,scopes:data(v.scopes),selectedClientId:v.selectedClientId,admissionReceiptId:newId(),targetSessionId,expiresAtMs,versions,...(bootstrap?{bootstrap}:{})};
 }
 return Object.freeze({retire,admit});
}
/** Intent availability affects approvals only. Native resume/fork ports are
 * supplied by the candidate over its actual run store and Core admission. */
export function createLifecycleFamilyWith({readProposal}={}){
 if(readProposal!==undefined&&!ordinary(readProposal))throw fault('LIFECYCLE_CONFIGURATION');
 return function createLifecycleFamily(context){
  const shared=intentsComposition(context);
  if(shared.state!=='composed'||typeof shared.readDecision!=='function')return {ports:{}};
  const read=readProposal??createJournalProposalReader({pool:context.pool});
  return {ports:{approvals:Object.freeze({read:value=>read(value),readDecision:value=>shared.readDecision(value)})}};
 };
}
export const createLifecycleFamily=createLifecycleFamilyWith();
