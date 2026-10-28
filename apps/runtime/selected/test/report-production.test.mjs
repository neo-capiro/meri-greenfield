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
import {REPORT_NOW,REPORT_REVISION,REPORT_STAMP,REPORT_SUBJECT,REPORT_TEXTS,reportRunBinding,reportRuntimeFixture,generalReportInput,RETAINED_BYTES,RETAINED_IMAGE,docxExecutor,reportBriefInput as reportInput} from './report-production-fixture.mjs';

const uid=n=>`10000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const bill=REPORT_SUBJECT,texts=REPORT_TEXTS;
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
/** The parent report version, written through the canonical artifact owner from the production report.
 * `image` adds the public schema's own image block and the trusted context object that it references; the
 * durable retained map beside the immutable spec is written only under the explicit `activation`, exactly
 * as the deployment's default-off writer behaves. */
async function writeParent(prepared,revisionBinding,{image=null,activation=false}={}){
 const doc=nativeDocumentFixture({binding:revisionBinding,scopes:prepared.context.scopes});
 // The report run's own clock: the artifact owner must be current when the prepared deadline applies.
 doc.state.clock=REPORT_NOW;
 // The retained context is the prepared report's own evidence, admitted by exact hash: the canonical
 // report binder does the same against the live object it was handed.
 const admitRetainedEvidence=contextValue=>v.hash(contextValue)===v.hash(prepared.context)?undefined:1;
 const asset=image===null?null:v.object({objectId:randomUUID(),versionId:'SYNTHETIC_RETAINED_ASSET',sha256:sha(RETAINED_BYTES),bytes:RETAINED_BYTES.length,scopes:prepared.context.scopes});
 if(asset)doc.state.objects.set(v.hash(asset),Buffer.from(RETAINED_BYTES));
 const request=v.request(image===null?prepared.request:{...prepared.request,content:{blocks:[...prepared.request.content.blocks,image]}});
 const context=v.context(image===null?prepared.context:{...prepared.context,assets:[{id:image.assetId,object:asset}]});
 const service=createArtifactService({...doc.options,executor:docxExecutor,admitRetainedEvidence,ids:()=>({artifactId:randomUUID(),versionId:randomUUID(),objectId:randomUUID()}),
  ...(activation?{retainedAssetMapWrites:true}:{})});
 const created=await service.create(request,context,{invocation:{invocationId:'sdk:'+hash({deliveryId:randomUUID()}),versionId:undefined,
  requestSha256:v.nativeRequestSha256(request,context,null)}});
 return {doc,created,asset,record:await doc.options.versions.read(created.version.versionId),
  selection:{artifactId:created.version.artifactId,versionId:created.version.versionId,objectSha256:created.version.object.sha256}};
}
/** One real revision of a document the harness already wrote: the compiled child request/context are the
 * production compiler's own, so the child's durable map is the real owner's answer to re-presenting them. */
async function writeChild(doc,baseVersionId,prepared,{activation=false}={}){
 const admitRetainedEvidence=contextValue=>v.hash(contextValue)===v.hash(prepared.context)?undefined:1;
 const service=createArtifactService({...doc.options,executor:docxExecutor,admitRetainedEvidence,ids:()=>({artifactId:randomUUID(),versionId:randomUUID(),objectId:randomUUID()}),
  ...(activation?{retainedAssetMapWrites:true}:{})});
 const created=await service.revise(baseVersionId,prepared.request,prepared.context,{invocation:{invocationId:'sdk:'+hash({deliveryId:randomUUID()}),versionId:undefined,
  requestSha256:v.nativeRequestSha256(prepared.request,prepared.context,baseVersionId)}});
 return {created,record:await doc.options.versions.read(created.version.versionId),
  selection:{artifactId:created.version.artifactId,versionId:created.version.versionId,objectSha256:created.version.object.sha256}};
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

/** One asset-bearing revision lane: the accepted request, the production report run, the parent written by
 * the real artifact owner, and the real private revision owner. Both submissions are the browser-shaped
 * wire of the installed closed format, admitted by the real HTTP application and canonical stored-request
 * owner: a revision submission names its skill beside the revision selection, exactly as that format
 * requires for the two report identities. The parent this factory lane revises is the immutable version the
 * real artifact owner wrote over the legacy-envelope publication journal (no paged v2 page tree here); the
 * v2 paged storage owner is exercised by the compiler-level report/cited-report cases. */
async function revisionLane(t,skillId,{image,activation}){
 const input=skillId==='quick_skill.cited_report'?generalReportInput():reportInput();
 const firstReport={skillId};firstReport.acceptedRequest=await publiclyAccepted(t,firstReport);
 const first=await productionRun({report:firstReport,input});t.after(()=>first.x.close());
 const parent=first.row.prepared,run={runId:uid(95),attemptId:uid(96)},binding=reportRunBinding(run);
 const written=await writeParent(parent,binding,{image,activation});
 const report={skillId,documentRevision:written.selection,run};report.acceptedRequest=await publiclyAccepted(t,report);
 const state={revoked:false,sourceReads:0,phases:[]},
  source=revisionOwner({doc:written.doc,binding,scopes:parent.context.scopes,selection:written.selection,request:report.acceptedRequest,state});
 t.after(()=>source.sessions.close());await source.open();
 return {input,first,parent,binding,written,report,state,source};
}

for(const skillId of ['quick_skill.bill_watch','quick_skill.cited_report'])test(`${skillId}: public request -> production factory -> retained parent version -> real compiler revision keeps the parent's retained asset`,async t=>{
 const lane=await revisionLane(t,skillId,{image:RETAINED_IMAGE,activation:true}),{input,written,source}=lane;
 // The real owner retained the declared reference's own original mapping beside the immutable spec.
 assert.deepEqual(written.record.assets,[{id:RETAINED_IMAGE.assetId,object:written.asset}]);
 assert.deepEqual(written.record.spec.content.blocks.filter(block=>block.kind==='image'),[RETAINED_IMAGE]);
 // The private read the production composition consumes returns it, and only it.
 const read=await source.owner.readForSelected({binding:lane.binding,selection:written.selection,deadlineMs:written.doc.options.now()+30000,signal:undefined});
 assert.deepEqual(Object.keys(read).sort(),['assets','headVersionId','inspection','request','specSha256','version']);
 assert.deepEqual(read.assets,[{id:RETAINED_IMAGE.assetId,object:written.asset}]);
 // The production factory's own readBase returns the parent to the real compiler through the real assembly.
 await source.open();
 const x=await compositionFixture('',{report:lane.report,revisionOwner:source.owner});t.after(()=>x.close());
 const executions=written.doc.state.executions.length,runtime=await x.prepare();
 const validate=new Ajv({strict:false}).compile(runtime.sdkOptions.outputFormat.schema);assert.equal(validate(input),true,JSON.stringify(validate.errors));
 const output=await runtime.finish({type:'result',subtype:'success',is_error:false,structured_output:input});
 await x.task.publish({binding:x.f.configuration.binding,output});
 const row=retainedRows(x)[0];
 assert.equal(row.pending.baseVersionId,written.selection.versionId);
 assert.equal(row.prepared.provenance.parent.objectSha256,written.selection.objectSha256);
 assert.deepEqual(row.prepared.request.content.blocks.filter(block=>block.kind==='image'),[RETAINED_IMAGE]);
 assert.deepEqual(row.prepared.context.assets,[{id:RETAINED_IMAGE.assetId,object:written.asset}]);
 assert.deepEqual(row.prepared.retainedEvidence,written.created.version.evidence);
 assert.equal(written.doc.state.executions.length,executions,'the revision preparation renders nothing');
 // The child's own write is the real owner's, so the retained object survives into the next version's map.
 const child=await writeChild(written.doc,written.selection.versionId,row.prepared,{activation:true});
 assert.equal(child.created.version.parentVersionId,written.selection.versionId);
 assert.deepEqual(child.record.assets,[{id:RETAINED_IMAGE.assetId,object:written.asset}]);
 assert.deepEqual(child.record.spec.content.blocks.filter(block=>block.kind==='image'),[RETAINED_IMAGE]);
 // A parent that declared the same reference under the default-off writer retained no map: the private
 // read reports it explicitly unavailable rather than inventing one, and the factory's own readBase
 // therefore refuses the revision. An ordinary older record that declared no references keeps the exact
 // four-field DTO (asserted above on the saved original), so absence semantics are unchanged.
 const off=await revisionLane(t,skillId,{image:RETAINED_IMAGE,activation:false});
 assert.equal(off.written.record.assets,undefined);
 await assert.rejects(off.source.owner.readForSelected({binding:off.binding,selection:off.written.selection,deadlineMs:off.written.doc.options.now()+30000,signal:undefined}),error=>error.code==='UNAVAILABLE');
 await off.source.open();
 const offRuns=off.written.doc.state.executions.length;
 const offX=await compositionFixture('',{report:off.report,revisionOwner:off.source.owner});t.after(()=>offX.close());
 await assert.rejects(offX.prepare());
 assert.equal(off.written.doc.state.executions.length,offRuns,'the refused revision renders nothing');
 assert.equal(retainedRows(offX).length,0,'the refused revision retains no pending output');
});
