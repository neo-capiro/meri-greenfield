import test from 'node:test';import assert from 'node:assert/strict';
import {createNativeSessionContinuation} from '../sdk-continuation-owner.mjs';
import {createNativeSessionContinuationApplication} from '../sdk-continuation-http.mjs';
import {createNativeSdkSessionApplication} from '../sdk-session-http.mjs';
import {listenRuntime} from '../http-server.mjs';
import {createExecutionBinding} from '../../control/conversations/execution-boundary.mjs';
import {binding as source,versions,scopes,id} from '../../control/conversations/test/store-fixture.mjs';
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {buildContinuationOptions} from '../../worker/conversation/continuation/options.mjs';
import {automaticContextFixture} from '../../worker/conversation/test/automatic-context-fixture.mjs';
const NOW=Date.parse('2026-10-24T00:00:00Z');
function fixture(mode='nextTurn',{general=false}={}){
 const activeScopes=general?[{tenantId:source.tenantId,kind:'private-user',resourceId:source.actorId,policyRevision:'policy1'}]:scopes;
 const selectedClientId=general?null:scopes[0].resourceId;
 const binding=mode==='fresh'?source:{...source,...(mode==='fork'?{conversationId:id(20),writerFence:1}:{writerFence:2}),runId:id(21),attemptId:id(22),workerId:id(23)};
 const sourceRequest={requestId:id(30),prompt:'Synthetic first prompt',window:null,windowRequest:null,skill:null},request={...sourceRequest,requestId:id(31),...(mode==='nextTurn'?{prompt:'Synthetic follow-up'}:{})};
 const sdkSession={binding:source,key:{projectKey:'synthetic-project',sessionId:id(32)},ownerSha256:'c'.repeat(64),entriesCount:3};
 const contextSha256=hash({window:null,skill:null,scopes:activeScopes}),sourceRequestSha256=hash(sourceRequest);
 let saved=mode==='fresh'?null:mode==='nextTurn'?{nextTurn:{sdkSession,sourceRequest,sourceRequestSha256,contextSha256,targetBinding:binding,versions,scopes:activeScopes}}:
  {continuation:{kind:'native-session',mode,controlId:id(33),sdkSession,versions,scopes:activeScopes,sourceRequestSha256,contextSha256,targetSessionId:mode==='fork'?id(34):null},sourceRequest};
 const {versions:ignored,...execution}=createExecutionBinding({binding,versions,plan:{synthetic:true},expiresAtMs:NOW+8*60*60*1000,runtimeSessionId:'synthetic-runtime-session-11111111111111'});
 const admission={execution,versions,state:'starting',scopes:activeScopes,selectedClientId:selectedClientId,policyRevision:'policy1'},run={binding,versions,scopes:activeScopes,policyRevision:'policy1',state:'starting'};
 let reads=0,auths=0,snapshots=0,clock=NOW,onSnapshot=()=>{},onAuth=()=>{};
 const selection={binding,scopes:activeScopes,selectedClientId:selectedClientId},transcripts=[{entries:[{type:'system',future:{opaque:[null,'exact',7]}},{type:'user',uuid:id(35),message:{role:'user',content:'synthetic'}}]},{subpath:'subagents/synthetic',entries:[{type:'assistant',future:{opaque:true}}]}];
 const snapshot=async input=>{assert.deepEqual(input,selection);snapshots++;onSnapshot();return structuredClone({binding,key:sdkSession.key,sdkSession,transcripts});};
 const store={read:async(b,cursor,check)=>{reads++;assert.deepEqual(b,binding);check();return structuredClone({run,request});},
  nextRuns:{execution:async input=>{assert.deepEqual(input,selection);return saved?.nextTurn?structuredClone(saved):null;},sessionSnapshot:snapshot},
  lifecycle:{execution:async input=>{assert.deepEqual(input,selection);return saved?.continuation?structuredClone(saved):null;},sessionSnapshot:snapshot}};
 const config={store,execution:{authenticate:async({credential,binding:b})=>{auths++;assert.deepEqual(b,binding);if(credential!=='synthetic-execution')throw Error('synthetic-denied');onAuth(auths);return structuredClone(admission);}},versions,maxOutputBytes:262144,now:()=>clock};
 const input={credential:'synthetic-execution',request:{binding,versions,...(saved?{...saved,...(saved.nextTurn?{sourceRequest}:{}),request,scopes:activeScopes}:{})}};
 return {config,input,sourceRequest,request,admission,run,execution,binding,sdkSession,transcripts,counts:()=>({reads,auths,snapshots}),setSaved:v=>saved=v,saved:()=>saved,onSnapshot:f=>onSnapshot=f,onAuth:f=>onAuth=f,setClock:v=>clock=v};
}
for(const mode of ['fresh','nextTurn','resume','fork'])test(`${mode}: actual native preparation preserves original execution lifetime and configured output limit`,async()=>{
 const f=fixture(mode),owner=createNativeSessionContinuation(f.config),result=await owner.prepareRuntime({...f.input,deadlineMs:NOW+50});
 assert.equal(result.deadlineMs,f.execution.expiresAtMs);assert.equal(result.maxOutputBytes,262144);assert.deepEqual(result.binding,f.binding);
 assert.deepEqual(result.sdkSessionKey,mode==='fresh'?null:{...f.sdkSession.key,...(mode==='fork'?{sessionId:id(34)}:{})});assert.equal(f.counts().reads,1);
 if(mode!=='fresh'){const restored=await owner.readSnapshot({credential:f.input.credential,request:{binding:f.binding}});assert.deepEqual(restored.transcripts,f.transcripts);assert.deepEqual(restored.sdkSession,f.sdkSession);}
 else await assert.rejects(owner.readSnapshot({credential:f.input.credential,request:{binding:f.binding}}));
});
for(const changed of ['nextTurn','sourceRequest','request','scopes'])test(`submitted ${changed} cannot replace canonical lineage`,async()=>{
 const f=fixture(),input=structuredClone(f.input);input.request[changed]=changed==='scopes'?[]:{...input.request[changed],foreign:true};
 await assert.rejects(createNativeSessionContinuation(f.config).prepareRuntime(input));assert.equal(f.counts().snapshots,0);
});
test('fresh input cannot select a session or supply a fabricated checkpoint',async()=>{
 const f=fixture('fresh'),owner=createNativeSessionContinuation(f.config);
 for(const extra of [{sdkSessionKey:f.sdkSession.key},{checkpoint:{}},{continuation:{}},{nextTurn:{}}])await assert.rejects(owner.prepareRuntime({...f.input,request:{...f.input.request,...extra}}));
 assert.equal(f.counts().snapshots,0);
});
test('missing native source is not replaced with legacy workspace proof',async()=>{
 const f=fixture('resume');delete f.saved().continuation.sdkSession;f.saved().continuation.checkpoint={};
 await assert.rejects(createNativeSessionContinuation(f.config).prepareRuntime(f.input));assert.equal(f.counts().snapshots,0);
});
for(const change of ['cancelled','execution','scope','policy','client'])test(`changed ${change} during snapshot refuses release`,async()=>{
 const f=fixture();f.onSnapshot(()=>{if(change==='cancelled')f.admission.state='cancelled';if(change==='execution')f.admission.execution={...f.execution,runtimeSessionId:'another-runtime-session-111111111111111'};if(change==='scope')f.admission.scopes=[];if(change==='policy')f.admission.policyRevision='changed';if(change==='client')f.admission.selectedClientId=id(98);});
 await assert.rejects(createNativeSessionContinuation(f.config).readSnapshot({credential:f.input.credential,request:{binding:f.binding}}));assert.equal(f.counts().snapshots,1);
});
test('stopping/settled refusal from execution owner precedes transcript access',async()=>{
 for(const phase of ['stopping','settled']){const f=fixture();f.config.execution.authenticate=async()=>{throw Error('synthetic-'+phase);};await assert.rejects(createNativeSessionContinuation(f.config).readSnapshot({credential:f.input.credential,request:{binding:f.binding}}));assert.equal(f.counts().reads,0);assert.equal(f.counts().snapshots,0);}
});
test('expired execution and caller cancellation cannot read storage',async()=>{
 const f=fixture();f.admission.execution.expiresAtMs=NOW;await assert.rejects(createNativeSessionContinuation(f.config).prepareRuntime(f.input));assert.equal(f.counts().reads,0);
 const g=fixture(),abort=new AbortController();abort.abort();await assert.rejects(createNativeSessionContinuation(g.config).prepareRuntime({...g.input,signal:abort.signal}));assert.equal(g.counts().reads,0);
});
for(const mutation of ['count','key','reference','duplicate-stream'])test(`snapshot ${mutation} corruption refuses`,async()=>{
 const f=fixture();const original=f.config.store.nextRuns.sessionSnapshot;f.config.store.nextRuns.sessionSnapshot=async(...args)=>{const result=await original(...args);if(mutation==='count')result.transcripts[0].entries.pop();if(mutation==='key')result.key.sessionId=id(90);if(mutation==='reference')result.sdkSession.ownerSha256='f'.repeat(64);if(mutation==='duplicate-stream')result.transcripts.push(result.transcripts[0]);return result;};
 await assert.rejects(createNativeSessionContinuation(f.config).readSnapshot({credential:f.input.credential,request:{binding:f.binding}}));
});
test('native fork options preserve source and let the SDK create the target session',()=>{
 const f=fixture('fork'),c=f.saved().continuation,target={binding:f.binding,versions,scopes,request:f.request,sourceRequest:f.sourceRequest};
 assert.deepEqual(buildContinuationOptions(c,target),{resume:f.sdkSession.key.sessionId,forkSession:true,sessionId:id(34)});
 for(const binding of [{...f.binding,tenantId:'foreign'},{...f.binding,actorId:'foreign'},{...f.binding,conversationId:source.conversationId}])assert.throws(()=>buildContinuationOptions(c,{...target,binding}));
});
test('real HTTP runtime and snapshot routes use the same execution credential and close cleanly',async()=>{
 const f=fixture(),owner=createNativeSessionContinuation(f.config),runtime=createNativeSessionContinuationApplication({owner,now:f.config.now}),unused=()=>{throw Error('not a registration request');},sessions=createNativeSdkSessionApplication({owner:{register:unused,load:unused,append:unused,listSubkeys:unused},snapshot:owner,now:f.config.now});
 const application={handle:request=>new URL(request.url).pathname==='/v1/runner/runtime'?runtime.handle(request):sessions.handle(request)},server=await listenRuntime({configuration:{http:{hostname:'127.0.0.1',port:0},limits:{requestMs:3000,shutdownMs:1000}},application,readiness:async()=>{},exposeReadiness:false});
 try{const origin='http://127.0.0.1:'+server.address.port,post=(route,body,credential='synthetic-execution')=>fetch(origin+route,{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+credential},body:JSON.stringify(body)});
  const prepared=await post('/v1/runner/runtime',f.input.request);assert.equal(prepared.status,200);assert.equal((await prepared.json()).deadlineMs,f.execution.expiresAtMs);
  const snapshot=await post('/v1/runner/session/snapshot',{binding:f.binding});assert.equal(snapshot.status,200);assert.deepEqual((await snapshot.json()).transcripts,f.transcripts);
  const foreign=await post('/v1/runner/runtime',f.input.request,'foreign');assert.equal(foreign.status,503);assert.deepEqual(await foreign.json(),{error:{code:'CONTINUATION_UNAVAILABLE'}});
  const hinted=await post('/v1/runner/session/snapshot',{binding:f.binding,key:f.sdkSession.key});assert.equal(hinted.status,503);await hinted.arrayBuffer();
 }finally{const closed=await server.close();assert.equal(closed.listenerStopped,true);assert.equal(closed.pendingRequests,0);}
});

test('explicit General admission uses only the actor private scope for native restore',async()=>{
 const f=fixture('resume',{general:true}),owner=createNativeSessionContinuation(f.config);
 assert.equal((await owner.prepareRuntime(f.input)).sdkSessionKey.sessionId,f.sdkSession.key.sessionId);
 assert.deepEqual((await owner.readSnapshot({credential:f.input.credential,request:{binding:f.binding}})).transcripts,f.transcripts);
});
for(const changed of ['foreign-actor','client','mixed','tenant','missing-null'])test(`General ${changed} scope cannot read retained native state`,async()=>{
 const f=fixture('resume',{general:true});
 if(changed==='foreign-actor')f.admission.scopes=[{...f.admission.scopes[0],resourceId:'foreign'}];
 if(changed==='client')f.admission.scopes=scopes;
 if(changed==='mixed')f.admission.scopes=[...f.admission.scopes,...scopes];
 if(changed==='tenant')f.admission.scopes=[{...f.admission.scopes[0],tenantId:'foreign'}];
 if(changed==='missing-null')delete f.admission.selectedClientId;
 await assert.rejects(createNativeSessionContinuation(f.config).prepareRuntime(f.input));assert.equal(f.counts().reads,0);
});

test('fresh runtime obtains Objective selection from its existing owner only after execution authentication',async()=>{
 const f=fixture('fresh'),selected={synthetic:'trusted-owner-result'};let reads=0;
 f.config.objectiveSelection={async read({binding}){reads++;assert.deepEqual(binding,f.binding);assert.equal(f.counts().auths,1);return selected;}};
 assert.deepEqual((await createNativeSessionContinuation(f.config).prepareRuntime(f.input)).objective,selected);assert.equal(reads,1);assert.equal(f.counts().auths,2);
 await assert.rejects(createNativeSessionContinuation(f.config).prepareRuntime({...f.input,credential:'foreign'}));assert.equal(reads,1);
});
test('ordinary runtime explicitly carries null Objective and refuses caller-supplied selection',async()=>{
 const f=fixture('fresh');let reads=0;f.config.objectiveSelection={async read(){reads++;return null;}};
 assert.equal((await createNativeSessionContinuation(f.config).prepareRuntime(f.input)).objective,null);
 await assert.rejects(createNativeSessionContinuation(f.config).prepareRuntime({...f.input,request:{...f.input.request,objective:{}}}));assert.equal(reads,1);
});
test('Objective selection cannot be grafted onto a native continuation or released after revocation',async()=>{
 const f=fixture('resume');f.config.objectiveSelection={async read(){return {synthetic:true};}};await assert.rejects(createNativeSessionContinuation(f.config).prepareRuntime(f.input));
 const g=fixture('fresh');g.config.objectiveSelection={async read(){g.admission.state='cancelled';return {synthetic:true};}};await assert.rejects(createNativeSessionContinuation(g.config).prepareRuntime(g.input));
});

for(const mode of ['fresh','nextTurn','resume','fork'])test(`${mode}: automatic selected-client context is collected afresh before release`,async()=>{
 const f=fixture(mode);let reads=0;f.config.automaticContext={read:async args=>{reads++;assert.deepEqual(args.binding,f.binding);assert.equal(args.selectedClientId,scopes[0].resourceId);assert.ok(args.deadlineMs<=NOW+3000);return automaticContextFixture(f.binding,args.selectedClientId,NOW);}};
 const owner=createNativeSessionContinuation(f.config);for(let n=0;n<2;n++){const result=await owner.prepareRuntime(f.input);assert.equal(result.automaticClientContext.subject.clientId,scopes[0].resourceId);if(mode!=='fresh'){const restored=await owner.readSnapshot({credential:f.input.credential,request:{binding:f.binding}});assert.deepEqual(restored.transcripts,f.transcripts);assert.equal(JSON.stringify(restored.transcripts).includes('SYNTHETICUEI'),false);}}assert.equal(reads,2);
});
test('General preparation never calls the selected-client reader',async()=>{const f=fixture('fresh',{general:true});f.config.automaticContext={read:async()=>assert.fail('General inherited a client')};assert.equal((await createNativeSessionContinuation(f.config).prepareRuntime(f.input)).automaticClientContext,null);});
test('changed execution after automatic context prevents release',async()=>{const f=fixture('fresh');f.config.automaticContext={read:async()=>{f.admission.state='cancelled';return automaticContextFixture(f.binding,scopes[0].resourceId,NOW);}};await assert.rejects(createNativeSessionContinuation(f.config).prepareRuntime(f.input));});
test('unavailable automatic context never silently falls back to stale client data',async()=>{const f=fixture('fresh');f.config.automaticContext={read:async()=>{throw Error('source unavailable');}};await assert.rejects(createNativeSessionContinuation(f.config).prepareRuntime(f.input));});
