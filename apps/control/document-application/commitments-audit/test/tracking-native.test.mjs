/** Actual original producer projections, typed receipts and existing DOCX lifecycle. */
import test from 'node:test';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import {fileURLToPath} from 'node:url';
import {createCommitmentsAuditCompiler} from '../compose.mjs';
import {sourcePage,makeInput,selection,unitContext,NOW,uid,mailboxId} from './fixtures.mjs';
import {resolveOperationContract} from '../../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {projectOriginalTrackingPage} from '../../../../gateway/sources/original-tracking/projection.mjs';
import {createLocalDocumentFixture} from '../../local/fixture.mjs';
import {runLocalCommitmentsAuditFlow} from '../local/flow.mjs';
const T='2026-10-01T00:00:00.000Z',hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
function nativeSource(call,{origin=true,changeTaskTitle=false}={}){
 if(!['query_tasks','query_action_items'].includes(call.operation.id))return sourcePage(call);
 const contract=resolveOperationContract(call.operation),input=contract.normalizeInput(call.request,call.normalizationContext).input,task=call.operation.id==='query_tasks';
 const content=task?{id:uid(91),title:changeTaskTitle?'Changed task same version':'Native tracked briefing',body:'Exact native task metadata',status:'done',ownerUserId:'Native owner Chen',dueDate:'2026-10-25T00:00:00.000Z',
  clientId:input.clientId,clientName:'Synthetic Client',meetingId:null,meetingTitle:null,contactId:null,mailThreadId:uid(74),sourceType:origin?'mail':null,sourceId:origin?uid(74):null,
  createdByUserId:call.binding.actorId,createdAt:T,updatedAt:T}:
  {id:uid(92),districtKey:null,clientId:input.clientId,clientName:'Synthetic Client',peCode:null,programId:null,deltaId:null,actionType:'protect_funding',issueTitle:'Native recommended follow-up',
   whatChanged:'Synthetic native change',whyItMatters:'Synthetic native relevance',recommendedAction:'Review the briefing recommendation',targetAudience:[],suggestedArtifactType:null,
   deadline:'2026-10-26T00:00:00.000Z',deadlineSource:null,ownerUserId:'Native owner Dana',priority:1,confidence:{},uncertainty:null,evidence:[],status:'outreach_completed',dismissalReason:null,
   outcome:'Native outcome text only',createdAt:T,updatedAt:T,title:'Native recommended follow-up',body:'Review the briefing recommendation'};
 const row={...content,recordKind:task?'native_task':'action_recommendation',recommendation:!task,...(task?{}:{acceptedAsTask:false}),nativeCompletion:{completed:task,
  evidence:task?'native_task_status':'recommendation_outcome_only',establishesDeliveryOrAcceptance:false,note:'Native workflow status does not verify delivery or client acceptance.'},
  sourceProof:{version:1,owner:task?'engagement_tasks':'action_recommendation',sourceRecordId:content.id,currentClientId:input.clientId,sourceVersion:T,contentSha256:hash(content),linkedSources:[]}};
 const native={tool:call.operation.id,generatedAt:new Date(call.normalizationContext.nowMs??NOW).toISOString(),clientId:input.clientId,total:1,returned:1,[task?'tasks':'actions']:[row],
  scope:task?{kind:'client',tenantId:call.binding.tenantId,actorUserId:call.binding.actorId,ownerUserId:input.ownerUserId,taskId:input.taskId,status:input.status,dueBefore:input.dueBefore,offset:0,limit:input.limit,cursorApplied:false}:
   {actionItemId:input.actionItemId,status:input.status,sort:input.sort,page:1,limit:input.limit,cursorApplied:false},
  coverage:{sourceStatus:'healthy',sourceReason:null,complete:true,partial:false,paginationComplete:true,hasMore:false,nextCursor:null,totalIsExactForScope:true,absenceSupported:false,note:'Synthetic native scoped page.'}};
 return projectOriginalTrackingPage(native,{operation:call.operation,contract,input,request:call.request,authority:{binding:call.binding,subject:call.subject},normalizationContext:call.normalizationContext},
  {requestId:uid(93),traceId:uid(94),retrievedAt:new Date(call.normalizationContext.nowMs??NOW).toISOString()});
}
async function prepare(source=nativeSource,limits={}){const context=unitContext(),selected=selection(context),compiler=createCommitmentsAuditCompiler({now:()=>NOW,readSource:source,limits});
 return compiler.prepare(makeInput(),context,{selection:selected});}
test('original task/action/Monday native rows appear visibly and preserve exact proof/identity without becoming body evidence',async()=>{
 const p=await prepare(),text=p.request.content.blocks.flatMap(b=>b.runs??[]).map(r=>r.text).join('\n');assert.equal(p.tracking.length,3);
 const task=p.tracking.find(r=>r.sourceId==='tasks'),action=p.tracking.find(r=>r.sourceId==='action_recommendation'),monday=p.tracking.find(r=>r.sourceId==='client_knowledge_monday');
 assert.equal(task.authority,'authoritative');assert.equal(task.sourceProof.owner,'engagement_tasks');assert.equal(task.nativeCompletion.completed,true);
 assert.equal(task.nativeStatusVerification,'unverified');assert.equal(task.deliveryVerified,false);assert.equal(task.acceptanceVerified,false);
 assert.equal(action.authority,'authoritative');assert.equal(action.sourceProof.owner,'action_recommendation');assert.equal(action.acceptedAsTask,false);assert.equal(action.nativeCompletion.completed,false);
 assert.equal(monday.authority,'derived');assert.equal(monday.sourceVersionId,null);assert.equal(monday.sourceProof,null);assert.equal(monday.versionStatus,'unavailable-unversioned');
 assert.deepEqual(monday.mondayMetadata.provenance,{source:'managed_monday_mcp',boardId:'101',itemId:'202'});
 assert.ok(text.includes('Native tracking appendix'));assert.ok(text.includes('Native tracked briefing'));assert.ok(text.includes('Original source proof'));assert.ok(text.includes('engagement_tasks'));
 assert.ok(text.includes('outreach_completed [unverified]')||text.includes('"outreach_completed" [unverified]'));assert.ok(text.includes('unavailable-unversioned'));
 assert.ok(!p.context.evidence.some(e=>['tasks','action_recommendation','client_knowledge_monday'].includes(e.sourceId)));assert.ok(!p.provenance.materials.some(e=>e.sourceId==='tasks'));
 assert.deepEqual(p.provenance.tracking,p.tracking);
});
test('exact native origin comparison retains unresolved version/semantics and native owner/date never resolves ledger conflicts',async()=>{
 const p=await prepare(),task=p.tracking.find(r=>r.sourceId==='tasks');assert.equal(task.linkage.status,'exact-native-origin-reference-unverified');
 assert.equal(task.linkage.sourceVersionMatch,'unavailable');assert.equal(task.linkage.semanticVerification,'requires-human-verification');
 assert.equal(p.ledger.commitments[0].owner.status,'conflicting');assert.equal(p.ledger.commitments[0].dueDate.status,'conflicting');assert.equal(p.ledger.commitments[0].completed,false);
 assert.equal(task.owner,'Native owner Chen');assert.equal(task.dueDate,'2026-10-25T00:00:00.000Z');
 const unresolved=await prepare(call=>nativeSource(call,{origin:false}));assert.equal(unresolved.tracking.find(r=>r.sourceId==='tasks').linkage.status,'unresolved');
 assert.ok(unresolved.tracking.every(r=>r.deliveryVerified===false));
});
test('source owner/hash/client tampering and derived successor substitution refuse typed original receipts',async()=>{
 for(const mutate of [p=>p.tasks[0].sourceProof.owner='action_items_complete',p=>p.tasks[0].sourceProof.contentSha256='0'.repeat(64),p=>p.tasks[0].clientId='foreign',p=>p.sources[0].authority='derived'])
  await assert.rejects(prepare(call=>{const page=structuredClone(nativeSource(call));if(call.operation.id==='query_tasks')mutate(page);return page;}));
});
test('Monday status/date/optional title remain unverified unversioned metadata with disclosed display caps',async()=>{
 const p=await prepare(call=>{const page=nativeSource(call);if(call.operation.id==='read_monday_client_boards'){const row=page.result.records[0];delete row.payload.title;
  row.payload.status='Done';row.payload.dueDate='2026-10-29';row.payload.description='Synthetic status is unverified '+('😀'.repeat(100));}return page;},{sectionCodeUnits:100});
 const monday=p.tracking.find(r=>r.sourceId==='client_knowledge_monday');assert.equal(monday.title,null);assert.equal(monday.status,'Done');assert.equal(monday.sourceProof,null);
 const text=p.request.content.blocks.flatMap(b=>b.runs??[]).map(r=>r.text).join('\n');assert.ok(text.includes('display truncated; exact native metadata retained in provenance'));assert.ok(text.isWellFormed());
 assert.equal(monday.mondayMetadata.description.includes('😀'),true);assert.equal(monday.linkage.status,'unresolved');
});
const pythonExecutable='/opt/codex/runtimes/codex-primary-runtime/dependencies/python/bin/python3',sofficeExecutable='/opt/codex/runtimes/codex-primary-runtime/dependencies/bin/override/soffice';
test('real DOCX native tracking original/revision preserves immutable bytes, typed proofs, session/revocation and every-page rendering',{timeout:120000},async()=>{
 const root=fileURLToPath(new URL('../../../../../',import.meta.url)),previous=process.env.MERI_REVIEW_SOURCE_ROOT;process.env.MERI_REVIEW_SOURCE_ROOT=root;
 let fixture,directory;try{fixture=await createLocalDocumentFixture({mode:'synthetic-local',pythonExecutable,mailboxIds:[mailboxId]});
  directory=process.env.MERI_TRACKING_OUTPUT??await mkdtemp(join(tmpdir(),'meri-native-tracking-'));
  const result=await runLocalCommitmentsAuditFlow({fixture,readSource:nativeSource,outputDirectory:directory,pythonExecutable,sofficeExecutable});
  for(const provenance of result.provenance){assert.equal(provenance.tracking.length,3);assert.ok(provenance.tracking.every(r=>r.deliveryVerified===false));}
  for(const rendered of result.rendered){assert.ok(rendered.content.paragraphs.includes('Native tracking appendix'));assert.ok(rendered.visual.pages.map(p=>p.text).join('\n').includes('engagement_tasks'));
   for(const process of rendered.processes){assert.equal(process.exitCode,0);assert.equal(process.leaderClosed,true);assert.equal(process.groupAbsent,true);}}
  const saved=await fixture.artifactOptions.versions.read(result.versions[0].versionId),context=structuredClone(fixture.artifactOptions.context);
  const conflictCompiler=createCommitmentsAuditCompiler({now:fixture.now,readBase:async()=>saved,readSource:call=>nativeSource(call,{changeTaskTitle:true})});
  await assert.rejects(conflictCompiler.prepare(makeInput(new Date(fixture.now()).toISOString()),context,{selection:selection(context),
    base:{versionId:saved.version.versionId,specSha256:saved.specSha256}}),{code:'COMMITMENTS_TRACKING_SOURCE_VERSION_CONFLICT'});
  await fixture.close();await writeFile(join(directory,'flow-receipt.json'),JSON.stringify({status:'PASS',result,cleanup:fixture.stats().cleanup},null,2)+'\n');
 }finally{if(fixture)await fixture.close();if(directory&&!process.env.MERI_TRACKING_OUTPUT)await rm(directory,{recursive:true,force:true});if(previous===undefined)delete process.env.MERI_REVIEW_SOURCE_ROOT;else process.env.MERI_REVIEW_SOURCE_ROOT=previous;}
});
test('renderer failure retains BOTH exact native tracking DOCX downloads and immutable provenance',{timeout:120000},async()=>{
 const root=fileURLToPath(new URL('../../../../../',import.meta.url)),previous=process.env.MERI_REVIEW_SOURCE_ROOT;process.env.MERI_REVIEW_SOURCE_ROOT=root;
 let fixture,directory;try{fixture=await createLocalDocumentFixture({mode:'synthetic-local',pythonExecutable,mailboxIds:[mailboxId]});directory=await mkdtemp(join(tmpdir(),'meri-tracking-retention-failure-'));
  await assert.rejects(runLocalCommitmentsAuditFlow({fixture,readSource:nativeSource,outputDirectory:directory,pythonExecutable,sofficeExecutable:'/tmp/meri-tracking-explicitly-missing-renderer'}),{code:'ARTIFACT_PROCESS_FAILED'});
  const {readFile}=await import('node:fs/promises'),provenance=JSON.parse(await readFile(join(directory,'provenance.json'),'utf8'));
  for(const [index,label]of ['original','revision'].entries()){const bytes=await readFile(join(directory,label+'.docx'));
   assert.equal(createHash('sha256').update(bytes).digest('hex'),provenance.versions[index].object.sha256);assert.equal(bytes.length,provenance.versions[index].object.bytes);}
 }finally{if(fixture)await fixture.close();if(directory)await rm(directory,{recursive:true,force:true});if(previous===undefined)delete process.env.MERI_REVIEW_SOURCE_ROOT;else process.env.MERI_REVIEW_SOURCE_ROOT=previous;}
});
