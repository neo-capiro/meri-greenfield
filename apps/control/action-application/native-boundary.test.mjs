/** Current attended HTTP/retention and draft validation, over the actual composed native owners. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {actionFixture,id} from '../../runtime/native-authority/test/standalone-actions-fixture.mjs';
import {listenActionApplication} from './node-http.mjs';
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
async function json(f,route,body){const r=await f.call(route,body);assert.equal(r.status,200,await r.clone().text());return r.json();}
async function selected(f){const q=await json(f,'query',{request:{limit:20}});return {resultReference:q.resultReference,resultSha256:q.resultSha256,actionId:q.observation.result.actions[0].id};}
test('current native action flow crosses real loopback HTTP and closes the owned listener',async()=>{
 const f=actionFixture(),server=await listenActionApplication({app:f.app,host:'127.0.0.1',port:0,lifetimeMs:10000});
 const send=async(route,body)=>{const r=await fetch(server.origin+'/api/action-followthrough/'+route,{method:'POST',headers:{authorization:'Bearer synthetic-session','content-type':'application/json'},body:JSON.stringify(body)});assert.equal(r.status,200,await r.clone().text());return r.json();};
 try{const q=await send('query',{request:{}}),selection={resultReference:q.resultReference,resultSha256:q.resultSha256,actionId:q.observation.result.actions[0].id};
  const draft=await send('draft',{selection}),p=await send('prepare',{requestId:id(70),draft});assert.equal(f.state.effects,0);
  const first=await send('execute',{proposal:p.proposal});assert.deepEqual(await send('execute',{proposal:p.proposal}),first);assert.equal(f.state.effects,1);
 }finally{await server.close();}assert.equal(server.status().activeSockets,0);assert.equal(server.status().listening,false);
});
for(const change of [r=>new Request(r.url+'?scope=other',r),r=>new Request(r.url,{method:'GET',headers:r.headers}),r=>{r.headers.delete('authorization');return r;},r=>{r.headers.set('content-encoding','gzip');return r;}])test('malformed HTTP is refused before source or metadata',async()=>{
 const f=actionFixture();assert.notEqual((await f.app.handle(change(f.request('query',{request:{}})))).status,200);assert.equal(f.state.sourceCalls,0);assert.equal(f.metadata.rows.size,0);
});
for(const edits of [{ownerUserId:'caller'},{title:'x'.repeat(241)},{dueDate:'2026-10-20T12:00:00.000Z'},{clientId:id(90)},{title:'  '}])test('recommendation edits preserve the closed task fields '+JSON.stringify(edits).slice(0,45),async()=>{
 const f=actionFixture(),selection=await selected(f);assert.notEqual((await f.call('draft',{selection,edits})).status,200);assert.equal(f.metadata.rows.size,0);assert.equal(f.state.effects,0);
});
for(const mutate of [x=>x.recommendation.title='changed',x=>x.source.actionSha256='f'.repeat(64),x=>x.task.clientId=id(90),x=>x.source.originalBinding.actorId='foreign'])test('a rehashed caller draft cannot change retained evidence',async()=>{
 const f=actionFixture(),draft=await json(f,'draft',{selection:await selected(f)});mutate(draft);const {draftSha256,...body}=draft;draft.draftSha256=hash(body);
 assert.notEqual((await f.call('prepare',{requestId:id(70),draft})).status,200);assert.equal(f.metadata.rows.size,0);
});
test('retained lookup tampering is refused before task metadata',async()=>{
 const f=actionFixture(),draft=await json(f,'draft',{selection:await selected(f)});[...f.lookup.lookups.values()][0].record.observation.result.actions[0].title='changed';
 assert.notEqual((await f.call('prepare',{requestId:id(70),draft})).status,200);assert.equal(f.metadata.rows.size,0);
});
test('the final serving lock withholds an already stored query without pretending it was not dispatched',async()=>{
 const f=actionFixture({retention:{async assertServable(){},async withRelease(){throw Error('suppressed');}}});
 const r=await f.call('query',{request:{}});assert.notEqual(r.status,200);assert.equal((await r.json()).error.outcome,'RESULT_NOT_RELEASED');assert.equal(f.state.sourceCalls,1);
});
