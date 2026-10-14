import test from 'node:test';
import assert from 'node:assert/strict';
import {createNativeRunnerGateway} from '../../../../../apps/runtime/native-runner-gateway.mjs';

test('reply acquired at post-dispatch deadline is cancelled even when lifetime refuses before outer assignment',async()=>{
 let clock=1000,cancels=0,calls=0;
 const body=new ReadableStream({cancel(){cancels++;}});
 const gateway=createNativeRunnerGateway({controlOrigin:'https://control.synthetic.invalid',enabled:true,now:()=>clock,limits:{maxRequestMs:100,maxRequestBytes:1024,maxResponseBytes:1024},fetchImpl:async()=>{calls++;clock=1100;return new Response(body,{headers:{'content-type':'application/json'}});}});
 const reply=await gateway.handle(new Request('https://native.synthetic.invalid/v1/runner/publish',{method:'POST',body:'{}',headers:{authorization:'Bearer actual-presented-task','content-type':'application/json'}}));
 assert.equal(reply.status,408);assert.equal((await reply.json()).error.outcome,'UNKNOWN');assert.equal(calls,1);assert.equal(cancels,1,'owned reply body must be released when post-await deadline rejects');assert.equal(body.locked,false);
});
