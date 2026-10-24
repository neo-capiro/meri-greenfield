/** Actual selected compiler/journal, current session/Core artifact authority,
 * publication/recovery owners. SQL, Core response and renderer are synthetic. */
import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID,createHash} from 'node:crypto';
import {compositionFixture} from '../../selected/test/composition-fixture.mjs';
import {createSelectedDocumentExecution,currentDocumentSession} from '../selected-documents.mjs';
import {nativeDocumentFixture} from '../../../artifacts/test/native-document-fixture.mjs';
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
 assert.equal(composition.state,'composed');assert.equal(bindApprovalSessions(context,f.bound().sessions),true);f.state.decisionReader=composition.readDecision;
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
