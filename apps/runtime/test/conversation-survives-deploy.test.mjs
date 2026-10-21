/** A conversation survives an image release (O102): the real session owner, the real prepared-candidate identity and the real
 * next-run owner of each render, over one durable conversation store and one initial-binding journal. A render is a deployment:
 * its runtime versions (image digest) and its configuration hash (runner task definition) both change on every release. */
import test from 'node:test';import assert from 'node:assert/strict';
import {createPreparedCandidateIdentity} from '../prepared-candidate.mjs';
import {createActionSessionOwner,issuedCurrentState} from '../../control/action-host/session/owner.mjs';
import {createNextRunOwner} from '../../control/conversations/next-run.mjs';
import {hash} from '../../control/conversations/boundary.mjs';
import {canonicalSha256} from '../../../packages/contracts/validate.mjs';
import {lifecycleFixture,binding as profileBinding,scopes,id,versions} from '../../control/conversations/test/lifecycle-fixture.mjs';

const check=()=>{},at='2026-10-21T12:00:00.000Z',clientId=scopes[0].resourceId,policyRevision=scopes[0].policyRevision;
const conversation={...profileBinding,conversationId:id(730),runId:id(731),attemptId:id(732),workerId:id(733)};
const principal={tenantId:conversation.tenantId,actorId:conversation.actorId};
const RENDER_A={versions,configurationSha256:'c'.repeat(64)};
// A release: new image and skills, same SDK session runtime; the runner task definition revision moves the configuration hash.
const RENDER_B={versions:{...versions,imageDigest:`sha256:${'f'.repeat(64)}`,skillsDigest:'e'.repeat(64)},configurationSha256:'d'.repeat(64)};
// A release that also moves the SDK: the next turn of a completed conversation is refused (session-continuity.mjs, O103).
const RENDER_SDK={versions:{...RENDER_B.versions,sdk:'0.3.296',cli:'2.1.296'},configurationSha256:'e'.repeat(64)};
const status=(n,state)=>({eventId:id(n),createdAt:at,type:'run.status',data:{state,reasonCode:null}});

async function deployment(){
 const f=await lifecycleFixture({binding:conversation});let serial=800;const revoked=new Map(),journal={record:null,claims:0};
 const initialBindings={async readConversation(){return structuredClone(journal.record);},
  async claim(input){journal.claims++;journal.record={schemaVersion:1,state:'ADMITTED',binding:conversation,selectedClientId:input.selectedClientId,policyRevision:input.policyRevision,versions:input.versions,configurationSha256:input.configurationSha256,createdAtMs:Date.now(),expiresAtMs:input.proposedExpiresAtMs};return {record:structuredClone(journal.record),created:true};}};
 const retirement={async verifyRetired({binding:b}){const r=await f.store.allocations.read({binding:b,allocationKey:hash(b)},check);return {physicalStopProven:r.record.state==='RETIRED'};}};
 const revocation={async verifyRevoked({binding:b}){const r=revoked.get(b.runId);if(!r)throw Error('NEXT_RUN_REVOCATION_REQUIRED');return r;}};
 /** One control render: its own identity, next-run owner and session owner, over the shared durable state. */
 function render(r,{policy=policyRevision}={}){const lines=[];
  const nextRunOwner=createNextRunOwner({store:f.store,versions:r.versions,newId:()=>id(serial++),retirement,revocation});
  const identity=createPreparedCandidateIdentity({store:f.store,identity:{origin:'https://authority.synthetic.invalid',commandContext:{binding:profileBinding,clientResolution:{reference:clientId,clientId}},
   async fetchImpl(url,options){const input=JSON.parse(options.body),now=Date.now(),base={principal,identityRevision:'native-1',checkedAtMs:now,expiresAtMs:now+30000};if(url.endsWith('/identity'))return Response.json(base);
    return Response.json({...base,identitySha256:input.identitySha256,conversationId:conversation.conversationId,selectedClientId:clientId,contextRevision:'native-context-1'});}},
   qualification:{policyRevision:policy},limits:{maxRequestMs:2000,maxFactBytes:131072},nextRunOwner,initialBindings,configurationSha256:r.configurationSha256,versions:r.versions,proposeInitialExpiry:()=>Date.now()+60000,factWindowMs:900000});
  const sessions=createActionSessionOwner({mode:'process-local',verifyIdentity:identity.verifyIdentity,resolveContext:identity.resolveContext,limits:{maxSessions:4,maxRequestMs:2000,maxTtlMs:30000,maxFactBytes:131072},refusals:(step,error)=>lines.push({step:error?.step??step,code:error?.reason??error?.code})});
  const issue=async()=>{try{return (await issuedCurrentState(sessions)({identityCredential:'native-bearer',hints:{conversationId:conversation.conversationId,clientId}})).current.binding;}finally{sessions.close();}};
  return {issue,lines,versions:r.versions};}
 async function allocate(b){const allocationKey=hash(b),expiresAtMs=Date.now()+60000,grantId=id(serial++),key={binding:b,allocationKey},intent={...key,original:{binding:b,executionKey:allocationKey,executionId:allocationKey,planSha256:'a'.repeat(64),expiresAtMs,versions},qualification:{attempt:1,policyRevision:'b'.repeat(64)},grantIntents:[{grantId,capabilitySha256:'c'.repeat(64),expiresAtMs}],allocationSha256:'d'.repeat(64),taskRequestSha256:'e'.repeat(64),expiresAtMs},resource={taskArn:`arn:aws:ecs:us-east-1:967807252336:task/Synthetic/${'a'.repeat(32)}`,clusterArn:'arn:aws:ecs:us-east-1:967807252336:cluster/Synthetic',taskDefinitionArn:'arn:aws:ecs:us-east-1:967807252336:task-definition/Synthetic:1',containerName:'worker',createdAtMs:Date.now()};await f.store.allocations.claim(intent,check);await f.store.allocations.record({...key,state:'ALLOCATED',resource},check);return {key,resource,grantId};}
 async function complete(b){for(const state of ['starting','running'])await f.store.append(b,status(serial++,state),check);const k={binding:b,scopes,selectedClientId:clientId},p=await f.store.completions.begin({...k,completionId:id(serial++),checkpointId:id(serial++)},check),template=await f.capture(p.checkpointId),proof=structuredClone(template);proof.checkpoint.binding=b;proof.checkpoint.workspace.binding=b;proof.checkpoint.workspaceSha256=hash(proof.checkpoint.workspace);proof.checkpoint.lastEventSequence=p.captureSequence;proof.checkpointSha256=hash(proof.checkpoint);proof.sourceRequestSha256=p.sourceRequestSha256;proof.contextSha256=p.contextSha256;await f.store.completions.publish({...k,completionId:p.completionId,proof,events:[{contractVersion:'0.1.0',eventId:p.verifiedEventId,createdAt:at,type:'checkpoint.verified',data:{checkpointId:p.checkpointId}},{contractVersion:'0.1.0',eventId:p.completedEventId,createdAt:at,type:'run.status',data:{state:'completed',reasonCode:null}}]},check);}
 // Stop: the conversation service's own cancel, through the original run's session.
 const stop=()=>f.service.cancel({credential:f.credential});
 async function retire(a){await f.store.allocations.record({...a.key,state:'RETIRED',resource:{...a.resource,physicalStopProven:true}},check);revoked.set(a.key.binding.runId,{grantIds:[a.grantId],receiptSha256:hash({retired:a.key,grantIds:[a.grantId]})});}
 /** Turn 1 of the conversation, as the render that admitted it runs it: input, submit, allocation, then completed or stopped, then retired. */
 async function firstTurn(end){await f.service.allocateInput({credential:f.credential,input:f.input});await f.service.submit({credential:f.credential,input:f.input});const a=await allocate(conversation);
  if(end==='complete')await complete(conversation);else{await f.store.append(conversation,status(serial++,'starting'),check);await stop();}await retire(a);}
 const accept=(b,runVersions)=>f.store.nextRuns.accept({conversation:{conversationId:b.conversationId,owner:principal,scopes,createdAt:at,policyRevision},run:{binding:b,state:'queued',scopes,createdAt:at,policyRevision,versions:runVersions},request:{requestId:id(serial++),prompt:'turn 2',skill:null,window:null,windowRequest:null},event:{contractVersion:'0.1.0',...status(serial++,'queued'),binding:b,scopes,sequence:1}},check);
 const reservation=b=>[...f.state.nextRuns.values()].find(r=>r.target_run_id===b.runId)?.reservation;
 const execution=b=>f.store.nextRuns.execution({binding:b,scopes,selectedClientId:clientId},check);
 return {f,journal,render,firstTurn,accept,reservation,execution,close:()=>f.close()};
}
const successorOf=(b,source=conversation)=>{assert.equal(b.conversationId,source.conversationId);assert.notEqual(b.runId,source.runId);assert.equal(b.writerFence,source.writerFence+1);};

for(const end of ['complete','cancel'])test(`a conversation whose turn 1 ${end==='complete'?'completed':'was stopped'} under one render admits turn 2 under the next render`,async()=>{const d=await deployment();try{
 const a=d.render(RENDER_A);assert.deepEqual(await a.issue(),conversation,'render A admits the original');await d.firstTurn(end);
 const b=d.render(RENDER_B),second=await b.issue();successorOf(second);assert.deepEqual(b.lines,[],'no refusal');
 assert.deepEqual(d.reservation(second).versions,RENDER_B.versions,'the reserved run carries the new render\'s versions');
 assert.equal(d.journal.claims,1,'no second original is minted');assert.deepEqual(d.journal.record.versions,RENDER_A.versions,'the original record keeps its own render');
 const accepted=await d.accept(second,RENDER_B.versions);assert.deepEqual(accepted.run.versions,RENDER_B.versions);
 assert.deepEqual(await d.render(RENDER_B).issue(),second,'a later session binds the accepted turn 2');
 const lineage=await d.execution(second);
 if(end==='complete'){assert.deepEqual(lineage.nextTurn.targetBinding,second);assert.deepEqual(lineage.nextTurn.checkpoint.versions,RENDER_A.versions,'turn 2 resumes the SDK session turn 1 checkpointed under render A');}
 else assert.equal(lineage,null,'a stopped source has no checkpoint: turn 2 starts a fresh session');
}finally{d.close();}});

test('Stop then reopen with no deploy admits turn 2 under the same render',async()=>{const d=await deployment();try{
 const a=d.render(RENDER_A);await a.issue();await d.firstTurn('cancel');
 const second=await d.render(RENDER_A).issue();successorOf(second);assert.deepEqual(d.reservation(second).versions,RENDER_A.versions);
 await d.accept(second,RENDER_A.versions);assert.equal(await d.execution(second),null);
}finally{d.close();}});

test('an SDK or CLI release refuses the next turn of a completed conversation before any reservation (O103)',async()=>{const d=await deployment();try{
 await d.render(RENDER_A).issue();await d.firstTurn('complete');
 const sdk=d.render(RENDER_SDK);await assert.rejects(sdk.issue(),{code:'SESSION_REFUSED'});assert.deepEqual(sdk.lines,[{step:'initial-binding',code:'NEXT_TURN_SDK_CHANGED'}]);
 assert.equal(d.f.state.nextRuns.size,0,'nothing is reserved');
}finally{d.close();}});

// A successor reserved by a session before a deploy is accepted by the render current when the prompt arrives (one reservation per source).
test('a successor reserved before an image-only release is accepted and resumed under the new render',async()=>{const d=await deployment();try{
 await d.render(RENDER_A).issue();await d.firstTurn('complete');const second=await d.render(RENDER_A).issue();assert.deepEqual(d.reservation(second).versions,RENDER_A.versions);
 assert.deepEqual(await d.render(RENDER_B).issue(),second,'the new render binds the existing reservation');
 const accepted=await d.accept(second,RENDER_B.versions);assert.deepEqual(accepted.run.versions,RENDER_B.versions);
 assert.deepEqual((await d.execution(second)).nextTurn.targetBinding,second,'the SDK session resumes under the new image');
}finally{d.close();}});

test('a successor reserved before an SDK release is refused at acceptance, nothing persisted',async()=>{const d=await deployment();try{
 await d.render(RENDER_A).issue();await d.firstTurn('complete');const second=await d.render(RENDER_A).issue(),runs=d.f.state.runs.size;
 await assert.rejects(d.accept(second,RENDER_SDK.versions),{code:'NEXT_TURN_SDK_CHANGED'});assert.equal(d.f.state.runs.size,runs);
}finally{d.close();}});

test('an original that never ran stays pinned to the render that admitted it',async()=>{
 for(const [r,code] of [[RENDER_B,'INITIAL_BINDING_CONFIGURATION_CHANGED'],[{...RENDER_A,versions:RENDER_B.versions},'INITIAL_BINDING_VERSIONS_CHANGED']]){const d=await deployment();try{
  await d.render(RENDER_A).issue();const next=d.render(r);
  await assert.rejects(next.issue(),{code:'SESSION_REFUSED'});assert.deepEqual(next.lines,[{step:'initial-binding',code}]);assert.equal(d.journal.claims,1);
  assert.deepEqual(await d.render(RENDER_A).issue(),conversation,'its own render still admits it');
 }finally{d.close();}}
});

test('ownership pins survive a release: a changed policy or client is refused after turn 1',async()=>{const d=await deployment();try{
 await d.render(RENDER_A).issue();await d.firstTurn('complete');
 const policy=d.render(RENDER_B,{policy:'policy2'});await assert.rejects(policy.issue(),{code:'SESSION_REFUSED'});assert.deepEqual(policy.lines,[{step:'initial-binding',code:'INITIAL_BINDING_POLICY_CHANGED'}]);
 const own=d.journal.record;d.journal.record={...own,selectedClientId:id(7)};
 const client=d.render(RENDER_B);await assert.rejects(client.issue(),{code:'SESSION_REFUSED'});assert.deepEqual(client.lines,[{step:'initial-binding',code:'INITIAL_BINDING_CLIENT_MISMATCH'}]);
 d.journal.record=own;assert.equal(d.reservation({runId:id(0)}),undefined);assert.equal(d.f.state.nextRuns.size,0,'no refused issuance reserved a successor');
}finally{d.close();}});
