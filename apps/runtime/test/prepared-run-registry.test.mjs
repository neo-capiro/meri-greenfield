import test from 'node:test';
import assert from 'node:assert/strict';
import {normalize} from 'node:path';
import {createPreparedRunRegistry} from '../prepared-run-registry.mjs';
import {compilePreparedRunFacts} from '../prepared-run-issuance.mjs';
import {candidateFixture} from './prepared-candidate-fixture.mjs';
import {compileNativeBrokerPlan} from '../native-authority/broker-stack.mjs';
import {capabilityDigest} from '../native-authority/task-verifier.mjs';
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {id} from '../../control/conversations/test/application-fixture.mjs';
import {NATIVE_READS_SCHEMA_VERSION,nativeReadOperations} from '../../../packages/contracts/runtime-0.2/reads.mjs';
function fixture(){
 const f=candidateFixture(),c=f.configuration.nativeCandidate,binding={...f.binding,runId:id(500),attemptId:id(501),workerId:id(502),writerFence:2},stats={prepare:0,allocate:0,close:0,verify:0},state={reservation:'ACCEPTED',run:'queued',unknown:false,closed:false,changeRequest:false},token='synthetic-target-token';
 for(const k of ['workspace','configParentDirectory','secureStorageDirectory'])c.preparationIntent[k]=normalize(c.preparationIntent[k]);c.preparationIntent.launchTemplate.command=normalize(c.preparationIntent.launchTemplate.command);c.preparationIntent.launchTemplate.env.CLAUDE_SECURESTORAGE_CONFIG_DIR=c.preparationIntent.secureStorageDirectory;
 const originalSource=compileNativeBrokerPlan({runtime:{...c.runtime,proxyCredential:f.secret.proxy},plan:c.plan,preparationIntent:c.preparationIntent}).original,sourceRecord={state:'RETIRED',original:originalSource,grantIntents:c.grantIntents,resource:{physicalStopProven:true,taskArn:'synthetic-source'}},request={requestId:id(503),prompt:'A different second prompt'},allocation=JSON.parse(c.allocationJson);allocation.run=Object.fromEntries(Object.keys(allocation.run).map(k=>[k,binding[k]]));
 const facts={runtime:{...c.runtime,binding,proxyCredential:f.secret.proxy},plan:c.plan,preparationIntent:c.preparationIntent,allocationJson:JSON.stringify(allocation),qualification:c.qualification,grantIntents:[{grantId:id(600),capabilitySha256:capabilityDigest(token),expiresAtMs:c.runtime.deadlineMs}],grantId:id(600),operations:c.operations,taskRequest:c.taskRequest,containerName:c.containerName,controlCapabilitySha256:capabilityDigest(f.secret.control),transport:{origin:c.taskOrigin,http:c.taskHttp}};
 let issued,targetAllocation;
 const issuance={async prepare({source,signal,...intent}){stats.prepare++;stats.source=source;if(!state.facts)assert.deepEqual(source.original,originalSource);if(state.unknown)throw Error('Synthetic UNKNOWN');const base={...intent,issuanceKey:hash(binding),grantId:facts.grantId,capabilitySha256:capabilityDigest(token)},compiled=compilePreparedRunFacts(facts,{intent,issuance:base,now:()=>f.now});return issued??={issuance:{...base,factsSha256:compiled.factsSha256},...compiled};},async resolveFacts(){return facts;},async resolveCapability(){return token;}};
 const store={async read(b){assert.deepEqual(b,binding);return {run:{binding,state:state.run,scopes:f.scopes,policyRevision:c.qualification.policyRevision,versions:c.runtime.versions},request:{...request,...(state.changeRequest?{prompt:'changed'}:{})}};},nextRuns:{async readTarget(){return {state:state.reservation,target:binding,source:f.binding,scopes:f.scopes,policyRevision:c.qualification.policyRevision,versions:c.runtime.versions,...(state.facts?{facts:state.facts}:{})};},async current(){return {binding,reserved:false,scopes:f.scopes,policyRevision:c.qualification.policyRevision};}},allocations:{async read({binding:b}){return {record:b.runId===binding.runId?state.targetRecord??targetAllocation:Object.hasOwn(state,'sourceRecord')?state.sourceRecord:sourceRecord};}},async append(){assert.fail('no reconciliation write is expected');}};
 const allocate=async configuration=>{stats.allocate++;if(state.failAllocation)throw Error('Synthetic allocation UNKNOWN');assert.equal(configuration.taskCapability,token);assert.deepEqual(configuration.identity.commandContext.binding,binding);assert.deepEqual(configuration.runtime.binding,binding);const original=issued.original,resource={taskArn:'arn:aws:ecs:us-east-1:967807252336:task/synthetic/'+'a'.repeat(32)};targetAllocation={state:'ADMITTED',original,resource:{...resource,launchBinding:{state:'STARTED'}}};return {resource,application:{async handle(){stats.routed=(stats.routed??0)+1;return Response.json({runId:binding.runId});}},supervisor:{application:{async handle(){return null;}},taskVerifier:{async verify(){stats.verify++;}}},prepared:{preparationAuthorizer:{async admitted(){return {original,taskArn:resource.taskArn};}},stack:{broker:{async poll(){return {binding,executionId:original.executionId,state:'executing'};}}}},async reconcile(){return {original,taskArn:resource.taskArn};},async close(){stats.close++;}};};
 const options={issuance,issuanceIntent:async()=>({expiresAtMs:c.runtime.deadlineMs}),store,pool:{connect(){assert.fail('No database');}},client:{send(){assert.fail('No AWS');}},identity:{origin:c.identity.origin,credential:f.secret.identity,commandContext:c.identity.commandContext,fetchImpl:async()=>assert.fail('No external identity')},controlCapability:f.secret.control,objects:{},limits:{maxRequestMs:1000,maxFactBytes:131072,cleanupMs:1000},now:()=>f.now,allocate,fetchImpl:async()=>assert.fail('No HTTP')};
 return {binding,stats,state,options,token,versions:c.runtime.versions,sourceRecord,facts,create:()=>createPreparedRunRegistry(options),get issued(){return issued;}};
}
const settle=()=>new Promise(resolve=>setImmediate(resolve));
async function kickoff(entry){await entry.kickoff.kickoff({binding:entry.binding,executionKey:entry.original.executionKey});for(let i=0;i<30;i++){await settle();try{const status=await entry.kickoff.status({binding:entry.binding,executionId:entry.original.executionId});if(status.state==='executing')return status;}catch{}}throw Error('Kickoff did not settle');}
test('accepted run prepares one cached entry concurrently without allocating until canonical kickoff',async()=>{
 const f=fixture(),registry=f.create();try{const [a,b]=await Promise.all([registry.ensure({binding:f.binding}),registry.ensure({binding:f.binding})]);assert.equal(a,b);assert.equal(registry.get(f.binding),a);assert.equal(registry.entries().length,1);assert.equal(f.stats.prepare,1);assert.equal(f.stats.allocate,0);assert.equal((await kickoff(a)).state,'executing');assert.equal(f.stats.allocate,1);await kickoff(a);assert.equal(f.stats.allocate,1);assert.equal(f.stats.prepare,2);}finally{await registry.close();}assert.equal(f.stats.close,1);
});
test('pending reservation refuses issuance; later accepted prompt can prepare',async()=>{
 const f=fixture(),registry=f.create();try{f.state.reservation='RESERVED';await assert.rejects(registry.ensure({binding:f.binding}));assert.equal(f.stats.prepare,0);f.state.reservation='ACCEPTED';await registry.ensure({binding:f.binding});assert.equal(f.stats.prepare,1);}finally{await registry.close();}
});
test('UNKNOWN issuance entry is sticky and never reissued by same registry',async()=>{
 const f=fixture(),registry=f.create();try{f.state.unknown=true;await assert.rejects(registry.ensure({binding:f.binding}));f.state.unknown=false;await assert.rejects(registry.ensure({binding:f.binding}));assert.equal(f.stats.prepare,1);assert.equal(f.stats.allocate,0);}finally{await registry.close();}
});
test('retired source and active canonical target are required before issuance',async()=>{
 for(const variant of ['source','cancelled']){const f=fixture(),registry=f.create();try{if(variant==='source')f.sourceRecord.state='ADMITTED';else f.state.run='cancelled';await assert.rejects(registry.ensure({binding:f.binding}));assert.equal(f.stats.prepare,0);}finally{await registry.close();}}
});
test('bootstrap stays unavailable before allocation and isolates credentials, versions and binding',async()=>{
 const f=fixture(),registry=f.create();try{const entry=await registry.ensure({binding:f.binding}),input={binding:f.binding,versions:f.versions,credential:f.token};assert.ok(entry.matchesTaskCapability(f.token));assert.equal(entry.matchesTaskCapability(f.options.controlCapability),false);assert.ok(!JSON.stringify(entry).includes(f.token));await assert.rejects(entry.bootstrap(input));await kickoff(entry);const boot=await entry.bootstrap(input);assert.deepEqual(boot.original,entry.original);assert.equal(boot.preparedKickoff,true);assert.equal(boot.processOrigin,f.issued.transport.origin,'the bootstrap names this entry\'s own transport');assert.deepEqual(boot.http,f.issued.transport.http);assert.equal(f.stats.verify,1);for(const change of [{credential:f.options.controlCapability},{binding:{...f.binding,runId:id(700)}},{versions:{...f.versions,sdk:'wrong'}}])await assert.rejects(entry.bootstrap({...input,...change}));assert.equal(f.stats.verify,1);}finally{await registry.close();}
});
test('cancellation or changed accepted prompt before kickoff refuses allocation',async()=>{
 for(const change of ['cancel','request']){const f=fixture(),registry=f.create();try{const entry=await registry.ensure({binding:f.binding});if(change==='cancel')f.state.run='cancelled';else f.state.changeRequest=true;await entry.kickoff.kickoff({binding:f.binding,executionKey:entry.original.executionKey});for(let i=0;i<5;i++)await settle();assert.equal(f.stats.allocate,0);await assert.rejects(entry.kickoff.status({binding:f.binding,executionId:entry.original.executionId}));}finally{await registry.close();}}
});
test('close is idempotent, prevents new entries and does not allocate unstarted runs',async()=>{
 const f=fixture(),registry=f.create();await registry.ensure({binding:f.binding});await registry.close();await registry.close();assert.equal(f.stats.allocate,0);assert.equal(f.stats.close,0);assert.throws(()=>registry.ensure({binding:f.binding}));
});
test('explicit trusted expiry cannot exceed configured ceiling or renew itself',async()=>{
 const f=fixture();f.options.maximumExpiresAtMs=f.options.now()+10;const registry=f.create();try{await assert.rejects(registry.ensure({binding:f.binding}));assert.equal(f.stats.prepare,0);}finally{await registry.close();}
});
test('allocation UNKNOWN remains one attempted dispatch through repeated kickoff and ensure',async()=>{
 const f=fixture(),registry=f.create();try{f.state.failAllocation=true;const entry=await registry.ensure({binding:f.binding});await entry.kickoff.kickoff({binding:f.binding,executionKey:entry.original.executionKey});for(let i=0;i<5;i++)await settle();assert.equal(f.stats.allocate,1);assert.equal(await registry.ensure({binding:f.binding}),entry);await assert.rejects(entry.kickoff.kickoff({binding:f.binding,executionKey:entry.original.executionKey}));assert.equal(f.stats.allocate,1);}finally{await registry.close();}
});
test('late owned controller settlement after close is contained exactly once',async()=>{
 const f=fixture(),gate=Promise.withResolvers(),allocate=f.options.allocate;f.options.limits.cleanupMs=20;f.options.allocate=async input=>{await gate.promise;return allocate(input);};const registry=f.create(),entry=await registry.ensure({binding:f.binding});await entry.kickoff.kickoff({binding:f.binding,executionKey:entry.original.executionKey});for(let i=0;i<5;i++)await settle();
 await assert.rejects(registry.close());gate.resolve();for(let i=0;i<10;i++)await settle();assert.equal(f.stats.allocate,1);assert.equal(f.stats.close,1);assert.equal(await entry.application.handle(new Request('https://task.invalid/')),null);
});
const post=(path,body,credential,headers={})=>new Request('https://control.synthetic.invalid'+path,{method:'POST',headers:{authorization:'Bearer '+credential,'content-type':'application/json',...headers},body:JSON.stringify(body)});
test('registry forwards borrowed factory only with real per-entry READS metadata at lazy allocation',async()=>{
 const f=fixture(),factory=()=>assert.fail('allocator fixture must not fabricate the native verifier');f.facts.approvedReads={schemaVersion:NATIVE_READS_SCHEMA_VERSION,enabled:true,operations:JSON.parse(f.facts.allocationJson).manifest.allowedOperations,maxExecuteMs:1000,maxRequestBytes:65536,maxResponseBytes:1048576};f.facts.operations=[...new Set([...f.facts.operations,...nativeReadOperations])];f.options.approvedReads=f.facts.approvedReads;f.options.createReadsRuntime=factory;f.options.sourceEnabled=true;f.options.issuance.readIssuance=async()=>f.issued.issuance;
 const allocate=f.options.allocate;let seen;f.options.allocate=options=>{seen=options;return allocate(options);};const registry=f.create();try{const entry=await registry.ensure({binding:f.binding});assert.equal(seen,undefined);await kickoff(entry);assert.equal(seen.createReadsRuntime,factory);assert.equal(seen.taskCapability,f.token);assert.deepEqual(seen.approvedReads,f.facts.approvedReads);assert.equal(typeof seen.readCurrentEntry,'function');assert.equal(seen.issuanceFactsSha256,f.issued.factsSha256);assert.equal(seen.runRequestSha256,f.issued.issuance.requestSha256);}finally{await registry.close();}
});
test('registry rejects competing prebuilt/factory composition before issuance or allocation',()=>{
 const f=fixture();f.options.generalReads={readAvailability(){},execute(){}};f.options.createReadsRuntime=()=>f.options.generalReads;assert.throws(()=>f.create(),/CONFIGURATION/);assert.equal(f.stats.prepare,0);assert.equal(f.stats.allocate,0);
});
test('HTTP kickoff authenticates and validates closed request before any issuance',async()=>{
 const f=fixture(),registry=f.create(),body={binding:f.binding,executionKey:hash(f.binding)};try{
  assert.equal((await registry.handle(post('/v1/execution/kickoff',body,f.token))).status,403);
  assert.equal((await registry.handle(post('/v1/execution/kickoff',{...body,executionKey:'f'.repeat(64)},f.options.controlCapability))).status,403);
  assert.equal((await registry.handle(post('/v1/execution/kickoff',body,f.options.controlCapability,{'content-length':'131073'}))).status,403);
  assert.equal((await registry.handle(post('/v1/execution/kickoff',body,f.options.controlCapability,{'content-type':'text/plain'}))).status,403);
  assert.equal(f.stats.prepare,0);assert.equal(f.stats.allocate,0);
  assert.equal((await registry.handle(post('/v1/execution/kickoff',body,f.options.controlCapability))).status,200);for(let i=0;i<10;i++)await settle();assert.equal(f.stats.allocate,1);
 }finally{await registry.close();}
});
test('HTTP status/bootstrap never prepare and unowned bindings fall through',async()=>{
 const f=fixture(),registry=f.create();try{
  assert.equal(await registry.handle(post('/v1/execution/kickoff/status',{binding:f.binding,executionId:hash(f.binding)},f.options.controlCapability)),null);
  assert.equal(await registry.handle(post('/v1/runner/native/bootstrap',{binding:f.binding,versions:f.versions},f.token)),null);assert.equal(f.stats.prepare,0);
  const entry=await registry.ensure({binding:f.binding});await kickoff(entry);
  assert.equal((await registry.handle(post('/v1/runner/native/bootstrap',{binding:f.binding,versions:f.versions},f.options.controlCapability))).status,403);
  assert.equal((await registry.handle(post('/v1/runner/native/bootstrap',{binding:f.binding,versions:f.versions},f.token))).status,200);
  const unowned={...f.binding,runId:id(777)};assert.equal(await registry.handle(post('/v1/runner/runtime',{binding:unowned,versions:f.versions},f.options.controlCapability)),null);assert.equal(f.stats.routed??0,0);
  assert.equal((await registry.handle(post('/v1/runner/runtime',{binding:f.binding,versions:f.versions},f.token))).status,200);assert.equal(f.stats.routed,1);
 }finally{await registry.close();}
});
test('after a restart, HTTP kickoff/stop rebuilds the accepted target without allocating and settles the run the original left running',async()=>{
 const f=fixture(),registry=f.create(),appended=[];f.state.run='running';f.state.targetRecord={state:'RETIRED',resource:{physicalStopProven:true}};
 f.options.store.append=async(b,event)=>{assert.deepEqual(b,f.binding);appended.push(event.data);f.state.run=event.data.state;return {...event,binding:b,scopes:[]};};
 const body={binding:f.binding,executionId:hash(f.binding)};try{
  assert.equal((await registry.handle(post('/v1/execution/kickoff/stop',body,f.token))).status,403,'task credentials cannot stop');
  assert.equal((await registry.handle(post('/v1/execution/kickoff/stop',{...body,executionId:'f'.repeat(64)},f.options.controlCapability))).status,403);
  const response=await registry.handle(post('/v1/execution/kickoff/stop',body,f.options.controlCapability));assert.equal(response.status,200);
  assert.deepEqual(appended,[{state:'failed',reasonCode:'ATTEMPT_LOST'}]);assert.equal(f.stats.allocate,0);assert.equal(f.stats.prepare,1,'the issuance is replayed, not reissued');
  f.state.targetRecord={state:'UNKNOWN',resource:null};f.state.run='running';const other=f.create();try{assert.equal((await other.handle(post('/v1/execution/kickoff/stop',body,f.options.controlCapability))).status,503,'an unproven stop stays UNKNOWN');assert.equal(appended.length,1);}finally{await other.close();}
 }finally{await registry.close();}
});
/** Stop-only re-entry (synthetic store and stop owner): a restarted registry never held the target's controller. */
function stopOnly(f,{fail=0}={}){const appended=[],calls=[];f.state.targetRecord={state:'ALLOCATED',resource:{taskArn:'arn:aws:ecs:us-east-1:967807252336:task/synthetic/'+'a'.repeat(32)}};
 f.options.store.append=async(b,event)=>{assert.deepEqual(b,f.binding);appended.push(event.data);f.state.run=event.data.state;return {...event,binding:b,scopes:[]};};
 f.options.retireOriginal=configuration=>{calls.push(configuration);return {async stop(){if(calls.length<=fail)throw Error('synthetic stop UNKNOWN');f.state.targetRecord={state:'RETIRED',resource:{physicalStopProven:true}};return {physicalStopProven:true};}};};
 return {appended,calls,body:{binding:f.binding,executionId:hash(f.binding)}};}
test('after a restart, a stop for an ALLOCATED target asks the stop-only owner with the exact replayed facts, never allocates, and settles once retired',async()=>{
 const f=fixture(),x=stopOnly(f);f.state.run='running';const registry=f.create();try{
  assert.equal((await registry.handle(post('/v1/execution/kickoff/stop',x.body,f.options.controlCapability))).status,200);assert.deepEqual(x.appended,[{state:'failed',reasonCode:'ATTEMPT_LOST'}]);
  assert.equal(x.calls.length,1);const cfg=x.calls[0];for(const k of ['allocationJson','qualification','grantIntents','runtime','plan','preparationIntent','taskRequest','containerName'])assert.deepEqual(cfg[k],f.facts[k],k);assert.equal(cfg.store,f.options.store);
  assert.equal(f.stats.allocate,0);assert.equal(f.stats.prepare,1,'replayed, not reissued');
  const entry=registry.get(f.binding);await assert.rejects(entry.kickoff.kickoff({binding:f.binding,executionKey:entry.original.executionKey}),'a stop-only entry never kicks off');assert.equal(f.stats.allocate,0);
 }finally{await registry.close();}});
test('re-entry: an uncertain stop-only retirement refuses the stop (UNKNOWN, nothing written) and a later stop resumes from durable state',async()=>{
 const f=fixture(),x=stopOnly(f,{fail:2});f.state.run='running';const registry=f.create();try{
  for(let i=0;i<2;i++){assert.equal((await registry.handle(post('/v1/execution/kickoff/stop',x.body,f.options.controlCapability))).status,503);assert.deepEqual(x.appended,[]);}
  assert.equal((await registry.handle(post('/v1/execution/kickoff/stop',x.body,f.options.controlCapability))).status,200);assert.deepEqual(x.appended,[{state:'failed',reasonCode:'ATTEMPT_LOST'}]);assert.equal(x.calls.length,3);assert.equal(f.stats.allocate,0);
 }finally{await registry.close();}});
test('the restart stop route also serves a target already terminal whose original was never retired, and leaves its outcome',async()=>{
 const f=fixture(),x=stopOnly(f);f.state.run='failed';const registry=f.create();try{
  assert.equal((await registry.handle(post('/v1/execution/kickoff/stop',x.body,f.options.controlCapability))).status,200);assert.equal(f.state.targetRecord.state,'RETIRED');assert.deepEqual(x.appended,[]);
  await assert.rejects(registry.ensure({binding:{...f.binding,runId:id(778)}}));
 }finally{await registry.close();}
 const g=fixture();g.state.run='failed';const other=g.create();try{await assert.rejects(other.ensure({binding:g.binding}),'kickoff preparation still requires a live target');assert.equal(g.stats.prepare,0);}finally{await other.close();}});
test('a source with only its foreclosure (no-authority) evidence is accepted exactly; anything else is refused before issuance',async()=>{
 const foreclosure=f=>({binding:f.sourceRecord.original.binding,allocationKey:hash(f.sourceRecord.original.binding),state:'FORECLOSED',foreclosure:{eventId:id(890),eventSha256:'e'.repeat(64),state:'cancelled'}});
 const f=fixture();f.state.sourceRecord=foreclosure(f);f.state.facts={checkpoint:null,noAuthority:{foreclosureSha256:hash(f.state.sourceRecord)}};const registry=f.create();try{
  await registry.ensure({binding:f.binding});assert.deepEqual(f.stats.source,{binding:f.sourceRecord.original.binding,foreclosureSha256:hash(f.state.sourceRecord)});}finally{await registry.close();}
 for(const variant of ['sha','missing','retired']){const g=fixture();g.state.sourceRecord=variant==='missing'?null:variant==='retired'?g.sourceRecord:foreclosure(g);g.state.facts={checkpoint:null,noAuthority:{foreclosureSha256:variant==='sha'?'f'.repeat(64):hash(foreclosure(g))}};
  const other=g.create();try{await assert.rejects(other.ensure({binding:g.binding}),variant);assert.equal(g.stats.prepare,0,variant);}finally{await other.close();}}});
test('the production issuance-intent shape (expiry plus its persisted flag) is accepted; any other field is refused before issuance',async()=>{
 for(const persisted of [false,true]){const f=fixture(),{expiresAtMs}=await f.options.issuanceIntent();f.options.issuanceIntent=async()=>({expiresAtMs,persisted});const registry=f.create();try{await registry.ensure({binding:f.binding});assert.equal(f.stats.prepare,1);}finally{await registry.close();}}
 for(const extra of [{persisted:'yes'},{renew:true}]){const f=fixture(),{expiresAtMs}=await f.options.issuanceIntent();f.options.issuanceIntent=async()=>({expiresAtMs,...extra});const registry=f.create();try{await assert.rejects(registry.ensure({binding:f.binding}));assert.equal(f.stats.prepare,0);}finally{await registry.close();}}});
