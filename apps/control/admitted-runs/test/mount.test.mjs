import test from 'node:test';
import assert from 'node:assert/strict';
import {admittedFixture} from './fixture.mjs';
import {listenActionApplication} from '../../action-application/node-http.mjs';
import {receiveActionResponse} from '../../../../packages/contracts/dist/action-application.mjs';
test('actual HTTP issuance uses persisted current state; reconstructed mount and source-off query',async()=>{const t=await admittedFixture();let host=t.make(),server;try{
 server=await listenActionApplication({app:host.app,host:'127.0.0.1',port:0,lifetimeMs:10000});
 const issue=async(hints={})=>{const r=await fetch(`${server.origin}/api/action-followthrough/session`,{method:'POST',headers:{authorization:`Bearer ${t.s.credential}`,'content-type':'application/json'},body:JSON.stringify(hints)});return {status:r.status,value:await r.json()};};
 const issued=await issue();assert.equal(issued.status,200);assert.notEqual(issued.value.credential,t.s.credential);assert.equal((await issue({runId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'})).status,401);
 const r=await fetch(`${server.origin}/api/action-followthrough/query`,{method:'POST',headers:{authorization:`Bearer ${issued.value.credential}`,'content-type':'application/json'},body:JSON.stringify({request:{limit:20}})});const v=await receiveActionResponse('query',r.status,await r.text());assert.notEqual(r.status,200);assert.deepEqual(v.error,{code:'UNAVAILABLE',outcome:'UNKNOWN'});assert.equal(t.s.state.sourceReads,0);assert.equal(t.s.state.taskEffects,0);
 await server.close();host.close();host=t.make();server=await listenActionApplication({app:host.app,host:'127.0.0.1',port:0,lifetimeMs:10000});assert.equal((await issue()).status,200);t.h.state().grants.get(t.s.commandFacts.grantId).state='REVOKED';assert.notEqual((await issue()).status,200);assert.equal(host.status().sourceEnabled,false);
 }finally{await server?.close();host.close();t.close();if(server)assert.deepEqual(server.status(),{closed:true,listening:false,activeSockets:0});}});
test('closed/default-disabled mount has no authority or persistence IO; override keys rejected',async()=>{const t=await admittedFixture();t.h.commands.length=0;const host=t.make({enabled:false});const r=await host.app.handle(new Request('http://local/api/action-followthrough/session',{method:'POST'}));assert.equal(r.status,503);assert.equal(t.h.commands.length,0);for(const k of ['services','sourceEnabled','currentRun','gateway','authority'])assert.throws(()=>t.make({[k]:true}));host.close();assert.equal(host.status().closed,true);});
