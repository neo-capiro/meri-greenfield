/** Native reference -> real SessionStore HTTP owner; SDK callbacks are synthetic. */
import test from 'node:test';import assert from 'node:assert/strict';
import {createRuntimeSdkSessionFactory} from '../sdk-session-runtime.mjs';
import {createNativeSdkSessionApplication} from '../sdk-session-http.mjs';
import {fixture,id,NOW} from '../native-authority/test/fixture.mjs';
import {versions} from '../../control/conversations/test/store-fixture.mjs';
async function setup(mode,{mutate=()=>{}}={}){
 const f=fixture(),target={...f.key,...(mode==='fork'?{sessionId:id(70)}:{})},source={...f.binding,runId:id(80),attemptId:id(81),workerId:id(82),...(mode==='fork'?{conversationId:id(83)}:{})};
 const sdkSession={binding:source,key:f.key,ownerSha256:'a'.repeat(64),entriesCount:3},transcripts=[{entries:[{type:'user',uuid:id(90),future:{opaque:['first',null]}},{type:'assistant',uuid:id(91),future:{opaque:'second'}}]},{subpath:'subagents/child',entries:[{type:'system',future:{opaque:true}}]}];
 const scopes=[{tenantId:f.binding.tenantId,kind:'client',resourceId:id(6),policyRevision:'policy'}];
 const continuation={kind:'native-session',mode,controlId:id(84),sdkSession,versions,scopes,sourceRequestSha256:'b'.repeat(64),contextSha256:'c'.repeat(64),targetSessionId:mode==='fork'?target.sessionId:null};
 const app=createNativeSdkSessionApplication({owner:f.owner,now:()=>NOW}),calls=[],raw={binding:f.binding,key:f.key,sdkSession,transcripts};mutate(raw);
 const factory=createRuntimeSdkSessionFactory({origin:'https://native.synthetic.invalid',credential:'opaque-native-task',binding:f.binding,now:()=>NOW,
  fetchImpl:async(url,options)=>{const operation=new URL(url).pathname.split('/').at(-1);calls.push(operation);if(operation==='snapshot')return Response.json(raw);return app.handle(new Request(url,options));}});
 return {...f,target,source,continuation,transcripts,calls,open:()=>factory({binding:f.binding,sessionKey:target,continuation})};
}
for(const mode of ['resume','fork'])test(`${mode} restores opaque main/subagent bytes, writes only after actual target init, and never rewrites source`,async()=>{
 const f=await setup(mode),mirror=await f.open(),original=structuredClone(f.transcripts);
 assert.deepEqual(await mirror.store.load(f.key),f.transcripts[0].entries);assert.deepEqual(await mirror.store.listSubkeys(f.key),['subagents/child']);
 assert.deepEqual(await mirror.store.load({...f.key,subpath:'subagents/child'}),f.transcripts[1].entries);
 const appended={type:'assistant',uuid:id(92),future:{opaque:'new'}},pending=mirror.store.append(f.target,[appended]);await new Promise(resolve=>setImmediate(resolve));
 assert.deepEqual(f.calls,['snapshot']);assert.equal(f.state().owner,null);
 mirror.store.observeInit({type:'system',subtype:'init',session_id:f.target.sessionId});await pending;await mirror.settle();
 assert.equal(f.calls.filter(p=>p==='register').length,1);assert.equal(f.state().owner.session_id,f.target.sessionId);assert.equal(f.state().entries.length,4);
 assert.deepEqual(f.state().entries.filter(e=>e.subpath==='').map(e=>e.entry),[...original[0].entries,appended]);assert.deepEqual(f.transcripts,original);
 if(mode==='fork')assert.deepEqual(await mirror.store.load(f.key),original[0].entries,'SDK can still read the immutable source namespace');
 assert.deepEqual(await mirror.store.load(f.target),[...original[0].entries,appended]);await mirror.close();
});
for(const mutation of ['key','owner','count','duplicate'])test(`restore rejects ${mutation} substitution before registration`,async()=>{
 const f=await setup('resume',{mutate:r=>{if(mutation==='key')r.key={...r.key,projectKey:'foreign'};if(mutation==='owner')r.sdkSession={...r.sdkSession,ownerSha256:'f'.repeat(64)};if(mutation==='count')r.transcripts[0].entries.pop();if(mutation==='duplicate')r.transcripts.push(r.transcripts[0]);}});
 await assert.rejects(f.open());assert.deepEqual(f.calls,['snapshot']);assert.equal(f.state().owner,null);
});
test('wrong init and close during pending init never register or replay a restored writer',async()=>{
 for(const wrong of [false,true]){const f=await setup('fork'),mirror=await f.open(),pending=mirror.store.append(f.target,[{type:'system'}]),rejected=assert.rejects(pending);
  await new Promise(resolve=>setImmediate(resolve));if(wrong)assert.throws(()=>mirror.store.observeInit({type:'system',subtype:'init',session_id:id(99)}));
  await assert.rejects(mirror.close());await rejected;assert.deepEqual(f.calls,['snapshot']);await assert.rejects(mirror.store.append(f.target,[{type:'system'}]));assert.equal(f.state().owner,null);
 }
});
test('revoked target registration preserves immutable source and never claims settlement',async()=>{
 const f=await setup('resume'),mirror=await f.open();f.revoke();mirror.store.observeInit({type:'system',subtype:'init',session_id:f.target.sessionId});
 await assert.rejects(mirror.store.append(f.target,[{type:'system'}]));await assert.rejects(mirror.settle());await assert.rejects(mirror.close());assert.equal(f.state().owner,null);assert.deepEqual(f.calls,['snapshot','register']);
});
