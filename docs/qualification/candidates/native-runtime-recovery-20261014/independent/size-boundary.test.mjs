import test from 'node:test';import assert from 'node:assert/strict';
import {createNativeContinuationRuntime} from '../../../../../apps/runtime/native-authority/continuation-runtime.mjs';
import {createNativeRuntimeProvider} from '../../../../../apps/runtime/native-authority/runtime-provider.mjs';
import {createNativeExecutionApplication} from '../../../../../apps/runtime/native-authority/execution-http.mjs';
import {capabilityDigest} from '../../../../../apps/runtime/native-authority/task-verifier.mjs';
import {continuationFixture,NOW,id} from '../../../../../apps/worker/conversation/continuation/test/fixtures.mjs';
import {canonicalSha256 as hash} from '../../../../../packages/contracts/validate.mjs';
function continuation(mode='fork'){
 const f=continuationFixture(mode),target=f.target;let stored={continuation:f.continuation,sourceRequest:target.sourceRequest},restores=0,checks=0,onRestore=()=>{};
 const run={binding:target.binding,versions:target.versions,scopes:target.scopes,state:'queued'},store={async read(){return {run,request:target.request};},lifecycle:{async execution(){return stored;}}};
 const verifier={async verify(input){return {binding:input.binding,operation:input.operation,inputSha256:input.inputSha256,identityCredential:'independent-synthetic-identity',scopes:target.scopes,selectedClientId:target.scopes[0].resourceId,policyRevision:target.scopes[0].policyRevision,authorizationDecisionId:'independent',checkedAtMs:NOW,expiresAtMs:NOW+10000};}};
 const restored={restoreReceipt:{verificationId:id(88),binding:target.binding,checkpointId:f.continuation.checkpoint.checkpointId,checkpointSha256:f.continuation.checkpointSha256,workspaceSha256:f.continuation.checkpoint.workspaceSha256,opaqueSessionSha256:f.continuation.checkpoint.opaqueSession.sha256,scopes:target.scopes,contextSha256:f.continuation.contextSha256,sourceRequestSha256:f.continuation.sourceRequestSha256,checkedAtMs:NOW,expiresAtMs:NOW+5000},sdkSessionKey:{projectKey:'independent-target',sessionId:f.continuation.targetSessionId}};
 const restorer={async restore(){restores++;onRestore();return restored;},registration:{async read(){return null;}}};
 const digest=capabilityDigest('independent-task'),broker={taskCapabilitySha256:digest,async current(){checks++;return {run,record:{expiresAtMs:NOW+10000}};},async start(){},async poll(){}};
 const runtime={binding:target.binding,versions:target.versions,proxyUrl:'https://independent.invalid',proxyCredential:'independent-existing-proxy',model:'synthetic',deadlineMs:NOW+10000,maxTurns:1,maxCostMicroUSD:1,maxOutputBytes:10},admission={async currentAllocation(){return JSON.stringify({binding:target.binding,deadlineMs:NOW+10000,allocation:{budgets:{maxTurns:1,maxCostMicroUSD:1,maxOutputBytes:10}}});}};
 const provider=createNativeRuntimeProvider({broker,runtime,admission,taskCapabilitySha256:digest,continuation:createNativeContinuationRuntime({store,verifier,taskCapability:'independent-task',restorer,now:()=>NOW}),enabled:true});
 const app=createNativeExecutionApplication({broker,runtime:provider,taskCapabilitySha256:digest,controlCapabilitySha256:capabilityDigest('independent-control'),enabled:true,now:()=>NOW});
 const input={binding:target.binding,versions:target.versions,continuation:f.continuation,sourceRequest:target.sourceRequest,request:target.request,scopes:target.scopes};
 return {app,input,provider,restorer,restored,counts:()=>({restores,checks}),setStored:v=>{stored=v;},onRestore:f=>{onRestore=f;},run};
}
const http=(x,body=x.input,token='independent-task')=>x.app.handle(new Request('https://independent.invalid/v1/runner/runtime',{method:'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify(body)}));

test('coherent canonical continuation above 128KiB reaches restore through runtime route',async()=>{
 const x=continuation();x.input.sourceRequest.prompt='S'.repeat(80000);x.input.request.prompt='S'.repeat(80000);
 x.input.continuation.sourceRequestSha256=hash(x.input.sourceRequest);x.restored.restoreReceipt.sourceRequestSha256=x.input.continuation.sourceRequestSha256;
 const bytes=Buffer.byteLength(JSON.stringify(x.input));assert.ok(bytes>131072&&bytes<2097152);
 const response=await http(x);assert.equal(response.status,200);assert.equal(x.counts().restores,1);assert.equal((await response.json()).sdkSessionKey.sessionId,x.input.continuation.targetSessionId);
});
test('runtime body above 2MiB refuses before any broker read or restoration',async()=>{
 const x=continuation();x.input.request.prompt='X'.repeat(2097152);assert.ok(Buffer.byteLength(JSON.stringify(x.input))>2097152);
 assert.equal((await http(x)).status,503);assert.deepEqual(x.counts(),{restores:0,checks:0});
});
test('control poll still rejects above 128KiB before dispatch',async()=>{
 let polls=0;const digest=capabilityDigest('independent-task'),broker={async start(){},async poll(){polls++;return {};}};
 const app=createNativeExecutionApplication({broker,runtime:{taskCapabilitySha256:digest,async runtime(){}},taskCapabilitySha256:digest,controlCapabilitySha256:capabilityDigest('independent-control'),enabled:true,now:()=>NOW});
 const body=JSON.stringify({binding:continuation().input.binding,executionId:'E'.repeat(140000)});assert.ok(Buffer.byteLength(body)>131072&&Buffer.byteLength(body)<2097152);
 const response=await app.handle(new Request('https://independent.invalid/v1/execution/poll',{method:'POST',headers:{authorization:'Bearer independent-control','content-type':'application/json'},body}));assert.equal(response.status,503);assert.equal(polls,0);
});
