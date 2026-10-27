import test from 'node:test';import assert from 'node:assert/strict';
import {projectRunRow} from '../projection.mjs';
import {encodeRunCursor,decodeRunCursor} from '../cursor.mjs';
import {createRunIndexStore} from '../store.mjs';
import {hash} from '../../boundary.mjs';
import {row,principal,request,id} from './fixture.mjs';
test('retained states and missing/unavailable/zero recorded usage stay distinct without private request content',()=>{
 for(const state of ['queued','running','paused','completed','failed','cancelled'])for(const usage of ['recorded','absent','unavailable','zero']){
  const result=projectRunRow(row(1,{state,usage}),principal);assert.equal(result.summary.state,state);
  assert.equal(result.summary.usage.recording,usage==='absent'?'not-recorded':usage==='unavailable'?'unavailable':'recorded');
  assert.equal(result.summary.usage.sdkEstimateUsd,usage==='absent'||usage==='unavailable'?null:usage==='zero'?0:0.3);
  assert.equal(result.summary.usage.providerBilledUsd,null);assert.doesNotMatch(JSON.stringify(result.summary),/PRIVATE|workerId|attemptId|versions/);
 }
});
test('corrupted status/hash/run/scope and foreign ownership refuse instead of projecting another subject',()=>{
 for(const mutate of [r=>r.run_row.projection.state='running',r=>r.status_row.event_sha256='0'.repeat(64),r=>r.run_row.sdk_usage_sha256='0'.repeat(64),
  r=>{r.status_row.event.data.state='running';r.status_row.event_sha256=hash(r.status_row.event);},r=>r.run_row.run_id=id(999),r=>r.conversation_row.owner_actor_id='foreign']){
  const r=row(1);mutate(r);assert.throws(()=>projectRunRow(r,principal));
 }
 assert.throws(()=>projectRunRow(row(1),{...principal,clientIds:[]}));assert.throws(()=>projectRunRow(row(1),{...principal,tenantId:'foreign'}));
 assert.equal(projectRunRow(row(1,{general:true}),{...principal,clientIds:[]}).summary.clientIds.length,0);
});
test('opaque position is bound to exact actor, membership, scope, normalized filter and limit, without authority semantics',()=>{
 const position={createdAt:'2026-10-27T12:00:00.000Z',runId:id(2),conversationId:id(3)},cursor=encodeRunCursor(principal,request,position),next={...request,cursor};
 assert.deepEqual(decodeRunCursor(principal,next),position);
 for(const p of [{...principal,actorId:'foreign'},{...principal,membershipRevision:'changed'},{...principal,clientIds:[]}])assert.throws(()=>decodeRunCursor(p,next),/CURSOR_INVALID/);
 for(const q of [{...next,status:'active'},{...next,scope:{kind:'general'}},{...next,limit:3},{...next,cursor:cursor+'='}])assert.throws(()=>decodeRunCursor(principal,q),/CURSOR_INVALID/);
});
test('store reads directly from durable runs and only the selected page is projected; wrong client stops before SQL',async()=>{
 const calls=[],store=createRunIndexStore({tx:async(key,check,body)=>body({async query(sql,args){calls.push({sql,args});return {rows:[row(3),row(2),row(1)]};}})});
 const page=await store.list({principal,request},()=>{});assert.deepEqual(page.entries.map(e=>e.summary.runId),[id(203),id(202)]);assert.ok(page.nextCursor);
 assert.match(calls[0].sql,/FROM meri_conversations.runs r JOIN/);assert.equal(calls[0].args[9],3);
 await assert.rejects(store.list({principal,request:{...request,scope:{kind:'client',clientId:id(999)}}},()=>{}),/ACCESS_DENIED/);assert.equal(calls.length,1);
});
