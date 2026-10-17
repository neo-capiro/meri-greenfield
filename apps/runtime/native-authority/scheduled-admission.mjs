/** Schedule-origin original admission. Identity comes from the canonical occurrence; authority comes only from the required
 * trusted current-policy port. Reuses the original binding/input owners, so accepted runs satisfy native initial-run eligibility.
 * No issuer, session substitute, schema, worker or retry loop lives here. A failed acknowledgement leaves the same durable
 * occurrence OPEN for reconciliation. Current implementation refuses job retries and workloads outside the fixed native profile. */
import {own,data,nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {types} from 'node:util';
import {validateShape,canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {assertScheduleIntent} from '../../../packages/contracts/schedules-0.2/lifecycle-validation.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {allocation} from '../../gateway/budget/tool-budget-binding.mjs';
import {createInitialRunBindingJournal} from '../../control/conversations/initial-run-binding-journal.mjs';
import {prepareOriginalInputFacts} from '../../control/conversations/initial-input-facts.mjs';
import {snapshotOccurrence,occurrenceIdentity} from '../../control/schedules/scheduled-occurrence.mjs';
import {sdkMethod} from '../../control/schedules/temporal-schedule-mutations.mjs';
import {workflowId} from '../../control/conversations/temporal-dispatch.mjs';
import {SCHEDULED_MERI_INBOX_DESTINATION} from '../../control/schedules/scheduled-conversation-currentness.mjs';

const errors=new WeakSet(),same=(a,b)=>hash(a)===hash(b),integer=v=>Number.isSafeInteger(v)&&v>=0;
const digest=v=>typeof v==='string'&&/^[a-f0-9]{64}$/u.test(v);
function fault(code){const e=Object.assign(Error(`SCHEDULE_ADMISSION_${code}`),{code:`SCHEDULE_ADMISSION_${code}`});errors.add(e);return e;}
const fail=code=>{throw fault(code);};
function closed(value,keys,code){try{return own(value,keys);}catch{fail(code);}}

export function createScheduledNativeAdmission(options){
 let pool,claimInput,acceptInput,readOptional,readFiring,openOccurrence,authorize,t,a,scopes,now,maxRequestMs;
 try{
  const o=own(options,['pool','store','scheduleOwner','authority','template'],['now','maxRequestMs']);
  pool=Object.freeze({connect:sdkMethod(o.pool,'connect')});
  if(!o.store||types.isProxy(o.store))fail('CONFIGURATION');
  const initial=Object.getOwnPropertyDescriptor(o.store,'initialInputs');
  if(!initial||!Object.hasOwn(initial,'value'))fail('CONFIGURATION');
  claimInput=sdkMethod(initial.value,'claim');acceptInput=sdkMethod(initial.value,'accept');readOptional=sdkMethod(o.store,'readOptional');
  readFiring=sdkMethod(o.scheduleOwner,'readFiring');openOccurrence=sdkMethod(o.scheduleOwner,'openOccurrence');authorize=sdkMethod(o.authority,'authorize');
  t=data(own(o.template,['principal','selectedClientId','policyRevision','versions','task','configurationSha256','allocationJson','runWindowMs','destinationId']));
  closed(t.principal,['tenantId','actorId'],'CONFIGURATION');validateShape('Identity',t.principal);validateShape('RuntimeVersions',t.versions);
  a=allocation(t.allocationJson);scopes=data([{tenantId:t.principal.tenantId,kind:'client',resourceId:t.selectedClientId,policyRevision:t.policyRevision}]);
  validateShape('Scope',scopes[0]);closed(t.task,['taskId','manifestSha256','version'],'CONFIGURATION');
  if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u.test(t.selectedClientId)||
   !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u.test(t.task.taskId)||
   !integer(t.task.version)||t.task.version<1||t.task.manifestSha256!==a.manifestSha256||!digest(t.configurationSha256)||
   a.run.tenantId!==t.principal.tenantId||a.run.actorId!==t.principal.actorId||!integer(t.runWindowMs)||t.runWindowMs<1||
   t.destinationId!==SCHEDULED_MERI_INBOX_DESTINATION)fail('CONFIGURATION');
  now=o.now??Date.now;maxRequestMs=o.maxRequestMs??10000;
  if(typeof now!=='function'||!integer(maxRequestMs)||maxRequestMs<1||maxRequestMs>30000)fail('CONFIGURATION');
 }catch{throw fault('CONFIGURATION');}

 function request(raw){
  const v=own(raw,['occurrence','occurrenceKey','effect','input'],['signal','deadlineMs']);nativeSignal(v.signal);
  const occ=snapshotOccurrence(v.occurrence),id=occurrenceIdentity(occ),effect=data(v.effect),input=data(v.input);
  closed(input,['conversation','run','request','event'],'REQUEST');
  const expected={binding:id.binding,requestId:id.requestId,eventId:id.eventId,workflowId:workflowId(id.binding)};
  if(v.occurrenceKey!==id.occurrenceKey||!same(effect,expected))fail('REQUEST');
  validateShape('Conversation',input.conversation);validateShape('Run',input.run);validateShape('UIEvent',input.event);
  closed(input.request,['requestId','prompt','skill','window','windowRequest'],'REQUEST');
  const {conversation:c,run:r,event:e,request:q}=input,b=id.binding;
  if(!same(b,r.binding)||!same(b,e.binding)||c.conversationId!==b.conversationId||!same(c.owner,t.principal)||
   same(a.run,Object.fromEntries(Object.keys(a.run).map(k=>[k,b[k]])))||
   !same(r.versions,t.versions)||!same(c.scopes,scopes)||!same(r.scopes,scopes)||!same(e.scopes,scopes)||
   c.policyRevision!==t.policyRevision||r.policyRevision!==t.policyRevision||r.state!=='queued'||
   q.requestId!==id.requestId||e.eventId!==id.eventId||e.sequence!==1||e.type!=='run.status'||e.data.state!=='queued'||e.data.reasonCode!==null||
   q.skill!==null||q.window!==null||q.windowRequest!==null||typeof q.prompt!=='string'||!q.prompt.trim())fail('PROFILE_MISMATCH');
  if(v.deadlineMs!==undefined&&!integer(v.deadlineMs))fail('REQUEST');
  return {occ,id,effect,input,signal:v.signal,deadlineMs:v.deadlineMs};
 }
 async function current(c){
  const r=data(await c.life.run(()=>readFiring({tenantId:c.id.binding.tenantId,scheduleId:c.occ.projection.scheduleId},c.life.check)));
  closed(r,['projection','generation','activeIntent','intent'],'STALE');
  if(r.activeIntent!==null||r.generation!==c.occ.generation||!same(r.projection,c.occ.projection)||r.intent===null)fail('STALE');
  const i=assertScheduleIntent(r.intent,c.id.binding.tenantId),p=i.projection;
  if(i.operation==='cancel_scheduled_task'||i.generation!==c.occ.generation||!same(i.projection,r.projection)||p.state!=='active'||i.configuration.paused||
   !same(p.owner,t.principal)||!same(i.configuration.task,t.task)||!same(c.occ.task,t.task)||
   !same(p.scopes,scopes)||p.destinationId!==t.destinationId||p.maxCostMicrousd<a.budgets.maxCostMicroUSD||p.retryLimit!==0)fail('PROFILE_MISMATCH');
  if(hash(c.input.request.prompt)!==i.taskInstructionSha256)fail('INSTRUCTION');
  const age=now()-Date.parse(c.occ.scheduledAt);
  if(age<0||age>i.configuration.catchupWindowMs+i.configuration.spec.jitterMs)fail('MISSED');
  return hash(i);
 }
 function upperBound(c,createdAtMs){return Math.min(createdAtMs+c.occ.projection.maxRuntimeSeconds*1000,createdAtMs+t.runWindowMs,Date.parse(a.schedule.expiresAt));}
 async function proof(c,phase,expiresAtMs){
  const intentSha256=await current(c),selection=data({phase,occurrenceKey:c.id.occurrenceKey,binding:c.id.binding,
   intentSha256,effectSha256:hash(c.effect),requestSha256:hash(c.input.request),configurationSha256:t.configurationSha256,
   allocationSha256:hash(a),scopes,selectedClientId:t.selectedClientId,policyRevision:t.policyRevision,versions:t.versions,
   task:t.task,destinationId:t.destinationId,expiresAtMs});
  const selectionSha256=hash(selection),before=now();
  const r=data(await c.life.run(signal=>authorize({phase,selection,selectionSha256,signal,deadlineMs:c.deadlineMs})));
  closed(r,['authorized','selectionSha256','binding','scopes','selectedClientId','policyRevision','configurationSha256','checkedAtMs','expiresAtMs'],'AUTHORITY');
  if(r.authorized!==true||r.selectionSha256!==selectionSha256||!same(r.binding,c.id.binding)||!same(r.scopes,scopes)||
   r.selectedClientId!==t.selectedClientId||r.policyRevision!==t.policyRevision||r.configurationSha256!==t.configurationSha256||
   !integer(r.checkedAtMs)||r.checkedAtMs<before||r.checkedAtMs>now()||!integer(r.expiresAtMs)||r.expiresAtMs<=now())fail('AUTHORITY');
  if(await current(c)!==intentSha256)fail('STALE');
  c.limit(r.expiresAtMs);return r.expiresAtMs;
 }
 function record(c,r){
  closed(r,['schemaVersion','state','binding','selectedClientId','policyRevision','versions','configurationSha256','expiresAtMs','createdAtMs'],'BINDING');
  if(r.schemaVersion!==1||r.state!=='ADMITTED'||!same(r.binding,c.id.binding)||r.selectedClientId!==t.selectedClientId||r.policyRevision!==t.policyRevision||
   !same(r.versions,t.versions)||r.configurationSha256!==t.configurationSha256||!integer(r.createdAtMs)||r.createdAtMs<1||r.createdAtMs>now()||!integer(r.expiresAtMs)||
   r.expiresAtMs<=now()||r.expiresAtMs<=r.createdAtMs||r.expiresAtMs>upperBound(c,r.createdAtMs))fail('BINDING');
  return r;
 }
 return Object.freeze({async admit(raw){
  let life;
  try{
   const c=request(raw),at=now();c.deadlineMs=Math.min(c.deadlineMs??at+maxRequestMs,at+maxRequestMs);
   life=c.life=createOperationLifetime({now,deadlineMs:c.deadlineMs,signal:c.signal,errorFactory:code=>fault(code)});
   c.limit=ms=>{life.limitDeadline(ms);c.deadlineMs=Math.min(c.deadlineMs,ms);};
   // The ID queue belongs only to this immutable occurrence and is used only by the canonical journal's new-claim path.
   const ids=[c.id.binding.runId,c.id.binding.attemptId,c.id.binding.workerId];let cursor=0;
   const journal=createInitialRunBindingJournal({pool,now,newId:()=>{if(cursor>=ids.length)fail('IDENTITY');return ids[cursor++];}});
   const old=await life.run(()=>journal.read({binding:c.id.binding},life.check));
   if(old!==null)record(c,old);
   let expiresAtMs=old?.expiresAtMs??upperBound(c,now());
   const authorizedUntil=await proof(c,'before_claim',expiresAtMs);
   if(old&&authorizedUntil<expiresAtMs)fail('AUTHORITY');expiresAtMs=Math.min(expiresAtMs,authorizedUntil);
   // Same canonical owner/lock/effect as the dispatcher. Re-opening proves this exact occurrence owns the durable barrier.
   const barrier=data(await life.run(()=>openOccurrence({tenantId:c.id.binding.tenantId,scheduleId:c.occ.projection.scheduleId,
    generation:c.occ.generation,occurrenceKey:c.id.occurrenceKey,occurrence:c.occ,effect:c.effect},life.check)));
   closed(barrier,['state','blocking'],'BARRIER');if(barrier.state!=='OPEN'||barrier.blocking!==null)fail('BARRIER');
   const claimed=data(await life.run(()=>journal.claim({principal:t.principal,conversationId:c.id.binding.conversationId,
    selectedClientId:t.selectedClientId,policyRevision:t.policyRevision,versions:t.versions,configurationSha256:t.configurationSha256,proposedExpiresAtMs:expiresAtMs},life.check)));
   closed(claimed,['record','created'],'BINDING');if(typeof claimed.created!=='boolean')fail('BINDING');
   const saved=record(c,claimed.record);if(saved.expiresAtMs>expiresAtMs||old&&!same(old,saved))fail('BINDING');c.limit(saved.expiresAtMs);
   const createdAt=new Date(saved.createdAtMs).toISOString(),input=data({...c.input,
    conversation:{...c.input.conversation,createdAt},run:{...c.input.run,createdAt},event:{...c.input.event,createdAt}});
   const facts=await life.run(()=>prepareOriginalInputFacts({binding:c.id.binding,scopes,versions:t.versions,selectedClientId:t.selectedClientId,
    input:{requestId:input.request.requestId,prompt:input.request.prompt},request:input.request,allocatedAtMs:saved.createdAtMs,expiresAtMs:saved.expiresAtMs}));
   const reserved=data(await life.run(()=>claimInput(facts,life.check)));closed(reserved,['allocation','state','created'],'INPUT');
   if(!same(reserved.allocation,facts)||!['RESERVED','ACCEPTED'].includes(reserved.state)||typeof reserved.created!=='boolean'||reserved.created&&reserved.state!=='RESERVED')fail('INPUT');
   if(await proof(c,'before_accept',saved.expiresAtMs)<saved.expiresAtMs)fail('AUTHORITY');
   const accepted=data(await life.run(()=>acceptInput({...input,selectedClientId:t.selectedClientId},life.check)));
   closed(accepted,['run','request','lastSequence','replayed'],'INPUT');
   if(!same(accepted.run.binding,c.id.binding)||!same(accepted.request,input.request)||!same(accepted.run.versions,t.versions)||!same(accepted.run.scopes,scopes)||
    accepted.run.createdAt!==createdAt||typeof accepted.replayed!=='boolean'||!integer(accepted.lastSequence)||accepted.lastSequence<1)fail('INPUT');
   const back=await life.run(()=>readOptional(c.id.binding,{after:0,limit:1},life.check));
   if(!back||!same(back.run,accepted.run)||!same(back.request,input.request))fail('INPUT');
   if(await proof(c,'before_release',saved.expiresAtMs)<saved.expiresAtMs)fail('AUTHORITY');life.check();
   return data({binding:c.id.binding,requestSha256:facts.requestSha256,expiresAtMs:saved.expiresAtMs,replayed:accepted.replayed});
  }catch(e){throw errors.has(e)?e:fault('UNKNOWN');}
  finally{life?.close();}
 }});
}
