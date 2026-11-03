/** Native resolver -> existing memory family -> governed Core review; actual owners with scripted SQL/Core ports.
 *
 * The retained human review is the proposal the person decides later, so its expiry is a consent lifetime, not a
 * transport bound: it must follow the existing configured proposal TTL bounded by canonical execution authority, and
 * must never be chosen by the preparation request deadline (`intents-http.mjs` maxPrepareMs). The operation, mount and
 * source deadlines stay exactly as they are - a preparation still settles inside its own request - so these cases read
 * the retained proposal expiry out of the ACTUAL HTTP answer while the request bound varies underneath it. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createAgentCoreIntentResolver} from '../execution-composition.mjs';
import {createRunnerIntentsApplication} from '../intents-http.mjs';
import {createMemoryFamilyWith,bindMemoryRetention} from '../../product-ports/memory.mjs';
import {captureRuntimePorts} from '../../product-applications.mjs';
import {preparationPool} from '../../../control/memory/test/preparation-pool-fixture.mjs';
import {createMemoryPoolFixture} from '../../../control/memory/test/pool-fixture.mjs';
import {createGoldenCore} from '../../../control/memory/test/core-golden.mjs';
import {createPreparedSchedulePoolFixture} from '../../../control/intents/test/prepared-schedule-fixture.mjs';
import {id,NOW,ids} from '../../../control/memory/test/fixtures.mjs';
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
import {INTENT_PREPARE_CONTROL_MS} from '../../../../packages/runtime/runner-load-budget.mjs';
import {CURRENT_AUTHORITY_LIMITS} from '../current-authority-limits.mjs';
/** `prepareMs: null` omits the limit block, so the application keeps its own production default (INTENT_PREPARE_CONTROL_MS). */
function fixture(general,{prepareMs=3000,executionMs=60000,metadataUnavailable=false,delayMs=0}={}){
 const binding={tenantId:id(80),actorId:id(81),conversationId:id(1),runId:id(2),attemptId:id(3),workerId:id(4),writerFence:1},clientId=id(5),selectedClientId=general?null:clientId;
 const scopes=[{tenantId:binding.tenantId,kind:general?'private-user':'client',resourceId:general?binding.actorId:clientId,policyRevision:'p'}];
 const state={active:true,auth:0,current:0,afterCore:null},memory=createMemoryPoolFixture(),journal=createPreparedSchedulePoolFixture();
 const pool={async connect(){const a=await journal.pool.connect(),m=await memory.pool.connect();return {async query(sql,p){if(sql.includes('meri_memory')||sql.includes('retention_subjects')||sql.startsWith('SELECT pg_advisory')||sql.startsWith('SET TRANSACTION'))return m.query(sql,p);return a.query(sql,p);},release(){a.release();m.release();}};}};
 const principal={tenantId:binding.tenantId,actorId:binding.actorId,role:'standard_user',permissions:[],clientIds:[clientId],membershipRevision:'m1'},now=()=>NOW;
 const core=createGoldenCore({now,serviceSecret:'synthetic-service'});core.member({token:'synthetic-native',tenantId:binding.tenantId,userId:binding.actorId});
 const prepared=preparationPool(pool);
 // Disclosed synthetic SQL fault: the metadata store never answers, so nothing is retained and nothing is submitted.
 if(metadataUnavailable)prepared.metadata.pool={async connect(){throw Error('synthetic metadata store unavailable');}};
 const context={pool:prepared.pool,now,client:{},native:{},configuration:{sourceEnabled:true,intents:{enabled:true},retention:{enabled:true},memory:{enabled:true,origin:'https://core.example',serviceSecretFile:'/synthetic'},limits:{requestMs:3000,requestBytes:65536},native:{maxResponseBytes:262144}},canonicalProductPorts:captureRuntimePorts({conversationMembership:{async admit(){return {principal,expiresAtMs:NOW+30000};},async recheck(){return principal;}}})};
 const credentials={nativeCredentialFor(){if(!state.active)throw Error('revoked');return {credential:'synthetic-native',expiresAtMs:NOW+30000};}};
 createMemoryFamilyWith({nativeCredentials:credentials,readSecret:async()=>Buffer.from('synthetic-service'),newId:ids(300),fetchImpl:async(u,i)=>{const out=await core.fetch(u,i);await state.afterCore?.();return out;}})(context);
 bindMemoryRetention(context,{async assertServable(){if(!state.active)throw Error('suppressed');}});
 const execution={async authenticate(){state.auth++;if(!state.active)throw Error('revoked');return {execution:{binding,executionKey:hash(binding),executionId:hash(binding),planSha256:'a'.repeat(64),expiresAtMs:NOW+executionMs,runtimeSessionId:id(50)},state:'running',scopes,selectedClientId,policyRevision:'p'};}};
 const transitionAuthority={async readCurrent(){state.current++;if(delayMs)await new Promise(resolve=>setTimeout(resolve,delayMs));return {binding,scopes,selectedClientId,policyRevision:'p',checkedAtMs:NOW,expiresAtMs:NOW+30000};}};
 const app=createRunnerIntentsApplication({resolveRun:createAgentCoreIntentResolver({context,execution,transitionAuthority,nativeCredentials:credentials}),enabled:true,now,...(prepareMs===null?{}:{limits:{maxRequestBytes:65536,maxResponseBytes:262144,maxPrepareMs:prepareMs}})});
 const post=(route,extra={},init={})=>app.handle(new Request('https://control.invalid/v1/runner/intents/'+route,{method:'POST',headers:{authorization:'Bearer actual-execution','content-type':'application/json'},body:JSON.stringify({binding,...(route==='prepare'?{operation:{id:'save_memory',version:'0.2.0'},deliveryId:'sdk:'+'a'.repeat(64),arguments:{content:'Prefers concise updates',scope:'personal'}}:{}),...extra}),...init}));
 return {state,memory,journal,core,post,prepared};
}
/** The retained review expiry the ACTUAL HTTP answer published, plus the two effect counters that must stay zero. */
async function retained(f,response){
 assert.equal(response.status,200,await response.clone().text());
 const result=await response.json();assert.equal(result.status,'approval_required');
 assert.equal(f.core.calls.length,0,'preparation makes no Core effect call');
 assert.equal(f.memory.rows.length,0,'preparation writes no memory candidate');
 return Date.parse(result.proposal.expiresAt)-NOW;
}
for(const general of [false,true])test(`mounted native ${general?'General':'client'} prepares exact metadata and replays without candidate`,async()=>{
 const f=fixture(general),availability=await f.post('availability');assert.equal(availability.status,200,await availability.clone().text());assert.deepEqual((await availability.json()).operations,[{id:'save_memory',version:'0.2.0'}]);
 const first=await f.post('prepare');assert.equal(first.status,200,await first.clone().text());const result=await first.json();assert.equal(result.status,'approval_required');
 assert.equal(f.memory.rows.length,0);assert.equal(f.core.memories.length,0);assert.equal(f.journal.state.rows.size,1);assert.equal(f.prepared.metadata.rows.size,1);
 const replay=await f.post('prepare');assert.equal(replay.status,200);assert.deepEqual(await replay.json(),result);assert.equal(f.core.calls.length,0);
 f.state.active=false;assert.equal((await f.post('prepare')).status,403);assert.equal(f.memory.rows.length,0);
});
test('native execution loss after metadata withholds exact proposal and never submits',async()=>{
 const f=fixture(true);f.prepared.state.afterMetadata=()=>{f.state.active=false;};
 assert.notEqual((await f.post('prepare')).status,200);assert.equal(f.memory.rows.length,0);assert.equal(f.prepared.metadata.rows.size,1);
 f.state.active=true;f.prepared.state.afterMetadata=null;assert.notEqual((await f.post('prepare')).status,200);
 assert.equal(f.core.calls.length,0);assert.equal(f.prepared.metadata.rows.size,1);
});
/** The production default request limit and a short one must not choose the retained review lifetime. */
for(const [label,prepareMs] of [['production default',null],['3000ms',3000],['52000ms',INTENT_PREPARE_CONTROL_MS]])
test(`retained review expiry follows the configured proposal TTL under the ${label} preparation request limit`,async()=>{
 const f=fixture(true,{prepareMs,executionMs:900000});
 const actualMs=await retained(f,await f.post('prepare'));
 console.log(JSON.stringify({case:label,requestLimitMs:prepareMs??INTENT_PREPARE_CONTROL_MS,executionAuthorityMs:900000,configuredProposalTtlMs:CURRENT_AUTHORITY_LIMITS.proposalTtlMs,retainedMs:actualMs}));
 assert.equal(actualMs,CURRENT_AUTHORITY_LIMITS.proposalTtlMs,'the retained review expiry is the configured TTL bounded by execution authority, never the preparation request limit');
});
test('a shorter canonical execution authority still caps the retained review',async()=>{
 const f=fixture(true,{prepareMs:null,executionMs:20000});
 const actualMs=await retained(f,await f.post('prepare'));
 console.log(JSON.stringify({case:'short execution authority',requestLimitMs:INTENT_PREPARE_CONTROL_MS,executionAuthorityMs:20000,retainedMs:actualMs}));
 assert.equal(actualMs,20000,'the canonical execution authority still caps the retained review');
});
test('a longer canonical execution authority is still capped by the configured proposal TTL',async()=>{
 const f=fixture(true,{prepareMs:null,executionMs:1800000});
 const actualMs=await retained(f,await f.post('prepare'));
 console.log(JSON.stringify({case:'long execution authority',requestLimitMs:INTENT_PREPARE_CONTROL_MS,executionAuthorityMs:1800000,configuredProposalTtlMs:CURRENT_AUTHORITY_LIMITS.proposalTtlMs,retainedMs:actualMs}));
 assert.equal(actualMs,CURRENT_AUTHORITY_LIMITS.proposalTtlMs,'the existing configured proposal TTL still caps consent');
});
test('an expired canonical execution authority refuses before metadata, journal row or effect',async()=>{
 const f=fixture(true,{prepareMs:null,executionMs:-1});
 assert.notEqual((await f.post('prepare')).status,200);
 assert.equal(f.prepared.metadata.rows.size,0,'no retained metadata');
 assert.equal(f.journal.state.rows.size,0,'no journal row');
 assert.equal(f.core.calls.length,0);assert.equal(f.memory.rows.length,0);
});
test('a cancelled preparation retains nothing and submits nothing',async()=>{
 const f=fixture(true,{prepareMs:null,executionMs:900000});
 const controller=new AbortController();controller.abort();
 assert.notEqual((await f.post('prepare',{},{signal:controller.signal})).status,200);
 assert.equal(f.memory.rows.length,0,'no memory candidate');
 assert.equal(f.core.calls.length,0,'no Core effect call');
 assert.equal(f.journal.state.rows.size,0,'no journal row was settled');
});
test('a metadata write failure withholds the proposal and submits no candidate',async()=>{
 const f=fixture(true,{prepareMs:null,executionMs:900000,metadataUnavailable:true});
 assert.notEqual((await f.post('prepare')).status,200);
 assert.equal(f.prepared.metadata.rows.size,0,'no retained metadata');
 assert.equal(f.memory.rows.length,0,'no memory candidate');
 assert.equal(f.core.calls.length,0,'no Core effect call');
});
test('a preparation that completes after the request limit is still cut by that limit, not by the longer consent window',async()=>{
 // 1 s request limit, 900 s execution authority, 1.6 s authority read: the answer must not be the retained proposal.
 const f=fixture(true,{prepareMs:1000,executionMs:900000,delayMs:1600});
 const response=await f.post('prepare');
 assert.notEqual(response.status,200,'the request deadline still bounds the preparation');
 assert.equal(f.memory.rows.length,0,'no memory candidate');
 assert.equal(f.core.calls.length,0,'no Core effect call');
 // Let the owner settle its own journal row after the answer; the retained text, if any, still uses the consent window.
 await new Promise(resolve=>setTimeout(resolve,1200));
 for(const row of f.journal.state.rows.values())if(row.outcome?.result?.proposal)
  assert.equal(Date.parse(row.outcome.result.proposal.expiresAt)-NOW,CURRENT_AUTHORITY_LIMITS.proposalTtlMs,'a late completion never shortens the retained review to the request limit');
});