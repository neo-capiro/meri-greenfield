/** Focused recipe tests: trusted ports only, no database, provider, renderer or route qualification.
 * The seven-section report is compiled by the recipe owner and written through the canonical artifact
 * owner with a scripted (non-native) executor; native DOCX rendering is a separate qualification. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {createCongressionalReportCompiler,admitPreparedReport,preparedReportEvidenceSha256} from '../compose.mjs';
import {bindPreparedReportArtifactOptions} from '../binding.mjs';
import {reportManifest,reportSkillPin,reportSourceIds,reportReadOperation} from '../skill.mjs';
import {REPORT_SECTIONS} from '../input.mjs';
import {artifactValidators as v,assertEvidence} from '../../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {createArtifactService} from '../../../../artifacts/service.mjs';
import {nativeDocumentFixture,sha} from '../../../../artifacts/test/native-document-fixture.mjs';
const NOW=Date.parse('2026-10-13T12:00:00.000Z'),stamp=new Date(NOW).toISOString();
const uid=n=>`10000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const digest=value=>createHash('sha256').update(value).digest('hex');
const client=uid(9),policy='report-policy-1';
const texts={bill_text:'Original independent source: Δ research 🛰 requires an authorization review. No appropriation amount is stated.',
 federal_legislation:'Independent status source: the enacted stage has not been established.'};
const subject={congress:119,session:2,billId:'119-s-88',billVersion:'is',fiscalYear:2028,budgetStage:'authorized'};
function context(){return {binding:{tenantId:'independent-report',actorId:'source-reviewer',conversationId:uid(1),runId:uid(2),attemptId:uid(3),workerId:uid(4),writerFence:1},
 scopes:[{tenantId:'independent-report',kind:'client',resourceId:client,policyRevision:policy}],evidence:[],assets:[],deadlineMs:NOW+5000,maxBytes:1048576};}
const citation=(sourceId,text=texts[sourceId])=>({sourceId,recordId:'independent-'+sourceId,sourceVersionId:'independent-version-1',start:0,end:text.length,url:'https://example.invalid/never-fetched'});
function input(at=stamp){return {skill:reportSkillPin(),title:'Independent sourced cited report',subject:structuredClone(subject),asOf:at,
 summary:'Draft summary: the authorization basis is recorded; no appropriation amount was read.',
 findings:[{id:'excerpt',kind:'excerpt',text:texts.bill_text,citations:[citation('bill_text')]},
  {id:'claim',kind:'claim',text:texts.bill_text,citations:[citation('bill_text'),citation('federal_legislation')]},
  {id:'missing',kind:'excerpt',text:'No budget evidence was read.',citations:[citation('program_elements','No budget evidence was read.')]}],
 conflicts:[{findingId:'claim',note:'Two sources describe the same stage differently.'}],
 recommendations:['Confirm the appropriations basis before committing resources.'],
 limitations:['State docket coverage is not exhaustive.']};}
function read(call){
 const available=call.sourceId!=='program_elements',content=texts[call.sourceId],sourceId=call.sourceId,observed=call.selector.asOf,citationId=randomUUID();
 const scopes=structuredClone(call.scopes),evidence=available?[{sourceId,recordId:'independent-'+sourceId,sourceVersionId:'independent-version-1',citationId,
  binding:structuredClone(call.binding),contentSha256:digest(Buffer.from(content)),scopes,observedAt:observed,sourceUpdatedAt:observed}]:[];
 const envelope={contractVersion:'0.2.0',requestId:randomUUID(),traceId:randomUUID(),operation:reportReadOperation(sourceId),binding:structuredClone(call.binding),
  subject:{kind:'client',entityType:'client',entityIds:[scopes[0].resourceId],tenantId:call.binding.tenantId,actorId:call.binding.actorId,
   policyRevision:scopes[0].policyRevision,scopes,rosterVersionId:null},
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
const compiler=readSource=>createCongressionalReportCompiler({readSource:readSource??read,now:()=>NOW});
const bodyText=p=>p.request.content.blocks.flatMap(b=>b.runs?.map(r=>r.text)??[]).join('\n');
const headings=p=>p.request.content.blocks.filter(b=>b.style==='Heading 1').map(b=>b.runs[0].text);
let renders=0;
const docxExecutor={async execute(x){renders++;const bytes=Buffer.from(JSON.stringify(x.request.content.blocks));
 return {bytes,inspection:{sha256:sha(bytes),bytes:bytes.length,format:'docx',nativeOpened:false,rendered:false,recalculated:false,members:[],details:{paragraphs:x.request.content.blocks.length,tables:0,pictures:0}}};}};

test('the accepted seven-section cited report is produced in order with citations, conflicts and limitations',async()=>{
 const calls=[],result=await compiler(call=>{calls.push(call);return read(call);}).prepare(input(),context());
 assert.deepEqual(reportSourceIds,calls.map(c=>c.sourceId));
 assert.deepEqual(headings(result),[...REPORT_SECTIONS]);
 assert.deepEqual(result.context.evidence.length,2);
 for(const item of result.context.evidence)v.nativeSourceEvidence(item);
 assert.equal(result.findings[0].status,'bound-excerpt');assert.equal(result.findings[1].status,'unverified-claim');assert.equal(result.findings[1].conflict,true);
 assert.equal(result.findings[2].status,'missing-evidence');assert.deepEqual(result.conflicts.map(c=>c.findingId),['claim']);
 assert.equal(result.findings[0].links[0].passageSha256,digest(Buffer.from(texts.bill_text)));
 assert.deepEqual(result.provenance.subject,subject);assert.deepEqual(result.provenance.skill,reportSkillPin());assert.equal(result.baseVersionId,null);
 assert.equal(result.provenance.retainedEvidenceSha256,v.hash([]));
 assert.equal(result.evidenceSha256,v.hash(result.context.evidence));
 const document=bodyText(result);
 for(const label of ['Sourced cited report | Draft for review','Congress 119 | Session 2 | 119-s-88 | Bill version is | FY 2028 | Budget stage authorized',
  'Two sources describe the same stage differently.','Conflicting passage 1: '+texts.bill_text,'Conflicting passage 2: '+texts.federal_legislation,
  'Confirm the appropriations basis before committing resources.','Stated limitation: State docket coverage is not exhaustive.','Read limitation: Independent synthetic corpus only',
  'program_elements: status unavailable','Cited passage (UTF-16 characters','locator URL (not verification)','Original skill and immutable revision provenance'])assert(document.includes(label),label);
 assert(document.includes(texts.bill_text));assert(document.includes(texts.federal_legislation));
});
test('a named conflict must attach to a finding that is genuinely in conflict',async()=>{
 const i=input();i.conflicts=[{findingId:'excerpt',note:'Not actually in conflict.'}];
 await assert.rejects(compiler().prepare(i,context()),/REPORT_CONFLICT/);
 const duplicate=input();duplicate.conflicts=[{findingId:'claim',note:'one'},{findingId:'claim',note:'two'}];
 await assert.rejects(compiler().prepare(duplicate,context()),/REPORT_CONFLICT/);
 const unknown=input();unknown.conflicts=[{findingId:'other',note:'unknown finding'}];
 await assert.rejects(compiler().prepare(unknown,context()),/REPORT_CONFLICT/);
});
for(const [label,edit]of [
 ['foreign actor',r=>r.envelope.binding.actorId='foreign'],['foreign tenant',r=>r.envelope.binding.tenantId='foreign'],
 ['other run',r=>r.envelope.binding.runId=uid(90)],['changed selector',r=>r.envelope.argumentsSha256='e'.repeat(64)],
 ['source operation',r=>r.envelope.operation=reportReadOperation('federal_legislation')],['source identity',r=>{r.envelope.sources[0].sourceId='federal_legislation';}],
 ['other evidence run',r=>r.evidence[0].binding.runId=uid(99)],['obsolete decision field',r=>r.evidence[0].authorizationDecisionId=uid(99)],
 ['raw text with retained hash',r=>r.envelope.data.records[0].content.text+=' altered'],['proof hash',r=>r.evidence[0].contentSha256='a'.repeat(64)],
 ['foreign evidence scope',r=>r.evidence[0].scopes[0].resourceId=uid(78)],['proof observed time',r=>r.evidence[0].observedAt='2026-10-13T12:00:01.000Z'],
 ['missing citation proof',r=>r.evidence=[]],['extra citation proof',r=>r.evidence.push({...r.evidence[0],citationId:uid(77)})],
])test('refusal: '+label,async()=>{
 let reads=0;await assert.rejects(compiler(call=>{reads++;const value=read(call);if(call.sourceId==='bill_text')edit(value);return value;}).prepare(input(),context()));assert.equal(reads,1);
});
test('recipe/prose/catalog pins and future as-of refuse before source dispatch',async()=>{
 for(const [mutate,expected] of [[i=>{i.skill={...i.skill,skillVersion:'9.0.0'};},0],[i=>{i.skill={...i.skill,manifestSha256:'a'.repeat(64)};},0],
  [i=>{i.asOf='2026-10-13T12:00:01.000Z';},0],[i=>{i.conflicts=[{findingId:'excerpt',note:'x'}];},reportSourceIds.length]]){
  const i=input();mutate(i);let count=0;await assert.rejects(compiler(c=>{count++;return read(c);}).prepare(i,context()));
  assert.equal(count,expected);
 }
 const prose=await readFile(new URL('../SKILL.md',import.meta.url));
 assert.equal(digest(prose),reportManifest().prose.sha256);
 assert.equal(reportManifest().prose.id,'urn:meri:original:sourced-cited-report:1.0.0');
 // No new installed public skill package is introduced here: the recipe selects the same installed
 // pin the congressional sourced brief already uses, whose installed prose and manifest are that recipe's.
 assert.deepEqual({skillId:reportManifest().skillId,skillVersion:reportManifest().skillVersion},{skillId:reportSkillPin().skillId,skillVersion:reportSkillPin().skillVersion});
 assert.equal(digest(await readFile(new URL('../../research-brief/SKILL.md',import.meta.url))),reportSkillPin().proseSha256);
 assert.equal(v.hash(JSON.parse(await readFile(new URL('../../research-brief/manifest.json',import.meta.url),'utf8'))),reportSkillPin().manifestSha256);
});
const writeCall=p=>({action:'artifact.generate',resource:{versionId:null},binding:p.context.binding,scopes:p.context.scopes,requestSha256:v.nativeRequestSha256(p.request,p.context,null)});
test('prepared guard and binder pin the exact request, context, base and retained-evidence admission',async()=>{
 const p=await compiler().prepare(input(),context()),guard=admitPreparedReport(p,p.context);
 guard({request:p.request,baseVersionId:null});
 assert.equal(preparedReportEvidenceSha256(p),p.evidenceSha256);
 const mutated=structuredClone(p.context);mutated.evidence[0].contentSha256='e'.repeat(64);assert.throws(()=>admitPreparedReport(p,mutated));
 assert.throws(()=>admitPreparedReport(structuredClone(p),p.context));
 const extra=structuredClone(p.request);extra.content.blocks.push({kind:'paragraph',runs:[{text:'Extra unsupported claim'}]});
 assert.throws(()=>guard({request:extra,baseVersionId:null}));assert.throws(()=>guard({request:p.request,baseVersionId:uid(98)}));
 let checked=0;const owner={context:p.context,authorize(){checked++;return 'canonical';}};
 const bound=bindPreparedReportArtifactOptions(p,owner),call=writeCall(p);
 assert.equal(await bound.authorize(call),'canonical');assert.equal(checked,1);
 assert.equal(bound.admitRetainedEvidence(p.context),undefined);
 assert.notEqual(bound.admitRetainedEvidence(mutated),undefined);
 const substituted=structuredClone(p.request);substituted.title='Substituted';
 for(const bad of [{...call,requestSha256:v.nativeRequestSha256(substituted,p.context,null)},{...call,binding:{...call.binding,writerFence:2}}])
  await assert.rejects(bound.authorize(bad),{code:'ACCESS_DENIED'});
 assert.equal(checked,1);
});
test('an evidence-bearing revision keeps the retained evidence and immutable parent pins through the canonical owner',async()=>{
 const f=nativeDocumentFixture({binding:context().binding,scopes:context().scopes});
 const ownerOptions=prepared=>bindPreparedReportArtifactOptions(prepared,{...f.options,executor:docxExecutor,context:prepared.context});
 const serviceFor=(prepared,{retainedAdmission=true}={})=>{const bound=ownerOptions(prepared);
  return createArtifactService({...f.options,executor:docxExecutor,...bound,...(retainedAdmission?{}:{admitRetainedEvidence:undefined}),
   ids:()=>({artifactId:randomUUID(),versionId:randomUUID(),objectId:randomUUID()})});};
 const write=async(prepared,baseVersionId=null,changes={})=>{const service=serviceFor(prepared,changes),
  options={invocation:{invocationId:'sdk:'+v.hash({deliveryId:randomUUID()}),versionId:undefined,requestSha256:v.nativeRequestSha256(prepared.request,prepared.context,baseVersionId)}};
  return baseVersionId===null?service.create(prepared.request,prepared.context,options)
   :service.revise(baseVersionId,prepared.request,prepared.context,options);};
 const first=await compiler().prepare(input(),f.context);
 const created=await write(first);
 assert.deepEqual(created.version.evidence,first.context.evidence);
 assert.equal(created.version.parentVersionId,null);
 const retained=await f.options.versions.read(created.version.versionId);
 assert.deepEqual(retained.version,created.version);assert.equal(retained.specSha256,v.hash(first.request));
 const readBase=async({versionId,signal})=>{const record=await f.options.versions.read(versionId,signal);assert.equal(record.version.versionId,versionId);return record;};
 const next=structuredClone(input());next.recommendations=['Revised independent recommendation: preserve the original and request a budget-stage source review.'];
 const selection={versionId:created.version.versionId,specSha256:retained.specSha256};
 // A revision is a different attempt of the same conversation: the parent's evidence is earlier-run
 // evidence, so the canonical owner admits it only through the bound retained-evidence admission.
 const revisionContext={...f.context,binding:{...f.context.binding,runId:uid(5),attemptId:uid(6)}};
 let dispatched=0;const countingRead=call=>{dispatched++;return read(call);};
 const before=dispatched;
 for(const bad of [{...selection,specSha256:'a'.repeat(64)}])await assert.rejects(createCongressionalReportCompiler({readSource:countingRead,readBase,now:()=>NOW}).prepare(next,f.context,{base:bad}));
 const rollback=structuredClone(next);rollback.asOf='2026-10-12T00:00:00.000Z';
 await assert.rejects(createCongressionalReportCompiler({readSource:countingRead,readBase,now:()=>NOW}).prepare(rollback,f.context,{base:selection}));
 const changedSubject=structuredClone(next);changedSubject.subject.budgetStage='appropriated';
 await assert.rejects(createCongressionalReportCompiler({readSource:countingRead,readBase,now:()=>NOW}).prepare(changedSubject,f.context,{base:selection}));
 assert.equal(dispatched,before);
 // A revision may not re-present the parent's evidence under the same citation identity.
 const clash=call=>{const value=read(call);if(value.evidence[0]){const id=created.version.evidence[0].citationId;value.evidence[0].citationId=id;value.envelope.data.records[0].citationId=id;}return value;};
 await assert.rejects(createCongressionalReportCompiler({readSource:clash,readBase,now:()=>NOW}).prepare(next,revisionContext,{base:selection}),/REPORT_RETAINED_EVIDENCE/);
 const second=await createCongressionalReportCompiler({readSource:read,readBase,now:()=>NOW}).prepare(next,revisionContext,{base:selection});
 assert.equal(second.context.binding.runId,revisionContext.binding.runId);
 assert.equal(second.context.evidence[0].binding.runId,f.context.binding.runId);
 assert.equal(second.context.evidence[second.retainedEvidence.length].binding.runId,revisionContext.binding.runId);
 assert.deepEqual(second.provenance.parent,{versionId:created.version.versionId,objectSha256:created.version.object.sha256,specSha256:retained.specSha256,provenanceSha256:v.hash(first.provenance)});
 assert.deepEqual(second.retainedEvidence,created.version.evidence);
 assert.deepEqual(second.context.evidence.slice(0,created.version.evidence.length),created.version.evidence);
 assert.equal(second.provenance.retainedEvidenceSha256,v.hash(second.retainedEvidence));
 assert.ok(bodyText(second).includes('Retained source evidence (immutable parent)'));
 // Without the bound retained-evidence admission the same revision cannot be written at all.
 await assert.rejects(write(second,created.version.versionId,{retainedAdmission:false}),{code:'ARTIFACT_EVIDENCE_BINDING'});
 const revised=await write(second,created.version.versionId);
 assert.deepEqual(revised.version.evidence,second.context.evidence);
 assert.equal(revised.version.parentVersionId,created.version.versionId);assert.equal(revised.version.artifactId,created.version.artifactId);
 assert.notEqual(revised.version.object.sha256,created.version.object.sha256);
 const again=await f.options.versions.read(created.version.versionId);
 assert.deepEqual(again.version,created.version);assert.deepEqual(again.specSha256,retained.specSha256);
 // A source revocation at release authority: the replacement was executed but cannot be committed,
 // so the caller gets an unknown effect and every already-committed version stays exactly as it was.
 const beforeCount=renders;
 f.state.executorHook=()=>{f.state.denied=true;};
 await assert.rejects(write(second,created.version.versionId),{code:'ARTIFACT_EFFECT_UNKNOWN'});
 assert.equal(renders,beforeCount+1);
 f.state.executorHook=null;f.state.denied=false;
 const survivors=await f.options.versions.read(revised.version.versionId);
 assert.deepEqual(survivors.version,revised.version);
});
