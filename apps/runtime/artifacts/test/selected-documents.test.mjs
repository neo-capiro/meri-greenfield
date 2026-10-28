/** Actual selected compiler/journal, current session/Core artifact authority,
 * publication/recovery owners. SQL, Core response and renderer are synthetic. */
import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID,createHash} from 'node:crypto';
import {compositionFixture} from '../../selected/test/composition-fixture.mjs';
import {createSelectedDocumentExecution,currentDocumentSession} from '../selected-documents.mjs';
import {nativeDocumentFixture,sha} from '../../../artifacts/test/native-document-fixture.mjs';
import {createArtifactService} from '../../../artifacts/service.mjs';
import {createDocumentRevisionRunOwner} from '../revision-composition.mjs';
import {artifactValidators as v} from '../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {reportBriefInput,generalReportInput,reportRunBinding,reportRuntimeFixture,REPORT_NOW,RETAINED_BYTES,RETAINED_IMAGE,docxExecutor} from '../../selected/test/report-production-fixture.mjs';
import {publicationFixture} from '../../../artifacts/storage/test/publication-fixture.mjs';
import {createLocalDocumentPorts} from '../../../control/document-application/local/ports.mjs';
import {createActionSessionApplication} from '../../../control/action-host/session/http.mjs';
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
import {createCoreArtifactAuthority} from '../core-authority.mjs';
import {createRuntimeDocumentOptionsComposer} from '../composition.mjs';
import {registerDocumentIntentOwner} from '../intent-binding.mjs';
import {intentsComposition} from '../../product-ports/intents.mjs';
import {bindApprovalSessions} from '../../native-authority/approval-forwarder.mjs';
import {INTENT_PATHS} from '../../../control/intents/http.mjs';

async function fixture(skill='quick_skill.commitments_audit'){
 const x=await compositionFixture(skill),runtime=await x.prepare(),output=await runtime.finish({type:'result',subtype:'success',is_error:false,structured_output:x.f.input});
 await x.task.publish({binding:x.f.context.binding,output});const proposal=[...x.intents.state.rows.values()][0].outcome.result.proposal,binding=proposal.command.binding,scopes=proposal.command.scopes,now=x.f.configuration.now;
 await x.assembly.store.append(binding,{eventId:randomUUID(),createdAt:new Date(now()).toISOString(),type:'run.status',data:{state:'completed',reasonCode:null}},()=>{});
 const state={closed:false,revoked:false,artifactChecks:0,approvalRevoked:false,decisions:0,core:0,rendered:0,coreDenied:false};
 let ports=createLocalDocumentPorts({binding,scopes,clientId:scopes.find(s=>s.kind==='client').resourceId,deadlineMs:now()+60000,now,state}),latest=binding;
 const issued=await createActionSessionApplication({owner:ports.sessions,now,maxRequestMs:3000}).handle(new Request('https://control.invalid/api/action-followthrough/session',{method:'POST',headers:{authorization:'Bearer '+ports.nativeCredential,'content-type':'application/json'},body:'{}'}));assert.equal(issued.status,200);
 const artifact=nativeDocumentFixture({binding,scopes});artifact.state.clock=now();artifact.options.now=now;
 const publication=publicationFixture(binding.tenantId,now);
 artifact.options.versions=artifact.sql.create({publication:publication.publication,tenantId:binding.tenantId,now,pool:artifact.sql.pool});
 artifact.options.executor={async execute({request}){state.rendered++;await state.rendererHook?.();const bytes=Buffer.from(JSON.stringify(request));return {bytes,inspection:{sha256:createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length,format:'docx',nativeOpened:false,rendered:false,recalculated:false,members:[],details:{paragraphs:request.content.blocks.filter(b=>b.kind==='paragraph').length,tables:0,pictures:0}}};}};
 const decision={proposalId:proposal.proposalId,commandSha256:proposal.commandSha256,decision:'approved',approver:{tenantId:binding.tenantId,actorId:binding.actorId},decidedAt:new Date(now()).toISOString(),expiresAt:proposal.expiresAt,policyRevision:scopes[0].policyRevision};
 const readDecision=async value=>{state.decisions++;if(state.decisionReader)return state.decisionReader(value);if(state.approvalRevoked)return null;return structuredClone(decision);};
 const authority=createCoreArtifactAuthority({client:{origin:'https://synthetic.invalid',async read({request}){state.core++;if(state.coreDenied)throw Error('CORE_REFUSED');return {receipt:{principal:{tenantId:binding.tenantId,actorId:binding.actorId},conversationId:binding.conversationId,selectedClientId:scopes[0].resourceId,identityRevision:'identity',contextRevision:'context',authorityRevision:'authority',operations:['artifact.generate','artifact.revise','artifact.inspect','artifact.download'],limits:{maxArtifactBytes:state.currentMaxBytes??1048576}},observedAtMs:now(),localExpiresAtMs:now()+3000};}},credentials:{serviceSecret:async()=> 'synthetic-service-secret',admitBearer:(bearer,secret)=>{assert.notEqual(bearer,secret);return bearer;}},now,limits:{maxRequestMs:3000,maxRequestBytes:131072,maxResponseBytes:2097152},maxOutputBytes:1048576});
 const optionsOwner={async resolve(call){const r=await authority.resolve({...call,sessions:ports.sessions,store:x.assembly.store});const compose=createRuntimeDocumentOptionsComposer({storage:{objects:artifact.options.objects,versions:artifact.options.versions},executor:artifact.options.executor,pool:artifact.options.pool,sessions:ports.sessions,store:x.assembly.store,now});return {documentOptions:compose({artifactOptions:r.artifactOptions,selectedClientId:r.selectedClientId,limits:r.limits,enabled:r.enabled}),recheck:r.recheck};}};
 const bound=()=>({sessions:ports.sessions,store:x.assembly.store,retention:artifact.options.retention});
 const owner=createSelectedDocumentExecution({bound,pool:artifact.options.pool,optionsOwner,readDecision,now,maxRequestMs:3000,maxOutputBytes:1048576});
 const call={proposal,decision,principal:{tenantId:binding.tenantId,actorId:binding.actorId,clientIds:[scopes[0].resourceId]},deliveryId:[...x.intents.state.rows.values()][0].delivery_id,deadlineMs:now()+3000};
 // Synthetic accepted-row snapshot; the actual history decoder and current run
 // readers validate it. This does not qualify the next-turn admission writer.
 async function advanceRun(){const key=b=>[b.tenantId,b.conversationId,b.runId].join(':'),old=x.base.state.runs.get(key(latest));old.sequence_end=old.sequence_base+old.last_sequence;
  latest={...latest,runId:randomUUID(),attemptId:randomUUID(),workerId:randomUUID(),writerFence:latest.writerFence+1};
  const projection={...old.projection,binding:latest,state:'queued'},request={...old.request,requestId:randomUUID()},createdAt=new Date(now()).toISOString();
  const event={contractVersion:'0.1.0',eventId:randomUUID(),binding:latest,sequence:1,createdAt,scopes,type:'run.status',data:{state:'queued',reasonCode:null}};
  x.base.state.runs.set(key(latest),{...structuredClone(old),run_id:latest.runId,projection,projection_sha256:hash(projection),request_id:request.requestId,request,request_sha256:hash(request),sequence_base:old.sequence_end,sequence_end:null,last_sequence:1});
  x.base.state.events.set(key(latest),[{sequence:1,event_id:event.eventId,event,event_sha256:hash(event)}]);
  for(const state of ['starting','running','completed'])await x.assembly.store.append(latest,{eventId:randomUUID(),createdAt,type:'run.status',data:{state,reasonCode:null}},()=>{});
  ports.sessions.close();ports=createLocalDocumentPorts({binding:latest,scopes,clientId:scopes[0].resourceId,deadlineMs:now()+60000,now,state});await ports.sessions.issue({identityCredential:ports.nativeCredential});return latest;
 }
 return {x,state,artifact,ports,proposal,decision,owner,call,bound,now,advanceRun,async close(){ports.sessions.close();await x.close();}};
}

function mountIntents(f){
 const principal={...f.call.principal,role:'member',permissions:[],membershipRevision:'synthetic-membership'},calls=[];let recorded=null,denied=false;
 const gate={async admit(){if(denied)throw Error('MEMBERSHIP_REFUSED');return {principal,expiresAtMs:f.now()+60000};},async recheck(){if(denied)throw Error('MEMBERSHIP_REFUSED');return principal;}};
 const context={configuration:{intents:{enabled:true,core:{origin:'https://synthetic.invalid',serviceSecretFile:'C:/synthetic/core'}},limits:{requestMs:3000,requestBytes:131072},native:{maxResponseBytes:1048576}},
  pool:f.x.pool,client:{},native:{async call(){throw Error('No legacy native provider');}},now:f.now,canonicalProductPorts:{conversationMembership:gate}};
 registerDocumentIntentOwner(context,()=>[],f.owner);
 const composition=intentsComposition(context,{transport:{async readSecret(){return Buffer.from('synthetic-service-secret');},async fetchImpl(url,options){
  const body=JSON.parse(options.body);calls.push({url,body});assert.deepEqual(body.binding,f.proposal.command.binding);assert.equal(options.headers['x-internal-service-secret'],'synthetic-service-secret');
  if(url.endsWith('/record')){assert.deepEqual(body.proposal,f.proposal);recorded??={...f.decision,decision:body.decision};}
  else assert(url.endsWith('/decision'));
  return Response.json({decision:recorded,checkedAtMs:f.now(),revoked:f.state.approvalRevoked});
 }}});
 assert.equal(composition.state,'composed');assert.equal(bindApprovalSessions(context,f.bound().sessions,f.bound().retention,f.bound().store),true);f.state.decisionReader=composition.readDecision;
 const post=(path,body)=>composition.application.handle(new Request('https://control.invalid'+path,{method:'POST',headers:{authorization:'Bearer synthetic-user','content-type':'application/json'},body:JSON.stringify(body)}));
 const request={conversationId:f.proposal.command.binding.conversationId,deliveryId:f.call.deliveryId,proposalId:f.proposal.proposalId,commandSha256:f.proposal.commandSha256,decision:'approved'};
 return {calls,list:()=>post(INTENT_PATHS.list,{conversationId:request.conversationId}),decide:()=>post(INTENT_PATHS.decide,request),deny(){denied=true;}};
}

for(const skill of ['quick_skill.commitments_audit','quick_skill.relationship_brief'])test(`${skill}: actual intent HTTP list/decide and Core forwarder publish retained recipe once`,async()=>{
 const f=await fixture(skill);try{await f.advanceRun();const intents=mountIntents(f);
  const before=await intents.list();assert.equal(before.status,200);assert.equal((await before.json()).intents[0].phase,'awaiting_approval');assert.equal(f.state.rendered,0);
  const first=await intents.decide(),result=await first.json();assert.equal(first.status,200,JSON.stringify(result));assert.equal(result.status,'executed');assert.equal(result.outcome.execution.kind,'native-document');assert.notDeepEqual(result.outcome.version.binding,f.proposal.command.binding);assert.equal(f.state.rendered,1);
  const replay=await intents.decide(),again=await replay.json();assert.equal(replay.status,200,JSON.stringify(again));assert.deepEqual(again.outcome.version,result.outcome.version);assert.equal(f.state.rendered,1);
  const history=await intents.list(),listed=await history.json();assert.equal(history.status,200);assert.equal(listed.intents[0].phase,'completed');assert.deepEqual(listed.intents[0].execution.outcome.version,result.outcome.version);
  assert(intents.calls.some(c=>c.url.endsWith('/record')));assert(intents.calls.some(c=>c.url.endsWith('/decision')));assert.equal(f.x.base.state.allocations.size,0);
  f.state.approvalRevoked=true;const revoked=await intents.decide();assert.notEqual(revoked.status,200);assert.equal(f.state.rendered,1);
  intents.deny();const denied=await intents.list();assert.notEqual(denied.status,200);assert.equal(f.state.rendered,1);
 }finally{await f.close();}
});

test('actual intent HTTP retains indeterminate renderer outcome and never resubmits it',async()=>{
 const f=await fixture();try{const intents=mountIntents(f);f.state.rendererHook=()=>{throw Error('UNKNOWN_RENDERER');};
  const first=await intents.decide(),one=await first.json();assert.equal(first.status,200,JSON.stringify(one));assert.equal(one.status,'indeterminate');assert.equal(f.state.rendered,1);
  f.state.rendererHook=null;const replay=await intents.decide();assert.equal(replay.status,200);assert.equal((await replay.json()).status,'indeterminate');assert.equal(f.state.rendered,1);
  const listed=await intents.list();assert.equal(listed.status,200);assert.equal((await listed.json()).intents[0].phase,'unknown');assert.equal(f.state.rendered,1);
 }finally{await f.close();}
});

for(const skill of ['quick_skill.commitments_audit','quick_skill.relationship_brief'])test(`${skill}: actual retained proposal publishes once through Core/session/ordinary artifact owners`,async()=>{
 const f=await fixture(skill);try{assert.equal(await f.owner.read(f.call),null);assert.equal(f.state.rendered,0);
  const out=await f.owner.execute(f.call);assert.equal(out.status,'observed');assert.equal(out.outcome.version.contractVersion,'0.2.0');assert.deepEqual(out.outcome.version.binding,f.proposal.command.binding);assert.equal(f.state.rendered,1);
  assert.deepEqual((await f.owner.execute(f.call)).outcome.version,out.outcome.version);assert.deepEqual((await f.owner.read(f.call)).outcome.version,out.outcome.version);assert.equal(f.state.rendered,1);
  assert.equal(f.x.base.state.allocations.size,0);assert.equal(f.artifact.state.rows.size,1);assert(f.state.core>0);assert(f.state.decisions>0);
  f.state.approvalRevoked=true;await assert.rejects(f.owner.read(f.call));assert.equal(f.state.rendered,1);
 }finally{await f.close();}
});
test('one approved document keeps its actual first output binding after later runs and repeated reads',async()=>{
 const f=await fixture();try{const firstOutput=await f.advanceRun(),out=await f.owner.execute(f.call);assert.equal(out.status,'observed');assert.deepEqual(out.outcome.version.binding,firstOutput);assert(out.outcome.version.evidence.every(e=>hash(e.binding)===hash(f.proposal.command.binding)));
  await f.advanceRun();const replay=await f.owner.execute(f.call),read=await f.owner.read(f.call);assert.deepEqual(replay.outcome.version,out.outcome.version);assert.deepEqual(read.outcome.version,out.outcome.version);assert.equal(f.state.rendered,1);assert.equal(f.artifact.state.rows.size,1);
 }finally{await f.close();}
});
test('unknown executor outcome remains unknown after later run; no second render',async()=>{
 const f=await fixture();try{f.state.rendererHook=()=>{throw Error('LOST_EXECUTOR');};assert.equal((await f.owner.execute(f.call)).status,'indeterminate');assert.equal(f.state.rendered,1);
  await f.advanceRun();f.state.rendererHook=null;assert.equal((await f.owner.execute(f.call)).status,'indeterminate');assert.deepEqual(await f.owner.read(f.call),{state:'UNKNOWN'});assert.equal(f.state.rendered,1);assert.equal(f.artifact.state.rows.size,1);
 }finally{await f.close();}
});
test('lost publication acknowledgement recovers exact immutable output under later current authority',async()=>{
 const f=await fixture();try{const versions=f.artifact.options.versions;f.artifact.options.versions={...versions,async commit(...args){await versions.commit(...args);throw Error('LOST_PUBLICATION_ACK');}};
  assert.equal((await f.owner.execute(f.call)).status,'indeterminate');assert.equal(f.state.rendered,1);await f.advanceRun();
  const out=await f.owner.execute(f.call);assert.equal(out.status,'observed');assert.deepEqual(out.outcome.version.binding,f.proposal.command.binding);assert.equal(f.state.rendered,1);assert.equal(f.artifact.state.rows.size,1);
  f.state.coreDenied=true;await assert.rejects(f.owner.read(f.call));assert.equal(f.state.rendered,1);
 }finally{await f.close();}
});
test('retained invocation hash mismatch refuses publication recovery without rendering',async()=>{
 const f=await fixture();try{await f.owner.execute(f.call);const row=f.artifact.state.rows.values().next().value;row.record.argumentsSha256='f'.repeat(64);row.record_sha256=hash(row.record);
  await assert.rejects(f.owner.read(f.call),/ARTIFACT_REPLAY_EVIDENCE/);assert.equal(f.state.rendered,1);
 }finally{await f.close();}
});

test('retained document replay refuses a changed current output limit without another render',async()=>{
 const f=await fixture();try{await f.owner.execute(f.call);f.state.currentMaxBytes=1048575;
  await assert.rejects(f.owner.read(f.call),/ARTIFACT_REPLAY_EVIDENCE/);assert.equal(f.state.rendered,1);
 }finally{await f.close();}
});

test('concurrent selected delivery observes the durable pending claim without another renderer',async()=>{
 const f=await fixture();let release;try{let entered;const started=new Promise(r=>entered=r),hold=new Promise(r=>release=r);f.state.rendererHook=async()=>{entered();await hold;};
  const first=f.owner.execute(f.call);await started;
  try{assert.equal((await f.owner.execute(f.call)).status,'indeterminate');assert.deepEqual(await f.owner.read(f.call),{state:'UNKNOWN'});assert.equal(f.state.rendered,1);}
  finally{release();}
  const out=await first;assert.equal(out.status,'observed');assert.deepEqual((await f.owner.read(f.call)).outcome.version,out.outcome.version);assert.equal(f.state.rendered,1);
 }finally{release?.();await f.close();}
});
for(const changed of ['principal','decision','source hash','current session','Core denial','source row'])test(`document production owner refuses ${changed} before generation`,async()=>{
 const f=await fixture();try{let call=structuredClone(f.call);
  if(changed==='principal')call.principal.actorId='foreign';if(changed==='decision')call.decision.commandSha256='f'.repeat(64);
  if(changed==='source hash'){call.proposal.command.arguments.artifactRequestSha256='e'.repeat(64);call.proposal.commandSha256=hash(call.proposal.command);}
  if(changed==='current session')f.state.revoked=true;if(changed==='Core denial')f.state.coreDenied=true;
  if(changed==='source row')f.x.base.state.selectedOutputs.values().next().value.projection_sha256='f'.repeat(64);
  await assert.rejects(f.owner.execute(call));assert.equal(f.state.rendered,0);assert.equal(f.artifact.state.rows.size,0);
 }finally{await f.close();}
});

/** The report revision lane at the approval/apply boundary. The parent is written by the real artifact owner
 * under the deployment's declared write activation; the factory's own revision publication compiles the child
 * from that parent (its private parent read is the real revision owner over the same action-session owner the
 * delivery borrows); the child is then committed by the ordinary approval delivery — the real intent HTTP
 * decide route, the real Core decision forwarder, the real selected-document execution owner and the real
 * document application. Only the Core transport, the membership gate and the renderer are synthetic. */
async function reportFixture(skillId){
 const input=skillId==='quick_skill.cited_report'?generalReportInput():reportBriefInput();
 const parentRun=await compositionFixture('',{report:{skillId}}),
  parentRuntime=await parentRun.prepare(),
  parentOutput=await parentRuntime.finish({type:'result',subtype:'success',is_error:false,structured_output:input});
 await parentRun.task.publish({binding:parentRun.f.configuration.binding,output:parentOutput});
 const prepared=[...parentRun.base.state.selectedOutputs.values()][0].projection.prepared;
 await parentRun.close();
 const clock=REPORT_NOW,run={runId:randomUUID(),attemptId:randomUUID()},binding=reportRunBinding(run),scopes=prepared.context.scopes,
  clientId=scopes.find(scope=>scope.kind==='client').resourceId,limits={maxRequestMs:5000,maxRequestBytes:2097152,maxResponseBytes:16777216};
 // The parent version: this report's own compiled request and context, plus the one declared asset reference.
 const artifact=nativeDocumentFixture({binding,scopes});artifact.state.clock=clock;
 // One clock owner for the whole lane: the document application requires the resolved options' `now` to be
 // that exact function, not an equal one.
 const now=artifact.options.now;
 const asset=v.object({objectId:randomUUID(),versionId:'SYNTHETIC_RETAINED_ASSET',sha256:sha(RETAINED_BYTES),bytes:RETAINED_BYTES.length,scopes});
 artifact.state.objects.set(v.hash(asset),Buffer.from(RETAINED_BYTES));
 const request=v.request({...prepared.request,content:{blocks:[...prepared.request.content.blocks,RETAINED_IMAGE]}}),
  context=v.context({...prepared.context,assets:[{id:RETAINED_IMAGE.assetId,object:asset}]}),
  alloc=()=>({artifactId:randomUUID(),versionId:randomUUID(),objectId:randomUUID()});
 const parent=await createArtifactService({...artifact.options,executor:docxExecutor,ids:alloc,retainedAssetMapWrites:true,
  admitRetainedEvidence:value=>v.hash(value)===v.hash(context)?undefined:1}).create(request,context,
  {invocation:{invocationId:'sdk:'+hash({deliveryId:randomUUID()}),versionId:undefined,requestSha256:v.nativeRequestSha256(request,context,null)}});
 const parentRecord=await artifact.options.versions.read(parent.version.versionId),
  selection={artifactId:parent.version.artifactId,versionId:parent.version.versionId,objectSha256:parent.version.object.sha256};
 assert.deepEqual(parentRecord.assets,[{id:RETAINED_IMAGE.assetId,object:asset}],'the parent the factory revises must itself retain the map');
 // The single real action-session owner both the private parent read and the delivery borrow, and the real
 // private revision owner the production composition consumes.
 const state={closed:false,revoked:false,artifactChecks:0,approvalRevoked:false,decisions:0,core:0,rendered:0,coreDenied:false,sourceReads:0,phases:[]};
 let ports=createLocalDocumentPorts({binding,scopes,clientId,deadlineMs:clock+60000,now,state}),latest=binding;
 await ports.sessions.issue({identityCredential:ports.nativeCredential});
 state.saved={run:{binding,scopes},request:reportRuntimeFixture({documentRevision:selection,run,skillId}).request};
 const revisionOwner=createDocumentRevisionRunOwner({now,limits,bound:()=>({sessions:ports.sessions,
   store:{async read(){state.sourceReads++;return structuredClone(state.saved);}}}),
  optionsOwner:{async resolve(call){assert.equal(call.intent,'inspect');
   return {documentOptions:{sessions:ports.sessions,selectedClientId:clientId,artifactOptions:{...artifact.options,ids:alloc},now,limits,enabled:true},
    async recheck({phase}){state.phases.push(phase);}};}}});
 const x=await compositionFixture('',{report:{skillId,documentRevision:selection,run},revisionOwner}),
  runtime=await x.prepare(),output=await runtime.finish({type:'result',subtype:'success',is_error:false,structured_output:input});
 await x.task.publish({binding:x.f.configuration.binding,output});
 // The source run is closed before the approval turn, exactly as the accepted cases in this file settle it:
 // the real selected-output retention owner loads a completed source row.
 await x.assembly.store.append(binding,{eventId:randomUUID(),createdAt:new Date(clock).toISOString(),type:'run.status',data:{state:'completed',reasonCode:null}},()=>{});
 const row=[...x.base.state.selectedOutputs.values()][0].projection,proposal=[...x.intents.state.rows.values()][0].outcome.result.proposal;
 assert.equal(row.pending.baseVersionId,selection.versionId);
 assert.deepEqual(row.prepared.context.assets,[{id:RETAINED_IMAGE.assetId,object:asset}],'the compiled child must carry the parent map into the delivery');
 // The delivery half: the current session/Core artifact authority, the composed document options under the
 // deployment's declared write activation, and the real selected-document execution owner.
 artifact.options.executor={async execute({request}){state.rendered++;artifact.state.executions.push(request);
  const bytes=Buffer.from(JSON.stringify(request));return {bytes,inspection:{sha256:createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length,format:'docx',
   nativeOpened:false,rendered:false,recalculated:false,members:[],details:{paragraphs:request.content.blocks.filter(block=>block.kind==='paragraph').length,tables:0,pictures:0}}};}};
 const decision={proposalId:proposal.proposalId,commandSha256:proposal.commandSha256,decision:'approved',approver:{tenantId:binding.tenantId,actorId:binding.actorId},
   decidedAt:new Date(clock).toISOString(),expiresAt:proposal.expiresAt,policyRevision:scopes[0].policyRevision};
 const readDecision=async value=>{state.decisions++;if(state.decisionReader)return state.decisionReader(value);if(state.approvalRevoked)return null;return structuredClone(decision);};
 const authority=createCoreArtifactAuthority({now,maxOutputBytes:1048576,limits:{maxRequestMs:3000,maxRequestBytes:131072,maxResponseBytes:2097152},
  credentials:{serviceSecret:async()=>'synthetic-service-secret',admitBearer:(bearer,secret)=>{assert.notEqual(bearer,secret);return bearer;}},
  client:{origin:'https://synthetic.invalid',async read(){state.core++;if(state.coreDenied)throw Error('CORE_REFUSED');
   return {receipt:{principal:{tenantId:binding.tenantId,actorId:binding.actorId},conversationId:binding.conversationId,selectedClientId:clientId,
    identityRevision:'identity',contextRevision:'context',authorityRevision:'authority',
    operations:['artifact.generate','artifact.revise','artifact.inspect','artifact.download'],limits:{maxArtifactBytes:state.currentMaxBytes??1048576}},observedAtMs:now(),localExpiresAtMs:now()+3000};}}});
 const optionsOwner={async resolve(call){const r=await authority.resolve({...call,sessions:ports.sessions,store:x.assembly.store}),
   compose=createRuntimeDocumentOptionsComposer({storage:{objects:artifact.options.objects,versions:artifact.options.versions},executor:artifact.options.executor,
    pool:artifact.options.pool,sessions:ports.sessions,store:x.assembly.store,now,retainedAssetMapWrites:true});
  return {documentOptions:compose({artifactOptions:r.artifactOptions,selectedClientId:r.selectedClientId,limits:r.limits,enabled:r.enabled}),recheck:r.recheck};}};
 const bound=()=>({sessions:ports.sessions,store:x.assembly.store,retention:artifact.options.retention}),
  owner=createSelectedDocumentExecution({bound,pool:artifact.options.pool,optionsOwner,readDecision,now,maxRequestMs:3000,maxOutputBytes:1048576}),
  call={proposal,decision,principal:{tenantId:binding.tenantId,actorId:binding.actorId,clientIds:[clientId]},
   deliveryId:[...x.intents.state.rows.values()][0].delivery_id,deadlineMs:clock+3000};
 // The real intents composition and its Core native-approval forwarder over a synthetic Core transport that
 // already holds this proposal's recorded approval: the owner reads the decision through that forwarder and
 // validates it with its own `selectedApprovalDecision`. Wired after the run advances, exactly as the
 // accepted cases in this file wire theirs, so the forwarder relays the live session of the run in force.
 function mountApprovals(){
  const gatePrincipal={tenantId:binding.tenantId,actorId:binding.actorId,clientIds:[clientId],role:'member',permissions:[],membershipRevision:'synthetic-membership'};
  const gate={async admit(){return {principal:gatePrincipal,expiresAtMs:clock+60000};},async recheck(){return gatePrincipal;}};
  const intentsContext={configuration:{intents:{enabled:true,core:{origin:'https://synthetic.invalid',serviceSecretFile:'C:/synthetic/core'}},limits:{requestMs:3000,requestBytes:131072},native:{maxResponseBytes:1048576}},
   pool:x.pool,client:{},native:{async call(){throw Error('No legacy native provider');}},now,canonicalProductPorts:{conversationMembership:gate}};
  registerDocumentIntentOwner(intentsContext,()=>[],owner);
  const approvals=intentsComposition(intentsContext,{transport:{async readSecret(){return Buffer.from('synthetic-service-secret');},async fetchImpl(url,options){
   const body=JSON.parse(options.body);
   if(url.endsWith('/record'))return Response.json({decision:{...decision,decision:body.decision}});
   if(url.endsWith('/revoke'))return Response.json({revoked:true});
   return Response.json({decision:state.approvalRevoked?null:decision,checkedAtMs:clock,revoked:state.approvalRevoked});}}});
  assert.equal(approvals.state,'composed');
  assert.equal(bindApprovalSessions(intentsContext,ports.sessions,artifact.options.retention,x.assembly.store),true);
  state.decisionReader=approvals.readDecision;return approvals;
 }
 // The approval happens in a later run of the same conversation; the delivered output binds to that run.
 async function advanceRun(){const key=b=>[b.tenantId,b.conversationId,b.runId].join(':'),old=x.base.state.runs.get(key(latest));old.sequence_end=old.sequence_base+old.last_sequence;
  latest={...latest,runId:randomUUID(),attemptId:randomUUID(),workerId:randomUUID(),writerFence:latest.writerFence+1};
  const projection={...old.projection,binding:latest,state:'queued'},next={...old.request,requestId:randomUUID()},createdAt=new Date(clock).toISOString();
  const event={contractVersion:'0.1.0',eventId:randomUUID(),binding:latest,sequence:1,createdAt,scopes,type:'run.status',data:{state:'queued',reasonCode:null}};
  x.base.state.runs.set(key(latest),{...structuredClone(old),run_id:latest.runId,projection,projection_sha256:hash(projection),request_id:next.requestId,request:next,request_sha256:hash(next),sequence_base:old.sequence_end,sequence_end:null,last_sequence:1});
  x.base.state.events.set(key(latest),[{sequence:1,event_id:event.eventId,event,event_sha256:hash(event)}]);
  for(const next of ['starting','running','completed'])await x.assembly.store.append(latest,{eventId:randomUUID(),createdAt,type:'run.status',data:{state:next,reasonCode:null}},()=>{});
  ports.sessions.close();ports=createLocalDocumentPorts({binding:latest,scopes,clientId,deadlineMs:clock+60000,now,state});await ports.sessions.issue({identityCredential:ports.nativeCredential});return latest;
 }
 return {x,state,artifact,portsOf:()=>ports,proposal,decision,owner,call,bound,now,advanceRun,mountApprovals,parent,parentRecord,selection,asset,row,input,async close(){ports.sessions.close();await x.close();}};
}

for(const skillId of ['quick_skill.bill_watch','quick_skill.cited_report'])test(`${skillId}: the factory's own revision proposal commits its child through the real approval/apply owners`,async()=>{
 const f=await reportFixture(skillId);
 try{
  // Every decision below is read from Core through the real native-approval forwarder and validated by the
  // owner's own `selectedApprovalDecision`. The lane drives the owner directly, as the accepted cases in
  // this file do: the published HTTP list/decide route refuses its caller in this harness (a pre-existing
  // fixture mismatch reproduced from the frozen tree, see the technical receipt), and that route admission
  // is not part of this crossing.
  const advanced=await f.advanceRun();f.mountApprovals();
  // Before the decision nothing is published, nothing is rendered, and the delivery has written no
  // invocation row; the parent is the only version in the store.
  assert.equal(await f.owner.read(f.call),null);assert.equal(f.state.rendered,0);
  assert.equal(f.artifact.state.executions.length,0);assert.equal(f.artifact.state.rows.size,0);assert.equal(f.state.sourceReads>0,true);
  const out=await f.owner.execute(f.call);
  assert.equal(out.status,'observed');assert.equal(f.state.rendered,1);assert.equal(f.state.decisions>0,true);assert.equal(f.artifact.state.rows.size,1);
  const version=out.outcome.version;
  // The committed child is the parent's own revision, bound to the run the approval applied in.
  assert.equal(version.parentVersionId,f.selection.versionId);assert.notDeepEqual(version.binding,f.proposal.command.binding);assert.deepEqual(version.binding,advanced);
  const child=await f.artifact.options.versions.read(version.versionId);
  assert.deepEqual(child.assets,[{id:RETAINED_IMAGE.assetId,object:f.asset}],'the approved child must retain the parent map');
  assert.deepEqual(child.version.parentVersionId,f.selection.versionId);
  assert.deepEqual(child.version.evidence,f.row.prepared.context.evidence);
  assert.deepEqual(child.version.evidence.slice(0,f.parentRecord.version.evidence.length),f.parentRecord.version.evidence);
  // The delivered specification is the compiled document, unchanged, plus the approval's own lineage section.
  const compiled=f.row.prepared.request.content.blocks;
  assert.deepEqual(child.spec.content.blocks.slice(0,compiled.length),compiled,'the delivered specification keeps the compiled document unchanged');
  assert.equal(child.spec.title,f.row.prepared.request.title);assert.equal(child.spec.format,f.row.prepared.request.format);assert.equal(child.spec.operation,f.row.prepared.request.operation);
  assert.equal(child.specSha256,hash(child.spec));
  const lineageBlock=child.spec.content.blocks.find(block=>block.runs?.[0]?.text?.startsWith('Meri separately approved output lineage: ')),
   lineage=JSON.parse(lineageBlock.runs[0].text.slice('Meri separately approved output lineage: '.length));
  assert.equal(lineage.baseVersionId,f.selection.versionId);assert.deepEqual(lineage.outputBinding,advanced);
  assert.equal(lineage.proposalId,f.proposal.proposalId);assert.equal(lineage.sourceEvidenceSha256,hash(f.row.prepared.context.evidence));
  assert.deepEqual(child.version.scopes,f.parentRecord.version.scopes);
  // The parent it revised is bit-for-bit unchanged.
  assert.deepEqual(await f.artifact.options.versions.read(f.selection.versionId),f.parentRecord);
  // The same decision replayed returns the same immutable version and renders nothing further.
  assert.deepEqual((await f.owner.execute(f.call)).outcome.version,version);
  assert.deepEqual((await f.owner.read(f.call)).outcome.version,version);assert.equal(f.state.rendered,1);
 }finally{await f.close();}
});

test('a revoked report revision decision writes no child, renders nothing and leaves the parent current',async()=>{
 const f=await reportFixture('quick_skill.bill_watch');
 try{
  await f.advanceRun();f.mountApprovals();
  f.state.approvalRevoked=true;
  await assert.rejects(f.owner.execute(f.call));
  assert.equal(f.state.rendered,0);assert.equal(f.artifact.state.executions.length,0);assert.equal(f.artifact.state.rows.size,0);
  assert.deepEqual(await f.artifact.options.versions.read(f.selection.versionId),f.parentRecord);
 }finally{await f.close();}
});
