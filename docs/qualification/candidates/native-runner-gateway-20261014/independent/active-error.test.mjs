import test from 'node:test';
import assert from 'node:assert/strict';
import {createNativeRunnerGateway} from '../../../../../apps/runtime/native-runner-gateway.mjs';

for(const behavior of ['returns','throws'])test(`transport Proxy rejection is normalized without executing ${behavior} prototype trap`,async()=>{
 let traps=0,calls=0;
 const rejected=new Proxy({}, {getPrototypeOf(){traps++;if(behavior==='throws')throw Error('synthetic active prototype');return null;}});
 const gateway=createNativeRunnerGateway({controlOrigin:'https://control.synthetic.invalid',enabled:true,limits:{maxRequestMs:100,maxRequestBytes:1024,maxResponseBytes:1024},fetchImpl:async()=>{calls++;throw rejected;}});
 const request=new Request('https://native.synthetic.invalid/v1/runner/publish',{method:'POST',headers:{authorization:'Bearer actual-presented-task','content-type':'application/json'},body:'{}'});
 const reply=await gateway.handle(request);
 assert.equal(reply.status,503);assert.deepEqual(await reply.json(),{error:{code:'NATIVE_GATEWAY_UNAVAILABLE',outcome:'UNKNOWN'}});assert.equal(calls,1);assert.equal(traps,0);
});
