/** Focused recipe tests: trusted ports only — no database, provider, renderer, route or model call.
 * The general cited report is compiled by this recipe over gateway-owned decisive reads; the revision is
 * written through the canonical artifact owner with a scripted (non-native) executor. Native DOCX
 * rendering and Meri semantic evaluation are separate qualifications and are not claimed here. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {createCitedReportCompiler,admitPreparedCitedReport,preparedCitedReportEvidenceSha256} from '../compose.mjs';
import {bindPreparedCitedReportArtifactOptions} from '../binding.mjs';
import {citedReportManifest,citedReportSkillPin,citedReportSourceIds,citedReportReadOperation,citedReportCatalogPin} from '../skill.mjs';
import {CITED_REPORT_SECTIONS,selectorSubject} from '../input.mjs';
import {REPORT_SECTIONS} from '../../report-brief/input.mjs';
import {artifactValidators as v,assertEvidence} from '../../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {selectSkill} from '../../../../../packages/skills/index.mjs';
import {createArtifactService} from '../../../../artifacts/service.mjs';
import {nativeDocumentFixture,sha} from '../../../../artifacts/test/native-document-fixture.mjs';
const NOW=Date.parse('2026-10-28T12:00:00.000Z'),stamp=new Date(NOW).toISOString();
const uid=n=>`10000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const digest=value=>createHash('sha256').update(value).digest('hex');
const policy='cited-report-policy-1',actor='source-reviewer',client=uid(9);
const texts={client_knowledge_search:'Independent client knowledge record: the engagement review is scheduled for the fourth quarter and no amount is committed.',
 mail:'Independent stored mail: the client confirmed the review window in writing; no approval was granted.',
 research_portfolios:'Independent research portfolio evidence: the tracked position was re-reviewed with no rating change.'};
const scope=(kind,resourceId)=>({tenantId:'general-cited-report',kind,resourceId,policyRevision:policy});
const structures={
 client:()=>({subject:{kind:'client',entityType:'client',entityIds:[client],rosterVersionId:null,tenantId:'general-cited-report',actorId:actor,policyRevision:policy,scopes:[scope('client',client)]}}),
 portfolio:()=>({subject:{kind:'portfolio',entityType:'client',entityIds:[client,'independent-client-2'],rosterVersionId:'independent-roster-1',tenantId:'general-cited-report',actorId:actor,policyRevision:policy,scopes:[scope('client',client),scope('client','independent-client-2')]}}),
 personal:()=>({subject:{kind:'personal',entityType:'user',entityIds:[actor],rosterVersionId:null,tenantId:'general-cited-report',actorId:actor,policyRevision:policy,scopes:[scope('private-user',actor)]}})};
function context(overrides={}){return {binding:{tenantId:'general-cited-report',actorId:actor,conversationId:uid(1),runId:uid(2),attemptId:uid(3),workerId:uid(4),writerFence:1},
 scopes:structures.client().subject.scopes,evidence:[],assets:[],deadlineMs:NOW+5000,maxBytes:1048576,...overrides};}
const selection=(kind='client',overrides={})=>({...structures[kind](),
 window:{basis:'explicit',startInclusive:'2026-10-28T11:00:00.000Z',endExclusive:'2026-10-28T13:00:00.000Z',timezone:'UTC',weekStartsOn:null},...overrides});
const citation=(sourceId,text=texts[sourceId])=>({sourceId,recordId:'independent-'+sourceId,sourceVersionId:'independent-version-1',start:0,end:text.length});
function input(overrides={}){return {skill:citedReportSkillPin(),title:'Independent general cited report',asOf:stamp,
 summary:'Draft summary: the recorded review evidence is cited; nothing is asserted beyond the cited passages.',
 findings:[{id:'excerpt',kind:'excerpt',text:texts.client_knowledge_search,citations:[citation('client_knowledge_search')]},
  {id:'claim',kind:'claim',text:texts.client_knowledge_search,citations:[citation('client_knowledge_search'),citation('research_portfolios')]},
  {id:'absent',kind:'excerpt',text:'No mail evidence was read.',citations:[citation('mail','No mail evidence was read.')]}],
 conflicts:[{findingId:'claim',note:'Two sources describe the review differently.'}],
 recommendations:['Confirm the review basis before committing resources.'],limitations:['Mail coverage is not exhaustive.'],...overrides};}
/** Trusted read-owner stand-in: one decisive source-read per declared source, bound to the selected subject. */
function readFactory({selected,unavailable=[],operation=null,entityIds=null}={}){
 return call=>{
  const sourceId=call.sourceId,available=!unavailable.includes(sourceId),content=texts[sourceId],observed=call.selector.asOf,citationId=randomUUID();
  const scopes=structuredClone(call.scopes),evidence=available?[{sourceId,recordId:'independent-'+sourceId,sourceVersionId:'independent-version-1',citationId,
   binding:structuredClone(call.binding),contentSha256:digest(Buffer.from(content)),scopes,observedAt:observed,sourceUpdatedAt:observed}]:[];
  const envelope={contractVersion:'0.2.0',requestId:randomUUID(),traceId:randomUUID(),
   operation:operation===sourceId?{id:'mail.search_messages',version:'0.2.0'}:citedReportReadOperation(sourceId),binding:structuredClone(call.binding),
   subject:{...structuredClone(selected.subject),entityIds:entityIds??structuredClone(selected.subject.entityIds),scopes},
   window:{basis:'unbounded'},argumentsSha256:v.hash(call.selector),
   appliedFilters:Object.entries(call.selector.subject).map(([k,value])=>({name:k.replace(/[A-Z]/g,x=>'_'+x.toLowerCase()),valueSha256:v.hash(value)})),
   method:'source-read',status:available?'complete':'unavailable',reasonCode:available?'OK':'SOURCE_UNAVAILABLE',retryable:false,
   sources:[{sourceId,authority:'derived',snapshotVersionId:available?'independent-snapshot-1':null,adapterVersion:'1.0.0',status:available?'checked':'unavailable',
    synchronizedAt:available?observed:null,asOf:available?observed:null,retrievedAt:observed,freshness:available?'fresh':'unknown'}],
   data:available?{kind:'source-read',records:[{sourceId,recordId:evidence[0].recordId,recordVersionId:evidence[0].sourceVersionId,citationId,
    contentSha256:evidence[0].contentSha256,scopes,content:{kind:'full-read',text:content}}]}:null,
   coverage:{sourcesRequested:[sourceId],sourcesChecked:available?[sourceId]:[],sourcesUnavailable:available?[]:[sourceId],enumeration:available?'complete':'unknown',
    enumerableTotal:available?1:null,returnedCount:available?1:0,truncated:false,historySupport:available?'supported':'unsupported',limitations:['Independent synthetic corpus only; actual completeness unproven.']},
   continuation:{cursor:null,requiredReads:[],remainingSources:available?[]:[sourceId]},negativeAssertion:{kind:'none'}};
  assertEvidence(envelope);return {envelope,evidence};
 };
}
const compiler=(read,selected,extra={})=>createCitedReportCompiler({readSource:read??readFactory({selected:selected??selection()}),now:()=>NOW,...extra});
const prepare=(c,inputValue,contextValue,selected,extra={})=>c.prepare(inputValue,contextValue,{selection:selected,...extra});
const headings=prepared=>prepared.request.content.blocks.filter(block=>block.style==='Heading 1').map(block=>block.runs[0].text);
const body=prepared=>prepared.request.content.blocks.flatMap(block=>block.runs?.map(run=>run.text)??[]).join('\n');
let renders=0;
const docxExecutor={async execute(x){renders++;const bytes=Buffer.from(JSON.stringify(x.request.content.blocks));
 return {bytes,inspection:{sha256:sha(bytes),bytes:bytes.length,format:'docx',nativeOpened:false,rendered:false,recalculated:false,members:[],details:{paragraphs:x.request.content.blocks.length,tables:0,pictures:0}}};}};

test('the installed identity is the general long-form cited report, not a bill recipe',async()=>{
 assert.deepEqual(CITED_REPORT_SECTIONS,REPORT_SECTIONS,'the accepted seven sections are the seven confirmed sections');
 assert.equal(CITED_REPORT_SECTIONS.length,7);
 const manifest=citedReportManifest();
 assert.equal(manifest.skillId,'quick_skill.cited_report');assert.equal(manifest.skillVersion,'1.0.0');
 assert.deepEqual([...manifest.subjectKinds],['client','portfolio','personal']);
 assert.ok(!manifest.requiredSources.some(source=>/bill|congress|legislation|program_elements/u.test(source.sourceId)),'no bill or congressional evidence requirement');
 assert.ok(!manifest.allowedOperations.some(operation=>/bill|congress/u.test(operation.id)),'no bill or congressional operation');
 const pin=citedReportSkillPin();assert.deepEqual(pin,selectSkill('quick_skill.cited_report','1.0.0').pin);
 assert.equal(pin.proseSha256,digest(await readFile(new URL('../SKILL.md',import.meta.url))));
 assert.equal(pin.catalogSha256,citedReportCatalogPin());
 assert.equal(manifest.prose.id,'urn:meri:original:general-cited-report:1.0.0');
 const prose=await readFile(new URL('../SKILL.md',import.meta.url),'utf8');
 assert.ok(prose.includes('Bill Watch'),'the prose states the boundary instead of aliasing Bill Watch');
 assert.ok(!/must require a bill|bill identity is required/u.test(prose),'the prose never requires a bill subject');
 assert.deepEqual(citedReportSourceIds,['client_knowledge_search','mail','research_portfolios']);
});

test('client, portfolio and personal selections compile the seven cited sections',async()=>{
 for(const kind of ['client','portfolio','personal']){
  const selected=selection(kind),ctx=context({scopes:selected.subject.scopes}),read=readFactory({selected});
  const prepared=await prepare(compiler(read,selected),input(),ctx,selected);
  assert.deepEqual(headings(prepared),CITED_REPORT_SECTIONS,`${kind}: the seven sections are the top-level structure`);
  const document=body(prepared);
  assert.ok(document.includes('Subject '+kind),`${kind}: the report names the trusted subject`);
  assert.ok(document.includes('As of '+stamp));
  const excerpt=prepared.findings.find(finding=>finding.id==='excerpt'),claim=prepared.findings.find(finding=>finding.id==='claim');
  assert.equal(excerpt.status,'bound-excerpt');assert.equal(excerpt.links[0].passage,texts.client_knowledge_search);
  assert.equal(excerpt.links[0].passageSha256,digest(Buffer.from(texts.client_knowledge_search)));
  assert.equal(claim.status,'unverified-claim');assert.equal(claim.conflict,true);
  assert.deepEqual(prepared.conflicts.map(entry=>entry.findingId),['claim']);
  assert.equal(prepared.conflicts[0].note,'Two sources describe the review differently.');
  assert.ok(document.includes('Citation: client_knowledge_search / independent-client_knowledge_search / independent-version-1; characters 0-'+texts.client_knowledge_search.length+'; read-and-bound'));
  assert.equal(prepared.provenance.subject.kind,kind);assert.equal(v.hash(prepared.provenance.selection.subject),v.hash(selected.subject));
  assert.equal(prepared.provenance.parent,null);assert.equal(prepared.baseVersionId,null);
  assert.equal(prepared.provenance.retainedEvidenceSha256,v.hash([]));
  assert.equal(prepared.evidenceSha256,v.hash(prepared.context.evidence));
  assert.equal(prepared.context.evidence.length,3);
  for(const item of prepared.context.evidence)v.nativeSourceEvidence(item);
  assert.ok(document.includes('Unequal cited passages are disclosed as possible conflicts'));
  assert.ok(document.includes('Stated limitation: Mail coverage is not exhaustive.'));
  assert.ok(document.includes('Original skill and immutable revision provenance'));
  assert.equal(preparedCitedReportEvidenceSha256(prepared),prepared.evidenceSha256);
 }
 assert.equal(renders,0,'compilation alone never reaches a renderer');
});

test('missing, partial and unavailable evidence is disclosed and never establishes absence',async()=>{
 const selected=selection('client'),ctx=context({scopes:selected.subject.scopes}),read=readFactory({selected,unavailable:['mail']});
 const prepared=await prepare(compiler(read,selected),input(),ctx,selected),document=body(prepared);
 const absent=prepared.findings.find(finding=>finding.id==='absent');
 assert.equal(absent.status,'missing-evidence');assert.equal(absent.links[0].passage,null);
 assert.ok(document.includes('mail: status unavailable; enumeration unknown'));
 assert.ok(document.includes('Read limitation: Independent synthetic corpus only; actual completeness unproven.'));
 assert.ok(document.includes('never establishes absence'));
 assert.ok(document.includes('remaining sources mail'));
 assert.equal(prepared.context.evidence.length,2);
 assert.equal(prepared.provenance.readsSha256,v.hash(prepared.reads));
});

for(const [label,edit,pattern] of [
  ['foreign actor',r=>{r.envelope.binding.actorId='foreign';},/Subject binding mismatch|CITED_REPORT_READ_BINDING/u],
  ['foreign tenant',r=>{r.envelope.binding.tenantId='foreign';},/Subject binding mismatch|CITED_REPORT_READ_BINDING/u],
  ['other run',r=>{r.envelope.binding.runId=uid(90);},/CITED_REPORT_READ_BINDING/u],
  ['changed selector',r=>{r.envelope.argumentsSha256='e'.repeat(64);},/CITED_REPORT_READ_BINDING/u],
  ['source operation',r=>{r.envelope.operation=citedReportReadOperation('mail');},/CITED_REPORT_READ_BINDING/u],
  ['source identity',r=>{r.envelope.sources[0].sourceId='mail';},/Source inventory mismatch|CITED_REPORT_READ_BINDING/u],
  ['foreign read subject',r=>{r.envelope.subject.entityIds=['independent-client-2'];},/CITED_REPORT_READ_BINDING/u],
  ['foreign read roster',r=>{r.envelope.subject.rosterVersionId='other-roster';},/Single subject identity mismatch|CITED_REPORT_READ_BINDING/u],
  ['other evidence run',r=>{r.evidence[0].binding.runId=uid(99);},/CITED_REPORT_READ_BINDING/u],
  ['raw text with retained hash',r=>{r.envelope.data.records[0].content.text+=' altered';},/CITED_REPORT_READ_BINDING/u],
  ['proof hash',r=>{r.evidence[0].contentSha256='a'.repeat(64);},/CITED_REPORT_READ_BINDING/u],
  ['foreign evidence scope',r=>{r.evidence[0].scopes[0].resourceId='independent-client-3';},/CITED_REPORT_READ_BINDING/u],
  ['proof observed time',r=>{r.evidence[0].observedAt='2026-12-28T12:00:01.000Z';},/CITED_REPORT_READ_BINDING/u],
  ['missing citation proof',r=>{r.evidence=[];},/CITED_REPORT_READ_BINDING/u],
  ['extra citation proof',r=>{r.evidence.push({...r.evidence[0],citationId:uid(77)});},/CITED_REPORT_READ_BINDING/u],
 ])test('refusal: '+label,async()=>{
  const selected=selection('client'),ctx=context({scopes:selected.subject.scopes});
  let reads=0;
  const read=call=>{reads++;const value=readFactory({selected})(call);if(call.sourceId==='client_knowledge_search')edit(value);return value;};
  await assert.rejects(compiler(read,selected).prepare(input(),ctx,{selection:selected}),pattern);
  assert.equal(reads,1);
 });
test('refusals: the selected subject, the window, the pin and the context',async()=>{
 const selected=selection('client'),ctx=context({scopes:selected.subject.scopes});
 // another client's scope never becomes this report's subject, and an entity subject is not declared here
 await assert.rejects(compiler().prepare(input(),ctx,{selection:{...selected,subject:{...selected.subject,scopes:[scope('client','independent-client-3')]}}}),/CITED_REPORT_SELECTION/u);
 await assert.rejects(compiler().prepare(input(),ctx,{selection:{...selected,subject:{...selected.subject,policyRevision:'other-policy'}}}),/CITED_REPORT_SELECTION|Subject lineage/u);
 await assert.rejects(compiler().prepare(input(),ctx,{selection:{...selected,subject:{...selected.subject,kind:'entity',entityType:'bill',entityIds:['119-s-88']}}}),/CITED_REPORT_SELECTION/u);
 await assert.rejects(compiler().prepare(input(),ctx,{selection:{...selected,window:{basis:'calendar-week',startInclusive:'2026-10-26T00:00:00.000Z',endExclusive:'2026-11-02T00:00:00.000Z',timezone:'UTC',weekStartsOn:'monday'}}}),/CITED_REPORT_SELECTION/u);
 await assert.rejects(compiler().prepare(input(),ctx,{selection:undefined}),/CITED_REPORT_SELECTION/u);
 await assert.rejects(compiler().prepare(input({skill:{...citedReportSkillPin(),skillVersion:'9.9.9'}}),ctx,{selection:selected}),/CITED_REPORT_SKILL_PIN/u);
 await assert.rejects(compiler().prepare(input({asOf:new Date(NOW+60000).toISOString()}),ctx,{selection:selected}),/CITED_REPORT_CONTEXT/u);
 // an asset-bearing context is refused: the frozen contract refuses a malformed asset first, and the
 // recipe refuses any admitted assets outright, so no read is ever attempted on top of existing assets
 await assert.rejects(compiler().prepare(input(),context({scopes:selected.subject.scopes,assets:[{assetId:'independent-asset'}]}),{selection:selected}),/Invalid private execution contract|CITED_REPORT_CONTEXT/u);
 await assert.rejects(compiler().prepare(input(),context({scopes:selected.subject.scopes,analysisAdmission:{}}),{selection:selected}),/Invalid private execution contract|CITED_REPORT_CONTEXT/u);
 await assert.rejects(compiler().prepare(input({conflicts:[{findingId:'excerpt',note:'Not in conflict.'}]}),ctx,{selection:selected}),/CITED_REPORT_CONFLICT/u);
 await assert.rejects(compiler().prepare(input({conflicts:[{findingId:'claim',note:'one'},{findingId:'claim',note:'two'}]}),ctx,{selection:selected}),/CITED_REPORT_CONFLICT/u);
 // an excerpt whose citation was not returned by any read stays unverifiable rather than verified
 const unread=await prepare(compiler(readFactory({selected}),selected),input({findings:[{id:'excerpt',kind:'excerpt',text:'Unread text.',citations:[{sourceId:'client_knowledge_search',recordId:'not-returned',sourceVersionId:'independent-version-1',start:0,end:5}]}],conflicts:[]}),ctx,selected);
 assert.equal(unread.findings[0].status,'missing-evidence');assert.equal(unread.findings[0].conflict,false);
 // a port that is not the trusted read owner, or a base without a reader, is a configuration refusal
 await assert.rejects(async()=>createCitedReportCompiler({readSource:null,now:()=>NOW}).prepare(input(),ctx,{selection:selected}),/CITED_REPORT_CONFIGURATION/u);
 await assert.rejects(async()=>compiler(readFactory({selected}),selected).prepare(input(),ctx,{selection:selected,base:{versionId:uid(70),specSha256:'a'.repeat(64)}}),/CITED_REPORT_BASE/u);
});

test('an evidence-bearing revision keeps the retained evidence and immutable parent pins through the canonical owner',async()=>{
 const binding=context().binding,scopes=context().scopes,selected=selection('client');
 const f=nativeDocumentFixture({binding,scopes});
 f.context.deadlineMs=NOW+5000;f.context.maxBytes=1048576;
 const ownerOptions=prepared=>bindPreparedCitedReportArtifactOptions(prepared,{...f.options,executor:docxExecutor,context:prepared.context});
 const serviceFor=(prepared,{retainedAdmission=true}={})=>{const bound=ownerOptions(prepared);
  return createArtifactService({...f.options,executor:docxExecutor,...bound,...(retainedAdmission?{}:{admitRetainedEvidence:undefined}),
   ids:()=>({artifactId:randomUUID(),versionId:randomUUID(),objectId:randomUUID()})});};
 const write=async(prepared,baseVersionId=null,changes={})=>{const service=serviceFor(prepared,changes),
  options={invocation:{invocationId:'sdk:'+v.hash({deliveryId:randomUUID()}),versionId:undefined,requestSha256:v.nativeRequestSha256(prepared.request,prepared.context,baseVersionId)}};
  return baseVersionId===null?service.create(prepared.request,prepared.context,options):service.revise(baseVersionId,prepared.request,prepared.context,options);};
 const first=await prepare(compiler(readFactory({selected}),selected),input(),f.context,selected);
 const created=await write(first);
 assert.deepEqual(created.version.evidence,first.context.evidence);assert.equal(created.version.parentVersionId,null);
 const retained=await f.options.versions.read(created.version.versionId);
 assert.deepEqual(retained.version,created.version);assert.equal(retained.specSha256,v.hash(first.request));
 const readBase=async({versionId,signal})=>{const record=await f.options.versions.read(versionId,signal);assert.equal(record.version.versionId,versionId);return record;};
 const next=input();next.recommendations=['Revised independent recommendation: preserve the original and re-check the mail source.'];
 const parent={versionId:created.version.versionId,specSha256:retained.specSha256};
 // A revision is a different attempt of the same conversation: the parent's evidence is earlier-run evidence,
 // so the canonical owner admits it only through the bound retained-evidence admission.
 const revisionContext={...f.context,binding:{...f.context.binding,runId:uid(5),attemptId:uid(6)}};
 let dispatched=0;const countingRead=call=>{dispatched++;return readFactory({selected})(call);};
 const before=dispatched;
 await assert.rejects(createCitedReportCompiler({readSource:countingRead,readBase,now:()=>NOW}).prepare(next,f.context,{selection:selected,base:{...parent,specSha256:'a'.repeat(64)}}),/CITED_REPORT_BASE/u);
 const rollback={...next,asOf:'2026-10-27T00:00:00.000Z'};
 await assert.rejects(createCitedReportCompiler({readSource:countingRead,readBase,now:()=>NOW}).prepare(rollback,f.context,{selection:selected,base:parent}),/CITED_REPORT_BASE_CONTEXT/u);
 const otherSubject={...selected,subject:{...selected.subject,entityIds:['independent-client-2'],scopes:[scope('client','independent-client-2')]}};
 // a selection for another subject is refused either by the selected-scope rule or by the parent's own subject pin
 await assert.rejects(createCitedReportCompiler({readSource:countingRead,readBase,now:()=>NOW}).prepare(next,f.context,{selection:otherSubject,base:parent}),/CITED_REPORT_SELECTION|CITED_REPORT_BASE_CONTEXT/u);
 await assert.rejects(createCitedReportCompiler({readSource:countingRead,readBase,now:()=>NOW}).prepare(next,{...f.context,binding:{...f.context.binding,conversationId:uid(55)}},{selection:selected,base:parent}),/CITED_REPORT_BASE/u);
 assert.equal(dispatched,before,'nothing is dispatched until the parent is admitted');
 const second=await createCitedReportCompiler({readSource:readFactory({selected}),readBase,now:()=>NOW}).prepare(next,revisionContext,{selection:selected,base:parent});
 assert.deepEqual(second.provenance.parent,{versionId:created.version.versionId,objectSha256:created.version.object.sha256,specSha256:retained.specSha256,provenanceSha256:v.hash(first.provenance)});
 assert.deepEqual(second.retainedEvidence,created.version.evidence);
 assert.deepEqual(second.context.evidence.slice(0,created.version.evidence.length),created.version.evidence);
 assert.equal(second.context.evidence[second.retainedEvidence.length].binding.runId,revisionContext.binding.runId);
 assert.equal(second.provenance.retainedEvidenceSha256,v.hash(second.retainedEvidence));
 assert.equal(new Set(second.context.evidence.map(item=>item.citationId)).size,second.context.evidence.length,'retained and fresh citations stay unique');
 assert.ok(body(second).includes('Retained source evidence (immutable parent)'));
 assert.ok(body(second).includes('"parent":{"versionId":"'+created.version.versionId+'"'));
 assert.equal(v.hash(second.provenance.selection.subject),v.hash(selected.subject));
 // Without the bound retained-evidence admission the same revision cannot be written at all.
 await assert.rejects(write(second,created.version.versionId,{retainedAdmission:false}),{code:'ARTIFACT_EVIDENCE_BINDING'});
 const revised=await write(second,created.version.versionId);
 assert.deepEqual(revised.version.evidence,second.context.evidence);
 assert.equal(revised.version.parentVersionId,created.version.versionId);assert.equal(revised.version.artifactId,created.version.artifactId);
 assert.notEqual(revised.version.object.sha256,created.version.object.sha256);
 const again=await f.options.versions.read(created.version.versionId);
 assert.deepEqual(again.version,created.version);assert.deepEqual(again.specSha256,retained.specSha256);
 assert.ok(renders>=2,'the canonical executor rendered immutable bytes');
});

test('the prepared report admits only its own request, context and base',async()=>{
 const selected=selection('client'),ctx=context({scopes:selected.subject.scopes});
 const prepared=await prepare(compiler(readFactory({selected}),selected),input(),ctx,selected);
 const guard=admitPreparedCitedReport(prepared,prepared.context);
 assert.equal(guard({request:prepared.request,baseVersionId:null}),undefined);
 assert.throws(()=>guard({request:{...prepared.request,title:'Substituted'},baseVersionId:null}));
 assert.throws(()=>guard({request:prepared.request,baseVersionId:uid(98)}));
 const mutated=structuredClone(prepared.context);mutated.evidence=[{...prepared.context.evidence[0],contentSha256:'e'.repeat(64)}];
 assert.throws(()=>admitPreparedCitedReport(prepared,mutated));
 assert.throws(()=>admitPreparedCitedReport(prepared,ctx),'the unread selection context is not the prepared context');
 assert.throws(()=>admitPreparedCitedReport(structuredClone(prepared),prepared.context));
 assert.throws(()=>admitPreparedCitedReport({},prepared.context));
 assert.deepEqual(selectorSubject(selected.subject),{kind:'client',entityId:client});
 assert.deepEqual(selectorSubject(selection('portfolio').subject),{kind:'portfolio',rosterVersionId:'independent-roster-1'});
 assert.deepEqual(selectorSubject(selection('personal').subject),{kind:'personal'});
 assert.equal(selectorSubject({...selected.subject,kind:'entity',entityType:'bill',entityIds:['119-s-88']}),null);
});
