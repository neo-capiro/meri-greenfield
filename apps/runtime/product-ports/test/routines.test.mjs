/** SYNTHETIC: the routines family over the real foreground feature, kill switch and readiness census. The enabled case borrows the
 * existing routines application fixture (synthetic SQL, Core and Temporal); it proves composition, not live owners. */
import test from 'node:test';import assert from 'node:assert/strict';
import {createProductPortsFactory} from '../index.mjs';
import {createRoutinesFamily,routinesFamily,compileRoutinesConfiguration,PRODUCTION_ROUTINE_OWNERS} from '../routines.mjs';
import {captureRuntimePorts} from '../../product-applications.mjs';
import {productReadiness} from '../../product-readiness.mjs';
import {ROUTINE_PATHS} from '../../../control/schedules/application-http.mjs';
import {applicationFixture,routineRequest} from '../../../control/schedules/test/application-fixture.mjs';
const code=c=>e=>e?.code===c;
const base={limits:{startupMs:1000,shutdownMs:1000,requestMs:5000,requestBytes:131072},native:{maxResponseBytes:131072}};
const post=(path,body={},credential='synthetic')=>new Request('https://synthetic.invalid'+path,{method:'POST',headers:{authorization:'Bearer '+credential,'content-type':'application/json'},body:JSON.stringify(body)});
const census=ports=>{const r=productReadiness({ports:captureRuntimePorts(ports),retention:null,sourceEnabled:false});return [r.owners.find(o=>o.name==='schedules.application').state,r.owners.find(o=>o.name==='schedules.inbox').state];};

test('production composition is the disabled feature: nothing borrowed is inspected and readiness says disabled',async()=>{
 let touched=0;const poison=new Proxy({},{get(){touched++;throw Error('unexpected');}});
 for(const configuration of [base,{...base,routines:{enabled:false}}]){
  const ports=createProductPortsFactory({families:[['routines',createRoutinesFamily]]})(Object.freeze({configuration,pool:poison,client:poison,native:poison,now:Date.now,canonicalProductPorts:{}}));
  assert.deepEqual(Object.keys(ports),['routinesApplicationFactory']);assert.deepEqual(census(ports),['disabled','disabled']);
  const response=await ports.routinesApplicationFactory.create({sessions:poison}).handle(post(ROUTINE_PATHS.prepare));
  assert.equal(response.status,503);assert.equal((await response.json()).error.code,'ROUTINES_UNAVAILABLE');
 }
 assert.equal(touched,0);
});

test('enabled in configuration without the trusted owners reports unavailable instead of failing control startup',async()=>{
 const {ports}=createRoutinesFamily({configuration:{...base,routines:{enabled:true}},pool:{},client:{},now:Date.now});
 assert.deepEqual(census(ports),['unavailable','unavailable']);
 assert.equal((await ports.routinesApplicationFactory.create({sessions:{}}).handle(post(ROUTINE_PATHS.list))).status,503);
 for(const routines of [{},{enabled:'true'},{enabled:true,owners:'forged'}])assert.throws(()=>compileRoutinesConfiguration({routines}),code('ROUTINES_CONFIGURATION'));
 for(const owners of [{},{context:{},runControl:{cancel(){}},retirement:{retire(){}}},{context:{commandContext:1,allocationJson:1,template:1,workflow:1,policy:1,limits:1},runControl:{},retirement:{retire(){}}}])
  assert.throws(()=>routinesFamily(owners),code('ROUTINES_CONFIGURATION'));
 // Every missing production owner is named with the lane that must produce it.
 assert.deepEqual(Object.keys(PRODUCTION_ROUTINE_OWNERS).sort(),['context.commandContext+allocationJson+template','context.policy','context.workflow','retirement','runControl']);
});

test('with every trusted owner supplied the enabled feature composes over the actual sessions and serves preparation',async()=>{
 const f=await applicationFixture();try{
  const {commandContext,allocationJson,template,workflow,policy,limits}=f.contextConfiguration,cancelled=[],retired=[];
  const client={...f.client,connection:{withDeadline:(deadline,fn)=>fn(),withAbortSignal:(signal,fn)=>fn()}};
  const family=routinesFamily({context:{commandContext,allocationJson,template,workflow,policy,limits},newId:f.newId,
   runControl:{async cancel(call){cancelled.push(call);}},retirement:{async retire(call){retired.push(call);}}});
  const {ports}=family({configuration:{...base,routines:{enabled:true}},pool:f.pool,client,now:f.now});
  assert.equal(ports.routinesApplicationFactory.state(),'pending');
  const app=ports.routinesApplicationFactory.create({sessions:f.sessions});assert.deepEqual(census(ports),['composed','pending']);
  const prepared=await app.handle(post(ROUTINE_PATHS.prepare,{requestId:'public-request',operation:'schedule_task',request:routineRequest()},f.session.credential));
  assert.equal(prepared.status,200);assert.equal((await prepared.json()).status,'approval_required');
  assert.equal(f.temporal.calls.create,0);assert.deepEqual([cancelled.length,retired.length],[0,0]);
 }finally{await f.close();}
});

test('configuration.routines.core produces context.policy and runControl from the Core wires over the actual sessions, attended only',async()=>{
 const {coreRoutes,coreSigner,CORE_ORIGIN}=await import('../../native-authority/test/routines-core-fixture.mjs');
 const {binding:owner,clientId,NOW}=await import('../../../control/schedules/test/application-fixture.mjs');
 const f=await applicationFixture();try{
  const {commandContext,allocationJson,template,workflow,limits}=f.contextConfiguration,retired=[];
  const client={...f.client,workflow:{...f.client.workflow,start(){throw Error('unexpected workflow start');}},connection:{withDeadline:(deadline,fn)=>fn(),withAbortSignal:(signal,fn)=>fn()}};
  const core={requests:[],serviceSecret:'synthetic-routines-service-secret',bearer:'synthetic-native',principal:{tenantId:owner.tenantId,actorId:owner.actorId},signer:coreSigner(),coreNow:f.now,
   membership:()=>({tenantId:owner.tenantId,actorId:owner.actorId,clientIds:[clientId],expiresAtMs:NOW+60000}),rewrite:null};
  const configuration={...base,temporal:{taskQueue:'meri-conversations'},routines:{enabled:true,core:{origin:CORE_ORIGIN,serviceSecretFile:'/run/meri/routines-service-secret',cancellationProof:core.signer.pin}}};
  const transport={fetchImpl:coreRoutes(core),readSecret:async()=>Buffer.from(core.serviceSecret)};
  // One source per owner: a trusted policy/runControl beside `core` is refused; without `core` the lane-1 owners alone are unavailable.
  assert.throws(()=>routinesFamily({context:{commandContext,allocationJson,template,workflow,limits,policy:f.contextConfiguration.policy},runControl:{async cancel(){}},retirement:{async retire(){}}},transport)({configuration,pool:f.pool,client,now:f.now}),code('ROUTINES_CONFIGURATION'));
  assert.throws(()=>routinesFamily({context:{commandContext,allocationJson,template,workflow,limits,policy:f.contextConfiguration.policy},retirement:{async retire(){}}}),code('ROUTINES_CONFIGURATION'));
  assert.deepEqual(census(routinesFamily({context:{commandContext,allocationJson,template,workflow,limits},retirement:{async retire(){}}})({configuration:{...base,routines:{enabled:true}},pool:f.pool,client,now:f.now}).ports),['unavailable','unavailable']);
  const family=routinesFamily({context:{commandContext,allocationJson,template,workflow,limits},newId:f.newId,retirement:{async retire(call){retired.push(call);return {physicalStopProven:true};}}},transport);
  const {ports}=family({configuration,pool:f.pool,client,now:f.now});
  assert.equal(core.requests.length,0,'composition is inert');assert.equal(ports.routinesApplicationFactory.state(),'pending');
  const app=ports.routinesApplicationFactory.create({sessions:f.sessions});assert.deepEqual(census(ports),['composed','pending']);
  const prepared=await app.handle(post(ROUTINE_PATHS.prepare,{requestId:'public-request',operation:'schedule_task',request:{...routineRequest(),destinationReference:'meri-inbox'}},f.session.credential));
  assert.equal(prepared.status,200);const body=await prepared.json();assert.equal(body.status,'approval_required');assert.equal(body.proposal.projection.destinationId,'meri-inbox');
  // Every policy phase went to Core wire A with the owner's live native bearer plus the service identity; limits are Core's ceiling.
  assert.ok(core.requests.length>=2);for(const r of core.requests){assert.equal(r.url,CORE_ORIGIN+'/api/clio/routines/policy/check');assert.equal(r.headers.authorization,'Bearer synthetic-native');assert.equal(r.headers['x-internal-service-secret'],core.serviceSecret);}
  assert.equal(body.proposal.projection.retryLimit,0);assert.equal(f.state.policies.length,0,'the fixture policy is not consulted');
  // The same owners, and nothing else, satisfy the production census; firing is still held (no worker, no unattended call).
  assert.deepEqual(Object.keys(PRODUCTION_ROUTINE_OWNERS).sort(),['context.commandContext+allocationJson+template','context.policy','context.workflow','retirement','runControl']);
  assert.equal(f.temporal.calls.create,0);assert.equal(retired.length,0);
  // Without a live session for the run (sessions closed) Core is not reached and the route refuses.
  f.sessions.close();const count=core.requests.length;
  const refused=await app.handle(post(ROUTINE_PATHS.prepare,{requestId:'public-request-2',operation:'schedule_task',request:{...routineRequest(),destinationReference:'meri-inbox'}},f.session.credential));
  assert.notEqual(refused.status,200);assert.equal(core.requests.length,count);
 }finally{await f.close();}
});

test('routines.core is validated by compileRoutinesConfiguration and refuses a secret file shared with the native candidate',()=>{
 const pin={issuer:'https://core.synthetic.invalid/meri-routines',kid:'routine-cancel-1',publicKey:{kty:'OKP',crv:'Ed25519',x:'11qYAYKxCrfVS_7TyWQHOg7hcvPapiMlrwIaaPcHURo'}};
 const core={origin:'https://core.synthetic.invalid',serviceSecretFile:'/run/meri/routines-service-secret',cancellationProof:pin};
 assert.equal(compileRoutinesConfiguration({routines:{enabled:true,core}}),true);assert.equal(compileRoutinesConfiguration({routines:{enabled:false,core}}),false);
 for(const routines of [{enabled:true,core:{...core,origin:'http://core.synthetic.invalid'}},{enabled:true,core:{...core,cancellationProof:{...pin,kid:''}}},{enabled:true,core:{...core,unattended:true}},{enabled:true,core:null}])
  assert.throws(()=>compileRoutinesConfiguration({routines}),code('ROUTINES_CONFIGURATION'));
 assert.throws(()=>compileRoutinesConfiguration({routines:{enabled:true,core},nativeCandidate:{identity:{credentialFile:core.serviceSecretFile}}}),code('ROUTINES_CONFIGURATION'));
});

/** Lane RD (option B): the composer's `readDelegation.consents` as a trusted routines owner. */
import {binding as ownerBinding,clientId as ownerClientId} from '../../../control/schedules/test/application-fixture.mjs';
import {canonicalSha256 as sha256} from '../../../../packages/contracts/validate.mjs';
test('with `readConsents` the owner approval also creates the routine read consent over the actual sessions; a malformed port is refused',async()=>{
 const f=await applicationFixture();try{
  const {commandContext,allocationJson,template,workflow,policy,limits}=f.contextConfiguration,calls=[],events=[];
  const consents={async approve({signal,...input}){calls.push(input);return {schemaVersion:1,consentId:'c1234567-b123-4c12-8d12-e123456789ab',state:'active',createdAtMs:f.now(),expiresAtMs:input.requestedExpiresAtMs};},async narrow(){throw Error('unexpected narrow');},async resume(){throw Error('unexpected resume');}};
  const client={...f.client,connection:{withDeadline:(deadline,fn)=>fn(),withAbortSignal:(signal,fn)=>fn()}};
  const owners={context:{commandContext,allocationJson,template,workflow,policy,limits},newId:f.newId,runControl:{async cancel(){}},retirement:{async retire(){}}};
  const family=routinesFamily({...owners,readConsents:consents,log:e=>events.push(e)});
  const {ports}=family({configuration:{...base,routines:{enabled:true}},pool:f.pool,client,now:f.now});
  const app=ports.routinesApplicationFactory.create({sessions:f.sessions});assert.deepEqual(census(ports),['composed','pending']);
  const prepared=await (await app.handle(post(ROUTINE_PATHS.prepare,{requestId:'public-request',operation:'schedule_task',request:routineRequest()},f.session.credential))).json();
  assert.equal(prepared.status,'approval_required');assert.deepEqual(calls,[],'preparation consents nothing');
  const approved=await app.handle(post(ROUTINE_PATHS.approve,{operation:'schedule_task',request:routineRequest(),proposalId:prepared.proposal.proposalId,intentSha256:prepared.proposal.intentSha256,decision:'approved'},f.session.credential));
  assert.equal(approved.status,200);const result=await approved.json();assert.equal(result.status,'acknowledged');assert.equal(f.temporal.calls.create,1);
  assert.equal(calls.length,1);const call=calls[0];
  assert.equal(call.liveCredential,'synthetic-native','the owner\'s native bearer, resolved from the actual sessions');
  assert.equal(call.scheduleId,result.receipt.projection.scheduleId);assert.equal(call.clientId,ownerClientId);assert.equal(call.policyRevision,'p1');
  assert.deepEqual(call.operations,JSON.parse(allocationJson).manifest.allowedOperations);assert.equal(call.scheduleProjectionSha256,sha256(result.receipt.projection));
  assert.equal(call.requestedExpiresAtMs,f.now()+30*86400000);assert.ok(call.deadlineMs<=f.now()+5000);
  const stored=await f.owner.readReadConsent({tenantId:ownerBinding.tenantId,scheduleId:result.receipt.projection.scheduleId},()=>{});
  assert.equal(stored.consentId,'c1234567-b123-4c12-8d12-e123456789ab');assert.equal(stored.state,'active');assert.deepEqual(events,[]);
  for(const bad of [{approve(){}},{approve(){},narrow(){},resume:'x'},new Proxy({approve(){},narrow(){},resume(){}},{})])assert.throws(()=>routinesFamily({...owners,readConsents:bad}),code('ROUTINES_CONFIGURATION'));
  assert.throws(()=>routinesFamily({...owners,log:'x'}),code('ROUTINES_CONFIGURATION'));
 }finally{await f.close();}
});
