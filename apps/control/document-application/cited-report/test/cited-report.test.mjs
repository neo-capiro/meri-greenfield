/** Focused recipe tests: trusted ports only — no database, provider, renderer, route or model call.
 * The general cited report is compiled by this recipe over the selected runtime's own typed reads: the
 * fixtures below are real production DTOs (a dedicated test proves the canonical receivers admit them
 * unchanged), the read seam is the real one, and the revision is written through the canonical artifact owner
 * with a scripted (non-native) executor. Native DOCX rendering and Meri semantic evaluation are separate
 * qualifications and are not claimed here. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {createCitedReportCompiler,admitPreparedCitedReport,preparedCitedReportEvidenceSha256} from '../compose.mjs';
import {bindPreparedCitedReportArtifactOptions} from '../binding.mjs';
import {citedReportManifest,citedReportSkillPin,citedReportOperation} from '../skill.mjs';
import {CITED_REPORT_SECTIONS} from '../input.mjs';
import {citedReportReadGroups,readKey} from '../sources.mjs';
import {artifactValidators as v,assertMailThreadSourcePage,assertResearchPortfolioEvidenceOutput} from '../../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {selectSkill} from '../../../../../packages/skills/index.mjs';
import {createArtifactService} from '../../../../artifacts/service.mjs';
import {nativeDocumentFixture,sha} from '../../../../artifacts/test/native-document-fixture.mjs';
const SEVEN=['Summary','Scope and as-of','Findings','Conflicting evidence','Recommendations','Limitations','References'];
const NOW=Date.parse('2026-10-28T12:00:00.000Z'),stamp=new Date(NOW).toISOString();
const uid=n=>`10000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const digest=value=>createHash('sha256').update(value).digest('hex');
const policy='cited-report-policy-1',actor='source-reviewer',client=uid(9);
const MAILBOX=uid(20),THREAD=uid(21),MESSAGE=uid(22),PORTFOLIO=uid(30),CLAIM_RECORD=uid(31),READ_HANDLE='independent-read-handle-1';
const BODY='Review window confirmed in writing; no approval was granted on the reforecast.';
const EXCERPT=BODY.slice(0,35);
const LONG_BODY=`${EXCERPT}${'.'.repeat(2100-EXCERPT.length)}`;
const scope=(kind,resourceId)=>({tenantId:'general-cited-report',kind,resourceId,policyRevision:policy});
const scopes=[scope('client',client),scope('mailbox',MAILBOX)];
const binding={tenantId:'general-cited-report',actorId:actor,conversationId:uid(1),runId:uid(2),attemptId:uid(3),workerId:uid(4),writerFence:1};
const explicitWindow={basis:'explicit',startInclusive:'2026-10-28T11:00:00.000Z',endExclusive:'2026-10-28T13:00:00.000Z',timezone:'UTC',weekStartsOn:null};
const subject=()=>({kind:'client',entityType:'client',entityIds:[client],tenantId:'general-cited-report',actorId:actor,policyRevision:policy,scopes:structuredClone(scopes),rosterVersionId:null});
const selection=(overrides={})=>({subject:subject(),window:structuredClone(explicitWindow),mondayBoardIds:[],...overrides});
const context=(overrides={})=>({binding,scopes,evidence:[],assets:[],deadlineMs:NOW+5000,maxBytes:1048576,...overrides});
const mailRequest=(start=0,end=EXCERPT.length)=>({subject:{kind:'client',entityId:client},threadId:THREAD,messageId:MESSAGE,messageOffset:0,bodyOffset:0,limit:1,maxCharacters:2000});
/** The real MailThreadSourcePage a stored-mail read returns. Every occurrence of a structure is its own JSON
 * value, because a production DTO never shares a reference (the DTO walk rejects that). */
function mailPage(request,{text=BODY,truncated=false,sourceStatus='checked',coverage={},binding:owner=binding,citationId=uid(23),recordVersionId='independent-record-version-1'}={}){
 const end=Math.min(text.length,2000);
 const message={sourceId:'mail',mailboxId:MAILBOX,threadId:THREAD,messageId:MESSAGE,recordVersionId,citationId,
  contentSha256:digest(text),scopes:structuredClone(scopes),removed:false,connectionStatus:'connected',bodyCompleteness:end<text.length?'truncated':'full',readHandle:READ_HANDLE,
  section:{start:0,endExclusive:end,totalCodeUnits:text.length,unit:'utf16-code-unit',text:text.slice(0,end),hasMore:end<text.length}};
 return {kind:'mail-thread-source-page',contractVersion:'0.2.0',operation:{id:'mail.read_thread',version:'0.2.0'},requestId:uid(41),traceId:uid(42),
  binding:structuredClone(owner),subject:subject(),window:structuredClone(explicitWindow),argumentsSha256:v.hash(request),appliedFilters:[],
  sources:[{sourceId:'mail',authority:'authoritative',snapshotVersionId:'independent-snapshot-1',adapterVersion:'1.0.0',status:sourceStatus,synchronizedAt:stamp,asOf:stamp,retrievedAt:stamp,freshness:'fresh'}],
  coverage:{sourcesRequested:['mail'],sourcesChecked:['mail'],sourcesUnavailable:[],enumeration:'unknown',enumerableTotal:null,returnedCount:1,truncated,historySupport:'supported',
   limitations:['Independent synthetic corpus only; actual completeness unproven.'],...coverage},
  selection:{...request},order:'sentAt-asc_receivedAt-asc_createdAt-asc_nulls-and-ties-unspecified',snapshotVersionId:'independent-snapshot-1',messages:[message],
  totalMessages:null,hasMoreMessages:null,nextMessageOffset:null,nextBodyOffsets:message.section.hasMore?[{messageId:MESSAGE,bodyOffset:end}]:[],
  continuation:{cursor:null,requiredReads:[READ_HANDLE],remainingSources:[]},evidenceReady:false,negativeAssertion:{kind:'none'}};
}
/** The real portfolio evidence projection a get_research_evidence read returns. */
const portfolioResult=(request,{binding:owner=binding}={})=>({binding:structuredClone(owner),subject:subject(),
 data:{origin:'snapshot',id:request.recordId,portfolioId:request.portfolioId,portfolioRevision:1,contentHash:digest('portfolio-content'),
  calculationVersion:'1.0.0',capturedAt:stamp,observedAt:stamp,readAt:stamp,contributions:[],
  versions:{structure:{},rules:[],decisions:[],templates:[],taxonomy:[],labels:[],sources:[]},
  limitations:['Projection only; source bytes are preserved claims.'],
  clientAccessRequirements:[],coverage:{scope:'retained_snapshot',sourceView:'retained_snapshot',corpusComplete:false,sourceBytesVerified:false,limitations:['Only retained snapshot members are projected.']}}});
const mailCitation=(start=0,end=EXCERPT.length)=>({kind:'mail',threadId:THREAD,messageId:MESSAGE,start,end});
const portfolioCitation=()=>({kind:'portfolio-evidence',portfolioId:PORTFOLIO,origin:'snapshot',recordId:CLAIM_RECORD});
function input(overrides={}){
 return {skill:citedReportSkillPin(),title:'Independent general cited report',asOf:stamp,
  summary:'Draft summary: the recorded review evidence is cited; nothing is asserted beyond the cited passages.',
  findings:[{id:'excerpt',kind:'excerpt',text:EXCERPT,citations:[mailCitation()]},
   {id:'claim',kind:'claim',text:'The retained portfolio snapshot records no change of rating.',citations:[portfolioCitation()]},
   {id:'mixed',kind:'claim',text:'Two stored passages describe the review differently.',citations:[mailCitation(0,20),mailCitation(0,EXCERPT.length)]}],
  conflicts:[{findingId:'mixed',note:'The two stored passages describe the review differently.'}],
  recommendations:['Confirm the review basis before committing resources.'],limitations:['Mail coverage is not exhaustive.'],...overrides};
}
/** The selected runtime's own read seam: the operation's typed result, or a refusal, and nothing else.
 * Like the real transport it does not re-validate the result; the recipe admits it with the real receiver. */
function readFactory({selected=selection(),binding:current=binding,edit=null,refuse=null,values={}}={}){
 const calls=[];
 const read=async({binding:b,window:w,subject:s,operation,request})=>{
  calls.push({operation,request});
  if(v.hash(b)!==v.hash(current)||v.hash(w)!==v.hash(selected.window)||v.hash(s)!==v.hash(selected.subject))
   throw Object.assign(Error('SKILL_COMPILER_CONTEXT_REFUSED'),{code:'SKILL_COMPILER_CONTEXT_REFUSED'});
  if(refuse&&refuse.id===operation.id)throw Object.assign(Error(refuse.code),{code:refuse.code});
  const value=(values[operation.id]??(operation.id==='mail.read_thread'?mailPage(request,{binding:current}):portfolioResult(request,{binding:current})));
  if(edit&&edit.id===operation.id)edit.apply(value);
  return value;
 };
 read.calls=calls;return read;
}
const compile=(read,extra={})=>createCitedReportCompiler({readSource:read??readFactory(),now:()=>NOW,...extra});
const headings=prepared=>prepared.request.content.blocks.filter(block=>block.style==='Heading 1').map(block=>block.runs[0].text);
const body=prepared=>prepared.request.content.blocks.flatMap(block=>block.runs?.map(run=>run.text)??[]).join('\n');
let renders=0;
const docxExecutor={async execute(x){renders++;const bytes=Buffer.from(JSON.stringify(x.request.content.blocks));
 return {bytes,inspection:{sha256:sha(bytes),bytes:bytes.length,format:'docx',nativeOpened:false,rendered:false,recalculated:false,members:[],details:{paragraphs:x.request.content.blocks.length,tables:0,pictures:0}}};}};

test('the fixtures are production DTOs: the canonical receivers admit them unchanged',()=>{
 const request=mailRequest();
 const page=assertMailThreadSourcePage(mailPage(request),request);
 assert.equal(page.messages[0].section.text,BODY);assert.equal(page.kind,'mail-thread-source-page');
 const partial=assertMailThreadSourcePage(mailPage(request,{text:LONG_BODY,truncated:true,sourceStatus:'partial'}),request);
 assert.equal(partial.messages[0].section.hasMore,true);
 assert.deepEqual(partial.nextBodyOffsets,[{messageId:MESSAGE,bodyOffset:2000}]);
 const portfolioRequest={origin:'snapshot',portfolioId:PORTFOLIO,recordId:CLAIM_RECORD};
 const result=assertResearchPortfolioEvidenceOutput('get_research_evidence',portfolioResult(portfolioRequest),portfolioRequest,{binding,subject:selection().subject});
 assert.equal(result.data.coverage.sourceBytesVerified,false);
 assert.equal(result.data.coverage.corpusComplete,false);
});

test('the installed identity is the general long-form cited report at its own manifest contract version',async()=>{
 assert.deepEqual(CITED_REPORT_SECTIONS,SEVEN,'the accepted seven sections are the seven confirmed sections');
 const manifest=citedReportManifest();
 assert.equal(manifest.contractVersion,'0.3.0','the honest new manifest declares the versioned 0.3.0 contract');
 assert.equal(manifest.skillId,'quick_skill.cited_report');assert.equal(manifest.skillVersion,'1.0.0');
 assert.deepEqual([...manifest.subjectKinds],['client'],'only the subject kind the current selected path actually resolves');
 assert.ok(!manifest.requiredSources.some(source=>/bill|congress|legislation/u.test(source.sourceId)),'no bill or congressional evidence requirement');
 assert.ok(!manifest.allowedOperations.some(operation=>/bill|congress/u.test(operation.id)),'no bill or congressional operation');
 assert.deepEqual(manifest.requiredSources.map(source=>source.sourceId),['mail','research_portfolios','artifact_versions']);
 assert.deepEqual(manifest.allowedOperations.map(operation=>`${operation.id}@${operation.version}`),['mail.read_thread@0.2.0','get_research_evidence@0.2.0','create_word@0.2.0']);
 const pin=citedReportSkillPin();assert.deepEqual(pin,selectSkill('quick_skill.cited_report','1.0.0').pin);
 assert.equal(pin.proseSha256,digest(await readFile(new URL('../SKILL.md',import.meta.url))));
 assert.equal(manifest.prose.id,'urn:meri:original:general-cited-report:1.0.0');
 const prose=await readFile(new URL('../SKILL.md',import.meta.url),'utf8');
 assert.ok(prose.includes('Bill Watch'),'the prose states the boundary instead of aliasing Bill Watch');
 assert.ok(!/must require a bill|bill identity is required/u.test(prose),'the prose never requires a bill subject');
 assert.deepEqual(citedReportOperation('mail.read_thread'),{id:'mail.read_thread',version:'0.2.0'});
});

test('the selected client subject compiles the seven cited sections through the real typed read seam',async()=>{
 const selected=selection(),read=readFactory({selected}),prepared=await compile(read).prepare(input(),context(),{selection:selected});
 assert.deepEqual(headings(prepared),SEVEN,'the seven sections are the top-level structure');
 const document=body(prepared);
 assert.ok(document.includes('Subject client: '+client));assert.ok(document.includes('As of '+stamp));
 // One real typed read per distinct cited locator, in the real read grammar, and no envelope.
 assert.deepEqual(read.calls.map(call=>`${call.operation.id}@${call.operation.version}`),['mail.read_thread@0.2.0','get_research_evidence@0.2.0']);
 assert.deepEqual(read.calls[0].request,mailRequest());
 assert.deepEqual(read.calls[1].request,{origin:'snapshot',portfolioId:PORTFOLIO,recordId:CLAIM_RECORD});
 // The excerpt is exactly the characters we received from the stored record version.
 const excerpt=prepared.findings.find(finding=>finding.id==='excerpt'),claim=prepared.findings.find(finding=>finding.id==='claim'),mixed=prepared.findings.find(finding=>finding.id==='mixed');
 assert.equal(excerpt.status,'verified');assert.equal(excerpt.citations[0].passage,EXCERPT);
 assert.equal(excerpt.citations[0].passageSha256,digest(EXCERPT));
 assert.equal(excerpt.citations[0].citation.sourceVersionId,'independent-record-version-1');
 assert.equal(excerpt.citations[0].evidence.sourceId,'mail');
 assert.equal(claim.status,'claimed','a portfolio projection is carried as a preserved claim');
 assert.equal(claim.citations[0].kind,'portfolio-evidence');assert.equal(claim.citations[0].evidence,null,'a claim is never artifact evidence');
 assert.equal(claim.citations[0].coverage.sourceBytesVerified,false);
 assert.equal(mixed.status,'verified','both stored passages were read');
 assert.equal(mixed.conflict,true,'unequal cited passages are disclosed');
 assert.deepEqual(prepared.conflicts.map(entry=>entry.findingId),['mixed']);
 assert.equal(prepared.conflicts[0].note,'The two stored passages describe the review differently.');
 assert.ok(document.includes('Citation: mail / message '+MESSAGE+' / version independent-record-version-1; characters 0-'+EXCERPT.length+'; verified'));
 assert.ok(document.includes('Citation: research_portfolios / snapshot / '+CLAIM_RECORD+'; preserved claim (source bytes verified by the projection: no)'));
 assert.ok(document.includes('Cited passage (UTF-16 characters 0-'+EXCERPT.length+'): '+EXCERPT));
 assert.ok(document.includes('Preserved content SHA256: '+digest(BODY)));
 assert.ok(document.includes('Claim limitation: Only retained snapshot members are projected.'));
 assert.ok(document.includes('Read limitation: Independent synthetic corpus only; actual completeness unproven.'));
 assert.ok(document.includes('Source mail: checked (authoritative, fresh)'));
 assert.ok(document.includes('operation mail.read_thread@0.2.0'));
 // Only the byte-verifiable stored mail read becomes artifact evidence, once per stored record.
 assert.deepEqual(prepared.context.evidence.map(item=>item.citationId),[uid(23)]);
 for(const item of prepared.context.evidence)v.nativeSourceEvidence(item);
 assert.equal(prepared.evidenceSha256,v.hash(prepared.context.evidence));
 assert.equal(prepared.provenance.readsSha256,v.hash(prepared.reads));
 assert.equal(prepared.provenance.selection.subject.kind,'client');
 assert.equal(v.hash(prepared.provenance.selection),v.hash(selected),'the whole trusted selection is pinned');
 assert.equal(prepared.provenance.parent,null);assert.equal(prepared.baseVersionId,null);
 assert.equal(preparedCitedReportEvidenceSha256(prepared),prepared.evidenceSha256);
 assert.equal(renders,0,'compilation alone never reaches a renderer');
});

test('one read per distinct locator, and the citations stay bound to their own read',async()=>{
 const selected=selection(),read=readFactory({selected});
 const twice=input({findings:[{id:'excerpt',kind:'excerpt',text:EXCERPT,citations:[mailCitation()]},
  {id:'again',kind:'claim',text:'The same stored message is cited again.',citations:[mailCitation(0,BODY.length)]}],conflicts:[]});
 const prepared=await compile(read).prepare(twice,context(),{selection:selected});
 assert.equal(read.calls.length,1,'a second citation of the same thread does not read the source twice');
 assert.equal(read.calls[0].operation.id,'mail.read_thread');
 assert.equal(prepared.findings[1].citations[0].passage,BODY);
 assert.equal(prepared.context.evidence.length,1,'the same stored record is one evidence record');
 assert.deepEqual(citedReportReadGroups(twice,selected).map(group=>group.key),[readKey(twice.findings[0].citations[0])]);
 assert.equal(readKey(portfolioCitation()),'portfolio-evidence:snapshot:'+PORTFOLIO+':'+CLAIM_RECORD);
});

for(const [label,edit,pattern] of [
 ['foreign actor',{id:'mail.read_thread',apply:page=>{page.binding.actorId='foreign';}},/Subject binding mismatch|CITED_REPORT_READ_BINDING/u],
 ['foreign run',{id:'mail.read_thread',apply:page=>{page.binding.runId=uid(90);}},/CITED_REPORT_READ_BINDING/u],
 ['foreign window',{id:'mail.read_thread',apply:page=>{page.window={basis:'unbounded'};}},/CITED_REPORT_READ_BINDING/u],
 ['another client subject',{id:'mail.read_thread',apply:page=>{page.subject.entityIds=[uid(91)];}},/CITED_REPORT_READ_BINDING|Mail requested/u],
 ['substituted message identity',{id:'mail.read_thread',apply:page=>{page.messages[0].messageId=uid(92);}},/Mail thread\/message selection mismatch|CITED_REPORT_READ_BINDING/u],
 ['arguments hash',{id:'mail.read_thread',apply:page=>{page.argumentsSha256='a'.repeat(64);}},/Mail argument\/selection binding mismatch|CITED_REPORT_READ_BINDING/u],
 ['foreign message scope',{id:'mail.read_thread',apply:page=>{page.messages[0].scopes=[scope('client',client),scope('mailbox',uid(93))];}},/Mail (scope lineage|mailbox scope) mismatch|CITED_REPORT_READ_BINDING/u],
 ['another portfolio binding',{id:'get_research_evidence',apply:page=>{page.binding.tenantId='foreign';}},/Invalid Portfolio evidence projection|CITED_REPORT_READ_BINDING/u],
])test('refusal: the read is admitted by the real receiver and bound to this run ('+label+')',async()=>{
 const selected=selection();
 await assert.rejects(compile(readFactory({selected,edit})).prepare(input(),context(),{selection:selected}),pattern);
});

test('a citation the source result does not prove is refused rather than restated',async()=>{
 const selected=selection();
 // A stored message other than the one cited.
 await assert.rejects(compile(readFactory({selected,edit:{id:'mail.read_thread',apply:page=>{page.messages[0].messageId=uid(92);}}})).prepare(input(),context(),{selection:selected}),/Mail thread\/message selection mismatch|CITED_REPORT_READ_BINDING/u);
 // Characters outside the section we actually read.
 await assert.rejects(compile(readFactory({selected})).prepare(input({findings:[{id:'excerpt',kind:'excerpt',text:EXCERPT,citations:[mailCitation(BODY.length,123)]}],conflicts:[]}),context(),{selection:selected}),/CITED_REPORT_CITATION/u);
 // A stored message with no citation identity, no record version and no content hash proves nothing.
 await assert.rejects(compile(readFactory({selected,edit:{id:'mail.read_thread',apply:page=>{page.messages[0].recordVersionId=null;page.messages[0].citationId=null;page.messages[0].contentSha256=null;}}})).prepare(input({findings:[{id:'excerpt',kind:'excerpt',text:EXCERPT,citations:[mailCitation()]}],conflicts:[]}),context(),{selection:selected}),/CITED_REPORT_CITATION_UNPROVEN/u);
 // A quoted excerpt may only cite byte-verified stored mail text.
 await assert.rejects(compile(readFactory({selected})).prepare(input({findings:[{id:'excerpt',kind:'excerpt',text:EXCERPT,citations:[portfolioCitation()]}],conflicts:[]}),context(),{selection:selected}),/CITED_REPORT_CITATION/u);
 // A portfolio claim the projection does not carry is refused.
 await assert.rejects(compile(readFactory({selected,values:{'get_research_evidence':portfolioResult({origin:'snapshot',portfolioId:PORTFOLIO,recordId:CLAIM_RECORD})}})).prepare(input({findings:[{id:'claim',kind:'claim',text:'Unsupported.',citations:[{kind:'portfolio-evidence',portfolioId:PORTFOLIO,origin:'snapshot',recordId:uid(77)}]}],conflicts:[]}),context(),{selection:selected}),/Invalid Portfolio evidence projection|CITED_REPORT_CITATION/u);
 // A named conflict must attach to a finding whose cited passages really differ.
 await assert.rejects(compile(readFactory({selected})).prepare(input({conflicts:[{findingId:'excerpt',note:'Not in conflict.'}]}),context(),{selection:selected}),/CITED_REPORT_CONFLICT/u);
});

test('a source the runtime will not read refuses the citation and is never taken as absence',async()=>{
 const selected=selection();
 await assert.rejects(compile(readFactory({selected,refuse:{id:'mail.read_thread',code:'UNAVAILABLE'}})).prepare(input(),context(),{selection:selected}),/CITED_REPORT_READ_UNAVAILABLE/u);
 await assert.rejects(compile(readFactory({selected,refuse:{id:'get_research_evidence',code:'ACCESS_DENIED'}})).prepare(input(),context(),{selection:selected}),/CITED_REPORT_READ_ACCESS_DENIED/u);
 // Reading is driven by the cited locators only: an uncited source is never read and never asserted.
 const mailOnly=input({findings:[{id:'excerpt',kind:'excerpt',text:EXCERPT,citations:[mailCitation()]}],conflicts:[]});
 const read=readFactory({selected});
 const prepared=await compile(read).prepare(mailOnly,context(),{selection:selected});
 assert.deepEqual(read.calls.map(call=>call.operation.id),['mail.read_thread']);
 const document=body(prepared);
 assert.ok(document.includes('never establishes absence'));
 assert.ok(document.includes('unavailable none'));
 assert.ok(!document.includes('research_portfolios: coverage'),'an unread source is not reported as read');
});

test('partial and truncated coverage is disclosed and no absence is claimed',async()=>{
 const selected=selection();
 const page=mailPage(mailRequest(),{text:LONG_BODY,truncated:true,sourceStatus:'partial',coverage:{enumeration:'partial',limitations:['Thread enumeration is partial for this mailbox.']}});
 const prepared=await compile(readFactory({selected,values:{'mail.read_thread':page}}))
  .prepare(input({findings:[{id:'excerpt',kind:'excerpt',text:EXCERPT,citations:[mailCitation()]}],conflicts:[]}),context(),{selection:selected});
 const document=body(prepared);
 assert.ok(document.includes('mail: coverage partial; truncated true'),'the real coverage fields are disclosed');
 assert.ok(document.includes('Read limitation: Thread enumeration is partial for this mailbox.'));
 assert.ok(document.includes('Source mail: partial (authoritative, fresh)'));
 assert.ok(document.includes('more body outside the read section'),'a truncated body section is disclosed');
 assert.ok(document.includes('never establishes absence'));
 assert.equal(prepared.findings[0].status,'verified','the excerpt we did read is still exactly bound');
 assert.equal(prepared.findings[0].citations[0].section.hasMore,true);
});

test('refusals: the selected subject, the window, the pin, the context and the ports',async()=>{
 const selected=selection(),read=readFactory({selected});
 // Only the client subject the current selected path resolves is declared; other kinds are a dependency.
 const personal=selection({subject:{kind:'personal',entityType:'user',entityIds:[actor],tenantId:'general-cited-report',actorId:actor,policyRevision:policy,scopes:[scope('private-user',actor)],rosterVersionId:null}});
 await assert.rejects(compile(read).prepare(input(),context({scopes:[scope('private-user',actor)]}),{selection:personal}),/CITED_REPORT_SELECTION|Subject lineage/u);
 await assert.rejects(compile(read).prepare(input(),context(),{selection:selection({subject:{...subject(),kind:'entity',entityType:'bill',entityIds:['119-s-88']}})}),/CITED_REPORT_SELECTION/u);
 await assert.rejects(compile(read).prepare(input(),context(),{selection:selection({subject:{...subject(),scopes:[scope('client',uid(95)),scope('mailbox',MAILBOX)]}})}),/CITED_REPORT_SELECTION|Subject lineage/u);
 await assert.rejects(compile(read).prepare(input(),context(),{selection:undefined}),/CITED_REPORT_SELECTION/u);
 await assert.rejects(compile(read).prepare(input(),context(),{selection:selection({window:{basis:'calendar-week',startInclusive:'2026-10-26T00:00:00.000Z',endExclusive:'2026-11-02T00:00:00.000Z',timezone:'UTC',weekStartsOn:'monday'}})}),/CITED_REPORT_SELECTION/u);
 await assert.rejects(compile(read).prepare(input({skill:{...citedReportSkillPin(),skillVersion:'9.9.9'}}),context(),{selection:selected}),/CITED_REPORT_SKILL_PIN/u);
 await assert.rejects(compile(read).prepare(input({asOf:new Date(NOW+60000).toISOString()}),context(),{selection:selected}),/CITED_REPORT_CONTEXT/u);
 await assert.rejects(compile(read).prepare(input(),context({assets:[{assetId:'independent-asset'}]}),{selection:selected}),/Invalid private execution contract|CITED_REPORT_CONTEXT/u);
 await assert.rejects(compile(read).prepare(input(),context({analysisAdmission:{}}),{selection:selected}),/Invalid private execution contract|CITED_REPORT_CONTEXT/u);
 await assert.rejects(compile(read).prepare(input({conflicts:[{findingId:'mixed',note:'one'},{findingId:'mixed',note:'two'}]}),context(),{selection:selected}),/CITED_REPORT_CONFLICT/u);
 assert.equal(read.calls.length,0,'a refused request never dispatches a read');
 await assert.rejects(async()=>createCitedReportCompiler({readSource:null,now:()=>NOW}).prepare(input(),context(),{selection:selected}),/CITED_REPORT_CONFIGURATION/u);
 await assert.rejects(compile(read).prepare(input(),context(),{selection:selected,base:{versionId:uid(70),specSha256:'a'.repeat(64)}}),/CITED_REPORT_BASE/u);
});

test('an evidence-bearing revision keeps the retained evidence and immutable parent pins through the canonical owner',async()=>{
 const selected=selection();
 const f=nativeDocumentFixture({binding,scopes});
 f.context.deadlineMs=NOW+5000;f.context.maxBytes=1048576;
 const ownerOptions=prepared=>bindPreparedCitedReportArtifactOptions(prepared,{...f.options,executor:docxExecutor,context:prepared.context});
 const serviceFor=(prepared,{retainedAdmission=true}={})=>{const bound=ownerOptions(prepared);
  return createArtifactService({...f.options,executor:docxExecutor,...bound,...(retainedAdmission?{}:{admitRetainedEvidence:undefined}),
   ids:()=>({artifactId:randomUUID(),versionId:randomUUID(),objectId:randomUUID()})});};
 const write=async(prepared,baseVersionId=null,changes={})=>{const service=serviceFor(prepared,changes),
  options={invocation:{invocationId:'sdk:'+v.hash({deliveryId:randomUUID()}),versionId:undefined,requestSha256:v.nativeRequestSha256(prepared.request,prepared.context,baseVersionId)}};
  return baseVersionId===null?service.create(prepared.request,prepared.context,options):service.revise(baseVersionId,prepared.request,prepared.context,options);};
 const first=await compile(readFactory({selected})).prepare(input(),f.context,{selection:selected});
 const created=await write(first);
 assert.deepEqual(created.version.evidence,first.context.evidence);assert.equal(created.version.parentVersionId,null);
 const retained=await f.options.versions.read(created.version.versionId);
 assert.deepEqual(retained.version,created.version);assert.equal(retained.specSha256,v.hash(first.request));
 const readBase=async({versionId,signal})=>{const record=await f.options.versions.read(versionId,signal);assert.equal(record.version.versionId,versionId);return record;};
 const next=input();next.recommendations=['Revised independent recommendation: preserve the original and re-check the mail source.'];
 const parent={versionId:created.version.versionId,specSha256:retained.specSha256};
 const revisionContext={...f.context,binding:{...f.context.binding,runId:uid(5),attemptId:uid(6)}};
 const counting=readFactory({selected}),before=counting.calls.length;
 await assert.rejects(createCitedReportCompiler({readSource:counting,readBase,now:()=>NOW}).prepare(next,f.context,{selection:selected,base:{...parent,specSha256:'a'.repeat(64)}}),/CITED_REPORT_BASE/u);
 await assert.rejects(createCitedReportCompiler({readSource:counting,readBase,now:()=>NOW}).prepare({...next,asOf:'2026-10-27T00:00:00.000Z'},f.context,{selection:selected,base:parent}),/CITED_REPORT_BASE_CONTEXT/u);
 await assert.rejects(createCitedReportCompiler({readSource:counting,readBase,now:()=>NOW}).prepare(next,{...f.context,binding:{...f.context.binding,conversationId:uid(55)}},{selection:selected,base:parent}),/CITED_REPORT_BASE/u);
 assert.equal(counting.calls.length,before,'nothing is dispatched until the parent is admitted');
 // The revised attempt re-reads the same stored thread, which now returns a new immutable record version:
 // the parent's evidence stays exactly as it was and the new record is added beside it.
 const second=await createCitedReportCompiler({readSource:readFactory({selected,binding:revisionContext.binding,
  values:{'mail.read_thread':mailPage(mailRequest(),{binding:revisionContext.binding,citationId:uid(24),recordVersionId:'independent-record-version-2'})}}),readBase,now:()=>NOW})
  .prepare(next,revisionContext,{selection:selected,base:parent});
 assert.deepEqual(second.provenance.parent,{versionId:created.version.versionId,objectSha256:created.version.object.sha256,specSha256:retained.specSha256,provenanceSha256:v.hash(first.provenance)});
 assert.deepEqual(second.retainedEvidence,created.version.evidence);
 assert.deepEqual(second.context.evidence.slice(0,created.version.evidence.length),created.version.evidence);
 assert.equal(second.context.evidence[second.retainedEvidence.length].binding.runId,revisionContext.binding.runId);
 assert.equal(new Set(second.context.evidence.map(item=>item.citationId)).size,second.context.evidence.length,'retained and fresh citations stay unique');
 assert.ok(body(second).includes('Retained source evidence (immutable parent)'));
 assert.ok(body(second).includes('"parent":{"versionId":"'+created.version.versionId+'"'));
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
 const selected=selection(),prepared=await compile(readFactory({selected})).prepare(input(),context(),{selection:selected});
 const guard=admitPreparedCitedReport(prepared,prepared.context);
 assert.equal(guard({request:prepared.request,baseVersionId:null}),undefined);
 assert.throws(()=>guard({request:{...prepared.request,title:'Substituted'},baseVersionId:null}));
 assert.throws(()=>guard({request:prepared.request,baseVersionId:uid(98)}));
 const mutated=structuredClone(prepared.context);mutated.evidence=[{...prepared.context.evidence[0],contentSha256:'e'.repeat(64)}];
 assert.throws(()=>admitPreparedCitedReport(prepared,mutated));
 assert.throws(()=>admitPreparedCitedReport(prepared,context()),'the unread selection context is not the prepared context');
 assert.throws(()=>admitPreparedCitedReport(structuredClone(prepared),prepared.context));
 assert.throws(()=>admitPreparedCitedReport({},prepared.context));
});
