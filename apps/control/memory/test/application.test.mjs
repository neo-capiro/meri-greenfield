/** SYNTHETIC: the memory product application (bearer custody + routes over the real product mount) with a fake membership gate,
 * the real Core client over the golden Core fake and the journal double. Not Core, PostgreSQL or a live session. */
import test from 'node:test';import assert from 'node:assert/strict';
import {createMemoryApplication} from '../application.mjs';
import {createBearerCustody} from '../bearer-custody.mjs';
import {MEMORY_PATHS} from '../protocol.mjs';
import {createCoreMemoryTransport} from '../core-http.mjs';
import {createCoreReview} from '../core-review.mjs';
import {createCoreMemoryReads} from '../core-memory.mjs';
import {createCoreDecisions} from '../core-decisions.mjs';
import {createMemoryProducer} from '../producer.mjs';
import {createGoldenCore} from './core-golden.mjs';
import {createJournalDouble,ids,id,NOW} from './fixtures.mjs';
const TENANT='11111111-1111-4111-8111-111111111111',ACTOR='22222222-2222-4222-8222-222222222222',OTHER='33333333-3333-4333-8333-333333333333',SECRET='s';
const principalOf=actorId=>({tenantId:TENANT,actorId,role:'standard_user',permissions:[],clientIds:[],membershipRevision:'m1'});
/** Core's own identity for a bearer is what the gate verified; the fake gate admits by token suffix. */
function gate(calls){
 return {async admit({credential}){calls.push(['admit',credential]);const actorId=credential.endsWith('-other')?OTHER:ACTOR;return {principal:Object.freeze(principalOf(actorId)),expiresAtMs:NOW+60000};},
  async recheck({principal,credential}){calls.push(['recheck',credential]);return principal;}};
}
function setup({lifecycle=true}={}){
 const core=createGoldenCore({now:()=>NOW,lifecycle,serviceSecret:SECRET}),journal=createJournalDouble(),calls=[],bearers=[],newId=ids(100);
 for(const token of ['bearer-a','bearer-b','bearer-other'])core.member({token,tenantId:TENANT,userId:token==='bearer-other'?OTHER:ACTOR});
 const application=createMemoryApplication({gate:gate(calls),now:()=>NOW,limits:{maxRequestMs:5000,maxRequestBytes:65536,maxResponseBytes:1048576},
  producerFor({principal,bearer}){
   bearers.push([principal.actorId,bearer.credential,bearer.expiresAtMs]);
   const transport=createCoreMemoryTransport({origin:'https://core.example',now:()=>NOW,fetchImpl:(u,i)=>core.fetch(u,i),
    getCredentials:async({tenantId,actorId})=>({tenantId,actorId,bearerToken:bearer.credential,serviceSecret:SECRET,expiresAtMs:bearer.expiresAtMs})});
   return createMemoryProducer({journal,review:createCoreReview({transport}),memory:createCoreMemoryReads({transport}),decisions:createCoreDecisions({transport}),newId,now:()=>NOW});
  }});
 const post=async(path,body,token='bearer-a')=>{const r=await application.handle(new Request('https://control.example'+path,{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+token},body:JSON.stringify(body)}));return {status:r.status,body:await r.json()};};
 return {core,journal,application,calls,bearers,post};
}

test('each request reaches Core with exactly the bearer it was admitted with, bounded by its admission; the mount still rechecks membership before release',async()=>{
 const t=setup();
 assert.deepEqual(t.application.paths,Object.values(MEMORY_PATHS));
 const [a,b]=await Promise.all([t.post(MEMORY_PATHS.propose,{idempotencyKey:id(1),scope:'personal',content:'A'},'bearer-a'),t.post(MEMORY_PATHS.propose,{idempotencyKey:id(2),scope:'personal',content:'B'},'bearer-b')]);
 assert.equal(a.status,200);assert.equal(b.status,200);assert.equal(a.body.proposal.review.status,'pending');
 assert.deepEqual(t.bearers.map(([actor,credential,expiresAtMs])=>[actor,credential,expiresAtMs]).sort(),[[ACTOR,'bearer-a',NOW+60000],[ACTOR,'bearer-b',NOW+60000]]);
 const submits=t.core.calls.filter(c=>c.path.endsWith('/submit')).map(c=>c.bearer).sort();assert.deepEqual(submits,['bearer-a','bearer-b']);
 assert.deepEqual(t.calls.filter(c=>c[0]==='recheck').map(c=>c[1]).sort(),['bearer-a','bearer-b']);
 // A principal that was never admitted here has no bearer, whatever it claims.
 const custody=createBearerCustody({gate:gate([])});
 assert.throws(()=>custody.bearerOf(Object.freeze(principalOf(ACTOR))),e=>e.message==='ACCESS_DENIED');
 const admitted=await custody.gate.admit({credential:'bearer-a',deadlineMs:NOW+1000});
 assert.deepEqual(custody.bearerOf(admitted.principal),{credential:'bearer-a',expiresAtMs:NOW+60000});
 assert.deepEqual({...admitted.principal},principalOf(ACTOR));
});

test('the review path lists only pending own candidates and forwards the proposer decision; Core 503 is an UNKNOWN effect, a blank reason a 400',async()=>{
 const t=setup();
 const first=(await t.post(MEMORY_PATHS.propose,{idempotencyKey:id(1),scope:'personal',content:'A'})).body.proposal;
 const second=(await t.post(MEMORY_PATHS.propose,{idempotencyKey:id(2),scope:'personal',content:'B'})).body.proposal;
 assert.deepEqual((await t.post(MEMORY_PATHS.reviewList,{})).body.proposals.map(p=>p.candidateId).sort(),[first.candidateId,second.candidateId].sort());
 const approved=await t.post(MEMORY_PATHS.reviewApprove,{candidateId:first.candidateId});
 assert.equal(approved.status,200);assert.equal(approved.body.proposal.review.status,'approved');assert.deepEqual(approved.body.decision,{decision:'approved',outcome:'activated'});
 assert.deepEqual((await t.post(MEMORY_PATHS.reviewList,{})).body.proposals.map(p=>p.candidateId),[second.candidateId]);
 assert.deepEqual((await t.post(MEMORY_PATHS.reviewList,{},'bearer-other')).body.proposals,[]);
 assert.deepEqual(await t.post(MEMORY_PATHS.reviewReject,{candidateId:second.candidateId}),{status:400,body:{error:{code:'MEMORY_REQUEST_INVALID'}}});
 assert.deepEqual(await t.post(MEMORY_PATHS.reviewApprove,{candidateId:second.candidateId},'bearer-other'),{status:404,body:{error:{code:'MEMORY_PROPOSAL_NOT_FOUND'}}});
 assert.deepEqual(await t.post(MEMORY_PATHS.reviewApprove,{candidateId:first.candidateId}),{status:409,body:{error:{code:'MEMORY_DECISION_NOT_PENDING'}}});
 const rejected=await t.post(MEMORY_PATHS.reviewReject,{candidateId:second.candidateId,reason:'Not useful'});
 assert.equal(rejected.body.proposal.review.status,'rejected');assert.deepEqual(rejected.body.decision,{decision:'rejected',outcome:'rejected'});
 // A correction decided while Core's lifecycle gate is closed: the effect may or may not have applied.
 const memory=t.core.addMemory({tenantId:TENANT,scope:'personal',ownerUserId:ACTOR,key:'k',value:'v'});
 const correction=(await t.post(MEMORY_PATHS.correct,{idempotencyKey:id(3),targetMemoryId:`clio:${memory.id}`,content:'c',reason:'r',sources:[{kind:'document',reference:'d'}]})).body.proposal;
 assert.equal(correction.review.status,'pending');
 t.core.state.lifecycle=false;
 assert.deepEqual(await t.post(MEMORY_PATHS.reviewApprove,{candidateId:correction.candidateId}),{status:503,body:{error:{code:'MEMORY_DECISION_UNCERTAIN',outcome:'UNKNOWN'}}});
 t.core.state.lifecycle=true;
 assert.equal((await t.post(MEMORY_PATHS.reviewApprove,{candidateId:correction.candidateId})).body.decision.outcome,'activated');
 // A definite Core refusal of a submission is the documented 409, not an unknown outcome.
 assert.deepEqual(await t.post(MEMORY_PATHS.propose,{idempotencyKey:id(4),scope:'personal',content:'dup',key:'k'}),{status:409,body:{error:{code:'MEMORY_SUBMISSION_REFUSED'}}});
});
