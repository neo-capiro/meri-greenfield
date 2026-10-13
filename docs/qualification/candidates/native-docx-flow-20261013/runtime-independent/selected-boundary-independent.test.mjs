import test from 'node:test';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {join} from 'node:path';
const root=process.env.MERI_REVIEW_SOURCE_ROOT;if(!root)throw Error('exact review source required');
const load=path=>import(pathToFileURL(join(root,path)).href);
const {createSelectedReadLedger}=await load('apps/runtime/selected/ledger.mjs');
const {createSelectedControl}=await load('apps/runtime/selected/control.mjs');
const {createSelectedTaskApplication}=await load('apps/runtime/selected/http.mjs');
const {assertSelectedRequest}=await load('packages/contracts/runtime-0.2/selected.mjs');
const {runtimeFixture}=await load('apps/worker/conversation/skills/test/runtime-fixture.mjs');
const {canonicalSha256:hash}=await load('packages/contracts/validate.mjs');
test('selected ledger captures only inert native allocation method before initialization effects',()=>{
 let effects=0;const allocationOwner={get withCurrentAllocation(){effects++;return async()=>{};}};
 assert.throws(()=>createSelectedReadLedger({allocationOwner,readCompletion:async()=>{},now:Date.now}));assert.equal(effects,0);
});
test('selected execution option getters cannot execute during trusted control construction',()=>{
 let effects=0;const executionOptions={get admissionForBinding(){effects++;return()=>{};}};
 assert.throws(()=>createSelectedControl({executionOptions,loadCurrentTask:async()=>{},ledger:{},now:Date.now,sourceEnabled:false}));assert.equal(effects,0);
});
test('selected HTTP method getter cannot execute during constructor validation',()=>{
 let effects=0;const controller={get handle(){effects++;return async()=>Response.json({});}};
 assert.throws(()=>createSelectedTaskApplication({controller,now:Date.now,limits:{requestMs:10,requestBytes:1024}}));assert.equal(effects,0);
});
test('private selected wire rejects getters, prepared injections and worker compiler delivery IDs without effects',()=>{
 const f=runtimeFixture(),binding=f.context.binding;let effects=0;
 assert.throws(()=>assertSelectedRequest('prepare',{get binding(){effects++;return binding;},requestSha256:hash(f.request)}));assert.equal(effects,0);
 assert.throws(()=>assertSelectedRequest('prepare',{binding,requestSha256:hash(f.request),prepared:{}}));
 assert.throws(()=>assertSelectedRequest('read',{binding,sessionId:'11111111-1111-4111-8111-111111111111',requestSha256:hash(f.request),selectionSha256:hash(f.selection),operation:{id:'query_tasks',version:'0.2.0'},arguments:{},deliveryId:'compiler:'+'a'.repeat(64)}));
});
test('inactive selected HTTP route refuses before native authority/controller effects',async()=>{
 let effects=0;const app=createSelectedTaskApplication({controller:{async handle(){effects++;throw Error('must not call');}},now:Date.now,limits:{requestMs:20,requestBytes:1024}});
 const response=await app.handle(new Request('https://control.invalid/internal/conversations/selected/prepare',{method:'POST',headers:{authorization:'Bearer synthetic','content-type':'application/json'},body:'{}'}));assert.equal(response.status,503);assert.equal(effects,0);
});
