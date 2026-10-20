/** Pre-deploy rehearsal of one first turn against the real control run-owner path under measured Core latencies.
 *
 * Composed for real: the product runner (assembleConversationRunner with the remote task's lease-derived budget), the
 * conversation activity and its lifecycle pump, the native capability client, control's worker-http, the action session owner,
 * the native identity context, the Core membership gate, and the conversation and lifecycle services.
 * In process: Core (identity, membership, context) with per-route latency, plus Clerk's 2 s timeout answered as 401;
 * the task verifier's identity+context join (its grant/SQL/ECS checks are not modelled, so live is slower); an in-memory store;
 * the SDK (the real message sequence: system/init, stream events, assistant, result); runner/runtime and
 * runner/checkpoint/complete, whose owners are outside worker-http (they answer at once and are not counted).
 *
 * Each turn reports time to first and last published text, time to result, Core calls and request durations per operation,
 * the runner's first-failure line, control's refusals with what its owners threw, and any host clock step (recorded only:
 * rehearsal-support.mjs keeps Date.now monotonic). Quiet and the live median must complete (the gate); the live tail, a Clerk
 * timeout and a 40-delta reply are reported. POSIX only (the remote task's SDK directories).
 * Run: node --test --test-concurrency=1 apps/runtime/test/first-turn-rehearsal.test.mjs */
import test from 'node:test';
import assert from 'node:assert/strict';
import {AsyncLocalStorage} from 'node:async_hooks';
import {mkdtempSync,mkdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {performance} from 'node:perf_hooks';
import {createNativeIdentityContext} from '../native-authority/identity-context.mjs';
import {createCoreMembershipGate} from '../../control/product-access/core-membership.mjs';
import {createActionSessionOwner} from '../../control/action-host/session/owner.mjs';
import {createConversationService} from '../../control/conversations/service.mjs';
import {createConversationLifecycleService} from '../../control/conversations/lifecycle/service.mjs';
import {createWorkerRunApplication} from '../worker-http.mjs';
import {createNativeCapabilityClient} from '../native-client.mjs';
import {assembleConversationRunner} from '../conversation-runner.mjs';
import {continuationFixture,id} from '../../worker/conversation/continuation/test/fixtures.mjs';
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {runOwnerOperations} from '../../../packages/contracts/runtime-0.2/validate.mjs';
import {runnerStartupBudget} from '../../../packages/runtime/runner-load-budget.mjs';
import {withRunnerDiagnostics} from '../runner-runtime-diagnostics.mjs';
import {CORE_PROFILES,recordHostClockSteps} from './rehearsal-support.mjs';
import {createTurnTelemetry} from '../telemetry/turn-context.mjs';
import {countingFetch} from '../telemetry/counting.mjs';
import {createTurnPublishObserver} from '../telemetry/turn-publish.mjs';
import {createConversationInputApplication} from '../../control/conversations/input/http.mjs';
import {observeCompletionPublication} from '../native-authority/completion-capture.mjs';

const CLERK_TIMEOUT_MS=2000;
const delay=(ms,signal)=>new Promise((resolve,reject)=>{if(signal?.aborted)return reject(Error('aborted'));const timer=setTimeout(()=>{signal?.removeEventListener('abort',abort);resolve();},ms);
 const abort=()=>{clearTimeout(timer);reject(Error('aborted'));};signal?.addEventListener('abort',abort,{once:true});});

/** One composed first turn. `clerkTimeoutAt` makes that (1-based) Core call wait Core's Clerk timeout and answer `clerkStatus`:
 * 401 as Core does today, 503 once Core reports the timeout as unavailable. The SDK streams the reply as `deltas` text deltas
 * (the product sets includePartialMessages), `deltaMs` apart (0: all at once). `leaseElapsedMs` is the original's lease already
 * spent when the runner starts (live: acknowledgement, allocation and the ECS task start); the lease itself is the live
 * allocation's 900 s runtime. */
export async function rehearseFirstTurn({profile,clerkTimeoutAt,clerkStatus=401,deltas=2,deltaMs=0,leaseElapsedMs=0}){
 const latency=CORE_PROFILES[profile];if(!latency)throw Error('unknown profile');
 const f=continuationFixture('resume'),{target}=f;target.sourceRequest.skill=null;target.request.skill=null;
 const binding=f.binding,versions=target.versions,scopes=target.scopes,clientId=id(5),principal={tenantId:binding.tenantId,actorId:binding.actorId};
 const sessionId=f.continuation.checkpoint.sessionId,request=target.sourceRequest,expiry=()=>Date.now()+600000;
 const operation=new AsyncLocalStorage(),calls={},durations={},refusals=[],started=performance.now(),at=()=>Math.round(performance.now()-started),marks={};let coreCalls=0;
 // Capture the exact bytes sent to the production stdout emitter without changing the Core latency profiles.
 const telemetryLines=[],writeTelemetry=line=>telemetryLines.push(JSON.parse(line));
 const turnTelemetry=createTurnTelemetry({service:'control',write:writeTelemetry,now:Date.now});
 const runnerTelemetry=createTurnTelemetry({service:'runner',write:writeTelemetry,now:Date.now});
 const count=route=>{const op=operation.getStore()??'other';calls[op]??={requests:0,core:0};calls[op].core++;calls[op][route]=(calls[op][route]??0)+1;};
 // worker-http answers every refusal as WORKER_REQUEST_REFUSED and the identity context as NATIVE_AUTHORITY_UNAVAILABLE, so the
 // owners record what they threw, with its cause chain.
 const thrown=[],traced=(name,owner)=>{const copy={};for(const key of Reflect.ownKeys(owner)){const value=owner[key];copy[key]=typeof value!=='function'?value:async(...args)=>{
   try{return await value.apply(owner,args);}catch(error){const chain=[];for(let e=error;e&&chain.length<4;e=e.cause)chain.push(e.code??e.message??String(e));
    if(thrown.length<20)thrown.push({where:`${name}.${String(key)}`,atMs:at(),chain});throw error;}};}return Object.freeze(copy);};
 async function rawCoreFetch(url,init){
  const path=new URL(url).pathname,route=path.endsWith('/identity')?'identity':path.endsWith('/context')?'context':path.endsWith('/membership')?'membership':null;
  if(!route)throw Error('unknown local Core route');count(route);
  if(++coreCalls===clerkTimeoutAt){await delay(CLERK_TIMEOUT_MS,init.signal);return Response.json({message:'Application authority unavailable'},{status:clerkStatus});}
  await delay(latency[route],init.signal);const now=Date.now(),body=JSON.parse(init.body);
  if(route==='identity')return Response.json({principal,identityRevision:'identity-revision',checkedAtMs:now,expiresAtMs:expiry()});
  if(route==='membership')return Response.json({...principal,status:'active',role:'standard_user',permissions:[],clientIds:[clientId],membershipRevision:'membership-revision',checkedAtMs:now,expiresAtMs:expiry()});
  return Response.json({principal,identityRevision:'identity-revision',identitySha256:body.identitySha256,conversationId:body.conversationId,selectedClientId:clientId,contextRevision:'context-revision',checkedAtMs:now,expiresAtMs:expiry()});
 }
 const coreFetch=countingFetch(rawCoreFetch,turnTelemetry);
 // Control: the dynamic first conversation selects this run; the task verifier keeps its own run-bound context.
 const runFact=()=>JSON.stringify({binding,policyRevision:scopes[0].policyRevision,deadlineMs:expiry(),checkedAtMs:Date.now()});
 const currentOwner={async currentRun(){return runFact();},async withCurrentAllocation(){throw Error('unused');}},limits={maxRequestMs:25000,maxFactBytes:65536};
 const identityContext=traced('identity',createNativeIdentityContext({origin:'https://core.synthetic.invalid',commandContext:{binding:{...binding,conversationId:id(901),runId:id(902)},clientResolution:{reference:clientId,clientId}},
  currentOwner,fetchImpl:coreFetch,enabled:true,now:Date.now,limits,admitInitialConversation:async()=>runFact()}));
 const verifierContext=traced('verifier',createNativeIdentityContext({origin:'https://core.synthetic.invalid',commandContext:{binding,clientResolution:{reference:clientId,clientId}},currentOwner,fetchImpl:coreFetch,enabled:true,now:Date.now,limits}));
 const membership=createCoreMembershipGate({origin:'https://core.synthetic.invalid',identityContext,fetchImpl:coreFetch,now:Date.now,limits});
 const sessions=createActionSessionOwner({mode:'process-local',verifyIdentity:identityContext.verifyIdentity,resolveContext:identityContext.resolveContext,
  membership:{admit:membership.admit,recheck:membership.recheck},now:Date.now,limits:{maxSessions:16,maxRequestMs:25000,maxTtlMs:300000,maxFactBytes:65536}});
 const saved={run:{binding,state:'queued',scopes,versions,createdAt:new Date().toISOString(),policyRevision:scopes[0].policyRevision},request,lastSequence:1},events=[];
 const unused=async()=>{throw Error('unused');};
 const store={accept:unused,async append(_binding,event){const durable={contractVersion:'0.1.0',...event,binding,sequence:++saved.lastSequence,scopes};events.push(durable);if(event.type==='run.status')saved.run.state=event.data.state;
   if(event.type==='message.delta'){marks.firstText??=at();marks.lastText=at();}return durable;},async read(){return structuredClone(saved);},
  lifecycle:{begin:unused,change:unused,get:unused,async controls(){return [];},claim:unused,checkpoint:unused,readCheckpoint:unused,async execution(){return null;},continuation:unused,cancel:unused,readStopFence:unused}};
 const service=createTurnPublishObserver({telemetry:turnTelemetry}).observeRunOwner(createConversationLifecycleService({service:createConversationService({sessions,store,dispatcher:{start:unused,cancel:unused,signal:unused},versions,maxRequestMs:25000}),
  store,dispatcher:{start:unused,cancel:unused,signal:unused},sessions,maxRequestMs:25000,reconcileOriginal:unused,checkpoints:{read:unused},
  retention:null})); // no retention gate, as control.mjs passes without one (an explicit decision since L3)
 const native={async call(name,input,{signal}={}){if(name!=='worker/authorize')throw Error('unexpected native operation');
  const verified=await verifierContext.verifyIdentity({credential:'synthetic-native',deadlineMs:Date.now()+25000,signal});
  await verifierContext.resolveContext({identityCredential:'synthetic-native',identity:verified,identitySha256:hash(verified),hints:{conversationId:binding.conversationId,runId:binding.runId},deadlineMs:Date.now()+25000,signal});
  const now=Date.now();return {binding,operation:input.operation,inputSha256:input.inputSha256,identityCredential:'synthetic-native',scopes,selectedClientId:clientId,
   policyRevision:scopes[0].policyRevision,authorizationDecisionId:'synthetic-decision',checkedAtMs:now,expiresAtMs:expiry()};}};
 // The session owner is passed as itself: worker-http finds its registered current-state issuer by the owner object, and a traced
 // copy would fall back to the plain session port (issue, authenticate, read: 10 more Core calls per load and per publish).
 const control=createWorkerRunApplication({service:traced('service',service),sessions,native:traced('native',native),configuration:{limits:{requestMs:25000,requestBytes:131072}},now:Date.now,turnTelemetry});
 // Runner → control: run-owner operations go to worker-http exactly as prepared-candidate.mjs rewrites them.
 const outside=async(name)=>{
  if(name==='runner/runtime')return {binding,versions,proxyUrl:'https://proxy.example.invalid',proxyCredential:'synthetic-proxy',model:'synthetic-model',deadlineMs:Date.now()+600000,maxTurns:2,maxCostMicroUSD:1,maxOutputBytes:65536};
  if(name==='runner/checkpoint/complete'){const cp=structuredClone(f.continuation.checkpoint);cp.binding=binding;cp.workspace.binding=binding;cp.workspaceSha256=hash(cp.workspace);cp.sessionId=sessionId;
   // The real completion journal returns its committed terminal event. Preserve that behavior in this pre-existing
   // checkpoint fixture and exercise the same observation seam; no additional authority call or delay is introduced.
   await turnTelemetry.within(binding,async()=>{const durable=await store.append(binding,{eventId:id(104),createdAt:new Date().toISOString(),type:'run.status',data:{state:'completed',reasonCode:null}});
    observeCompletionPublication({events:[durable]});});
   return {checkpoint:cp,checkpointSha256:hash(cp),sourceRequestSha256:hash(request),contextSha256:hash({window:null,skill:null,scopes}),sessionId,resumeSessionAt:null,verificationId:id(103),
    workspaceReadbackSha256:cp.workspaceSha256,opaqueSessionReadbackSha256:cp.opaqueSession.sha256,checkedAtMs:Date.now(),expiresAtMs:Date.now()+60000};}
  throw Error('unexpected '+name);};
 const root=mkdtempSync(join(tmpdir(),'meri-first-turn-rehearsal-'));mkdirSync(join(root,'config'),{mode:0o700});
 const remoteTask={original:{binding,versions,executionKey:hash(binding),executionId:hash(binding),planSha256:'b'.repeat(64),expiresAtMs:Date.now()+900000-leaseElapsedMs},
  preparationIntent:{workspace:join(root,binding.conversationId),configParentDirectory:join(root,'config'),secureStorageDirectory:join(root,'secure'),
   launchTemplate:{command:'/opt/claude',args:[],env:{CLAUDE_SECURESTORAGE_CONFIG_DIR:join(root,'secure')}},executableSha256:'a'.repeat(64),imageSha256:'b'.repeat(64),
   runnerSha256:'c'.repeat(64),sdkOptionsSha256:'d'.repeat(64),authoritySha256:'f'.repeat(64)}};
 // remote-conversation-runner.mjs gives runner/load the startup budget's load stage; every other call passes its own allowance.
 const startup=runnerStartupBudget({requestMs:25000,shutdownMs:1000,originalExpiresAtMs:remoteTask.original.expiresAtMs}).stages;
 const client=createNativeCapabilityClient({configuration:{origin:'https://control.synthetic.invalid',maxResponseBytes:2097152},credential:'synthetic-task',loadMaxRequestMs:startup.load.maxMs,
  fetch:async(url,init)=>{const name=new URL(url).pathname.slice('/v1/'.length),op=name.slice('runner/'.length);calls[name]??={requests:0,core:0};calls[name].requests++;
   if(!Object.hasOwn(runOwnerOperations,op))return Response.json(await outside(name));
   const begun=performance.now();
   try{const response=await operation.run(name,()=>control.handle(new Request(url.replace('/v1/runner/','/internal/conversations/'),init)));
    // A refused publish is swallowed by the activity's fence, so control's answer is recorded here.
    if(response.status!==200)refusals.push({operation:name,atMs:at(),status:response.status,code:(await response.clone().json().catch(()=>null))?.error?.code??null});
    return response;}
   finally{(durations[name]??=[]).push(Math.round(performance.now()-begun));}}});
 const text=t=>({type:'stream_event',session_id:sessionId,parent_tool_use_id:null,event:{type:'content_block_delta',index:0,delta:{type:'text_delta',text:t}}});
 const parts=deltas===2?['Hello',' from the rehearsal.']:Array.from({length:deltas},(_,i)=>i?` word${i}`:'Hello'),reply=parts.join('');
 const execute=assembleConversationRunner({configuration:{binding,versions,workspace:'/workspace/'+binding.conversationId,proxyOrigin:'https://proxy.example.invalid',limits:{requestMs:25000,shutdownMs:1000},remoteTask},
  native:client,credentialForBinding:async()=>'synthetic-current-task-capability',
  query(args){return {async *[Symbol.asyncIterator](){
   yield {type:'system',subtype:'init',session_id:sessionId};marks.init=at();await args.prompt[Symbol.asyncIterator]().next();
   yield {type:'stream_event',session_id:sessionId,parent_tool_use_id:null,event:{type:'message_start',message:{id:'msg_rehearsal',role:'assistant',content:[]}}};
   yield {type:'stream_event',session_id:sessionId,parent_tool_use_id:null,event:{type:'content_block_start',index:0,content_block:{type:'text',text:''}}};
   for(const part of parts){if(deltaMs)await delay(deltaMs);yield text(part);}
   yield {type:'stream_event',session_id:sessionId,parent_tool_use_id:null,event:{type:'content_block_stop',index:0}};
   yield {type:'assistant',session_id:sessionId,parent_tool_use_id:null,message:{id:'msg_rehearsal',role:'assistant',content:[{type:'text',text:reply}]}};
   yield {type:'result',subtype:'success',is_error:false,session_id:sessionId,result:reply};},async interrupt(){return {still_queued:[]};},close(){}};}});
 let outcome;
 // The runner's own diagnostics context, as cli.mjs runs it: the first failure's stage, code and site, the line live logs carry.
 const failures=[];
 // Host wall-clock steps, recorded only: rehearsal-support.mjs keeps this process's Date.now from going back.
 const clock=recordHostClockSteps(at);
 try{
  // This rehearsal starts from a pre-admitted store fixture. Exercise the real HTTP admission timestamp hook with that
  // receipt; allocation/Send authority costs remain outside this rehearsal's existing runner baseline.
  const admission=createConversationInputApplication({service:{async admitInput(){return {...structuredClone(saved),replayed:false};}},turnTelemetry,now:Date.now});
  const admitted=await admission.handle(new Request('https://control.synthetic.invalid/api/conversations/input/admit',{
   method:'POST',headers:{authorization:'Bearer synthetic-session','content-type':'application/json'},body:JSON.stringify({requestId:request.requestId,prompt:request.prompt})}));
  assert.equal(admitted.status,200,'the seeded admission receipt passes the real input route');
  outcome=await withRunnerDiagnostics(()=>execute({binding}),{write:line=>failures.push(line.trim()),binding,turnTelemetry:runnerTelemetry}).then(value=>({value}),error=>({error:error?.code??String(error)}));
 }
 finally{clock.stop();sessions.close();turnTelemetry.close();runnerTelemetry.close();rmSync(root,{recursive:true,force:true});}
 // Request durations (ms) of the run-owner operations, as the runner's native client sees them: the margin against each budget.
 const median=list=>[...list].sort((a,b)=>a-b)[Math.floor((list.length-1)/2)];
 const perOperation=Object.fromEntries(Object.entries(calls).sort().map(([name,v])=>[name,durations[name]?{...v,medianMs:median(durations[name]),maxMs:Math.max(...durations[name])}:v]));
 const published=events.map(e=>e.type==='run.status'?e.data.state:e.type);
 return {profile,clerkTimeoutAt:clerkTimeoutAt??null,...(clerkTimeoutAt?{clerkStatus}:{}),deltas,deltaMs,leaseElapsedMs,outcome:outcome.value?.state??outcome.error,initMs:marks.init??null,firstTextMs:marks.firstText??null,
  lastTextMs:marks.lastText??null,resultMs:at(),coreCalls:coreCalls,perOperation,deltasPublished:published.filter(type=>type==='message.delta').length,
  statuses:published.filter(type=>type!=='message.delta'),firstFailure:failures.find(line=>line.startsWith('RUNNER_FIRST_FAILURE'))??null,refusals,thrown,hostClockSteps:clock.steps,telemetry:telemetryLines};
}

const posix={skip:process.platform==='win32'&&'POSIX ownership of the remote task SDK directories',timeout:600000};
for(const profile of ['quiet','live-median'])test(`first turn completes under the ${profile} Core profile`,posix,async t=>{
 const r=await rehearseFirstTurn({profile});t.diagnostic(JSON.stringify(r));
 assert.equal(r.outcome,'completed',JSON.stringify(r));assert.ok(r.firstTextMs!==null,'text was published');
 const stages=r.telemetry.filter(line=>line.event==='meri.turn.stage');
 const expected=['send.admit.received','runner.process.start','runner.load.done','run.starting','run.running','runner.query.start','delta.first.durable','run.terminal'];
 for(const stage of expected)assert.equal(stages.filter(line=>line.stage===stage).length,1,`${stage} is emitted once`);
 // The process exists before Send. The durable control stages, and runner startup stages, each preserve their own order.
 for(const ordered of [['send.admit.received','run.starting','run.running','delta.first.durable','run.terminal'],['runner.process.start','runner.load.done','runner.query.start']]){
  const times=ordered.map(stage=>stages.find(line=>line.stage===stage).atMs);
  assert.deepEqual(times,[...times].sort((a,b)=>a-b),`stage timestamps ordered: ${ordered.join(', ')}`);
 }
 const summaries=r.telemetry.filter(line=>line.event==='meri.turn.summary');assert.equal(summaries.length,1);
 assert.equal(summaries[0].state,'completed');assert.ok(Number.isFinite(summaries[0].firstTextMs));assert.ok(summaries[0].resultMs>=summaries[0].firstTextMs);
 const counters=r.telemetry.filter(line=>line.event==='meri.turn.counters'&&line.service==='control');assert.equal(counters.length,1);
 const measured=Object.values(counters[0].core).reduce((sum,statuses)=>sum+Object.values(statuses).reduce((s,n)=>s+n,0),0);
 assert.equal(measured,r.coreCalls,'production counters equal the independent rehearsal Core counter');
 if(profile==='live-median'&&measured!==224)t.diagnostic(`P0 plan reference is 224 Core calls; this source/environment measured ${measured}. Compare the same base suite; telemetry must equal the independent counter above.`);
});
for(const [profile,clerkTimeoutAt,clerkStatus] of [['live-tail'],['live-median',40,401],['live-median',40,503]])
 test(`first turn under the ${profile} Core profile${clerkTimeoutAt?` with a Clerk timeout answered ${clerkStatus}`:''} (reported)`,posix,async t=>{
  t.diagnostic(JSON.stringify(await rehearseFirstTurn({profile,clerkTimeoutAt,clerkStatus})));
 });
// A realistic reply streams tens of text deltas, and every publication is separately authorized: deltas read while one is in
// flight share the next. 90 s of lease already spent is the live first attempt's acknowledgement plus allocation and task start.
for(const profile of ['quiet','live-median','live-tail'])
 test(`a 40-delta reply under the ${profile} Core profile with 90 s of lease spent (reported)`,{...posix,timeout:1200000},async t=>{
  t.diagnostic(JSON.stringify(await rehearseFirstTurn({profile,deltas:40,leaseElapsedMs:90000})));
 });
// Every delta at once is the best case for sharing. Paced at 500 ms a delta (far slower than a live model streams), the reply
// outlasts a median publication, and each publication after the first carries what arrived while the one before it was in flight.
test('a 40-delta reply streamed over 20 s under the live-median Core profile with 90 s of lease spent (reported)',{...posix,timeout:1200000},async t=>{
 t.diagnostic(JSON.stringify(await rehearseFirstTurn({profile:'live-median',deltas:40,deltaMs:500,leaseElapsedMs:90000})));
});
