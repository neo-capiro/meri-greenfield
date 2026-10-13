import test from 'node:test';
import assert from 'node:assert/strict';
import {compileCommitmentsAudit} from '../commitments/index.mjs';
import {assertEvidence} from '../../contracts/retrieval-0.2/validate.mjs';
import {fixture} from './commitments-fixture.mjs';
const compile=f=>compileCommitmentsAudit(f.input,{context:f.context,reads:f.reads});

test('exact original promise is bound with scope/version/hash and visible six-source coverage; no task mutation',()=>{
 const f=fixture();f.reads.forEach(assertEvidence);const out=compile(f),row=out.commitments[0];
 assert.equal(out.coverage.length,6);assert.equal(out.status,'covered-extraction-unverified');assert.equal(out.negativeClaimSupported,false);
 assert.equal(row.promise.verification,'bound-source-excerpt');assert.equal(row.promise.quote,'We will send the draft memo.');
 assert.equal(row.promise.recordVersionId,'v1');assert.equal(row.promise.authorizationDecisionId,f.context.subject.authorizationDecisionId);assert.deepEqual(row.promise.scopes,f.context.subject.scopes);
 assert.equal(row.owner.status,'unknown');assert.equal(row.dueDate.status,'unknown');assert.equal(row.completed,false);
 assert.equal(row.status,'no-linked-tracking-in-extracted-observations');assert.deepEqual(out.mutations,[]);assert(Object.isFrozen(out.commitments));
});

test('suggestions remain separate and exact duplicate promise origins merge without semantic merging',()=>{
 const f=fixture();f.input.observations.push({...f.input.observations[0],id:'duplicate'},f.observation('suggestion','suggestion','mail',{passage:f.quote('mail',28)}),f.observation('second-promise','promise','meetings'));
 const out=compile(f);assert.equal(out.commitments.length,2);assert.deepEqual(out.commitments[0].observationIds,['promise','duplicate']);assert.equal(out.suggestions.length,1);
 assert.equal(out.suggestions[0].classificationVerification,'requires-human-verification');assert.equal(out.suggestions[0].relatedPromiseId,null);
});

test('conflicting owner/date evidence stays conflicting, including contradictions from related tracking',()=>{
 const f=fixture();f.input.observations[0].owner='Ana';f.input.observations[0].dueDate='2026-10-20';
 f.input.observations.push(f.observation('tracking','tracking','tasks',{owner:'Bo',dueDate:'2026-10-21'}));
 const row=compile(f).commitments[0];assert.equal(row.status,'conflicting-evidence');assert.equal(row.owner.value,null);assert.equal(row.dueDate.value,null);
 assert.deepEqual(row.owner.candidates,['Ana','Bo']);assert.deepEqual(row.dueDate.candidates,['2026-10-20','2026-10-21']);assert.equal(row.completed,false);
});

test('completed native task and free-form delivery claim cannot establish delivery or acceptance',()=>{
 const f=fixture();f.input.observations.push(f.observation('tracked','tracking','tasks'),f.observation('reported','delivery-claim','client_documents'));
 const row=compile(f).commitments[0];assert.equal(row.status,'delivery-claimed-unverified');assert.equal(row.completed,false);
 assert.equal(row.deliveryClaims[0].classificationVerification,'requires-human-verification');assert.equal(row.trackingLinkVerification,'proposed-link-unverified');
 assert.equal(row.tracking[0].passage.sourceId,'tasks');assert.match(row.followUp,/completion flag is insufficient/u);
});

test('unread sources and unmapped Monday are visible and never support absence',()=>{
 const f=fixture();f.context.mondayBoardIds=[];f.reads=f.reads.filter(row=>!['meetings','client_knowledge_monday'].includes(row.sources[0].sourceId));
 const out=compile(f);assert.equal(out.status,'partial');assert.equal(out.negativeClaimSupported,false);
 assert.equal(out.coverage.find(row=>row.sourceId==='meetings').status,'not-read');assert.equal(out.coverage.find(row=>row.sourceId==='client_knowledge_monday').status,'not-mapped');
 assert.equal(out.commitments[0].untracked,true);
});

test('disconnected/unavailable mapped Monday retains source failure and continuation',()=>{
 const f=fixture(),r=f.reads.find(row=>row.sources[0].sourceId==='client_knowledge_monday');
 Object.assign(r,{status:'unavailable',reasonCode:'SOURCE_UNAVAILABLE',data:null});Object.assign(r.sources[0],{status:'unavailable',freshness:'unknown',snapshotVersionId:null,asOf:null,synchronizedAt:null});
 Object.assign(r.coverage,{sourcesChecked:[],sourcesUnavailable:['client_knowledge_monday'],enumeration:'unknown',enumerableTotal:null,returnedCount:0,historySupport:'unsupported',limitations:['Provider disconnected.']});r.continuation.remainingSources=['client_knowledge_monday'];
 const out=compile(f),cell=out.coverage.find(row=>row.sourceId==='client_knowledge_monday');assert.equal(cell.status,'unavailable');assert.deepEqual(cell.limitations,['Provider disconnected.']);assert.equal(out.status,'partial');
});

for(const [name,edit]of [
 ['foreign tenant',f=>f.reads[0].binding.tenantId='foreign'],['foreign actor',f=>f.reads[0].binding.actorId='foreign'],
 ['different conversation',f=>f.reads[0].binding.conversationId='70000000-0000-4000-8000-000000000099'],
 ['different run',f=>f.reads[0].binding.runId='70000000-0000-4000-8000-000000000099'],
 ['different attempt',f=>f.reads[0].binding.attemptId='70000000-0000-4000-8000-000000000099'],
 ['obsolete fence',f=>f.reads[0].binding.writerFence=2],['different decision',f=>f.reads[0].subject.authorizationDecisionId='70000000-0000-4000-8000-000000000099'],
 ['substituted bytes',f=>f.reads[0].data.records[0].content.text='Substituted material'],['substituted hash',f=>f.reads[0].data.records[0].contentSha256='f'.repeat(64)],
 ['snippet',f=>{f.reads[0].data.records[0].content.kind='snippet';f.reads[0].data.records[0].content.readHandle='opaque';}],
 ['future read',f=>f.reads[0].sources[0].retrievedAt='2026-10-14T12:00:00.000Z'],['unknown operation',f=>f.reads[0].operation={id:'read_bill_text',version:'0.2.0'}],
 ['other window',f=>f.reads[0].window={basis:'explicit',startInclusive:'2026-10-01T00:00:00.000Z',endExclusive:'2026-10-02T00:00:00.000Z',timezone:'Etc/UTC',weekStartsOn:null}],
 ['unmapped Monday read',f=>f.context.mondayBoardIds=[]],['wrong Monday boards',f=>f.reads.find(row=>row.sources[0].sourceId==='client_knowledge_monday').appliedFilters[0].valueSha256='f'.repeat(64)],
 ['record-version substitution',f=>f.input.observations[0].passage.recordVersionId='v2'],['quote mismatch',f=>f.input.observations[0].passage.quote='We will send a final memo.'],
 ['quote range',f=>f.input.observations[0].passage.end=999],['invented tracking source',f=>f.input.observations.push(f.observation('track','tracking','mail'))],
 ['orphan delivery link',f=>f.input.observations.push(f.observation('delivery','delivery-claim','client_documents',{relatedPromiseId:'missing'}))],
 ['invalid due date',f=>f.input.observations[0].dueDate='2026-02-30'],['duplicate ID',f=>f.input.observations.push(structuredClone(f.input.observations[0]))],
 ['duplicate source',f=>f.reads.push(structuredClone(f.reads[0]))],['model-completed property',f=>f.input.observations[0].completed=true]
])test(`refuses ${name} without a ledger`,()=>{const f=fixture();edit(f);assert.throws(()=>compile(f));});

test('accessors and extra options do not run during input admission',()=>{
 const f=fixture();let invoked=false;const raw={};Object.defineProperty(raw,'observations',{enumerable:true,get(){invoked=true;return f.input.observations;}});
 assert.throws(()=>compileCommitmentsAudit(raw,{context:f.context,reads:f.reads}));assert.equal(invoked,false);
 assert.throws(()=>compileCommitmentsAudit(f.input,{context:f.context,reads:f.reads,authorize:true}));
});
