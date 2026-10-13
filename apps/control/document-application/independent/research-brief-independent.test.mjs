/** Independent source/effect controls: original corpus and canonical local owners; no native DB or source. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {readFile,access} from 'node:fs/promises';
import {createCongressionalBriefCompiler,admitPreparedBrief} from '../research-brief/compose.mjs';
import {bindPreparedBriefArtifactOptions} from '../research-brief/binding.mjs';
import {briefManifest,briefSkillPin,briefSourceIds,briefReadOperation} from '../research-brief/skill.mjs';
import {artifactValidators as v,assertEvidence} from '../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {createLocalDocumentFixture} from '../local/fixture.mjs';
import {mountLocalDocumentApplication} from '../local/mount.mjs';

const NOW=Date.parse('2026-10-13T12:00:00.000Z'),stamp=new Date(NOW).toISOString();
const uid=n=>`10000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const digest=value=>createHash('sha256').update(value).digest('hex');
const client=uid(9),policy='independent-policy-1';
const texts={bill_text:'Original independent source: Δ research 🛰 requires an authorization review. No appropriation amount is stated.',
 federal_legislation:'Independent status source: the enacted stage has not been established.'};
const subject={congress:119,session:2,billId:'119-s-88',billVersion:'is',fiscalYear:2028,budgetStage:'authorized'};
function context(){return {binding:{tenantId:'independent-brief',actorId:'source-reviewer',conversationId:uid(1),runId:uid(2),attemptId:uid(3),workerId:uid(4),writerFence:1},
 scopes:[{tenantId:'independent-brief',kind:'client',resourceId:client,policyRevision:policy}],evidence:[],assets:[],deadlineMs:NOW+5000,maxBytes:1048576};}
const citation=(sourceId,text=texts[sourceId])=>({sourceId,recordId:'independent-'+sourceId,sourceVersionId:'independent-version-1',start:0,end:text.length,url:'https://example.invalid/never-fetched'});
function input(at=stamp){return {skill:briefSkillPin(),title:'Independent evidence brief',subject:structuredClone(subject),asOf:at,
 facts:[{id:'excerpt',kind:'excerpt',text:texts.bill_text,citations:[citation('bill_text')]},
 {id:'claim',kind:'claim',text:texts.bill_text,citations:[citation('bill_text'),citation('federal_legislation')]},
 {id:'missing',kind:'excerpt',text:'No budget evidence was read.',citations:[citation('program_elements','No budget evidence was read.')]}],
 proposedLanguage:['Draft proposal: establish both the authorization and appropriations basis before committing resources.']};}
function read(call){
 const available=call.sourceId!=='program_elements',content=texts[call.sourceId],sourceId=call.sourceId,observed=call.selector.asOf,decision=uid(20),citationId=uid(sourceId==='bill_text'?21:22);
 const scopes=structuredClone(call.scopes),evidence=available?[{sourceId,recordId:'independent-'+sourceId,sourceVersionId:'independent-version-1',citationId,
  authorizationDecisionId:decision,contentSha256:digest(Buffer.from(content)),scopes,observedAt:observed,sourceUpdatedAt:observed}]:[];
 const envelope={contractVersion:'0.2.0',requestId:randomUUID(),traceId:randomUUID(),operation:briefReadOperation(sourceId),binding:structuredClone(call.binding),
  subject:{kind:'client',entityType:'client',entityIds:[scopes[0].resourceId],tenantId:call.binding.tenantId,actorId:call.binding.actorId,
   authorizationDecisionId:decision,policyRevision:scopes[0].policyRevision,scopes,rosterVersionId:null},
  window:{basis:'unbounded'},argumentsSha256:v.hash(call.selector),appliedFilters:Object.entries(call.selector.subject).map(([k,value])=>({name:k.replace(/[A-Z]/g,x=>'_'+x.toLowerCase()),valueSha256:v.hash(value)})),
  method:'source-read',status:available?'complete':'unavailable',reasonCode:available?'OK':'SOURCE_UNAVAILABLE',retryable:false,
  sources:[{sourceId,authority:'derived',snapshotVersionId:available?'independent-snapshot-1':null,adapterVersion:'1.0.0',status:available?'checked':'unavailable',
   synchronizedAt:available?observed:null,asOf:available?observed:null,retrievedAt:observed,freshness:available?'fresh':'unknown'}],
  data:available?{kind:'source-read',records:[{sourceId,recordId:evidence[0].recordId,recordVersionId:evidence[0].sourceVersionId,citationId,
   contentSha256:evidence[0].contentSha256,scopes,content:{kind:'full-read',text:content}}]}:null,
  coverage:{sourcesRequested:[sourceId],sourcesChecked:available?[sourceId]:[],sourcesUnavailable:available?[]:[sourceId],enumeration:available?'complete':'unknown',
   enumerableTotal:available?1:null,returnedCount:available?1:0,truncated:false,historySupport:available?'supported':'unsupported',limitations:['Independent synthetic corpus only; actual completeness unproven.']},
  continuation:{cursor:null,requiredReads:[],remainingSources:available?[]:[sourceId]},negativeAssertion:{kind:'none'}};
 assertEvidence(envelope);return {envelope,evidence};
}
const compiler=readSource=>createCongressionalBriefCompiler({readSource:readSource??read,now:()=>NOW});
const bodyText=p=>p.request.content.blocks.flatMap(b=>b.runs?.map(r=>r.text)??[]).join('\n');

test('independent source IDs, exact Unicode passage bytes and honest claim/coverage semantics',async()=>{
 const calls=[],result=await compiler(call=>{calls.push(call);return read(call);}).prepare(input(),context());
 assert.deepEqual(calls.map(c=>c.sourceId),['bill_text','federal_legislation','program_elements']);
 assert.deepEqual(briefSourceIds,calls.map(c=>c.sourceId));
 assert.equal(result.facts[0].status,'bound-excerpt');assert.equal(result.facts[1].status,'unverified-claim');assert.equal(result.facts[1].conflict,true);
 assert.equal(result.facts[2].status,'missing-evidence');assert.equal(result.context.evidence.length,2);
 assert.equal(result.facts[0].links[0].passageSha256,digest(Buffer.from(texts.bill_text)));
 assert.deepEqual(result.provenance.subject,subject);assert.deepEqual(result.provenance.skill,briefSkillPin());assert.equal(result.baseVersionId,null);
 const document=bodyText(result);for(const label of ['locator URL (not verification)','potentially conflicting cited passages','program_elements: unavailable','returned 0','remaining sources program_elements',
  'Congress 119 | Session 2 | 119-s-88 | Bill version is | FY 2028 | Budget stage authorized','Cited passage (UTF-16 characters','authorization decision','Original skill and immutable revision provenance'])assert(document.includes(label),label);
 assert(document.includes(texts.bill_text));assert(document.includes(texts.federal_legislation));
});

for(const [label,edit]of [
 ['foreign actor',r=>r.envelope.binding.actorId='foreign'],['foreign tenant',r=>r.envelope.binding.tenantId='foreign'],
 ['other run',r=>r.envelope.binding.runId=uid(90)],['other attempt',r=>r.envelope.binding.attemptId=uid(91)],['other fence',r=>r.envelope.binding.writerFence=2],
 ['changed selector',r=>r.envelope.argumentsSha256='e'.repeat(64)],['source operation',r=>r.envelope.operation=briefReadOperation('federal_legislation')],
 ['source identity',r=>{r.envelope.sources[0].sourceId='federal_legislation';}],['authorization decision',r=>r.evidence[0].authorizationDecisionId=uid(99)],
 ['source version',r=>r.evidence[0].sourceVersionId='independent-version-2'],['record identity',r=>r.evidence[0].recordId='other-record'],
 ['raw text with retained hash',r=>r.envelope.data.records[0].content.text+=' altered'],['proof hash',r=>r.evidence[0].contentSha256='a'.repeat(64)],
 ['record hash',r=>r.envelope.data.records[0].contentSha256='b'.repeat(64)],
 ['foreign evidence scope',r=>r.evidence[0].scopes[0].resourceId=uid(78)],['foreign client subject',r=>r.envelope.subject.entityIds=[uid(79)]],
 ['proof observed time',r=>r.evidence[0].observedAt='2026-10-13T12:00:01.000Z'],['proof update later than observed',r=>r.evidence[0].sourceUpdatedAt='2026-10-13T12:00:01.000Z'],
 ['future retrieval',r=>{r.envelope.sources[0].retrievedAt='2026-10-13T12:00:01.000Z';r.evidence[0].observedAt='2026-10-13T12:00:01.000Z';}],
 ['missing citation proof',r=>r.evidence=[]],['extra citation proof',r=>r.evidence.push({...r.evidence[0],citationId:uid(77)})],
])test('independent refusal: '+label,async()=>{
 let reads=0;await assert.rejects(compiler(call=>{reads++;const value=read(call);if(call.sourceId==='bill_text')edit(value);return value;}).prepare(input(),context()));assert.equal(reads,1);
});
for(const field of ['congress','session','billId','billVersion','fiscalYear','budgetStage'])test('exact subject read filter cannot omit or replace '+field,async()=>{
 for(const mutation of ['omit','replace'])await assert.rejects(compiler(call=>{const r=read(call);if(call.sourceId==='bill_text'){
  const name=field.replace(/[A-Z]/g,x=>'_'+x.toLowerCase());if(mutation==='omit')r.envelope.appliedFilters=r.envelope.appliedFilters.filter(f=>f.name!==name);else r.envelope.appliedFilters.find(f=>f.name===name).valueSha256='f'.repeat(64);
 }return r;}).prepare(input(),context()));
});
test('canonical candidate envelope cannot serve as a decisive full read',async()=>{
 let candidate;await assert.rejects(compiler(call=>{const r=read(call);if(call.sourceId==='bill_text'){
  const e=r.envelope;e.method='candidate-search';e.status='partial';e.reasonCode='PARTIAL_COVERAGE';e.data.kind='candidates';
  e.data.records[0].content={kind:'snippet',text:texts.bill_text,readHandle:'independent-followup'};e.coverage.enumeration='partial';e.coverage.enumerableTotal=null;e.continuation.requiredReads=['independent-followup'];
  assertEvidence(e);candidate=e;
 }return r;}).prepare(input(),context()));assert.equal(candidate.method,'candidate-search');
});
test('partial/stale coverage remains visible and never changes free-form verification',async()=>{
 const result=await compiler(call=>{const r=read(call);if(call.sourceId==='bill_text'){
  const e=r.envelope;e.status='partial';e.reasonCode='STALE_SOURCE';e.sources[0].freshness='stale';e.sources[0].status='partial';e.coverage.enumeration='partial';e.coverage.enumerableTotal=null;e.coverage.truncated=true;
  e.continuation.cursor='independent-more';e.continuation.remainingSources=['bill_text'];e.coverage.limitations=['Requested corpus remains incomplete.'];assertEvidence(e);
 }return r;}).prepare(input(),context());
 assert.equal(result.facts[0].status,'bound-excerpt-stale');assert.equal(result.facts[1].status,'unverified-claim');
 for(const expected of ['freshness stale','enumeration partial','truncated true','Continuation independent-more','Requested corpus remains incomplete.'])assert(bodyText(result).includes(expected),expected);
});
test('decisive subject filters cannot contain contradictory exact-version assertions',async()=>{
 await assert.rejects(compiler(call=>{const r=read(call);if(call.sourceId==='bill_text'){
  r.envelope.appliedFilters.push({name:'bill_version',valueSha256:v.hash('enr')});assertEvidence(r.envelope);
 }return r;}).prepare(input(),context()));
});
test('missing immutable citation version and false excerpt keep explicit negative statuses',async()=>{
 for(const [mutate,status]of [[i=>i.facts[0].citations[0].sourceVersionId='different-version','missing-evidence'],[i=>i.facts[0].text='Unsupported quotation','quote-mismatch'],[i=>i.facts[0].citations[0].end+=100,'missing-evidence']]){
  const i=input();mutate(i);const p=await compiler().prepare(i,context());assert.equal(p.facts[0].status,status);assert(bodyText(p).includes(status));
 }
});
test('untrusted input getter and Proxy execute no traps',async()=>{
 let traps=0;const i=input();Object.defineProperty(i,'title',{get(){traps++;throw Error('trap');},enumerable:true});await assert.rejects(compiler().prepare(i,context()));
 await assert.rejects(compiler().prepare(new Proxy(input(),{ownKeys(){traps++;throw Error('trap');}}),context()));assert.equal(traps,0);
});
test('recipe/prose/catalog pins and future as-of refuse before source dispatch',async()=>{
 for(const mutate of [i=>i.skill.skillVersion='9.0.0',i=>i.skill.manifestSha256='a'.repeat(64),i=>i.skill.proseSha256='b'.repeat(64),i=>i.skill.catalogSha256='c'.repeat(64),i=>i.asOf='2026-10-13T12:00:01.000Z']){
  const i=input();mutate(i);let count=0;await assert.rejects(compiler(c=>{count++;return read(c);}).prepare(i,context()));assert.equal(count,0);
 }
 const prose=await readFile(new URL('../research-brief/SKILL.md',import.meta.url));assert.equal(digest(prose),briefSkillPin().proseSha256);assert.equal(v.hash(briefManifest()),briefSkillPin().manifestSha256);
});
test('prepared guard captures immutable authority context and exact full request identity',async()=>{
 const p=await compiler().prepare(input(),context()),guard=admitPreparedBrief(p,p.context);guard({request:p.request,baseVersionId:null});
 const c=structuredClone(p.context);c.evidence[0].contentSha256='e'.repeat(64);assert.throws(()=>admitPreparedBrief(p,c));assert.throws(()=>admitPreparedBrief(structuredClone(p),p.context));
 const r=structuredClone(p.request);r.content.blocks.push({kind:'paragraph',runs:[{text:'Extra unsupported claim'}]});assert.throws(()=>guard({request:r,baseVersionId:null}));assert.throws(()=>guard({request:p.request,baseVersionId:uid(98)}));
});
test('preabort and parked source cancellation release no prepared result or subsequent reads',async()=>{
 const aborted=new AbortController();aborted.abort();let count=0;await assert.rejects(compiler(c=>{count++;return read(c);}).prepare(input(),context(),{signal:aborted.signal}));assert.equal(count,0);
 const control=new AbortController();let entered;const ready=new Promise(r=>entered=r);
 const pending=compiler(()=>{count++;entered();return new Promise(()=>{});}).prepare(input(),context(),{signal:control.signal});await ready;control.abort();await assert.rejects(pending,/CANCELLED/);assert.equal(count,1);
});
test('private binder preserves the original borrowed authority receiver and call resource',async()=>{
 const p=await compiler().prepare(input(),context()),call={input:{request:p.request,context:p.context,baseVersionId:null},credential:'synthetic-only',signal:new AbortController().signal};
 let checked=0;const result={acceptedByOriginalOwner:true},authority={check(value){assert.equal(this,authority);assert.equal(value,call);checked++;return result;},identify(){throw Error('Not a policy lookup during binding');}};
 const options={context:p.context,authority},bound=bindPreparedBriefArtifactOptions(p,options);assert.equal(checked,0);assert.equal(bound.context,options.context);
 assert.equal(await bound.authority.check(call),result);assert.equal(checked,1);
});
test('private binder must pin context digest even if returned prepared context mutates after binding',async()=>{
 const p=await compiler().prepare(input(),context());let checked=0;
 const bound=bindPreparedBriefArtifactOptions(p,{context:p.context,authority:{check(){checked++;return {accepted:true};}}});
 p.context.evidence[0].contentSha256='e'.repeat(64);
 await assert.rejects(bound.authority.check({input:{request:p.request,context:bound.context,baseVersionId:null}}),e=>e.code==='ACCESS_DENIED');assert.equal(checked,0);
});

test('independent authorized exact-base create/revise/inspect/download isolation revocation and cleanup',async t=>{
 const f=await createLocalDocumentFixture({mode:'synthetic-local',pythonExecutable:'/opt/codex/runtimes/codex-primary-runtime/dependencies/python/bin/python3',skillManifest:briefManifest()});
 let g;t.after(async()=>{await f.close();await g?.close();assert.equal(f.stats().cleanup.executorDirectoriesAbsent,true);assert.equal(f.stats().cleanup.storeRemoved,true);await assert.rejects(access(f.directory));});
 const session=await f.sessions.issue({identityCredential:f.nativeCredential});let app;
 const post=(route,body,credential=session.credential)=>app.handle(new Request('https://independent.invalid/api/documents/'+route,{method:'POST',headers:{authorization:'Bearer '+credential,'content-type':'application/json'},body:JSON.stringify(body)}));
 const response=async p=>{const r=await p,b=await r.json();assert.equal(r.status,200,JSON.stringify(b));return b;};
 let sourceCalls=0,baseInspects=0;
 const compile=createCongressionalBriefCompiler({now:f.now,readSource:async call=>{
  sourceCalls++;const authenticated=await f.sessions.authenticateSession({credential:session.credential,deadlineMs:call.deadlineMs,signal:call.signal});
  await f.sessions.readCurrentState({authentication:authenticated,deadlineMs:call.deadlineMs,signal:call.signal});return read(call);
 },readBase:async({versionId,signal})=>{const inspected=await response(post('inspect',{versionId}));baseInspects++;const retained=await f.artifactOptions.versions.read(versionId,signal);assert.deepEqual(retained.version,inspected.version);return retained;}});
 const i=input(new Date(f.now()).toISOString()),first=await compile.prepare(i,f.artifactOptions.context);
 const configure=p=>{app=mountLocalDocumentApplication({...f,artifactOptions:{...f.artifactOptions,context:p.context}},{researchBrief:p});};configure(first);
 const changed=structuredClone(first.request);changed.content.blocks[0].runs[0].text='Hostile title';const denied=await post('create',{deliveryId:'altered',request:changed});assert.equal(denied.status,403);const deniedBody=await denied.json();assert.equal(deniedBody.error.code,'ACCESS_DENIED');assert.equal(deniedBody.error.outcome,'UNKNOWN');assert.equal(f.stats().generations,0);assert.equal(f.stats().versionCharges,0);assert.equal(f.stats().settled,0);assert.equal(f.stats().unknown,0);
 const original=await response(post('create',{deliveryId:'independent-create',request:first.request})),record=await f.artifactOptions.versions.read(original.version.versionId);
 const before=Buffer.from(await (await post('download',{versionId:original.version.versionId})).arrayBuffer());assert.equal(digest(before),original.version.object.sha256);
 const next=input(new Date(f.now()).toISOString());next.proposedLanguage=['Revised independent proposal: preserve the original and request a budget-stage source review.'];
 const selection={versionId:original.version.versionId,specSha256:record.specSha256};
 const beforeWrong=sourceCalls;await assert.rejects(compile.prepare(next,first.context,{base:{...selection,specSha256:'a'.repeat(64)}}));assert.equal(sourceCalls,beforeWrong);
 for(const [key,value]of Object.entries({session:1,billVersion:'enr',fiscalYear:2029,budgetStage:'appropriated'})){
  const other=structuredClone(next);other.subject[key]=value;await assert.rejects(compile.prepare(other,first.context,{base:selection}));
 }
 const rollback=structuredClone(next);rollback.asOf='2026-10-12T00:00:00.000Z';await assert.rejects(compile.prepare(rollback,first.context,{base:selection}));
 const second=await compile.prepare(next,first.context,{base:selection});assert.equal(second.provenance.parent.objectSha256,original.version.object.sha256);assert.equal(second.provenance.parent.specSha256,record.specSha256);assert(baseInspects>=7);configure(second);
 const beforeWrongParent=f.stats();assert.equal((await post('revise',{deliveryId:'wrong-parent',baseVersionId:uid(98),request:second.request})).status,403);assert.equal(f.stats().generations,beforeWrongParent.generations);assert.equal(f.stats().versionCharges,beforeWrongParent.versionCharges);
 const revised=await response(post('revise',{deliveryId:'independent-revise',baseVersionId:selection.versionId,request:second.request}));
 assert.equal(revised.version.parentVersionId,selection.versionId);assert.equal(revised.version.artifactId,original.version.artifactId);assert.notEqual(revised.version.object.sha256,original.version.object.sha256);
 configure(second);for(const version of [original.version,revised.version]){const inspected=await response(post('inspect',{versionId:version.versionId}));assert.deepEqual(inspected.version,version);assert.equal(inspected.inspection.currentBytesVerified,true);
  const download=await post('download',{versionId:version.versionId});assert.equal(download.status,200);const bytes=Buffer.from(await download.arrayBuffer());assert.equal(bytes.length,version.object.bytes);assert.equal(digest(bytes),version.object.sha256);if(version===original.version)assert.deepEqual(bytes,before);}
 assert.notEqual((await post('revise',{deliveryId:'independent-revise',baseVersionId:selection.versionId,request:second.request})).status,200);assert.equal(f.stats().generations,2);
 g=await createLocalDocumentFixture({mode:'synthetic-local',pythonExecutable:'/opt/codex/runtimes/codex-primary-runtime/dependencies/python/bin/python3'});
 const foreign=await g.sessions.issue({identityCredential:g.nativeCredential});assert.notEqual((await post('download',{versionId:selection.versionId},foreign.credential)).status,200);
 const otherApp=mountLocalDocumentApplication(g),otherRequest=cred=>new Request('https://independent.invalid/api/documents/download',{method:'POST',headers:{authorization:'Bearer '+cred,'content-type':'application/json'},body:JSON.stringify({versionId:selection.versionId})});
 assert.notEqual((await otherApp.handle(otherRequest(session.credential))).status,200);assert.notEqual((await otherApp.handle(otherRequest(foreign.credential))).status,200);
 f.revoke();for(const route of ['inspect','download'])for(const version of [original.version,revised.version])assert.notEqual((await post(route,{versionId:version.versionId})).status,200);
 await assert.rejects(compile.prepare(next,second.context));assert.notEqual((await post('revise',{deliveryId:'after-revocation',baseVersionId:selection.versionId,request:second.request})).status,200);
 assert.equal(f.stats().generations,2);assert.equal(f.stats().settled,2);assert.equal(f.stats().unknown,0);assert.equal(f.stats().consumedMicroUsd,'20');
 for(const receipt of f.stats().processReceipts){assert.equal(receipt.groupAbsent,true);assert.equal(receipt.leaderClosed,true);}
});
