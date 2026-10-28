/** External public listener -> runtime -> document/service/storage owners over synthetic authority/SQL. */
import test from 'node:test';import assert from 'node:assert/strict';
import {libraryFixture,NOW} from '../../../artifacts/test/library-fixture.mjs';import {createLocalDocumentPorts} from '../local/ports.mjs';
import {createRuntimeArtifactApplication} from '../../../runtime/artifacts/application.mjs';import {createControlRouteApplications} from '../../../runtime/control-route-boundary.mjs';
async function fixture(t,{releaseDenied=false}={}){const f=await libraryFixture(),state={closed:false,revoked:false,artifactChecks:0},now=f.options.now,clientId=f.context.scopes[0].resourceId,ports=createLocalDocumentPorts({binding:f.context.binding,scopes:f.context.scopes,clientId,deadlineMs:NOW+25000,now,state});t.after(()=>ports.sessions.close());
 const limits={maxRequestMs:5000,maxRequestBytes:131072,maxResponseBytes:1048576},checks=[],optionsOwner={async resolve(call){assert.equal(call.intent,'list');return {documentOptions:{sessions:ports.sessions,selectedClientId:clientId,artifactOptions:{...f.options,context:f.context,pool:{},authorize:ports.authorize},now,limits,enabled:true},async recheck(check){checks.push(check.phase);if(releaseDenied&&check.phase==='release')throw Object.assign(Error('ACCESS_DENIED'),{code:'ACCESS_DENIED'});}};}};
 const runtime=createRuntimeArtifactApplication({sessions:ports.sessions,optionsOwner,now,limits}),listeners=createControlRouteApplications({assembly:runtime,candidate:{async handle(){return null;}}}),session=await ports.sessions.issue({identityCredential:ports.nativeCredential});
 const request=(body,token=session.credential)=>new Request('https://meri.synthetic.invalid/api/documents/list',{method:'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify(body)});
 return {...f,sessionState:state,checks,listeners,request,post:(body,token)=>listeners.public.handle(request(body,token))};}
test('public control mount serves durable library and follows an empty denied page to an authorized row',async t=>{
 const f=await fixture(t);f.state.denied.add(f.a.version.binding.conversationId);
 const first=await f.post({...f.query,limit:1});assert.equal(first.status,200,await first.clone().text());const page=await first.json();assert.deepEqual(page.versions,[]);assert.match(page.nextCursor,/^[a-f0-9]{64}$/u);assert.equal(first.headers.get('cache-control'),'no-store');assert.deepEqual(f.checks,['admission','release']);
 const second=await f.post({...f.query,limit:1,cursor:page.nextCursor});assert.equal(second.status,200);assert.deepEqual((await second.json()).versions,[f.b.version]);
 assert.equal((await f.listeners.private.handle(f.request(f.query))).status,404);
});
test('public library request is closed and cannot supply origin authority',async t=>{
 const f=await fixture(t);for(const body of[{...f.query,tenantId:'other'},{...f.query,scope:'all'},{...f.query,limit:101},{...f.query,cursor:'not-cursor'},{...f.query,authorizeOrigin:{}}]){const response=await f.post(body);assert.equal(response.status,400);assert.equal((await response.json()).error.outcome,'NOT_DISPATCHED');}
 const cursor=await f.post({...f.query,cursor:'f'.repeat(64)});assert.equal(cursor.status,409);assert.equal((await cursor.json()).error.code,'ARTIFACT_LIBRARY_CURSOR');
 assert.equal((await f.post(f.query,'unknown-session')).status,403);
});
test('runtime current-authority release denial withholds library rows',async t=>{
 const f=await fixture(t,{releaseDenied:true}),response=await f.post(f.query);assert.equal(response.status,403);assert.deepEqual((await response.json()).error,{code:'ACCESS_DENIED',outcome:'RESULT_NOT_RELEASED'});
});
