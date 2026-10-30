/** Actual client/HTTP/Control and host operation lifetimes with a controlled
 * clock. Only native fragment preparation is scripted; no activation change. */
import test,{mock} from 'node:test';import assert from 'node:assert/strict';
import {createNativeCapabilityClient} from '../native-client.mjs';
import {createNativeBrowserPort} from '../browser-client.mjs';
import {createBrowserOperations} from '../browser-operations.mjs';
import {createWorkerRunApplication} from '../worker-http.mjs';
import {createExecutionBinding} from '../../control/conversations/execution-boundary.mjs';
import {binding,versions,scopes} from '../../control/conversations/test/store-fixture.mjs';
import {validateBrowserPolicy} from '../../worker/conversation/browser/policy.mjs';
let prepared;
mock.module('../../worker/conversation/browser/runtime.mjs',{namedExports:{prepareBrowserRun:async()=>prepared}});
const {createBrowserOperationHost}=await import('../../worker/conversation/host/browser-operation-host.mjs');
const policy=validateBrowserPolicy({enabled:true,tools:['browser_click']});
function fixture({approvalMs=180000,advanceMs=121000,expiresAtMs=601000,cancel}={}){
 let at=1000,approvals=0;const now=()=>at,calls=[];
 const {versions:ignored,...execution}=createExecutionBinding({binding,versions,plan:{synthetic:true},expiresAtMs,runtimeSessionId:'synthetic-'+('a'.repeat(64))});
 prepared={fragment:{policy,activation:'open',async canUseTool(_name,input){approvals++;at+=advanceMs;cancel?.abort();return {behavior:'allow',updatedInput:input};}}};
 const host=createBrowserOperationHost({binding,now,sessions:{readModelTools(){assert.fail('not a tools operation');},callModelTool(){assert.fail('not a tool call');}},
  readRun:async()=>({binding,cwd:'/workspace/'+binding.conversationId,deadlineMs:expiresAtMs,port:{modelTransport:'host-owned',policy:async()=>policy,approvalDeadlineMs:approvalMs}})});
 const hosts={async executeBrowserOperation(operation,request,context){calls.push({operation,deadlineMs:context.deadlineMs});return (await host.executeBrowserOperation(operation,request,context)).result;}};
 const browserOperations=createBrowserOperations({hosts,now,readCapabilityRole:async()=>({actorRole:'standard_user',checkedAtMs:at,expiresAtMs:at+30000}),readBrowserPolicy:async()=>policy});
 const app=createWorkerRunApplication({browserOperations,now,configuration:{limits:{requestMs:3000,requestBytes:1048576}},createService(){assert.fail('not an ordinary run operation');},
  execution:{async authenticate(){if(at>=expiresAtMs)throw Error('expired');return {execution,scopes,selectedClientId:scopes[0].resourceId,policyRevision:scopes[0].policyRevision};}}});
 const native=createNativeCapabilityClient({now,credential:'synthetic-execution',configuration:{origin:'https://control.synthetic.invalid',maxResponseBytes:1048576},fetch:async(url,init)=>app.handle(new Request(url.replace('/v1/runner/','/internal/conversations/'),init))});
 return {port:createNativeBrowserPort({native,binding,deadlineMs:expiresAtMs,now}),calls,approvals:()=>approvals};
}
const request=signal=>({tool:'browser_click',toolUseId:'click_1',input:{element:'Submit',ref:'r1'},...(signal?{signal}:{})});
test('a trusted 180 second host approval survives the old 120 second Control cutoff',async()=>{
 const f=fixture();assert.equal((await f.port.prepare()).approvalDeadlineMs,180000);
 assert.equal((await f.port.approve(request())).behavior,'allow');assert.equal(f.approvals(),1);
 assert.equal(f.calls.find(c=>c.operation==='browser-approve').deadlineMs,601000,'Control is still clamped by the original execution expiry');
});
test('Control ceiling does not widen the selected short host approval timeout',async()=>{
 const f=fixture({approvalMs:1000,advanceMs:1001});await f.port.prepare();await assert.rejects(f.port.approve(request()));assert.equal(f.approvals(),1);
});
test('canonical run expiry and cancellation still withhold a late approval without retry',async()=>{
 const expired=fixture({expiresAtMs:101000});await expired.port.prepare();await assert.rejects(expired.port.approve(request()));assert.equal(expired.approvals(),1);
 const cancel=new AbortController(),cancelled=fixture({cancel});await cancelled.port.prepare();await assert.rejects(cancelled.port.approve(request(cancel.signal)));assert.equal(cancelled.approvals(),1);
});
test('out-of-range trusted host selection cannot prepare an approval client',async()=>{
 for(const approvalMs of [999,900001]){const f=fixture({approvalMs});await assert.rejects(f.port.prepare());assert.equal(f.approvals(),0);}
});
