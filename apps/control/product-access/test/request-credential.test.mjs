/** SYNTHETIC request-local native credential propagation, not a Clerk/Core call. */
import test from 'node:test';import assert from 'node:assert/strict';
import {createMembershipGate} from '../membership.mjs';import {createProductApplication} from '../http.mjs';
const path='/api/synthetic/effect';
function fixture(handler){const state={now:Date.now(),effects:0,reads:[],status:'active',revision:'m1',expires:20};
 const identity=credential=>({tenantId:'tenant-'+credential,actorId:'actor-'+credential});
 const gate=createMembershipGate({now:()=>state.now,limits:{maxRequestMs:1000,maxFactBytes:65536},
  async verifyToken({credential}){if(!['A','B'].includes(credential))throw Error('not current');return {...identity(credential),checkedAtMs:state.now,expiresAtMs:state.now+state.expires};},
  async readMembership(input){state.reads.push(input);const {credential}=input;if(!['A','B'].includes(credential)||input.tenantId!==identity(credential).tenantId||input.actorId!==identity(credential).actorId)throw Error('not current');
   return {...identity(credential),status:state.status,role:'member',permissions:[],clientIds:[],membershipRevision:state.revision,checkedAtMs:state.now,expiresAtMs:state.now+10000};}});
 const app=createProductApplication({gate,now:()=>state.now,limits:{maxRequestMs:1000,maxRequestBytes:1024,maxResponseBytes:1024},routes:{[path]:{effect:true,handle:call=>handler(call,state)}}});
 const post=(token='A')=>app.handle(new Request('https://synthetic.invalid'+path,{method:'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json'},body:'{}'}));return {state,post};
}
test('overlapping requests retain their own native credential through before-effect and result-release rechecks',async()=>{
 const barrier=Promise.withResolvers();let entered=0;const f=fixture(async(call,state)=>{assert.equal(Object.hasOwn(call,'credential'),false);assert.equal(Object.hasOwn(call.principal,'credential'),false);assert.equal(Object.hasOwn(call.body,'credential'),false);
  if(++entered===2)barrier.resolve();await barrier.promise;await call.recheckMembership();state.effects++;return {actorId:call.principal.actorId};});
 const replies=await Promise.all([f.post('A'),f.post('B')]);assert.deepEqual(replies.map(r=>r.status),[200,200]);assert.deepEqual(await Promise.all(replies.map(r=>r.json())),[{actorId:'actor-A'},{actorId:'actor-B'}]);
 assert.equal(f.state.effects,2);assert.equal(f.state.reads.length,6);for(const r of f.state.reads){assert.equal(r.actorId,'actor-'+r.credential);assert.equal(r.tenantId,'tenant-'+r.credential);}
});
test('invalid current token invokes no membership read or domain effect',async()=>{
 const f=fixture(async(_call,state)=>{state.effects++;return {};});assert.equal((await f.post('forged')).status,403);assert.equal(f.state.reads.length,0);assert.equal(f.state.effects,0);
});
for(const changed of ['removed','revision'])test(`current ${changed} at pre-effect recheck denies before the effect`,async()=>{
 const f=fixture(async(call,state)=>{if(changed==='removed')state.status='removed';else state.revision='m2';await call.recheckMembership();state.effects++;return {};});
 const r=await f.post();assert.equal(r.status,changed==='removed'?403:409);assert.equal(f.state.effects,0);assert.ok(f.state.reads.every(v=>v.credential==='A'));
});
test('revocation after the acknowledged effect remains RESULT_NOT_RELEASED',async()=>{
 const f=fixture(async(_call,state)=>{state.effects++;state.status='removed';return {secret:'withheld'};});const r=await f.post();assert.equal(r.status,403);assert.deepEqual(await r.json(),{error:{code:'MEMBERSHIP_REVOKED',outcome:'RESULT_NOT_RELEASED'}});assert.equal(f.state.effects,1);
});
test('fresh membership receipt cannot extend the initial token cutoff before effect',async()=>{
 let cutoff;const f=fixture(async(call,state)=>{cutoff=call.deadlineMs;state.now=cutoff-1;await call.recheckMembership();state.now=cutoff;await call.recheckMembership();state.effects++;return {};});
 const r=await f.post();assert.equal(r.status,408);assert.equal(f.state.effects,0);assert.equal(f.state.reads.length,2);assert.equal(f.state.reads[1].deadlineMs,cutoff);assert.ok(f.state.reads[1].expiresAtMs===undefined);
});
test('retained recheck closure is closed with the request and performs no later read',async()=>{
 let retained;const f=fixture(async({recheckMembership})=>{retained=recheckMembership;return {};});assert.equal((await f.post()).status,200);const reads=f.state.reads.length;await assert.rejects(retained());assert.equal(f.state.reads.length,reads);
});
