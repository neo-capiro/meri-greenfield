import test from 'node:test';
import assert from 'node:assert/strict';
import {createNativeCapabilityClient} from '../native-client.mjs';
import {createPreparedRunnerReleaseClient} from '../native-authority/prepared-kickoff-http.mjs';
import {createExecutionBinding} from '../../control/conversations/execution-boundary.mjs';
import {binding,versions} from '../../control/conversations/test/store-fixture.mjs';

const credential='synthetic-control-capability';
const taskArn='arn:aws:ecs:us-east-1:967807252336:task/meri/'+'a'.repeat(32);
const original=expiresAtMs=>createExecutionBinding({binding,versions,plan:{synthetic:'release-timeout'},expiresAtMs});

test('native client keeps its 3s default and refuses invalid factory timeout bounds',async()=>{
 let at=Date.now();const configuration={origin:'https://native.synthetic.invalid',maxResponseBytes:131072};
 const fetchImpl=async()=>{at+=3500;return Response.json({ok:true});};
 const client=createNativeCapabilityClient({configuration,credential,fetch:fetchImpl,now:()=>at});
 await assert.rejects(client.call('readiness',{}),/DEADLINE/);
 for(const maxRequestMs of [0,-1,10001,1.5,NaN])assert.throws(()=>createNativeCapabilityClient({configuration,credential,maxRequestMs}),/NATIVE_CONFIGURATION/);
});

test('only the release client tolerates a task-bound 3.5s exchange; original expiry still wins',async()=>{
 let at=Date.now();const start=at,o=original(at+30000),paths=[];
 const fetchImpl=async(url,input)=>{paths.push(new URL(url).pathname);assert.equal(input.headers.authorization,'Bearer '+credential);assert.deepEqual(JSON.parse(input.body),{original:o,taskArn});at=start+3500;return Response.json({original:o,taskArn,checkedAtMs:at,expiresAtMs:o.expiresAtMs,released:true});};
 const client=createPreparedRunnerReleaseClient({original:o,taskArn,origin:'https://native.synthetic.invalid',credential,fetchImpl,now:()=>at});
 assert.equal((await client.release({original:o,taskArn})).released,true);
 assert.deepEqual(paths,['/v1/native-task/release']);

 at=Date.now();const short=original(at+2000),shortStart=at;
 const shortClient=createPreparedRunnerReleaseClient({original:short,taskArn,origin:'https://native.synthetic.invalid',credential,
  fetchImpl:async()=>{at=shortStart+3500;return Response.json({original:short,taskArn,checkedAtMs:at,expiresAtMs:short.expiresAtMs,released:true});},now:()=>at});
 await assert.rejects(shortClient.release({original:short,taskArn}),/DEADLINE/);
});
