/** SYNTHETIC reconciliation of the Meri memory client with Core's actual receiver: the real transport, review/read/decision adapters
 * and producer over the GOLDEN Core fake (`core-golden.mjs`, derived from capiro-backend #84 `0304b0ef`) at the Fetch boundary, with
 * the in-memory journal double. Not Core, PostgreSQL or a live session. */
import test from 'node:test';import assert from 'node:assert/strict';
import {canonicalSha256} from '../../../../packages/contracts/validate.mjs';
import {productFailure} from '../../product-access/errors.mjs';
import {createCoreMemoryTransport} from '../core-http.mjs';
import {createCoreReview} from '../core-review.mjs';
import {createCoreMemoryReads} from '../core-memory.mjs';
import {createCoreDecisions} from '../core-decisions.mjs';
import {createMemoryProducer} from '../producer.mjs';
import {buildCandidate} from '../candidate.mjs';
import {correctRequest,proposeRequest,listRequest,statusRequest,reviewDecisionRequest,MEMORY_ID} from '../wire.mjs';
import {createGoldenCore} from './core-golden.mjs';
import {createJournalDouble,ids,id,NOW} from './fixtures.mjs';
const TENANT='11111111-1111-4111-8111-111111111111',ACTOR='22222222-2222-4222-8222-222222222222',OTHER='33333333-3333-4333-8333-333333333333',CLIENT=id(901),WALLED=id(902);
const TOKEN='golden-native-bearer',OTHER_TOKEN='golden-other-bearer',SECRET='golden-service-secret';
const surface={kind:'surface'};
const principal=(over={})=>Object.freeze({tenantId:TENANT,actorId:ACTOR,role:'standard_user',permissions:Object.freeze([]),clientIds:Object.freeze([CLIENT]),membershipRevision:'m1',...over});
const code=async(promise,expected,outcome=null)=>{await assert.rejects(promise,e=>productFailure(e)?.code===expected&&productFailure(e)?.outcome===outcome);};
function setup({lifecycle=true,credentials}={}){
 let now=NOW;const clock=()=>now;
 const core=createGoldenCore({now:clock,lifecycle,serviceSecret:SECRET});
 core.member({token:TOKEN,tenantId:TENANT,userId:ACTOR});core.member({token:OTHER_TOKEN,tenantId:TENANT,userId:OTHER});core.state.walledClients.add(WALLED);
 const journal=createJournalDouble();
 const transport=createCoreMemoryTransport({origin:'https://core.example',now:clock,fetchImpl:(url,init)=>core.fetch(url,init),
  getCredentials:credentials??(async({tenantId,actorId})=>({tenantId,actorId,bearerToken:actorId===ACTOR?TOKEN:OTHER_TOKEN,serviceSecret:SECRET,expiresAtMs:clock()+60000}))});
 const producer=createMemoryProducer({journal,review:createCoreReview({transport}),memory:createCoreMemoryReads({transport}),decisions:createCoreDecisions({transport}),newId:ids(100),now:clock});
 return {core,journal,producer,transport,tick:ms=>{now+=ms;},
  propose:(p,body)=>producer.propose({principal:p,request:proposeRequest(body),origin:surface}),
  correct:(p,body)=>producer.correct({principal:p,request:correctRequest(body),origin:surface}),
  status:(p,candidateId)=>producer.status({principal:p,request:statusRequest({candidateId})}),
  list:(p,body={})=>producer.list({principal:p,request:listRequest(body)}),
  pending:(p,body={})=>producer.listPending({principal:p,request:listRequest(body)}),
  decide:(p,decision,body)=>producer.decide({principal:p,request:reviewDecisionRequest(body,decision),decision})};
}
const rowOf=t=>[...t.journal.rows.values()][0];

test('receiving routes carry the member bearer and the verified service identity; decision routes the bearer only; 200 bodies are closed',async()=>{
 const t=setup();
 const view=await t.propose(principal(),{idempotencyKey:id(1),scope:'personal',content:'Prefers morning briefings',key:'briefing-time'});
 assert.equal(view.review.status,'pending');
 const decided=await t.decide(principal(),'approved',{candidateId:view.candidateId});
 assert.deepEqual(decided.decision,{decision:'approved',outcome:'activated'});
 const calls=t.core.calls.map(c=>[c.path.replace(view.candidateId,':id'),c.service,c.bearer]);
 assert.deepEqual(calls,[['/api/clio/memory/review/submit',true,TOKEN],['/api/clio/memory/review/status',true,TOKEN],['/api/memory/candidates/:id/owner-decision',false,TOKEN],['/api/clio/memory/review/status',true,TOKEN]]);
 // An unverified service identity is Core's 403: definite for a submission (nothing recorded), unavailable for a read.
 const unverified=setup({credentials:async({tenantId,actorId})=>({tenantId,actorId,bearerToken:TOKEN,serviceSecret:'wrong-secret',expiresAtMs:NOW+60000})});
 await code(unverified.propose(principal(),{idempotencyKey:id(2),scope:'personal',content:'x'}),'MEMORY_SUBMISSION_REFUSED');
 assert.equal(unverified.core.submissions.size,0);assert.equal(rowOf(unverified).submission.state,'PREPARED');
 assert.equal((await unverified.status(principal(),rowOf(unverified).candidate.candidateId)).review.status,'submission_unknown');
});

test('addition: ack, identical replay, pending until the owner decision; approval publishes a SCOPED clio id whose target hash is the clio domain',async()=>{
 const t=setup();
 const body={idempotencyKey:id(1),scope:'personal',content:'Prefers morning briefings',key:'briefing-time',ttlDays:2};
 const first=await t.propose(principal(),body),again=await t.propose(principal(),body);
 assert.equal(again.candidateId,first.candidateId);assert.equal(t.core.submissions.size,1);assert.equal(t.core.submissions.get(first.candidateId).candidateSha256,first.candidateSha256);
 assert.equal(canonicalSha256(rowOf(t).candidate),first.candidateSha256,'Core verifies the RFC 8785 hash of the exact submitted candidate');
 assert.deepEqual((await t.pending(principal())).proposals.map(p=>p.candidateId),[first.candidateId]);
 const decided=await t.decide(principal(),'approved',{candidateId:first.candidateId});
 assert.equal(decided.proposal.review.status,'approved');assert.match(decided.proposal.review.publishedMemoryId,MEMORY_ID);assert.ok(decided.proposal.review.publishedMemoryId.startsWith('clio:'));
 assert.deepEqual((await t.pending(principal())).proposals,[]);
 const target=await createCoreMemoryReads({transport:t.transport}).readTarget({tenantId:TENANT,actorId:ACTOR,memoryId:decided.proposal.review.publishedMemoryId});
 assert.equal(target.key,'briefing-time');assert.equal(target.state,'active');assert.equal(target.scope,'personal');assert.equal(target.ownerActorId,ACTOR);
 const row=t.core.memories.find(m=>`clio:${m.id}`===target.memoryId);
 assert.equal(target.memorySha256,canonicalSha256({schema:'capiro.clio-memory.v1',memoryId:target.memoryId,scope:'personal',clientId:null,ownerActorId:ACTOR,key:'briefing-time',storageKey:'briefing-time',state:'active',value:'Prefers morning briefings',expiresAt:new Date(row.expiresAt).toISOString(),updatedAt:row.updatedAt}));
 // The ttl became Core's expiry; a second keyed addition for the committed key is a definite 409 (a correction is required).
 assert.equal(row.expiresAt,Date.parse(first.createdAt)+2*86400000);
 await code(t.propose(principal(),{idempotencyKey:id(2),scope:'personal',content:'Another',key:'briefing-time'}),'MEMORY_SUBMISSION_REFUSED');
 // The decided candidate cannot be decided again; another member never sees it.
 await code(t.decide(principal(),'rejected',{candidateId:first.candidateId,reason:'late'}),'MEMORY_DECISION_NOT_PENDING');
 await code(t.decide(principal({actorId:OTHER}),'approved',{candidateId:first.candidateId}),'MEMORY_PROPOSAL_NOT_FOUND');
});

test('unkeyed addition: Core stores a synthetic key and reads it back as the logical null only with proven lineage; the reserved form is refused before any Core call',async()=>{
 const t=setup();
 const view=await t.propose(principal(),{idempotencyKey:id(1),scope:'personal',content:'Likes charts'});
 assert.equal(t.core.candidates.get(view.candidateId).payload.key,`meri:${view.candidateId}`);
 const decided=await t.decide(principal(),'approved',{candidateId:view.candidateId});
 const reads=createCoreMemoryReads({transport:t.transport});
 assert.equal((await reads.readTarget({tenantId:TENANT,actorId:ACTOR,memoryId:decided.proposal.review.publishedMemoryId})).key,null);
 assert.equal(await reads.findByKey({tenantId:TENANT,actorId:ACTOR,scope:'personal',clientId:null,key:`meri:${view.candidateId}`}),null);
 // Without the lineage (another submission's synthetic key on a row) the storage key stays the logical key: over 120 chars it is unaddressable.
 const before=t.core.calls.length;
 for(const body of [{idempotencyKey:id(2),scope:'personal',content:'x',key:`meri:${id(5)}`}])assert.throws(()=>proposeRequest(body),e=>productFailure(e)?.code==='MEMORY_REQUEST_INVALID');
 assert.throws(()=>buildCandidate({candidateId:id(7),principal:principal(),scope:'personal',clientId:null,content:'x',key:`meri:${id(5)}`,ttlDays:null,sources:[],origin:surface,idempotencyKey:id(8),createdAt:new Date(NOW).toISOString()}),e=>productFailure(e)?.code==='MEMORY_CANDIDATE_INVALID');
 assert.equal(t.core.calls.length,before);
});

test('correction: the pin is the clio projection hash and SCOPED id; approval through the version route publishes item:<id> in the item hash domain',async()=>{
 const t=setup();
 const memory=t.core.addMemory({tenantId:TENANT,scope:'personal',ownerUserId:ACTOR,key:'briefing-time',value:'Mornings'});
 const reads=createCoreMemoryReads({transport:t.transport}),memoryId=`clio:${memory.id}`;
 const target=await reads.readTarget({tenantId:TENANT,actorId:ACTOR,memoryId});
 assert.equal(target.memorySha256,canonicalSha256({schema:'capiro.clio-memory.v1',memoryId,scope:'personal',clientId:null,ownerActorId:ACTOR,key:'briefing-time',storageKey:'briefing-time',state:'active',value:'Mornings',expiresAt:null,updatedAt:memory.updatedAt}));
 const view=await t.correct(principal(),{idempotencyKey:id(1),targetMemoryId:memoryId,content:'Evenings now',reason:'Changed schedule',sources:[{kind:'document',reference:'doc-1'}]});
 assert.equal(view.kind,'correction');assert.deepEqual(view.corrects,{memoryId,memorySha256:target.memorySha256});assert.equal(view.ttlDays,null);assert.equal(view.review.status,'pending');
 assert.equal(t.core.candidates.get(view.candidateId).sourceKind,'memory_correction');
 // The proposer's own decision for a correction goes to Core's version owner, never to the generic owner (which answers 409 for it).
 const decided=await t.decide(principal(),'approved',{candidateId:view.candidateId});
 assert.deepEqual(decided.decision,{decision:'approved',outcome:'activated'});
 const published=decided.proposal.review.publishedMemoryId;assert.ok(published.startsWith('item:'));assert.match(published,MEMORY_ID);
 assert.ok(t.core.calls.some(c=>c.path===`/api/memory/version-candidates/${view.candidateId}/approve`&&c.service===false));
 const item=await reads.readTarget({tenantId:TENANT,actorId:ACTOR,memoryId:published}),row=t.core.items.find(i=>`item:${i.id}`===published);
 assert.equal(item.memorySha256,canonicalSha256({schema:'capiro.memory-item.v1',memoryId:published,scope:'personal',clientId:null,ownerActorId:ACTOR,key:'briefing-time',storageKey:'briefing-time',state:'active',value:'Evenings now',expiresAt:null,updatedAt:row.updatedAt}));
 assert.notEqual(item.memorySha256,target.memorySha256,'distinct hash domains: the item hash is never the clio hash');
 // The corrected clio memory is now superseded; find_by_key answers the controlling version.
 assert.equal((await reads.readTarget({tenantId:TENANT,actorId:ACTOR,memoryId})).state,'superseded');
 assert.equal((await reads.findByKey({tenantId:TENANT,actorId:ACTOR,scope:'personal',clientId:null,key:'briefing-time'})).memoryId,published);
 await code(t.correct(principal(),{idempotencyKey:id(2),targetMemoryId:memoryId,content:'Again',reason:'r',sources:[{kind:'document',reference:'doc-2'}]}),'MEMORY_TARGET_INELIGIBLE');
});

test('a bare UUID is never a memory; a stale pin is a DEFINITE 409: nothing recorded at Core, the journal stays PREPARED and a replay is refused again',async()=>{
 const t=setup();
 const memory=t.core.addMemory({tenantId:TENANT,scope:'personal',ownerUserId:ACTOR,key:'k',value:'v'}),memoryId=`clio:${memory.id}`;
 const body=n=>({idempotencyKey:id(n),targetMemoryId:memory.id,content:'c',reason:'r',sources:[{kind:'document',reference:'d'}]});
 await code(t.correct(principal(),body(1)),'MEMORY_TARGET_NOT_FOUND');
 // Between the target read and the submission the memory changes: Core re-verifies the pin under its row lock and refuses.
 const reading=createCoreMemoryReads({transport:{call:async(route,input,...rest)=>{const out=await t.transport.call(route,input,...rest);if(route==='target')memory.value='changed under the lock';return out;}}});
 const racing=createMemoryProducer({journal:t.journal,review:createCoreReview({transport:t.transport}),memory:reading,decisions:createCoreDecisions({transport:t.transport}),newId:ids(200),now:()=>NOW});
 const request={...body(2),targetMemoryId:memoryId};
 await code(racing.correct({principal:principal(),request:correctRequest(request),origin:surface}),'MEMORY_SUBMISSION_REFUSED');
 assert.equal(t.core.submissions.size,0);assert.equal(t.core.candidates.size,0);
 const row=rowOf(t);assert.equal(row.submission.state,'PREPARED');assert.equal(row.candidate.kind,'correction');
 assert.equal((await t.status(principal(),row.candidate.candidateId)).review.status,'submission_unknown');
 await code(racing.correct({principal:principal(),request:correctRequest(request),origin:surface}),'MEMORY_SUBMISSION_REFUSED');
 assert.equal(t.journal.rows.size,1);assert.equal(t.core.calls.filter(c=>c.path.endsWith('/submit')).length,2);
});

test('ttl: a keyed conversational proposal that becomes a correction carries no ttl; a correction candidate with a ttl is refused locally, never submitted',async()=>{
 const t=setup();
 const memory=t.core.addMemory({tenantId:TENANT,scope:'personal',ownerUserId:ACTOR,key:'brief-length',value:'short'});
 const command={commandId:id(5),binding:{tenantId:TENANT,actorId:ACTOR,conversationId:id(1),runId:id(2)},arguments:{scope:'personal',clientId:null,content:'Long briefs please',key:'brief-length',ttlDays:3},idempotencyKey:id(6)};
 const view=await t.producer.proposeFromCommand({principal:principal(),command,commandSha256:canonicalSha256(command)});
 assert.equal(view.kind,'correction');assert.equal(view.ttlDays,null);assert.equal(view.corrects.memoryId,`clio:${memory.id}`);assert.equal(view.review.status,'pending');
 const fields={candidateId:id(9),principal:principal(),scope:'personal',clientId:null,content:'x',key:'k',ttlDays:5,corrects:{memoryId:`clio:${memory.id}`,memorySha256:'a'.repeat(64)},reason:'r',sources:[],origin:{kind:'conversation',conversationId:id(1),runId:id(2),commandId:id(3),commandSha256:'b'.repeat(64)},idempotencyKey:id(8),createdAt:new Date(NOW).toISOString()};
 assert.throws(()=>buildCandidate(fields),e=>productFailure(e)?.code==='MEMORY_CANDIDATE_INVALID');
 assert.equal(buildCandidate({...fields,ttlDays:null}).candidate.ttlDays,null);
 // The golden receiver agrees: the same candidate with a ttl is Core's definite 409.
 const forced={...rowOf(t).candidate,ttlDays:3};
 await code(createCoreReview({transport:t.transport}).submit({candidate:forced,candidateSha256:canonicalSha256(forced)}),'MEMORY_SUBMISSION_REFUSED');
});

test('503 is uncertainty: a correction before MEMORY_GOVERNANCE_LIFECYCLE=enforce stays submission_unknown and resubmits once enforced; a decision under 503 is UNKNOWN',async()=>{
 const t=setup({lifecycle:false});
 const memory=t.core.addMemory({tenantId:TENANT,scope:'personal',ownerUserId:ACTOR,key:'k',value:'v'});
 const body={idempotencyKey:id(1),targetMemoryId:`clio:${memory.id}`,content:'c',reason:'r',sources:[{kind:'document',reference:'d'}]};
 const first=await t.correct(principal(),body);
 assert.equal(first.review.status,'submission_unknown');assert.equal(rowOf(t).submission.state,'SUBMISSION_UNKNOWN');assert.equal(t.core.submissions.size,0);
 assert.equal((await t.status(principal(),first.candidateId)).review.status,'submission_unknown');
 t.core.state.lifecycle=true;
 const replay=await t.correct(principal(),body);
 assert.equal(replay.candidateId,first.candidateId);assert.equal(replay.candidateSha256,first.candidateSha256);assert.equal(replay.review.status,'pending');
 const sent=t.core.calls.filter(c=>c.path.endsWith('/submit'));assert.equal(sent.length,2);
 t.core.state.lifecycle=false;
 await code(t.decide(principal(),'approved',{candidateId:first.candidateId}),'MEMORY_DECISION_UNCERTAIN','UNKNOWN');
 assert.equal(t.core.candidates.get(first.candidateId).status,'pending');
 t.core.state.lifecycle=true;
 assert.equal((await t.decide(principal(),'rejected',{candidateId:first.candidateId,reason:'not needed'})).proposal.review.status,'rejected');
});

test('decisions: shared scopes keep Core\'s review workflow (owner-decision 404), a rejection needs a reason, Core\'s refusals are typed and nothing is decided',async()=>{
 const t=setup();
 const client=await t.propose(principal(),{idempotencyKey:id(1),scope:'client',clientId:CLIENT,content:'Fiscal year starts in July'});
 assert.equal(client.review.status,'pending');
 await code(t.decide(principal(),'approved',{candidateId:client.candidateId}),'MEMORY_DECISION_NOT_FOUND');
 assert.equal(t.core.candidates.get(client.candidateId).status,'pending');
 assert.throws(()=>reviewDecisionRequest({candidateId:client.candidateId},'rejected'),e=>productFailure(e)?.code==='MEMORY_REQUEST_INVALID');
 assert.throws(()=>reviewDecisionRequest({candidateId:client.candidateId,reason:' '},'rejected'),e=>productFailure(e)?.code==='MEMORY_REQUEST_INVALID');
 assert.throws(()=>reviewDecisionRequest({candidateId:client.candidateId,reason:'x'},'approved'),e=>productFailure(e)?.code==='MEMORY_REQUEST_INVALID');
 // A walled client never reaches the journal; Core would also refuse it (403) if it did.
 await code(t.propose(principal({clientIds:[CLIENT,WALLED]}),{idempotencyKey:id(2),scope:'client',clientId:WALLED,content:'x'}),'MEMORY_SUBMISSION_REFUSED');
 assert.equal(t.core.submissions.size,1);
});

test('status is proposer-only and hash-bound; a page never asks Core for more than 50 candidates; an unreachable Core is unavailable, never pending',async()=>{
 const t=setup();
 for(let n=1;n<=52;n++)await t.propose(principal(),{idempotencyKey:id(n),scope:'personal',content:`fact ${n}`});
 const page=await t.list(principal(),{limit:50});
 assert.equal(page.proposals.length,50);assert.ok(page.proposals.every(p=>p.review.status==='pending'));assert.notEqual(page.nextCursor,null);
 const statusCalls=t.core.calls.filter(c=>c.path.endsWith('/status'));assert.ok(statusCalls.length>0);
 const mine=page.proposals[0].candidateId;
 await code(t.status(principal({actorId:OTHER}),mine),'MEMORY_PROPOSAL_NOT_FOUND');
 const review=createCoreReview({transport:t.transport});
 const foreign=await review.status({tenantId:TENANT,actorId:OTHER,candidates:[{candidateId:mine,candidateSha256:page.proposals[0].candidateSha256}]});
 assert.equal(foreign.get(mine).status,'not_found');
 const mismatch=await review.status({tenantId:TENANT,actorId:ACTOR,candidates:[{candidateId:mine,candidateSha256:'f'.repeat(64)}]});
 assert.equal(mismatch.get(mine).status,'not_found');
 t.core.state.offline=true;
 assert.equal((await t.status(principal(),mine)).review.status,'unavailable');
 await code(t.decide(principal(),'approved',{candidateId:mine}),'MEMORY_REVIEW_UNAVAILABLE');
 // An expired or unknown bearer (Core 401) is uncertainty for a submission: the candidate is retained and resubmitted on replay.
 t.core.state.offline=false;t.core.state.bearers.delete(TOKEN);
 const unknown=await t.propose(principal(),{idempotencyKey:id(60),scope:'personal',content:'late'});
 assert.equal(unknown.review.status,'submission_unknown');
 t.core.member({token:TOKEN,tenantId:TENANT,userId:ACTOR});
 assert.equal((await t.propose(principal(),{idempotencyKey:id(60),scope:'personal',content:'late'})).review.status,'pending');
});
