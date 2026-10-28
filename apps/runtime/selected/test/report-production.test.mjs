/** Production-path proof for the sourced cited report (Bill Watch 2.0.0).
 * Everything here is a real owner: the assembled control (createNativeSelectedComposition), the advertised
 * selected output schema, the canonical selected runtime, the private reads client/owner, the real gateway
 * dispatch over the real bill-text and federal-legislation handlers, the report compiler with its native
 * source receiving session, the selected-output retention/proposal owners, and the private saved-revision
 * source owner. Only the Core transport (scripted DTO/HTTP), the execution authority and the renderer are
 * synthetic. No provider, database, credential, model or browser effect is exercised. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import Ajv from 'ajv';
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
import {artifactValidators as v} from '../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {selectSkill} from '../../../../packages/skills/index.mjs';
import {reportSkillPin} from '../../../control/document-application/report-brief/skill.mjs';
import {createArtifactService} from '../../../artifacts/service.mjs';
import {nativeDocumentFixture,sha} from '../../../artifacts/test/native-document-fixture.mjs';
import {createActionSessionOwner} from '../../../control/action-host/session/owner.mjs';
import {createDocumentRevisionRunOwner} from '../../artifacts/revision-composition.mjs';
import {applicationFixture} from '../../../control/conversations/test/application-fixture.mjs';
import {compositionFixture} from './composition-fixture.mjs';
import {REPORT_NOW,REPORT_REVISION,REPORT_STAMP,REPORT_SUBJECT,REPORT_TEXTS,reportRunBinding,reportRuntimeFixture,generalReportInput} from './report-production-fixture.mjs';

const uid=n=>`10000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const bill=REPORT_SUBJECT,texts=REPORT_TEXTS;
const versionOf=sourceId=>sourceId==='bill_text'?REPORT_REVISION:'2026-10-12T12:00:00.000Z';
const citation=(sourceId,text=texts[sourceId])=>({sourceId,recordId:bill.billId,sourceVersionId:versionOf(sourceId),start:0,end:text.length,url:'https://example.invalid/never-fetched'});
/** The literal structured output the run's model returns: the seven-section cited report. */
function reportInput(){return {skill:reportSkillPin(),title:'Independent sourced cited report',subject:structuredClone(bill),asOf:REPORT_STAMP,
 summary:'Draft summary: the authorization basis is recorded; no appropriation amount was read.',
 findings:[{id:'excerpt',kind:'excerpt',text:texts.bill_text,citations:[citation('bill_text')]},
  {id:'claim',kind:'claim',text:texts.bill_text,citations:[citation('bill_text'),citation('bill_text',texts.bill_text.slice(0,-7))]},
  {id:'missing',kind:'excerpt',text:'No budget evidence was read.',citations:[citation('program_elements','No budget evidence was read.')]}],
 conflicts:[{findingId:'claim',note:'Two sources describe the same stage differently.'}],
 recommendations:['Confirm the appropriations basis before committing resources.'],
 limitations:['State docket coverage is not exhaustive.']};}
/** Scripted DOCX renderer: real artifact owner, synthetic bytes. Native rendering is a separate qualification. */
const docxExecutor={async execute(x){const bytes=Buffer.from(JSON.stringify(x.request.content.blocks));
 return {bytes,inspection:{sha256:sha(bytes),bytes:bytes.length,format:'docx',nativeOpened:false,rendered:false,recalculated:false,members:[],details:{paragraphs:x.request.content.blocks.length,tables:0,pictures:0}}};}};
const retainedRows=x=>[...x.base.state.selectedOutputs.values()].map(row=>row.projection);

/** Run one production report turn and return the retained journal row. */
async function productionRun(options={}){
 const x=await compositionFixture('',{report:options.report??{}});
 try{
 const runtime=await x.prepare(),output=await runtime.finish({type:'result',subtype:'success',is_error:false,structured_output:options.input??reportInput()});
 await x.task.publish({binding:x.f.configuration.binding,output});
 return {x,runtime,outputFormat:runtime.sdkOptions.outputFormat,output,row:retainedRows(x)[0]};
 }catch(error){await x.close();throw error;}
}
/** The parent report version, written through the canonical artifact owner from the production report. */
async function writeParent(prepared,revisionBinding){
 const doc=nativeDocumentFixture({binding:revisionBinding,scopes:prepared.context.scopes});
 // The report run's own clock: the artifact owner must be current when the prepared deadline applies.
 doc.state.clock=REPORT_NOW;
 // The retained context is the prepared report's own evidence, admitted by exact hash: the canonical
 // report binder does the same against the live object it was handed.
 const admitRetainedEvidence=contextValue=>v.hash(contextValue)===v.hash(prepared.context)?undefined:1;
 const service=createArtifactService({...doc.options,executor:docxExecutor,admitRetainedEvidence,ids:()=>({artifactId:randomUUID(),versionId:randomUUID(),objectId:randomUUID()})});
 const created=await service.create(prepared.request,prepared.context,{invocation:{invocationId:'sdk:'+hash({deliveryId:randomUUID()}),versionId:undefined,
  requestSha256:v.nativeRequestSha256(prepared.request,prepared.context,null)}});
 return {doc,created,selection:{artifactId:created.version.artifactId,versionId:created.version.versionId,objectSha256:created.version.object.sha256}};
}
/** The real private revision owner over the real action-session, artifact and document-bound options. */
function revisionOwner({doc,binding,scopes,selection,request,state}){
 const now=doc.options.now,expiry=now()+30000;
 const sessions=createActionSessionOwner({mode:'process-local',now,refusals:()=>{},limits:{maxSessions:8,maxRequestMs:5000,maxTtlMs:30000,maxFactBytes:131072},
  async verifyIdentity(){if(state.revoked)throw Error('DENIED');return {principal:{tenantId:binding.tenantId,actorId:binding.actorId},identityRevision:'current',checkedAtMs:now(),expiresAtMs:expiry};},
  async resolveContext({identity}){return {identitySha256:hash(identity),binding,scopes,selectedClientId:scopes[0].resourceId,contextRevision:'current',checkedAtMs:now(),expiresAtMs:expiry};}});
 state.saved={run:{binding,scopes},request};
 const store={async read(_binding,_query,check){state.sourceReads++;check();return structuredClone(state.saved);}};
 const limits={maxRequestMs:5000,maxRequestBytes:2097152,maxResponseBytes:16777216};
 const optionsOwner={async resolve(call){assert.equal(call.intent,'inspect');
  return {documentOptions:{sessions,selectedClientId:scopes[0].resourceId,artifactOptions:{...doc.options,ids:()=>({artifactId:randomUUID(),versionId:randomUUID(),objectId:randomUUID()})},now,limits,enabled:true},
   async recheck({phase}){state.phases.push(phase);}};}};
 const owner=createDocumentRevisionRunOwner({bound:()=>({sessions,store}),optionsOwner,now,limits});
 return {owner,sessions,selection,async open(){return sessions.issue({identityCredential:'synthetic-native',hints:{conversationId:binding.conversationId,runId:binding.runId,clientId:scopes[0].resourceId}});}};
}

test('the production selected factory receives the congressional sources through the real native gateway and retains the pending report',async t=>{
 const {x,outputFormat,output,row}=await productionRun();
 t.after(()=>x.close());
 // The runtime the caller is handed advertises exactly the selected report schema (sourceVersionId, not recordVersionId).
 const advertised=x.f.configuration.request.skill,selected=selectSkill(advertised.skillId,advertised.skillVersion);
 const validate=new Ajv({strict:false}).compile(outputFormat.schema);
 assert.equal(outputFormat.type,'json_schema');
 assert.equal(validate(reportInput()),true,JSON.stringify(validate.errors));
 const wrong=structuredClone(reportInput());wrong.findings[0].citations[0].recordVersionId=wrong.findings[0].citations[0].sourceVersionId;
 delete wrong.findings[0].citations[0].sourceVersionId;
 assert.equal(validate(wrong),false,'the advertised schema must not accept recordVersionId as the citation pin');
 assert.deepEqual(selected.pin,reportSkillPin());
 // Both declared, addressable sources were read through the real dispatch and the real handlers.
 assert.equal(x.f.state.reads,2);
 const envelope=JSON.parse(x.f.state.wire[0].wire);
 assert.deepEqual(Object.keys(envelope).sort(),['argumentsSha256','binding','operation','result','subject']);
 assert.equal(envelope.operation.id,'read_bill_text');
 assert.equal(envelope.result.billId,bill.billId);assert.equal(envelope.result.revisionId,REPORT_REVISION);
 assert.equal(envelope.result.textHash,sha(Buffer.from(texts.bill_text)));
 assert.equal(x.f.state.released>=4,true,'the read context is re-observed at admission and release');
 // The pending output is the canonical journal row, with the compiler's own coverage and evidence.
 assert.equal(output.state,'awaiting-output-approval');
 assert.deepEqual(Object.keys(output).sort(),['binding','completionId','inputSha256','preparationSha256','readsSha256','requestSha256','selectionSha256','state']);
 assert.equal(retainedRows(x).length,1);assert.equal(x.intents.state.rows.size,1);assert.equal(x.metadata.rows.size,1);
 assert.equal(row.pending.state,'awaiting-output-approval');assert.equal(Object.hasOwn(row.pending,'prepared'),false);
 assert.equal(row.pending.baseVersionId,null);
 const coverage=row.prepared.coverage.find(source=>source.sourceId==='bill_text');
 assert.equal(coverage.status,'read');assert.equal(coverage.pin.sourceVersionId,REPORT_REVISION);assert.equal(coverage.coverage.complete,true);
 assert.equal(row.prepared.coverage.find(source=>source.sourceId==='program_elements').status,'not-read');
 // Every evidence item is the artifact NativeSourceEvidence shape minted from what Core returned.
 assert.deepEqual(Object.keys(row.prepared.context.evidence[0]).sort(),['binding','citationId','contentSha256','observedAt','recordId','scopes','sourceId','sourceUpdatedAt','sourceVersionId']);
 assert.equal(row.prepared.context.evidence.some(item=>Object.hasOwn(item,'authorizationDecisionId')||Object.hasOwn(item,'adapterVersion')),false);
 assert.equal(row.prepared.context.evidence[0].sourceUpdatedAt,null);
 assert.match(row.prepared.context.evidence[0].observedAt,/^2026-10-12T01:00:00\.000Z$/);
 // The compiler's read mirror is what retention hashed and matched against the runtime receipts.
 assert.equal(hash(row.prepared.reads),row.prepared.provenance.readsSha256);
 assert.equal(row.prepared.reads.length,2);
});

/** Admit the browser-shaped request through the actual HTTP application and canonical stored-request owner.
 * Its transport/session authority is a fixture, and no dispatcher starts a workflow. The returned immutable request
 * is consumed unchanged by the production selected factory below, rather than inventing a selected run DTO. */
async function publiclyAccepted(t,report){
 const f=reportRuntimeFixture(report),app=await applicationFixture({initialInput:true,binding:f.binding,scopes:f.scopes,selectedClientId:f.scopes[0].resourceId});
 t.after(()=>app.close());
 const wire={requestId:uid(61),prompt:f.request.prompt,skill:{skillId:f.request.skill.skillId,skillVersion:f.request.skill.skillVersion},
  windowRequest:{basis:'explicit',startInclusive:f.selection.window.startInclusive,endExclusive:f.selection.window.endExclusive,timezone:'UTC'},
  ...(report.documentRevision?{documentRevision:report.documentRevision}:{})};
 await app.service.allocateInput({credential:app.credential,input:wire});
 const response=await app.post('submit',wire),body=await response.json();
 assert.equal(response.status,200,JSON.stringify(body));
 const saved=await app.service.history({credential:app.credential});
 assert.deepEqual(saved.request.skill,selectSkill(wire.skill.skillId,wire.skill.skillVersion).pin);
 assert.deepEqual(saved.request.documentRevision,wire.documentRevision);
 return saved.request;
}

for(const skillId of ['quick_skill.bill_watch','quick_skill.cited_report'])test(`${skillId}: public request reaches the actual factory and revises its current retained original`,async t=>{
 const input=skillId==='quick_skill.cited_report'?generalReportInput():reportInput(),firstReport={skillId};
 firstReport.acceptedRequest=await publiclyAccepted(t,firstReport);
 const first=await productionRun({report:firstReport,input});t.after(()=>first.x.close());
 const parent=first.row.prepared,run={runId:uid(85),attemptId:uid(86)},binding=reportRunBinding(run),written=await writeParent(parent,binding);
 assert.ok(written.created.version.evidence.length>0,'the parent must retain actual source evidence');
 const report={skillId,documentRevision:written.selection,run};report.acceptedRequest=await publiclyAccepted(t,report);
 const state={revoked:false,sourceReads:0,phases:[]},source=revisionOwner({doc:written.doc,binding,scopes:parent.context.scopes,
  selection:written.selection,request:report.acceptedRequest,state});t.after(()=>source.sessions.close());await source.open();
 const x=await compositionFixture('',{report,revisionOwner:source.owner});t.after(()=>x.close());
 const before=written.doc.state.executions.length,runtime=await x.prepare();
 const validate=new Ajv({strict:false}).compile(runtime.sdkOptions.outputFormat.schema);assert.equal(validate(input),true,JSON.stringify(validate.errors));
 const output=await runtime.finish({type:'result',subtype:'success',is_error:false,structured_output:input});await x.task.publish({binding:x.f.configuration.binding,output});
 const row=retainedRows(x)[0];assert.equal(row.pending.baseVersionId,written.selection.versionId);
 assert.equal(row.prepared.provenance.parent.objectSha256,written.selection.objectSha256);
 assert.deepEqual(row.prepared.retainedEvidence,written.created.version.evidence);
 assert.deepEqual(row.prepared.context.evidence.slice(0,written.created.version.evidence.length),written.created.version.evidence);
 assert.equal(state.phases.includes('release'),true);assert.equal(written.doc.state.executions.length,before,'revision preparation does not render or replace the parent');
 assert.equal(output.state,'awaiting-output-approval');assert.equal(first.row.prepared.provenance.skill.skillId,skillId);
});

test('a saved original revision is served by the real private source owner and the corrected caller keeps its evidence, pins and pending output',async t=>{
 const first=await productionRun();
 t.after(()=>first.x.close());
 const parentPrepared=first.row.prepared;
 // A revision is a different attempt of the same conversation: same tenant/actor/conversation and scopes.
 const run={runId:uid(5),attemptId:uid(6)},binding=reportRunBinding(run);
 const written=await writeParent(parentPrepared,binding);
 assert.deepEqual(written.created.version.evidence,parentPrepared.context.evidence);
 const state={revoked:false,sourceReads:0,phases:[]};
 const request={...reportRuntimeFixture().request,documentRevision:written.selection};
 const source=revisionOwner({doc:written.doc,binding,scopes:parentPrepared.context.scopes,selection:written.selection,request,state});
 t.after(()=>source.sessions.close());
 const credential=await source.open();
 // The real owner's own DTO, before any caller consumes it.
 const read=await source.owner.readForSelected({binding,selection:written.selection,deadlineMs:written.doc.options.now()+30000,signal:undefined});
 assert.deepEqual(Object.keys(read).sort(),['headVersionId','inspection','request','specSha256','version']);
 assert.equal(read.version.versionId,written.selection.versionId);
 assert.equal(read.specSha256,hash(parentPrepared.request));
 assert.equal(read.inspection.currentBytesVerified,true);

 // A fresh run session for the runtime's own read (the direct read above already used the first).
 await source.open();
 const x2=await compositionFixture('',{report:{documentRevision:written.selection,run},revisionOwner:source.owner});
 t.after(()=>x2.close());
 const executionsBefore=written.doc.state.executions.length;
 const runtime=await x2.prepare();
 assert.equal(typeof credential.credential,'string');
 assert.equal(written.doc.state.executions.length,executionsBefore,'reading the saved original must not write');
 assert.equal(state.phases.includes('release'),true);
 const output=await runtime.finish({type:'result',subtype:'success',is_error:false,structured_output:reportInput()});
 await x2.task.publish({binding:x2.f.configuration.binding,output});
 const row=retainedRows(x2)[0];
 // The corrected caller kept the parent's immutable pins and its exact retained evidence.
 assert.equal(row.pending.baseVersionId,written.selection.versionId);
 assert.deepEqual(row.prepared.provenance.parent,{versionId:written.created.version.versionId,objectSha256:written.created.version.object.sha256,
  specSha256:read.specSha256,provenanceSha256:hash(parentPrepared.provenance)});
 assert.deepEqual(row.prepared.retainedEvidence,written.created.version.evidence);
 assert.deepEqual(row.prepared.retainedEvidence,parentPrepared.context.evidence);
 const retained=row.prepared.context.evidence.slice(0,written.created.version.evidence.length),fresh=row.prepared.context.evidence.slice(written.created.version.evidence.length);
 assert.equal(fresh.length,2);
 assert.equal(row.prepared.context.evidence.length,written.created.version.evidence.length+2);
 assert.deepEqual(retained,written.created.version.evidence);
 assert.equal(fresh[0].binding.runId,binding.runId);
 assert.equal(retained[0].binding.runId,first.x.f.configuration.binding.runId);
 assert.notEqual(fresh[0].citationId,retained[0].citationId);
 assert.equal(new Set(row.prepared.context.evidence.map(item=>item.citationId)).size,row.prepared.context.evidence.length);
 assert.equal(row.prepared.coverage.find(source=>source.sourceId==='bill_text').pin.sourceVersionId,REPORT_REVISION);
 // The ordinary paths of the same assembly are unchanged by the revision run.
 assert.equal(x2.f.state.reads,2);
});

test('a revoked or rebound source refuses the revision read before any artifact access',async t=>{
 const first=await productionRun();
 t.after(()=>first.x.close());
 const parentPrepared=first.row.prepared;
 const run={runId:uid(7),attemptId:uid(8)},binding=reportRunBinding(run);
 const written=await writeParent(parentPrepared,binding);
 const request={...reportRuntimeFixture().request,documentRevision:written.selection};

 // Current authority revoked after the run was admitted.
 const artifactReads=written.doc.state.gets,artifactRuns=written.doc.state.executions.length;
 const revoked={revoked:false,sourceReads:0,phases:[]};
 const denied=revisionOwner({doc:written.doc,binding,scopes:parentPrepared.context.scopes,selection:written.selection,request,state:revoked});
 t.after(()=>denied.sessions.close());
 await denied.open();
 revoked.revoked=true;
 const x2=await compositionFixture('',{report:{documentRevision:written.selection,run},revisionOwner:denied.owner});
 t.after(()=>x2.close());
 await assert.rejects(x2.prepare(),error=>error.message==='SELECTED_REQUEST_REFUSED');
 assert.equal(written.doc.state.gets,artifactReads,'a refused current authority reads no artifact version');
 assert.equal(written.doc.state.executions.length,artifactRuns,'no artifact execution is started by a refused read');
 assert.equal(revoked.phases.includes('release'),false);

 // The saved run no longer carries the scopes the caller presents: the source is rebound, not read.
 const rebound={revoked:false,sourceReads:0,phases:[]};
 const moved=revisionOwner({doc:written.doc,binding,scopes:parentPrepared.context.scopes,selection:written.selection,request,state:rebound});
 t.after(()=>moved.sessions.close());
 await moved.open();
 const x3=await compositionFixture('',{report:{documentRevision:written.selection,run},revisionOwner:moved.owner});
 t.after(()=>x3.close());
 x3.state.scopesOverride=[{...parentPrepared.context.scopes[0],policyRevision:'rebound-policy'}];
 await assert.rejects(x3.prepare(),error=>error.message==='SELECTED_REQUEST_REFUSED');
 assert.equal(rebound.sourceReads,0,'a rebound scope never reaches the saved original source');
 assert.equal(written.doc.state.gets,artifactReads,'a rebound scope reads no artifact version');
 assert.equal(written.doc.state.executions.length,artifactRuns);
});
