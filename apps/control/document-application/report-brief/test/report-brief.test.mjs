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
import {artifactValidators as v} from '../../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {nativeReportPort,REVISION} from './native-source-fixture.mjs';
import {canonicalSha256} from '../../../../../packages/contracts/validate.mjs';
import {assertSelectedOutput} from '../../../../../packages/contracts/selected-skills/validate.mjs';
import {createOriginalSelectedSkillExecution} from '../../../conversations/skills/execution.mjs';
import {selectSkill} from '../../../../../packages/skills/index.mjs';
import {createArtifactService} from '../../../../artifacts/service.mjs';
import {nativeDocumentFixture,sha} from '../../../../artifacts/test/native-document-fixture.mjs';
const NOW=Date.parse('2026-10-13T12:00:00.000Z'),stamp=new Date(NOW).toISOString();
const uid=n=>`10000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const digest=value=>createHash('sha256').update(value).digest('hex');
const client=uid(9),policy='report-policy-1';
const texts={bill_text:'Original independent source: Δ research 🛰 requires an authorization review. No appropriation amount is stated.',
 federal_legislation:'Independent status source: the enacted stage has not been established.'};
const subject={congress:119,session:2,billId:'119-s-88',billVersion:'is',fiscalYear:2028,budgetStage:'authorized'};
// The canonical selected subject/window of the run, exactly as the real caller supplies it.
const selection=()=>({subject:{kind:'client',entityType:'client',entityIds:[client],tenantId:'independent-report',actorId:'source-reviewer',policyRevision:policy,scopes:context().scopes,rosterVersionId:null},
 window:{basis:'explicit',startInclusive:'2026-10-13T11:00:00.000Z',endExclusive:'2026-10-13T13:00:00.000Z',timezone:'UTC',weekStartsOn:null},mondayBoardIds:['101']});
function context(){return {binding:{tenantId:'independent-report',actorId:'source-reviewer',conversationId:uid(1),runId:uid(2),attemptId:uid(3),workerId:uid(4),writerFence:1},
 scopes:[{tenantId:'independent-report',kind:'client',resourceId:client,policyRevision:policy}],evidence:[],assets:[],deadlineMs:NOW+5000,maxBytes:1048576};}
function input(at=stamp){return {skill:reportSkillPin(),title:'Independent sourced cited report',subject:structuredClone(subject),asOf:at,
 summary:'Draft summary: the authorization basis is recorded; no appropriation amount was read.',
 findings:[{id:'excerpt',kind:'excerpt',text:texts.bill_text,citations:[citation('bill_text')]},
  // Two unequal excerpts of the same pinned revision: disclosed as a possible conflict, not a verdict.
  {id:'claim',kind:'claim',text:texts.bill_text,citations:[citation('bill_text'),citation('bill_text',texts.bill_text.slice(0,-7))]},
  {id:'missing',kind:'excerpt',text:'No budget evidence was read.',citations:[citation('program_elements','No budget evidence was read.')]}],
 conflicts:[{findingId:'claim',note:'Two sources describe the same stage differently.'}],
 recommendations:['Confirm the appropriations basis before committing resources.'],
 limitations:['State docket coverage is not exhaustive.']};}
// The report reads through the exact selected-runtime request shape and the actual gateway handlers, over
// synthetic Core DTOs. The saved selection is the run's own canonical subject/window.
const savedSelection=()=>({binding:context().binding,subject:selection().subject,window:selection().window});
const port=()=>nativeReportPort({saved:savedSelection(),bill:subject,text:texts.bill_text});
const mainPort=port();
const read=mainPort.readSource;
/** The immutable identity of each native record the synthetic transport serves. */
const versionOf=sourceId=>sourceId==='bill_text'?REVISION:'2026-10-12T12:00:00.000Z';
const citation=(sourceId,text=texts[sourceId])=>({sourceId,recordId:subject.billId,sourceVersionId:versionOf(sourceId),start:0,end:text.length,url:'https://example.invalid/never-fetched'});
// The real caller always supplies the canonical selection; default it here and keep the option overridable.
const withSelection=inner=>({prepare:(i,c,options={})=>inner.prepare(i,c,{selection:selection(),...options})});
const compiler=readSource=>withSelection(createCongressionalReportCompiler({readSource:readSource??read,now:()=>NOW}));
const bodyText=p=>p.request.content.blocks.flatMap(b=>b.runs?.map(r=>r.text)??[]).join('\n');
const headings=p=>p.request.content.blocks.filter(b=>b.style==='Heading 1').map(b=>b.runs[0].text);
let renders=0;
const docxExecutor={async execute(x){renders++;const bytes=Buffer.from(JSON.stringify(x.request.content.blocks));
 return {bytes,inspection:{sha256:sha(bytes),bytes:bytes.length,format:'docx',nativeOpened:false,rendered:false,recalculated:false,members:[],details:{paragraphs:x.request.content.blocks.length,tables:0,pictures:0}}};}};

test('the accepted seven-section cited report is produced in order with citations, conflicts and limitations',async()=>{
 const calls=[],result=await compiler(call=>{calls.push(call);return read(call);}).prepare(input(),context());
 // Exactly the addressable declared sources are read, in declared order, through the native operations.
 assert.deepEqual(reportSourceIds,['bill_text','federal_legislation','program_elements']);
 assert.deepEqual(calls.map(c=>c.operation.id),['read_bill_text','get_bill_status']);
 assert.deepEqual(headings(result),[...REPORT_SECTIONS]);
 assert.deepEqual(result.context.evidence.length,2);
 for(const item of result.context.evidence)v.nativeSourceEvidence(item);
 assert.equal(result.findings[0].status,'bound-excerpt');assert.equal(result.findings[1].status,'unverified-claim');assert.equal(result.findings[1].conflict,true);
 assert.equal(result.findings[2].status,'missing-evidence');assert.deepEqual(result.conflicts.map(c=>c.findingId),['claim']);
 assert.equal(result.findings[0].links[0].passageSha256,digest(Buffer.from(texts.bill_text)));
 assert.deepEqual(result.provenance.subject,subject);assert.deepEqual(result.provenance.skill,reportSkillPin());assert.equal(result.baseVersionId,null);
 assert.equal(result.provenance.retainedEvidenceSha256,v.hash([]));
 // The prepared object is exactly the shape the shared selected-output admission accepts.
 assert.deepEqual(Object.keys(result).sort(),['baseVersionId','conflicts','context','coverage','findings','provenance','reads','request','retainedEvidence']);
 const document=bodyText(result);
 for(const label of ['Sourced cited report | Draft for review','Congress 119 | Session 2 | 119-s-88 | Bill version is | FY 2028 | Budget stage authorized',
  'Two sources describe the same stage differently.','Conflicting passage 1: '+texts.bill_text,'Conflicting passage 2: '+texts.bill_text.slice(0,-7),
  'Confirm the appropriations basis before committing resources.','Stated limitation: State docket coverage is not exhaustive.','Read limitation: Pinned text SHA256',
  'program_elements: status not-read (NO_CANONICAL_SELECTOR)','Stored bill status: Introduced','Cited passage (UTF-16 characters','locator URL (not verification)','Original skill and immutable revision provenance'])assert(document.includes(label),label);
 assert(document.includes(texts.bill_text));
 assert(document.includes('bill_text pinned identity: bill 119-s-88; revision '+REVISION+'; version is;'));
});
test('a named conflict must attach to a finding that is genuinely in conflict',async()=>{
 const i=input();i.conflicts=[{findingId:'excerpt',note:'Not actually in conflict.'}];
 await assert.rejects(compiler().prepare(i,context()),/REPORT_CONFLICT/);
 const duplicate=input();duplicate.conflicts=[{findingId:'claim',note:'one'},{findingId:'claim',note:'two'}];
 await assert.rejects(compiler().prepare(duplicate,context()),/REPORT_CONFLICT/);
 const unknown=input();unknown.conflicts=[{findingId:'other',note:'unknown finding'}];
 await assert.rejects(compiler().prepare(unknown,context()),/REPORT_CONFLICT/);
});
// Every one of these is a substitution inside the native reply the compiler actually receives. The report
// may not launder a foreign run, a changed request, another bill/version or unequal text into evidence.
for(const [label,edit,expected]of [
 ['foreign actor',w=>{w.binding.actorId='foreign';},/REPORT_SOURCE_BINDING/],
 ['foreign tenant',w=>{w.binding.tenantId='foreign';},/REPORT_SOURCE_BINDING/],
 ['other run',w=>{w.binding.runId=uid(90);},/REPORT_SOURCE_BINDING/],
 ['changed arguments',w=>{w.argumentsSha256='e'.repeat(64);},/REPORT_SOURCE_ARGUMENTS/],
 ['source operation',w=>{w.operation=reportReadOperation('federal_legislation');},/REPORT_SOURCE_OPERATION/],
 ['subject substitution',w=>{w.subject.entityIds=[uid(78)];},/REPORT_SOURCE_CONTEXT/],
 ['bill identity substitution',w=>{w.result.billId=uid(78);},/REPORT_SOURCE_(SELECTOR|RESULT)/],
 ['bill version substitution',w=>{w.result.versionCode='rs';},/REPORT_SOURCE_(VERSION|RESULT)/],
 ['text substitution',w=>{w.result.text+=' altered';},/REPORT_SOURCE_(TEXT_HASH|RESULT)/],
 ['continuation gap',w=>{w.result.coverage.locator.endOffset-=1;w.result.text=w.result.text.slice(1);},/REPORT_SOURCE_(CONTINUITY|RESULT)/],
])test('refusal: '+label,async()=>{
 let reads=0;const substituting=async call=>{reads++;const value=structuredClone(await read(call));if(call.operation.id==='read_bill_text')edit(value);return value;};
 await assert.rejects(compiler(substituting).prepare(input(),context()),expected);assert.equal(reads,1);
});
test('recipe/prose/catalog pins and future as-of refuse before source dispatch',async()=>{
 for(const [mutate,expected] of [[i=>{i.skill={...i.skill,skillVersion:'9.0.0'};},0],[i=>{i.skill={...i.skill,manifestSha256:'a'.repeat(64)};},0],
  [i=>{i.asOf='2026-10-13T12:00:01.000Z';},0],[i=>{i.conflicts=[{findingId:'excerpt',note:'x'}];},2]]){
  const i=input();mutate(i);let count=0;await assert.rejects(compiler(c=>{count++;return read(c);}).prepare(i,context()));
  assert.equal(count,expected);
 }
 const prose=await readFile(new URL('../SKILL.md',import.meta.url));
 assert.equal(digest(prose),reportManifest().prose.sha256);
 assert.equal(reportManifest().prose.id,'urn:meri:original:sourced-cited-report:1.0.0');
 // The recipe is installed as its own version (quick_skill.bill_watch 2.0.0) whose manifest and prose are this
 // recipe's own bytes; it never presents itself as the sourced brief prose of the installed 1.0.0 pin.
 assert.deepEqual({skillId:reportManifest().skillId,skillVersion:reportManifest().skillVersion},{skillId:reportSkillPin().skillId,skillVersion:reportSkillPin().skillVersion});
 assert.equal(selectSkill(reportManifest().skillId,reportManifest().skillVersion).pin.proseSha256,reportSkillPin().proseSha256);
 assert.equal(v.hash(reportManifest()),reportSkillPin().manifestSha256);
 const briefPin=selectSkill('quick_skill.bill_watch','1.0.0').pin;
 assert.equal(reportSkillPin().catalogSha256,selectSkill(reportManifest().skillId,reportManifest().skillVersion).installationCatalogSha256);
 assert.notEqual(reportSkillPin().proseSha256,briefPin.proseSha256);
 assert.notEqual(reportSkillPin().manifestSha256,briefPin.manifestSha256);
 assert.equal(digest(await readFile(new URL('../../research-brief/SKILL.md',import.meta.url))),briefPin.proseSha256);
 assert.equal(briefPin.manifestSha256,v.hash(JSON.parse(await readFile(new URL('../../research-brief/manifest.json',import.meta.url),'utf8'))));
});
const writeCall=p=>({action:'artifact.generate',resource:{versionId:null},binding:p.context.binding,scopes:p.context.scopes,requestSha256:v.nativeRequestSha256(p.request,p.context,null)});
test('prepared guard and binder pin the exact request, context, base and retained-evidence admission',async()=>{
 const p=await compiler().prepare(input(),context()),guard=admitPreparedReport(p,p.context);
 guard({request:p.request,baseVersionId:null});
 assert.equal(preparedReportEvidenceSha256(p),v.hash(p.context.evidence));
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
 const parent={versionId:created.version.versionId,specSha256:retained.specSha256};
 // A revision is a different attempt of the same conversation: the parent's evidence is earlier-run
 // evidence, so the canonical owner admits it only through the bound retained-evidence admission.
 const revisionContext={...f.context,binding:{...f.context.binding,runId:uid(5),attemptId:uid(6)}};
 let dispatched=0;const countingRead=call=>{dispatched++;return read(call);};
 const before=dispatched;
 for(const bad of [{...parent,specSha256:'a'.repeat(64)}])await assert.rejects(createCongressionalReportCompiler({readSource:countingRead,readBase,now:()=>NOW}).prepare(next,f.context,{selection:selection(),base:bad}));
 const rollback=structuredClone(next);rollback.asOf='2026-10-12T00:00:00.000Z';
 await assert.rejects(createCongressionalReportCompiler({readSource:countingRead,readBase,now:()=>NOW}).prepare(rollback,f.context,{selection:selection(),base:parent}));
 const changedSubject=structuredClone(next);changedSubject.subject.budgetStage='appropriated';
 await assert.rejects(createCongressionalReportCompiler({readSource:countingRead,readBase,now:()=>NOW}).prepare(changedSubject,f.context,{selection:selection(),base:parent}));
 assert.equal(dispatched,before);
 // Citation identity is per evidence instance, so a revision re-reads and binds its own evidence; the
 // parent's retained evidence keeps its own identity and can never be re-presented as newly read.
 // The revision is a different attempt of the same conversation, so its own run binding is what the port checks.
 const revisionRead=nativeReportPort({saved:{binding:revisionContext.binding,subject:selection().subject,window:selection().window},bill:subject,text:texts.bill_text}).readSource;
 const second=await createCongressionalReportCompiler({readSource:revisionRead,readBase,now:()=>NOW}).prepare(next,revisionContext,{selection:selection(),base:parent});
 assert.notEqual(second.context.evidence[second.retainedEvidence.length].citationId,created.version.evidence[0].citationId);
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

// The real control caller (apps/control/conversations/skills/execution.mjs) composed with synthetic Core
// and source boundaries: current selection -> the recipe's own compiler -> priced provenance.selection ->
// the canonical pending-output identity -> approval/retention. Publication of the accepted bytes through
// the canonical artifact owner is covered by the ledger test above and is not duplicated here.
test('the real report caller composes the selected run, its reads and the canonical pending output',async()=>{
 const binding=context().binding,scopes=context().scopes,chosen=selection();
 const versions={imageDigest:'sha256:'+'a'.repeat(64),sdk:'0.3.295',cli:'2.1.295',contracts:'0.1.0',skillsDigest:'b'.repeat(64),checkpointFormat:'0.1.0'};
 const request={skill:reportSkillPin(),window:chosen.window,reason:'Draft the cited report for the selected bill identity.'};
 const retained=[],delivered=[],order=[];
 const pendingFor=call=>({state:'awaiting-output-approval',sourceBinding:binding,skill:request.skill,requestSha256:canonicalSha256(request),
  selectionSha256:canonicalSha256(chosen),inputSha256:call.inputSha256,preparationSha256:call.preparationSha256,
  artifactRequestSha256:canonicalSha256(call.prepared.request),baseVersionId:call.prepared.baseVersionId,prepared:call.prepared});
 const setup=(runtimeFactory,runRequest=request)=>createOriginalSelectedSkillExecution({now:()=>NOW,defaultCongress:119,readSelection:async()=>{order.push('selection');return structuredClone(chosen);},
  readContext:async()=>{order.push('context');return {context:structuredClone(context()),checkedAtMs:NOW,expiresAtMs:NOW+5000};},
  admissionForBinding:()=>({currentSkillRun:async()=>{order.push('current-skill-run');return {};}}),
  gatewayForBinding:()=>({execute:async()=>'{}',readForSkill:async()=>'{}'}),
  retention:{retain:async value=>{order.push('retain');retained.push(value);}},
  proposals:{prepare:async value=>{order.push('proposal');assert.equal(value.prepared,delivered[0].prepared);return {proposalId:uid(31),commandSha256:'c'.repeat(64),expiresAt:new Date(NOW+1000).toISOString()};}},
  publishForBinding:async()=>({published:true}),
  outputBridge:{deliver:async call=>{order.push('deliver');delivered.push(call);return pendingFor(call);},read:async()=>{throw Error('SYNTHETIC_READ_NOT_USED');}},
  runtimeFactory});
 const runtimeFactoryFor=selectionOverride=>async({compileArtifact,artifactOutput,selection:runtimeSelection,request:runtimeRequest,binding:runtimeBinding,scopes:runtimeScopes})=>{
  assert.equal(runtimeRequest.skill.skillId,reportSkillPin().skillId);
  const prepared=await compileArtifact({skill:runtimeRequest.skill,input:input(),readSource:read,selection:selectionOverride??runtimeSelection,
   binding:runtimeBinding,scopes:runtimeScopes,deadlineMs:NOW+4000});
  const pending=await artifactOutput.deliver({prepared,binding:runtimeBinding,reads:[],preparationSha256:canonicalSha256(prepared),
   inputSha256:canonicalSha256(input()),requestSha256:canonicalSha256(request),selectionSha256:canonicalSha256(chosen)});
  return {prepared,pending,async close(){}};
 };
 const execution=setup(runtimeFactoryFor());
 try{
  const runtime=await execution.selectedSkills.prepare({binding,versions,request,scopes});
  assert.deepEqual(runtime.prepared.provenance.selection,chosen);
  assert.equal(runtime.prepared.provenance.inputSha256,canonicalSha256(input()));
  assert.equal(runtime.prepared.provenance.skill.skillVersion,'2.0.0');
  assert.equal(delivered.length,1);
  // the canonical contract accepts the identity the real caller hands to approval/retention
  const accepted=assertSelectedOutput(runtime.pending,{binding,request,selection:chosen,inputSha256:canonicalSha256(input()),prepared:runtime.prepared});
  assert.equal(accepted.state,'awaiting-output-approval');
  const publication=await execution.publication.prepareEvent({binding,request,scopes,selectedClientId:chosen.subject.entityIds[0],output:runtime.pending});
  assert.equal(publication.event.type,'approval.required');
  assert.equal(retained.length,1);assert.equal(retained[0].pending.preparationSha256,canonicalSha256(runtime.prepared));
  assert.equal(retained[0].reads.length,0);
  assert.deepEqual(order,['selection','context','deliver','retain','proposal']);
  assert.deepEqual(await execution.selectedSkills.publish({binding,request,scopes,selectedClientId:chosen.subject.entityIds[0],output:runtime.pending}),{published:true});
  await runtime.close();
 }finally{await execution.close();}
 // a foreign selection never reaches the compiler, and an ordinary version is not connected
 const foreign=setup(async({compileArtifact,binding:rb,scopes:rs,selection:sel})=>{
  await compileArtifact({skill:request.skill,input:input(),readSource:read,selection:{...sel,mondayBoardIds:['999']},binding:rb,scopes:rs,deadlineMs:NOW+4000});
  throw Error('UNREACHABLE');
 });
 try{await assert.rejects(foreign.selectedSkills.prepare({binding,versions,request,scopes}),{code:'SKILL_COMPILER_CONTEXT_REFUSED'});}
 finally{await foreign.close();}
 const legacySkill=selectSkill('quick_skill.bill_watch','1.1.0').pin,legacyRequest={...request,skill:legacySkill};
 const unconnected=setup(async({compileArtifact,binding:rb,scopes:rs,selection:sel})=>{
  await compileArtifact({skill:legacySkill,input:input(),readSource:read,selection:sel,binding:rb,scopes:rs,deadlineMs:NOW+4000});
  throw Error('UNREACHABLE');
 },legacyRequest);
 try{await assert.rejects(unconnected.selectedSkills.prepare({binding,versions,request:legacyRequest,scopes}),{code:'SKILL_NOT_CONNECTED'});}
 finally{await unconnected.close();}
 // the recipe's own selection guard refuses selected identities it cannot account for
 await assert.rejects(compiler().prepare(input(),context(),{selection:{...chosen,mondayBoardIds:Array.from({length:101},(_,i)=>`board-${i}`)}}),/REPORT_SELECTION/);
 await assert.rejects(compiler().prepare(input(),context(),{selection:{...chosen,mondayBoardIds:['101','101']}}),/REPORT_SELECTION/);
});
