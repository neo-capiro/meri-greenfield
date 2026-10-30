import test from 'node:test';
import assert from 'node:assert/strict';
import {createBrowserViewerApplication} from './application.mjs';
import {createBrowserViewerHttp} from './http.mjs';
import {BROWSER_VIEWER_SCHEMA as schema} from '../../../packages/contracts/browser-viewer/receive.mjs';
const id=n=>`${String(n).padStart(8,'0')}-0000-4000-8000-000000000000`;
const sourceBinding={tenantId:id(1),actorId:id(2),conversationId:id(3),runId:id(4),attemptId:id(5),workerId:id(6),writerFence:1};
const context={tenantId:id(1),actorId:id(2),conversationId:id(3),runId:id(4),selectedClientId:null};
const credential='action_session_'+'a'.repeat(43);
function fixture(){
 let held={sourceBinding,selectedClientId:null,expiresAtMs:100000,state:'available',ownerInstanceId:null,custody:null};
 const controls=[],host=[];
 const lifecycle={async readTakeover(q){assert.equal(q.credential,credential);return held;},async control(q){controls.push(q.input);held={...held,state:'pending'};return {state:'PENDING'};}};
 const transport={async execute(q){host.push(q);return {schema,context,ownerId:id(7),requestId:q.request.requestId,ticket:'T'.repeat(43),expiresAtMs:60000};}};
 const application=createBrowserViewerApplication({lifecycle,transport,now:()=>1000});
 const http=createBrowserViewerHttp({application,now:()=>1000});
 const run=(route,body={schema})=>http.handle(new Request(`https://control.test/api/meri/browser/${route}`,{method:'POST',headers:{authorization:`Bearer ${credential}`,'content-type':'application/json'},body:JSON.stringify(body)}));
 const hold=()=>{held={...held,state:'held',ownerInstanceId:id(7),custody:{binding:sourceBinding,ownerInstanceId:id(7),hostId:id(8),generation:1,expiresAtMs:100000,leaseEpoch:1}};};
 return {application,http,run,controls,host,transport,hold,revoke:()=>{lifecycle.readTakeover=async()=>{throw Object.assign(Error('SESSION_REFUSED'),{code:'SESSION_REFUSED'});};}};
}
test('mounted ticket starts only the canonical begin; pending read never retries it',async()=>{
 const f=fixture(),before=await (await f.run('read')).json();assert.equal(before.state,'agent');
 const pending=await f.run('ticket',{schema,requestId:id(9)});assert.equal(pending.status,409);
 assert.deepEqual(f.controls,[{controlId:id(9),intent:'takeover.begin'}]);assert.equal(f.host.length,0);
 assert.equal((await (await f.run('read')).json()).state,'taking');
 const next=await f.run('ticket',{schema,requestId:id(10)});assert.equal(next.status,409);assert.equal(f.controls.length,1);
});
test('held connection routes by canonical custody and strips routing/session metadata from response',async()=>{
 const f=fixture();f.hold();const reply=await f.run('ticket',{schema,requestId:id(9)});
 assert.equal(reply.status,200);const body=await reply.text();
 assert(!body.includes('sessionKey'));assert(!body.includes('custody'));assert(!body.includes('hostId'));assert(!body.includes(credential));
 assert.equal(f.controls.length,0);assert.equal(f.host[0].grant.custody.hostId,id(8));assert.match(f.host[0].grant.sessionKey,/^[0-9a-f]{64}$/u);
});
test('revocation during a host call withholds the late result',async()=>{
 const f=fixture();f.hold();const execute=f.transport.execute;f.transport.execute=async q=>{const result=await execute(q);f.revoke();return result;};
 const reply=await f.run('ticket',{schema,requestId:id(9)});assert.equal(reply.status,403);
 assert.deepEqual((await reply.json()).error,{code:'ACCESS_DENIED',outcome:'UNKNOWN'});
});
test('caller owner mismatch is refused before dispatch to the host',async()=>{
 const f=fixture();f.hold();const reply=await f.run('release',{schema,requestId:id(9),ownerId:id(99),viewerId:id(10),leaseEpoch:1});
 assert.equal(reply.status,409);assert.equal(f.host.length,0);
});
test('HTTP requires the existing session, exact path and bounded native request',async()=>{
 const f=fixture();
 for(const [path,headers,status] of [['read',{},401],['read?ticket=hidden',{authorization:`Bearer ${credential}`},404],
  ['read',{authorization:`Bearer ${credential}`,'content-length':'99999999'},413]]){
  const response=await f.http.handle(new Request(`https://control.test/api/meri/browser/${path}`,{method:'POST',headers:{'content-type':'application/json',...headers},body:JSON.stringify({schema})}));
  assert.equal(response.status,status);assert.equal((await response.json()).error.outcome,'NOT_DISPATCHED');
 }
 assert.equal(f.host.length,0);assert.equal(f.controls.length,0);
});
