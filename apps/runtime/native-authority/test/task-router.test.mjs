import test from 'node:test';import assert from 'node:assert/strict';
import {createTaskRouterApplication} from '../task-router.mjs';
import {taskRouterFixture} from './task-router-fixture.mjs';
function fixture(options={}){
 const f=taskRouterFixture();let networkHook=()=>{},connectHook=async()=>{},sendHook=async()=>({status:200,body:Buffer.from(JSON.stringify({original:f.original,receipt:{physicalStopProven:true}}))});
 const router=createTaskRouterApplication({authority:f.authority,privateIngress:f.privateIngress,networkReader:{async observe(){f.counts.network++;await networkHook();return {...f.candidate,checkedAtMs:Date.now()};}},connector:{async connect(value){f.counts.connect++;await connectHook(value);return {async send(input){f.counts.send++;return sendHook(input);},close(){f.counts.close++;}};}},enabled:true,...options});
 return {...f,router,post:(operation,credential,body)=>router.privateApplication.handle(f.request(operation,credential,body),{ingress:f.ingress}),onNetwork:hook=>{networkHook=hook;},onConnect:hook=>{connectHook=hook;},onSend:hook=>{sendHook=hook;}};
}
test('disabled and public mounts refuse without reading owners or forwarding any token',async()=>{
 const f=fixture({enabled:false});assert.equal((await f.post()).status,503);assert.equal((await f.router.application.handle(f.request())).status,403);assert.equal((await f.router.privateApplication.handle(f.request())).status,403);assert.equal(f.counts.issuance,0);assert.equal(f.counts.connect,0);f.router.close();
});
test('authorized request connects after current task observation, rechecks after TLS and response, strips headers',async()=>{
 const f=fixture();f.onSend(async input=>{assert.equal(input.operation,'inspect');assert.equal(input.authorization,'Bearer '+f.controlCredential);assert.deepEqual(JSON.parse(input.body),{original:f.original});assert.equal(input.maxResponseBytes,2097152);return {status:200,body:Buffer.from(JSON.stringify({original:f.original,receipt:{ok:true}}))};});
 const response=await f.post();assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');assert.equal(f.counts.network,3);assert.equal(f.counts.admission,3);assert.equal(f.counts.send,1);assert.equal(f.counts.close,1);assert.deepEqual(f.router.status(),{closed:false,activeRequests:0,trackedOriginals:1});f.router.close();
});
test('prepared release gates use the same admitted task route and exact task ARN',async()=>{
 for(const operation of ['release-readiness','release']){
  const f=fixture();f.onSend(async input=>{assert.equal(input.operation,operation);assert.deepEqual(JSON.parse(input.body),{original:f.original,taskArn:f.resource.taskArn});return {status:200,body:Buffer.from(JSON.stringify({original:f.original,taskArn:f.resource.taskArn,checkedAtMs:Date.now(),expiresAtMs:f.original.expiresAtMs,released:operation==='release'}))};});
  assert.equal((await f.post(operation,f.controlCredential,{taskArn:f.resource.taskArn})).status,200);
  assert.equal((await f.post(operation,f.taskCredential,{taskArn:f.resource.taskArn})).status,403);
  assert.equal((await f.post(operation,f.controlCredential,{taskArn:f.resource.taskArn.replace(/a{32}$/u,'b'.repeat(32))})).status,403);
  assert.equal(f.counts.send,1);f.router.close();
 }
});
test('wrong credential, unknown operation, query, encoding and wrong original send no bearer',async()=>{
 const f=fixture();const invalid=[f.request('inspect','foreign'),f.request('unknown'),new Request('https://router.invalid/v1/native-task/inspect?q=1',{method:'POST',headers:{authorization:'Bearer '+f.controlCredential,'content-type':'application/json'},body:JSON.stringify({original:f.original})}),f.request('inspect',f.controlCredential,{original:{...f.original,expiresAtMs:f.original.expiresAtMs+1}})];
 for(const request of invalid)assert.equal((await f.router.privateApplication.handle(request,{ingress:f.ingress})).status,403);assert.equal(f.counts.connect,0);assert.equal(f.counts.send,0);f.router.close();
});
test('failed TLS handshake and ENI change after handshake forward no bearer',async()=>{
 const f=fixture();f.onConnect(async()=>{throw Error('wrong-task-SAN-or-CA');});assert.equal((await f.post()).status,403);assert.equal(f.counts.send,0);f.router.close();
 const changed=fixture();changed.onNetwork(()=>{if(changed.counts.network===2)changed.candidate.privateIPv4Address='10.40.1.43';});assert.equal((await changed.post()).status,403);assert.equal(changed.counts.send,0);assert.equal(changed.counts.close,1);changed.router.close();
});
test('revoked owner or replaced task after response never releases a successful result',async()=>{
 for(const change of [f=>{f.saved.run.state='cancelled';},f=>{f.record.resource.taskArn=f.record.resource.taskArn.replace(/a{32}$/u,'b'.repeat(32));},f=>{f.candidate.networkInterfaceId='eni-bbbbbbbb';}]){const f=fixture();f.onSend(async()=>{change(f);return {status:200,body:Buffer.from(JSON.stringify({original:f.original,receipt:{ok:true}}))};});assert.equal((await f.post()).status,403);assert.equal(f.counts.send,1);assert.equal(f.counts.close,1);f.router.close();}
});
test('authenticated stop has a reserved saturation slot, cancels in-flight work and keeps that original fenced',async()=>{
 const f=fixture({maxConcurrent:1,maxBufferedBytes:8388608}),entered=Promise.withResolvers();f.onSend(async input=>{if(input.operation==='stop')return {status:200,body:Buffer.from(JSON.stringify({original:f.original,receipt:{physicalStopProven:true}}))};entered.resolve();return new Promise((resolve,reject)=>{input.signal.addEventListener('abort',()=>reject(Error('stopped')),{once:true});});});
 const pending=f.post();await entered.promise;const stopped=await f.post('stop',f.taskCredential);assert.equal(stopped.status,200);assert.equal((await pending).status,403);assert.equal((await f.post()).status,403);assert.equal(f.counts.send,2);f.router.close();
});
test('oversized request and foreign downstream response are refused without successful release',async()=>{
 const f=fixture(),request=new Request('https://router.invalid/v1/native-task/inspect',{method:'POST',headers:{authorization:'Bearer '+f.controlCredential,'content-type':'application/json','content-length':'2097153'},body:JSON.stringify({original:f.original})});
 assert.equal((await f.router.privateApplication.handle(request,{ingress:f.ingress})).status,403);assert.equal(f.counts.connect,0);
 f.onSend(async()=>({status:200,body:Buffer.from(JSON.stringify({original:{...f.original,planSha256:'0'.repeat(64)}}))}));assert.equal((await f.post()).status,403);assert.equal(f.counts.close,1);f.router.close();
});
test('deadline closes a late TLS connection and never sends its credential',async()=>{
 const f=fixture({maxRequestMs:20}),release=Promise.withResolvers();f.onConnect(()=>release.promise);assert.equal((await f.post()).status,403);release.resolve();await new Promise(resolve=>setImmediate(resolve));assert.equal(f.counts.send,0);assert.equal(f.counts.close,1);f.router.close();
});
