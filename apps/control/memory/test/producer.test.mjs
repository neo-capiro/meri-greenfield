/** SYNTHETIC: governed memory producer over the real wire/eligibility/candidate/review/memory-read modules, an in-memory journal double
 * and a Core double at the transport boundary. Not Core, PostgreSQL or live-policy qualification. */
import test from 'node:test';import assert from 'node:assert/strict';
import {canonicalSha256} from '../../../../packages/contracts/validate.mjs';
import {productFailure} from '../../product-access/errors.mjs';
import {createMemoryProducer} from '../producer.mjs';
import {createCoreReview} from '../core-review.mjs';
import {createCoreMemoryReads} from '../core-memory.mjs';
import {correctRequest,listRequest,proposeRequest,statusRequest} from '../wire.mjs';
import {FIRM_PROPOSAL_PERMISSION} from '../eligibility.mjs';
import {CLIENT_A,CLIENT_B,NOW,T2,createCoreDouble,createJournalDouble,id,ids,principal} from './fixtures.mjs';
const surface={kind:'surface'};
function setup(){
 const journal=createJournalDouble(),core=createCoreDouble(),newId=ids();
 const producer=createMemoryProducer({journal,review:createCoreReview({transport:core.transport}),memory:createCoreMemoryReads({transport:core.transport}),newId,now:()=>NOW});
 const propose=(p,body)=>producer.propose({principal:p,request:proposeRequest(body),origin:surface});
 const correct=(p,body)=>producer.correct({principal:p,request:correctRequest(body),origin:surface});
 const list=(p,body={})=>producer.list({principal:p,request:listRequest(body)});
 const status=(p,candidateId)=>producer.status({principal:p,request:statusRequest({candidateId})});
 return {journal,core,producer,propose,correct,list,status};
}
const code=async(promise,expected)=>{await assert.rejects(promise,e=>productFailure(e)?.code===expected);};
const web={kind:'web_page',reference:'https://example.gov/report'};

for(const targetState of ['superseded','forgotten','expired','missing'])test(`correction lost ACK then ${targetState}: same key retains original candidate and current review without rereading target`,async()=>{
 const t=setup(),memoryId='memory-replay';t.core.addMemory({memoryId,scope:'client',clientId:CLIENT_A,ownerActorId:null,key:'fiscal'});
 const body={idempotencyKey:id(801),targetMemoryId:memoryId,content:'Corrected fact',reason:'New evidence',sources:[web]};
 t.core.failSubmit='lostAck';const first=await t.correct(principal(),body);assert.equal(first.review.status,'submission_unknown');
 t.core.decide(first.candidateId,'approved');
 if(targetState==='missing')t.core.memories.delete(memoryId);else t.core.memories.get(memoryId).state=targetState;
 const before=t.core.calls.length,again=await t.correct(principal(),body);
 assert.equal(again.candidateId,first.candidateId);assert.equal(again.candidateSha256,first.candidateSha256);assert.deepEqual(again.corrects,first.corrects);
 assert.equal(again.review.status,'approved');assert.equal(t.core.reviews.size,1);
 assert.deepEqual(t.core.calls.slice(before).map(c=>c.route),['status']);
 await code(t.correct(principal(),{...body,content:'Changed under the same key'}),'MEMORY_IDEMPOTENCY_CONFLICT');
});

test('correction replay after client visibility revocation reveals nothing and neither reads target nor resubmits',async()=>{
 const t=setup(),memoryId='memory-revoked';t.core.addMemory({memoryId,scope:'client',clientId:CLIENT_A,ownerActorId:null});
 const body={idempotencyKey:id(802),targetMemoryId:memoryId,content:'Corrected fact',reason:'New evidence',sources:[web]};
 t.core.failSubmit='lostAck';const first=await t.correct(principal(),body),before=t.core.calls.length;
 await code(t.correct(principal({clientIds:[]}),body),'MEMORY_PROPOSAL_NOT_FOUND');
 assert.equal(t.core.calls.length,before);assert.equal(t.core.reviews.size,1);assert.equal([...t.journal.rows.values()][0].candidate.candidateId,first.candidateId);
});

for(const state of ['PREPARED','SUBMISSION_UNKNOWN'])for(const receipt of ['lostAck','refuse'])test(`firm correction ${state} ${receipt}: removed proposal permission prevents resubmission without rereading target`,async()=>{
 const t=setup(),memoryId='memory-firm-replay',allowed=principal({permissions:[FIRM_PROPOSAL_PERMISSION]});
 t.core.addMemory({memoryId,scope:'firm',ownerActorId:null});
 if(state==='PREPARED')t.journal.recordUnknown=async()=>{throw Error('synthetic journal acknowledgement loss');};
 const body={idempotencyKey:id(803),targetMemoryId:memoryId,content:'Corrected firm fact',reason:'New evidence',sources:[web]};
 t.core.failSubmit=receipt;const first=await t.correct(allowed,body),row=[...t.journal.rows.values()][0];
 assert.equal(first.review.status,'submission_unknown');assert.equal(row.submission.state,state);assert.equal(t.core.reviews.size,receipt==='lostAck'?1:0);
 // The prior receipt may exist while its status is unavailable. Neither that uncertainty nor a definite not_found grants a submit.
 t.core.failSubmit=null;t.core.failStatus=receipt==='lostAck';t.core.memories.delete(memoryId);
 const before=t.core.calls.length,submits=t.core.calls.filter(c=>c.route==='submit').length;
 const answer=await t.correct(principal({membershipRevision:'m2'}),body).then(value=>({value}),error=>({error}));
 assert.equal(t.core.calls.filter(c=>c.route==='submit').length,submits,'removed firm proposal permission must prevent every new submit');
 assert.equal(productFailure(answer.error)?.code,'MEMORY_SCOPE_REFUSED');assert.deepEqual(t.core.calls.slice(before).map(c=>c.route),['status']);
 assert.equal(row.submission.state,state);assert.equal(row.candidate.candidateId,first.candidateId);assert.equal(row.candidateSha256,first.candidateSha256);
});

test('firm retained status and known-review correction replay stay visible after proposal permission removal without submitting',async()=>{
 const t=setup(),memoryId='memory-firm-status',allowed=principal({permissions:[FIRM_PROPOSAL_PERMISSION]});t.core.addMemory({memoryId,scope:'firm',ownerActorId:null});
 const body={idempotencyKey:id(804),targetMemoryId:memoryId,content:'Corrected firm fact',reason:'New evidence',sources:[web]};
 t.core.failSubmit='lostAck';const first=await t.correct(allowed,body);t.core.memories.delete(memoryId);
 const before=t.core.calls.length,removed=principal({membershipRevision:'m2'});
 assert.equal((await t.status(removed,first.candidateId)).review.status,'pending');
 assert.deepEqual((await t.list(removed)).proposals.map(p=>p.candidateId),[first.candidateId]);
 const retained=await t.correct(removed,body);assert.equal(retained.candidateId,first.candidateId);assert.equal(retained.review.status,'pending');
 assert.deepEqual(t.core.calls.slice(before).map(c=>c.route),['status','status','status']);assert.equal(t.core.calls.filter(c=>c.route==='submit').length,1);
});

test('firm never-received status remains readable and restored proposal permission submits the identical retained correction',async()=>{
 const t=setup(),memoryId='memory-firm-restored',allowed=principal({permissions:[FIRM_PROPOSAL_PERMISSION]});t.core.addMemory({memoryId,scope:'firm',ownerActorId:null});
 const body={idempotencyKey:id(805),targetMemoryId:memoryId,content:'Corrected firm fact',reason:'New evidence',sources:[web]};
 t.core.failSubmit='refuse';const first=await t.correct(allowed,body);t.core.memories.delete(memoryId);t.core.failSubmit=null;
 const before=t.core.calls.length,removed=principal({membershipRevision:'m2'});
 assert.equal((await t.status(removed,first.candidateId)).review.status,'submission_unknown');
 assert.equal((await t.list(removed)).proposals[0].review.status,'submission_unknown');
 const replay=await t.correct(allowed,body);assert.equal(replay.candidateId,first.candidateId);assert.equal(replay.candidateSha256,first.candidateSha256);assert.deepEqual(replay.corrects,first.corrects);
 assert.deepEqual(t.core.calls.slice(before).map(c=>c.route),['status','status','status','submit']);assert.equal(t.core.reviews.size,1);
 assert.equal(t.core.calls.filter(c=>c.route==='submit').length,2);assert.equal(replay.review.status,'pending');
});

test('personal, client and firm proposals produce pending sourced candidates; personal no longer refuses',async()=>{
 const t=setup();
 const personal=await t.propose(principal(),{idempotencyKey:id(1),scope:'personal',content:'  Prefers short briefs  ',sources:[web]});
 assert.equal(personal.scope,'personal');assert.equal(personal.content,'Prefers short briefs');assert.equal(personal.review.status,'pending');
 assert.deepEqual(personal.sources,[{kind:'web_page',reference:'https://example.gov/report',sha256:null,title:null}]);assert.deepEqual(personal.origin,{kind:'surface'});
 const client=await t.propose(principal(),{idempotencyKey:id(2),scope:'client',clientId:CLIENT_A.toUpperCase(),content:'Fiscal year starts in July'});
 assert.equal(client.clientId,CLIENT_A);
 const firm=await t.propose(principal({permissions:[FIRM_PROPOSAL_PERMISSION]}),{idempotencyKey:id(3),scope:'firm',content:'Use plain language'});
 assert.equal(firm.scope,'firm');
 assert.deepEqual(t.core.calls.filter(c=>c.route==='submit').map(c=>c.body.candidate.scope),['personal','client','firm']);
});

test('eligibility: client outside the member walls and firm without permission refuse before any journal or Core effect',async()=>{
 const t=setup();
 await code(t.propose(principal(),{idempotencyKey:id(1),scope:'client',clientId:CLIENT_B,content:'x'}),'MEMORY_CLIENT_REFUSED');
 await code(t.propose(principal(),{idempotencyKey:id(2),scope:'firm',content:'x'}),'MEMORY_SCOPE_REFUSED');
 assert.equal(t.journal.calls.length,0);assert.equal(t.core.calls.length,0);
 for(const body of [{idempotencyKey:id(3),scope:'client',content:'missing client'},{idempotencyKey:id(4),scope:'personal',clientId:CLIENT_A,content:'x'},
  {idempotencyKey:id(5),scope:'personal',content:'x',extra:true},{idempotencyKey:id(6),scope:'team',content:'x'},{idempotencyKey:'not-a-uuid',scope:'personal',content:'x'},
  {idempotencyKey:id(7),scope:'personal',content:'x',sources:[{kind:'web_page',reference:'http://insecure.example'}]},{idempotencyKey:id(8),scope:'personal',content:'x'.repeat(4001)}])
  assert.throws(()=>proposeRequest(body),e=>productFailure(e)?.code==='MEMORY_REQUEST_INVALID');
});

test('candidates are immutable and hash-pinned: Core receives the exact journaled bytes and the hash is recomputable',async()=>{
 const t=setup();const view=await t.propose(principal(),{idempotencyKey:id(1),scope:'personal',content:'A',sources:[web]});
 const [row]=t.journal.rows.values();
 assert.equal(Object.isFrozen(row.candidate),true);assert.equal(Object.isFrozen(row.candidate.sources[0]),true);
 assert.throws(()=>{row.candidate.content='changed';});
 assert.equal(canonicalSha256(row.candidate),view.candidateSha256);
 const submit=t.core.calls.find(c=>c.route==='submit');
 assert.equal(submit.body.candidateSha256,view.candidateSha256);assert.equal(canonicalSha256(submit.body.candidate),view.candidateSha256);
 assert.equal(submit.tenantId,'tenant-one');assert.equal(submit.actorId,'actor-1');
});

test('idempotent replay returns the same candidate without a second review item; a different request under the key conflicts',async()=>{
 const t=setup();const body={idempotencyKey:id(1),scope:'personal',content:'A'};
 const first=await t.propose(principal(),body),second=await t.propose(principal(),body);
 assert.equal(second.candidateId,first.candidateId);assert.equal(second.candidateSha256,first.candidateSha256);
 assert.equal(t.core.reviews.size,1);assert.equal(t.core.calls.filter(c=>c.route==='submit').length,1);
 await code(t.propose(principal(),{...body,content:'B'}),'MEMORY_IDEMPOTENCY_CONFLICT');
 assert.equal(t.core.reviews.size,1);
});

test('no direct publish: the producer reports Core decisions and never approves; a submission answer claiming more is uncertainty',async()=>{
 const t=setup();const view=await t.propose(principal(),{idempotencyKey:id(1),scope:'personal',content:'A'});
 assert.equal(view.review.status,'pending');assert.equal(view.review.publishedMemoryId,null);
 assert.equal((await t.status(principal(),view.candidateId)).review.status,'pending');
 t.core.decide(view.candidateId,'approved');
 const decided=await t.status(principal(),view.candidateId);
 assert.equal(decided.review.status,'approved');assert.match(decided.review.publishedMemoryId,/^mem-/u);
 // A Core double that answers a submission with anything but a plain acknowledgement is not trusted as a publication.
 t.core.answer.submit={candidateId:id(999),candidateSha256:'0'.repeat(64),reviewId:id(998),accepted:true};
 const unknown=await t.propose(principal(),{idempotencyKey:id(2),scope:'personal',content:'B'});
 assert.equal(unknown.review.status,'submission_unknown');
 t.core.answer.submit={candidateId:unknown.candidateId,candidateSha256:unknown.candidateSha256,reviewId:id(997),accepted:true,status:'approved'};
 assert.equal((await t.propose(principal(),{idempotencyKey:id(2),scope:'personal',content:'B'})).review.status,'submission_unknown');
});

test('review authority: status answers must correlate to the exact candidate hash; unavailable Core is never shown as pending',async()=>{
 const t=setup();const view=await t.propose(principal(),{idempotencyKey:id(1),scope:'personal',content:'A'});
 t.core.answer.status={checkedAt:new Date(NOW).toISOString(),reviews:[{candidateId:view.candidateId,candidateSha256:'f'.repeat(64),status:'approved',reviewId:id(600),decidedAt:new Date(NOW).toISOString(),publishedMemoryId:'m'}]};
 assert.equal((await t.status(principal(),view.candidateId)).review.status,'unavailable');
 t.core.answer.status={checkedAt:new Date(NOW).toISOString(),reviews:[{candidateId:view.candidateId,candidateSha256:view.candidateSha256,status:'approved',reviewId:id(600),decidedAt:null,publishedMemoryId:'m'}]};
 assert.equal((await t.status(principal(),view.candidateId)).review.status,'unavailable');
 delete t.core.answer.status;t.core.failStatus=true;
 const listed=await t.list(principal());assert.equal(listed.proposals[0].review.status,'unavailable');
});

test('uncertain submission stays submission_unknown, is reconciled from Core on read, and replay resubmits only the identical candidate',async()=>{
 const t=setup();t.core.failSubmit='lostAck';
 const view=await t.propose(principal(),{idempotencyKey:id(1),scope:'personal',content:'A'});
 assert.equal(view.review.status,'submission_unknown');assert.equal([...t.journal.rows.values()][0].submission.state,'SUBMISSION_UNKNOWN');
 // Core did receive it; a read reconciles the journal without submitting anything.
 const submits=t.core.calls.filter(c=>c.route==='submit').length;
 assert.equal((await t.status(principal(),view.candidateId)).review.status,'pending');
 assert.equal(t.core.calls.filter(c=>c.route==='submit').length,submits);assert.equal([...t.journal.rows.values()][0].submission.state,'SUBMITTED');
 // A never-received submission: replay sends the same candidate id and hash.
 t.core.failSubmit='refuse';const other=await t.propose(principal(),{idempotencyKey:id(2),scope:'personal',content:'B'});
 assert.equal(other.review.status,'submission_unknown');assert.equal((await t.status(principal(),other.candidateId)).review.status,'submission_unknown');
 t.core.failSubmit=null;const replay=await t.propose(principal(),{idempotencyKey:id(2),scope:'personal',content:'B'});
 assert.equal(replay.candidateId,other.candidateId);assert.equal(replay.review.status,'pending');
 const sent=t.core.calls.filter(c=>c.route==='submit'&&c.body.candidate.candidateId===other.candidateId).map(c=>c.body.candidateSha256);
 assert.deepEqual(new Set(sent),new Set([other.candidateSha256]));
});

test('sourced corrections: pinned to the target hash, scope from the target, walls hide foreign memories, inactive targets refuse',async()=>{
 const t=setup();
 t.core.addMemory({memoryId:'mem-own',key:'brief-length'});
 t.core.addMemory({memoryId:'mem-client-a',scope:'client',clientId:CLIENT_A,ownerActorId:null,memorySha256:'d'.repeat(64)});
 t.core.addMemory({memoryId:'mem-client-b',scope:'client',clientId:CLIENT_B,ownerActorId:null});
 t.core.addMemory({memoryId:'mem-other-user',ownerActorId:'actor-2'});
 t.core.addMemory({memoryId:'mem-forgotten',state:'forgotten'});
 t.core.addMemory({memoryId:'mem-firm',scope:'firm',ownerActorId:null});
 const body=(target,n)=>({idempotencyKey:id(n),targetMemoryId:target,content:'Corrected text',reason:'The cited report supersedes it',sources:[web]});
 const own=await t.correct(principal(),body('mem-own',1));
 assert.equal(own.kind,'correction');assert.deepEqual(own.corrects,{memoryId:'mem-own',memorySha256:'c'.repeat(64)});assert.equal(own.key,'brief-length');assert.equal(own.review.status,'pending');
 const client=await t.correct(principal(),body('mem-client-a',2));assert.equal(client.scope,'client');assert.equal(client.clientId,CLIENT_A);
 await code(t.correct(principal(),body('mem-client-b',3)),'MEMORY_TARGET_NOT_FOUND');
 await code(t.correct(principal(),body('mem-other-user',4)),'MEMORY_TARGET_NOT_FOUND');
 await code(t.correct(principal(),body('mem-missing',5)),'MEMORY_TARGET_NOT_FOUND');
 await code(t.correct(principal(),body('mem-forgotten',6)),'MEMORY_TARGET_INELIGIBLE');
 await code(t.correct(principal(),body('mem-firm',7)),'MEMORY_SCOPE_REFUSED');
 assert.throws(()=>correctRequest({...body('mem-own',8),sources:[]}),e=>productFailure(e)?.code==='MEMORY_REQUEST_INVALID');
 assert.throws(()=>correctRequest({...body('mem-own',9),scope:'firm'}),e=>productFailure(e)?.code==='MEMORY_REQUEST_INVALID');
 assert.equal(t.core.reviews.size,2);
});

test('cross-tenant and cross-actor: listings and status never release another tenant or actor candidate',async()=>{
 const t=setup();const mine=await t.propose(principal(),{idempotencyKey:id(1),scope:'personal',content:'mine'});
 const otherTenant=principal({tenantId:T2}),otherActor=principal({actorId:'actor-2'});
 await t.propose(otherTenant,{idempotencyKey:id(1),scope:'personal',content:'theirs'});
 assert.deepEqual((await t.list(otherTenant)).proposals.map(p=>p.content),['theirs']);
 assert.deepEqual((await t.list(otherActor)).proposals,[]);
 await code(t.status(otherTenant,mine.candidateId),'MEMORY_PROPOSAL_NOT_FOUND');
 await code(t.status(otherActor,mine.candidateId),'MEMORY_PROPOSAL_NOT_FOUND');
 const submits=t.core.calls.filter(c=>c.route==='submit');assert.deepEqual(submits.map(c=>c.tenantId),['tenant-one','tenant-two']);
});

test('removal from a client withholds stored client proposals; list filters, pagination and client filter stay inside current walls',async()=>{
 const t=setup();
 const a=await t.propose(principal(),{idempotencyKey:id(1),scope:'client',clientId:CLIENT_A,content:'client fact'});
 await t.propose(principal(),{idempotencyKey:id(2),scope:'personal',content:'p1'});
 assert.equal((await t.list(principal())).proposals.length,2);
 const removed=principal({clientIds:[],membershipRevision:'m2'});
 assert.deepEqual((await t.list(removed)).proposals.map(p=>p.scope),['personal']);
 await code(t.status(removed,a.candidateId),'MEMORY_PROPOSAL_NOT_FOUND');
 await code(t.list(removed,{clientId:CLIENT_A}),'MEMORY_CLIENT_REFUSED');
 for(let n=3;n<8;n++)await t.propose(principal(),{idempotencyKey:id(n),scope:'personal',content:`p${n}`});
 const first=await t.list(principal(),{limit:4}),second=await t.list(principal(),{limit:4,cursor:first.nextCursor});
 assert.equal(first.proposals.length,4);assert.equal(second.proposals.length,3);assert.equal(second.nextCursor,null);
 assert.equal(new Set([...first.proposals,...second.proposals].map(p=>p.candidateId)).size,7);
 assert.deepEqual((await t.list(principal(),{clientId:CLIENT_A})).proposals.map(p=>p.candidateId),[a.candidateId]);
});

test('an acknowledged submission whose journal update fails is still reported as submitted and reconciled by the next read',async()=>{
 const t=setup();const record=t.journal.recordSubmission;t.journal.recordSubmission=async()=>{throw Error('synthetic journal failure');};
 const view=await t.propose(principal(),{idempotencyKey:id(1),scope:'personal',content:'A'});
 assert.equal(view.review.status,'pending');assert.match(view.review.reviewId,/^0{8}-/u);assert.equal([...t.journal.rows.values()][0].submission.state,'PREPARED');
 t.journal.recordSubmission=record;
 assert.equal((await t.status(principal(),view.candidateId)).review.status,'pending');assert.equal([...t.journal.rows.values()][0].submission.state,'SUBMITTED');
 assert.equal(t.core.calls.filter(c=>c.route==='submit').length,1);
});
