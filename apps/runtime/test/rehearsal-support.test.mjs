/** Source-only Core-model controls; real S2 transport/receipt owner, synthetic latency/clock, no image/live claim. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {CORE_PROFILES,createRehearsalCoreModel} from './rehearsal-support.mjs';
import {createCapiroApplicationAuthorityClient} from '../../control/action-host/application-adapters/authority-http.mjs';
import {createRunCurrentAuthority} from '../native-authority/run-current-authority.mjs';
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const binding={tenantId:'tenant',actorId:'actor',conversationId:id(1),runId:id(2),attemptId:id(3),workerId:id(4),writerFence:1},principal={tenantId:'tenant',actorId:'actor'},clientId=id(5);
function fixture(){
 const state={mono:0,calls:0,delays:[]},now=()=>1800000000000+state.mono;
 const model=createRehearsalCoreModel({principal,clientId,conversationId:binding.conversationId,latency:CORE_PROFILES.quiet,now,state,before(){state.calls++;},async delay(ms){state.delays.push(ms);state.mono+=ms;}});
 const client=createCapiroApplicationAuthorityClient({origin:'https://core.synthetic.invalid',fetchImpl:model,enabled:true,now,limits:{maxRequestMs:3000,maxResponseBytes:131072}}),owner=createRunCurrentAuthority({client,now,monotonic:()=>state.mono});
 const read=(extra={})=>owner.read({binding,selectedClientId:clientId,credential:'synthetic-native',sessionFence:'synthetic-session:fence',deadlineMs:now()+3000,...extra});
 const request=(body={conversationId:binding.conversationId,clientId})=>model('https://core.synthetic.invalid/api/clio/application-authority/current',{method:'POST',body:JSON.stringify(body)});
 return {state,model,owner,read,request};
}
test('rehearsal current latency uses context plus the full measured identity share, without changing legacy profiles',()=>{
 assert.deepEqual(Object.values(CORE_PROFILES).map(p=>[p.identity,p.membership,p.context,p.current]),[[85,220,250,335],[100,300,500,600],[150,450,750,900]]);
 for(const profile of Object.values(CORE_PROFILES))assert.equal(profile.current,profile.context+profile.identity);
});
test('rehearsal current returns one120s snapshot and configured selectors/revision preconditions refuse',async()=>{
 const f=fixture(),response=await f.request(),r=await response.json();assert.equal(response.status,200);assert.equal(r.expiresAtMs-r.checkedAtMs,120000);assert.equal(r.checkedAtMs,1800000000335);assert.deepEqual(r.principal,principal);assert.equal(r.selectedClientId,clientId);assert.equal(r.conversationId,binding.conversationId);assert.deepEqual(f.state.delays,[335]);
 assert.deepEqual(Object.keys(r).sort(),['principal','role','permissions','clientIds','identityRevision','membershipRevision','contextRevision','conversationId','selectedClientId','checkedAtMs','expiresAtMs'].sort());
 for(const field of ['identityRevision','membershipRevision','contextRevision'])assert.match(r[field],/^[a-f0-9]{64}$/u);
 assert.equal((await f.request({conversationId:id(8),clientId})).status,403);assert.equal((await f.request({conversationId:binding.conversationId,clientId:id(8)})).status,403);
 assert.equal((await f.request({conversationId:binding.conversationId,clientId,expect:{contextRevision:'d'.repeat(64)}})).status,409);
 assert.equal((await f.request({conversationId:binding.conversationId,clientId,expect:{bogus:'d'.repeat(64)}})).status,400);
});
test('rehearsal current keeps401/403/409/503 distinct through the real transport without retries',async()=>{
 for(const status of [401,403,409,503]){const f=fixture();f.state.status=status;await assert.rejects(f.read(),e=>e.status===status);assert.equal(f.state.calls,1);assert.equal(f.owner.status().entries,0);}
});
test('rehearsal snapshot exercises real19.9s reuse and20s fresh revocation without refreshing sendStart',async()=>{
 const f=fixture();await f.read();f.state.mono=10000;await f.read();f.state.mono=19900;await f.read();assert.equal(f.state.calls,1);assert.equal(f.owner.status().reuses,2);f.state.status=403;f.state.mono=20000;await assert.rejects(f.read(),e=>e.status===403);assert.equal(f.state.calls,2);assert.equal(f.owner.status().entries,0);
});
test('rehearsal fresh admission exposes warm-cache503 and never falls back to its old positive',async()=>{
 const f=fixture();await f.read();await f.read({fresh:true});assert.equal(f.state.calls,2);f.state.status=503;await assert.rejects(f.read({fresh:true}),e=>e.status===503);await assert.rejects(f.read(),e=>e.status===503);assert.equal(f.state.calls,4);assert.equal(f.owner.status().entries,0);
});
