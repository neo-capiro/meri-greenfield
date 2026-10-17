/** Foreground schedule context over the existing opaque native session. Policy is a trusted compiled port, never membership alone.
 * Construction is inert; pools, sessions and policy remain borrowed. Resolve prepares only, with approval:null. */
import {own,data,nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash,validateShape} from '../../../packages/contracts/validate.mjs';
import {scheduleToolValidators as validators,validateShape as toolShape} from '../../../packages/contracts/retrieval-0.2/validate.mjs';
import {assertScheduleIntent} from '../../../packages/contracts/schedules-0.2/lifecycle-validation.mjs';
import {allocation} from '../../gateway/budget/tool-budget-binding.mjs';
import {createRequestCurrent} from '../action-host/current.mjs';
import {storageMethod} from '../../artifacts/storage/boundary.mjs';
import {SCHEDULED_MERI_INBOX_DESTINATION} from './scheduled-conversation-currentness.mjs';

const same=(a,b)=>hash(a)===hash(b),uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u;
const limitKeys=['maxCostMicrousd','maxRuntimeSeconds','retryLimit'];
const fault=code=>Object.assign(Error(`SCHEDULE_CONTEXT_${code}`),{code:`SCHEDULE_CONTEXT_${code}`});
const fail=code=>{throw fault(code);};
function limits(value){
 const v=data(own(value,limitKeys));
 if(limitKeys.some(key=>!Number.isSafeInteger(v[key])||v[key]<(key==='retryLimit'?0:1)))fail('POLICY');return v;
}
function native(value,binding){
 const v=data(value);
 if(!same(v.binding,binding)||new Set(v.scopes.map(s=>s.policyRevision)).size!==1)fail('ACCESS_DENIED');return v;
}

/** policy.check({selection,selectionSha256,signal,limitDeadline}) returns exactly
 * {authorized:true,selectionSha256,binding,scopes,selectedClientId,destinationResolution,limits,checkedAtMs,expiresAtMs}.
 * Destination and limits are null for list/cancel. Every receipt is fresh and binds the complete request and native selection.
 * template is one explicit generic task identity matching the actual allocation manifest, never a named-skill coercion. */
export function createScheduleRuntimeContext(configuration){
 let c,a,template,workflow,bounds,ports,checkPolicy,readFiring,commandContext,prepareCancellation;
 try{
  c=own(configuration,['sessions','commandContext','allocationJson','template','workflow','scheduleOwner','policy','now','newId','limits'],['runCancellation']);
  commandContext=data(own(c.commandContext,['binding','clientResolution']));validateShape('RunBinding',commandContext.binding);
  template=data(own(c.template,['taskId','version','manifestSha256']));workflow=data(own(c.workflow,['taskQueue','workflowIdPrefix']));
  bounds=data(own(c.limits,['maxRequestMs','maxFactBytes','retryLimit']));a=allocation(c.allocationJson);
  if(typeof c.now!=='function'||typeof c.newId!=='function'||!uuid.test(template.taskId)||!Number.isSafeInteger(template.version)||template.version<1||template.manifestSha256!==a.manifestSha256||
   Object.keys(a.run).some(key=>a.run[key]!==commandContext.binding[key])||!Number.isSafeInteger(bounds.maxRequestMs)||bounds.maxRequestMs<1||bounds.maxRequestMs>30000||
   !Number.isSafeInteger(bounds.maxFactBytes)||bounds.maxFactBytes<1||bounds.maxFactBytes>131072||!Number.isSafeInteger(bounds.retryLimit)||bounds.retryLimit<0||
   typeof workflow.taskQueue!=='string'||!/^[a-zA-Z0-9._-]{1,128}$/u.test(workflow.taskQueue)||typeof workflow.workflowIdPrefix!=='string'||!/^[a-zA-Z0-9._/-]{1,128}$/u.test(workflow.workflowIdPrefix))fail('CONFIGURATION');
  ports=Object.freeze({authenticateSession:storageMethod(c.sessions,'authenticateSession'),readCurrentState:storageMethod(c.sessions,'readCurrentState')});
  checkPolicy=storageMethod(c.policy,'check');readFiring=storageMethod(c.scheduleOwner,'readFiring');
  prepareCancellation=c.runCancellation===undefined?null:storageMethod(c.runCancellation,'prepare');
 }catch{throw fault('CONFIGURATION');}

 async function policy({phase,operation,request,currentSchedule,proposal,current,scheduleBinding,life}){
  const selection=data({phase,operation,request,currentSchedule,proposal,current:{binding:current.binding,scopes:current.scopes,selectedClientId:current.selectedClientId},scheduleBinding}),selectionSha256=hash(selection),started=c.now();
  const r=data(own(await life.run(signal=>checkPolicy({selection,selectionSha256,signal,limitDeadline:life.limitDeadline})),
   ['authorized','selectionSha256','binding','scopes','selectedClientId','destinationResolution','limits','checkedAtMs','expiresAtMs']));
  if(r.authorized!==true||r.selectionSha256!==selectionSha256||!same(r.binding,current.binding)||!same(r.scopes,current.scopes)||r.selectedClientId!==current.selectedClientId||
   !Number.isSafeInteger(r.checkedAtMs)||r.checkedAtMs<started||r.checkedAtMs>c.now()||!Number.isSafeInteger(r.expiresAtMs)||r.expiresAtMs<=c.now())fail('POLICY');
  if(['list_scheduled_tasks','cancel_scheduled_task'].includes(operation)){if(r.destinationResolution!==null||r.limits!==null)fail('POLICY');}
  else{
   const d=own(r.destinationResolution,['reference','destinationId']);
   if(d.reference!==request.destinationReference||d.destinationId!==SCHEDULED_MERI_INBOX_DESTINATION)fail('POLICY');limits(r.limits);
  }
  life.limitDeadline(r.expiresAtMs);life.check();return r;
 }
 function saved(raw,operation,current,scheduleId){
  if(operation==='schedule_task'){if(raw!==null)fail('STALE');return null;}
  const r=data(own(raw,['projection','generation','activeIntent','intent']));validateShape('ScheduleProjection',r.projection);
  if(r.activeIntent!==null||!Number.isSafeInteger(r.generation)||r.generation<1||r.projection.scheduleId!==scheduleId||r.projection.state==='cancelled'||
   !same(r.projection.owner,{tenantId:current.binding.tenantId,actorId:current.binding.actorId})||!same(r.projection.scopes,current.scopes))fail('STALE');
  const i=assertScheduleIntent(r.intent,current.binding.tenantId);
  if(i.generation!==r.generation||!same(i.projection,r.projection))fail('STALE');
  return data({projection:r.projection,generation:r.generation,projectionSha256:hash(r.projection)});
 }
 /** Readback permission sees the actual unresolved/cancelled state; it never establishes mutation readiness. */
 function authorizationSnapshot(raw,current,scheduleId){
  const r=data(own(raw,['projection','generation','activeIntent','intent']));validateShape('ScheduleProjection',r.projection);
  if(!Number.isSafeInteger(r.generation)||r.generation<0||r.projection.scheduleId!==scheduleId||
   !same(r.projection.owner,{tenantId:current.binding.tenantId,actorId:current.binding.actorId})||!same(r.projection.scopes,current.scopes)||
   r.activeIntent!==null&&(typeof r.activeIntent!=='string'||!uuid.test(r.activeIntent)))fail('STALE');
  if(r.generation===0){if(r.intent!==null||r.activeIntent===null)fail('STALE');}
  else{const i=assertScheduleIntent(r.intent,current.binding.tenantId);if(i.generation!==r.generation||!same(i.projection,r.projection))fail('STALE');}
  return data({...r,projectionSha256:hash(r.projection)});
 }
 function approved(binding,prepared,current,phase){
  if(!binding||binding.callerIdentity?.tenantId!==current.binding.tenantId||binding.callerIdentity?.actorId!==current.binding.actorId||typeof binding.bindingSha256!=='string'||!/^[a-f0-9]{64}$/u.test(binding.bindingSha256))fail('ACCESS_DENIED');
  if(prepared.intent){if(!same(binding.intent,prepared.intent))fail('ACCESS_DENIED');}
  else if(binding.selection?!same(binding.selection,prepared.selection):binding.operation!==prepared.operation||!same(binding.request,prepared.input)||!same(binding.context.owner,prepared.context.owner))fail('ACCESS_DENIED');
  const decision=binding.approval??binding.context?.approval;
  if(prepared.intent&&(decision===undefined||decision===null)&&!['before_tool','before_tool_release'].includes(phase))fail('ACCESS_DENIED');
  if(decision!==undefined&&decision!==null){
   validateShape('ApprovalDecision',decision);
   if(decision.decision!=='approved'||decision.proposalId!==prepared.intent.intentId||decision.commandSha256!==prepared.intentSha256||
    !same(decision.approver,{tenantId:current.binding.tenantId,actorId:current.binding.actorId})||decision.policyRevision!==current.scopes[0].policyRevision||Date.parse(decision.decidedAt)>c.now()||Date.parse(decision.expiresAt)<=c.now())fail('ACCESS_DENIED');
  }
 }

 function requestCurrent(call){
  return createRequestCurrent({...call,deadlineMs:Math.min(call.deadlineMs,c.now()+bounds.maxRequestMs,Date.parse(a.schedule.expiresAt)),ports,now:c.now,commandContext,maxBytes:bounds.maxFactBytes});
 }
 /** Fresh release permission without allocating a proposal/schedule identity. Exact journal replay uses this same owner. */
 async function authorizeRequest(value){
  const call=own(value,['credential','operation','request','deadlineMs'],['signal']);nativeSignal(call.signal);
  if(!Number.isSafeInteger(call.deadlineMs))fail('REQUEST');
  const request=validators.normalizeRequest(call.operation,call.request),current=requestCurrent(call);
  return current.run(call.signal,async life=>{
   const first=(await current.fresh(life)).current;native(first,first.binding);
   const read=async()=>request.scheduleId===undefined?null:authorizationSnapshot(await life.run(()=>readFiring({tenantId:first.binding.tenantId,scheduleId:request.scheduleId},life.check)),first,request.scheduleId);
   const before=await read(),receipt=await policy({phase:'before_preparation_release',operation:call.operation,request,currentSchedule:before,proposal:null,current:first,scheduleBinding:null,life});
   if(!same(before,await read()))fail('STALE');
   const last=native((await current.fresh(life)).current,first.binding);
   if(!same(last.scopes,first.scopes)||last.selectedClientId!==first.selectedClientId)fail('ACCESS_DENIED');
   const expiresAtMs=Math.min(current.deadline(),receipt.expiresAtMs,last.expiresAtMs);life.limitDeadline(expiresAtMs);life.check();
   return data({binding:last.binding,scopes:last.scopes,selectedClientId:last.selectedClientId,checkedAtMs:c.now(),expiresAtMs});
  });
 }

 async function resolve(value){
  const call=own(value,['credential','operation','request','deadlineMs'],['signal','proposal']);nativeSignal(call.signal);
  if(!Number.isSafeInteger(call.deadlineMs))fail('REQUEST');
  let request=validators.normalizeRequest(call.operation,call.request);const proposal=call.proposal===undefined?null:data(toolShape('ScheduleMutationOutput',call.proposal));
  if(call.operation==='cancel_scheduled_task'&&request.runs.length)fail('REQUEST');
  if(proposal&&(proposal.status!=='approval_required'||proposal.operation!==call.operation))fail('REQUEST');
  const current=requestCurrent(call);
  return current.run(call.signal,async life=>{
   const first=(await current.fresh(life)).current,identity={tenantId:first.binding.tenantId,actorId:first.binding.actorId},list=call.operation==='list_scheduled_tasks';native(first,first.binding);
   const scheduleId=list?null:proposal?.projection.scheduleId??request.scheduleId??c.newId(),intentId=list?null:proposal?.proposalId??c.newId();
   if(!list&&(!uuid.test(scheduleId)||!uuid.test(intentId)||scheduleId===intentId))fail('CONFIGURATION');
   const read=async()=>list?null:saved(await life.run(()=>readFiring({tenantId:identity.tenantId,scheduleId},life.check)),call.operation,first,scheduleId);
   const before=await read();
   if(call.operation==='cancel_scheduled_task'&&request.running==='request_cancel'){
    if(!prepareCancellation)fail('UNAVAILABLE');
    const runs=await life.run(signal=>prepareCancellation({callerIdentity:identity,scopes:first.scopes,request,signal,deadlineMs:current.deadline()}));
    request=validators.normalizeRequest(call.operation,{...request,runs});
   }
   const receipt=await policy({phase:'resolve',operation:call.operation,request,currentSchedule:before,proposal,current:first,scheduleBinding:null,life});
   let scheduleContext={callerIdentity:identity,requestSha256:hash(request),nowMs:c.now(),deadlineMs:Math.min(current.deadline(),receipt.expiresAtMs)};
   if(list)scheduleContext={...scheduleContext,owner:identity};
   else{
    const cancel=call.operation==='cancel_scheduled_task';
    const effective=cancel?null:Object.fromEntries(limitKeys.map(key=>[key,Math.min(request.requestedLimits[key],receipt.limits[key],key==='maxCostMicrousd'?a.budgets.maxCostMicroUSD:key==='maxRuntimeSeconds'?a.budgets.maxRuntimeSeconds:Math.min(bounds.retryLimit,a.budgets.maxRecoveryAttempts))]));
    const projection=cancel?{...before.projection,state:request.mode==='delete'?'cancelled':'paused'}:{scheduleId,owner:identity,temporalScheduleId:before?.projection.temporalScheduleId??workflow.workflowIdPrefix+'/'+scheduleId,
     timezone:request.policy.spec.timezone,scopes:first.scopes,state:request.policy.paused?'paused':'active',...effective,destinationId:receipt.destinationResolution.destinationId,createdAt:before?.projection.createdAt??proposal?.projection.createdAt??new Date(c.now()).toISOString()};
    scheduleContext={...scheduleContext,intentId,current:before,projection,approval:null,
     taskResolution:cancel?null:{instructionSha256:hash(request.taskInstruction),task:template,workflow:{workflowType:'meriScheduledDispatchWorkflow',taskQueue:workflow.taskQueue,workflowId:workflow.workflowIdPrefix+'/'+scheduleId}},
     destinationResolution:cancel?null:receipt.destinationResolution,limitResolution:cancel?null:{requestedSha256:hash(request.requestedLimits),effective}};
   }
   const context=data({scheduleContext}),prepared=validators.prepare(call.operation,request,context);
   if(proposal&&!same(proposal,prepared.proposal))fail('STALE');
   if(!same(before,await read()))fail('STALE');
   const last=native((await current.fresh(life)).current,first.binding);if(!same(last.scopes,first.scopes)||last.selectedClientId!==first.selectedClientId)fail('ACCESS_DENIED');life.check();
   async function authorize(value){
    const q=own(value,['phase','binding'],['signal','limitDeadline']);nativeSignal(q.signal);
    if(typeof q.phase!=='string'||!q.phase||q.phase.length>128||q.limitDeadline!==undefined&&typeof q.limitDeadline!=='function')fail('REQUEST');
    const binding=data(q.binding);
    return current.run(q.signal,async active=>{
     if(Number.isSafeInteger(binding.deadlineMs))active.limitDeadline(binding.deadlineMs);
     const start=native((await current.fresh(active)).current,first.binding);if(!same(start.scopes,first.scopes)||start.selectedClientId!==first.selectedClientId)fail('ACCESS_DENIED');approved(binding,prepared,start,q.phase);
     const fresh=await policy({phase:q.phase,operation:call.operation,request,currentSchedule:before,proposal:prepared.proposal??null,current:start,scheduleBinding:binding,life:active});
     if(!list&&call.operation!=='cancel_scheduled_task'&&(!same(fresh.destinationResolution,receipt.destinationResolution)||limitKeys.some(key=>fresh.limits[key]<prepared.intent.projection[key])))fail('POLICY');
     const end=native((await current.fresh(active)).current,first.binding);if(!same(end.scopes,start.scopes)||end.selectedClientId!==start.selectedClientId)fail('ACCESS_DENIED');
     const expiresAtMs=Math.min(current.deadline(),fresh.expiresAtMs,end.expiresAtMs);active.limitDeadline(expiresAtMs);q.limitDeadline?.(expiresAtMs);active.check();
     return data({authorized:true,bindingSha256:binding.bindingSha256,callerIdentity:identity,expiresAtMs});
    });
   }
   return Object.freeze({context,prepared,current:data({binding:last.binding,scopes:last.scopes,selectedClientId:last.selectedClientId,expiresAtMs:Math.min(current.deadline(),receipt.expiresAtMs,last.expiresAtMs)}),authorize});
  });
 }
 return Object.freeze({resolve,authorizeRequest});
}
