import test from 'node:test';import assert from 'node:assert/strict';
import {InMemorySessionStore} from '@anthropic-ai/claude-agent-sdk';
import {createContinuationRuntimeSdkSession} from '../../sdk-continuation-session.mjs';
import {createRuntimeSdkSessionFactory} from '../../sdk-session-runtime.mjs';
import {createNativeSdkSessionApplication} from '../session-http.mjs';
import {continuationFixture,id} from '../../../worker/conversation/continuation/test/fixtures.mjs';
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
function fixture(mode='resume'){
 const f=continuationFixture(mode),projectKey='-workspace-conversation',source={projectKey,sessionId:f.continuation.checkpoint.sessionId},target={projectKey,sessionId:mode==='resume'?source.sessionId:f.continuation.targetSessionId},history=[{type:'system',future:{opaque:['exact',null,7]}},{type:'user',uuid:id(90),message:{role:'user',content:'original'}}],child=[{type:'assistant',opaque:{retained:true}}],native=new InMemorySessionStore(),gate=Promise.withResolvers();let registered=false,registers=0,writes=0,snapshots=0,uncertain=false;
 const client={async snapshot(){snapshots++;return {binding:f.target.binding,key:source,checkpointSha256:f.continuation.checkpointSha256,opaqueSessionSha256:f.continuation.checkpoint.opaqueSession.sha256,transcripts:[{entries:history},{subpath:'subagents/original',entries:child}]};},async register({key}){registers++;assert.deepEqual(key,target);await gate.promise;registered=true;return {registered:true,key};},async load({key}){assert.equal(registered,true);const entries=await native.load(key);return {entries,offset:entries?.length??0};},async listSubkeys({key}){assert.equal(registered,true);return {subkeys:await native.listSubkeys(key)};},async append(value){assert.equal(registered,true);assert.equal(value.key.sessionId,target.sessionId,'source namespace never receives a write');assert.equal(value.entriesSha256,hash(value.entries));const before=await native.load(value.key);assert.equal(value.expectedOffset,before?.length??0);writes++;await native.append(value.key,value.entries);if(uncertain)throw Error('synthetic-lost-append-ack');return {committed:true,appendId:value.appendId,entriesSha256:value.entriesSha256,offset:value.expectedOffset+value.entries.length,added:value.entries.length};}};
 return {f,source,target,history,child,client,native,gate,state:()=>({registered,registers,writes,snapshots}),uncertain:()=>{uncertain=true;}};
}
for(const mode of ['resume','fork'])test(`${mode}: supported SDK snapshot reads precede register; target writes wait for independent owner acknowledgement`,async()=>{
 const x=fixture(mode),mirror=await createContinuationRuntimeSdkSession({client:x.client,binding:x.f.target.binding,sessionKey:x.target,continuation:x.f.continuation});
 assert.deepEqual(await mirror.store.load(x.source),x.history);assert.deepEqual(await mirror.store.listSubkeys(x.source),['subagents/original']);assert.deepEqual(await mirror.store.load({...x.source,subpath:'subagents/original'}),x.child);assert.equal(x.state().registers,0);assert.equal(x.state().writes,0);
 const newEntry={type:'assistant',uuid:id(91),message:{role:'assistant',content:'new target'}},writing=mirror.store.append(x.target,[newEntry]);await new Promise(resolve=>setImmediate(resolve));assert.equal(x.state().registers,1);assert.equal(x.state().writes,0,'zero seed/current writes before original native witness acknowledgement');
 x.gate.resolve();await writing;await mirror.settle();assert.deepEqual(await x.native.load(x.target),[...x.history,newEntry]);assert.deepEqual(await x.native.load({...x.target,subpath:'subagents/original'}),x.child);
 if(mode==='fork'){assert.deepEqual(await x.native.load(x.source),null);assert.deepEqual(await mirror.store.load(x.source),x.history);await assert.rejects(mirror.store.append(x.source,[newEntry]));await assert.rejects(mirror.close());}else await mirror.close();
});
test('snapshot reads cannot establish completed target or native registration',async()=>{
 const x=fixture(),mirror=await createContinuationRuntimeSdkSession({client:x.client,binding:x.f.target.binding,sessionKey:x.target,continuation:x.f.continuation});await mirror.store.load(x.source);await assert.rejects(mirror.settle());assert.equal(x.state().registers,0);await mirror.close();
});
test('revoked native registration rejects first write and permanently bars redispatch',async()=>{
 const x=fixture(),mirror=await createContinuationRuntimeSdkSession({client:x.client,binding:x.f.target.binding,sessionKey:x.target,continuation:x.f.continuation}),writing=mirror.store.append(x.target,[{type:'assistant'}]);x.gate.reject(Error('synthetic-revoked'));await assert.rejects(writing);await assert.rejects(mirror.store.append(x.target,[{type:'assistant'}]));assert.equal(x.state().registers,1);assert.equal(x.state().writes,0);await assert.rejects(mirror.close());
});
test('uncertain seeded target write cannot be retried or report success',async()=>{
 const x=fixture();x.uncertain();x.gate.resolve();const mirror=await createContinuationRuntimeSdkSession({client:x.client,binding:x.f.target.binding,sessionKey:x.target,continuation:x.f.continuation});await assert.rejects(mirror.store.append(x.target,[{type:'assistant'}]));await assert.rejects(mirror.store.append(x.target,[{type:'assistant'}]));assert.equal(x.state().writes,1);await assert.rejects(mirror.settle());await assert.rejects(mirror.close());
});
test('prepare cancellation stays separate from actual query lifetime after immutable snapshot read',async()=>{
 const x=fixture(),prepare=new AbortController(),runtime=new AbortController(),mirror=await createContinuationRuntimeSdkSession({client:x.client,binding:x.f.target.binding,sessionKey:x.target,continuation:x.f.continuation,signal:prepare.signal,runtimeSignal:runtime.signal});prepare.abort();assert.deepEqual(await mirror.store.load(x.source),x.history);runtime.abort();await assert.rejects(mirror.store.load(x.source));await mirror.close();
});
test('closed snapshot and foreign source key cannot be reused; first child write refuses before register',async()=>{
 const x=fixture(),mirror=await createContinuationRuntimeSdkSession({client:x.client,binding:x.f.target.binding,sessionKey:x.target,continuation:x.f.continuation});await assert.rejects(mirror.store.load({...x.source,sessionId:id(99)}));await assert.rejects(mirror.store.append({...x.target,subpath:'child'},[{type:'assistant'}]));assert.equal(x.state().registers,0);await mirror.close();await assert.rejects(mirror.store.load(x.source));
});
test('snapshot transport rejects worker checkpoint/key hints and preserves deep opaque entries',async()=>{
 const x=fixture(),snapshotRaw=await x.client.snapshot(),nested={type:'system'};let cursor=nested;for(let i=0;i<100;i++){cursor.next={};cursor=cursor.next;}snapshotRaw.transcripts[0].entries.push(nested);
 const owner={async register(){throw Error('target-witness-not-yet-observed');},async load(){throw Error('target-not-yet-observed');},async append(){throw Error('target-not-yet-observed');},async listSubkeys(){throw Error('target-not-yet-observed');}},snapshot={async readSnapshot({credential,request}){assert.equal(credential,'synthetic-task');assert.deepEqual(request,{binding:x.f.target.binding});return snapshotRaw;}},app=createNativeSdkSessionApplication({owner,snapshot});
 const factory=createRuntimeSdkSessionFactory({origin:'https://synthetic-native.invalid',credential:'synthetic-task',binding:x.f.target.binding,fetchImpl:(url,options)=>app.handle(new Request(url,options))}),mirror=await factory({binding:x.f.target.binding,sessionKey:x.target,continuation:x.f.continuation});assert.deepEqual(await mirror.store.load(x.source),snapshotRaw.transcripts[0].entries);await mirror.close();
});
