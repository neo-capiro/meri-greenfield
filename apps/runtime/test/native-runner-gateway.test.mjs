import test from 'node:test';import assert from 'node:assert/strict';
import {createNativeRunnerGateway} from '../native-runner-gateway.mjs';
import {createWorkerRunApplication} from '../worker-http.mjs';
import {createNativeSdkSessionApplication} from '../native-authority/session-http.mjs';
import {createNativeSdkSessionClient} from '../native-authority/session-client.mjs';
import {applicationFixture,binding,scopes,id} from '../../control/conversations/test/application-fixture.mjs';
import {fixture,NOW,id as sessionId} from '../native-authority/test/fixture.mjs';
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {runOwnerOperations} from '../../../packages/contracts/runtime-0.2/validate.mjs';
import {sdkSessionOperations} from '../../../packages/contracts/runtime-0.2/session.mjs';
const limits={maxRequestMs:1000,maxRequestBytes:9437184,maxResponseBytes:35651584};
const request=(path,body='{}',token='presented-task',options={})=>{const {headers,...rest}=options;return new Request('https://native.synthetic.invalid'+path,{method:'POST',body,...rest,headers:{authorization:'Bearer '+token,'content-type':'application/json',...headers}});};
const make=(fetchImpl,options={})=>createNativeRunnerGateway({controlOrigin:'https://control.synthetic.invalid',fetchImpl,limits,enabled:true,...options});
test('all canonical relay destinations preserve presented bearer and exact bytes; unrelated provider operations fall through',async()=>{
 const calls=[],body='{ "opaque": {"duplicates":[1,1]} }\n',gateway=make(async(url,init)=>{calls.push({url,init});return new Response(' { "ok" : true }\n',{headers:{'content-type':'application/json'}});});
 for(const op of Object.keys(runOwnerOperations)){const r=await gateway.handle(request('/v1/runner/'+op,body,'actual-presented-'+op));assert.equal(r.status,200);assert.equal(await r.text(),' { "ok" : true }\n');const c=calls.at(-1);assert.equal(c.url,'https://control.synthetic.invalid/internal/conversations/'+op);assert.equal(c.init.headers.authorization,'Bearer actual-presented-'+op);assert.equal(Buffer.from(c.init.body).toString(),body);assert.equal(c.init.redirect,'error');assert.equal(c.init.credentials,'omit');}
 for(const op of sdkSessionOperations){assert.equal((await gateway.handle(request('/v1/runner/session/'+op))).status,200);assert.equal(calls.at(-1).url,'https://control.synthetic.invalid/v1/runner/session/'+op);}
 for(const path of ['/v1/worker/authorize','/v1/readiness','/v1/execution/start','/v1/runner/runtime','/v1/runner/checkpoint/capture','/v1/runner/load/extra'])assert.equal(await gateway.handle(request(path)),null);
 assert.equal(calls.length,10);
});
test('relay executes canonical task-authorized load/publish and denies foreign/revoked tasks before further durable effects',async()=>{
 const f=await applicationFixture(),decisions=[];await f.service.submit({credential:f.credential,input:f.input});
 const native={async call(operation,input){assert.equal(operation,'worker/authorize');decisions.push(input);if(f.state.revoked||input.capability!=='presented-task'||hash(input.binding)!==hash(binding))throw Error('scripted task refusal');const at=Date.now();return {binding,operation:input.operation,inputSha256:input.inputSha256,identityCredential:'synthetic-existing-native',scopes,selectedClientId:scopes[0].resourceId,policyRevision:'policy1',authorizationDecisionId:'scripted-task-decision',checkedAtMs:at,expiresAtMs:at+1000};}};
 const control=createWorkerRunApplication({service:f.service,sessions:f.sessions,native,configuration:{limits:{requestMs:1000,requestBytes:131072}}}),gateway=make((url,init)=>control.handle(new Request(url,init)));
 try{const loaded=await gateway.handle(request('/v1/runner/load',JSON.stringify({binding})));assert.equal(loaded.status,200);assert.equal((await loaded.json()).request.prompt,'Hello');const event={eventId:id(800),createdAt:new Date().toISOString(),type:'run.status',data:{state:'starting',reasonCode:null}};
  assert.equal((await gateway.handle(request('/v1/runner/publish',JSON.stringify({binding,event})))).status,200);assert.equal((await f.service.history({credential:f.credential})).run.state,'starting');
  const before=f.state.events.get([binding.tenantId,binding.conversationId,binding.runId].join(':')).length;
  assert.equal((await gateway.handle(request('/v1/runner/publish',JSON.stringify({binding:{...binding,writerFence:99},event})))).status,403);
  f.state.revoked=true;assert.equal((await gateway.handle(request('/v1/runner/publish',JSON.stringify({binding,event})))).status,403);assert.equal(f.state.events.get([binding.tenantId,binding.conversationId,binding.runId].join(':')).length,before);assert.ok(decisions.every(v=>v.capability==='presented-task'));
 }finally{f.close();}
});
test('canonical SDK client/owner registers and preserves opaque deep entries, marker duplicates and UNKNOWN through relay',async()=>{
 const f=fixture(),control=createNativeSdkSessionApplication({owner:f.owner,now:()=>NOW});let forwards=0;
 const gateway=make((url,init)=>{forwards++;assert.equal(init.headers.authorization,'Bearer opaque-native-task');return control.handle(new Request(url,init));},{now:()=>NOW});
 const client=createNativeSdkSessionClient({origin:'https://native.synthetic.invalid',credential:'opaque-native-task',binding:f.binding,fetchImpl:(url,init)=>gateway.handle(new Request(url,init)),now:()=>NOW});
 assert.equal((await client.register({key:f.key})).registered,true);let nested={leaf:'opaque'};for(let i=0;i<90;i++)nested={nested};const marker={type:'system',future:nested},entries=[{type:'assistant',uuid:sessionId(10),future:nested},marker,marker];
 const append={key:f.key,appendId:sessionId(11),expectedOffset:0,entriesSha256:hash(entries),entries};assert.equal((await client.append(append)).offset,3);assert.equal((await client.append(append)).offset,3);assert.deepEqual((await client.load({key:f.key})).entries,entries);
 f.unknown(true);const raw={binding:f.binding,...append,appendId:sessionId(12),expectedOffset:3,entries:[marker],entriesSha256:hash([marker])},before=forwards;
 const response=await gateway.handle(request('/v1/runner/session/append',JSON.stringify(raw),'opaque-native-task'));assert.equal(response.status,503);assert.deepEqual(await response.json(),{error:{code:'SDK_SESSION_COMMIT_UNKNOWN',outcome:'UNKNOWN'}});assert.equal(forwards,before+1);
});
test('constructor and request refusals are inert; origins cannot be supplied or coerced by callers',async()=>{
 let calls=0,coercions=0;const transport=async()=>{calls++;return Response.json({});};
 for(const controlOrigin of ['http://remote.invalid','https://control.invalid/path','https://user:secret@control.invalid','https://control.invalid/?x=1',{toString(){coercions++;return 'https://control.invalid';}}])assert.throws(()=>make(transport,{controlOrigin}));assert.equal(coercions,0);
 const disabled=make(transport,{enabled:false});assert.equal((await disabled.handle(request('/v1/runner/load'))).status,503);
 const gateway=make(transport);for(const [r,status] of [[new Request('https://native.synthetic.invalid/v1/runner/load',{method:'GET'}),405],[request('/v1/runner/load?destination=https://attacker.invalid'),400],[request('/v1/runner/load','{}','invalid token'),401],[request('/v1/runner/load','{}','token',{headers:{'content-type':'text/plain'}}),415],[request('/v1/runner/load','{}','token',{headers:{'content-encoding':'gzip'}}),415],[request('/v1/runner/load','{}','token',{headers:{'content-length':'3'}}),400]]){const reply=await gateway.handle(r);assert.equal(reply.status,status);assert.equal((await reply.json()).error.outcome,'NOT_DISPATCHED');}
 assert.equal(calls,0);
});
test('body overflow and parked request cancellation release owned readers without waiting on cancel promises',async()=>{
 let calls=0,cancels=0;const abort=new AbortController(),body=new ReadableStream({start(c){c.enqueue(new TextEncoder().encode('{'));},cancel(){cancels++;return new Promise(()=>{});}}),gateway=make(async()=>{calls++;return Response.json({});},{limits:{...limits,maxRequestMs:100}});
 const work=gateway.handle(request('/v1/runner/load',body,'token',{signal:abort.signal,duplex:'half'}));setImmediate(()=>abort.abort());const result=await work;assert.equal(result.status,408);assert.equal((await result.json()).error.outcome,'NOT_DISPATCHED');assert.equal(cancels,1);assert.equal(body.locked,false);assert.equal(calls,0);
 const tiny=make(async()=>{calls++;return Response.json({});},{limits:{...limits,maxRequestBytes:1}});assert.equal((await tiny.handle(request('/v1/runner/load','{}'))).status,413);assert.equal(calls,0);
});
test('parked response cancellation and late replies clean up, preserve UNKNOWN and never retry',async()=>{
 let forwards=0,cancels=0,resolveLate;const body=new ReadableStream({start(c){c.enqueue(new TextEncoder().encode('{'));},cancel(){cancels++;return new Promise(()=>{});}}),gateway=make(async()=>{forwards++;return new Response(body,{headers:{'content-type':'application/json'}});},{limits:{...limits,maxRequestMs:30}});
 const result=await gateway.handle(request('/v1/runner/publish'));assert.equal(result.status,408);assert.equal((await result.json()).error.outcome,'UNKNOWN');assert.equal(forwards,1);assert.equal(cancels,1);assert.equal(body.locked,false);
 const late=make(()=>{forwards++;return new Promise(resolve=>{resolveLate=resolve;});},{limits:{...limits,maxRequestMs:30}});const refused=await late.handle(request('/v1/runner/publish'));assert.equal((await refused.json()).error.outcome,'UNKNOWN');
 resolveLate(new Response(new ReadableStream({cancel(){cancels++;}}),{headers:{'content-type':'application/json'}}));await new Promise(resolve=>setImmediate(resolve));assert.equal(cancels,2);assert.equal(forwards,2);
});
test('redirect, response media/length and size failures release no result after a single dispatch',async()=>{
 for(const create of [()=>new Response('moved',{status:302,headers:{location:'https://attacker.invalid'}}),()=>new Response('{}',{headers:{'content-type':'text/plain'}}),()=>new Response('{}',{headers:{'content-type':'application/json','content-length':'3'}}),()=>new Response('{}',{headers:{'content-type':'application/json'}})]){
  let calls=0;const gateway=make(async()=>{calls++;return create();},{limits:{...limits,maxResponseBytes:1}}),r=await gateway.handle(request('/v1/runner/publish'));assert.ok(r.status>=400);assert.equal((await r.json()).error.outcome,'UNKNOWN');assert.equal(calls,1);
 }
});
