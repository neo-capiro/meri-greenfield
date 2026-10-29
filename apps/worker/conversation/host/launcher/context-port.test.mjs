import test from 'node:test';
import assert from 'node:assert/strict';
import {PassThrough} from 'node:stream';
import {binding,installation,enabledPolicy} from '../../browser/test/fixtures.mjs';
import {createConfinedContextPort} from './context-port.mjs';
function fixture({connect,signal}={}){
 const policy=enabledPolicy(),paths={home:'/private/home',profile:'/private/profile',output:'/private/output'},context={};
 let stops=0,calls=0;const native={readable:new PassThrough(),writable:new PassThrough(),close:async()=>{stops++;}};
 const chromium={connectOverCDP:async(transport,options)=>{calls++;transport.send({id:1,method:'Browser.getVersion'});assert.ok(options.timeout>0);return connect?connect():{contexts:()=>[context],close:async()=>{}};}};
 const port=createConfinedContextPort({native,binding,policy,installation,paths,chromium,signal});
 return {port,native,context,request:{binding,policy,installation,paths,deadlineMs:Date.now()+1000},get calls(){return calls;},get stops(){return stops;}};
}
test('one canonical context is connected after native readiness, before any SDK dependency',async()=>{
 const f=fixture();const pending=f.port.create(f.request);assert.equal(f.calls,0);
 f.native.readable.write('{"bridgeReady":true}\n');assert.equal(await pending,f.context);assert.equal(f.calls,1);
 await assert.rejects(f.port.create(f.request),/REFUSED/);f.native.readable.destroy();
});
test('a current site workflow may narrow tools and origins within the already confined browser',async()=>{
 const f=fixture();f.native.readable.write('{"bridgeReady":true}\n');
 assert.equal(await f.port.create({...f.request,policy:{...f.request.policy,tools:['browser_snapshot'],allowedOrigins:[f.request.policy.allowedOrigins[0]]}}),f.context);
 f.native.readable.destroy();
});
test('context substitution or policy expansion never connects a native browser',async()=>{
 for(const change of [{binding:{...binding,actorId:'other'}},{paths:{profile:'/other'}},
  {policy:enabledPolicy({allowedOrigins:['https://unlisted.example']})},
  {policy:enabledPolicy({downloads:{enabled:true,formats:['pdf'],maxBytes:8192,maxFiles:2}})}]){
  const f=fixture();await assert.rejects(f.port.create({...f.request,...change}));assert.equal(f.calls,0);f.native.readable.destroy();
 }
});
test('cancelled native preparation closes its transport without waiting for readiness',async()=>{
 const abort=new AbortController(),f=fixture({signal:abort.signal});const pending=f.port.create(f.request);abort.abort();
 await assert.rejects(pending);await Promise.resolve();assert.equal(f.stops,1);assert.equal(f.calls,0);
});
test('late native connection after abort is closed and never returned',async()=>{
 const abort=new AbortController(),answer=Promise.withResolvers(),started=Promise.withResolvers();let closed=0;
 const f=fixture({signal:abort.signal,connect:()=>{started.resolve();return answer.promise;}});
 f.native.readable.write('{"bridgeReady":true}\n');const pending=f.port.create(f.request);await started.promise;abort.abort();await assert.rejects(pending);
 answer.resolve({contexts:()=>[{}],close:async()=>{closed++;}});await new Promise(resolve=>setImmediate(resolve));assert.equal(closed,1);assert.equal(f.stops,1);
});
