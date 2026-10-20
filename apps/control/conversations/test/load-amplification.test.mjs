/** The worker HTTP, native client, session, service and lifecycle load composition
 * against bounded, in-process Core responses. Task-verifier grant/SQL checks are
 * replaced with an instrumented fixed-run identity/context join; those checks
 * need their own tests and this fixture does not prove live DB/pool behavior.
 * Local import-only stubs are opt-in for a checkout without installed dependencies.
 * No external network, database, AWS, model, or credentials are used. */
import {registerHooks} from 'node:module';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {performance} from 'node:perf_hooks';
import assert from 'node:assert/strict';
import test from 'node:test';

const repo=fileURLToPath(new URL('../../../../',import.meta.url));
const packageParent=process.env.MERI_DIAGNOSTIC_DEPS_ROOT?pathToFileURL(resolve(process.env.MERI_DIAGNOSTIC_DEPS_ROOT,'package.json')).href:null;
const localStubs=process.env.MERI_DIAGNOSTIC_IMPORT_STUBS==='1';
const localZodParent=pathToFileURL(resolve(repo,'../fe/package.json')).href;
registerHooks({resolve(specifier,context,nextResolve){
  if(localStubs&&specifier==='@js-temporal/polyfill')return {url:new URL('./load-only-temporal-stub.mjs',import.meta.url).href,shortCircuit:true};
  if(localStubs&&specifier==='@anthropic-ai/claude-agent-sdk')return {url:new URL('./load-only-sdk-stub.mjs',import.meta.url).href,shortCircuit:true};
  if(localStubs&&specifier==='@aws-sdk/client-ecs')return {url:new URL('./load-only-ecs-stub.mjs',import.meta.url).href,shortCircuit:true};
  if(localStubs&&specifier==='@temporalio/client')return {url:new URL('./load-only-temporal-client-stub.mjs',import.meta.url).href,shortCircuit:true};
  if(localStubs&&specifier==='@capiro/meri-contracts/node')return {url:pathToFileURL(resolve(repo,'packages/contracts/validate.mjs')).href,shortCircuit:true};
  if(localStubs&&specifier==='zod')return nextResolve(specifier,{...context,parentURL:localZodParent});
  if(localStubs&&specifier==='./config.mjs'&&context.parentURL?.includes('/apps/runtime/'))return {url:new URL('./load-only-runtime-config-stub.mjs',import.meta.url).href,shortCircuit:true};
  try{return nextResolve(specifier,context);}catch(error){
    if(packageParent&&!specifier.startsWith('.')&&!specifier.startsWith('/')&&!specifier.startsWith('node:'))return nextResolve(specifier,{...context,parentURL:packageParent});
    throw error;
  }
}});
const imported=async path=>import(pathToFileURL(resolve(repo,path)).href);
const [{createNativeIdentityContext},{createCoreMembershipGate},{createActionSessionOwner},
  {createConversationService,loadWithLifecycle},{createConversationLifecycleService},{createWorkerRunApplication},
  {createNativeCapabilityClient},{createConversationActivity},{assembleConversationRunner},{runnerLoadBudget},{binding,scopes,versions,id,storeFixture},{canonicalSha256:hash},{createPostgresConversationStore}]=await Promise.all([
  'apps/runtime/native-authority/identity-context.mjs',
  'apps/control/product-access/core-membership.mjs',
  'apps/control/action-host/session/owner.mjs',
  'apps/control/conversations/service.mjs',
  'apps/control/conversations/lifecycle/service.mjs',
  'apps/runtime/worker-http.mjs',
  'apps/runtime/native-client.mjs',
  'apps/worker/conversation/activity.mjs',
  'apps/runtime/conversation-runner.mjs',
  'packages/runtime/runner-load-budget.mjs',
  'apps/control/conversations/test/store-fixture.mjs',
  'packages/contracts/validate.mjs',
  'apps/control/conversations/postgres-store.mjs',
].map(imported));

const delay=(ms,signal)=>new Promise((done,fail)=>{
  if(signal?.aborted)return fail(Error('aborted'));
  const timer=setTimeout(()=>{signal?.removeEventListener('abort',aborted);done();},ms);
  const aborted=()=>{clearTimeout(timer);fail(Error('aborted'));};
  signal?.addEventListener('abort',aborted,{once:true});
});
const gate=()=>({started:Promise.withResolvers(),release:Promise.withResolvers()});
async function one({mode,route='load',latencyMs=0,serverMs=3000,nativeMs=3000,loadNativeMs=nativeMs,callMs,signal,duringJournal,duringFinalRead,beforeInitialRead,duringTaskAuthorization,journalDelayMs=0,coreGate,storeReadGate,nextTurn=false,journalExtra=true,foreignStoredBinding=false,legacySessions=false,coreStatus,store:replayStore}={}){
  const started=performance.now(),counts={identity:0,context:0,membership:0,taskAuthorization:0,currentRun:0,read:0,append:0,journalExecution:0,retention:0,controls:0};
  const principal={tenantId:binding.tenantId,actorId:binding.actorId};
  const commandBinding=mode==='dynamic'?{...binding,conversationId:id(901),runId:id(902)}:binding;
  const clientId=id(5),expiry=()=>Date.now()+60000;
  const state={membershipStatus:'active',membershipRevision:'membership-revision',identityRevision:'identity-revision',identityRevoked:false,policyRevision:scopes[0].policyRevision,selectedClientId:clientId,retention:'servable'};
  async function coreFetch(url,init){
    const path=new URL(url).pathname;
    const route=path.endsWith('/identity')?'identity':path.endsWith('/context')?'context':path.endsWith('/membership')?'membership':null;
    if(!route)throw Error('unknown local Core route');
    counts[route]++;
    if(coreGate&&route==='identity'&&counts.identity===1){coreGate.started.resolve();await coreGate.release.promise;}
    await delay(typeof latencyMs==='function'?latencyMs(route,counts[route]):latencyMs,init.signal);
    // coreStatus answers chosen Core calls with an error status instead (503: did not answer; 401: refused).
    const failure=coreStatus?.(route,counts[route]);if(failure)return Response.json({error:'synthetic'},{status:failure});
    const at=Date.now(),body=JSON.parse(init.body);
    if(route==='identity')return state.identityRevoked?Response.json({error:'refused'},{status:403}):Response.json({principal,identityRevision:state.identityRevision,checkedAtMs:at,expiresAtMs:expiry()});
    if(route==='membership')return Response.json({...principal,status:state.membershipStatus,role:'standard_user',permissions:[],clientIds:[clientId],membershipRevision:state.membershipRevision,checkedAtMs:at,expiresAtMs:expiry()});
    return Response.json({principal,identityRevision:state.identityRevision,identitySha256:body.identitySha256,conversationId:body.conversationId,selectedClientId:state.selectedClientId,contextRevision:'context-revision',checkedAtMs:at,expiresAtMs:expiry()});
  }
  const runFact=()=>({binding,policyRevision:state.policyRevision,deadlineMs:expiry(),checkedAtMs:Date.now()});
  const identityContext=createNativeIdentityContext({origin:'https://core.synthetic.invalid',commandContext:{binding:commandBinding,clientResolution:{reference:clientId,clientId}},
    currentOwner:{async currentRun(){counts.currentRun++;return JSON.stringify(runFact());},async withCurrentAllocation(){throw Error('unused');}},
    fetchImpl:coreFetch,enabled:true,now:Date.now,limits:{maxRequestMs:serverMs,maxFactBytes:65536},
    ...(mode==='dynamic'?{admitInitialConversation:async()=>JSON.stringify(runFact())}:{})});
  // The admitted task verifier has a separate, run-bound fixed context even
  // when control selects a dynamic initial conversation.
  const verifierContext=createNativeIdentityContext({origin:'https://core.synthetic.invalid',commandContext:{binding,clientResolution:{reference:clientId,clientId}},
    currentOwner:{async currentRun(){counts.currentRun++;return JSON.stringify(runFact());},async withCurrentAllocation(){throw Error('unused');}},
    fetchImpl:coreFetch,enabled:true,now:Date.now,limits:{maxRequestMs:serverMs,maxFactBytes:65536}});
  const membership=createCoreMembershipGate({origin:'https://core.synthetic.invalid',identityContext,fetchImpl:coreFetch,now:Date.now,limits:{maxRequestMs:serverMs,maxFactBytes:65536}});
  const sessions=createActionSessionOwner({mode:'process-local',verifyIdentity:identityContext.verifyIdentity,resolveContext:identityContext.resolveContext,membership:{admit:membership.admit,recheck:membership.recheck},now:Date.now,
    limits:{maxSessions:4,maxRequestMs:serverMs,maxTtlMs:60000,maxFactBytes:65536}});
  // A plain copy is a legacy port, not the registered owner: it must retain the original paired observations.
  const sessionPort=legacySessions?{...sessions}:sessions;
  const saved={run:{binding,state:'queued',scopes,versions,createdAt:new Date().toISOString(),policyRevision:scopes[0].policyRevision},request:{requestId:id(6),prompt:'Synthetic only',skill:null,window:null,windowRequest:null},lastSequence:1};
  if(foreignStoredBinding)saved.run.binding={...binding,tenantId:'other-tenant'};
  const stub=async()=>{throw Error('unused');};
  const store=replayStore??{accept:stub,async append(){counts.append++;return {scopes};},async read(){counts.read++;if(counts.read===2)duringFinalRead?.({state,saved});if(storeReadGate&&counts.read===1){storeReadGate.started.resolve();await storeReadGate.release.promise;}return structuredClone(saved);},
    ...(nextTurn?{nextRuns:{async execution(){return {nextTurn:{fixtureMarker:'new-turn'}};}}}:{}),
    lifecycle:{begin:stub,change:stub,get:stub,async controls(){counts.controls++;return [];},claim:stub,checkpoint:stub,readCheckpoint:stub,async execution(){counts.journalExecution++;duringJournal?.({state,saved});await delay(journalDelayMs);return journalExtra?{fixtureMarker:'journal-read'}:null;},continuation:stub,cancel:stub,readStopFence:stub}};
  const dispatcher={start:stub,cancel:stub,signal:stub};
  const retention={async assertServable(){counts.retention++;if(state.retention!=='servable')throw Error('RETENTION_SUPPRESSED');}};
  const basic=createConversationService({sessions:sessionPort,store,dispatcher,versions,maxRequestMs:serverMs,retention});
  const service=createConversationLifecycleService({service:basic,store,dispatcher,sessions:sessionPort,maxRequestMs:serverMs,reconcileOriginal:stub,checkpoints:{read:stub},retention});
  const native={async call(operation,input,{signal}={}){if(operation!=='worker/authorize')throw Error('unexpected native operation');counts.taskAuthorization++;
    duringTaskAuthorization?.({state,count:counts.taskAuthorization});
    const verified=await verifierContext.verifyIdentity({credential:'synthetic-native',deadlineMs:Date.now()+serverMs,signal});
    await verifierContext.resolveContext({identityCredential:'synthetic-native',identity:verified,identitySha256:hash(verified),hints:{conversationId:binding.conversationId,runId:binding.runId},deadlineMs:Date.now()+serverMs,signal});
    if(counts.taskAuthorization===2)beforeInitialRead?.({state});
    const at=Date.now();return {binding,operation:input.operation,inputSha256:input.inputSha256,identityCredential:'synthetic-native',scopes,selectedClientId:clientId,
      policyRevision:scopes[0].policyRevision,authorizationDecisionId:'synthetic-decision',checkedAtMs:at,expiresAtMs:expiry()};}};
  const app=createWorkerRunApplication({service,sessions:sessionPort,native,configuration:{limits:{requestMs:serverMs,requestBytes:131072}},now:Date.now});
  let responseStatus;const statuses=[];
  const pendingServer=[];
  const client=createNativeCapabilityClient({configuration:{origin:'https://control.synthetic.invalid',maxResponseBytes:2097152},credential:'synthetic-task',now:Date.now,maxRequestMs:nativeMs,loadMaxRequestMs:loadNativeMs,
    fetch:async(url,init)=>{const request=app.handle(new Request(url.replace('/v1/runner/'+route,'/internal/conversations/'+route),init));pendingServer.push(request);const response=await request;responseStatus=response.status;statuses.push(response.status);return response;}});
  let outcome,value,serverSettled;
  const input=route==='load'?{binding}:route==='next-controls'?{binding,after:0}:{binding,event:{eventId:id(88),createdAt:new Date().toISOString(),type:'run.status',data:{state:'starting',reasonCode:null}}};
  const transport=client.call('runner/'+route,input,{deadlineMs:Date.now()+serverMs,signal,...(callMs===undefined?{}:{maxRequestMs:callMs})});
  try{value=await transport;outcome='200';}
  catch(error){outcome=error?.code??error?.message??'error';}
  finally{if(coreGate||storeReadGate){coreGate?.release.resolve();storeReadGate?.release.resolve();const timeout=new AbortController();
    serverSettled=await Promise.race([Promise.allSettled(pendingServer).then(()=>true),delay(1000,timeout.signal).then(()=>false,()=>false)]);timeout.abort();}sessions.close();}
  return {mode,latencyMs,serverMs,nativeMs,outcome,value,responseStatus,statuses,serverSettled,durationMs:Math.round(performance.now()-started),coreCalls:counts.identity+counts.context+counts.membership,counts};
}

test('fused runner/load keeps the original authority gates with bounded Core fanout',async()=>{
  const fixed=await one({mode:'fixed'}),dynamic=await one({mode:'dynamic'});
  assert.equal(fixed.outcome,'200',JSON.stringify(fixed));
  assert.equal(dynamic.outcome,'200',JSON.stringify(dynamic));
  assert.equal(fixed.value.fixtureMarker,'journal-read');
  assert.equal(dynamic.value.fixtureMarker,'journal-read');
  // Before: 31 (fixed) / 37 (dynamic); the worker no longer resolves its new session again after issuance.
  assert.equal(fixed.coreCalls,27,JSON.stringify(fixed));
  assert.equal(dynamic.coreCalls,32,JSON.stringify(dynamic));
  assert.deepEqual([fixed.counts.identity,fixed.counts.context,fixed.counts.membership],[9,8,10]);
  assert.deepEqual([dynamic.counts.identity,dynamic.counts.context,dynamic.counts.membership],[9,13,10]);
  for(const result of [fixed,dynamic]){
    assert.equal(result.counts.taskAuthorization,3);
    assert.equal(result.counts.append,0,'load must never publish');
    assert.equal(result.counts.journalExecution,1);
    assert.equal(result.counts.read,2,'initial and post-journal run/request reads');
    assert.equal(result.counts.retention,4,'before, across and after journal plus outer release');
  }
});

test('legacy session ports retain the original fresh pair at every load boundary',async()=>{
  for(const [mode,coreCalls] of [['fixed',51],['dynamic',62]]){
    const result=await one({mode,legacySessions:true});
    assert.equal(result.outcome,'200',JSON.stringify(result));assert.equal(result.coreCalls,coreCalls,JSON.stringify(result));
    assert.equal(result.counts.append,0,'legacy load must never publish');
    assert.equal(result.counts.taskAuthorization,3);assert.equal(result.counts.read,2);assert.equal(result.counts.retention,4);
    assert.equal(result.value.fixtureMarker,'journal-read');
  }
});

test('worker publish cross-checks its new session with the issuance observation; each service pass is one fused observation',async()=>{
  // [identity, context, membership]: the registered owner, then a plain session port.
  for(const [mode,owner,legacyCalls,ownerKinds,legacyKinds] of [['fixed',19,35,[7,6,6],[11,10,14]],['dynamic',22,42,[7,9,6],[11,17,14]]]){
    const current=await one({mode,route:'publish'}),legacy=await one({mode,route:'publish',legacySessions:true});
    for(const result of [current,legacy]){
      assert.equal(result.outcome,'200',JSON.stringify(result));
      assert.equal(result.counts.taskAuthorization,3);assert.equal(result.counts.append,1);assert.equal(result.counts.retention,2);
      assert.equal(result.counts.journalExecution,0);assert.deepEqual(result.value.scopes,scopes);
    }
    // Before: 27 (fixed) / 32 (dynamic) for the registered owner, whose service passes each resolved the session twice; a plain
    // port is unchanged. The owner returns what its issuance resolve observed and each service pass (before and after the write)
    // is one fused observation; a plain port issues and then observes, and keeps the authenticate + current-state pair per pass.
    assert.equal(current.coreCalls,owner,JSON.stringify(current));assert.equal(legacy.coreCalls,legacyCalls,JSON.stringify(legacy));
    assert.deepEqual([current.counts.identity,current.counts.context,current.counts.membership],ownerKinds);
    assert.deepEqual([legacy.counts.identity,legacy.counts.context,legacy.counts.membership],legacyKinds);
  }
});
test('the lifecycle control page is read with the task authority alone: two task verifies, no session',async()=>{
  // Before: 67 (fixed) / 82 (dynamic) Core calls: a task verify, a session issue and pair, a middle verify, the lifecycle
  // service's own session observations and gated history read on both sides of the journal read, and a final verify.
  for(const mode of ['fixed','dynamic']){
    const result=await one({mode,route:'next-controls'});
    assert.equal(result.outcome,'200',JSON.stringify(result));assert.equal(result.coreCalls,4,JSON.stringify(result));
    assert.deepEqual([result.counts.identity,result.counts.context,result.counts.membership],[2,2,0]);
    assert.equal(result.counts.taskAuthorization,2,'task verified before and after the read');assert.equal(result.counts.currentRun,4);
    assert.equal(result.counts.controls,1);assert.equal(result.counts.read,0,'no session-gated run read');assert.equal(result.counts.append,0);
    assert.deepEqual(result.value,{controls:[],nextControlSequence:0});
  }
});

test('the lifecycle control page answers well inside its 23 s allowance at the 10:26Z median Core latencies', {timeout:30000},async()=>{
  const latencyMs=route=>({identity:100,membership:300,context:500})[route];
  const result=await one({mode:'dynamic',route:'next-controls',latencyMs,serverMs:25000,nativeMs:3000,callMs:23000});
  assert.equal(result.outcome,'200',JSON.stringify(result));assert.equal(result.coreCalls,4);
  assert.ok(result.durationMs<3000,JSON.stringify(result));
});

test('35 ms serial Core responses fit the fused load deadline',async()=>{
  const result=await one({mode:'dynamic',latencyMs:35});
  assert.equal(result.outcome,'200',JSON.stringify(result));
  assert.equal(result.coreCalls,32);
  assert.ok(result.durationMs<3000,JSON.stringify(result));
});

test('native client retains its independent three-second cap',async()=>{
  const result=await one({mode:'dynamic',latencyMs:100,serverMs:5000,nativeMs:3000});
  assert.equal(result.outcome,'DEADLINE',JSON.stringify(result));
  assert.ok(result.durationMs>=2900&&result.durationMs<4000,JSON.stringify(result));
});

test('load budget retains the later startup stages and original-lease reserve',()=>{
  const budget=runnerLoadBudget({requestMs:25000,shutdownMs:10000,originalExpiresAtMs:1000000});
  assert.deepEqual(budget,{maxMs:23000,expiresAtMs:534000});
  assert.throws(()=>runnerLoadBudget({requestMs:12000,shutdownMs:1000,originalExpiresAtMs:1000000}),/RUNNER_LOAD_BUDGET_REFUSED/u);
  assert.throws(()=>runnerLoadBudget({requestMs:NaN,shutdownMs:1000,originalExpiresAtMs:100000}),/RUNNER_LOAD_BUDGET_REFUSED/u);
});

test('activity separates long load from three-second runtime preparation',async()=>{
  const saved={run:{binding,state:'queued',scopes,versions,createdAt:new Date(0).toISOString(),policyRevision:scopes[0].policyRevision},
    request:{requestId:id(6),prompt:'Synthetic only',skill:null,window:null,windowRequest:null},lastSequence:1};
  // The starting claim is accepted; every later publication fails, so no model call is reached. Reaching the setup stage shows
  // that runtime preparation completed under its own fresh bound after the long load.
  let clock=0,prepared=0,claims=0,stages=[];
  const runOwner={async load(){clock+=19000;return saved;},async append({event}){if(event.data?.state==='starting'){claims++;return;}throw Error('STOP_BEFORE_MODEL');}};
  const bounds={query:()=>{throw Error('MODEL_CALL_FORBIDDEN');},now:()=>clock,loadMaxMs:23000,diagnostics:{stage:stage=>stages.push(stage)}};
  const activity=createConversationActivity({runOwner,prepareRuntime:async()=>{prepared++;return {binding,versions,deadlineMs:clock+1000};},...bounds,loadExpiresAtMs:50000});
  await assert.rejects(activity({binding}),/EXECUTION_FAILED/u);
  assert.equal(claims,1,'the run is claimed before runtime preparation');
  assert.equal(prepared,1,'a 19-second load may reach runtime preparation');
  assert.ok(stages.includes('activity-setup'),'runtime preparation uses its own fresh bound');

  clock=0;prepared=0;claims=0;stages=[];
  const slowPreparation=createConversationActivity({runOwner,prepareRuntime:async()=>{prepared++;clock+=3001;return {binding,versions,deadlineMs:clock+1000};},...bounds,loadExpiresAtMs:50000});
  await assert.rejects(slowPreparation({binding}),/EXECUTION_FAILED/u);
  assert.equal(prepared,1);
  assert.ok(!stages.includes('activity-setup'),'runtime preparation still has a three-second cap');

  clock=0;prepared=0;claims=0;stages=[];
  const expiringOriginal=createConversationActivity({runOwner,prepareRuntime:async()=>{prepared++;throw Error('PREPARATION_MUST_NOT_START');},...bounds,loadExpiresAtMs:15000});
  await assert.rejects(expiringOriginal({binding}),/EXECUTION_FAILED/u);
  assert.equal(prepared,0,'the original lease reserve clips load below its 23-second ceiling');
  assert.equal(claims,0);
});

test('nested remote runner passes its load budget into the activity',async()=>{
  let clock=0,runtimeCalls=0;
  const saved={run:{binding,state:'queued',scopes,versions,createdAt:new Date(0).toISOString(),policyRevision:scopes[0].policyRevision},
    request:{requestId:id(6),prompt:'Synthetic only',skill:null,window:null,windowRequest:null},lastSequence:1};
  const executionKey=hash(binding),configuration={binding,versions,sourceEnabled:false,limits:{requestMs:25000,shutdownMs:10000},
    remoteTask:{original:{binding,versions,executionKey,executionId:executionKey,planSha256:'0'.repeat(64),expiresAtMs:1000000}}};
  const native={async call(operation,input){if(operation==='runner/load'){clock+=19000;return saved;}if(operation==='runner/publish'&&input.event.data?.state==='starting')return {};if(operation==='runner/runtime'){runtimeCalls++;throw Error('STOP_BEFORE_MODEL');}throw Error('UNEXPECTED_NATIVE_CALL');}};
  const execute=assembleConversationRunner({configuration,native,now:()=>clock,query:()=>{throw Error('MODEL_CALL_FORBIDDEN');}});
  await assert.rejects(execute({binding}),/EXECUTION_FAILED/u);
  assert.equal(runtimeCalls,1,'a 19-second load reaches runtime admission through nested runner wiring');
});

test('500 ms Core replies fit the unchanged 23-second load budget after removing duplicate observations', {timeout:30000},async()=>{
  const result=await one({mode:'dynamic',latencyMs:500,serverMs:25000,nativeMs:3000,loadNativeMs:23000});
  assert.equal(result.outcome,'200',JSON.stringify(result));
  assert.equal(result.coreCalls,32);
  assert.ok(result.durationMs>=16000&&result.durationMs<23000,JSON.stringify(result));
});

test('the original paired path exceeds that same 23-second budget at 500 ms per Core response', {timeout:30000},async()=>{
  const result=await one({mode:'dynamic',legacySessions:true,latencyMs:500,serverMs:25000,nativeMs:3000,loadNativeMs:23000});
  assert.equal(result.outcome,'DEADLINE',JSON.stringify(result));assert.equal(result.value,undefined);
  assert.ok(result.durationMs>=22500&&result.durationMs<25000,JSON.stringify(result));
});

test('conservative tail-heavy stress using observed per-route bounds fits the unchanged load budget', {timeout:30000},async t=>{
  // Aggregate, uncorrelated observations supplied for diagnosis: mean/p95/max in milliseconds.
  // Cycling mean,p95,mean,max,p95 is deliberately tail-heavy stress, NOT a reconstructed live distribution.
  const observed={identity:{mean:119,p95:193,max:579},context:{mean:341,p95:653,max:1201},membership:{mean:300,p95:535,max:1002}};
  let scheduledMs=0;
  const latencyMs=(route,count)=>{const v=observed[route],ms=[v.mean,v.p95,v.mean,v.max,v.p95][(count-1)%5];scheduledMs+=ms;return ms;};
  const result=await one({mode:'dynamic',latencyMs,serverMs:25000,nativeMs:3000,loadNativeMs:23000});
  t.diagnostic(JSON.stringify({profile:'conservative tail-heavy stress, not a reconstructed live distribution',scheduledMs,durationMs:result.durationMs,coreCalls:result.coreCalls,counts:result.counts,outcome:result.outcome}));
  assert.equal(result.outcome,'200',JSON.stringify(result));assert.equal(result.coreCalls,32);
  assert.deepEqual([result.counts.identity,result.counts.context,result.counts.membership],[9,13,10]);
  assert.equal(scheduledMs,15270);assert.ok(result.durationMs>=scheduledMs&&result.durationMs<23000,JSON.stringify(result));
  assert.equal(result.counts.taskAuthorization,3);assert.equal(result.counts.retention,4);
  assert.equal(result.counts.read,2);assert.equal(result.counts.append,0);assert.equal(result.counts.journalExecution,1);
  assert.equal(result.value.fixtureMarker,'journal-read');
});

test('only runner/load receives the longer native allowance',async()=>{
  const client=createNativeCapabilityClient({configuration:{origin:'https://control.synthetic.invalid',maxResponseBytes:1024},credential:'synthetic-task',
    maxRequestMs:50,loadMaxRequestMs:500,fetch:async(_url,init)=>{await delay(100,init.signal);return Response.json({ok:true});}});
  assert.deepEqual(await client.call('runner/load',{}),{ok:true});
  await assert.rejects(client.call('runner/publish',{}),error=>error?.code==='DEADLINE');
});

test('a parked Core response cannot release a receipt after cancellation',async()=>{
  const stopped=new AbortController(),parked=gate();
  const work=one({mode:'dynamic',serverMs:800,nativeMs:500,loadNativeMs:500,coreGate:parked,signal:stopped.signal});
  await parked.started.promise;stopped.abort();
  const result=await work;
  assert.equal(result.outcome,'CANCELLED',JSON.stringify(result));
  assert.equal(result.serverSettled,true,'control must settle after late Core release');
  assert.ok([403,408].includes(result.responseStatus),JSON.stringify(result));
  assert.equal(result.value,undefined);
});

test('a parked store read cannot release a receipt after cancellation',async()=>{
  const stopped=new AbortController(),parked=gate();
  const work=one({mode:'dynamic',serverMs:1500,nativeMs:1000,loadNativeMs:1000,storeReadGate:parked,signal:stopped.signal});
  await parked.started.promise;stopped.abort();
  const result=await work;
  assert.equal(result.outcome,'CANCELLED',JSON.stringify(result));
  assert.equal(result.serverSettled,true,'control must settle after late store release');
  assert.ok([403,408].includes(result.responseStatus),JSON.stringify(result));
  assert.equal(result.value,undefined);
  assert.equal(result.counts.journalExecution,0,'the cancelled read never reaches the journal');
});

test('deadline expiry also refuses late Core and store completions',async()=>{
  for(const [name,options] of [
    ['Core',{coreGate:gate(),serverMs:800,nativeMs:100,loadNativeMs:100}],
    ['store',{storeReadGate:gate(),serverMs:1500,nativeMs:1000,loadNativeMs:1000}]
  ]){
    const parked=options.coreGate??options.storeReadGate;
    const work=one({mode:'dynamic',...options});
    await parked.started.promise;
    const result=await work;
    assert.equal(result.outcome,'DEADLINE',`${name}: ${JSON.stringify(result)}`);
    assert.equal(result.serverSettled,true,`${name}: control did not settle`);
    assert.ok([403,408].includes(result.responseStatus),`${name}: ${JSON.stringify(result)}`);
    assert.equal(result.value,undefined);
  }
});

for(const [name,mutate] of [
  ['membership',state=>{state.membershipStatus='removed';}],
  ['selected client',state=>{state.selectedClientId=id(777);}]
])test(`${name} revocation during a delayed journal read withholds the receipt`,async()=>{
  const result=await one({mode:'dynamic',serverMs:3000,nativeMs:3000,journalDelayMs:300,
    duringJournal:({state})=>{setTimeout(()=>mutate(state),150);}});
  assert.equal(result.counts.journalExecution,1,JSON.stringify(result));
  assert.equal(result.outcome,'NATIVE_UNAVAILABLE',JSON.stringify(result));
  assert.equal(result.responseStatus,403,JSON.stringify(result));
  assert.equal(result.value,undefined);
});

test('load accepts a next turn alone and refuses ambiguous continuation lineage',async()=>{
  const next=await one({mode:'dynamic',nextTurn:true,journalExtra:false});
  assert.equal(next.outcome,'200',JSON.stringify(next));
  assert.equal(next.value.nextTurn.fixtureMarker,'new-turn');
  const ambiguous=await one({mode:'dynamic',nextTurn:true});
  assert.equal(ambiguous.outcome,'NATIVE_UNAVAILABLE',JSON.stringify(ambiguous));
  assert.equal(ambiguous.responseStatus,403);
  assert.equal(ambiguous.value,undefined);
});

test('a consistently foreign stored run cannot pass the fused load',async()=>{
  const result=await one({mode:'dynamic',foreignStoredBinding:true});
  assert.equal(result.outcome,'NATIVE_UNAVAILABLE',JSON.stringify(result));
  assert.equal(result.responseStatus,403);
  assert.equal(result.value,undefined);
});

test('the fused load independently refuses an out-of-scope selected client',async()=>{
  const principal={tenantId:binding.tenantId,actorId:binding.actorId,conversationId:binding.conversationId,runId:binding.runId};
  const sessions={async authenticateSession(){const at=Date.now();return {principal,checkedAtMs:at,expiresAtMs:at+30000};},
    async readCurrentState({authentication}){const at=Date.now();return {authenticationSha256:hash(authentication),binding,scopes,selectedClientId:id(777),checkedAtMs:at,expiresAtMs:at+30000};}};
  const unused=async()=>{throw Error('must not read');};
  const service=createConversationService({sessions,store:{accept:unused,append:unused,read:unused},dispatcher:{start:unused,cancel:unused},versions});
  await assert.rejects(service[loadWithLifecycle]({credential:'synthetic',binding},unused),/SCOPE_REFUSED/u);
});

for(const [name,mutate] of [
  ['identity revocation',({state})=>{state.identityRevoked=true;}],
  ['identity revision drift',({state})=>{state.identityRevision='changed';}],
  ['membership revocation',({state})=>{state.membershipStatus='removed';}],
  ['selected client drift',({state})=>{state.selectedClientId=id(777);}],
  ['current policy drift',({state})=>{state.policyRevision='changed';}],
  ['retention suppression',({state})=>{state.retention='suppressed';}],
  ['saved tenant drift',({saved})=>{saved.run.binding={...saved.run.binding,tenantId:'other-tenant'};}],
  ['saved request drift',({saved})=>{saved.request.prompt='Changed during journal';}],
])test(`mid-journal ${name} cannot release a load receipt`,async()=>{
  const result=await one({mode:'dynamic',duringJournal:mutate});
  assert.equal(result.counts.journalExecution,1,JSON.stringify(result));
  assert.equal(result.outcome,'NATIVE_UNAVAILABLE',JSON.stringify(result));
  assert.equal(result.responseStatus,403,JSON.stringify(result));
  assert.equal(result.value,undefined);
});

for(const [name,mutate] of [
  ['identity',state=>{state.identityRevoked=true;}],
  ['membership',state=>{state.membershipStatus='removed';}],
  ['selected client',state=>{state.selectedClientId=id(777);}],
  ['policy',state=>{state.policyRevision='changed';}],
  ['retention',state=>{state.retention='suppressed';}],
]){
  test(`${name} refusal before initial authorization prevents all stored reads`,async()=>{
    const result=await one({mode:'dynamic',beforeInitialRead:({state})=>mutate(state)});
    assert.equal(result.outcome,'NATIVE_UNAVAILABLE',JSON.stringify(result));assert.equal(result.responseStatus,403);
    assert.equal(result.counts.read,0);assert.equal(result.counts.journalExecution,0);assert.equal(result.value,undefined);
  });
  test(`${name} revocation during final stored read is caught by fresh release authorization`,async()=>{
    const result=await one({mode:'dynamic',duringFinalRead:({state})=>mutate(state)});
    assert.equal(result.outcome,'NATIVE_UNAVAILABLE',JSON.stringify(result));assert.equal(result.responseStatus,403);
    assert.equal(result.counts.read,2);assert.equal(result.counts.journalExecution,1);assert.equal(result.value,undefined);
    assert.equal(result.counts.taskAuthorization,2,'service final authorization must refuse before the last task gate');
  });
}

test('task revocation at the final worker gate withholds the completed service receipt',async()=>{
  const result=await one({mode:'dynamic',duringTaskAuthorization:({count})=>{if(count===3)throw Error('task revoked');}});
  assert.equal(result.outcome,'NATIVE_UNAVAILABLE',JSON.stringify(result));assert.equal(result.responseStatus,403);
  assert.equal(result.counts.taskAuthorization,3);assert.equal(result.counts.retention,4);
  assert.equal(result.counts.read,2);assert.equal(result.value,undefined);
});

// Run-owner replay (native-client.mjs): Core :3 answers an unanswered Clerk check 503, which worker-http reports as
// 503 WORKER_AUTHORITY_UNAVAILABLE; only that is replayed, at most twice, inside the call's deadline.
test('a Core read that did not answer is replayed and the next load answers',async()=>{
  const result=await one({mode:'fixed',serverMs:10000,coreStatus:(route,n)=>route==='identity'&&n===1?503:undefined});
  assert.equal(result.outcome,'200',JSON.stringify(result));assert.deepEqual(result.statuses,[503,200]);
});
test('a Core refusal is answered 403 and never replayed',async()=>{
  const result=await one({mode:'fixed',serverMs:10000,coreStatus:(route,n)=>route==='identity'&&n===1?401:undefined});
  assert.equal(result.outcome,'NATIVE_UNAVAILABLE',JSON.stringify(result));assert.deepEqual(result.statuses,[403]);
});
test('a Core that keeps not answering ends the load after three attempts',async()=>{
  const result=await one({mode:'fixed',serverMs:10000,coreStatus:()=>503});
  assert.equal(result.outcome,'NATIVE_UNAVAILABLE',JSON.stringify(result));assert.deepEqual(result.statuses,[503,503,503]);
});
test('a publish whose answer was lost after the append is replayed and stored once',async()=>{
  const real=createPostgresConversationStore(storeFixture()),at=new Date().toISOString(),policyRevision=scopes[0].policyRevision;
  await real.accept({run:{binding,state:'queued',scopes,createdAt:at,policyRevision,versions},request:{requestId:id(6),prompt:'Synthetic only',skill:null,window:null},
    conversation:{conversationId:binding.conversationId,owner:{tenantId:binding.tenantId,actorId:binding.actorId},scopes,createdAt:at,policyRevision},
    event:{contractVersion:'0.1.0',eventId:id(7),binding,sequence:1,createdAt:at,scopes,type:'run.status',data:{state:'queued',reasonCode:null}}},()=>{});
  let appends=0,lost=0;const store={...real,async append(...args){const event=await real.append(...args);appends++;return event;}};
  // The first Core call after the append does not answer, so control has stored the event but answers 503.
  const result=await one({mode:'fixed',route:'publish',serverMs:10000,store,coreStatus:()=>appends===1&&!lost++?503:undefined});
  assert.equal(result.outcome,'200',JSON.stringify(result));assert.deepEqual(result.statuses,[503,200]);assert.equal(appends,2);
  assert.deepEqual((await real.read(binding,{after:0,limit:10},()=>{})).events.map(e=>e.eventId),[id(7),id(88)]);
  assert.equal(result.value.eventId,id(88));assert.equal(result.value.sequence,2);
});
test('a Core read that did not answer during session issuance is replayed too',async()=>{
  // Identity read 1 is the task verify; read 2 is the opaque session issuance inside the same worker request.
  const result=await one({mode:'fixed',serverMs:10000,coreStatus:(route,n)=>route==='identity'&&n===2?503:undefined});
  assert.equal(result.outcome,'200',JSON.stringify(result));assert.deepEqual(result.statuses,[503,200]);
});
