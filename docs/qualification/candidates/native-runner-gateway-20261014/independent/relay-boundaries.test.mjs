import test from 'node:test';
import assert from 'node:assert/strict';
import {createNativeRunnerGateway} from '../../../../../apps/runtime/native-runner-gateway.mjs';

const limits={maxRequestMs:1000,maxRequestBytes:9437184,maxResponseBytes:35651584};
function request(path,body,headers={}){return new Request('https://native.synthetic.invalid'+path,{method:'POST',headers:{authorization:'Bearer actual-presented-task','content-type':'application/json',...headers},body});}

test('fixed hop carries only original task authority and preserves exact UNKNOWN reply bytes without metadata credentials',async()=>{
 const input='{ "duplicates":[1,1], "controlOrigin":"https://caller.invalid", "opaque":"☃" }\n';
 const refused=' { "error": {"outcome":"UNKNOWN", "code":"SDK_SESSION_COMMIT_UNKNOWN"} }\n';let calls=0;
 const gateway=createNativeRunnerGateway({controlOrigin:'https://approved-control.synthetic.invalid',limits,enabled:true,fetchImpl:async(url,options)=>{
  calls++;assert.equal(url,'https://approved-control.synthetic.invalid/v1/runner/session/append');
  assert.deepEqual(Object.keys(options.headers).sort(),['accept','authorization','content-type']);assert.equal(options.headers.authorization,'Bearer actual-presented-task');
  assert.deepEqual(Buffer.from(options.body),Buffer.from(input));assert.equal(options.credentials,'omit');assert.equal(options.redirect,'error');
  return new Response(refused,{status:503,headers:{'content-type':'application/json','set-cookie':'synthetic=never-forward','authorization':'Bearer never-forward'}});
 }});
 const reply=await gateway.handle(request('/v1/runner/session/append',input,{cookie:'synthetic-never-forward',origin:'https://caller.invalid','x-forwarded-host':'caller.invalid'}));
 assert.equal(reply.status,503);assert.deepEqual(Buffer.from(await reply.arrayBuffer()),Buffer.from(refused));assert.equal(reply.headers.get('set-cookie'),null);assert.equal(reply.headers.get('authorization'),null);assert.equal(calls,1);
});

test('opaque SDK payload bypasses ordinary request/response limits while ordinary route remains bounded before dispatch',async()=>{
 const input=JSON.stringify({type:'system',opaque:'雪'.repeat(50000)}),output=JSON.stringify({opaque:'x'.repeat(2200000)});let calls=0;
 const gateway=createNativeRunnerGateway({controlOrigin:'https://control.synthetic.invalid',limits,enabled:true,fetchImpl:async(_url,options)=>{calls++;assert.deepEqual(Buffer.from(options.body),Buffer.from(input));return new Response(output,{headers:{'content-type':'application/json'}});}});
 const session=await gateway.handle(request('/v1/runner/session/append',input));assert.equal(session.status,200);assert.equal(await session.text(),output);assert.equal(calls,1);
 const ordinary=await gateway.handle(request('/v1/runner/publish',input));assert.equal(ordinary.status,413);assert.equal((await ordinary.json()).error.outcome,'NOT_DISPATCHED');assert.equal(calls,1);
});
