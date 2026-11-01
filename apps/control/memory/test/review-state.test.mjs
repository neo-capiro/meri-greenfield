/** SYNTHETIC table-driven coverage of the governed memory state rules: the proposer view (journal submission × Core review), decision
 * admission, the owner/client/firm walls, and the correction invariants over the real producer with the journal/Core doubles. Core's
 * own decision workflow, PostgreSQL and live policy are not qualified here. */
import test from 'node:test';import assert from 'node:assert/strict';
import {productFailure} from '../../product-access/errors.mjs';
import {DECISION_OUTCOMES,decisionAdmission,proposerView,proposerViewStatus,repeatedDecision} from '../review-state.mjs';
import {FIRM_PROPOSAL_PERMISSION,assertCorrectionTarget,assertProposalScope,visibleToProposer} from '../eligibility.mjs';
import {createMemoryProducer} from '../producer.mjs';
import {createCoreMemoryTransport} from '../core-http.mjs';
import {createCoreReview} from '../core-review.mjs';
import {createCoreMemoryReads} from '../core-memory.mjs';
import {createCoreDecisions} from '../core-decisions.mjs';
import {VIEW_STATUSES,correctRequest,listRequest,proposeRequest,reviewDecisionRequest,statusRequest} from '../wire.mjs';
import {canonicalSha256} from '../../../../packages/contracts/validate.mjs';
import {normalizeMemoryProposeInput} from '../../../../packages/contracts/commands-0.2/validate.mjs';
import {createGoldenCore} from './core-golden.mjs';
import {CLIENT_A,CLIENT_B,NOW,T1,T2,createJournalDouble,id,ids,principal} from './fixtures.mjs';
const code=async(promise,expected)=>{await assert.rejects(promise,e=>productFailure(e)?.code===expected);};
const codeSync=(fn,expected)=>{assert.throws(fn,e=>productFailure(e)?.code===expected);};
const CORE_STATUSES=['unavailable','not_found','pending','approved','rejected','expired','withdrawn'];
const review=status=>status===null?null:Object.freeze({status,reviewId:status==='unavailable'||status==='not_found'?null:id(500),decidedAt:null,publishedMemoryId:null,checkedAt:new Date(NOW).toISOString()});

/** Journal submission state × Core answer → the one status the proposer sees (the table in review-state.mjs). */
const VIEW_TABLE=[
 // [submission state, Core answer (null = journal only), expected view status]
 ...['PREPARED','SUBMISSION_UNKNOWN'].flatMap(state=>[
  [state,null,'submission_unknown'],[state,'unavailable','submission_unknown'],[state,'not_found','submission_unknown'],
  [state,'pending','pending'],[state,'approved','approved'],[state,'rejected','rejected'],[state,'expired','expired'],[state,'withdrawn','withdrawn']]),
 ['SUBMITTED',null,'pending'],['SUBMITTED','unavailable','unavailable'],['SUBMITTED','not_found','review_missing'],
 ['SUBMITTED','pending','pending'],['SUBMITTED','approved','approved'],['SUBMITTED','rejected','rejected'],['SUBMITTED','expired','expired'],['SUBMITTED','withdrawn','withdrawn'],
];
test('view status table is total over journal submission state × Core answer and stays inside the wire vocabulary',()=>{
 const seen=new Set();
 for(const [state,answer,expected] of VIEW_TABLE){
  const submission={state,reviewId:state==='SUBMITTED'?id(500):null};
  assert.equal(proposerViewStatus(submission,review(answer)),expected,`${state} × ${answer}`);
  assert.ok(VIEW_STATUSES.includes(expected));seen.add(`${state}|${answer}`);
 }
 assert.equal(seen.size,3*(CORE_STATUSES.length+1),'every combination is tabled exactly once');
 // Never shown as pending without an acknowledgement, never shown as absent during an outage.
 for(const state of ['PREPARED','SUBMISSION_UNKNOWN'])for(const answer of [null,'unavailable','not_found'])assert.notEqual(proposerViewStatus({state,reviewId:null},review(answer)),'pending');
 assert.notEqual(proposerViewStatus({state:'SUBMITTED',reviewId:id(500)},review('unavailable')),'review_missing');
});

test('proposer view carries the immutable candidate, the correction pin and Core review facts; journal review id is a fallback only',()=>{
 const candidate={candidateId:id(1),kind:'correction',scope:'client',clientId:CLIENT_A,content:'Corrected',key:'k',ttlDays:null,corrects:{memoryId:`clio:${id(9)}`,memorySha256:'a'.repeat(64)},
  reason:'stale',sources:[{kind:'document',reference:'d',sha256:null,title:null}],origin:{kind:'surface'},createdAt:new Date(NOW).toISOString()};
 const record={candidate,candidateSha256:'b'.repeat(64),submission:{state:'SUBMITTED',reviewId:id(500)}};
 const journalOnly=proposerView(record,null);
 assert.deepEqual(journalOnly.review,{status:'pending',reviewId:id(500),decidedAt:null,publishedMemoryId:null,checkedAt:null});
 assert.deepEqual(journalOnly.corrects,candidate.corrects);assert.equal(journalOnly.content,'Corrected');assert.ok(Object.isFrozen(journalOnly)&&Object.isFrozen(journalOnly.review));
 const decided=proposerView(record,{status:'approved',reviewId:id(501),decidedAt:new Date(NOW+1).toISOString(),publishedMemoryId:`item:${id(10)}`,checkedAt:new Date(NOW+2).toISOString()});
 assert.deepEqual(decided.review,{status:'approved',reviewId:id(501),decidedAt:new Date(NOW+1).toISOString(),publishedMemoryId:`item:${id(10)}`,checkedAt:new Date(NOW+2).toISOString()});
 assert.equal(decided.corrects.memoryId,candidate.corrects.memoryId,'approval publishes a successor id; the pinned target id is never rewritten in the view');
});

/** view status × requested decision → admission (`forward`, `repeat`) or a typed refusal before any Core effect. */
const ADMISSION_TABLE=[
 ['pending','approved','forward'],['pending','rejected','forward'],
 ['approved','approved','repeat'],['rejected','rejected','repeat'],
 ['approved','rejected','MEMORY_DECISION_NOT_PENDING'],['rejected','approved','MEMORY_DECISION_NOT_PENDING'],
 ['expired','approved','MEMORY_DECISION_NOT_PENDING'],['withdrawn','rejected','MEMORY_DECISION_NOT_PENDING'],
 ['submission_unknown','approved','MEMORY_DECISION_NOT_PENDING'],['review_missing','rejected','MEMORY_DECISION_NOT_PENDING'],
 ['unavailable','approved','MEMORY_REVIEW_UNAVAILABLE'],['unavailable','rejected','MEMORY_REVIEW_UNAVAILABLE'],
];
test('decision admission table: only a pending candidate is forwarded, a matching terminal receipt repeats, everything else refuses',()=>{
 const covered=new Set();
 for(const [status,decision,expected] of ADMISSION_TABLE){
  const proposal={candidateId:id(1),review:{status,reviewId:null,decidedAt:null,publishedMemoryId:null,checkedAt:null}};covered.add(status);
  if(expected==='forward')assert.deepEqual(decisionAdmission(proposal,decision),{kind:'forward'},`${status} × ${decision}`);
  else if(expected==='repeat'){
   const admission=decisionAdmission(proposal,decision);
   assert.equal(admission.kind,'repeat');assert.equal(admission.result.proposal,proposal);
   assert.deepEqual(admission.result.decision,{decision,outcome:DECISION_OUTCOMES[decision]});
   assert.deepEqual(repeatedDecision(proposal,decision),admission.result);
  }else{codeSync(()=>decisionAdmission(proposal,decision),expected);assert.equal(repeatedDecision(proposal,decision),null);}
 }
 assert.deepEqual([...covered].sort(),[...VIEW_STATUSES].sort(),'every wire status has an admission rule');
 codeSync(()=>decisionAdmission({review:{status:'pending'}},'withdrawn'),'PRODUCT_CONFIGURATION');
 assert.equal(repeatedDecision({review:{status:'approved'}},'withdrawn'),null);
});

/** Proposal walls: scope × principal → admitted or the typed refusal, before any journal or Core call. */
const member=over=>principal(over);
const SCOPE_TABLE=[
 ['personal without client',member(),{scope:'personal',clientId:null},null],
 ['personal with a client id',member(),{scope:'personal',clientId:CLIENT_A},'MEMORY_SCOPE_REFUSED'],
 ['client inside the walls',member(),{scope:'client',clientId:CLIENT_A},null],
 ['client outside the walls',member(),{scope:'client',clientId:CLIENT_B},'MEMORY_CLIENT_REFUSED'],
 ['client without a client id',member(),{scope:'client',clientId:null},'MEMORY_CLIENT_REFUSED'],
 ['client after removal from it',member({clientIds:[]}),{scope:'client',clientId:CLIENT_A},'MEMORY_CLIENT_REFUSED'],
 ['firm without the permission',member(),{scope:'firm',clientId:null},'MEMORY_SCOPE_REFUSED'],
 ['firm with the permission',member({permissions:[FIRM_PROPOSAL_PERMISSION]}),{scope:'firm',clientId:null},null],
 ['firm with a client id',member({permissions:[FIRM_PROPOSAL_PERMISSION]}),{scope:'firm',clientId:CLIENT_A},'MEMORY_SCOPE_REFUSED'],
 ['unknown scope',member({permissions:[FIRM_PROPOSAL_PERMISSION]}),{scope:'tenant',clientId:null},'MEMORY_SCOPE_REFUSED'],
];
test('proposal scope table: personal, client and firm walls are role-specific and only narrow',()=>{
 for(const [label,p,request,expected] of SCOPE_TABLE){
  if(expected===null)assert.doesNotThrow(()=>assertProposalScope(p,request),label);else codeSync(()=>assertProposalScope(p,request),expected);
 }
});

/** Stored candidate visibility: tenant, proposer and current client walls decide release of a retained candidate. */
const candidateOf=over=>({tenantId:T1,proposerActorId:'actor-1',scope:'personal',clientId:null,...over});
const VISIBILITY_TABLE=[
 ['own personal',member(),candidateOf(),true],
 ['own client inside walls',member(),candidateOf({scope:'client',clientId:CLIENT_A}),true],
 ['own client after revocation',member({clientIds:[CLIENT_B]}),candidateOf({scope:'client',clientId:CLIENT_A}),false],
 ['own firm',member(),candidateOf({scope:'firm'}),true],
 ['another proposer',member({actorId:'actor-2'}),candidateOf(),false],
 ['another tenant',member({tenantId:T2}),candidateOf(),false],
];
test('visibility table: a retained candidate is released only to its proposer, in its tenant, inside current client walls',()=>{
 for(const [label,p,candidate,expected] of VISIBILITY_TABLE)assert.equal(visibleToProposer(p,candidate),expected,label);
});

/** Correction targets: hidden memories are reported as not found (no disclosure); visible inactive ones are ineligible. */
const target=over=>({tenantId:T1,memoryId:`clio:${id(9)}`,memorySha256:'c'.repeat(64),scope:'personal',clientId:null,ownerActorId:'actor-1',key:null,state:'active',...over});
const TARGET_TABLE=[
 ['own active personal',member(),target(),null],
 ['another owner personal',member(),target({ownerActorId:'actor-2'}),'MEMORY_TARGET_NOT_FOUND'],
 ['another tenant',member(),target({tenantId:T2}),'MEMORY_TARGET_NOT_FOUND'],
 ['client inside walls',member(),target({scope:'client',clientId:CLIENT_A,ownerActorId:null}),null],
 ['client outside walls',member(),target({scope:'client',clientId:CLIENT_B,ownerActorId:null}),'MEMORY_TARGET_NOT_FOUND'],
 ['firm without permission',member(),target({scope:'firm',ownerActorId:null}),'MEMORY_SCOPE_REFUSED'],
 ['firm with permission',member({permissions:[FIRM_PROPOSAL_PERMISSION]}),target({scope:'firm',ownerActorId:null}),null],
 ...['superseded','forgotten','expired'].map(state=>[`own ${state} personal`,member(),target({state}),'MEMORY_TARGET_INELIGIBLE']),
 ['client revoked and superseded',member({clientIds:[]}),target({scope:'client',clientId:CLIENT_A,ownerActorId:null,state:'superseded'}),'MEMORY_TARGET_NOT_FOUND'],
];
test('correction target table: owner and client walls hide, inactive states refuse, scope rules apply to the target',()=>{
 for(const [label,p,t,expected] of TARGET_TABLE){
  if(expected===null)assert.doesNotThrow(()=>assertCorrectionTarget(p,t),label);else codeSync(()=>assertCorrectionTarget(p,t),expected);
 }
});

/** The producer over the journal double and the golden Core fake (receiver, status, read and decision routes behind the real
 * transport): a correction is a separate pending candidate; Meri issues no memory mutation; Core's decision alone rejects (approved
 * text preserved) or publishes an immutable successor. */
const TENANT='11111111-1111-4111-8111-111111111111',ACTOR='22222222-2222-4222-8222-222222222222',CLIENT='44444444-4444-4444-8444-444444444444',SECRET='s';
const golden=(over={})=>Object.freeze({tenantId:TENANT,actorId:ACTOR,role:'standard_user',permissions:Object.freeze([]),clientIds:Object.freeze([CLIENT]),membershipRevision:'m1',...over});
function producerFixture(){
 const core=createGoldenCore({now:()=>NOW,serviceSecret:SECRET}),journal=createJournalDouble(),hooks={afterTarget:null};
 core.member({token:'bearer-a',tenantId:TENANT,userId:ACTOR});
 const transport=createCoreMemoryTransport({origin:'https://core.example',now:()=>NOW,
  fetchImpl:async(u,i)=>{const r=await core.fetch(u,i);if(hooks.afterTarget&&String(u).endsWith('/read_target')){const hook=hooks.afterTarget;hooks.afterTarget=null;hook();}return r;},
  getCredentials:async({tenantId,actorId})=>({tenantId,actorId,bearerToken:'bearer-a',serviceSecret:SECRET,expiresAtMs:NOW+60000})});
 const reads=createCoreMemoryReads({transport});
 const producer=createMemoryProducer({journal,review:createCoreReview({transport}),memory:reads,decisions:createCoreDecisions({transport}),newId:ids(),now:()=>NOW});
 const origin={kind:'surface'};
 return {core,journal,producer,hooks,
  target:(p,memoryId)=>reads.readTarget({tenantId:p.tenantId,actorId:p.actorId,memoryId}),
  correct:(p,body)=>producer.correct({principal:p,request:correctRequest(body),origin}),
  propose:(p,body)=>producer.propose({principal:p,request:proposeRequest(body),origin}),
  status:(p,candidateId)=>producer.status({principal:p,request:statusRequest({candidateId})}),
  pending:(p,body={})=>producer.listPending({principal:p,request:listRequest(body)}),
  decide:(p,decision,body)=>producer.decide({principal:p,request:reviewDecisionRequest(body,decision),decision})};
}
/** Meri only ever reaches Core's receiving reads, the receiver and the proposer's own decision routes; it never writes memory itself. */
const MERI_ROUTES=/^\/api\/(clio\/memory\/(review\/submit|review\/status|read_target|find_by_key)|memory\/(candidates|version-candidates)\/[^/]+\/(owner-decision|approve|reject))$/u;
const onlyGovernedRoutes=calls=>assert.deepEqual(calls.map(c=>c.path).filter(path=>!MERI_ROUTES.test(path)),[]);
test('correction invariants: pending leaves the active record and its hash untouched; rejection preserves it; approval publishes a successor',async()=>{
 const t=producerFixture(),p=golden(),row=t.core.addMemory({tenantId:TENANT,ownerUserId:ACTOR,key:'office-hours',value:'Mornings'}),memoryId=`clio:${row.id}`;
 const before=await t.target(p,memoryId);assert.equal(before.state,'active');
 const pending=await t.correct(p,{idempotencyKey:id(21),targetMemoryId:memoryId,content:'Afternoons',reason:'stale',sources:[{kind:'document',reference:'d'}]});
 assert.equal(pending.kind,'correction');assert.equal(pending.review.status,'pending');assert.deepEqual(pending.corrects,{memoryId,memorySha256:before.memorySha256});
 assert.equal(pending.content,'Afternoons');assert.equal(pending.scope,before.scope);assert.equal(pending.ttlDays,null);assert.equal(pending.review.publishedMemoryId,null);
 assert.deepEqual(await t.target(p,memoryId),before,'the active record is unchanged while the correction is pending');
 assert.equal(t.core.memories[0].value,'Mornings');
 // Rejection: Core's owner decides; the approved record and its hash survive, the candidate keeps its proposed text for history.
 const rejected=await t.decide(p,'rejected',{candidateId:pending.candidateId,reason:'keep the original'});
 assert.deepEqual(rejected.decision,{decision:'rejected',outcome:'rejected'});assert.equal(rejected.proposal.review.status,'rejected');
 assert.equal(rejected.proposal.content,'Afternoons');assert.deepEqual(rejected.proposal.corrects,pending.corrects);
 assert.deepEqual(await t.target(p,memoryId),before);assert.equal(t.core.memories[0].value,'Mornings');
 await code(t.decide(p,'approved',{candidateId:pending.candidateId}),'MEMORY_DECISION_NOT_PENDING');
 // A second correction of the same target, approved: Core publishes an immutable successor version distinct from the pinned target.
 const second=await t.correct(p,{idempotencyKey:id(22),targetMemoryId:memoryId,content:'Evenings',reason:'newer source',sources:[{kind:'document',reference:'d2'}]});
 assert.equal(second.review.status,'pending');assert.notEqual(second.candidateId,pending.candidateId);
 const approved=await t.decide(p,'approved',{candidateId:second.candidateId});
 assert.deepEqual(approved.decision,{decision:'approved',outcome:'activated'});assert.equal(approved.proposal.review.status,'approved');
 assert.match(approved.proposal.review.publishedMemoryId,/^item:/u);assert.notEqual(approved.proposal.review.publishedMemoryId,memoryId);
 assert.deepEqual(approved.proposal.corrects,{memoryId,memorySha256:before.memorySha256},'the successor still records which exact version it corrected');
 const successor=await t.target(p,approved.proposal.review.publishedMemoryId);
 assert.equal(successor.state,'active');assert.notEqual(successor.memorySha256,before.memorySha256);
 assert.equal(t.core.items.find(i=>i.id===approved.proposal.review.publishedMemoryId.slice(5)).sections[0].body,'Evenings');
 assert.equal(t.core.items[0].status,'superseded','the corrected version is superseded, never edited in place');
 assert.deepEqual(await t.decide(p,'approved',{candidateId:second.candidateId}),{proposal:await t.status(p,second.candidateId),decision:{decision:'approved',outcome:'duplicate'}});
 onlyGovernedRoutes(t.core.calls);
});

test('conflict and revocation: a target changed after the pin is a definite refusal, and a revoked client wall hides the pending correction on reload',async()=>{
 const t=producerFixture(),p=golden(),row=t.core.addMemory({tenantId:TENANT,scope:'client',clientId:CLIENT,key:'contact',value:'Original'}),memoryId=`clio:${row.id}`;
 const pending=await t.correct(p,{idempotencyKey:id(31),targetMemoryId:memoryId,content:'Client correction',reason:'r',sources:[{kind:'document',reference:'d'}]});
 assert.equal(pending.scope,'client');assert.equal(pending.clientId,CLIENT);
 // The committed memory changes between Meri's target read and Core's receipt: Core refuses the stale pin (409), records nothing.
 t.hooks.afterTarget=()=>{row.value='Changed elsewhere';row.updatedAt=new Date(NOW+5).toISOString();};
 await code(t.correct(p,{idempotencyKey:id(32),targetMemoryId:memoryId,content:'Stale pin',reason:'r',sources:[{kind:'document',reference:'d'}]}),'MEMORY_SUBMISSION_REFUSED');
 assert.equal(t.core.candidates.size,1,'the refused correction created no Core candidate');
 // Removal from the client: the retained pending correction is withheld from status, reload and decision alike.
 const revoked=golden({clientIds:[]});
 await code(t.status(revoked,pending.candidateId),'MEMORY_PROPOSAL_NOT_FOUND');
 await code(t.decide(revoked,'approved',{candidateId:pending.candidateId}),'MEMORY_PROPOSAL_NOT_FOUND');
 assert.deepEqual((await t.pending(revoked)).proposals,[]);
 // Restored walls reload the same immutable candidate, still pending, with the same pin.
 const reloaded=await t.status(p,pending.candidateId);
 assert.equal(reloaded.candidateSha256,pending.candidateSha256);assert.equal(reloaded.review.status,'pending');assert.deepEqual(reloaded.corrects,pending.corrects);
 assert.deepEqual((await t.pending(p)).proposals.map(c=>c.candidateId),[pending.candidateId]);
 onlyGovernedRoutes(t.core.calls);
});

test('pending material never overwrites approved content: a keyed surface addition is refused and a keyed command becomes a pinned correction',async()=>{
 const t=producerFixture(),p=golden(),row=t.core.addMemory({tenantId:TENANT,ownerUserId:ACTOR,key:'office-hours',value:'Mornings'}),memoryId=`clio:${row.id}`;
 const before=await t.target(p,memoryId);
 // Surface: an addition under a committed key is Core's definite 409 ("submit a correction instead"), not a replacement.
 await code(t.propose(p,{idempotencyKey:id(41),scope:'personal',content:'Office hours are afternoons',key:'office-hours'}),'MEMORY_SUBMISSION_REFUSED');
 assert.deepEqual(await t.target(p,memoryId),before);assert.equal(t.core.candidates.size,0);
 // Conversation command: the same key resolves to the committed memory and the candidate is a correction pinned to its current hash.
 const binding={tenantId:TENANT,actorId:ACTOR,conversationId:id(700),runId:id(701),attemptId:id(704),workerId:id(705),writerFence:1};
 const commandContext={binding,conversationClientId:null};
 const command={contractVersion:'0.1.0',commandId:id(702),binding,action:'memory.propose',arguments:normalizeMemoryProposeInput({content:'Office hours are afternoons',key:'office-hours'},commandContext),attachments:[],
  scopes:[{tenantId:TENANT,kind:'private-user',resourceId:ACTOR,policyRevision:'p1'}],idempotencyKey:id(703)};
 const fromCommand=await t.producer.proposeFromCommand({principal:p,command,commandContext,commandSha256:canonicalSha256(command)});
 assert.equal(fromCommand.kind,'correction');assert.equal(fromCommand.review.status,'pending');assert.deepEqual(fromCommand.corrects,{memoryId,memorySha256:before.memorySha256});
 assert.equal(fromCommand.key,'office-hours');assert.equal(fromCommand.review.publishedMemoryId,null);
 assert.deepEqual(await t.target(p,memoryId),before,'nothing is published until Core approves');
 onlyGovernedRoutes(t.core.calls);
});
