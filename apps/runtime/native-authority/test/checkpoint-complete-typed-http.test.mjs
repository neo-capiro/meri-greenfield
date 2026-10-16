import test from 'node:test';
import assert from 'node:assert/strict';
import {createNativeCheckpointApplication} from '../checkpoint-http.mjs';
import {capabilityDigest} from '../task-verifier.mjs';

const credential='synthetic-task-capability';
const complete={binding:{},request:{},versions:{},scopes:[],sessionId:'11111111-1111-4111-8111-111111111111',contextSha256:'a'.repeat(64)};
const post=(path,body)=>new Request('https://runner.synthetic.invalid'+path,{method:'POST',headers:{authorization:`Bearer ${credential}`,'content-type':'application/json'},body:JSON.stringify(body)});

test('only the authenticated completion route carries an optional typed result',async()=>{
 const calls=[],owner={async captureCheckpoint(value){calls.push(['capture',value]);return {ok:true};},async read(value){calls.push(['read',value]);return {ok:true};}},completion={async captureCompletion(value){calls.push(['complete',value]);return {ok:true};}};
 const app=createNativeCheckpointApplication({owner,completion,taskCapabilitySha256:capabilityDigest(credential),enabled:true});
 assert.equal((await app.handle(post('/v1/runner/checkpoint/complete',complete))).status,200);
 assert.equal(Object.hasOwn(calls[0][1],'typedResult'),false);
 const typedResult={kind:'objective.strategy.draft',resultRef:'opaque'};
 assert.equal((await app.handle(post('/v1/runner/checkpoint/complete',{...complete,typedResult}))).status,200);
 assert.deepEqual(calls[1][1].typedResult,typedResult);
 assert.equal((await app.handle(post('/v1/runner/checkpoint/capture',{...complete,controlId:'control'}))).status,200);
 assert.equal((await app.handle(post('/v1/runner/checkpoint/read',{binding:{},scopes:[],versions:{},checkpointId:'id',expectedSha256:'a'.repeat(64)}))).status,200);
 assert.equal((await app.handle(post('/v1/runner/checkpoint/capture',{...complete,controlId:'control',typedResult}))).status,503);
 assert.equal((await app.handle(post('/v1/runner/checkpoint/read',{binding:{},scopes:[],versions:{},checkpointId:'id',expectedSha256:'a'.repeat(64),typedResult}))).status,503);
 assert.deepEqual(calls.map(([route])=>route),['complete','complete','capture','read']);
});
