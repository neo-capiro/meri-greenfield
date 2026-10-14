import test from 'node:test';import assert from 'node:assert/strict';
import {createNativeContinuationRuntime} from '../continuation-runtime.mjs';
import {createNativeRuntimeProvider} from '../runtime-provider.mjs';
import {createNativeExecutionApplication} from '../execution-http.mjs';
import {continuationFixture,id,NOW} from '../../../worker/conversation/continuation/test/fixtures.mjs';
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
import {capabilityDigest} from '../task-verifier.mjs';
function fixture(mode='resume'){
 const f=continuationFixture(mode),{binding,versions,scopes,request,sourceRequest}=f.target;
 let saved={continuation:f.continuation,sourceRequest},run={binding,versions,scopes,state:'queued'},authority={scopes,selectedClientId:scopes[0].resourceId,policyRevision:scopes[0].policyRevision},onRestore=()=>{},restores=0,reads=0,registrations=0;
 const store={async read(){reads++;return {run,request};},lifecycle:{}};
 // The canonical journal interface receives only these three trusted fields.
 store.lifecycle.execution=async input=>{assert.deepEqual(input,{binding,scopes:authority.scopes,selectedClientId:authority.selectedClientId});return saved;};
 const verifier={async verify({binding:verified,operation,inputSha256}){return {binding:verified,operation,inputSha256,identityCredential:'synthetic-identity',...authority,authorizationDecisionId:'synthetic-decision',checkedAtMs:NOW,expiresAtMs:NOW+10000};}};
 const restoreReceipt={verificationId:id(70),binding,checkpointId:f.continuation.checkpoint.checkpointId,checkpointSha256:f.continuation.checkpointSha256,workspaceSha256:f.continuation.checkpoint.workspaceSha256,opaqueSessionSha256:f.continuation.checkpoint.opaqueSession.sha256,scopes,contextSha256:f.continuation.contextSha256,sourceRequestSha256:f.continuation.sourceRequestSha256,checkedAtMs:NOW,expiresAtMs:NOW+5000};
 const restored={restoreReceipt,sdkSessionKey:{projectKey:'synthetic-project',sessionId:mode==='resume'?f.continuation.checkpoint.sessionId:f.continuation.targetSessionId}};
 const restorer={async restore(input){restores++;assert.equal(input.restoreKey,hash({binding,versions,scopes,request,sourceRequest,continuation:f.continuation}));assert.deepEqual(input.continuation,f.continuation);onRestore();return restored;},registration:{async read(input){registrations++;return {binding:input.binding,key:input.key,independentTestWitness:true};}}};
 const config={store,verifier,taskCapability:'synthetic-task',restorer,now:()=>NOW};
 return {f,config,restored,input:{binding,versions,scopes,request,sourceRequest,continuation:f.continuation},authority,run,counts:()=>({restores,reads,registrations}),setSaved:v=>{saved=v;},onRestore:f=>{onRestore=f;}};
}
for(const mode of ['resume','fork'])test(`${mode}: persisted lifecycle join supplies exact native restore request and correlated key`,async()=>{
 const x=fixture(mode),native=createNativeContinuationRuntime(x.config),value=await native.prepare(x.input);
 assert.deepEqual(value,x.restored);assert.equal(x.counts().restores,1);assert.equal(x.counts().reads,2);
 const witness=await native.readRegistration({binding:x.input.binding,key:value.sdkSessionKey});assert.equal(witness.independentTestWitness,true);assert.equal(x.counts().registrations,1);
});
for(const field of ['continuation','sourceRequest','request','scopes'])test(`worker ${field} substitution refuses before native restore`,async()=>{
 const x=fixture(),input=structuredClone(x.input);input[field]=field==='scopes'?[]:{...input[field],foreign:true};
 await assert.rejects(createNativeContinuationRuntime(x.config).prepare(input));assert.equal(x.counts().restores,0);
});
test('omitted continuation and absent native restore both refuse a persisted target',async()=>{
 const x=fixture();await assert.rejects(createNativeContinuationRuntime(x.config).prepare({binding:x.input.binding,versions:x.input.versions}));
 const {restorer,...unsupported}=x.config;await assert.rejects(createNativeContinuationRuntime(unsupported).prepare(x.input));assert.equal(x.counts().restores,0);
 await assert.rejects(createNativeContinuationRuntime(unsupported).readRegistration({binding:x.input.binding,key:x.restored.sdkSessionKey}));
});
test('fresh persisted run returns null and cannot accept continuation hints or restoration witness',async()=>{
 const x=fixture();x.setSaved(null);const native=createNativeContinuationRuntime(x.config);
 assert.equal(await native.prepare({binding:x.input.binding,versions:x.input.versions}),null);assert.equal(await native.readRegistration({binding:x.input.binding,key:x.restored.sdkSessionKey}),null);
 await assert.rejects(native.prepare(x.input));assert.equal(x.counts().restores,0);assert.equal(x.counts().registrations,0);
});
for(const change of ['scope','client','cancel'])test(`canonical ${change} changes during restore refuse returned runtime`,async()=>{
 const x=fixture();x.onRestore(()=>{if(change==='scope')x.authority.scopes=[];if(change==='client')x.authority.selectedClientId=id(99);if(change==='cancel')x.run.state='cancelled';});
 await assert.rejects(createNativeContinuationRuntime(x.config).prepare(x.input));assert.equal(x.counts().restores,1);
});
for(const field of ['checkpointSha256','opaqueSessionSha256','expiresAtMs','sdkSessionKey'])test(`native ${field} mismatch refuses`,async()=>{
 const x=fixture();if(field==='sdkSessionKey')x.restored.sdkSessionKey.sessionId=id(99);else x.restored.restoreReceipt[field]=field==='expiresAtMs'?NOW+20000:'e'.repeat(64);
 await assert.rejects(createNativeContinuationRuntime(x.config).prepare(x.input));
});
test('foreign registration session is refused without native read; worker receipt fields are inert',async()=>{
 const x=fixture(),native=createNativeContinuationRuntime(x.config);
 await assert.rejects(native.readRegistration({binding:x.input.binding,key:{...x.restored.sdkSessionKey,sessionId:id(99)}}));
 let getters=0;await assert.rejects(native.prepare({...x.input,get restoreReceipt(){getters++;return x.restored.restoreReceipt;}}));assert.equal(getters,0);assert.equal(x.counts().registrations,0);assert.equal(x.counts().restores,0);
});
test('native registration observation cannot survive admission revocation during owner read',async()=>{
 const x=fixture();x.config.restorer.registration.read=async()=>{x.run.state='cancelled';return {binding:x.input.binding,key:x.restored.sdkSessionKey};};
 await assert.rejects(createNativeContinuationRuntime(x.config).readRegistration({binding:x.input.binding,key:x.restored.sdkSessionKey}));
});
test('missing native continuation observation refuses rather than selecting a fresh witness',async()=>{
 const x=fixture();x.config.restorer.registration.read=async()=>null;
 await assert.rejects(createNativeContinuationRuntime(x.config).readRegistration({binding:x.input.binding,key:x.restored.sdkSessionKey}));
});
test('native restore configuration accessors refuse without invocation',()=>{
 const x=fixture();let getters=0;x.config.restorer={restore:x.config.restorer.restore,get registration(){getters++;return {};}};
 assert.throws(()=>createNativeContinuationRuntime(x.config));assert.equal(getters,0);
});
test('actual runtime HTTP accepts canonical continuation hints only under task role and returns validated restore',async()=>{
 const x=fixture(),task='synthetic-task',control='synthetic-control',digest=capabilityDigest(task),broker={taskCapabilitySha256:digest,async current(){return {run:x.run,record:{expiresAtMs:NOW+10000}};},async start(){},async poll(){}},runtime={binding:x.input.binding,versions:x.input.versions,proxyUrl:'https://synthetic-proxy.invalid',proxyCredential:'synthetic-proxy',model:'synthetic-model',deadlineMs:NOW+10000,maxTurns:1,maxCostMicroUSD:1,maxOutputBytes:10};
 const admission={async currentAllocation(){return JSON.stringify({binding:x.input.binding,deadlineMs:NOW+10000,allocation:{budgets:{maxTurns:1,maxCostMicroUSD:1,maxOutputBytes:10}}});}};
 const provider=createNativeRuntimeProvider({broker,runtime,admission,taskCapabilitySha256:digest,continuation:createNativeContinuationRuntime(x.config),enabled:true});
 const app=createNativeExecutionApplication({broker,runtime:provider,controlCapabilitySha256:capabilityDigest(control),taskCapabilitySha256:digest,enabled:true,now:()=>NOW});
 const request=(credential,body=x.input)=>new Request('https://synthetic-native.invalid/v1/runner/runtime',{method:'POST',headers:{authorization:'Bearer '+credential,'content-type':'application/json'},body:JSON.stringify(body)});
 assert.equal((await app.handle(request(control))).status,403);assert.equal(x.counts().restores,0);
 const response=await app.handle(request(task));assert.equal(response.status,200);const body=await response.json();assert.deepEqual(body.restoreReceipt,x.restored.restoreReceipt);assert.deepEqual(body.sdkSessionKey,x.restored.sdkSessionKey);
 assert.equal((await app.handle(request(task,{...x.input,restoreReceipt:x.restored.restoreReceipt}))).status,503);assert.equal(x.counts().restores,1);
});
for(const failure of ['native-error','canonical-drift'])test(`runtime ${failure} still rechecks broker for revocation containment`,async()=>{
 const x=fixture(),digest=capabilityDigest('synthetic-task');let nativeReads=0,containmentRequested=false;
 const broker={taskCapabilitySha256:digest,async current(){nativeReads++;if(nativeReads===2){containmentRequested=true;throw Error('synthetic-revoked-native-owner');}return {run:x.run,record:{expiresAtMs:NOW+10000}};}};
 if(failure==='native-error')x.config.restorer.restore=async()=>{throw Error('synthetic-restore-unknown');};else x.onRestore(()=>{x.run.state='cancelled';});
 const runtime={binding:x.input.binding,versions:x.input.versions,proxyUrl:'https://synthetic-proxy.invalid',proxyCredential:'synthetic-proxy',model:'synthetic-model',deadlineMs:NOW+10000,maxTurns:1,maxCostMicroUSD:1,maxOutputBytes:10},admission={async currentAllocation(){return JSON.stringify({binding:x.input.binding,deadlineMs:NOW+10000,allocation:{budgets:{maxTurns:1,maxCostMicroUSD:1,maxOutputBytes:10}}});}};
 const provider=createNativeRuntimeProvider({broker,runtime,admission,taskCapabilitySha256:digest,continuation:createNativeContinuationRuntime(x.config),enabled:true});
 await assert.rejects(provider.runtime(x.input));assert.equal(nativeReads,2);assert.equal(containmentRequested,true,'calls actual broker current port, whose revocation path owns physical containment; no restored success');
});

test('bounded native HTTP transports valid repeated continuation requests above fresh-only size limit',async()=>{const x=fixture();for(const r of [x.input.request,x.input.sourceRequest])r.prompt='x'.repeat(80000);x.input.continuation.sourceRequestSha256=hash(x.input.sourceRequest);x.restored.restoreReceipt.sourceRequestSha256=x.input.continuation.sourceRequestSha256;const task='synthetic-task',digest=capabilityDigest(task),broker={taskCapabilitySha256:digest,async current(){return {run:x.run,record:{expiresAtMs:NOW+10000}};},async start(){},async poll(){}},runtime={binding:x.input.binding,versions:x.input.versions,proxyUrl:'https://synthetic-proxy.invalid',proxyCredential:'synthetic-proxy',model:'synthetic-model',deadlineMs:NOW+10000,maxTurns:1,maxCostMicroUSD:1,maxOutputBytes:10},admission={async currentAllocation(){return JSON.stringify({binding:x.input.binding,deadlineMs:NOW+10000,allocation:{budgets:{maxTurns:1,maxCostMicroUSD:1,maxOutputBytes:10}}});}};const provider=createNativeRuntimeProvider({broker,runtime,admission,taskCapabilitySha256:digest,continuation:createNativeContinuationRuntime(x.config),enabled:true}),app=createNativeExecutionApplication({broker,runtime:provider,controlCapabilitySha256:capabilityDigest('synthetic-control'),taskCapabilitySha256:digest,enabled:true,now:()=>NOW});const body=JSON.stringify(x.input);assert.ok(Buffer.byteLength(body)>131072&&Buffer.byteLength(body)<2097152);const response=await app.handle(new Request('https://synthetic-native.invalid/v1/runner/runtime',{method:'POST',headers:{authorization:'Bearer '+task,'content-type':'application/json'},body}));assert.equal(response.status,200);assert.equal(x.counts().restores,1);});
