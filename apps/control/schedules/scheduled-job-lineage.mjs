/** Read-only scheduled-work lineage over the canonical conversation/input/lifecycle owners. No SQL or admission authority. */
import {own,data} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {assertContinuationEnvelope} from '../../../packages/contracts/conversation-lifecycle/validate.mjs';
import {frozenScheduleData,denySchedule} from '../../../packages/contracts/schedules-0.2/lifecycle-validation.mjs';
import {snapshotOccurrence,occurrenceIdentity} from './scheduled-occurrence.mjs';
import {workflowId} from '../conversations/temporal-dispatch.mjs';
import {assertOriginalInputAcceptance} from '../conversations/initial-input-facts.mjs';
import {sdkMethod} from './temporal-schedule-mutations.mjs';

const same=(a,b)=>hash(a)===hash(b),fail=()=>denySchedule('SCHEDULE_JOB_LINEAGE');
/** The stored effect, never the schedule wrapper or caller-selected workflow, fixes the job origin. */
export function snapshotScheduledJobSelection(value){
 const v=own(value,['occurrence','effect']),occurrence=snapshotOccurrence(v.occurrence),identity=occurrenceIdentity(occurrence);
 const effect=data(own(v.effect,['binding','requestId','eventId','workflowId']));
 if(!same(effect,{binding:identity.binding,requestId:identity.requestId,eventId:identity.eventId,workflowId:workflowId(identity.binding)}))fail();
 return frozenScheduleData({occurrence,effect,identity});
}

export function createScheduledJobLineage(configuration){
 const {store}=own(configuration,['store']),read=sdkMethod(store,'readOptional'),facets=Object.getOwnPropertyDescriptors(store);
 for(const key of ['initialInputs','nextRuns','lifecycle'])if(!facets[key]||!Object.hasOwn(facets[key],'value'))fail();
 const input=sdkMethod(facets.initialInputs.value,'read'),list=sdkMethod(facets.nextRuns.value,'listRuns'),
  controls=sdkMethod(facets.lifecycle.value,'controls'),execution=sdkMethod(facets.lifecycle.value,'execution');
 async function readControls(binding,scopes,selectedClientId,check){
  const all=[];let after=0;
  // Bounded inspection; exhaustion is uncertainty, never absence of an unresolved control.
  for(let page=0;page<10;page++){
   const rows=data(await controls({binding,scopes,selectedClientId,after},check));check();
   if(!Array.isArray(rows)||rows.length>100)fail();
   for(const row of rows){if(!Number.isSafeInteger(row.controlSequence)||row.controlSequence<=after)fail();after=row.controlSequence;all.push(row);}
   if(rows.length<100)return all;
  }
  fail();
 }
 async function inspect(value,check){
  if(typeof check!=='function')fail();check();const s=snapshotScheduledJobSelection(value),originBinding=s.effect.binding;
  const original=await read(originBinding,{after:0,limit:1},check);check();
  const absent={originBinding,currentBinding:null,bindings:[],scopes:[],selectedClientId:null,run:null,requestId:s.effect.requestId,allocatedAtMs:null,expiresAtMs:null,occupiedReason:'SCHEDULE_JOB_NOT_ADMITTED',cleanupReady:false,lineageSha256:null};
  if(original===null)return frozenScheduleData(absent);
  if(!same(original.run.binding,originBinding)||original.request.requestId!==s.effect.requestId)fail();
  const retained=await input(originBinding,check);check();
  if(!retained||retained.state!=='ACCEPTED')fail();
  const facts=assertOriginalInputAcceptance(retained.facts,{run:original.run,request:original.request,selectedClientId:retained.facts.selectedClientId});
  const {scopes,selectedClientId}=facts,saved=data(await list({tenantId:originBinding.tenantId,conversationId:originBinding.conversationId},check));check();
  if(!Array.isArray(saved.runs)||!Array.isArray(saved.reservations)||!saved.runs.length)fail();
  if(saved.runs.some(r=>r.binding.tenantId!==originBinding.tenantId||r.binding.actorId!==originBinding.actorId||r.binding.conversationId!==originBinding.conversationId||
   !same(r.scopes,scopes)||!same(r.versions,original.run.versions)))fail();
  const bindings=[originBinding],retainedControls=[];let current=original,reason=saved.reservations.length?'SCHEDULE_JOB_NEW_PROMPT':null,cleanupReady=!saved.reservations.length;
  for(let n=0;n<saved.runs.length;n++){
   const rows=await readControls(current.run.binding,scopes,selectedClientId,check);
   retainedControls.push(rows);const mutations=rows.filter(p=>p.input.intent==='resume'||p.input.intent==='fork');
   if(mutations.some(p=>p.input.intent==='fork'||!p.target)){reason??='SCHEDULE_JOB_CONTROL_UNRESOLVED';cleanupReady=false;break;}
   if(mutations.some(p=>p.state!=='APPLIED'))reason??='SCHEDULE_JOB_CONTROL_UNRESOLVED';
   const resumes=mutations.filter(p=>p.input.intent==='resume');
   if(!resumes.length)break;if(resumes.length!==1)fail();
   const p=resumes[0],b=p.target.binding,prior=current.run.binding;
   if(!['APPLIED','DISPATCHING','UNKNOWN'].includes(p.state)){cleanupReady=false;break;}
   if(b.tenantId!==prior.tenantId||b.actorId!==prior.actorId||b.conversationId!==prior.conversationId||b.writerFence!==prior.writerFence+1||
    bindings.some(o=>same(o,b))||!p.retirement||!same(p.retirement.binding,prior)||!['paused','waiting-for-approval'].includes(current.run.state))fail();
   const target=await read(b,{after:0,limit:1},check);check();if(!target||!same(target.run.binding,b))fail();
   const lineage=await execution({binding:b,scopes,selectedClientId},check);check();
   if(!lineage)fail();const envelope=assertContinuationEnvelope(lineage.continuation);
   if(envelope.mode!=='resume'||envelope.controlId!==p.input.controlId||!same(envelope.checkpoint.binding,prior)||
    !same(lineage.sourceRequest,current.request)||!same({...current.request,requestId:target.request.requestId},target.request))fail();
   bindings.push(b);current=target;
  }
  if(saved.runs.length!==bindings.length||saved.runs.some(r=>!bindings.some(b=>same(b,r.binding)))){reason??='SCHEDULE_JOB_LINEAGE_UNRESOLVED';cleanupReady=false;}
  check();return frozenScheduleData({originBinding,currentBinding:current.run.binding,bindings,scopes,selectedClientId,run:current.run,requestId:s.effect.requestId,allocatedAtMs:facts.allocatedAtMs,expiresAtMs:facts.expiresAtMs,occupiedReason:reason,cleanupReady,lineageSha256:hash(retainedControls)});
 }
 return Object.freeze({read:inspect});
}
