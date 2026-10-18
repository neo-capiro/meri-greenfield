/** Human-approved cancellation resolves actual same-work workflow executions before proposal creation, then rechecks the exact
 * selection before using the canonical run-control and native retirement owners. Schedule-wrapper references never select work. */
import {own,data,nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {createScheduledJobLineage,snapshotScheduledJobSelection} from './scheduled-job-lineage.mjs';
import {createScheduledJobLifecycle} from './scheduled-job-lifecycle.mjs';
import {workflowId} from '../conversations/temporal-dispatch.mjs';
import {sdkMethod} from './temporal-schedule-mutations.mjs';
import {types} from 'node:util';
const same=(a,b)=>hash(a)===hash(b),uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u;
const fail=code=>{throw Object.assign(Error('SCHEDULE_JOB_'+code),{code:'SCHEDULE_JOB_'+code,outcome:'UNKNOWN'});};
export function createScheduledRunCancellation(configuration){
 const c=own(configuration,['scheduleOwner','store','runControl','retirement','client','now','maxRequestMs']);
 const readOpen=sdkMethod(c.scheduleOwner,'readOpenOccurrenceForSchedule'),settle=sdkMethod(c.scheduleOwner,'settleOccurrence'),lineage=createScheduledJobLineage({store:c.store});
 const cancelRun=sdkMethod(c.runControl,'cancel'),retire=sdkMethod(c.retirement,'retire');
 const withDeadline=sdkMethod(c.client.connection,'withDeadline'),withAbort=sdkMethod(c.client.connection,'withAbortSignal'),getHandle=sdkMethod(c.client.workflow,'getHandle');
 if(typeof c.now!=='function'||!Number.isSafeInteger(c.maxRequestMs)||c.maxRequestMs<1||c.maxRequestMs>30000)fail('CONFIGURATION');
 function lifetime(deadlineMs,signal){nativeSignal(signal);if(!Number.isSafeInteger(deadlineMs))fail('REQUEST');const cutoff=Math.min(deadlineMs,c.now()+c.maxRequestMs);return {...createOperationLifetime({now:c.now,signal,deadlineMs:cutoff,errorFactory:code=>Object.assign(Error(code),{code,outcome:'UNKNOWN'})}),deadlineMs:cutoff};}
 async function selection({callerIdentity,scopes,scheduleId},life){
  const row=await life.run(()=>readOpen({tenantId:callerIdentity.tenantId,scheduleId},life.check));
  if(row===null)return {row:null,selected:null,runs:[],expectedLineage:null};
  const selected=snapshotScheduledJobSelection({occurrence:row.occurrence,effect:row.effect});
  if(row.state!=='OPEN'||row.occurrenceKey!==selected.identity.occurrenceKey||row.effectSha256!==hash(selected.effect)||!same(selected.occurrence.projection.owner,callerIdentity)||!same(selected.occurrence.projection.scopes,scopes))fail('SELECTION');
  const saved=await life.run(()=>lineage.read({occurrence:selected.occurrence,effect:selected.effect},life.check));
  if(saved.occupiedReason&&saved.occupiedReason!=='SCHEDULE_JOB_CONTROL_UNRESOLVED'||!saved.currentBinding)fail('SELECTION');
  const runs=[];
  for(const binding of saved.bindings){
   const id=workflowId(binding),description=await life.run(signal=>withDeadline(life.deadlineMs,()=>withAbort(signal,()=>sdkMethod(getHandle(id),'describe')())));
   if(!description||typeof description!=='object'||types.isProxy(description))fail('SELECTION');const d={};
   for(const key of ['workflowId','runId']){const field=Object.getOwnPropertyDescriptor(description,key);if(!field||!Object.hasOwn(field,'value'))fail('SELECTION');d[key]=field.value;}
   // No provider absence/default/current-run guess is a cancellation target. A queued, unstarted run can be fenced by pause/delete.
   if(d.workflowId!==id||typeof d.runId!=='string'||!uuid.test(d.runId))fail('SELECTION');runs.push({workflowId:id,runId:d.runId});
  }
  const back=await life.run(()=>readOpen({tenantId:callerIdentity.tenantId,scheduleId},life.check));
  if(!same(back,row))fail('SELECTION');life.check();return {row,selected,runs,expectedLineage:data({currentBinding:saved.currentBinding,bindings:saved.bindings,lineageSha256:saved.lineageSha256})};
 }
 return Object.freeze({
  async prepare(value){const v=own(value,['callerIdentity','scopes','request','deadlineMs'],['signal']),life=lifetime(v.deadlineMs,v.signal);try{
   const r=await selection({...v,scheduleId:v.request.scheduleId},life);return data(r.runs);
  }finally{life.close();}},
  async cancel(value){const v=own(value,['binding','deadlineMs'],['signal']),b=data(v.binding),life=lifetime(v.deadlineMs,v.signal);try{
   const i=b.intent;if(i?.operation!=='cancel_scheduled_task'||i.cancel?.running!=='request_cancel'||!same(b.callerIdentity,i.projection.owner))fail('SELECTION');
   const s=await selection({callerIdentity:b.callerIdentity,scopes:i.projection.scopes,scheduleId:i.projection.scheduleId},life);
   if(!same(i.cancel.runs,s.runs))fail('SELECTION');if(s.row===null)return;
   // Per-call guards retain the immutable human-approved selection through the actual control boundary. Another resume may
   // create work, but this approval cannot silently select or retire it. No shared mutable expected-selection state exists.
   const runControl={async cancel(call){
    if(!same(call.binding,s.expectedLineage.currentBinding))fail('SELECTION');
    const fresh=await selection({callerIdentity:b.callerIdentity,scopes:i.projection.scopes,scheduleId:i.projection.scheduleId},life);
    if(!same(fresh.expectedLineage,s.expectedLineage)||!same(fresh.runs,s.runs))fail('SELECTION');
    return cancelRun(call);
   }},retirement={retire(call){if(!s.expectedLineage.bindings.some(binding=>same(binding,call.binding)))fail('SELECTION');return retire(call);}};
   const jobs=createScheduledJobLifecycle({store:c.store,runControl,retirement,now:c.now,maxRequestMs:c.maxRequestMs});
   const receipt=await life.run(signal=>jobs.cancel({occurrence:s.selected.occurrence,effect:s.selected.effect,expectedLineage:s.expectedLineage,signal,deadlineMs:v.deadlineMs}));
   if(receipt.state!=='SETTLED'||!same(receipt.binding,s.selected.effect.binding))fail('RETIREMENT_UNPROVEN');
   const changed=await life.run(()=>settle({tenantId:b.callerIdentity.tenantId,occurrenceKey:s.row.occurrenceKey,effectSha256:s.row.effectSha256,state:'DISPATCHED'},life.check));
   if(changed.state!=='DISPATCHED')fail('RETIREMENT_UNPROVEN');life.check();
  }finally{life.close();}}
 });
}
