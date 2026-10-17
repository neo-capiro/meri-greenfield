/** Composed next-turn rehearsal at dot's handoff pin: two prompts in one conversation with the real pinned CLI 2.1.295
 * over real PostgreSQL 16 and the real control-plane owners (opaque session owner with the next-run selector,
 * conversation and lifecycle services, worker run application, admitted-task authority per run, completion capture
 * with immutable object readback, next-run reservation and acceptance, continuation restore of the first turn's
 * checkpoint), zero model turns (both accepted requests are the CLI-local `/status`). Synthetic: ECS/identity/authority
 * facts, proxy origin and model string, per-run proxy credentials, the in-memory immutable object store, the ECS task
 * proof and the allocator's retirement record (written by the rehearsal only after the physical stop is proven).
 * Not collected by the suite globs; run explicitly as a non-root user with the local clusters started:
 *   MERI_REVIEW_SOURCE_ROOT=$PWD MERI_REHEARSAL_RECEIPT=/path/receipt.json node --test scripts/qualification/first-chat-rehearsal/composed-next-turn-rehearsal.mjs */
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFileSync,readdirSync,chmodSync,mkdirSync,mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {load,listener,makeReceipt,sha,tree} from './rehearsal-support.mjs';
const {fixture,control}=await load('apps/runtime/native-authority/test/broker-pg-fixture.mjs');
const {canonicalSha256:hash}=await load('packages/contracts/validate.mjs');
const {compileNativeBrokerPlan}=await load('apps/runtime/native-authority/broker-stack.mjs');
const {createRemoteNativeController,createRemoteNativeWorker}=await load('apps/runtime/native-authority/remote-composition.mjs');
const {createAdmittedSessionSupervisor}=await load('apps/runtime/native-authority/admitted-supervisor.mjs');
const {createNativeCapabilityClient}=await load('apps/runtime/native-client.mjs');
const {assembleConversationRunner,assertRunnerWorkspace}=await load('apps/runtime/conversation-runner.mjs');
const {createRuntimeSdkSessionFactory}=await load('apps/runtime/sdk-session-runtime.mjs');
const {createNativeSdkSessionClient}=await load('apps/runtime/native-authority/session-client.mjs');
const {createCheckpointSessionFactory}=await load('apps/runtime/checkpoint-session-factory.mjs');
const {createWorkerRunApplication}=await load('apps/runtime/worker-http.mjs');
const {createPreparedCandidateIdentity}=await load('apps/runtime/prepared-candidate.mjs');
const {buildConversationOptions}=await load('apps/worker/conversation/options.mjs');
const {sdkOptionsTemplateSha256,requestContextSuffix}=await load('apps/runtime/native-authority/sdk-option-template.mjs');
const {query:sdkQuery}=await load('apps/worker/conversation/node_modules/@anthropic-ai/claude-agent-sdk/sdk.mjs');
const {redactEnvironment}=await load('scripts/qualification/first-chat-rehearsal/capture-sdk-descriptor.mjs');
const {createConversationService}=await load('apps/control/conversations/service.mjs');
const {createConversationLifecycleService}=await load('apps/control/conversations/lifecycle/service.mjs');
const {createActionSessionOwner}=await load('apps/control/action-host/session/owner.mjs');
const {createNextRunOwner}=await load('apps/control/conversations/next-run.mjs');
const {createPostgresToolBudget}=await load('apps/gateway/budget/postgres-tool-budget.mjs');
const {createNativeAllocationAdmission}=await load('apps/gateway/budget/native-allocation-admission.mjs');
const {runOwnerOperations}=await load('packages/contracts/runtime-0.2/validate.mjs');
const {sdkSessionOperations}=await load('packages/contracts/runtime-0.2/session.mjs');
const {versions}=await load('apps/control/conversations/test/store-fixture.mjs');
const {parseQualificationTrust,preflightStandIn,withQualificationEnvironment,environmentIdentity}=await load('scripts/qualification/first-chat-rehearsal/qualification-trust.mjs');
const {startProviderStandIn}=await load('scripts/qualification/first-chat-rehearsal/provider-standin.mjs');
const EXPECTED_REPLY='Rehearsal stand-in reply: no provider was contacted.';
/** The qualification trust contract (source only; execution of the trust route stays on HOLD): absent, the product route with the configured proxy host; present, one process-scoped CA for the harness and the CLI child, an in-harness stand-in on 127.0.0.1, a run-owned disposable cluster and pinned identity. Parsed before anything else so an inconsistent contract refuses first. */
const trust=parseQualificationTrust(process.env);
/** On the lifecycle path the SDK streams every prompt as a client-composed user message, which the CLI never handles locally; a turn therefore needs the configured proxy host to answer. The non-destructive preflight runs before any fixture, cluster or launch and distinguishes an untrusted stand-in (TLS) from an unreachable or wrong one. */
async function requireProviderStandIn(proxyUrl){return preflightStandIn({origin:new URL(proxyUrl).origin,expectedReply:EXPECTED_REPLY});}
const CLIENT_ID='11111111-1111-4111-8111-000000000006',IDENTITY_CREDENTIAL='synthetic-existing-identity',OPERATIONS=[...Object.keys(runOwnerOperations),...sdkSessionOperations.map(op=>'runner/session/'+op)],LIMITS={maxRequestMs:3000,maxFactBytes:131072};
const SCOPE='Local rehearsal only: synthetic ECS/identity/authority/proxy facts and in-memory immutable objects; per-run proxy credentials hashed where recorded; no provider request, no cloud resource, no image; nothing here is native, image, Temporal, provider or live acceptance.';
const unused=name=>async()=>{throw Error('REHEARSAL_PORT_UNUSED:'+name);};
const check=()=>{};
/** In-memory stand-in for immutable S3 versions: a second put of different bytes under one object id is a conflict. */
function immutableObjects(){const bytes=new Map();return {size:()=>bytes.size,async put(input){const raw=Buffer.from(input.bytes);if(bytes.has(input.objectId)&&!bytes.get(input.objectId).equals(raw))throw Error('REHEARSAL_OBJECT_CONFLICT');bytes.set(input.objectId,raw);return {objectId:input.objectId,versionId:'rehearsal-immutable-v1',scopes:input.scopes,sha256:sha(raw),bytes:raw.length};},async get(ref){const raw=bytes.get(ref.objectId);if(!raw)throw Error('REHEARSAL_OBJECT_MISSING');return Buffer.from(raw);}};}
/** The synthetic backend authority: one principal, one selected client, fixed revisions; the same shape the broker fixture uses. */
function authority(binding,principal,expiresAtMs){return {origin:'https://authority.synthetic.invalid',commandContext:{binding,clientResolution:{reference:CLIENT_ID,clientId:CLIENT_ID}},async fetchImpl(url,options){const body=JSON.parse(options.body),base={principal,identityRevision:'synthetic-identity',checkedAtMs:Date.now(),expiresAtMs};return Response.json(url.endsWith('/identity')?base:{...base,identitySha256:body.identitySha256,conversationId:binding.conversationId,selectedClientId:CLIENT_ID,contextRevision:'synthetic-context'});}};}
/** The conversation control plane shared by both runs: real store, session owner with the next-run selector, services, worker application. */
async function controlPlane(t,f){
 const {binding:run1,pool}=f,store=f.stack.store,principal={tenantId:run1.tenantId,actorId:run1.actorId},policyRevision=f.facts.qualificationBinding.policyRevision,expiresAtMs=f.expiry;
 const admissions=new Map(),supervisors=new Map(),counters={starts:0,revocations:0};
 const retirement={async verifyRetired({binding}){const r=(await store.allocations.read({binding,allocationKey:hash(binding)},check)).record;return {physicalStopProven:r?.state==='RETIRED'&&r.resource?.physicalStopProven===true};}};
 // Grant revocation goes through the real product budget admission over the local PostgreSQL grants of that run.
 const revocation={async verifyRevoked({binding,signal}){const a=admissions.get(hash(binding));if(!a)throw Error('REHEARSAL_ADMISSION_MISSING');const saved=await store.allocations.read({binding,allocationKey:hash(binding)},check);const receipt=await a.revoke({taskArn:saved.record.resource.taskArn,signal});counters.revocations++;if(receipt.state!=='REVOKED'||receipt.revocationProven!==true)throw Error('REHEARSAL_REVOCATION_REFUSED');return {receiptSha256:hash({binding,receipt}),grantIds:receipt.grantIds};}};
 const nextRunOwner=createNextRunOwner({store,retirement,revocation,versions});
 const identityContext=createPreparedCandidateIdentity({store,identity:authority(run1,principal,expiresAtMs),qualification:{policyRevision},limits:LIMITS,nextRunOwner});
 const sessions=createActionSessionOwner({mode:'process-local',verifyIdentity:identityContext.verifyIdentity,resolveContext:identityContext.resolveContext,limits:{maxSessions:50,maxRequestMs:3000,maxTtlMs:120000,maxFactBytes:131072}});t.after(()=>sessions.close());
 const dispatcher={async start(){counters.starts++;},async cancel(){},signal:unused('dispatcher.signal')};
 const service=createConversationService({sessions,store,dispatcher,versions});
 const lifecycle=createConversationLifecycleService({service,store,dispatcher,sessions,checkpoints:{read:unused('checkpoints.read')},nativeAdmission:{admit:unused('nativeAdmission.admit'),retire:unused('nativeAdmission.retire')},approvals:{read:unused('approvals.read'),readDecision:unused('approvals.readDecision')}});
 // The admitted-task authority of the run named in the request serves /v1/worker/authorize for the control capability.
 const supervisorFetch=await listener(t,async r=>{const body=await r.clone().json();const supervisor=supervisors.get(hash(body.binding));if(!supervisor)return Response.json({error:{code:'REHEARSAL_RUN_UNKNOWN'}},{status:403});return supervisor.application.handle(r);});t.after(()=>supervisorFetch.close());
 const controlNative=createNativeCapabilityClient({configuration:{origin:'https://synthetic-supervisor.invalid',maxResponseBytes:2097152},credential:control,fetch:supervisorFetch});
 const workerApplication=createWorkerRunApplication({service:lifecycle,sessions,native:controlNative,configuration:{limits:{requestMs:3000,requestBytes:131072}}});
 /** One admitted-task authority and one budget admission per run, over that run's budget rows. */
 function registerRun({binding,allocation,facts,launchConfiguration}){
  const supervisor=createAdmittedSessionSupervisor({pool,allocationJson:JSON.stringify(allocation),grantFactsJsons:[JSON.stringify(facts)],grantId:facts.grantId,identity:{...authority(binding,principal,expiresAtMs),credential:IDENTITY_CREDENTIAL},operations:OPERATIONS,callerCapabilitySha256:sha(control),launchConfiguration,limits:LIMITS,enabled:true,now:Date.now});
  const admission=createNativeAllocationAdmission({pool,allocationJson:JSON.stringify(allocation),qualification:{attempt:1,policyRevision},grantIntents:[{grantId:facts.grantId,capabilitySha256:facts.capabilitySha256,expiresAtMs}],binding,now:Date.now,limits:LIMITS});
  supervisors.set(hash(binding),supervisor);admissions.set(hash(binding),admission);t.after(()=>supervisor.close());return supervisor;
 }
 return {store,pool,principal,policyRevision,expiresAtMs,counters,sessions,service,workerApplication,registerRun};
}
/** One run's composed path: descriptor/pin capture, admitted allocation, controller with completion capture and restore, remote task worker with the mirror session, runner on the lifecycle path. */
async function composeRun(t,plane,objects,run,receipt,lineage){
 const {binding,credential,supervisor,facts,runtime,workspace,configParentDirectory,secureStorageDirectory}=run,{store,pool}=plane,label='run'+binding.writerFence;
 const sdkConfigDirectory=join(configParentDirectory,'sdk-'+binding.runId);chmodSync(configParentDirectory,0o700);
 const saved=await store.read(binding,{after:0,limit:1},check),scopes=saved.run.scopes;
 const probe=buildConversationOptions({...runtime,cwd:workspace,sessionStore:{async load(){},async append(){},async listSubkeys(){}},sdkConfigDirectory,sdkSecureStorageDirectory:secureStorageDirectory},new AbortController());
 // The qualification route's one launch change joins the descriptor probe here, the runner query below and the fixture's launch plan identically.
 probe.env=withQualificationEnvironment(probe.env,trust);
 if(lineage)probe.resume=lineage.resume; // the next-turn options of a completion checkpoint carry only `resume`
 probe.systemPrompt+=requestContextSuffix({window:saved.request.window,scopes,skill:saved.request.skill});
 // The runner pins the run-invariant template (sdk-option-template.mjs); `resume` stays in it, so run 2's template differs from run 1's.
 const authoritySha256=hash({scopes,selectedClientId:CLIENT_ID,policyRevision:plane.policyRevision});
 const sdkOptionsSha256=sdkOptionsTemplateSha256(probe,{workspace,configDirectory:sdkConfigDirectory,authoritySha256});
 let descriptor=null;try{sdkQuery({prompt:saved.request.prompt,options:{...probe,spawnClaudeCodeProcess(r){descriptor={command:r.command,args:[...r.args],cwd:r.cwd,env:{...r.env}};throw Error('DESCRIPTOR_CAPTURED_NO_SPAWN');}}});}catch{}
 assert.ok(descriptor,label+': the SDK produced a launch descriptor');const {CLAUDE_CONFIG_DIR:configDir,ANTHROPIC_AUTH_TOKEN:issued,...templateEnv}=descriptor.env;assert.equal(configDir,sdkConfigDirectory);assert.equal(issued,runtime.proxyCredential);
 const launchTemplate={command:descriptor.command,args:descriptor.args,env:templateEnv},executableSha256=sha(readFileSync(descriptor.command));
 receipt[label]={descriptor:{command:descriptor.command,args:descriptor.args,cwd:descriptor.cwd,env:redactEnvironment(descriptor.env)},cli:{path:descriptor.command,sha256:executableSha256},launchTemplate:{argsSha256:hash(launchTemplate.args),envKeys:Object.keys(templateEnv),productEnvKeys:Object.keys(templateEnv).filter(k=>k!=='NODE_EXTRA_CA_CERTS'),envSha256:hash(templateEnv),qualificationTrust:trust?{caSha256:trust.caSha256,envKey:'NODE_EXTRA_CA_CERTS',caFile:templateEnv.NODE_EXTRA_CA_CERTS===trust.caFile}:null,carriesProxyCredential:Object.hasOwn(templateEnv,'ANTHROPIC_AUTH_TOKEN'),resumeArgument:descriptor.args.includes('--resume')},sdkOptionsSha256,binding};
 if(trust)assert.equal(templateEnv.NODE_EXTRA_CA_CERTS,trust.caFile,label+': the launch template carries exactly the qualification CA');else assert.ok(!Object.hasOwn(templateEnv,'NODE_EXTRA_CA_CERTS'),label+': the product template carries no extra CA');
 const preparationIntent={workspace,configParentDirectory,secureStorageDirectory,launchTemplate,executableSha256,imageSha256:'a'.repeat(64),runnerSha256:'b'.repeat(64),sdkOptionsSha256,authoritySha256};
 const plan={purpose:'fable-composed-next-turn-rehearsal'},compiled=compileNativeBrokerPlan({runtime,plan,preparationIntent}),original=compiled.original;
 const resource={taskArn:facts.qualificationBinding.workerArn,clusterArn:'arn:aws:ecs:us-east-1:967807252336:cluster/Synthetic',taskDefinitionArn:'arn:aws:ecs:us-east-1:967807252336:task-definition/Synthetic:1',containerName:'worker',createdAtMs:Date.now()};
 const grantIntents=[{grantId:facts.grantId,capabilitySha256:facts.capabilitySha256,expiresAtMs:original.expiresAtMs}],key={binding,allocationKey:original.executionKey},intent={...key,original,allocationSha256:facts.allocationSha256,qualification:{attempt:1,policyRevision:plane.policyRevision},grantIntents,taskRequestSha256:'c'.repeat(64),expiresAtMs:original.expiresAtMs};
 await store.allocations.claim(intent,check);await store.allocations.record({...key,state:'ALLOCATED',resource},check);const admitted={original,resource:{...resource,grantFactsJsons:[JSON.stringify(facts)]}};await store.allocations.record({...key,state:'ADMITTED',resource:admitted.resource},check);receipt.step(label+'-allocation-admitted');
 let worker,controller;const routes=new Map(),count=p=>routes.set(p,(routes.get(p)??0)+1);
 const taskFetch=await listener(t,async r=>{count(new URL(r.url).pathname);return worker.application.handle(r);});
 // The runner's lifecycle calls reach the real worker run application; everything else is the controller (preparation, execution, checkpoints incl. completion, sessions).
 const controlFetch=await listener(t,async r=>{const path=new URL(r.url).pathname;count(path);const op=/^\/v1\/runner\/([a-z-]+)$/u.exec(path);if(op&&Object.hasOwn(runOwnerOperations,op[1])){const url=new URL(r.url);url.pathname='/internal/conversations/'+op[1];return plane.workerApplication.handle(new Request(url,r));}return controller.application.handle(r);});
 controller=createRemoteNativeController({runtimeConfiguration:{pool,store,allocator:{async allocate(){return admitted;},async stop(){}},supervisor,runtime,plan,preparationIntent,taskCapability:credential,controlCapabilitySha256:sha(control),verifyTask:async()=>({taskArn:resource.taskArn,imageSha256:preparationIntent.imageSha256,runnerSha256:preparationIntent.runnerSha256,checkedAtMs:Date.now(),expiresAtMs:original.expiresAtMs}),enabled:true,maxRequestMs:12000},transport:{original,origin:'https://synthetic-task.invalid',credential:control,fetchImpl:taskFetch,limits:{maxRequestMs:12000}},objects});
 const taskNative=createNativeCapabilityClient({configuration:{origin:'https://synthetic-controller.invalid',maxResponseBytes:2097152},credential,fetch:controlFetch});
 const mirror=createCheckpointSessionFactory({factory:createRuntimeSdkSessionFactory({origin:'https://synthetic-controller.invalid',credential,binding,fetchImpl:controlFetch}),client:createNativeSdkSessionClient({origin:'https://synthetic-controller.invalid',credential,binding,fetchImpl:controlFetch}),binding});
 worker=createRemoteNativeWorker({original,preparationIntent,controlCapabilitySha256:sha(control),taskCapabilitySha256:facts.capabilitySha256,taskArn:resource.taskArn,native:taskNative,processTransport:{original,origin:'https://synthetic-task.invalid',credential,fetchImpl:taskFetch},session:mirror.session,enabled:true,limits:{maxRequestMs:12000}});
 let closed=false;const close=async()=>{if(closed)return;closed=true;try{await worker.close();}catch{}try{await controller.close();}catch{}};t.after(async()=>{await close();await taskFetch.close();await controlFetch.close();});
 await controller.allocate();receipt.step(label+'-controller-allocated');
 const configuration={binding,versions:runtime.versions,workspace,proxyOrigin:new URL(runtime.proxyUrl).origin,sourceEnabled:false,limits:{shutdownMs:1000},remoteTask:{preparationIntent},captureOwnsClose:true};
 await assertRunnerWorkspace(configuration);
 const query=trust?input=>worker.query({...input,options:{...input.options,env:withQualificationEnvironment(input.options.env,trust)}}):worker.query;
 const execute=assembleConversationRunner({configuration,native:taskNative,query,credentialForBinding:async()=>credential,sessionFactory:mirror.factory});receipt.step(label+'-runner-assembled');
 async function facts_(){const h=await store.read(binding,{after:0,limit:100},check);const out={runState:h.run.state,lastSequence:h.lastSequence,events:h.events.map(e=>({sequence:e.sequence,type:e.type,data:e.type==='message.delta'?{text:e.data.text}:e.data})),routes:Object.fromEntries([...routes.entries()].sort())};try{const bound=(await store.allocations.read(key,check)).record;out.allocation={state:bound.state,launchBinding:bound.resource.launchBinding?{state:bound.resource.launchBinding.state}:null,physicalStopProven:bound.resource.physicalStopProven??null};}catch{}try{const c=await store.completions.read({binding,scopes,selectedClientId:CLIENT_ID},check);out.completion=c?{state:c.state,completionId:c.completionId,checkpointId:c.checkpointId,captureSequence:c.captureSequence,checkpointSha256:c.proof?.checkpointSha256??null,sessionId:c.proof?.checkpoint.sessionId??null,workspaceEntries:c.proof?.checkpoint.workspace.entries.length??null}:null;}catch{}const sessions=await pool.query('SELECT session_id,entries_count,bytes FROM meri_conversations.sdk_sessions WHERE tenant_id=$1 AND conversation_id=$2 AND run_id=$3',[binding.tenantId,binding.conversationId,binding.runId]);out.durableSdkSessions=sessions.rows.map(r=>({sessionId:r.session_id,entriesCount:r.entries_count,bytes:r.bytes}));const restorations=await pool.query('SELECT record FROM meri_conversations.native_restorations WHERE tenant_id=$1 AND conversation_id=$2 AND run_id=$3',[binding.tenantId,binding.conversationId,binding.runId]);out.restorations=restorations.rows.map(r=>({state:r.record.state}));return out;}
 /** Synthetic ECS: the allocator records retirement only after the task's physical stop is proven by inspection. */
 async function retire(){await close();const native=await controller.remote.inspect(original);assert.equal(native.physicalStopProven,true,label+': physical stop proven before retirement');const current=(await store.allocations.read(key,check)).record;await store.allocations.record({...key,state:'RETIRED',resource:{...current.resource,physicalStopProven:true}},check);return native;}
 return {binding,original,key,resource,scopes,controller,get worker(){return worker;},execute,routes,facts:facts_,retire,close,sdkConfigDirectory,secureStorageDirectory};
}
test('composed next turn: a second prompt in the same conversation restores the first turn and completes with the real CLI',async t=>{
 const receipt=makeReceipt('next-turn',{schema:'meri.composed-next-turn-rehearsal.v1',scope:SCOPE});
 let standIn=null;
 try{
  assert.notEqual(process.getuid(),0,'the runner workspace control refuses root');
  receipt.environment=environmentIdentity({trust,harnessFile:new URL(import.meta.url).pathname});receipt.qualificationTrust=trust?{caSha256:trust.caSha256,runId:trust.runId,cluster:trust.cluster,source:trust.sourceIdentity}:null;
  // Preflight before any fixture, cluster or launch: on the qualification route the stand-in is started here, in this process, on a loopback ephemeral port with the run-owned leaf.
  if(trust){standIn=await startProviderStandIn({certFile:trust.certFile,keyFile:trust.keyFile,host:'127.0.0.1',port:0});receipt.step('stand-in-started',{port:standIn.port});}
  const proxyUrl=trust?'https://127.0.0.1:'+standIn.port:'https://proxy.synthetic.invalid';receipt.providerStandIn=await requireProviderStandIn(proxyUrl);receipt.step('provider-stand-in-reachable');
  const f=await fixture(t,{leaseMs:120000,...(trust?{ownedCluster:trust.cluster,proxyUrl,launchEnvironment:env=>withQualificationEnvironment(env,trust)}:{})});receipt.step('fixture',{database:trust?trust.cluster.database:process.env.MERI_BROKER_TEST_DATABASE??'postgres',ownedCluster:Boolean(trust)});
  const objects=immutableObjects(),plane=await controlPlane(t,f);receipt.step('control-plane');
  const run1Inputs={binding:f.binding,credential:f.f.credential,facts:f.facts,runtime:f.runtime,workspace:f.workspace,configParentDirectory:f.configDirectory,secureStorageDirectory:join(f.root,'secure')};
  run1Inputs.supervisor=plane.registerRun({binding:f.binding,allocation:f.allocation,facts:f.facts,launchConfiguration:f.launchConfiguration});
  const run1=await composeRun(t,plane,objects,run1Inputs,receipt);
  // Turn 1 on the lifecycle path: the run completes through the canonical completion capture, not through a plain `completed` publication.
  assert.deepEqual(await run1.execute({binding:f.binding}),{state:'completed'});receipt.step('run1-completed');
  const h1=await run1.facts();receipt.run1.conversation=h1;
  assert.equal(h1.runState,'completed');assert.deepEqual(h1.events.map(e=>e.type),['run.status','run.status','run.status','message.delta','checkpoint.verified','run.status']);assert.equal(h1.events.filter(e=>e.type==='message.delta').map(e=>e.data.text).join(''),EXPECTED_REPLY,'the display text is the stand-in reply');
  assert.equal(h1.completion.state,'PUBLISHED');assert.equal(h1.completion.captureSequence,4);assert.ok(h1.routes['/v1/runner/checkpoint/complete']>=1,'the runner captured completion through the controller route');assert.equal(h1.durableSdkSessions.length,1);
  const native1=await run1.retire();receipt.run1.nativeAfterRetirement={state:native1.state,physicalStopProven:native1.physicalStopProven};receipt.step('run1-retired');
  // Turn 2: a fresh session is issued for the conversation; the real selector reserves the next run after verifying the checkpoint, the retirement and the budget revocation.
  const issued=await plane.sessions.issue({identityCredential:IDENTITY_CREDENTIAL,hints:{conversationId:f.binding.conversationId}});
  assert.notEqual(issued.context.runId,f.binding.runId,'the new session binds the reserved next run');assert.equal(plane.counters.revocations,1,'the first run\'s grant was revoked through the budget admission');
  const listed=await plane.store.nextRuns.listRuns({tenantId:f.binding.tenantId,conversationId:f.binding.conversationId},check),reservation=listed.reservations[0];assert.equal(reservation.state,'RESERVED');const binding2=reservation.target;assert.equal(binding2.runId,issued.context.runId);assert.equal(binding2.writerFence,2);
  const grants1=await plane.pool.query('SELECT state FROM meri_product_budget.grants WHERE run_id=$1',[f.binding.runId]);assert.deepEqual(grants1.rows.map(r=>r.state),['REVOKED']);
  const replayedIssue=await plane.sessions.issue({identityCredential:IDENTITY_CREDENTIAL,hints:{conversationId:f.binding.conversationId}});assert.equal(replayedIssue.context.runId,binding2.runId,'a second issuance recovers the same reserved target');
  const request2={requestId:randomUUID(),prompt:'Second prompt of the rehearsal, continuing the first turn.'},submitted=await plane.service.submit({credential:issued.credential,input:request2});assert.equal(submitted.replayed,false);assert.equal(submitted.run.state,'queued');assert.deepEqual(submitted.run.binding,binding2);receipt.step('run2-accepted',{sequenceBase:h1.lastSequence});
  assert.equal((await plane.service.submit({credential:issued.credential,input:request2})).replayed,true,'exact replay of the second prompt is idempotent');
  await assert.rejects(plane.service.publish({credential:issued.credential,binding:f.binding,event:{eventId:randomUUID(),createdAt:new Date().toISOString(),type:'message.delta',data:{messageId:randomUUID(),text:'late'}}}),'the new session cannot write to the completed run');
  // The second run's budget rows and grant binding (the product budget owner's rows for a new run), then its admitted-task authority.
  const q1=f.facts.qualificationBinding,credential2='synthetic-outcome-run-2',allocation2=structuredClone(f.allocation);allocation2.run={...allocation2.run,runId:binding2.runId};
  const facts2={...f.facts,grantId:randomUUID(),binding:binding2,qualificationBinding:{...q1,runId:binding2.runId,workerArn:'arn:aws:ecs:us-east-1:967807252336:task/Synthetic/'+'b'.repeat(32),fence:2},capabilitySha256:sha(credential2),allocationSha256:hash(allocation2)},q2=facts2.qualificationBinding;
  await plane.pool.query('INSERT INTO meri_product_budget.runs(run_id,attempt,worker_arn,fence,policy_revision) VALUES($1,$2,$3,$4,$5)',[q2.runId,q2.attempt,q2.workerArn,q2.fence,q2.policyRevision]);
  await plane.pool.query('INSERT INTO meri_product_budget.grants(grant_id,run_id,attempt,worker_arn,fence,policy_revision,capability_sha256,expires_at,state) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',[facts2.grantId,q2.runId,q2.attempt,q2.workerArn,q2.fence,q2.policyRevision,facts2.capabilitySha256,new Date(plane.expiresAtMs),'ACTIVE']);
  await createPostgresToolBudget({pool:plane.pool,allocationJson:JSON.stringify(allocation2),namespace:'product',now:Date.now}).bindTrustedGrant(JSON.stringify({...facts2,invocationId:'rehearsal-run-2'}));
  const root2=mkdtempSync(join(tmpdir(),'meri-next-turn-'));t.after(()=>rmSync(root2,{recursive:true,force:true}));const workspace2=join(root2,binding2.conversationId),configParentDirectory2=join(root2,'config');mkdirSync(workspace2,{mode:0o700});mkdirSync(configParentDirectory2,{mode:0o700});
  const launch1=f.launchConfiguration,launchConfiguration2={...launch1,binding:binding2,workspace:workspace2,configDirectory:configParentDirectory2,launch:{...launch1.launch,args:launch1.launch.args.map(a=>a===launch1.workspace?workspace2:a===launch1.configDirectory?configParentDirectory2:a),env:{...launch1.launch.env,CLAUDE_CONFIG_DIR:configParentDirectory2,CLAUDE_SECURESTORAGE_CONFIG_DIR:configParentDirectory2}}};
  const run2Inputs={binding:binding2,credential:credential2,facts:facts2,runtime:{...f.runtime,binding:binding2,proxyCredential:'synthetic-task-proxy-run-2'},workspace:workspace2,configParentDirectory:configParentDirectory2,secureStorageDirectory:join(root2,'secure')};
  run2Inputs.supervisor=plane.registerRun({binding:binding2,allocation:allocation2,facts:facts2,launchConfiguration:launchConfiguration2});
  const run2=await composeRun(t,plane,objects,run2Inputs,receipt,{resume:h1.completion.sessionId});
  assert.deepEqual(await run2.execute({binding:binding2}),{state:'completed'});receipt.step('run2-completed');
  const h2=await run2.facts();receipt.run2.conversation=h2;
  assert.equal(h2.runState,'completed');assert.equal(h2.events[0].sequence,1);assert.deepEqual(h2.events.map(e=>e.type),['run.status','run.status','run.status','message.delta','checkpoint.verified','run.status']);
  assert.equal(h2.completion.state,'PUBLISHED');assert.deepEqual(h2.restorations.map(r=>r.state),['RESTORED'],'the first turn\'s checkpoint was restored for the second run');assert.equal(h2.durableSdkSessions.length,1);assert.ok(h2.routes['/v1/runner/checkpoint/complete']>=1);
  assert.equal(receipt.run2.launchTemplate.resumeArgument,true,'the second launch resumes the first turn\'s SDK session');assert.notEqual(receipt.run2.sdkOptionsSha256,receipt.run1.sdkOptionsSha256);
  const runs=await plane.store.nextRuns.listRuns({tenantId:f.binding.tenantId,conversationId:f.binding.conversationId},check);
  assert.deepEqual(runs.runs.map(r=>[r.binding.writerFence,r.state,r.sequenceBase,r.lastSequence]),[[1,'completed',0,h1.lastSequence],[2,'completed',h1.lastSequence,h2.lastSequence]]);assert.deepEqual(runs.reservations.map(r=>r.state),['ACCEPTED']);
  receipt.conversation={runs:runs.runs.map(r=>({writerFence:r.binding.writerFence,runId:r.binding.runId,state:r.state,sequenceBase:r.sequenceBase,lastSequence:r.lastSequence})),reservations:runs.reservations,immutableObjects:objects.size(),starts:plane.counters.starts,revocations:plane.counters.revocations};
  const native2=await run2.retire();receipt.run2.nativeAfterRetirement={state:native2.state,physicalStopProven:native2.physicalStopProven};
  // Neither completed run accepts a replayed activity or a third dispatch.
  await assert.rejects(run2.execute({binding:binding2}),/EXECUTION_FAILED/);assert.equal((await run2.facts()).runState,'completed');
  receipt.sdkConfigDirectoryTrees={run1:tree(run1.sdkConfigDirectory),run2:tree(run2.sdkConfigDirectory)};receipt.outcome='PASSED';
 }catch(error){receipt.error={code:error?.code??null,message:String(error?.message??error),errors:error?.errors?.map(e=>String(e?.message??e)),stack:String(error?.stack??'').split('\n').slice(0,6)};throw error;}
 finally{
  // The stand-in is this process's own resource: it is closed here and its absence is read back before the receipt is written; a listener that still answers fails the run.
  if(standIn){const calls=standIn.calls.map(c=>({pathname:c.pathname,method:c.method,model:c.model??null,authorizationPresent:c.authorizationPresent}));await standIn.close();let closedVerified=false;try{await requireProviderStandIn('https://127.0.0.1:'+standIn.port);}catch(error){closedVerified=error?.code==='REHEARSAL_PROVIDER_STANDIN_UNREACHABLE';}
   receipt.providerStandIn={...receipt.providerStandIn,calls,closedVerified};if(!closedVerified){receipt.outcome='FAILED';receipt.error??={code:'REHEARSAL_STANDIN_STILL_LISTENING',message:'the stand-in port still answers after close'};}}
  receipt.write();}
});
