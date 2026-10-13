import test from 'node:test';
import assert from 'node:assert/strict';
import {createCongressionalBriefCompiler,admitPreparedBrief} from '../research-brief/compose.mjs';
import {briefManifest,briefSkillPin} from '../research-brief/skill.mjs';
import {syntheticRead,syntheticInput,syntheticText} from '../research-brief/local/synthetic.mjs';
import {createLocalDocumentFixture} from '../local/fixture.mjs';
import {mountLocalDocumentApplication} from '../local/mount.mjs';
const NOW=Date.parse('2026-10-13T12:00:00.000Z'),stamp=new Date(NOW).toISOString();
const scope={tenantId:'synthetic',kind:'client',resourceId:'00000000-0000-4000-8000-000000000009',policyRevision:'1'};
const context=()=>({binding:{tenantId:'synthetic',actorId:'actor',conversationId:'00000000-0000-4000-8000-000000000001',runId:'00000000-0000-4000-8000-000000000002',attemptId:'00000000-0000-4000-8000-000000000003',workerId:'00000000-0000-4000-8000-000000000004',writerFence:1},scopes:[scope],evidence:[],assets:[],deadlineMs:NOW+2000,maxBytes:1048576});
const compiler=readSource=>createCongressionalBriefCompiler({readSource:readSource??syntheticRead,now:()=>NOW});
test('decisive reads bind exact excerpts, preserve bases, disclose missing/conflicting evidence and keep cited prose unverified',async()=>{
  const result=await compiler().prepare(syntheticInput(stamp),context());
  assert.equal(result.facts[0].status,'bound-excerpt');assert.equal(result.facts[1].status,'unverified-claim');assert.equal(result.facts[1].conflict,true);assert.equal(result.facts[2].status,'missing-evidence');
  assert.equal(result.context.evidence.length,2);assert.deepEqual(result.provenance.subject,syntheticInput(stamp).subject);
  const text=result.request.content.blocks.flatMap(x=>x.runs?.map(y=>y.text)??[]).join('\n');
  for(const label of ['Proposed language','Coverage and verification appendix','Full text SHA256','Passage SHA256','Source as-of','Scope:','program_elements: unavailable','conflicting cited passages','locator URL (not verification)'])assert.ok(text.includes(label),label);
  const guard=admitPreparedBrief(result,result.context);guard({request:result.request,baseVersionId:null});
  const changed=structuredClone(result.request);changed.content.blocks[4].runs[0].text='verified';assert.throws(()=>guard({request:changed,baseVersionId:null}));
  assert.throws(()=>guard({request:result.request,baseVersionId:'changed'}));assert.throws(()=>admitPreparedBrief({...result},result.context));
});
for(const [label,mutate]of[
  ['free-form text equal to cited quote stays unverified',i=>{i.facts[0].kind='claim';}],
  ['quote differs',i=>{i.facts[0].text='A different claim';}],
  ['wrong source version',i=>{i.facts[0].citations[0].sourceVersionId='latest';}],
  ['out-of-range passage',i=>{i.facts[0].citations[0].end=10000;}],
])test(label,async()=>{const i=syntheticInput(stamp);mutate(i);const r=await compiler().prepare(i,context());assert.notEqual(r.facts[0].status,'bound-excerpt');});
for(const [label,mutate]of[
  ['altered source hash',r=>{r.evidence[0].contentSha256='a'.repeat(64);}],
  ['foreign tenant',r=>{r.envelope.binding.tenantId='other';}],
  ['wrong selector hash',r=>{r.envelope.argumentsSha256='a'.repeat(64);}],
  ['wrong source scope',r=>{r.evidence[0].scopes[0].resourceId='foreign';}],
  ['source version substitution',r=>{r.evidence[0].sourceVersionId='new';}],
  ['candidate snippet',r=>{r.envelope.method='candidate-search';r.envelope.data.kind='candidates';r.envelope.data.records[0].content={kind:'snippet',text:'snippet',readHandle:'read-me'};r.envelope.continuation.requiredReads=['read-me'];r.envelope.coverage.enumerableTotal=null;r.envelope.coverage.enumeration='partial';r.envelope.status='partial';r.envelope.reasonCode='PARTIAL_COVERAGE';}],
  ['Congress/session filter substitution',r=>{r.envelope.appliedFilters=r.envelope.appliedFilters.filter(x=>x.name!=='session');}],
])test('refuse '+label,async()=>{await assert.rejects(compiler(call=>{const r=syntheticRead(call);if(call.sourceId==='bill_text')mutate(r);return r;}).prepare(syntheticInput(stamp),context()));});
test('stale source remains a stale bound excerpt',async()=>{const r=await compiler(call=>{const r=syntheticRead(call);if(call.sourceId==='bill_text'){r.envelope.sources[0].freshness='stale';r.envelope.status='partial';r.envelope.reasonCode='STALE_SOURCE';}return r;}).prepare(syntheticInput(stamp),context());assert.equal(r.facts[0].status,'bound-excerpt-stale');});
test('wrong immutable recipe/version and changed budget/legislative basis are refused',async()=>{
  for(const change of[i=>i.skill.skillVersion='2.0.0',i=>i.skill.manifestSha256='a'.repeat(64),i=>i.subject.billId='118-hr-4242',i=>i.subject.session=3,i=>i.subject.budgetStage='enacted']){const i=syntheticInput(stamp);change(i);await assert.rejects(compiler().prepare(i,context()));}
});
test('parked source read is bounded; cancelled preparation returns no prepared request',async()=>{
  let at=NOW;const c=createCongressionalBriefCompiler({readSource:()=>new Promise(()=>{}),now:()=>at});const ctx=context();ctx.deadlineMs=NOW+30;
  const run=c.prepare(syntheticInput(stamp),ctx);at=NOW+50;await assert.rejects(run,/DEADLINE/);
  const control=new AbortController();control.abort();await assert.rejects(compiler().prepare(syntheticInput(stamp),context(),{signal:control.signal}),/CANCELLED/);
});
test('actual canonical routes guard approved full request, retain original and revise exact selected DOCX base',async t=>{
  const f=await createLocalDocumentFixture({mode:'synthetic-local',pythonExecutable:process.env.MERI_DOCUMENT_PYTHON??'/opt/codex/runtimes/codex-primary-runtime/dependencies/python/bin/python3',skillManifest:briefManifest()});t.after(()=>f.close());
  const c=createCongressionalBriefCompiler({readSource:syntheticRead,now:f.now,readBase:async({versionId,signal})=>f.artifactOptions.versions.read(versionId,signal)});
  const input=syntheticInput(new Date(f.now()).toISOString()),first=await c.prepare(input,f.artifactOptions.context);
  let app=mountLocalDocumentApplication({...f,artifactOptions:{...f.artifactOptions,context:first.context}},{researchBrief:first});
  const session=await f.sessions.issue({identityCredential:f.nativeCredential});
  const call=(route,body)=>app.handle(new Request('https://fixture.invalid/api/documents/'+route,{method:'POST',headers:{authorization:'Bearer '+session.credential,'content-type':'application/json'},body:JSON.stringify(body)}));
  const bad=structuredClone(first.request);bad.content.blocks[0].runs[0].text='Unapproved';assert.equal((await call('create',{deliveryId:'forged',request:bad})).status,400);assert.equal(f.stats().generations,0);
  const response=await call('create',{deliveryId:'first',request:first.request});assert.equal(response.status,200);const a=await response.json();
  const original=Buffer.from(await (await call('download',{versionId:a.version.versionId})).arrayBuffer()),snapshot=await f.artifactOptions.versions.read(a.version.versionId);
  const next=syntheticInput(new Date(f.now()).toISOString());next.proposedLanguage=['Revised proposal: require appropriations confirmation and independent source review.'];
  for(const change of[b=>b.specSha256='a'.repeat(64),b=>b.versionId='00000000-0000-4000-8000-000000000077']){const b={versionId:a.version.versionId,specSha256:snapshot.specSha256};change(b);await assert.rejects(c.prepare(next,first.context,{base:b}));}
  const wrongBasis=structuredClone(next);wrongBasis.subject.billVersion='enr';await assert.rejects(c.prepare(wrongBasis,first.context,{base:{versionId:a.version.versionId,specSha256:snapshot.specSha256}}));
  const second=await c.prepare(next,first.context,{base:{versionId:a.version.versionId,specSha256:snapshot.specSha256}});
  app=mountLocalDocumentApplication({...f,artifactOptions:{...f.artifactOptions,context:second.context}},{researchBrief:second});
  const revised=await call('revise',{deliveryId:'second',baseVersionId:a.version.versionId,request:second.request});assert.equal(revised.status,200);const b=await revised.json();
  assert.equal(b.version.parentVersionId,a.version.versionId);
  assert.deepEqual(Buffer.from(await (await call('download',{versionId:a.version.versionId})).arrayBuffer()),original);
  assert.deepEqual(a.version.evidence,first.context.evidence);assert.deepEqual(b.version.evidence,second.context.evidence);
  assert.equal(f.stats().manifestSha256,briefSkillPin().manifestSha256);assert.equal(f.stats().consumedMicroUsd,'20');
  f.revoke();assert.notEqual((await call('download',{versionId:a.version.versionId})).status,200);assert.equal(f.stats().generations,2);
});
