import test from 'node:test';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {join} from 'node:path';
const root=process.env.MERI_REVIEW_SOURCE_ROOT;
if(!root)throw Error('exact review source root required');
const load=path=>import(pathToFileURL(join(root,path)).href);
const {createNativeCapabilityClient}=await load('apps/runtime/native-client.mjs');
const {createBrokerActivity}=await load('apps/runtime/temporal-worker.mjs');
const {assembleConversationRunner}=await load('apps/runtime/conversation-runner.mjs');
const {listenRuntime}=await load('apps/runtime/http-server.mjs');
const {createWorkerRunApplication}=await load('apps/runtime/worker-http.mjs');
const {assertRunOwnerRequest,assertWorkerAuthorization}=await load('packages/contracts/runtime-0.2/validate.mjs');
const {validateConfiguration}=await load('apps/runtime/config.mjs');
const {applicationFixture,binding,versions,scopes,id}=await load('apps/control/conversations/test/application-fixture.mjs');
const {canonicalSha256}=await load('packages/contracts/validate.mjs');
const limits={startupMs:1000,shutdownMs:100,requestMs:100,requestBytes:1024};
const nativeConfig={origin:'https://native.example.invalid',capabilityFile:'/run/secrets/synthetic',loopback:false,maxResponseBytes:1024};
const runner={version:1,profile:'isolated-preview',sourceEnabled:false,native:nativeConfig,limits,binding,versions,workspace:'/workspace/'+binding.conversationId,proxyOrigin:'https://proxy.example.invalid'};
const httpConfig={http:{hostname:'127.0.0.1',port:0,frontendOrigin:'https://front.example.invalid'},limits};
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const observed=(operation,ms=180)=>Promise.race([Promise.resolve(operation).then(value=>({state:'resolved',value}),error=>({state:'rejected',code:error.code,message:error.message})),sleep(ms).then(()=>({state:'unsettled'}))]);
test('private run-owner DTO refuses hostile getters, extra capability fields and artifact publication before authority',()=>{
 let effects=0;const hostile={get binding(){effects++;return binding;}};
 assert.throws(()=>assertRunOwnerRequest('load',hostile));assert.equal(effects,0);
 assert.throws(()=>assertRunOwnerRequest('load',{binding,capability:'cannot mint'}));
 assert.throws(()=>assertRunOwnerRequest('publish',{binding,event:{eventId:id(8),createdAt:new Date().toISOString(),type:'artifact.available',data:{}}}));
});
test('worker receipt requires exact input hash, scope tenant, selected client, full fence and current decision',()=>{
 const at=Date.now(),input={binding},hash=canonicalSha256(input),base={binding,operation:'load',inputSha256:hash,identityCredential:'synthetic',scopes,selectedClientId:scopes[0].resourceId,policyRevision:scopes[0].policyRevision,authorizationDecisionId:'decision1',checkedAtMs:at,expiresAtMs:at+1000},context={binding,operation:'load',inputSha256:hash,started:at,now:()=>at};
 assert.doesNotThrow(()=>assertWorkerAuthorization(base,context));
 for(const patch of [{inputSha256:'c'.repeat(64)},{binding:{...binding,writerFence:2}},{scopes:[{...scopes[0],tenantId:'tenant-b'}]},{selectedClientId:id(99)},{authorizationDecisionId:''},{expiresAtMs:at},{checkedAtMs:at-1}])assert.throws(()=>assertWorkerAuthorization({...base,...patch},context));
});
test('worker authority rejects changed post-effect scope receipt and revokes temporary opaque session',async()=>{
 let n=0,effects=0,revokes=0;const at=Date.now();
 const sessions={async issue(){return{credential:'opaque'};},async authenticateSession(){return{};},async readCurrentState(){return{binding,scopes,selectedClientId:scopes[0].resourceId};},revoke(){revokes++;}};
 const native={async call(operation,input){assert.equal(operation,'worker/authorize');n++;return{binding,operation:input.operation,inputSha256:input.inputSha256,identityCredential:'synthetic',scopes:n===3?[{...scopes[0],policyRevision:'policy2'}]:scopes,selectedClientId:scopes[0].resourceId,policyRevision:n===3?'policy2':'policy1',authorizationDecisionId:'decision'+n,checkedAtMs:Date.now(),expiresAtMs:at+1000};}};
 const app=createWorkerRunApplication({service:{async loadForExecution(){effects++;return{private:'must not release'};}},sessions,native,configuration:{limits}});
 const response=await app.handle(new Request('https://control.invalid/internal/conversations/load',{method:'POST',headers:{authorization:'Bearer synthetic','content-type':'application/json'},body:JSON.stringify({binding})}));
 assert.equal(response.status,403);assert.equal(effects,1);assert.equal(revokes,1);assert.equal(n,3);assert.equal((await response.text()).includes('must not release'),false);
});
test('invalid private request performs no task-authority or opaque-session effects',async()=>{
 let effects=0;const touch=()=>{effects++;throw Error('unexpected');},app=createWorkerRunApplication({service:{},sessions:{issue:touch},native:{call:touch},configuration:{limits}});
 const response=await app.handle(new Request('https://control.invalid/internal/conversations/load',{method:'POST',headers:{authorization:'Bearer synthetic','content-type':'application/json'},body:JSON.stringify({binding,workspace:'/escape'})}));
 assert.equal(response.status,403);assert.equal(effects,0);
});
test('native client body read deadline stays bounded when transport cancellation never settles',async()=>{
 let cancels=0;const response=new Response(new ReadableStream({cancel(){cancels++;return new Promise(()=>{});}}),{headers:{'content-type':'application/json'}});
 const client=createNativeCapabilityClient({configuration:nativeConfig,credential:'synthetic',fetch:async()=>response});
 const result=await observed(client.call('readiness',{}, {deadlineMs:Date.now()+30}));
 assert.equal(cancels,1);assert.equal(result.state,'rejected',JSON.stringify(result));assert.equal(result.code,'DEADLINE');
});
test('broker cannot report completion after the immutable execution lease expires while polling',async()=>{
 const controller=new AbortController();let expiry;const native={async call(operation){if(operation==='execution/start'){expiry=Date.now()+20;return{binding,executionId:id(77),expiresAtMs:expiry};}await sleep(50);return{binding,executionId:id(77),state:'completed'};}};
 const run=createBrokerActivity({native,context:()=>({cancellationSignal:controller.signal,heartbeat(){}})});
 await assert.rejects(run({binding}),/BROKER_LEASE_EXPIRED/u);
});
test('isolated runner enforces its configured immutable versions before any scripted SDK query',async()=>{
 const f=await applicationFixture();await f.service.submit({credential:f.credential,input:f.input});let queries=0;
 const native={async call(operation,input){if(operation==='runner/load')return f.runOwner.load({binding:input.binding});if(operation==='runner/publish')return f.runOwner.append({binding:input.binding,event:input.event});if(operation==='runner/runtime')return{binding,versions,proxyUrl:runner.proxyOrigin,proxyCredential:'synthetic',model:'synthetic',deadlineMs:Date.now()+1000,maxTurns:1,maxCostMicroUSD:1,maxOutputBytes:128};throw Error('unexpected');}};
 const execute=assembleConversationRunner({configuration:validateConfiguration({...runner,versions:{...versions,skillsDigest:'c'.repeat(64)}},'conversation-runner'),native,query(){queries++;return{async *[Symbol.asyncIterator](){yield{type:'result',subtype:'success',is_error:false};},close(){}};}});
 try{const result=await observed(execute({binding}));assert.equal(result.state,'rejected',JSON.stringify(result));assert.equal(queries,0);}finally{f.close();}
});
test('pre-aborted HTTP initialization does not expose a live listening application',async()=>{
 const controller=new AbortController();controller.abort();let listener;
 try{const result=await observed(listenRuntime({configuration:httpConfig,signal:controller.signal,readiness:async()=>{},application:{handle:()=>Response.json({})}}));
 if(result.state==='resolved'){listener=result.value;const response=await fetch('http://127.0.0.1:'+listener.address.port+'/health/live');assert.notEqual(response.status,200,'pre-aborted initialization opened a live listener');}
 else assert.equal(result.state,'rejected');}finally{await listener?.close();}
});
test('actual HTTP disconnection aborts the native canonical application request',async()=>{
 let entered,aborted;const ready=new Promise(r=>entered=r),cancelled=new Promise(r=>aborted=r);
 const listener=await listenRuntime({configuration:httpConfig,readiness:async()=>{},application:{async handle(request){assert.equal(request instanceof Request,true);request.signal.addEventListener('abort',aborted,{once:true});entered();await cancelled;return Response.json({cancelled:true});}}});
 const controller=new AbortController(),pending=fetch('http://127.0.0.1:'+listener.address.port+'/probe',{signal:controller.signal}).catch(()=>{});
 try{await ready;controller.abort();assert.equal((await observed(cancelled)).state,'resolved');await pending;}finally{await listener.close();}
});
test('configuration is immutable and closed before dependency startup',()=>{
 const cfg=validateConfiguration(runner,'conversation-runner');assert.equal(Object.isFrozen(cfg.versions),true);assert.throws(()=>cfg.versions.sdk='x');assert.throws(()=>validateConfiguration({...runner,database:{connectionFile:'/run/db'}},'conversation-runner'));assert.throws(()=>validateConfiguration({...runner,native:{...nativeConfig,origin:'https://name:password@native.example.invalid'}},'conversation-runner'));
});
