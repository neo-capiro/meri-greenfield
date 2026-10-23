/** SYNTHETIC E12-D: real lifecycle service/journal, continuation authority and SDK option
 * owner over the scripted SQL fixture. No physical stop, PostgreSQL or deployed SDK claim. */
import test from 'node:test';import assert from 'node:assert/strict';
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
import {lifecycleFixture,binding,scopes,id,versions,recordRetired} from '../../../control/conversations/test/lifecycle-fixture.mjs';
import {createPostgresConversationStore} from '../../../control/conversations/postgres-store.mjs';
import {createConversationLifecycleService} from '../../../control/conversations/lifecycle/service.mjs';
import {createContinuationAuthority} from '../continuation-authority.mjs';
import {buildContinuationOptions} from '../../../worker/conversation/continuation/options.mjs';

const check=()=>{},renderB={...versions,imageDigest:'sha256:'+'f'.repeat(64),skillsDigest:'e'.repeat(64)};
async function deployed(targetVersions=renderB){
 const f=await lifecycleFixture();await f.running();await f.control({controlId:id(700),intent:'pause'});await f.claim(id(700));await f.checkpoint(id(700));
 const counts={stops:0,claims:0},initial=new Map();
 const initialBindings={async readConversation({conversationId}){return initial.get(conversationId)??null;},async claim(v){counts.claims++;
  const record={schemaVersion:1,state:'ADMITTED',binding:{...binding,conversationId:v.conversationId,runId:id(730),attemptId:id(731),workerId:id(732)},selectedClientId:v.selectedClientId,policyRevision:v.policyRevision,versions:v.versions,configurationSha256:v.configurationSha256,expiresAtMs:v.proposedExpiresAtMs,createdAtMs:Date.now()};initial.set(v.conversationId,record);return {record,created:true};}};
 const authority=createContinuationAuthority({store:f.store,stop:async()=>{counts.stops++;await recordRetired(f.store,f.state.allocation);},selectedClientId:id(5),policyRevision:'policy1',versions:targetVersions,now:Date.now,
  fork:{initialBindings,configurationSha256:'d'.repeat(64),proposeInitialExpiry:()=>Date.now()+60000}});
 const store=createPostgresConversationStore({pool:f.pool,transitionAuthority:authority.transitionAuthority});
 const service=createConversationLifecycleService({service:f.service,store,dispatcher:f.dispatcher,reconcileOriginal:f.reconcileOriginal,checkpoints:f.checkpoints,nativeAdmission:authority.continuationAdmission,approvals:f.approvals,sessions:f.sessions,retention:null});
 return {f,store,service,counts,initial,proof:f.proofs.get(id(220)),close:f.close};
}
for(const mode of ['resume','fork'])test(`${mode} after an image-only deploy retains source checkpoint and admits the current image`,async t=>{
 const c=await deployed();t.after(c.close);const {f,proof}=c,source=await f.store.read(binding,{},check),beforeStarts=f.state.starts;
 const receipt=await c.service.control({credential:f.credential,input:{controlId:id(710),intent:mode,checkpointId:id(220),checkpointSha256:proof.checkpointSha256}});
 assert.equal(receipt.state,'APPLIED');assert.equal(f.state.starts,beforeStarts+1);assert.equal(c.counts.stops,mode==='resume'?1:0);
 const target=await c.store.read(receipt.targetBinding,{},check),saved=await c.store.lifecycle.execution({binding:receipt.targetBinding,scopes,selectedClientId:id(5)},check);
 assert.deepEqual(target.run.versions,renderB);assert.deepEqual(saved.continuation.checkpoint,proof.checkpoint);assert.deepEqual(proof.checkpoint.versions,versions);
 assert.equal(hash(saved.sourceRequest),hash(source.request));assert.equal(target.request.prompt,source.request.prompt);assert.notEqual(target.request.requestId,source.request.requestId);
 const options=buildContinuationOptions(saved.continuation,{binding:target.run.binding,versions:target.run.versions,scopes,request:target.request,sourceRequest:saved.sourceRequest});
 assert.equal(options.resume,proof.checkpoint.sessionId);assert.equal(options.resumeSessionAt,proof.resumeSessionAt);
 if(mode==='fork'){assert.notEqual(options.sessionId,proof.checkpoint.sessionId);assert.equal(options.forkSession,true);assert.equal(c.counts.claims,1);assert.deepEqual(c.initial.get(target.run.binding.conversationId).versions,renderB);}
 else{assert.equal(target.run.binding.writerFence,binding.writerFence+1);assert.equal(c.counts.claims,0);assert.equal(options.forkSession,undefined);}
 const after=await f.store.read(binding,{},check);assert.deepEqual(after.run,source.run);assert.equal(after.run.state,'paused');
});
for(const field of ['sdk','cli'])test(`image-deploy continuation refuses incompatible ${field} before target or stop`,async t=>{
 const c=await deployed({...renderB,[field]:'0.2.999'});t.after(c.close);const starts=c.f.state.starts;
 for(const [index,mode] of ['resume','fork'].entries())await assert.rejects(c.service.control({credential:c.f.credential,input:{controlId:id(740+index),intent:mode,checkpointId:id(220),checkpointSha256:c.proof.checkpointSha256}}));
 assert.equal(c.f.state.runs.size,1);assert.equal(c.f.state.starts,starts);assert.equal(c.counts.stops,0);assert.equal(c.counts.claims,0);assert.equal(c.f.state.nextRuns.size,0);
});
