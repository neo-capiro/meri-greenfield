/** Native resolver -> existing memory family -> governed Core review; actual owners with scripted SQL/Core ports. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createAgentCoreIntentResolver} from '../execution-composition.mjs';
import {createRunnerIntentsApplication} from '../intents-http.mjs';
import {createMemoryFamilyWith,bindMemoryRetention} from '../../product-ports/memory.mjs';
import {captureRuntimePorts} from '../../product-applications.mjs';
import {createMemoryPoolFixture} from '../../../control/memory/test/pool-fixture.mjs';
import {createGoldenCore} from '../../../control/memory/test/core-golden.mjs';
import {createPreparedSchedulePoolFixture} from '../../../control/intents/test/prepared-schedule-fixture.mjs';
import {id,NOW,ids} from '../../../control/memory/test/fixtures.mjs';
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
function fixture(general){
 const binding={tenantId:id(80),actorId:id(81),conversationId:id(1),runId:id(2),attemptId:id(3),workerId:id(4),writerFence:1},clientId=id(5),selectedClientId=general?null:clientId;
 const scopes=[{tenantId:binding.tenantId,kind:general?'private-user':'client',resourceId:general?binding.actorId:clientId,policyRevision:'p'}];
 const state={active:true,auth:0,current:0,afterCore:null},memory=createMemoryPoolFixture(),journal=createPreparedSchedulePoolFixture();
 const pool={async connect(){const a=await journal.pool.connect(),m=await memory.pool.connect();return {async query(sql,p){if(sql.includes('meri_memory')||sql.includes('retention_subjects')||sql.startsWith('SELECT pg_advisory')||sql.startsWith('SET TRANSACTION'))return m.query(sql,p);return a.query(sql,p);},release(){a.release();m.release();}};}};
 const principal={tenantId:binding.tenantId,actorId:binding.actorId,role:'standard_user',permissions:[],clientIds:[clientId],membershipRevision:'m1'},now=()=>NOW;
 const core=createGoldenCore({now,serviceSecret:'synthetic-service'});core.member({token:'synthetic-native',tenantId:binding.tenantId,userId:binding.actorId});
 const context={pool,now,client:{},native:{},configuration:{sourceEnabled:true,intents:{enabled:true},retention:{enabled:true},memory:{enabled:true,origin:'https://core.example',serviceSecretFile:'/synthetic'},limits:{requestMs:3000,requestBytes:65536},native:{maxResponseBytes:262144}},canonicalProductPorts:captureRuntimePorts({conversationMembership:{async admit(){return {principal,expiresAtMs:NOW+30000};},async recheck(){return principal;}}})};
 const credentials={nativeCredentialFor(){if(!state.active)throw Error('revoked');return {credential:'synthetic-native',expiresAtMs:NOW+30000};}};
 createMemoryFamilyWith({nativeCredentials:credentials,readSecret:async()=>Buffer.from('synthetic-service'),newId:ids(300),fetchImpl:async(u,i)=>{const out=await core.fetch(u,i);await state.afterCore?.();return out;}})(context);
 bindMemoryRetention(context,{async assertServable(){if(!state.active)throw Error('suppressed');}});
 const execution={async authenticate(){state.auth++;if(!state.active)throw Error('revoked');return {execution:{binding,executionKey:hash(binding),executionId:hash(binding),planSha256:'a'.repeat(64),expiresAtMs:NOW+60000,runtimeSessionId:id(50)},state:'running',scopes,selectedClientId,policyRevision:'p'};}};
 const transitionAuthority={async readCurrent(){state.current++;return {binding,scopes,selectedClientId,policyRevision:'p',checkedAtMs:NOW,expiresAtMs:NOW+30000};}};
 const app=createRunnerIntentsApplication({resolveRun:createAgentCoreIntentResolver({context,execution,transitionAuthority,nativeCredentials:credentials}),enabled:true,now,limits:{maxRequestBytes:65536,maxResponseBytes:262144,maxPrepareMs:3000}});
 const post=(route,extra={})=>app.handle(new Request('https://control.invalid/v1/runner/intents/'+route,{method:'POST',headers:{authorization:'Bearer actual-execution','content-type':'application/json'},body:JSON.stringify({binding,...(route==='prepare'?{operation:{id:'save_memory',version:'0.2.0'},deliveryId:'sdk:'+'a'.repeat(64),arguments:{content:'Prefers concise updates',scope:'personal'}}:{}),...extra})}));
 return {state,memory,journal,core,post};
}
for(const general of [false,true])test(`mounted native ${general?'General':'client'} memory prepares one pending review and exact replay`,async()=>{
 const f=fixture(general),availability=await f.post('availability');assert.equal(availability.status,200,await availability.clone().text());assert.deepEqual((await availability.json()).operations,[{id:'save_memory',version:'0.2.0'}]);
 const first=await f.post('prepare');assert.equal(first.status,200,await first.clone().text());const result=await first.json();assert.equal(result.status,'review_pending');assert.equal(result.result.status,'pending');
 assert.equal(f.memory.rows.length,1);assert.equal(f.core.memories.length,0);assert.equal(f.journal.state.rows.size,1);assert.ok(f.state.auth>f.state.current);
 const replay=await f.post('prepare');assert.equal(replay.status,200);assert.deepEqual(await replay.json(),result);assert.equal(f.core.calls.filter(c=>c.path.endsWith('/submit')).length,1);
 f.state.active=false;assert.equal((await f.post('prepare')).status,403);assert.equal(f.memory.rows.length,1);
});
test('native execution loss while Core accepts a memory candidate withholds receipt and cannot submit twice',async()=>{
 const f=fixture(true);f.state.afterCore=()=>{f.state.active=false;};assert.notEqual((await f.post('prepare')).status,200);assert.equal(f.memory.rows.length,1);assert.equal(f.core.memories.length,0);
 f.state.active=true;f.state.afterCore=null;assert.notEqual((await f.post('prepare')).status,200);assert.equal(f.core.calls.filter(c=>c.path.endsWith('/submit')).length,1);assert.equal(f.memory.rows.length,1);
});


