/** An original whose first turn never started is re-prepared, never bricked (O117): the real session owner, prepared-candidate
 * identity, conversation service and next-run owner of each render, over one scripted database that also carries the REAL initial
 * run-binding journal (generations) and the run-keyed original-input journal. A render is a deployment: its runtime versions and its
 * configuration hash. The Date clock advances through the full 15-minute original window without sleeping. */
import test from 'node:test';import assert from 'node:assert/strict';
import {createConversationIdentity as createPreparedCandidateIdentity} from '../conversation-identity.mjs';
import {createActionSessionOwner,issuedCurrentState} from '../../control/action-host/session/owner.mjs';
import {createConversationService} from '../../control/conversations/service.mjs';
import {createNextRunOwner} from '../../control/conversations/next-run.mjs';
import {createInitialRunBindingJournal} from '../../control/conversations/initial-run-binding-journal.mjs';
import {lifecycleFixture,binding as profileBinding,scopes,id,versions} from '../../control/conversations/test/lifecycle-fixture.mjs';

const check=()=>{},clientId=scopes[0].resourceId,policyRevision=scopes[0].policyRevision,conversationId=id(730);
const principal={tenantId:profileBinding.tenantId,actorId:profileBinding.actorId};
const RENDER_A={versions,configurationSha256:'c'.repeat(64)};
const RENDER_B={versions:{...versions,imageDigest:`sha256:${'f'.repeat(64)}`,skillsDigest:'e'.repeat(64)},configurationSha256:'d'.repeat(64)};
const ORIGINAL_WINDOW_MS=900000,START_AT=1800000000000;

async function database(t){
 t.mock.timers.enable({apis:['Date'],now:START_AT});
 // The conversation fixture's store is bound to a placeholder first run; the original under test is minted by the journal.
 const f=await lifecycleFixture({binding:{...profileBinding,conversationId,runId:id(731),attemptId:id(732),workerId:id(733)}});let serial=800;
 const journal=createInitialRunBindingJournal({pool:f.pool});
 const retirement={async verifyRetired(){return {physicalStopProven:true};}},revocation={async verifyRevoked(){throw Error('NEXT_RUN_REVOCATION_REQUIRED');}};
 /** One control render: its own identity, session owner, conversation service and next-run owner, over the shared durable state. */
 function render(r,{policy=policyRevision,client=clientId,actor=principal.actorId}={}){const lines=[],who={...principal,actorId:actor};
  const nextRunOwner=createNextRunOwner({store:f.store,versions:r.versions,newId:()=>id(serial++),retirement,revocation});
  const identity=createPreparedCandidateIdentity({store:f.store,identity:{origin:'https://authority.synthetic.invalid',
   async fetchImpl(url,options){const input=JSON.parse(options.body),now=Date.now(),base={principal:who,identityRevision:'native-1',checkedAtMs:now,expiresAtMs:now+30000};if(url.endsWith('/identity'))return Response.json(base);
    return Response.json({...base,identitySha256:input.identitySha256,conversationId,selectedClientId:client,contextRevision:'native-context-1'});}},
   qualification:{policyRevision:policy},limits:{maxRequestMs:2000,maxFactBytes:131072},nextRunOwner,initialBindings:journal,configurationSha256:r.configurationSha256,versions:r.versions,proposeInitialExpiry:()=>Date.now()+ORIGINAL_WINDOW_MS,factWindowMs:900000});
  const sessions=createActionSessionOwner({mode:'process-local',verifyIdentity:identity.verifyIdentity,resolveContext:identity.resolveContext,limits:{maxSessions:8,maxRequestMs:2000,maxTtlMs:30000,maxFactBytes:131072},refusals:(step,error)=>lines.push({step:error?.step??step,code:error?.reason??error?.code})});
  const service=createConversationService({sessions,store:f.store,dispatcher:f.dispatcher,versions:r.versions,newId:()=>id(serial++)});
  async function issue(exact={}){const out=await issuedCurrentState(sessions)({identityCredential:'native-bearer',hints:{conversationId,clientId:client,...exact}});return {credential:out.receipt.credential,binding:out.current.binding};}
  return {issue,service,sessions,lines,close:()=>sessions.close()};}
 const generations=()=>f.pool&&[...f.bindings].filter(b=>b.conversation_id===conversationId).map(b=>({generation:b.generation,runId:b.run_id}));
 const send=async(r,credential,prompt='Hello',requestId=id(serial++))=>{const input={requestId,prompt};await r.service.allocateInput({credential,input});return {input,run:(await r.service.submit({credential,input})).run};};
 const runs=()=>[...f.state.runs.values()].filter(r=>r.conversation_id===conversationId).map(r=>r.projection);
 return {f,journal,render,generations,send,runs,advance:ms=>t.mock.timers.setTime(Date.now()+ms),close:()=>f.close()};
}

test('an original that expired before its first turn is re-prepared on the next issuance, and turn 1 runs',async t=>{const d=await database(t),a=d.render(RENDER_A);try{
 const first=await a.issue();assert.equal(first.binding.writerFence,1);d.advance(ORIGINAL_WINDOW_MS+1);
 const again=await a.issue();assert.notEqual(again.binding.runId,first.binding.runId,'a new generation');assert.deepEqual(d.generations().map(g=>g.generation),[1,2]);
 const {run}=await d.send(a,again.credential);assert.deepEqual(run.binding,again.binding);assert.equal(d.f.state.starts,1,'turn 1 dispatched');assert.deepEqual(d.runs().map(r=>r.binding.runId),[again.binding.runId]);
 assert.deepEqual(a.lines,[],'no refusal');
}finally{a.close();d.close();}});

test('an original claimed under release A and never started is re-prepared under release B, and turn 1 runs there',async t=>{const d=await database(t),a=d.render(RENDER_A),b=d.render(RENDER_B);try{
 const first=await a.issue(),stale={requestId:id(990),prompt:'stale tab'};await a.service.allocateInput({credential:first.credential,input:stale});
 const second=await b.issue();assert.notEqual(second.binding.runId,first.binding.runId);
 const latest=await d.journal.read({binding:second.binding},check);assert.equal(latest.configurationSha256,RENDER_B.configurationSha256);assert.deepEqual(latest.versions,RENDER_B.versions);
 // The tab still holding release A's original is refused at its next recheck: it is pinned to its run, so it never re-prepares.
 await assert.rejects(a.service.submit({credential:first.credential,input:stale}),{code:'SESSION_REFUSED'});
 assert.deepEqual(a.lines,[{step:'initial-binding',code:'INITIAL_BINDING_SUPERSEDED'}]);assert.deepEqual(d.generations().map(g=>g.generation),[1,2],'the stale recheck minted nothing');
 // Under the conversation lock, the dead run's reserved input can be neither re-reserved nor accepted.
 const dead=[...d.f.allocations.values()].find(r=>r.run_id===first.binding.runId);assert.equal(dead.state,'RESERVED');
 await assert.rejects(d.f.store.initialInputs.claim(dead.allocation,check),{code:'INITIAL_INPUT_SUPERSEDED'});
 const {run}=await d.send(b,second.credential);assert.deepEqual(run.versions,RENDER_B.versions);assert.deepEqual(run.binding,second.binding);assert.equal(d.f.state.starts,1);
}finally{a.close();b.close();d.close();}});

test('a first send that reserved input but never ran: the rebind supersedes the input with it, and the retried send works',async t=>{const d=await database(t),a=d.render(RENDER_A);try{
 const first=await a.issue(),input={requestId:id(950),prompt:'first try'};await a.service.allocateInput({credential:first.credential,input});d.advance(ORIGINAL_WINDOW_MS+1);
 const again=await a.issue();assert.notEqual(again.binding.runId,first.binding.runId);
 const {run}=await d.send(a,again.credential,input.prompt,input.requestId);assert.deepEqual(run.binding,again.binding,'the same request id reaches the new run');
 const inputs=[...d.f.allocations.values()].map(r=>[r.run_id,r.state]);assert.deepEqual(inputs.sort(),[[first.binding.runId,'RESERVED'],[again.binding.runId,'ACCEPTED']].sort(),'the dead input stays as history');
}finally{a.close();d.close();}});

test('a started original is never rebound; another principal or client, or a changed policy after the start, is refused',async t=>{const d=await database(t),a=d.render(RENDER_A);try{
 const first=await a.issue();await d.send(a,first.credential);d.advance(ORIGINAL_WINDOW_MS+1);
 const b=d.render(RENDER_B),later=await b.issue();assert.deepEqual(later.binding,first.binding,'the live started run is bound again, never replaced');assert.equal(d.generations().length,1);
 for(const [options,code] of [[{actor:'actor-b'},{step:'initial-binding',code:'INITIAL_RUN_BINDING_CONFLICT'}],[{client:id(7)},{step:'initial-binding',code:'INITIAL_RUN_BINDING_CONFLICT'}],[{policy:'policy2'},{step:'initial-binding',code:'INITIAL_BINDING_POLICY_CHANGED'}]]){
  const other=d.render(RENDER_B,options);try{await assert.rejects(other.issue(),{code:'SESSION_REFUSED'});assert.deepEqual(other.lines,[code],JSON.stringify(options));}finally{other.close();}
 }
 assert.equal(d.generations().length,1,'no refusal minted a generation');b.close();
}finally{a.close();d.close();}});

test('two concurrent issuances of a dead unstarted original create exactly one new generation',async t=>{const d=await database(t),a=d.render(RENDER_A);try{
 await a.issue();const b=d.render(RENDER_B),c=d.render(RENDER_B);try{
  const [x,y]=await Promise.all([b.issue(),c.issue()]);assert.deepEqual(x.binding,y.binding);assert.deepEqual(d.generations().map(g=>g.generation),[1,2]);
 }finally{b.close();c.close();}
}finally{a.close();d.close();}});


test('an exact run constraint never claims or rebinds an original before refusing',async t=>{const d=await database(t),a=d.render(RENDER_A),b=d.render(RENDER_B);try{
 await assert.rejects(a.issue({runId:id(999)}),{code:'SESSION_REFUSED'});
 assert.deepEqual(d.generations(),[],'an unknown exact run leaves no original');
 const first=await a.issue();
 await assert.rejects(b.issue({runId:first.binding.runId}),{code:'SESSION_REFUSED'});
 assert.equal(d.generations().length,1,'a changed render with an exact run never supersedes');
 d.advance(ORIGINAL_WINDOW_MS+1);
 await assert.rejects(a.issue({runId:first.binding.runId}),{code:'SESSION_REFUSED'});
 assert.equal(d.generations().length,1,'an expired exact run never supersedes');
 const recovered=await b.issue();assert.notEqual(recovered.binding.runId,first.binding.runId);
 assert.deepEqual(d.generations().map(g=>g.generation),[1,2],'a fresh issuance alone recovers the original');
}finally{a.close();b.close();d.close();}});

test('an unstarted original preserves principal, client and policy ownership across expiry and release',async t=>{const d=await database(t),a=d.render(RENDER_A);try{
 const first=await a.issue();d.advance(ORIGINAL_WINDOW_MS+1);
 for(const options of [{actor:'actor-b'},{client:id(7)},{policy:'policy2'}]){
  const other=d.render(RENDER_B,options);try{
   await assert.rejects(other.issue(),{code:'SESSION_REFUSED'},JSON.stringify(options));
   assert.deepEqual(d.generations(),[{generation:1,runId:first.binding.runId}],'a refused owner never mints a generation');
  }finally{other.close();}
 }
 const current=d.render(RENDER_B);try{const recovered=await current.issue();assert.notEqual(recovered.binding.runId,first.binding.runId);}finally{current.close();}
}finally{a.close();d.close();}});
