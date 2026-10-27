import test from 'node:test';
import assert from 'node:assert/strict';
import {intentsComposition} from '../intents.mjs';
test('configured Core intents construct all governed approval clients without external IO',()=>{
 let touches=0;const no=()=>{touches++;throw Error('Unexpected external owner use');};
 const context={configuration:{version:1,profile:'isolated-preview',sourceEnabled:false,limits:{startupMs:1000,shutdownMs:1000,requestMs:5000,requestBytes:65536},native:{origin:'https://native.invalid',capabilityFile:'/run/native',loopback:false,maxResponseBytes:262144},intents:{enabled:true,core:{origin:'https://core.invalid',serviceSecretFile:'/run/intents-shared-service'}}},pool:{connect:no},client:{},native:{call:no},now:()=>1793070000000,canonicalProductPorts:{conversationMembership:{admit:no,recheck:no}}};
 const composed=intentsComposition(context,{transport:{fetchImpl:no,readSecret:no}});
 assert.equal(composed.state,'composed');assert.ok(composed.application);assert.equal(touches,0);
});
