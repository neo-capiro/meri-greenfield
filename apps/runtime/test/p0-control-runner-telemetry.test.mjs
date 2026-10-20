/** P0 integration: real handlers and native transport; synthetic data, no network or credentials. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createTurnTelemetry} from '../telemetry/turn-context.mjs';
import {createConversationInputApplication} from '../../control/conversations/input/http.mjs';
import {applicationFixture,binding} from '../../control/conversations/test/application-fixture.mjs';
import {withRunnerDiagnostics,markRunnerStage} from '../runner-runtime-diagnostics.mjs';
import {createNativeCapabilityClient} from '../native-client.mjs';
import {validateConfiguration} from '../config.mjs';
import {candidateFixture} from './prepared-candidate-fixture.mjs';
import {observeCompletionPublication} from '../native-authority/completion-capture.mjs';
import {createPostgresConversationStore} from '../../control/conversations/postgres-store.mjs';
import {lifecycleFixture,retireAllocation,scopes,id} from '../../control/conversations/test/lifecycle-fixture.mjs';
import {createRunReconciler} from '../../control/conversations/run-reconciler.mjs';

function capture(service,now=Date.now){const lines=[];return {lines,telemetry:createTurnTelemetry({service,now,write:line=>lines.push(JSON.parse(line))})};}

test('admission keeps handler-entry t0, adopts pre-binding work and deduplicates a durable replay',async()=>{
 const f=await applicationFixture({initialInput:true});let at=Date.now();const {lines,telemetry}=capture('control',()=>at);
 try{
  await f.service.allocateInput({credential:f.credential,input:f.input});
  const saved=await f.service.admitInput({credential:f.credential,input:f.input});
  const app=createConversationInputApplication({now:()=>at,turnTelemetry:telemetry,service:{async admitInput(){telemetry.recordCore('identity','2xx',25);at+=25;return saved;}}});
  const post=()=>app.handle(new Request('https://meri.invalid/api/conversations/input/admit',{method:'POST',headers:{authorization:'Bearer synthetic-session','content-type':'application/json'},body:JSON.stringify(f.input)}));
  const enteredAt=at;assert.equal((await post()).status,200);assert.equal((await post()).status,200);
  const stages=lines.filter(line=>line.event==='meri.turn.stage');assert.equal(stages.length,1);assert.equal(stages[0].atMs,enteredAt);assert.equal(stages[0].stage,'send.admit.received');
  telemetry.counters(binding);assert.equal(lines.find(line=>line.event==='meri.turn.counters').core.identity['2xx'],2);
 }finally{f.close();telemetry.close();}
});

test('refused admission does not invent a run binding, and a failed telemetry writer cannot fail admitted HTTP',async()=>{
 const f=await applicationFixture({initialInput:true}),failed=capture('control');
 try{
  const app=createConversationInputApplication({turnTelemetry:failed.telemetry,service:{async admitInput(){throw Object.assign(Error('SESSION_REFUSED'),{code:'SESSION_REFUSED'});}}});
  const request=()=>new Request('https://meri.invalid/api/conversations/input/admit',{method:'POST',headers:{authorization:'Bearer synthetic-session','content-type':'application/json'},body:JSON.stringify(f.input)});
  assert.equal((await app.handle(request())).status,403);assert.equal(failed.lines.filter(line=>line.event==='meri.turn.stage').length,0);
  await f.service.allocateInput({credential:f.credential,input:f.input});const saved=await f.service.admitInput({credential:f.credential,input:f.input});
  const telemetry=createTurnTelemetry({service:'control',write(){throw Error('synthetic writer failure');}});
  const succeeds=createConversationInputApplication({turnTelemetry:telemetry,service:{async admitInput(){return saved;}}});
  assert.equal((await succeeds.handle(request())).status,200);assert.ok(telemetry.telemetryDropped>0);telemetry.close();
 }finally{f.close();failed.telemetry.close();}
});

test('runner native request counts and first-failure JSON preserve pinned text and error identity',async()=>{
 let now=1000;const records=[],text=[],telemetry=createTurnTelemetry({service:'runner',now:()=>now,write:line=>records.push(JSON.parse(line))});
 const failure=Object.assign(Error('DEADLINE'),{code:'DEADLINE'});
 await assert.rejects(withRunnerDiagnostics(async()=>{
  const native=createNativeCapabilityClient({configuration:{origin:'https://native.invalid',maxResponseBytes:131072},credential:'synthetic-capability',now:()=>now,fetch:async()=>{now+=8;return Response.json({ok:true});}});
  assert.deepEqual(await native.call('runner/load',{binding}),{ok:true});
  markRunnerStage('activity-query');throw failure;
 },{binding,processStartedAtMs:500,turnTelemetry:telemetry,write:line=>text.push(line)}),error=>error===failure);
 assert.equal(text.length,2);assert.match(text[0],/^RUNNER_FIRST_FAILURE origin=runtime stage=activity-query code=DEADLINE class=ERROR exit=none signal=none cause=none msg=[a-f0-9]{12} site=/u);
 assert.equal(text[1],'RUNNER_RUNTIME_FAILED stage=activity-query code=DEADLINE\n');
 const first=records.find(line=>line.event==='meri.turn.stage');assert.equal(first.stage,'runner.process.start');assert.equal(first.atMs,500);
 const twin=records.find(line=>line.event==='meri.turn.failure');assert.equal(twin.runId,binding.runId);assert.equal(twin.code,'DEADLINE');assert.equal(twin.timeoutClass,'deadline');
 const counters=records.filter(line=>line.event==='meri.turn.counters');assert.equal(counters.length,1);assert.equal(counters[0].runOwner['runner/load']['2xx'],1);assert.equal(counters[0].runOwnerMs,8);telemetry.close();
});

test('nested runner execution shares binding and flushes counters only once',async()=>{
 const {lines,telemetry}=capture('runner');
 await withRunnerDiagnostics(()=>withRunnerDiagnostics(async()=>{telemetry.recordRunOwner('runner/publish','503',12);},{binding}),{binding,turnTelemetry:telemetry});
 assert.equal(lines.filter(line=>line.event==='meri.turn.stage'&&line.stage==='runner.process.start').length,1);
 assert.equal(lines.filter(line=>line.event==='meri.turn.counters').length,1);telemetry.close();
});

test('completion observes only committed journal events and preserves publication identity',async()=>{
 const {lines,telemetry}=capture('control'),event={binding,type:'run.status',sequence:5,data:{state:'completed',reasonCode:null}},published={events:[event],state:'PUBLISHED'};
 await telemetry.within(binding,async()=>{
  assert.equal(observeCompletionPublication(published),published);
  observeCompletionPublication(published);observeCompletionPublication({state:'PUBLISHED',replayed:true});
  assert.equal(lines.filter(line=>line.event==='meri.turn.counters').length,0);
  telemetry.recordCore('identity','2xx',1);
 });
 const summary=lines.filter(line=>line.event==='meri.turn.summary');assert.equal(summary.length,1);assert.equal(summary[0].state,'completed');assert.equal(summary[0].t0Ms,null);
 assert.equal(lines.find(line=>line.event==='meri.turn.counters').core.identity['2xx'],1);telemetry.close();
});

test('durable store observer covers cancellation and never observes a refused transaction',async t=>{
 const f=await lifecycleFixture(),{lines,telemetry}=capture('control');t.after(()=>{f.close();telemetry.close();});await f.running();const seen=[];
 const store=createPostgresConversationStore({pool:f.pool,onPublished:event=>{seen.push(event);telemetry.bind(event.binding);telemetry.summary(event);throw Error('synthetic observer failure');}});
 const event={eventId:id(920),createdAt:new Date().toISOString(),type:'run.status',data:{state:'cancelled',reasonCode:'USER_CANCELLED'}};
 await assert.rejects(telemetry.provisional(()=>store.lifecycle.cancel({...binding,writerFence:binding.writerFence+1},event,()=>{},scopes)),{code:'STALE_WRITER'});assert.equal(seen.length,0);
 let saved;await telemetry.provisional(async()=>{saved=await store.lifecycle.cancel(binding,event,()=>{},scopes);telemetry.recordCore('current','2xx',1);});
 assert.equal(seen[0],saved);assert.equal((await store.read(binding,{},()=>{})).run.state,'cancelled');assert.equal(lines.find(line=>line.event==='meri.turn.summary').state,'cancelled');
 assert.equal(lines.find(line=>line.event==='meri.turn.counters').core.current['2xx'],1);
 await telemetry.provisional(()=>store.lifecycle.cancel(binding,event,()=>{},scopes));assert.equal(lines.filter(line=>line.event==='meri.turn.summary').length,1);
});

test('lost cancellation ACK observes only the existing validated stop-fence readback',async t=>{
 const f=await lifecycleFixture(),{lines,telemetry}=capture('control');t.after(()=>{f.close();telemetry.close();});await f.running();
 const store=createPostgresConversationStore({pool:f.pool,onPublished:event=>{telemetry.bind(event.binding);telemetry.summary(event);}}),event={eventId:id(921),createdAt:new Date().toISOString(),type:'run.status',data:{state:'cancelled',reasonCode:'USER_CANCELLED'}};
 f.state.commitUnknown=true;await assert.rejects(telemetry.provisional(()=>store.lifecycle.cancel(binding,event,()=>{},scopes)),{code:'STORE_COMMIT_UNKNOWN'});assert.equal(lines.filter(line=>line.event==='meri.turn.summary').length,0);f.state.commitUnknown=false;
 const result=await telemetry.provisional(()=>store.lifecycle.readStopFence({binding,scopes,eventId:event.eventId},()=>{}));assert.deepEqual(result,{state:'cancelled',cancelCommitted:true});assert.equal(lines.filter(line=>line.event==='meri.turn.summary').length,1);
});

test('run reconciler observes failed publication only after retirement is proven',async t=>{
 const f=await lifecycleFixture(),{lines,telemetry}=capture('control');t.after(()=>{f.close();telemetry.close();});await f.running();let retire=false;
 const store=createPostgresConversationStore({pool:f.pool,onPublished:event=>{telemetry.bind(event.binding);telemetry.summary(event);}}),reconciler=createRunReconciler({store,retirement:{async retire(){if(retire)await retireAllocation(store,binding);}}});
 assert.equal((await telemetry.provisional(()=>reconciler.reconcile({binding}))).outcome,'unknown');assert.equal(lines.filter(line=>line.event==='meri.turn.summary').length,0);
 retire=true;assert.deepEqual(await telemetry.provisional(()=>reconciler.reconcile({binding})),{outcome:'reconciled',state:'failed',reasonCode:'ATTEMPT_LOST'});
 assert.equal(lines.find(line=>line.event==='meri.turn.summary').state,'failed');assert.equal(lines.find(line=>line.event==='meri.turn.summary').reasonCode,'ATTEMPT_LOST');
 await telemetry.provisional(()=>reconciler.reconcile({binding}));assert.equal(lines.filter(line=>line.event==='meri.turn.summary').length,1);
});

test('log-only configuration accepts Preview/Production without granting a runner an OTLP exporter',()=>{
 const {configuration}=candidateFixture(),runner={version:1,profile:'isolated-preview',sourceEnabled:false,native:configuration.native,limits:configuration.limits,binding,versions:configuration.versions,workspace:'/workspace/'+binding.conversationId,proxyOrigin:'https://proxy.invalid'};
 for(const environment of ['Preview','Production']){
  assert.deepEqual(validateConfiguration({...configuration,telemetry:{environment}},'control').telemetry,{environment});
  assert.deepEqual(validateConfiguration({...runner,telemetry:{environment}},'conversation-runner').telemetry,{environment});
 }
 for(const telemetry of [{environment:'production'},{environment:'Preview',endpoint:'https://export.invalid'},{environment:'Preview',enabled:true},{environment:'Preview',other:true}])assert.throws(()=>validateConfiguration({...configuration,telemetry},'control'));
 assert.throws(()=>validateConfiguration({...runner,telemetry:{environment:'Production',enabled:true,endpoint:'https://export.invalid'}},'conversation-runner'));
 const legacy={enabled:false,endpoint:'https://export.invalid',serviceName:'meri-control'};
 assert.deepEqual(validateConfiguration({...configuration,telemetry:legacy},'control').telemetry,legacy);
 assert.equal(validateConfiguration(configuration,'control').telemetry,undefined);
});
