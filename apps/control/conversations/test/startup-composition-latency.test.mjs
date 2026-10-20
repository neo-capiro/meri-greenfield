/** Model-free startup composition against bounded in-process Core responses.
 * Real native client, worker HTTP, identity/context, opaque sessions, lifecycle
 * load, publish, runtime HTTP/provider and activity are composed here. Task
 * verifier DB/grants, ECS, process launch, SDK session, TLS and the model are
 * fixed synthetic ports; those gates retain their separate tests. No external
 * network, database, AWS, credentials, or model call occurs in this fixture. */
import {registerHooks} from 'node:module';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {resolve,join,sep} from 'node:path';
import {mkdtempSync,mkdirSync,readFileSync,realpathSync,lstatSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {PassThrough} from 'node:stream';
import {EventEmitter} from 'node:events';
import {createHash} from 'node:crypto';
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
 {createConversationService},{createConversationLifecycleService},{createWorkerRunApplication},
 {createNativeCapabilityClient},{createNativeRuntimeProvider},{createNativeExecutionApplication},
 {createConversationActivity},{createRemoteNativeTaskApplication},{createRemoteSdkProcessClient},
 {runnerStartupBudget,RUNNER_STARTUP_MIN_SHUTDOWN_MS,RUNNER_STARTUP_CLEANUP_MS,RUNNER_STARTUP_MARGIN_MS},
 {capabilityDigest},{binding,scopes,versions,id},{canonicalSha256:hash}]=await Promise.all([
 'apps/runtime/native-authority/identity-context.mjs',
 'apps/control/product-access/core-membership.mjs',
 'apps/control/action-host/session/owner.mjs',
 'apps/control/conversations/service.mjs',
 'apps/control/conversations/lifecycle/service.mjs',
 'apps/runtime/worker-http.mjs',
 'apps/runtime/native-client.mjs',
 'apps/runtime/native-authority/runtime-provider.mjs',
 'apps/runtime/native-authority/execution-http.mjs',
 'apps/worker/conversation/activity.mjs',
 'apps/runtime/native-authority/remote-task-http.mjs',
 'apps/runtime/native-authority/remote-task-client.mjs',
 'packages/runtime/runner-load-budget.mjs',
 'apps/runtime/native-authority/task-verifier.mjs',
 'apps/control/conversations/test/store-fixture.mjs',
 'packages/contracts/validate.mjs',
].map(imported));

const delay=(ms,signal)=>new Promise((done,fail)=>{
 if(signal?.aborted)return fail(Error('aborted'));
 const timer=setTimeout(()=>{signal?.removeEventListener('abort',aborted);done();},ms);
 const aborted=()=>{clearTimeout(timer);fail(Error('aborted'));};
 signal?.addEventListener('abort',aborted,{once:true});
});

async function composedStartup({latencyMs=300,originalExpiresAtMs=Date.now()+900000,beforeModel=async()=>{}}={}){
 const started=performance.now(),firstAt=Date.now();
 const budget=runnerStartupBudget({requestMs:25000,shutdownMs:10000,originalExpiresAtMs});
 const counts={identity:0,context:0,membership:0,authorization:0,runtimeCurrent:0,storeRead:0,storeAppend:0,query:0};
 const trace=[],appliedStages=[],principal={tenantId:binding.tenantId,actorId:binding.actorId},clientId=id(5),serverMs=25000;
 const state={membershipStatus:'active',membershipRevision:'membership-revision',selectedClientId:clientId};
 async function coreFetch(url,init){
  const path=new URL(url).pathname;
  const route=path.endsWith('/identity')?'identity':path.endsWith('/context')?'context':path.endsWith('/membership')?'membership':null;
  if(!route)throw Error('unknown local Core route');counts[route]++;
  await delay(latencyMs,init.signal);
  const at=Date.now(),expiresAtMs=originalExpiresAtMs,body=JSON.parse(init.body);
  if(route==='identity')return Response.json({principal,identityRevision:'identity-revision',checkedAtMs:at,expiresAtMs});
  if(route==='membership')return Response.json({...principal,status:state.membershipStatus,role:'standard_user',permissions:[],clientIds:[clientId],membershipRevision:state.membershipRevision,checkedAtMs:at,expiresAtMs});
  return Response.json({principal,identityRevision:'identity-revision',identitySha256:body.identitySha256,conversationId:body.conversationId,selectedClientId:state.selectedClientId,contextRevision:'context-revision',checkedAtMs:at,expiresAtMs});
 }
 const runFact=()=>({binding,policyRevision:scopes[0].policyRevision,deadlineMs:originalExpiresAtMs,checkedAtMs:Date.now()});
 const context=()=>createNativeIdentityContext({origin:'https://core.synthetic.invalid',commandContext:{binding,clientResolution:{reference:clientId,clientId}},
  currentOwner:{async currentRun(){return JSON.stringify(runFact());},async withCurrentAllocation(){throw Error('unused');}},
  fetchImpl:coreFetch,enabled:true,now:Date.now,limits:{maxRequestMs:serverMs,maxFactBytes:65536}});
 const identityContext=context(),verifierContext=context();
 const membership=createCoreMembershipGate({origin:'https://core.synthetic.invalid',identityContext,fetchImpl:coreFetch,now:Date.now,limits:{maxRequestMs:serverMs,maxFactBytes:65536}});
 const sessions=createActionSessionOwner({mode:'process-local',verifyIdentity:identityContext.verifyIdentity,resolveContext:identityContext.resolveContext,
  membership:{admit:membership.admit,recheck:membership.recheck},now:Date.now,
  limits:{maxSessions:4,maxRequestMs:serverMs,maxTtlMs:60000,maxFactBytes:65536}});
 const saved={run:{binding,state:'queued',scopes,versions,createdAt:new Date(firstAt).toISOString(),policyRevision:scopes[0].policyRevision},
  request:{requestId:id(6),prompt:'Synthetic only; model execution is forbidden',skill:null,window:null,windowRequest:null},lastSequence:1};
 const unused=async()=>{throw Error('unused');};
 const store={accept:unused,async append(b,event){assert.deepEqual(b,binding);counts.storeAppend++;trace.push(`publish:${event.data?.state??event.type}`);
   saved.run.state=event.data.state;saved.lastSequence++;return {scopes,sequence:saved.lastSequence};},
  async read(){counts.storeRead++;return structuredClone(saved);},
  lifecycle:{begin:unused,change:unused,get:unused,controls:unused,claim:unused,checkpoint:unused,readCheckpoint:unused,
   async execution(){return null;},continuation:unused,cancel:unused,readStopFence:unused}};
 const dispatcher={start:unused,cancel:unused,signal:unused};
 const basic=createConversationService({sessions,store,dispatcher,versions,maxRequestMs:serverMs});
 const service=createConversationLifecycleService({service:basic,store,dispatcher,sessions,maxRequestMs:serverMs,reconcileOriginal:unused,checkpoints:{read:unused}});
 const authority={async call(operation,input,{signal}={}){
  if(operation!=='worker/authorize')throw Error('unexpected native operation');counts.authorization++;
  const verified=await verifierContext.verifyIdentity({credential:'synthetic-native',deadlineMs:Date.now()+serverMs,signal});
  await verifierContext.resolveContext({identityCredential:'synthetic-native',identity:verified,identitySha256:hash(verified),
   hints:{conversationId:binding.conversationId,runId:binding.runId},deadlineMs:Date.now()+serverMs,signal});
  const at=Date.now();return {binding,operation:input.operation,inputSha256:input.inputSha256,identityCredential:'synthetic-native',scopes,selectedClientId:clientId,
   policyRevision:scopes[0].policyRevision,authorizationDecisionId:'synthetic-decision',checkedAtMs:at,expiresAtMs:originalExpiresAtMs};
 }};
 const worker=createWorkerRunApplication({service,sessions,native:authority,configuration:{limits:{requestMs:serverMs,requestBytes:131072}},now:Date.now});
 const runtimePlan={binding,versions,proxyUrl:'https://synthetic-proxy.invalid/',proxyCredential:'synthetic-proxy',model:'synthetic-model',
  deadlineMs:originalExpiresAtMs,maxTurns:1,maxCostMicroUSD:1,maxOutputBytes:100};
 const taskCapability='synthetic-task',taskDigest=capabilityDigest(taskCapability),controlDigest=capabilityDigest('synthetic-control');
 const broker={taskCapabilitySha256:taskDigest,async current({signal}){counts.runtimeCurrent++;
  const verified=await verifierContext.verifyIdentity({credential:'synthetic-native',deadlineMs:Date.now()+serverMs,signal});
  await verifierContext.resolveContext({identityCredential:'synthetic-native',identity:verified,identitySha256:hash(verified),
   hints:{conversationId:binding.conversationId,runId:binding.runId},deadlineMs:Date.now()+serverMs,signal});
  return {run:{versions},record:{expiresAtMs:originalExpiresAtMs}};},start:unused,poll:unused};
 const runtime=createNativeRuntimeProvider({broker,runtime:runtimePlan,
  admission:{async currentAllocation(){return JSON.stringify({binding,deadlineMs:originalExpiresAtMs,allocation:{budgets:{maxTurns:1,maxCostMicroUSD:1,maxOutputBytes:100}}});}},
  taskCapabilitySha256:taskDigest,enabled:true});
 const execution=createNativeExecutionApplication({broker,runtime,controlCapabilitySha256:controlDigest,taskCapabilitySha256:taskDigest,enabled:true,maxRequestMs:serverMs});
 const responseStatus=[];
 const native=createNativeCapabilityClient({configuration:{origin:'https://native.synthetic.invalid',maxResponseBytes:2097152},credential:taskCapability,
  maxRequestMs:3000,loadMaxRequestMs:budget.stages.load.maxMs,fetch:async(url,init)=>{
   const path=new URL(url).pathname;
   const request=new Request(path==='/v1/runner/load'||path==='/v1/runner/publish'?url.replace('/v1/runner/','/internal/conversations/'):url,init);
   const response=path==='/v1/runner/runtime'?await execution.handle(request):await worker.handle(request);
   responseStatus.push({path,status:response.status,atMs:Math.round(performance.now()-started),
    ...(response.status===200?{}:{body:await response.clone().json()})});return response;
  }});
 const stage=(operation,input,signal)=>{
  const status=input.event?.data?.state;
  const allowance=operation==='runner/load'?budget.stages.load:operation==='runner/runtime'?budget.stages.runtime:
   status==='starting'?budget.stages.starting:status==='running'?budget.stages.running:
   {maxMs:budget.stages.session.maxMs,expiresAtMs:originalExpiresAtMs-
    3*Math.max(10000,RUNNER_STARTUP_MIN_SHUTDOWN_MS)-RUNNER_STARTUP_CLEANUP_MS-RUNNER_STARTUP_MARGIN_MS};
  appliedStages.push({operation,status,maxMs:allowance.maxMs,expiresAtMs:allowance.expiresAtMs});
  return native.call(operation,input,{signal,deadlineMs:allowance.expiresAtMs,
   ...(operation==='runner/load'?{}:{maxRequestMs:allowance.maxMs})});
 };
 const runOwner={load:({binding:b,signal})=>{assert.deepEqual(b,binding);trace.push('load');return stage('runner/load',{binding},signal);},
  append:({binding:b,event,signal})=>{assert.deepEqual(b,binding);return stage('runner/publish',{binding,event},signal);}};
 const prepareRuntime=async({binding:b,versions:v,signal})=>{
  assert.deepEqual(b,binding);trace.push('runtime');const receipt=await stage('runner/runtime',{binding,versions:v},signal);
  const {sdkSessionKey,...runtime}=receipt;
  assert.equal(sdkSessionKey,null);
  return {...runtime,cwd:resolve(repo,'synthetic-workspace').replaceAll('\\','/')+'/'+binding.conversationId,
   sessionStore:{async load(){throw Error('SDK_SESSION_FORBIDDEN');},async append(){throw Error('SDK_SESSION_FORBIDDEN');}}};
 };
 const activity=createConversationActivity({runOwner,prepareRuntime,query:()=>{counts.query++;return {async *[Symbol.asyncIterator](){
  trace.push('native-prepare-start');await beforeModel();throw Error('MODEL_CALL_FORBIDDEN');}};},
  now:Date.now,loadMaxMs:budget.stages.load.maxMs,loadExpiresAtMs:budget.stages.load.expiresAtMs,
  runtimeMaxMs:budget.stages.runtime.maxMs,runtimeExpiresAtMs:budget.stages.runtime.expiresAtMs,
  setupBudget:budget.stages.setup,modelDeadlineMs:budget.stages.session.expiresAtMs,
  executionDeadlineMs:budget.stages.session.expiresAtMs+budget.stages.session.maxMs,terminalAttemptMs:23000,
  diagnostics:{stage:value=>trace.push(`stage:${value}`),failure:error=>trace.push(`failure:${error?.code??error?.message}`)}});
 let outcome;
 try{await activity({binding});outcome='unexpected success';}catch(error){outcome=error?.code??error?.message;}
 finally{sessions.close();}
 return {latencyMs,durationMs:Math.round(performance.now()-started),counts,trace,responseStatus,appliedStages,outcome,
  originalExpiresAtMs,reserveMs:budget.reserveMs,originalRemainingMs:originalExpiresAtMs-Date.now()};
}

test('300 ms Core responses cross load, runtime, status and native prepare/start before the model',{timeout:120000},async t=>{
 const originalExpiresAtMs=Date.now()+900000,native=nativeTaskFixture(t,originalExpiresAtMs);
 const result=await composedStartup({originalExpiresAtMs,beforeModel:native.start});
 assert.equal(result.outcome,'EXECUTION_FAILED',JSON.stringify(result));
 assert.equal(result.counts.runtimeCurrent,2,JSON.stringify(result));
 assert.equal(result.counts.query,1,JSON.stringify(result));
 assert.ok(result.trace.includes('native-prepare-start'),JSON.stringify(result));
 assert.ok(native.measured().coreCalls>=24&&native.measured().coreCalls%2===0);
 assert.equal(native.measured().state,'stopped');
 assert.deepEqual(result.trace.filter(x=>x==='load'||x==='runtime'||x.startsWith('publish:')),
  ['load','runtime','publish:starting','publish:running','publish:failed'],JSON.stringify(result));
 assert.deepEqual(result.responseStatus.map(x=>x.status),[200,200,200,200,200],JSON.stringify(result));
 const terminal=result.appliedStages.find(x=>x.status==='failed');
 assert.deepEqual(terminal,{operation:'runner/publish',status:'failed',maxMs:23000,
  expiresAtMs:result.originalExpiresAtMs-3*Math.max(10000,RUNNER_STARTUP_MIN_SHUTDOWN_MS)-RUNNER_STARTUP_CLEANUP_MS-RUNNER_STARTUP_MARGIN_MS});
 assert.ok(result.counts.identity+result.counts.context+result.counts.membership>=100,JSON.stringify(result));
 assert.ok(result.originalRemainingMs>=result.reserveMs,JSON.stringify(result));
});

function nativeTaskFixture(t,originalExpiresAtMs){
 const root=mkdtempSync(join(tmpdir(),'meri-startup-latency-')),workspace=join(root,'workspace'),configDirectory=join(root,'config');
 const allowedRoot=realpathSync(tmpdir())+sep;
 assert.ok(realpathSync(root).startsWith(allowedRoot),'fixture may clean only its own temporary directory');
 mkdirSync(workspace);mkdirSync(configDirectory);t.after(()=>rmSync(root,{recursive:true,force:true}));
 // The receiver's file ownership proof runs on Linux in production. Windows
 // Node has no getuid, so expose only the uid from this local fixture root.
 const originalGetuid=process.getuid;
 if(originalGetuid===undefined){process.getuid=()=>lstatSync(root).uid;t.after(()=>{delete process.getuid;});}
 const command=realpathSync(process.execPath),descriptor={command,args:[],cwd:workspace,
  env:{CLAUDE_CONFIG_DIR:configDirectory,CLAUDE_SECURESTORAGE_CONFIG_DIR:configDirectory}};
 const executionKey=hash(binding),original={binding,executionKey,executionId:executionKey,planSha256:hash(descriptor),
  expiresAtMs:originalExpiresAtMs,versions};
 const sha=value=>createHash('sha256').update(value).digest('hex'),taskToken='synthetic-task-only',controlToken='synthetic-control-only';
 const launchConfiguration={binding,workspace,configDirectory,versions:{sdk:versions.sdk,cli:versions.cli},
  expiresAtMs:original.expiresAtMs,executableSha256:sha(readFileSync(command)),launch:{command,args:[],env:descriptor.env},enabled:true};
 const taskArn='arn:aws:ecs:us-east-1:967807252336:task/synthetic/'+'a'.repeat(32),preparationId=id(9);
 const budget=runnerStartupBudget({requestMs:25000,shutdownMs:10000,originalExpiresAtMs:original.expiresAtMs});
 let coreCalls=0,launches=0,starts=0,booted=false,closed=false;
 const current=async passes=>{for(let i=0;i<passes*2;i++){coreCalls++;await delay(300);}};
 const receipt={binding,executionId:executionKey,planSha256:original.planSha256,expiresAtMs:original.expiresAtMs,
  versions,taskId:'synthetic-task',state:'executing',physicalStopProven:false};
 const events=new EventEmitter(),stdin=new PassThrough(),stdout=new PassThrough();
 const task={async launch(){launches++;await delay(1500);booted=true;return receipt;},
  async startPreparedProcess(){starts++;await delay(300);},
  spawnClaudeCodeProcess(){return {stdin,stdout,on:(...args)=>events.on(...args)};},
  status(){return {booted,supervisorPid:booted?10:null};},
  async inspect(){return closed?{...receipt,state:'stopped',physicalStopProven:true}:receipt;},
  async close(){closed=true;},async retire(){return {...receipt,state:'stopped',physicalStopProven:true};}};
 const ack=pins=>({original,descriptorSha256:pins.descriptorSha256,configTreeSha256:pins.configTreeSha256,
  preparationId,taskArn,checkedAtMs:Date.now(),expiresAtMs:original.expiresAtMs});
 const authorizer={async prepare(pins){await current(2);return ack(pins);},async verify(pins){await current(1);return ack(pins);},
  async start(pins){await current(4);await task.launch();return {...ack(pins),dispatch:true};},
  async started(pins){await current(3);return ack(pins);}};
 const app=createRemoteNativeTaskApplication({original,preparationAuthorizer:authorizer,taskArn,
  descriptorPolicy:{workspace,command,configParentDirectory:root,secureStorageDirectory:configDirectory},
  nativeFactory:()=>({task,launchConfiguration}),controlCapabilitySha256:capabilityDigest(controlToken),
  taskCapabilitySha256:capabilityDigest(taskToken),enabled:true,limits:{maxRequestMs:25000}});
 t.after(async()=>{await app.close();});
 const responses=[],client=createRemoteSdkProcessClient({original,origin:'https://synthetic-task.invalid',credential:taskToken,
  limits:{maxRequestMs:8000},startupMaxRequestMs:23000,startupBudget:budget.stages,
  fetchImpl:async(url,init)=>{const response=await app.handle(new Request(url,init));responses.push({operation:new URL(url).pathname.split('/').at(-1),status:response.status});return response;}});
 client.spawnClaudeCodeProcess(descriptor);
 return {measured:()=>({coreCalls,state:app.status().state}),async start(){
  const startedAt=performance.now();try{await client.startPreparedProcess();}catch(error){throw Error(JSON.stringify({code:error?.code,coreCalls,responses,state:app.status()}));}
  const elapsedMs=Math.round(performance.now()-startedAt);
  assert.deepEqual(responses.slice(0,2),[{operation:'prepare',status:200},{operation:'start',status:200}],JSON.stringify(responses));
  assert.equal(app.status().state,'running');assert.equal(launches,1);assert.equal(starts,1);
  assert.ok(coreCalls>=24&&coreCalls%2===0,'prepare and start keep every synthetic currentness pass');
  assert.ok(elapsedMs>=6600&&elapsedMs<23000,JSON.stringify({elapsedMs,coreCalls,responses}));
  await client.close();assert.equal(app.status().state,'stopped');
 }};
}
