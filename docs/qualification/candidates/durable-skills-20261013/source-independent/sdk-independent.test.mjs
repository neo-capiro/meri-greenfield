/** Actual SDK adapters, synthetic ports only; no query or provider launch. */
import test from 'node:test';import assert from 'node:assert/strict';import {pathToFileURL} from 'node:url';
const root=process.env.MERI_REVIEW_SOURCE_ROOT;assert.ok(root);const load=p=>import(pathToFileURL(root+'/'+p));
const {buildContinuationOptions}=await load('apps/worker/conversation/continuation/options.mjs');
const {createConversationInput}=await load('apps/worker/conversation/continuation/input.mjs');
const {createSdkCommandAdapter}=await load('apps/worker/conversation/continuation/commands.mjs');
const {continuationFixture,id}=await load('apps/worker/conversation/continuation/test/fixtures.mjs');
const {canonicalSha256:hash}=await load('packages/contracts/validate.mjs');
for(const mode of ['resume','fork'])test(mode+': complete supported options retain original intent and exact source preimage',()=>{
 const f=continuationFixture(mode),before=hash(f),out=buildContinuationOptions(f.continuation,f.target);
 assert.equal(hash(f),before);assert.equal(out.resume,f.continuation.checkpoint.sessionId);assert.ok(Object.isFrozen(out));
 assert.equal(f.target.request.prompt,f.target.sourceRequest.prompt);assert.notEqual(f.target.request.requestId,f.target.sourceRequest.requestId);
 assert.deepEqual(Object.keys(out).sort(),mode==='resume'?['resume','resumeSessionAt']:['forkSession','resume','resumeSessionAt','sessionId']);
});
for(const [name,change]of [
 ['changed original prompt',f=>f.target.request.prompt='Other original intent'],
 ['new hidden target source request field',f=>f.target.sourceRequest.hiddenAuthority=true],
 ['correlated foreign source actor',f=>{const cp=f.continuation.checkpoint;cp.binding.actorId='foreign';cp.workspace.binding.actorId='foreign';cp.workspaceSha256=hash(cp.workspace);f.continuation.checkpointSha256=hash(cp);}],
 ['foreign opaque-session scope',f=>{f.continuation.checkpoint.opaqueSession.scopes[0].tenantId='foreign';f.continuation.checkpointSha256=hash(f.continuation.checkpoint);}],
])test('Exact continuation refuses '+name+' even when checkpoint digest is recomputed',()=>{const f=continuationFixture();change(f);assert.throws(()=>buildContinuationOptions(f.continuation,f.target));});
test('SDK input is literal, detached and single-consumer; close discards unread steering',async()=>{
 const input=createConversationInput({requestId:id(30),prompt:'/config @secret-file',maxQueued:1}),iterator=input.prompt[Symbol.asyncIterator]();
 try{const first=(await iterator.next()).value;assert.equal(first.client_composed,true);assert.equal(first.message.content,'/config @secret-file');assert.ok(Object.isFrozen(first.message));
  input.enqueue({controlId:id(31),prompt:'Do not deliver after close'});input.close();assert.equal((await iterator.next()).done,true);
  assert.throws(()=>input.prompt[Symbol.asyncIterator](),/ALREADY_CONSUMED/);
 }finally{input.close();await iterator.return();}
});
function adapterFixture(){
 const f=continuationFixture(),calls=[],input=createConversationInput({requestId:id(30),prompt:'Synthetic original'}),query={async interrupt(){calls.push('interrupt');assert.strictEqual(this,query);return {still_queued:[id(50)]};},close(){calls.push('close');assert.strictEqual(this,query);}};
 const lifetime={check(){},async run(fn){return fn(new AbortController().signal);}};
 const adapter=createSdkCommandAdapter({binding:f.target.binding,contextSha256:f.contextSha256,input,query,lifetime});
 const command={controlId:id(31),action:'steer',binding:f.target.binding,contextSha256:f.contextSha256,prompt:'Synthetic steering'};
 return {input,query,lifetime,adapter,command,calls};
}
test('Concurrent exact controls enqueue one steering UUID, altered replay refuses',async()=>{
 const f=adapterFixture(),iterator=f.input.prompt[Symbol.asyncIterator]();try{await iterator.next();
  const values=await Promise.all([f.adapter.apply(f.command),f.adapter.apply(f.command)]);
  assert.equal(values.filter(v=>v.dispatched).length,1);assert.ok(values.every(v=>v.outcome==='UNKNOWN'&&!v.physicalStopProven));
  assert.equal((await iterator.next()).value.uuid,f.command.controlId);
  await assert.rejects(f.adapter.apply({...f.command,prompt:'Altered'}),/REPLAY_REFUSED/);assert.deepEqual(f.calls,[]);
 }finally{f.adapter.close();await iterator.return();}
});
test('Hostile command data refuses without property effects or Query calls',async()=>{
 const f=adapterFixture();let effects=0;try{const command={...f.command};Object.defineProperty(command,'prompt',{enumerable:true,get(){effects++;return 'Unexpected';}});
  await assert.rejects(f.adapter.apply(command));await assert.rejects(f.adapter.apply(new Proxy({},{get(){effects++;},ownKeys(){effects++;return []}})));
  assert.equal(effects,0);assert.deepEqual(f.calls,[]);
 }finally{f.adapter.close();}
});
test('Attempted steering with synchronous input failure remains locally UNKNOWN and never retries',async()=>{
 const f=adapterFixture();let attempts=0;const input={enqueue(){attempts++;throw Error('synthetic-enqueue-failure');},close(){}};
 const adapter=createSdkCommandAdapter({binding:f.command.binding,contextSha256:f.command.contextSha256,input,query:f.query,lifetime:f.lifetime});
 try{await assert.rejects(adapter.apply(f.command));const replay=await adapter.apply(f.command);assert.equal(replay.outcome,'UNKNOWN');assert.equal(replay.dispatched,false);assert.equal(attempts,1);}
 finally{adapter.close();f.adapter.close();}
});
