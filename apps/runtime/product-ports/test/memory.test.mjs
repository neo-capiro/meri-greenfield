/** SYNTHETIC: the memory product-port family over the real application, producer, journal statements (scripted pool), credential
 * broker and Core client, with the golden Core fake at the Fetch boundary, a fake membership gate and a fake live-session relay.
 * Nothing here is PostgreSQL, Core, a secret file or a live session. */
import test from 'node:test';import assert from 'node:assert/strict';
import {createProductPortsFactory} from '../index.mjs';
import {createMemoryFamily,createMemoryFamilyWith,memoryComposition,compileMemoryConfiguration,bindMemoryRetention,memoryIntentPreparersFor,MEMORY_TABLES} from '../memory.mjs';
import {captureRuntimePorts} from '../../product-applications.mjs';
import {productReadiness} from '../../product-readiness.mjs';
import {MEMORY_PATHS,memoryUnavailable} from '../../../control/memory/protocol.mjs';
import {createGoldenCore} from '../../../control/memory/test/core-golden.mjs';
import {createMemoryPoolFixture} from '../../../control/memory/test/pool-fixture.mjs';
import {preparationPool} from '../../../control/memory/test/preparation-pool-fixture.mjs';
import {createPostgresMemoryJournal} from '../../../control/memory/postgres-journal.mjs';
import {buildCandidate} from '../../../control/memory/candidate.mjs';
import {ids,id,NOW} from '../../../control/memory/test/fixtures.mjs';
const TENANT='11111111-1111-4111-8111-111111111111',ACTOR='22222222-2222-4222-8222-222222222222',CLIENT='abcdefab-0000-4000-8000-000000000901',SECRET='memory-service-secret',BEARER='native-session-token';
const code=c=>e=>e?.code===c;
const base={version:1,profile:'isolated-preview',sourceEnabled:false,limits:{startupMs:1000,shutdownMs:1000,requestMs:5000,requestBytes:65536},native:{origin:'https://native.invalid',capabilityFile:'/run/native',loopback:false,maxResponseBytes:262144}};
const memory={enabled:true,origin:'https://core.example',serviceSecretFile:'/run/meri/memory-service-secret'};
const retention={enabled:true};
const principal=()=>Object.freeze({tenantId:TENANT,actorId:ACTOR,role:'standard_user',permissions:Object.freeze([]),clientIds:Object.freeze([CLIENT]),membershipRevision:'m1'});
const gate=Object.freeze({async admit(){return {principal:principal(),expiresAtMs:NOW+60000};},async recheck({principal:p}){return p;}});
function untouchable(name){return new Proxy({},Object.fromEntries(['get','has','ownKeys','getOwnPropertyDescriptor','set','apply'].map(t=>[t,()=>{throw Error('touched '+name);}])));}
function context({configuration=base,pool,gate:g,now=()=>NOW}={}){
 return Object.freeze({configuration,pool:pool??untouchable('pool'),client:{},native:{},now,canonicalProductPorts:captureRuntimePorts(g?{conversationMembership:g}:{})});
}
function harness({relay,readSecret,bind=true,retentionGate={async assertServable(){}},membershipGate=gate,fetchImpl,now=()=>NOW}={}){
 const core=createGoldenCore({now,serviceSecret:SECRET});core.member({token:BEARER,tenantId:TENANT,userId:ACTOR});
 const pg=createMemoryPoolFixture(),prepared=preparationPool(pg.pool),reads=[];
 const owners={readSecret:readSecret??(async path=>{reads.push(path);if(path!==memory.serviceSecretFile)throw Error('no such file');return Buffer.from(SECRET+'\n');}),fetchImpl:fetchImpl?((u,i)=>fetchImpl(u,i,core)):((u,i)=>core.fetch(u,i)),newId:ids(300),...(relay?{nativeCredentials:relay}:{})};
 const family=createMemoryFamilyWith(owners),ctx=context({configuration:{...base,memory,retention},pool:prepared.pool,gate:membershipGate,now});
 const ports=createProductPortsFactory({families:[['memory',family]]})(ctx);
 if(bind)assert.equal(bindMemoryRetention(ctx,retentionGate),true);
 const post=async(path,body)=>{const r=await ports.memoryApplication.handle(new Request('https://control.example'+path,{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+BEARER},body:JSON.stringify(body)}));return {status:r.status,body:await r.json()};};
 return {core,pg,prepared,reads,owners,family,ctx,ports,post};
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
 assert.throws(()=>createMemoryFamily(context({configuration:{...base,memory,retention},pool:{},gate})),code('PRODUCT_PORTS_CONFIGURATION'));
 const noRetention=context({configuration:{...base,memory},gate});
 assert.deepEqual(createProductPortsFactory({families:[['memory',createMemoryFamily]]})(noRetention),{});
 assert.deepEqual([memoryComposition(noRetention).state,memoryComposition(noRetention).reason],['unavailable','RETENTION_GATE_UNAVAILABLE']);
 for(const owners of [{nativeCredentials:{}},{readSecret:1},{extra:true}])assert.throws(()=>createMemoryFamilyWith(owners),code('MEMORY_CONFIGURATION'));
});

test('memory family is unavailable until its exact canonical retention gate is bound; the bound gate protects conversation-origin reads',async()=>{
 const calls=[],retentionGate={async assertServable(subject){calls.push(subject);throw Object.assign(Error('suppressed'),{code:'RETENTION_SUPPRESSED'});}};
 const t=harness({bind:false});
 assert.equal(memoryComposition(t.ctx).retentionBound(),false);
 assert.deepEqual(await t.post(MEMORY_PATHS.reviewList,{}),{status:503,body:{error:{code:'MEMORY_UNAVAILABLE',outcome:'NOT_DISPATCHED'}}});
 assert.equal(t.pg.statements.length,0);assert.equal(t.core.calls.length,0);
 assert.throws(()=>bindMemoryRetention(t.ctx,{}),code('PRODUCT_PORTS_CONFIGURATION'));
 assert.equal(bindMemoryRetention(t.ctx,retentionGate),true);
 assert.equal(bindMemoryRetention(t.ctx,retentionGate),true);
 assert.throws(()=>bindMemoryRetention(t.ctx,{async assertServable(){}}),code('PRODUCT_PORTS_CONFIGURATION'));
 assert.equal(memoryComposition(t.ctx).retentionBound(),true);
 const built=buildCandidate({candidateId:id(90),principal:principal(),scope:'personal',clientId:null,content:'A pending fact',key:null,ttlDays:null,
  sources:[],origin:{kind:'conversation',conversationId:id(91),runId:id(92),commandId:id(93),commandSha256:'a'.repeat(64)},
  idempotencyKey:id(94),createdAt:new Date(NOW).toISOString()});
 await createPostgresMemoryJournal({pool:t.pg.pool}).insert({...built,requestSha256:'b'.repeat(64)});
 const page=await t.post(MEMORY_PATHS.reviewList,{});
 assert.equal(page.status,200);assert.deepEqual(page.body.proposals,[]);
 assert.deepEqual(calls,[{tenantId:TENANT,kind:'conversation',subjectId:id(91)}]);
 assert.equal(t.core.calls.length,0,'suppressed local candidates never consult Core');
});

test('the enabled family refuses unowned surface writes while retaining review and status reads of existing own rows; construction reads nothing',async()=>{
 const t=harness();
 assert.deepEqual(Object.keys(t.ports),['memoryApplication']);assert.equal(t.reads.length,0);assert.equal(t.pg.statements.length,0);
 assert.deepEqual(memoryComposition(t.ctx).tables,MEMORY_TABLES);assert.equal(memoryComposition(t.ctx).intentPreparersFor,null,'no relay: the run path is absent, the surface composes');
 assert.deepEqual(memoryIntentPreparersFor(t.ctx,{}),[]);
 const proposed=await t.post(MEMORY_PATHS.propose,{idempotencyKey:id(1),scope:'personal',content:'Prefers morning briefings',key:'briefing-time'});
 assert.equal(proposed.status,503);assert.equal(proposed.body.error.code,'MEMORY_RETENTION_SUBJECT_UNAVAILABLE');
 assert.equal(proposed.body.error.outcome,'NOT_DISPATCHED');
 const corrected=await t.post(MEMORY_PATHS.correct,{idempotencyKey:id(2),targetMemoryId:'clio:'+id(50),content:'Changed',reason:'New evidence',
  sources:[{kind:'web_page',reference:'https://example.gov/report'}]});
 assert.equal(corrected.status,503);assert.equal(corrected.body.error.code,'MEMORY_RETENTION_SUBJECT_UNAVAILABLE');
 assert.equal(corrected.body.error.outcome,'NOT_DISPATCHED');
 assert.equal(t.pg.rows.length,0);assert.equal(t.core.calls.length,0);assert.equal(t.reads.length,0);
 const built=buildCandidate({candidateId:id(70),principal:principal(),scope:'personal',clientId:null,content:'An existing fact',key:null,ttlDays:null,
  sources:[],origin:{kind:'surface'},idempotencyKey:id(71),createdAt:new Date(NOW).toISOString()});
 await createPostgresMemoryJournal({pool:t.pg.pool}).insert({...built,requestSha256:'b'.repeat(64)});
 const existing=await t.post(MEMORY_PATHS.status,{candidateId:built.candidate.candidateId});
 assert.equal(existing.status,200);assert.equal(existing.body.review.status,'submission_unknown');
 const pending=await t.post(MEMORY_PATHS.reviewList,{});
 assert.deepEqual(pending.body.proposals,[]);assert.deepEqual(pending.body.reviewAvailability,{state:'partial',unresolvedCount:1});
 assert.ok(t.reads.length>=1);assert.ok(t.reads.every(p=>p===memory.serviceSecretFile));
 assert.ok(t.core.calls.every(c=>c.bearer===BEARER));assert.ok(t.core.calls.filter(c=>c.path.startsWith('/api/clio/')).every(c=>c.service===true));
});

test('the composition is memoized per trusted context and refuses a second family naming other owners',()=>{
 const t=harness();
 assert.equal(memoryComposition(t.ctx),memoryComposition(t.ctx));
 assert.deepEqual(t.family(t.ctx).ports,t.ports);
 assert.throws(()=>createMemoryFamilyWith({newId:ids(1)})(t.ctx),code('PRODUCT_PORTS_CONFIGURATION'));
 assert.throws(()=>memoryComposition(null),code('PRODUCT_PORTS_CONFIGURATION'));
});


const binding={tenantId:TENANT,actorId:ACTOR,conversationId:id(1),runId:id(2),attemptId:id(3),workerId:id(4),writerFence:1};
const deliveryId='sdk:'+'a'.repeat(64);
function nativeHarness({general=false,bind=true,...options}={}){
 const selectedClientId=general?null:CLIENT,scopes=[{tenantId:TENANT,kind:general?'private-user':'client',resourceId:general?ACTOR:CLIENT,policyRevision:'p'}];
 const state={live:true,current:true,credential:BEARER,membership:principal(),lookups:[],currents:0,admissions:0,now:NOW},membershipGate={
  async admit({credential}){state.admissions++;assert.equal(credential,BEARER);await state.onAdmit?.();
   if(state.membership===null)throw Object.assign(Error('revoked'),{code:'MEMBERSHIP_REVOKED'});
   return {principal:state.membership,expiresAtMs:state.memberExpiresAtMs??state.now+30000};},
  async recheck({principal:p}){assert.deepEqual(p,state.membership);return p;},
 };
 const relay={nativeCredentialFor(v){state.lookups.push(v);assert.deepEqual(v.binding,binding);assert.equal(v.selectedClientId,selectedClientId);if(!state.live)throw Error('no session');return {credential:state.credential,expiresAtMs:state.sessionExpiresAtMs??state.now+30000};}};
 const t=harness({relay,membershipGate,bind,now:()=>state.now,...options});
 const input={binding,scopes,selectedClientId,policyRevision:'p',deadlineMs:NOW+5000,readCurrent:async()=>{
  state.currents++;await state.onCurrent?.();if(!state.current)throw Object.assign(Error('revoked'),{code:'ACCESS_DENIED'});
  return {binding,scopes,selectedClientId,policyRevision:'p',checkedAtMs:state.now,expiresAtMs:state.now+30000};
 }};
 const prepare=(arguments_={content:'Prefers concise updates'},over={})=>memoryIntentPreparersFor(t.ctx,input)[0].prepare({arguments:arguments_,deliveryId,...over});
 return {...t,state,input,prepare};
}
test('native preparation is absent without canonical retention; exact General and malformed selections stay distinct',()=>{
 const t=nativeHarness({bind:false});
 assert.deepEqual(memoryIntentPreparersFor(t.ctx,t.input),[]);assert.equal(t.state.lookups.length,0);assert.equal(t.pg.rows.length,0);
 bindMemoryRetention(t.ctx,{async assertServable(){}});
 for(const change of [{selectedClientId:null},{selectedClientId:undefined},{scopes:[{tenantId:TENANT,kind:'private-user',resourceId:'other',policyRevision:'p'}],selectedClientId:null},
  {scopes:[{tenantId:TENANT,kind:'tenant',resourceId:TENANT,policyRevision:'p'}],selectedClientId:null}]){
  assert.throws(()=>memoryIntentPreparersFor(t.ctx,{...t.input,...change}));
 }
});
for(const general of [false,true])test(`native ${general?'General':'client'} preparation retains exact text with no Core submit`,async()=>{
 const t=nativeHarness({general}),result=await t.prepare();
 assert.equal(result.status,'approval_required');assert.deepEqual(result.proposal.command.binding,binding);assert.deepEqual(result.proposal.command.scopes,t.input.scopes);
 assert.equal(result.proposal.command.arguments.content,'Prefers concise updates');
 assert.equal(t.prepared.metadata.rows.size,1);assert.equal(t.pg.rows.length,0);assert.equal(t.core.calls.length,0);assert.equal(t.core.memories.length,0);
});
test('client uses selected client and firm requires canonical Core permission before metadata',async()=>{
 const t=nativeHarness(),r=await t.prepare({content:'Client fact',scope:'client'});
 assert.equal(r.proposal.command.arguments.clientId,CLIENT);assert.equal(t.pg.rows.length,0);
 const general=nativeHarness({general:true});
 await assert.rejects(general.prepare({content:'No chosen client',scope:'client'}),code('INVALID_ARGUMENTS'));
 await assert.rejects(general.prepare({content:'Firm fact',scope:'firm'}));
 assert.equal(general.prepared.metadata.rows.size,0);
 general.state.membership={...principal(),permissions:['memory.propose.firm']};
 assert.equal((await general.prepare({content:'Firm fact',scope:'firm'})).status,'approval_required');
 assert.equal(general.core.calls.length,0);
});
for(const loss of ['live','current','membership'])test(`native ${loss} loss before prepare writes no metadata or candidate`,async()=>{
 const t=nativeHarness();t.state[loss]=loss==='membership'?null:false;
 await assert.rejects(t.prepare());assert.equal(t.prepared.metadata.rows.size,0);assert.equal(t.pg.rows.length,0);assert.equal(t.core.calls.length,0);
});
for(const loss of ['current','membership','live'])test(`native ${loss} loss after metadata withholds proposal with no candidate effect`,async()=>{
 const t=nativeHarness();t.prepared.state.afterMetadata=()=>{t.state[loss]=loss==='membership'?null:false;};
 await assert.rejects(t.prepare(),code('UNKNOWN'));
 assert.equal(t.prepared.metadata.rows.size,1);assert.equal(t.pg.rows.length,0);assert.equal(t.core.calls.length,0);
});
test('suppression after metadata prevents release without creating a candidate',async()=>{
 let suppressed=false;const t=nativeHarness({retentionGate:{async assertServable(){if(suppressed)throw Object.assign(Error('suppressed'),{code:'RETENTION_SUPPRESSED'});}}});
 t.prepared.state.afterMetadata=()=>{suppressed=true;};
 await assert.rejects(t.prepare(),code('UNKNOWN'));assert.equal(t.prepared.metadata.rows.size,1);assert.equal(t.pg.rows.length,0);assert.equal(t.core.calls.length,0);
});