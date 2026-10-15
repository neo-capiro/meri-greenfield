/** Actual session/journal/lifecycle/Temporal adapter over scripted SQL and RPC scopes.
 * No PostgreSQL, Temporal server, native task, provider or credential is claimed. */
import test from 'node:test';import assert from 'node:assert/strict';
import {lifecycleFixture,binding,scopes,id,versions} from './lifecycle-fixture.mjs';
import {createConversationLifecycleService} from '../lifecycle/service.mjs';
import {createTemporalConversationDispatcher} from '../temporal-dispatch.mjs';
import {createPostgresConversationStore} from '../postgres-store.mjs';
import {hash} from '../boundary.mjs';
const check=()=>{},controlId=id(900),pauseId=id(901);
async function fixture(mode='resume'){
 const f=await lifecycleFixture(),calls={starts:[],continued:[],controls:[],scopes:[]},hooks={};let rpcDeadline,rpcSignal,n=910;
 const connection={async withDeadline(deadline,fn){rpcDeadline=deadline;return fn();},async withAbortSignal(signal,fn){rpcSignal=signal;calls.scopes.push({deadline:rpcDeadline,signal});return fn();}};
 const client={connection,workflow:{async start(name,options){calls.starts.push({name,options,deadline:rpcDeadline,signal:rpcSignal});await hooks.start?.({signal:rpcSignal,deadlineMs:rpcDeadline});},getHandle(workflowId){return {async signal(name,input){if(name==='meriControlsAvailable'){calls.controls.push({workflowId,input});return;}assert.equal(name,'meriLifecycleContinued');calls.continued.push({workflowId,input,deadline:rpcDeadline,signal:rpcSignal});await hooks.continued?.({signal:rpcSignal,deadlineMs:rpcDeadline});},async cancel(){}};}}};
 const dispatcher=createTemporalConversationDispatcher({client,taskQueue:'transition-synthetic',lifecycle:true}),journal={...f.store.lifecycle,async finishTransition(...args){await hooks.beforeFinish?.();const out=await (hooks.finish??f.store.lifecycle.finishTransition)(...args);await hooks.afterFinish?.(out);return out;}},store={...f.store,lifecycle:journal};
 const service=createConversationLifecycleService({service:f.service,store,dispatcher,checkpoints:f.checkpoints,nativeAdmission:f.nativeAdmission,approvals:f.approvals,sessions:f.sessions,newId:()=>id(n++),maxRequestMs:3000});
 await f.running();f.state.checkCurrentBinding=b=>f.store.nextRuns.current(b,check);
 await f.control({controlId:pauseId,intent:'pause'});await f.claim(pauseId);await f.checkpoint(pauseId);
 const proof=f.proofs.get(id(220)),input={controlId,intent:mode,checkpointId:proof.checkpoint.checkpointId,checkpointSha256:proof.checkpointSha256};
 const run=(options={})=>service.control({credential:f.credential,input,...options});
 const saved=()=>f.state.controls.get(`${binding.tenantId}:${controlId}`)?.projection;
 const mapping=()=>{const p=saved();return {credential:f.credential,controlId,sourceBinding:binding,targetBinding:p.target.binding,admissionReceiptId:p.target.admissionReceiptId,retirementReceiptId:p.retirement?.retirementReceiptId??null};};
 return {...f,calls,hooks,service,run,saved,mapping,input};
}
test('composed canonical session, journal and Temporal dispatcher resume one successor and read APPLIED without effects',async()=>{
 const f=await fixture();try{const result=await f.run();assert.equal(result.state,'APPLIED');assert.equal(f.state.runs.size,2);assert.equal(f.calls.starts.length,1);assert.equal(f.calls.continued.length,1);assert.equal(f.saved().state,'APPLIED');
  const verified=await f.sessions.verifyTransition({...f.mapping(),purpose:'receipt-readback',deadlineMs:Date.now()+1000});assert.match(verified.transitionSha256,/^[a-f0-9]{64}$/);assert.equal(f.calls.starts.length,1);assert.equal(f.calls.continued.length,1);
  await assert.rejects(f.sessions.verifyTransition({...f.mapping(),purpose:'dispatch-start',deadlineMs:Date.now()+1000}),/SESSION_REFUSED/);assert.equal(f.saved().state,'APPLIED');
  await assert.rejects(f.run(),/SESSION_REFUSED/);assert.equal(f.calls.starts.length,1,'historical-source retry never dispatches');assert.equal(f.calls.continued.length,1);
 }finally{f.close();}
});
for(const effect of ['start','continued'])for(const shorter of ['target','admission','retirement'])test(`parked ${effect} RPC receives the shorter ${shorter} deadline and no later effect dispatches`,{timeout:5000},async()=>{
 const f=await fixture();let release;try{
  const entered=Promise.withResolvers(),late=Promise.withResolvers();release=late.resolve;let cutoff;
  const originalAdmit=f.nativeAdmission.admit,originalRetire=f.nativeAdmission.retire;
  if(shorter==='admission')f.nativeAdmission.admit=async value=>{const receipt=await originalAdmit(value);cutoff=Date.now()+220;return {...receipt,expiresAtMs:cutoff};};
  if(shorter==='retirement')f.nativeAdmission.retire=async value=>{const receipt=await originalRetire(value);cutoff=Date.now()+220;return {...receipt,expiresAtMs:cutoff};};
  if(shorter==='target')f.state.targetDeadline=Date.now()+220;
  f.hooks[effect]=async call=>{entered.resolve(call);await late.promise;};
  const started=Date.now(),pending=f.run().then(value=>({value}),error=>({error})),call=await Promise.race([entered.promise,pending.then(outcome=>{throw outcome.error??Error('effect did not enter');})]);
  const deadline=shorter==='target'?f.state.targetDeadline:cutoff;assert.ok(call.deadlineMs<=deadline);assert.ok(call.deadlineMs>started);const outcome=await pending;
  assert.match(outcome.error?.message??'',/LIFECYCLE_EFFECT_UNKNOWN/);assert.equal(call.signal.aborted,true,'Temporal withAbortSignal receives cancellation');assert.ok(Date.now()-started<1500,'outer effect is bounded by the verified short deadline');assert.equal(f.saved().state,'UNKNOWN');assert.equal(f.calls.starts.length,1);assert.equal(f.calls.continued.length,effect==='start'?0:1);
  release();await new Promise(resolve=>setImmediate(resolve));assert.equal(f.saved().state,'UNKNOWN','late ACK cannot restore DISPATCHING or APPLIED');await assert.rejects(f.run());assert.equal(f.calls.starts.length,1);assert.equal(f.calls.continued.length,effect==='start'?0:1);
 }finally{release?.();f.close();}
});
test('target cancellation between commit authorization and finish transaction prevents APPLIED',async()=>{
 const f=await fixture();try{f.hooks.beforeFinish=async()=>{await f.store.append(f.saved().target.binding,{eventId:id(930),createdAt:new Date().toISOString(),type:'run.status',data:{state:'cancelled',reasonCode:'USER_CANCELLED'}},check);};await assert.rejects(f.run(),/LIFECYCLE_EFFECT_UNKNOWN/);assert.equal(f.saved().state,'UNKNOWN');assert.equal(f.calls.starts.length,1);assert.equal(f.calls.continued.length,1);}finally{f.close();}
});
test('lost APPLIED COMMIT ACK reconciles original in-flight receipt without a second dispatch',async()=>{
 const f=await fixture();try{let lost=false;const pool={async connect(){const client=await f.pool.connect();let committingApplied=false;return {async query(sql,p=[]){const out=await client.query(sql,p);if(sql.startsWith('UPDATE meri_conversations.controls')&&p[2]?.input?.controlId===controlId&&p[2]?.state==='APPLIED')committingApplied=true;if(sql==='COMMIT'&&committingApplied&&!lost){lost=true;throw Error('lost APPLIED commit acknowledgement');}return out;},release:error=>client.release(error)};}};
  const unknown=createPostgresConversationStore({pool,transitionAuthority:{async readCurrent({binding:b}){const current=await f.store.nextRuns.current(b,check);return {binding:current.binding,scopes:current.scopes,policyRevision:current.policyRevision,selectedClientId:id(5),checkedAtMs:Date.now(),expiresAtMs:Date.now()+30000};}}});
  // Current-run receipts include reserved; the trusted port exposes only its exact schema.
  const original=unknown.lifecycle.finishTransition;f.hooks.finish=(...args)=>original(...args);
  const out=await f.run();assert.equal(lost,true);assert.equal(out.state,'APPLIED');assert.equal(f.saved().state,'APPLIED');assert.equal(f.calls.starts.length,1);assert.equal(f.calls.continued.length,1);
 }finally{f.close();}
});
for(const targetCancel of [false,true])test(`cancellation after APPLIED commit preserves APPLIED${targetCancel?' even when target becomes terminal':''}`,async()=>{
 const f=await fixture(),abort=new AbortController();try{f.hooks.afterFinish=async()=>{if(targetCancel)await f.store.append(f.saved().target.binding,{eventId:id(931),createdAt:new Date().toISOString(),type:'run.status',data:{state:'cancelled',reasonCode:'USER_CANCELLED'}},check);abort.abort();};const outcome=await f.run({signal:abort.signal}).then(value=>({value}),error=>({error}));assert.equal(f.saved().state,'APPLIED');if(!targetCancel)assert.equal(outcome.value?.state,'APPLIED');else assert.match(outcome.error?.message??'',/LIFECYCLE_EFFECT_UNKNOWN/);assert.equal(f.calls.starts.length,1);assert.equal(f.calls.continued.length,1);}finally{f.close();}
});
test('canonical reader refuses a changed receipt and coherent target-lineage substitution before another effect',async()=>{
 const f=await fixture();try{f.hooks.start=async()=>{const row=f.state.controls.get(`${binding.tenantId}:${controlId}`);row.projection.target.admissionReceiptId=id(940);row.projection_sha256=hash(row.projection);};await assert.rejects(f.run(),/LIFECYCLE_EFFECT_UNKNOWN/);assert.equal(f.calls.starts.length,1);assert.equal(f.calls.continued.length,0);assert.equal(f.saved().state,'UNKNOWN');}finally{f.close();}
});
test('fresh revocation after start refuses continued and historical replay sends nothing',async()=>{
 const f=await fixture();try{f.hooks.start=async()=>{f.state.revoked=true;};await assert.rejects(f.run(),/LIFECYCLE_EFFECT_UNKNOWN/);assert.equal(f.saved().state,'UNKNOWN');assert.equal(f.calls.starts.length,1);assert.equal(f.calls.continued.length,0);await assert.rejects(f.run());assert.equal(f.calls.starts.length,1);}finally{f.close();}
});

for(const changed of ['source-binding','target-envelope','target-conversation'])test(`canonical transition reader refuses coherent ${changed} corruption`,async()=>{
 const f=await fixture();try{await f.run();const p=f.saved(),target=[...f.state.runs.values()].find(row=>row.run_id===p.target.binding.runId);
  if(changed==='source-binding'){const source=[...f.state.runs.values()].find(row=>row.run_id===binding.runId);source.projection.binding.workerId=id(945);source.projection_sha256=hash(source.projection);}
  if(changed==='target-envelope'){target.continuation.continuation.contextSha256='e'.repeat(64);target.continuation_sha256=hash(target.continuation);}
  if(changed==='target-conversation'){const row=f.state.conversations.get(`${binding.tenantId}:${target.conversation_id}`);row.projection.owner.actorId='other';row.projection_sha256=hash(row.projection);}
  await assert.rejects(f.store.lifecycle.readTransition({sourceBinding:binding,controlId,deadlineMs:Date.now()+1000},check));assert.equal(f.calls.starts.length,1);assert.equal(f.calls.continued.length,1);
 }finally{f.close();}
});
test('fork transition locks source and separately owned target in deterministic code-unit order and never notifies continued',async()=>{
 const f=await fixture('fork');try{const admit=f.nativeAdmission.admit;f.nativeAdmission.admit=async input=>{const p=await admit(input);return {...p,binding:{...p.binding,conversationId:id(0)}};};const out=await f.run();assert.equal(out.state,'APPLIED');assert.equal(f.calls.starts.length,1);assert.equal(f.calls.continued.length,0);assert.notEqual(out.targetBinding.conversationId,binding.conversationId);
  const locks=[],pool={async connect(){const client=await f.pool.connect();return {async query(sql,p=[]){if(sql.startsWith('SELECT pg_advisory_xact_lock'))locks.push(p[0]);return client.query(sql,p);},release:error=>client.release(error)};}};
  const store=createPostgresConversationStore({pool,transitionAuthority:{async readCurrent({binding:b}){const r=await f.store.nextRuns.current(b,check);return {binding:r.binding,scopes:r.scopes,selectedClientId:id(5),policyRevision:r.policyRevision,checkedAtMs:Date.now(),expiresAtMs:Date.now()+1000};}}});
  const p=await store.lifecycle.readTransition({sourceBinding:binding,controlId,deadlineMs:Date.now()+1000},check);assert.equal(p.intent,'fork');assert.equal(p.retirementReceiptId,null);assert.equal(p.retirementExpiresAtMs,null);assert.deepEqual(locks.slice(-2),[`${binding.tenantId}:${out.targetBinding.conversationId}`,`${binding.tenantId}:${binding.conversationId}`]);
 }finally{f.close();}
});

test('cancellation during postcommit target context preserves original session for bounded APPLIED readback',async()=>{
 const f=await fixture(),abort=new AbortController();try{let interrupted=0;f.state.onTransitionContext=async({transition,signal})=>{if(transition.state==='APPLIED'&&!interrupted){interrupted++;abort.abort();assert.equal(signal.aborted,true);}};const result=await f.run({signal:abort.signal});assert.equal(result.state,'APPLIED');assert.equal(interrupted,1);assert.equal(f.saved().state,'APPLIED');assert.equal(f.calls.starts.length,1);assert.equal(f.calls.continued.length,1);}finally{f.close();}
});
test('fork DISPATCHING cannot authorize a continued purpose',async()=>{
 const f=await fixture('fork');try{f.hooks.start=async()=>{assert.equal(f.saved().state,'DISPATCHING');await assert.rejects(f.sessions.verifyTransition({...f.mapping(),purpose:'dispatch-continued',deadlineMs:Date.now()+1000}),/SESSION_REFUSED/);};const result=await f.run();assert.equal(result.state,'APPLIED');assert.equal(f.calls.starts.length,1);assert.equal(f.calls.continued.length,0);}finally{f.close();}
});
test('canonical third lifecycle run makes the prior transition target historical; old sessions dispatch nothing',async()=>{
 const f=await fixture();try{
  const second=(await f.run()).targetBinding;f.state.context.binding=second;
  const credential=(await f.sessions.issue({identityCredential:'synthetic-second-run'})).credential;
  for(const state of ['starting','running'])await f.store.append(second,{eventId:id(state==='starting'?970:971),createdAt:new Date().toISOString(),type:'run.status',data:{state,reasonCode:null}},check);
  await f.service.control({credential,input:{controlId:id(972),intent:'pause'}});
  const pending=(await f.service.nextControls({credential,binding:second})).controls.find(p=>p.command.controlId===id(972));
  await f.service.claimControl({credential,binding:second,input:{controlId:id(972),commandSha256:pending.commandSha256}});
  const source=await f.store.read(second,{},check),proof=structuredClone(f.proofs.get(id(220)));
  proof.checkpoint.checkpointId=id(974);proof.checkpoint.binding=second;proof.checkpoint.workspace.binding=second;proof.checkpoint.workspaceSha256=hash(proof.checkpoint.workspace);proof.checkpoint.lastEventSequence=source.lastSequence;proof.checkpointSha256=hash(proof.checkpoint);proof.sourceRequestSha256=hash(source.request);proof.contextSha256=hash({window:source.request.window,skill:source.request.skill,scopes});f.proofs.set(id(974),proof);
  await f.service.recordCheckpoint({credential,binding:second,input:{controlId:id(972),checkpointId:id(974),checkpointSha256:proof.checkpointSha256}});
  f.nativeAdmission.retire=async({binding:b})=>({binding:b,retirementReceiptId:id(978),expiresAtMs:Date.now()+30000});
  f.nativeAdmission.admit=async({sourceBinding:b,scopes})=>({binding:{...b,runId:id(975),attemptId:id(976),workerId:id(977),writerFence:b.writerFence+1},scopes,selectedClientId:id(5),admissionReceiptId:id(979),targetSessionId:null,expiresAtMs:Date.now()+30000});
  const input={controlId:id(973),intent:'resume',checkpointId:id(974),checkpointSha256:proof.checkpointSha256},third=await f.service.control({credential,input});assert.equal(third.state,'APPLIED');assert.equal(third.targetBinding.writerFence,3);assert.equal(f.state.runs.size,3);
  await assert.rejects(f.store.lifecycle.readTransition({sourceBinding:binding,controlId,deadlineMs:Date.now()+1000},check));
  const starts=f.state.starts,continued=f.state.continued;await assert.rejects(f.service.control({credential,input}),/SESSION_REFUSED/);assert.equal(f.state.starts,starts);assert.equal(f.state.continued,continued);assert.equal(f.calls.starts.length,2);assert.equal(f.calls.continued.length,2);
 }finally{f.close();}
});
