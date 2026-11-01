/** Focused real-caller test of the general long-form cited report.
 *
 * It proves the registered path end to end, not a hand-wired compile callback:
 *   the advertised SDK tool schema (runtime/selected/output-format.mjs, reached through the real worker
 *   SDK runtime) -> the selected production composition (task port -> selected control -> control
 *   selected-skill execution -> the real worker SDK runtime factory) -> the real compiler dispatch in
 *   apps/control/conversations/skills/execution.mjs -> this recipe's compiler -> the worker's own
 *   readSource/receipt seam -> the canonical retention owner and the approval proposal owner.
 *
 * Transport is scripted on purpose, exactly as the other selected-composition fixtures script it: the
 * Core read port, the install/run receipts and the task capability are fixtures here. The DTOs the port
 * returns are real production shapes and the recipe admits them with the canonical receivers; the
 * gateway's own authority is not claimed by this test. No database, provider, renderer, route, native
 * build or model call. Publication of accepted bytes through the canonical artifact owner is proven
 * separately in cited-report.test.mjs and is not duplicated here. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createSelectedControl} from '../../../../runtime/selected/control.mjs';
import {createTaskSelectedSkills} from '../../../../runtime/selected/task.mjs';
import {selectedOutputCompiler,selectedOutputFormat} from '../../../../runtime/selected/output-format.mjs';
import {admitOriginalSkill,sdkToolName} from '../../../../worker/conversation/skills/mcp.mjs';
import {createSelectedOutputRetention} from '../../../conversations/skills/retention.mjs';
import {createSelectedDocumentProposals} from '../../../conversations/skills/document-proposal.mjs';
import {createPostgresConversationStore} from '../../../conversations/postgres-store.mjs';
import {storeFixture,versions} from '../../../conversations/test/store-fixture.mjs';
import {createIntentJournal} from '../../../intents/journal.mjs';
import {createPostgresApprovalMetadataStore} from '../../../commands/approval-metadata/postgres-store.mjs';
import {createMetadataPoolFixture} from '../../../commands/approval-metadata/test/fixture.mjs';
import {citedReportManifest} from '../skill.mjs';
const citedReportSkillPin=()=>selectSkill('quick_skill.cited_report','1.0.0').pin;
import {citedReportReadGroups} from '../sources.mjs';
import {selectSkill} from '../../../../../packages/skills/index.mjs';
import {canonicalSha256 as hash} from '../../../../../packages/contracts/validate.mjs';
import {validateShape,artifactValidators as v} from '../../../../../packages/contracts/retrieval-0.2/validate.mjs';

const SEVEN=['Summary','Scope and as-of','Findings','Conflicting evidence','Recommendations','Limitations','References'];
const PROSE_SHA256='6637bc1bd277ad758a2f3c301480b5756a931e09ec2fab7408092ebf475771cd';
const NOW=Date.parse('2026-10-28T12:00:00.000Z'),stamp=new Date(NOW).toISOString();
const uid=n=>`10000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const digest=value=>hash(value);
const policy='cited-report-caller-policy-1',actor='source-reviewer',client=uid(9);
const MAILBOX=uid(20),THREAD=uid(21),MESSAGE=uid(22),PORTFOLIO=uid(30),CLAIM_RECORD=uid(31),READ_HANDLE='caller-read-handle-1';
const BODY='Review window confirmed in writing; no approval was granted on the reforecast.';
const EXCERPT=BODY.slice(0,35);
const scope=(kind,resourceId)=>({tenantId:'general-cited-report-caller',kind,resourceId,policyRevision:policy});
const scopes=[scope('client',client),scope('mailbox',MAILBOX)];
const binding={tenantId:'general-cited-report-caller',actorId:actor,conversationId:uid(1),runId:uid(2),attemptId:uid(3),workerId:uid(4),writerFence:1};
const explicitWindow={basis:'explicit',startInclusive:'2026-10-28T11:00:00.000Z',endExclusive:'2026-10-28T13:00:00.000Z',timezone:'UTC',weekStartsOn:null};
const subject=()=>({kind:'client',entityType:'client',entityIds:[client],tenantId:binding.tenantId,actorId:actor,policyRevision:policy,scopes:structuredClone(scopes),rosterVersionId:null});
const selection=()=>({subject:subject(),window:structuredClone(explicitWindow),mondayBoardIds:[]});
const context=()=>({binding,scopes,evidence:[],assets:[],deadlineMs:NOW+5000,maxBytes:1048576});
/** The real MailThreadSourcePage a stored-mail read returns; the canonical receiver admits it unchanged. */
const mailPage=request=>{const section={start:0,endExclusive:Math.min(BODY.length,2000),totalCodeUnits:BODY.length,unit:'utf16-code-unit',text:BODY,hasMore:false};
 const message={sourceId:'mail',mailboxId:MAILBOX,threadId:THREAD,messageId:MESSAGE,recordVersionId:'caller-record-version-1',citationId:uid(23),
  contentSha256:digest(BODY),scopes:structuredClone(scopes),removed:false,connectionStatus:'connected',bodyCompleteness:'full',readHandle:READ_HANDLE,section};
 return {kind:'mail-thread-source-page',contractVersion:'0.2.0',operation:{id:'mail.read_thread',version:'0.2.0'},requestId:uid(41),traceId:uid(42),
  binding:structuredClone(binding),subject:subject(),window:structuredClone(explicitWindow),argumentsSha256:v.hash(request),appliedFilters:[],
  sources:[{sourceId:'mail',authority:'authoritative',snapshotVersionId:'caller-snapshot-1',adapterVersion:'1.0.0',status:'checked',synchronizedAt:stamp,asOf:stamp,retrievedAt:stamp,freshness:'fresh'}],
  coverage:{sourcesRequested:['mail'],sourcesChecked:['mail'],sourcesUnavailable:[],enumeration:'unknown',enumerableTotal:null,returnedCount:1,truncated:false,historySupport:'supported',
   limitations:['Scripted caller transport only; actual completeness unproven.']},
  selection:{...request},order:'sentAt-asc_receivedAt-asc_createdAt-asc_nulls-and-ties-unspecified',snapshotVersionId:'caller-snapshot-1',messages:[message],
  totalMessages:null,hasMoreMessages:null,nextMessageOffset:null,nextBodyOffsets:[],continuation:{cursor:null,requiredReads:[READ_HANDLE],remainingSources:[]},evidenceReady:false,negativeAssertion:{kind:'none'}};};
/** The real portfolio evidence projection a get_research_evidence read returns. */
const portfolioResult=request=>({binding:structuredClone(binding),subject:subject(),
 data:{origin:'snapshot',id:request.recordId,portfolioId:request.portfolioId,portfolioRevision:1,contentHash:digest('caller-portfolio-content'),
  calculationVersion:'1.0.0',capturedAt:stamp,observedAt:stamp,readAt:stamp,contributions:[],
  versions:{structure:{},rules:[],decisions:[],templates:[],taxonomy:[],labels:[],sources:[]},
  limitations:['Projection only; source bytes are preserved claims.'],
  clientAccessRequirements:[],coverage:{scope:'retained_snapshot',sourceView:'retained_snapshot',corpusComplete:false,sourceBytesVerified:false,limitations:['Only retained snapshot members are projected.']}}});
const modelInput=()=>({skill:citedReportSkillPin(),title:'General long-form cited report',asOf:stamp,
 summary:'Draft summary: only the cited stored review evidence is stated; nothing else is asserted.',
 findings:[{id:'excerpt',kind:'excerpt',text:EXCERPT,citations:[{kind:'mail',threadId:THREAD,messageId:MESSAGE,start:0,end:EXCERPT.length}]},
  {id:'claim',kind:'claim',text:'The retained portfolio snapshot records no change of rating.',citations:[{kind:'portfolio-evidence',portfolioId:PORTFOLIO,origin:'snapshot',recordId:CLAIM_RECORD}]},
  {id:'mixed',kind:'claim',text:'Two stored passages describe the review differently.',citations:[{kind:'mail',threadId:THREAD,messageId:MESSAGE,start:0,end:20},{kind:'mail',threadId:THREAD,messageId:MESSAGE,start:0,end:EXCERPT.length}]}],
 conflicts:[{findingId:'mixed',note:'The two stored passages describe the review differently.'}],
 recommendations:['Confirm the review basis before committing resources.'],limitations:['Mail coverage is not exhaustive.']});

/** The registered selected production composition with scripted transport: task port, selected control,
 * control selected-skill execution, the real worker SDK runtime factory, retention and proposals. */
function composition({skillId='quick_skill.cited_report',skillVersion='1.0.0'}={}){
 const selected=selectSkill(skillId,skillVersion),request={requestId:uid(61),prompt:'Draft the general long-form cited report for the selected client.',skill:selected.pin,window:structuredClone(explicitWindow),windowRequest:null};
 const base=storeFixture(),metadata=createMetadataPoolFixture(),store=createPostgresConversationStore({pool:base.pool});
 const state={reads:[],published:[],proposals:new Map(),revoked:false,taskCalls:[]};
 const retained=createSelectedOutputRetention({journal:store.selectedOutputs,now:()=>NOW,currentOutputAccess:async()=>{throw Error('NO_OUTPUT_APPROVAL');}});
 const journal=createIntentJournal({async claim({key,record}){const k=hash(key),e=state.proposals.get(k);if(e)return {claimed:false,entry:e};state.proposals.set(k,{record,state:'PENDING',outcome:null});return {claimed:true};},
  async settle({key,record,state:next,outcome}){const row=state.proposals.get(hash(key));if(row.state!=='PENDING'||hash(row.record)!==hash(record))throw Error('JOURNAL_REFUSED');Object.assign(row,{state:next,outcome});return row;}});
 const proposals=createSelectedDocumentProposals({journal:{begin:journal.begin,settle:journal.settle},metadataStore:createPostgresApprovalMetadataStore({pool:metadata.pool}),now:()=>NOW,
  readCurrent:async()=>{if(state.revoked)throw Error('CURRENT_REFUSED');return {binding,scopes,checkedAtMs:NOW,expiresAtMs:NOW+5000};}});
 const installation={binding,skill:selected.pin,requestSha256:hash(request),selectionSha256:hash(selection()),baseCatalogSha256:selected.installationCatalogSha256,
  installationId:uid(62),executionCatalogSha256:'a'.repeat(64),operations:selected.manifest.allowedOperations.map(op=>v.snapshot(op)),checkedAtMs:NOW,expiresAtMs:NOW+5000};
 const skillRun={binding,skill:selected.pin,requestSha256:hash(request),selectionSha256:hash(selection()),manifestSha256:selected.pin.manifestSha256,catalogSha256:selected.pin.catalogSha256,
  budgets:v.snapshot(selected.manifest.budgets),policyRevision:policy,checkedAtMs:NOW,expiresAtMs:NOW+5000};
 /** Scripted Core read port: it answers exactly the operations this run is installed for, as the real
  * gateway does, and refuses anything else. The DTOs it returns are the production shapes above. */
 const core=async({operation,arguments:args})=>{
  if(!installation.operations.some(op=>hash(op)===hash(operation)))throw Object.assign(Error('UNAVAILABLE'),{code:'UNAVAILABLE'});
  if(operation.id==='mail.read_thread'&&args.subject?.entityId!==client)throw Object.assign(Error('SOURCE_REFUSED'),{code:'SOURCE_REFUSED'});
  state.reads.push({operation:v.snapshot(operation),request:structuredClone(args)});
  return JSON.stringify(operation.id==='mail.read_thread'?mailPage(args):portfolioResult(args));};
 let control;
 control=createSelectedControl({sourceEnabled:true,now:()=>NOW,
  loadCurrentTask:async value=>{state.taskCalls.push(value.operation);
   if(value.capability!=='synthetic-task-capability'||state.revoked)throw Error('CURRENT_TASK_REFUSED');
   return {binding,versions,request,scopes,selectedClientId:client,checkedAtMs:NOW,expiresAtMs:NOW+5000};},
  executionOptions:{admissionForBinding:()=>({currentSkillRun:async()=>structuredClone(skillRun)}),
   gatewayForBinding:()=>({execute:core,readForSkill:async()=>structuredClone(installation)}),
   readSelection:async()=>structuredClone(selection()),
   readContext:async()=>{if(state.revoked)throw Error('CURRENT_REFUSED');return {context:context(),checkedAtMs:NOW,expiresAtMs:NOW+5000};},
   retention:retained,proposals,defaultCongress:119,
   publishForBinding:async({output,signal})=>{const result=await control.publication.prepareEvent({binding,request,scopes,selectedClientId:client,output,signal});
    state.published.push(result);await store.append(binding,result.event,()=>{},scopes);}}});
 const task=createTaskSelectedSkills({sourceEnabled:true,now:()=>NOW,native:{call:(path,input,{signal}={})=>control.handle(path.split('/')[1],input,'synthetic-task-capability',signal)}});
 const createdAt=stamp,run={binding,state:'queued',scopes,createdAt,policyRevision:policy,versions},
  conversation={conversationId:binding.conversationId,owner:{tenantId:binding.tenantId,actorId:binding.actorId},scopes,createdAt,policyRevision:policy},
  event={contractVersion:'0.1.0',eventId:randomUUID(),binding,sequence:1,createdAt,scopes,type:'run.status',data:{state:'queued',reasonCode:null}};
 return {selected,request,base,metadata,store,retained,proposals,state,control,task,installation,skillRun,
  async open(){await store.accept({conversation,run,request,event},()=>{});
   for(const next of ['starting','running'])await store.append(binding,{eventId:randomUUID(),createdAt,type:'run.status',data:{state:next,reasonCode:null}},()=>{});},
  prepare:()=>task.prepare({binding,versions,request,scopes}),
  async close(){await task.close();await control.close();}};
}

test('the corrected cited-report identity keeps the ordinary and congressional skills exactly as they were',async()=>{
 const selected=selectSkill('quick_skill.cited_report','1.0.0');
 // The registry keys the compiler by the actual installed identity and version, never by a bare id.
 assert.equal(selectedOutputCompiler(selected),'quick_skill.cited_report');
 assert.equal(admitOriginalSkill(selected.pin),true);
 // The three pre-existing recipes and the explicit congressional version keep their own behaviour.
 assert.equal(selectedOutputCompiler(selectSkill('quick_skill.commitments_audit','1.0.0')),'quick_skill.commitments_audit');
 assert.equal(selectedOutputCompiler(selectSkill('quick_skill.relationship_brief','1.0.0')),'quick_skill.relationship_brief');
 assert.equal(selectedOutputCompiler(selectSkill('quick_skill.bill_watch','2.0.0')),'quick_skill.bill_watch');
 assert.equal(selectedOutputCompiler(selectSkill('quick_skill.bill_watch','1.1.0')),null,'the legacy congressional version stays unconnected');
 assert.equal(admitOriginalSkill(selectSkill('quick_skill.bill_watch','2.0.0').pin),true);
 assert.equal(admitOriginalSkill(selectSkill('quick_skill.bill_watch','1.1.0').pin),false);
 assert.equal(admitOriginalSkill({skillId:'quick_skill.commitments_audit',skillVersion:'1.0.0'}),true);
 assert.equal(admitOriginalSkill({skillId:'quick_skill.cited_report',skillVersion:'0.9.0'}),false);
 // The closed 0.2 foundation still refuses an identity it does not enumerate.
 assert.throws(()=>validateShape('SkillManifest',citedReportManifest()));
 // The advertised schema mirrors this recipe's own private input and carries no subject property,
 // while the explicit congressional format keeps the subject it has always had.
 const schema=selectedOutputFormat(selected);
 assert.equal(schema.type,'json_schema');
 assert.deepEqual(Object.keys(schema.schema.properties),['skill','title','asOf','summary','findings','conflicts','recommendations','limitations']);
 assert.equal(Object.hasOwn(schema.schema.properties,'subject'),false,'the subject is the trusted selected subject, never model input');
 assert.deepEqual(schema.schema.properties.skill.properties.skillId,{const:'quick_skill.cited_report'});
 assert.equal(schema.schema.properties.skill.properties.proseSha256.const,PROSE_SHA256);
 assert.deepEqual(schema.schema.properties.findings.items.properties.kind.enum,['excerpt','claim']);
 assert.equal(schema.schema.properties.findings.items.properties.citations.items.anyOf.length,3);
 assert.equal(Object.hasOwn(selectedOutputFormat(selectSkill('quick_skill.bill_watch','2.0.0')).schema.properties,'subject'),true);
 // The vetted operation list of the identity is what its read tools and its receipts are derived from.
 assert.deepEqual(selected.manifest.allowedOperations.map(sdkToolName),['mail_read_thread','get_research_evidence','create_word']);
});

test('the real selected caller compiles, retains and proposes the cited report through its own registered path',async()=>{
 const x=composition();let runtime;
 try{
  await x.open();
  runtime=await x.prepare();
  assert.ok(runtime,'the corrected identity is a connected selected skill');
  // The worker SDK runtime advertises exactly the object format above plus this recipe's own read tools.
  assert.deepEqual(runtime.sdkOptions.outputFormat,selectedOutputFormat(x.selected));
  assert.deepEqual(runtime.sdkOptions.allowedTools,x.selected.manifest.allowedOperations.map(op=>`mcp__meri_original_reads__${sdkToolName(op)}`));
  const pending=await runtime.finish({type:'result',subtype:'success',is_error:false,structured_output:modelInput()});
  // The task-visible completion is a narrow correlation receipt: it names the run identity and the read
  // digest, and never carries the prepared document, which stays inside the control until retention admits it.
  assert.equal(pending.state,'awaiting-output-approval');
  assert.match(pending.completionId,/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u);
  assert.deepEqual(pending.binding,binding);
  assert.equal(pending.requestSha256,hash(x.request));
  assert.equal(pending.selectionSha256,hash(selection()));
  assert.equal(pending.inputSha256,hash(modelInput()));
  assert.match(pending.preparationSha256,/^[a-f0-9]{64}$/u);
  assert.equal(Object.hasOwn(pending,'prepared'),false,'the prepared document is not handed to the task projection');
  // The compiler reads through the worker's own read seam: one real read per distinct cited locator, in
  // first-citation order, and nothing else. The retained receipts are asserted below, after publication.
  const groups=citedReportReadGroups(modelInput(),selection());
  assert.equal(groups.length,2);
  assert.deepEqual(groups.map(group=>group.operation.id),['mail.read_thread','get_research_evidence']);
  assert.equal(x.state.reads.length,groups.length,'the compiler read each distinct locator exactly once');
  assert.deepEqual(x.state.reads.map(read=>read.operation),groups.map(group=>group.operation));
  // Publication of the prepared identity runs the canonical retention and proposal owners.
  assert.deepEqual(await x.task.publish({binding,output:pending}),{published:true});
  assert.equal(x.state.published.length,1);
  const event=x.state.published[0].event,[proposal]=[...x.state.proposals.values()];
  assert.equal(event.type,'approval.required');
  assert.equal(event.data.proposalId,proposal.outcome.result.proposal.proposalId,'the event names the prepared proposal');
  assert.equal(event.data.commandSha256,proposal.outcome.result.proposal.commandSha256);
  assert.equal(event.data.expiresAt,proposal.outcome.result.proposal.expiresAt);
  assert.equal(proposal.state,'PREPARED');
  assert.equal(proposal.outcome.result.status,'approval_required');
  assert.equal(proposal.outcome.result.proposal.command.action,'document.draft');
  assert.equal(proposal.outcome.result.proposal.command.arguments.title,'General long-form cited report');
  // Retention wrote the one immutable selected-output row, holding the prepared document and the receipts.
  assert.equal(x.base.state.selectedOutputs.size,1);
  const row=[...x.base.state.selectedOutputs.values()][0],prepared=row.projection.prepared;
  // The immutable prepared identity is retained under its own hash: the corrected pins, the seven
  // sections in order, exact source characters and no invented evidence.
  assert.equal(row.preparation_sha256,hash(prepared),'the retained row is keyed by the prepared document it holds');
  assert.equal(row.preparation_sha256,proposal.outcome.result.proposal.command.arguments.preparationSha256);
  assert.equal(prepared.provenance.recipe,'general-cited-report');
  assert.equal(prepared.provenance.skill.skillId,'quick_skill.cited_report');
  assert.equal(prepared.provenance.skill.skillVersion,'1.0.0');
  assert.equal(prepared.provenance.skill.proseSha256,PROSE_SHA256);
  assert.deepEqual(prepared.provenance.selection,selection());
  assert.deepEqual(prepared.provenance.subject,subject());
  assert.deepEqual(prepared.context.binding,binding);
  assert.deepEqual(prepared.context.scopes,scopes);
  assert.equal(prepared.baseVersionId,null);
  assert.equal(prepared.retainedEvidence.length,0,'a first version retains no parent evidence');
  assert.equal(prepared.request.operation,'create_word');
  assert.equal(prepared.request.format,'docx');
  const headings=prepared.request.content.blocks.filter(block=>block.style==='Heading 1').map(block=>block.runs[0].text);
  assert.deepEqual(headings.slice(0,7),SEVEN);
  const text=prepared.request.content.blocks.flatMap(block=>block.runs?.map(run=>run.text)??[]).join('\n');
  assert.ok(text.includes('; verified'),'the cited stored excerpt is bound as verified');
  assert.ok(text.includes('preserved claim (source bytes verified by the projection: no)'),'the projection citation is never presented as verification');
  assert.ok(text.includes('Conflicting passage 1: '),'the named conflict carries its cited passages');
  assert.ok(text.includes('Cited passage (UTF-16 characters 0-35): '),'the exact source characters are pinned in the document');
  assert.ok(text.includes('Meri cited report provenance: '),'immutable revision provenance is pinned in the document');
  assert.equal(prepared.reads.length,groups.length,'the compiled reads are the receipts of this run');
  const reads=row.projection.reads;
  assert.equal(reads.length,groups.length,'the retained reads are the worker receipts, not a re-derivation');
  assert.equal(pending.readsSha256,hash(reads),'the completion receipt pins exactly these retained receipts');
  const deliveryIds=new Set();
  for(const read of reads){
   assert.match(read.deliveryId,/^compiler:[a-f0-9]{64}$/u);
   assert.equal(hash(read.result),read.resultSha256);
   assert.ok(x.selected.manifest.allowedOperations.some(op=>hash(op)===hash(read.operation)));
   assert.deepEqual(read.result.binding,binding);
   assert.deepEqual(read.result.subject,subject());
   deliveryIds.add(read.deliveryId);}
  assert.equal(deliveryIds.size,reads.length);
  assert.deepEqual(reads.map(read=>read.operation),x.state.reads.map(read=>read.operation),'the port was asked for exactly the operations the compiler needed');
  assert.deepEqual(reads.map(read=>read.request),x.state.reads.map(read=>read.request));
  for(const compiled of prepared.reads)
   assert.ok(reads.some(read=>hash(read.operation)===hash(compiled.operation)&&hash(read.request)===hash(compiled.request)&&read.resultSha256===compiled.resultSha256),
    'every compiled read matches a retained receipt of this run');
  assert.equal(x.metadata.rows.size,1);
  await runtime.close();runtime=undefined;
 }finally{await runtime?.close();await x.close();}
});

test('the same registered path keeps the ordinary recipes and the explicit congressional version working',async()=>{
 for(const [skillId,skillVersion,connected] of [['quick_skill.commitments_audit','1.0.0',true],['quick_skill.relationship_brief','1.0.0',true],['quick_skill.bill_watch','2.0.0',true],['quick_skill.bill_watch','1.1.0',false]]){
  const x=composition({skillId,skillVersion});let runtime;
  try{await x.open();runtime=await x.prepare();
   if(!connected){assert.equal(runtime,null,`${skillId}@${skillVersion} stays unconnected`);assert.equal(x.state.taskCalls.length,0,'an unconnected version performs no RPC');continue;}
   assert.ok(runtime,`${skillId}@${skillVersion} still prepares through the same port`);
   assert.equal(runtime.sdkOptions.outputFormat.type,'json_schema');
   assert.equal(runtime.sdkOptions.allowedTools.every(name=>name.startsWith('mcp__meri_original_reads__')),true);
   await runtime.close();runtime=undefined;
  }finally{await runtime?.close();await x.close();}
 }
});
