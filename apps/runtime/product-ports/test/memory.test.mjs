/** SYNTHETIC: the memory product-port family over the real application, producer, journal statements (scripted pool), credential
 * broker and Core client, with the golden Core fake at the Fetch boundary, a fake membership gate and a fake live-session relay.
 * Nothing here is PostgreSQL, Core, a secret file or a live session. */
import test from 'node:test';import assert from 'node:assert/strict';
import {createProductPortsFactory} from '../index.mjs';
import {createMemoryFamily,createMemoryFamilyWith,memoryComposition,compileMemoryConfiguration,MEMORY_TABLES} from '../memory.mjs';
import {captureRuntimePorts} from '../../product-applications.mjs';
import {productReadiness} from '../../product-readiness.mjs';
import {MEMORY_PATHS,memoryUnavailable} from '../../../control/memory/protocol.mjs';
import {createGoldenCore} from '../../../control/memory/test/core-golden.mjs';
import {createMemoryPoolFixture} from '../../../control/memory/test/pool-fixture.mjs';
import {ids,id,NOW} from '../../../control/memory/test/fixtures.mjs';
const TENANT='11111111-1111-4111-8111-111111111111',ACTOR='22222222-2222-4222-8222-222222222222',CLIENT=id(901),SECRET='memory-service-secret',BEARER='native-session-token';
const code=c=>e=>e?.code===c;
const base={version:1,profile:'isolated-preview',sourceEnabled:false,limits:{startupMs:1000,shutdownMs:1000,requestMs:5000,requestBytes:65536},native:{origin:'https://native.invalid',capabilityFile:'/run/native',loopback:false,maxResponseBytes:262144}};
const memory={enabled:true,origin:'https://core.example',serviceSecretFile:'/run/meri/memory-service-secret'};
const principal=()=>Object.freeze({tenantId:TENANT,actorId:ACTOR,role:'standard_user',permissions:Object.freeze([]),clientIds:Object.freeze([CLIENT]),membershipRevision:'m1'});
const gate=Object.freeze({async admit(){return {principal:principal(),expiresAtMs:NOW+60000};},async recheck({principal:p}){return p;}});
function untouchable(name){return new Proxy({},Object.fromEntries(['get','has','ownKeys','getOwnPropertyDescriptor','set','apply'].map(t=>[t,()=>{throw Error('touched '+name);}])));}
function context({configuration=base,pool,gate:g}={}){
 return Object.freeze({configuration,pool:pool??untouchable('pool'),client:{},native:{},now:()=>NOW,canonicalProductPorts:captureRuntimePorts(g?{conversationMembership:g}:{})});
}
function harness({relay,readSecret}={}){
 const core=createGoldenCore({now:()=>NOW,serviceSecret:SECRET});core.member({token:BEARER,tenantId:TENANT,userId:ACTOR});
 const pg=createMemoryPoolFixture(),reads=[];
 const owners={readSecret:readSecret??(async path=>{reads.push(path);if(path!==memory.serviceSecretFile)throw Error('no such file');return Buffer.from(SECRET+'\n');}),fetchImpl:(u,i)=>core.fetch(u,i),newId:ids(300),...(relay?{nativeCredentials:relay}:{})};
 const family=createMemoryFamilyWith(owners),ctx=context({configuration:{...base,memory},pool:pg.pool,gate});
 const ports=createProductPortsFactory({families:[['memory',family]]})(ctx);
 const post=async(path,body)=>{const r=await ports.memoryApplication.handle(new Request('https://control.example'+path,{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+BEARER},body:JSON.stringify(body)}));return {status:r.status,body:await r.json()};};
 return {core,pg,reads,owners,family,ctx,ports,post};
}

test('absent or disabled memory configuration composes no port and touches nothing; readiness names memory.producer unavailable',()=>{
 for(const configuration of [base,{...base,memory:{enabled:false}}]){
  const ctx=context({configuration,gate});
  assert.deepEqual(createProductPortsFactory({families:[['memory',createMemoryFamily]]})(ctx),{});
  assert.equal(memoryComposition(ctx).state,'disabled');assert.deepEqual(memoryComposition(ctx).tables,[]);
 }
 assert.equal(productReadiness({ports:captureRuntimePorts({}),retention:null,sourceEnabled:false}).owners.find(o=>o.name==='memory.producer').state,'unavailable');
 assert.equal(memoryUnavailable().status,503);
});

test('the memory block is closed: enabled needs the https Core origin and an absolute secret file, disabled allows neither',()=>{
 assert.deepEqual(compileMemoryConfiguration({}),{enabled:false});assert.deepEqual(compileMemoryConfiguration({memory:{enabled:false}}),{enabled:false});
 assert.deepEqual(compileMemoryConfiguration({memory}),memory);
 for(const bad of [{},{enabled:'yes'},{enabled:true},{enabled:true,origin:'https://core.example'},{enabled:true,serviceSecretFile:'/run/x'},{enabled:true,origin:'http://core.example',serviceSecretFile:'/run/x'},
  {enabled:true,origin:'https://core.example/path',serviceSecretFile:'/run/x'},{enabled:true,origin:'https://core.example',serviceSecretFile:'relative'},{enabled:true,origin:'https://core.example',serviceSecretFile:'/run/../x'},
  {enabled:false,origin:'https://core.example'},{enabled:true,origin:'https://core.example',serviceSecretFile:'/run/x',extra:1},null])assert.throws(()=>compileMemoryConfiguration({memory:bad}),code('MEMORY_CONFIGURATION'));
 // Enabled without Core's membership owner: no port, so readiness names the gap instead of serving an ungated surface.
 const ctx=context({configuration:{...base,memory},pool:{connect(){}}});
 assert.deepEqual(createProductPortsFactory({families:[['memory',createMemoryFamily]]})(ctx),{});
 assert.deepEqual([memoryComposition(ctx).state,memoryComposition(ctx).reason],['unavailable','MEMBERSHIP_GATE_UNAVAILABLE']);
 // A context that is not the trusted shape, or a pool without connect, is a composition fault.
 assert.throws(()=>createMemoryFamily(context({configuration:{...base,memory},pool:{},gate})),code('PRODUCT_PORTS_CONFIGURATION'));
 for(const owners of [{nativeCredentials:{}},{readSecret:1},{extra:true}])assert.throws(()=>createMemoryFamilyWith(owners),code('MEMORY_CONFIGURATION'));
});

test('the enabled family serves proposals and the review path over the membership gate, the journal statements and the Core client; construction reads nothing',async()=>{
 const t=harness();
 assert.deepEqual(Object.keys(t.ports),['memoryApplication']);assert.equal(t.reads.length,0);assert.equal(t.pg.statements.length,0);
 assert.deepEqual(memoryComposition(t.ctx).tables,MEMORY_TABLES);assert.equal(memoryComposition(t.ctx).commandSourceFor,null,'no relay: the run path is absent, the surface composes');
 const proposed=await t.post(MEMORY_PATHS.propose,{idempotencyKey:id(1),scope:'personal',content:'Prefers morning briefings',key:'briefing-time'});
 assert.equal(proposed.status,200);assert.equal(proposed.body.proposal.review.status,'pending');
 assert.equal(t.pg.rows.length,1);assert.equal(t.pg.rows[0].submission_state,'SUBMITTED');
 // The secret file is read inside the request, per Core call (rotation), and the bearer that reaches Core is the request's own.
 assert.ok(t.reads.length>=1);assert.ok(t.reads.every(p=>p===memory.serviceSecretFile));
 assert.ok(t.core.calls.every(c=>c.bearer===BEARER));assert.ok(t.core.calls.filter(c=>c.path.startsWith('/api/clio/')).every(c=>c.service===true));
 const pending=await t.post(MEMORY_PATHS.reviewList,{});
 assert.deepEqual(pending.body.proposals.map(p=>p.candidateId),[proposed.body.proposal.candidateId]);
 const approved=await t.post(MEMORY_PATHS.reviewApprove,{candidateId:proposed.body.proposal.candidateId});
 assert.equal(approved.status,200);assert.equal(approved.body.proposal.review.status,'approved');assert.match(approved.body.proposal.review.publishedMemoryId,/^clio:/u);
 assert.deepEqual((await t.post(MEMORY_PATHS.reviewList,{})).body.proposals,[]);
 assert.equal((await t.post(MEMORY_PATHS.status,{candidateId:proposed.body.proposal.candidateId})).body.review.status,'approved');
 // Idempotent replay through the real journal statements: no second row, no second Core submission.
 await t.post(MEMORY_PATHS.propose,{idempotencyKey:id(1),scope:'personal',content:'Prefers morning briefings',key:'briefing-time'});
 assert.equal(t.pg.rows.length,1);assert.equal(t.core.calls.filter(c=>c.path.endsWith('/submit')).length,1);
 // A missing secret file inside a request is an unacknowledged submission (never a Core answer): the row is retained, Core untouched.
 const broken=harness({readSecret:async()=>{throw Error('gone');}});
 const retained=await broken.post(MEMORY_PATHS.propose,{idempotencyKey:id(2),scope:'personal',content:'x'});
 assert.equal(retained.status,200);assert.equal(retained.body.proposal.review.status,'submission_unknown');
 assert.equal(broken.pg.rows.length,1);assert.equal(broken.pg.rows[0].submission_state,'SUBMISSION_UNKNOWN');assert.equal(broken.core.calls.length,0);
});

test('the composition is memoized per trusted context and refuses a second family naming other owners',()=>{
 const t=harness();
 assert.equal(memoryComposition(t.ctx),memoryComposition(t.ctx));
 assert.deepEqual(t.family(t.ctx).ports,t.ports);
 assert.throws(()=>createMemoryFamilyWith({newId:ids(1)})(t.ctx),code('PRODUCT_PORTS_CONFIGURATION'));
 assert.throws(()=>memoryComposition(null),code('PRODUCT_PORTS_CONFIGURATION'));
});

test('with the live-session relay the run path composes the governed memory.propose source bound to the run and its selected client',()=>{
 const binding={tenantId:TENANT,actorId:ACTOR,conversationId:id(1),runId:id(2),attemptId:id(3),workerId:id(4),writerFence:1};
 const relay={nativeCredentialFor({binding:b,selectedClientId}){assert.equal(b.runId,binding.runId);assert.equal(selectedClientId,CLIENT);return {credential:BEARER,expiresAtMs:NOW+30000};}};
 const t=harness({relay});
 const composition=memoryComposition(t.ctx);assert.equal(typeof composition.commandSourceFor,'function');
 const source=composition.commandSourceFor({binding,scopes:[{tenantId:TENANT,kind:'client',resourceId:CLIENT.toUpperCase(),policyRevision:'p'}]});
 assert.equal(source.personalPending,true);assert.equal(typeof source.prepare,'function');assert.equal(typeof source.execute,'function');
 assert.equal(composition.commandSourceFor({binding,selectedClientId:CLIENT}).personalPending,true);
 // A run whose admitted scopes are not exactly one client scope has no selected client and therefore no source.
 assert.throws(()=>composition.commandSourceFor({binding,scopes:[{tenantId:TENANT,kind:'tenant',resourceId:TENANT,policyRevision:'p'}]}),code('MEMORY_CONFIGURATION'));
 assert.throws(()=>composition.commandSourceFor({binding}),code('MEMORY_CONFIGURATION'));
});
