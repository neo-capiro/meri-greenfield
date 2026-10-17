/** Actual session/native HTTP adapters and schedule SQL owner; only external Core, SQL and mutation policy are scripted.
 * No network socket, database, worker, credential provisioning or live policy qualification. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createScheduleRuntimeContext} from '../runtime-context.mjs';
import {createPostgresScheduleOwner} from '../postgres-schedule-owner.mjs';
import {scheduleOwnerFixture} from './schedule-owner-fixture.mjs';
import {createActionSessionOwner} from '../../action-host/session/owner.mjs';
import {createNativeIdentityContext} from '../../../runtime/native-authority/identity-context.mjs';
import {createCoreMembershipGate} from '../../product-access/core-membership.mjs';
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
import {scheduleToolValidators as validators} from '../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {snapshotScheduleCall} from '../../../../packages/contracts/schedules-0.2/lifecycle-validation.mjs';
import {selectSkill} from '../../../../packages/skills/index.mjs';

const NOW=Date.parse('2026-10-17T12:00:00.000Z'),id=n=>`10000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const binding={tenantId:'tenant-a',actorId:'owner-a',conversationId:id(1),runId:id(2),attemptId:id(3),workerId:id(4),writerFence:1},clientId=id(5);
const policy={spec:{calendars:[],intervals:[{every:60000,offset:0}],cronExpressions:[],skip:[],startAt:null,endAt:null,jitterMs:0,timezone:'UTC'},
 overlap:'SKIP',catchupWindowMs:60000,pauseOnFailure:true,remainingActions:null,paused:false,note:'Explicit test policy',runNow:false,runNowOverlap:'ALLOW_ALL'};
const request=()=>({taskInstruction:'  Summarize authorized activity.\n',policy:structuredClone(policy),destinationReference:'  Meri inbox  ',requestedLimits:{maxCostMicrousd:5000,maxRuntimeSeconds:120,retryLimit:2}});

async function fixture(){
 const state={now:NOW,ids:100,fetches:[],policies:[],reads:0,allowed:true,revoked:false,policyRevision:'p1',identityRevision:'i1',contextRevision:'c1',membershipRevision:'m1',policyHook:null,receiptHook:null};
 const now=()=>state.now,scopes=()=>[{tenantId:binding.tenantId,kind:'client',resourceId:clientId,policyRevision:state.policyRevision}];
 const commandContext={binding,clientResolution:{reference:clientId,clientId}};
 const fetchImpl=async(url,init)=>{
  state.fetches.push({url,init});if(state.revoked||init.headers.authorization!=='Bearer synthetic-native')return new Response('',{status:403});
  const stamp={checkedAtMs:now(),expiresAtMs:NOW+60000},principal={tenantId:binding.tenantId,actorId:binding.actorId};let value;
  if(url.endsWith('/membership'))value={...principal,status:'active',role:'standard_user',permissions:[],clientIds:[clientId],membershipRevision:state.membershipRevision,...stamp};
  else if(url.endsWith('/identity'))value={principal,identityRevision:state.identityRevision,...stamp};
  else{assert.ok(url.endsWith('/context'));const input=JSON.parse(init.body);value={principal,identityRevision:state.identityRevision,identitySha256:input.identitySha256,conversationId:binding.conversationId,selectedClientId:clientId,contextRevision:state.contextRevision,...stamp};}
  return Response.json(value);
 };
 const identity=createNativeIdentityContext({origin:'https://core.synthetic.invalid',fetchImpl,commandContext,now,limits:{maxRequestMs:1000,maxFactBytes:65536},enabled:true,
  currentOwner:{async currentRun(selected){assert.deepEqual(selected,binding);return JSON.stringify({binding,policyRevision:state.policyRevision,checkedAtMs:now(),deadlineMs:NOW+60000});}}});
 const membership=createCoreMembershipGate({origin:'https://core.synthetic.invalid',identityContext:identity,fetchImpl,now,limits:{maxRequestMs:1000,maxFactBytes:65536}});
 const sessions=createActionSessionOwner({mode:'process-local',verifyIdentity:identity.verifyIdentity,resolveContext:identity.resolveContext,membership:{admit:membership.admit,recheck:membership.recheck},now,
  limits:{maxSessions:3,maxRequestMs:1000,maxTtlMs:60000,maxFactBytes:65536}});
 const session=await sessions.issue({identityCredential:'synthetic-native',deadlineMs:NOW+1000});
 const sql=scheduleOwnerFixture(),owner=createPostgresScheduleOwner({pool:sql.pool}),scheduleOwner={async readFiring(...args){state.reads++;return owner.readFiring(...args);}};
 const selected=selectSkill('quick_skill.relationship_brief','1.0.0'),manifest=selected.manifest;
 const allocationJson=JSON.stringify({run:Object.fromEntries(['tenantId','actorId','conversationId','runId'].map(key=>[key,binding[key]])),manifest,manifestSha256:hash(manifest),catalogSha256:selected.pin.catalogSha256,
  budgets:manifest.budgets,schedule:{revision:'a'.repeat(64),expiresAt:new Date(NOW+60000).toISOString(),operations:[{operation:manifest.allowedOperations[0],chargeMicrousd:1}]}});
 const mutationPolicy={async check(call){
  const {selection}=call;assert.equal(call.selectionSha256,hash(selection));state.policies.push(selection);
  const mutation=!['list_scheduled_tasks','cancel_scheduled_task'].includes(selection.operation);
  const receipt={authorized:state.allowed,selectionSha256:call.selectionSha256,binding,scopes:scopes(),selectedClientId:clientId,
   destinationResolution:mutation?{reference:selection.request.destinationReference,destinationId:'meri-inbox'}:null,
   limits:mutation?{maxCostMicrousd:2000,maxRuntimeSeconds:90,retryLimit:1}:null,checkedAtMs:now(),expiresAtMs:NOW+10000};
  state.receiptHook?.(receipt,call);await state.policyHook?.(call);return receipt;
 }};
 const config={sessions,commandContext,allocationJson,template:{taskId:id(20),version:1,manifestSha256:hash(manifest)},workflow:{taskQueue:'meri-schedules',workflowIdPrefix:'meri/schedules'},scheduleOwner,policy:mutationPolicy,now,newId:()=>id(state.ids++),limits:{maxRequestMs:1000,maxFactBytes:65536,retryLimit:0}};
 const context=createScheduleRuntimeContext(config),call=(operation='schedule_task',changes={})=>({credential:session.credential,operation,request:request(),deadlineMs:now()+900,...changes});
 async function acknowledge(intent){const saved={intent,bindingSha256:hash({intent,source:'synthetic approved lifecycle'})},check=()=>{};await owner.claim(saved,check);await owner.markDispatching(saved,check);await owner.commitKnown(saved,check);}
 const approve=(prepared,changes={})=>snapshotScheduleCall('Execute',{intent:prepared.intent,callerIdentity:{tenantId:binding.tenantId,actorId:binding.actorId},deadlineMs:now()+800,
  approval:{proposalId:prepared.intent.intentId,commandSha256:prepared.intentSha256,decision:'approved',decidedAt:new Date(now()).toISOString(),expiresAt:new Date(now()+800).toISOString(),approver:{tenantId:binding.tenantId,actorId:binding.actorId},policyRevision:state.policyRevision,...changes}},now());
 return {state,config,context,call,scopes,owner,sql,acknowledge,approve,close:()=>sessions.close()};
}

test('construction is inert and requires an actual matching allocation plus explicit policy',async()=>{
 const f=await fixture();try{const before=[f.state.fetches.length,f.state.reads,f.state.ids];createScheduleRuntimeContext(f.config);assert.deepEqual([f.state.fetches.length,f.state.reads,f.state.ids],before);
  assert.throws(()=>createScheduleRuntimeContext({...f.config,policy:{}}),{code:'SCHEDULE_CONTEXT_CONFIGURATION'});
  assert.throws(()=>createScheduleRuntimeContext({...f.config,template:{...f.config.template,manifestSha256:'0'.repeat(64)}}),{code:'SCHEDULE_CONTEXT_CONFIGURATION'});
  const allocated=JSON.parse(f.config.allocationJson);allocated.run.actorId='another';assert.throws(()=>createScheduleRuntimeContext({...f.config,allocationJson:JSON.stringify(allocated)}));
 }finally{f.close();}
});

test('canonical normalization is exposed without context and hostile request authority stays inert',async()=>{
 const f=await fixture();try{const input=validators.normalizeRequest('schedule_task',request());assert.equal(input.taskInstruction,'Summarize authorized activity.');assert.equal(input.destinationReference,'Meri inbox');
  assert.deepEqual(validators.normalizeRequest('list_scheduled_tasks',{}),{afterScheduleId:null,limit:20,historyLimit:10});
  let touched=0;const raw=request();Object.defineProperty(raw,'taskInstruction',{enumerable:true,get(){touched++;return 'forged';}});await assert.rejects(f.context.resolve(f.call('schedule_task',{request:raw})));assert.equal(touched,0);
  const before=f.state.fetches.length;await assert.rejects(f.context.resolve(f.call('schedule_task',{request:{...request(),owner:{actorId:'forged'}}})));assert.equal(f.state.fetches.length,before);
 }finally{f.close();}
});

test('actual opaque session and native adapters produce exact owner, generic task, fixed workflow and capped proposal',async()=>{
 const f=await fixture();try{const out=await f.context.resolve(f.call()),p=out.prepared.intent;
  assert.deepEqual(p.projection.owner,{tenantId:binding.tenantId,actorId:binding.actorId});assert.deepEqual(p.projection.scopes,f.scopes());
  assert.deepEqual(p.configuration.task,f.config.template);assert.equal(p.configuration.workflow.workflowType,'meriScheduledDispatchWorkflow');assert.equal(p.configuration.workflow.taskQueue,'meri-schedules');
  assert.equal(p.projection.maxCostMicrousd,1000);assert.equal(p.projection.maxRuntimeSeconds,60);assert.equal(p.projection.retryLimit,0);assert.equal(out.context.scheduleContext.approval,null);
  assert.equal(p.projection.destinationId,'meri-inbox');assert.equal(out.prepared.proposal.taskInstruction,'Summarize authorized activity.');assert.equal(out.prepared.intentSha256,hash(p));
  assert.equal(f.state.ids,102);assert.ok(f.state.fetches.some(r=>r.url.endsWith('/membership')));assert.equal(JSON.stringify(out).includes('synthetic-native'),false);
 }finally{f.close();}
});

test('capture/replay release permission is current but never allocates an identity',async()=>{
 const f=await fixture();try{for(let n=0;n<2;n++){const fact=await f.context.authorizeRequest(f.call());assert.deepEqual(fact.binding,binding);assert.deepEqual(fact.scopes,f.scopes());assert.equal(fact.selectedClientId,clientId);assert.ok(fact.checkedAtMs<=fact.expiresAtMs);}
  assert.equal(f.state.ids,100);assert.equal(f.state.reads,0);assert.deepEqual(f.state.policies.map(p=>p.phase),['before_preparation_release','before_preparation_release']);
  f.state.allowed=false;await assert.rejects(f.context.authorizeRequest(f.call()),{code:'SCHEDULE_CONTEXT_POLICY'});assert.equal(f.state.ids,100);
 }finally{f.close();}
});

test('approval reconstructs the identical intent without reminting and rejects changed hidden template/destination',async()=>{
 const f=await fixture();try{const initial=await f.context.resolve(f.call()),proposal=initial.prepared.proposal;f.state.now+=10;
  const approved=await f.context.resolve(f.call('schedule_task',{proposal}));assert.deepEqual(approved.prepared.intent,initial.prepared.intent);assert.equal(f.state.ids,102);
  const other=createScheduleRuntimeContext({...f.config,template:{...f.config.template,version:2}});await assert.rejects(other.resolve(f.call('schedule_task',{proposal})),{code:'SCHEDULE_CONTEXT_STALE'});
  f.state.receiptHook=r=>{r.destinationResolution.destinationId='other-inbox';};await assert.rejects(f.context.resolve(f.call('schedule_task',{proposal})),{code:'SCHEDULE_CONTEXT_POLICY'});
 }finally{f.close();}
});

test('update and cancel use real owner generations and preserve original identity/creation fields',async()=>{
 const f=await fixture();try{const created=await f.context.resolve(f.call());await f.acknowledge(created.prepared.intent);const original=created.prepared.intent.projection;
  const update=await f.context.resolve(f.call('update_scheduled_task',{request:{scheduleId:original.scheduleId,...request()}}));assert.equal(update.prepared.intent.expectedGeneration,1);assert.equal(update.prepared.intent.generation,2);
  for(const key of ['scheduleId','owner','temporalScheduleId','createdAt'])assert.deepEqual(update.prepared.intent.projection[key],original[key]);
  const cancelled=await f.context.resolve(f.call('cancel_scheduled_task',{request:{scheduleId:original.scheduleId,mode:'pause',note:'explicit pause',running:'leave',runs:[]}}));
  assert.equal(cancelled.prepared.intent.projection.state,'paused');assert.equal(cancelled.context.scheduleContext.taskResolution,null);assert.equal(cancelled.context.scheduleContext.limitResolution,null);
  const row=f.sql.state.projections.get(binding.tenantId+':'+original.scheduleId);row.active_intent=id(999);
  await assert.rejects(f.context.resolve(f.call('update_scheduled_task',{request:{scheduleId:original.scheduleId,...request()}})),{code:'SCHEDULE_CONTEXT_STALE'});
 }finally{f.close();}
});

test('schedule mutation during policy lookup is fenced before the context is released',async()=>{
 const f=await fixture();try{const created=await f.context.resolve(f.call());await f.acknowledge(created.prepared.intent);const scheduleId=created.prepared.intent.projection.scheduleId;
  f.state.policyHook=()=>{f.sql.state.projections.get(binding.tenantId+':'+scheduleId).active_intent=id(888);};
  await assert.rejects(f.context.resolve(f.call('update_scheduled_task',{request:{scheduleId,...request()}})),{code:'SCHEDULE_CONTEXT_STALE'});
 }finally{f.close();}
});

test('authorization-only sees unresolved/cancelled truth without admitting another mutation or minting IDs',async()=>{
 for(const kind of ['unresolved','cancelled']){
  const f=await fixture();try{
   const created=await f.context.resolve(f.call());await f.acknowledge(created.prepared.intent);const scheduleId=created.prepared.intent.projection.scheduleId;
   const raw={scheduleId,mode:'delete',note:'explicit delete',running:'leave',runs:[]};
   if(kind==='cancelled'){const cancelled=await f.context.resolve(f.call('cancel_scheduled_task',{request:raw}));await f.acknowledge(cancelled.prepared.intent);}
   else f.sql.state.projections.get(binding.tenantId+':'+scheduleId).active_intent=id(777);
   const count=f.state.ids,call=f.call('cancel_scheduled_task',{request:raw}),fact=await f.context.authorizeRequest(call);
   assert.deepEqual(fact.binding,binding);assert.equal(f.state.ids,count);
   const observed=f.state.policies.at(-1).currentSchedule;
   assert.equal(observed.activeIntent,kind==='unresolved'?id(777):null);assert.equal(observed.projection.state,kind==='cancelled'?'cancelled':'active');assert.equal(observed.generation,kind==='cancelled'?2:1);
   assert.equal(observed.intent.generation,observed.generation);
   f.state.allowed=false;await assert.rejects(f.context.authorizeRequest(call),{code:'SCHEDULE_CONTEXT_POLICY'});assert.equal(f.state.ids,count);
   f.state.allowed=true;await assert.rejects(f.context.resolve(call),{code:'SCHEDULE_CONTEXT_STALE'});
  }finally{f.close();}
 }
});

test('authorization-only reads a generation-zero claim and rejects changed or corrupt snapshots',async()=>{
 const f=await fixture();try{
  const created=await f.context.resolve(f.call()),intent=created.prepared.intent,scheduleId=intent.projection.scheduleId;
  await f.owner.claim({intent,bindingSha256:hash({intent,source:'synthetic unresolved claim'})},()=>{});
  const call=f.call('update_scheduled_task',{request:{scheduleId,...request()}}),count=f.state.ids;
  await f.context.authorizeRequest(call);assert.equal(f.state.ids,count);assert.equal(f.state.policies.at(-1).currentSchedule.generation,0);assert.equal(f.state.policies.at(-1).currentSchedule.intent,null);
  f.state.policyHook=()=>{f.sql.state.projections.get(binding.tenantId+':'+scheduleId).active_intent=id(778);};
  await assert.rejects(f.context.authorizeRequest(call),{code:'SCHEDULE_CONTEXT_STALE'});assert.equal(f.state.ids,count);
  f.state.policyHook=null;f.sql.state.projections.get(binding.tenantId+':'+scheduleId).active_intent=null;
  await assert.rejects(f.context.authorizeRequest(call),{code:'SCHEDULE_CONTEXT_STALE'});
 }finally{f.close();}
});

test('native revocation after a positive mutation policy withholds context',async()=>{
 const f=await fixture();try{f.state.policyHook=()=>{f.state.revoked=true;};await assert.rejects(f.context.resolve(f.call()));assert.equal(f.state.policies.length,1);}
 finally{f.close();}
});

test('membership revision changes and a late policy acknowledgement release no context',async()=>{
 for(const kind of ['membership','deadline']){
  const f=await fixture();try{f.state.policyHook=()=>{if(kind==='membership')f.state.membershipRevision='changed';else f.state.now+=2000;};
   await assert.rejects(f.context.resolve(f.call()));assert.equal(f.state.policies.length,1);
  }finally{f.close();}
 }
});

test('authorization rechecks native and policy for each actual phase and binds exact intent/approver',async()=>{
 const f=await fixture();try{const out=await f.context.resolve(f.call()),b=f.approve(out.prepared),before=f.state.fetches.length;
  await out.authorize({phase:'before_claim',binding:b});await out.authorize({phase:'before_dispatch',binding:b});assert.ok(f.state.fetches.length>before);
  assert.deepEqual(f.state.policies.slice(-2).map(p=>p.phase),['before_claim','before_dispatch']);
  const changed=structuredClone(b);changed.intent.projection.destinationId='elsewhere';await assert.rejects(out.authorize({phase:'before_claim',binding:changed}),{code:'SCHEDULE_CONTEXT_ACCESS_DENIED'});
  const unapproved=structuredClone(b);delete unapproved.approval;await assert.rejects(out.authorize({phase:'before_claim',binding:unapproved}),{code:'SCHEDULE_CONTEXT_ACCESS_DENIED'});
  await assert.rejects(out.authorize({phase:'before_claim',binding:f.approve(out.prepared,{approver:{tenantId:binding.tenantId,actorId:'other'}})}),{code:'SCHEDULE_CONTEXT_ACCESS_DENIED'});
  f.state.allowed=false;await assert.rejects(out.authorize({phase:'before_release',binding:b}),{code:'SCHEDULE_CONTEXT_POLICY'});
 }finally{f.close();}
});

test('a narrowed policy or native policy revision cannot reuse prior positive authorization',async()=>{
 const f=await fixture();try{const out=await f.context.resolve(f.call()),b=f.approve(out.prepared);
  f.state.receiptHook=r=>{r.limits.maxCostMicrousd=10;};await assert.rejects(out.authorize({phase:'before_dispatch',binding:b}),{code:'SCHEDULE_CONTEXT_POLICY'});
  f.state.receiptHook=null;f.state.policyRevision='p2';await assert.rejects(out.authorize({phase:'before_dispatch',binding:b}));
 }finally{f.close();}
});

for(const kind of ['hash','binding','scope','client','future','expired','extra'])test(`closed mutation policy refuses ${kind} receipt`,async()=>{
 const f=await fixture();try{f.state.receiptHook=r=>{
  if(kind==='hash')r.selectionSha256='0'.repeat(64);if(kind==='binding')r.binding={...binding,writerFence:2};if(kind==='scope')r.scopes=[];if(kind==='client')r.selectedClientId=id(55);
  if(kind==='future')r.checkedAtMs=NOW+1;if(kind==='expired')r.expiresAtMs=NOW;if(kind==='extra')r.assumedAdmin=true;
 };await assert.rejects(f.context.resolve(f.call()));}finally{f.close();}
});

test('list uses canonical defaults and current native owner, with null mutation resolutions',async()=>{
 const f=await fixture();try{const out=await f.context.resolve(f.call('list_scheduled_tasks',{request:{}}));assert.deepEqual(out.prepared.input,{afterScheduleId:null,limit:20,historyLimit:10});
  assert.deepEqual(out.context.scheduleContext.owner,{tenantId:binding.tenantId,actorId:binding.actorId});assert.equal(f.state.ids,100);assert.equal(f.state.reads,0);
  const b=snapshotScheduleCall('List',{selection:out.prepared.selection,callerIdentity:out.prepared.context.callerIdentity,deadlineMs:NOW+800},NOW);await out.authorize({phase:'before_list',binding:b});
 }finally{f.close();}
});

test('expired and cancelled requests never reach mutation policy or allocate identities',async()=>{
 const f=await fixture();try{await assert.rejects(f.context.authorizeRequest(f.call('schedule_task',{deadlineMs:NOW})));const cancellation=new AbortController();cancellation.abort();
  await assert.rejects(f.context.resolve(f.call('schedule_task',{signal:cancellation.signal})));assert.equal(f.state.policies.length,0);assert.equal(f.state.ids,100);
 }finally{f.close();}
});

test('human cancel proposal binds server-resolved actual targets and refuses caller-selected executions',async()=>{
 const f=await fixture();try{
  const created=await f.context.resolve(f.call());await f.acknowledge(created.prepared.intent);
  const request={scheduleId:created.prepared.intent.projection.scheduleId,mode:'pause',note:'Stop this actual job',running:'request_cancel',runs:[]},call=f.call('cancel_scheduled_task',{request});
  await assert.rejects(f.context.resolve(call),{code:'SCHEDULE_CONTEXT_UNAVAILABLE'});
  let runs=[{workflowId:'actual-native-execution',runId:id(900)}],calls=0;
  const context=createScheduleRuntimeContext({...f.config,runCancellation:{async prepare(v){calls++;assert.deepEqual(v.callerIdentity,created.prepared.intent.projection.owner);assert.deepEqual(v.scopes,f.scopes());assert.deepEqual(v.request,request);return structuredClone(runs);}}});
  const prepared=await context.resolve(call);assert.deepEqual(prepared.prepared.input.runs,runs);assert.deepEqual(prepared.prepared.intent.cancel.runs,runs);assert.deepEqual(prepared.prepared.proposal.cancel.runs,runs);
  const replay=await context.resolve({...call,proposal:prepared.prepared.proposal});assert.equal(replay.prepared.intentSha256,prepared.prepared.intentSha256);
  runs=[{workflowId:'new-actual-execution',runId:id(901)}];await assert.rejects(context.resolve({...call,proposal:prepared.prepared.proposal}),{code:'SCHEDULE_CONTEXT_STALE'});
  const before=calls;await assert.rejects(context.resolve({...call,request:{...request,runs}}),{code:'SCHEDULE_CONTEXT_REQUEST'});assert.equal(calls,before);
 }finally{f.close();}
});
