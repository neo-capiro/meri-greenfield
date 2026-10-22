import test from 'node:test';
import assert from 'node:assert/strict';
import {createCoreConversationCurrentness} from '../conversation-currentness.mjs';
import {productFailure} from '../../../control/product-access/errors.mjs';
import {isAuthorityUnavailable} from '../../../../packages/runtime/authority-availability.mjs';
import {createTurnTelemetry} from '../../telemetry/turn-context.mjs';

const conversationId='11111111-1111-4111-8111-111111111111',clientId='22222222-2222-4222-8222-222222222222',otherClientId='33333333-3333-4333-8333-333333333333',at=1760000000000;
const revision='b'.repeat(64),principal=Object.freeze({tenantId:'tenant',actorId:'actor',role:'standard_user',permissions:[],clientIds:[clientId,otherClientId],membershipRevision:revision});
const scope=resourceId=>({tenantId:'tenant',kind:'client',resourceId,policyRevision:'p1'});
function fixture(change=()=>undefined){
 const calls=[];
 const owner=createCoreConversationCurrentness({origin:'https://core.synthetic.invalid',selectedClientId:clientId,now:()=>at,limits:{maxRequestMs:1000,maxFactBytes:131072},async fetchImpl(url,init){
  calls.push({url,init});const body=JSON.parse(init.body),value={principal:{tenantId:'tenant',actorId:'actor'},role:'standard_user',permissions:[],clientIds:[clientId,otherClientId],identityRevision:'a'.repeat(64),membershipRevision:revision,contextRevision:'c'.repeat(64),conversationId,selectedClientId:clientId,checkedAtMs:at,expiresAtMs:at+5000};
  return change(value,body,init)??Response.json(value);
 }});
 return {owner,calls,call:{credential:'synthetic-native-bearer',principal,conversationId,scopes:[scope(otherClientId),{tenantId:'tenant',kind:'tenant',resourceId:'tenant',policyRevision:'p1'},scope(clientId)],deadlineMs:at+1000}};
}
const unavailable=error=>productFailure(error)?.code==='CONVERSATION_UNAVAILABLE';

test('multi-client and tenant-scoped saved currentness reads configured Core current using the request bearer only',async t=>{
 const f=fixture(),telemetry=createTurnTelemetry({service:'control',now:()=>at,write:()=>{}}),binding={tenantId:'tenant',actorId:'actor',conversationId,runId:clientId,attemptId:otherClientId,workerId:'44444444-4444-4444-8444-444444444444',writerFence:1};t.after(()=>telemetry.close());
 await telemetry.within(binding,()=>f.owner.assertCurrent(f.call));assert.equal(telemetry.counters(binding).authorityFresh,1);assert.equal(telemetry.counters(binding).authorityReuses,0);
 assert.deepEqual(f.calls.map(c=>new URL(c.url).pathname),['/api/clio/application-authority/current']);
 assert.ok(f.calls.every(c=>c.init.headers.authorization==='Bearer synthetic-native-bearer'&&c.init.method==='POST'&&c.init.cache==='no-store'));
 assert.deepEqual(JSON.parse(f.calls[0].init.body),{conversationId,clientId,expect:{membershipRevision:revision}});
});
test('foreign membership scope and foreign native identity refuse before releasing currentness',async()=>{
 const scope=fixture();await assert.rejects(scope.owner.assertCurrent({...scope.call,principal:{...principal,clientIds:[]}}),unavailable);assert.equal(scope.calls.length,0);
 const missing=fixture();await assert.rejects(missing.owner.assertCurrent({...missing.call,scopes:[{...missing.call.scopes[0]}]}),unavailable);assert.equal(missing.calls.length,0);
 const foreign=fixture(value=>Response.json({...value,principal:{tenantId:'other',actorId:'actor'}}));
 await assert.rejects(foreign.owner.assertCurrent(foreign.call),unavailable);assert.equal(foreign.calls.length,1);
 const tenant=fixture();await assert.rejects(tenant.owner.assertCurrent({...tenant.call,scopes:[{...scopeForClient(),tenantId:'other'}]}),unavailable);assert.equal(tenant.calls.length,0);
 function scopeForClient(){return {tenantId:'tenant',kind:'client',resourceId:clientId,policyRevision:'p1'};}
});
test('archived and unavailable Core current both withhold history but retain refusal versus unavailability',async()=>{
 for(const status of [401,403,409,503]){const f=fixture(()=>new Response('',{status}));
  await assert.rejects(f.owner.assertCurrent(f.call),e=>unavailable(e)&&e.status===status&&isAuthorityUnavailable(e)===(status===503));assert.equal(f.calls.length,1);}
});
test('changed current principal, conversation or configured client never validates saved history',async()=>{
 for(const delta of [{principal:{tenantId:'tenant',actorId:'other'}},{selectedClientId:otherClientId},{conversationId:'44444444-4444-4444-8444-444444444444'}]){
  const f=fixture(value=>Response.json({...value,...delta}));await assert.rejects(f.owner.assertCurrent(f.call),unavailable);assert.equal(f.calls.length,1);
 }
});
test('O214 revision drift gives409 against the admitted membership pin even on a200 receipt',async()=>{
 const f=fixture(value=>Response.json({...value,membershipRevision:'d'.repeat(64)}));
 await assert.rejects(f.owner.assertCurrent(f.call),e=>unavailable(e)&&e.status===409&&!isAuthorityUnavailable(e));assert.equal(f.calls.length,1);
 assert.deepEqual(JSON.parse(f.calls[0].init.body).expect,{membershipRevision:revision});
});
test('O214 stale clocks, expiry, deadline and caller cancellation still refuse history',async()=>{
 for(const delta of [{checkedAtMs:at-1},{checkedAtMs:at+1},{expiresAtMs:at}]){const f=fixture(value=>Response.json({...value,...delta}));await assert.rejects(f.owner.assertCurrent(f.call),unavailable);}
 const f=fixture();await assert.rejects(f.owner.assertCurrent({...f.call,deadlineMs:at}),unavailable);assert.equal(f.calls.length,0);
 const stopped=fixture(),abort=new AbortController();abort.abort();await assert.rejects(stopped.owner.assertCurrent({...stopped.call,signal:abort.signal}),unavailable);assert.equal(stopped.calls.length,0);
});
test('O214 current timeout stays unavailable and never becomes a cached positive',async()=>{
 let sends=0;const owner=createCoreConversationCurrentness({origin:'https://core.synthetic.invalid',selectedClientId:clientId,now:Date.now,limits:{maxRequestMs:25,maxFactBytes:131072},fetchImpl:(_url,{signal})=>{sends++;return new Promise((_,reject)=>signal.addEventListener('abort',()=>reject(signal.reason),{once:true}));}}),f=fixture();
 for(let n=0;n<2;n++)await assert.rejects(owner.assertCurrent({...f.call,deadlineMs:Date.now()+1000}),e=>unavailable(e)&&e.status===503&&isAuthorityUnavailable(e));assert.equal(sends,2);
});
