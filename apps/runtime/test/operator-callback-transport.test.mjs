import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer as tcpServer} from 'node:net';
import {once} from 'node:events';
import {createOperatorCallbackTransport} from '../operator-callback-transport.mjs';
import {operatorCallbackConfiguration} from '../operator-callback-configuration.mjs';
import {createNativeCapabilityClient} from '../native-client.mjs';
import {createNativeSdkSessionClient} from '../sdk-session-client.mjs';
import {createNativeReadsClient} from '../reads-client.mjs';
import {createRunnerIntentsClient} from '../native-authority/intents-client.mjs';
import {binding} from '../../control/conversations/test/store-fixture.mjs';
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {isAuthorityUnavailable} from '../../../packages/runtime/authority-availability.mjs';
import {pki,origin,name,credential,descriptor,leafPin,tlsServer,localRequest} from './operator-callback.fixture.mjs';
const post={method:'POST',redirect:'error',headers:{authorization:'Bearer '+credential,'content-type':'application/json','x-meri-run-binding':'unchanged-binding'},body:'{"unchanged":"π"}'};
test('protected descriptor is closed, captures immutable endpoint, and rejects unknown/mixed trust',()=>{
 const good=descriptor();assert.deepEqual(operatorCallbackConfiguration(good),good);
 for(const mutate of [c=>c.endpoint.address='127.0.0.1',c=>c.origin='https://other.invalid',c=>c.endpoint.serverName='other.invalid',c=>c.endpoint.port=444,
  c=>c.testOwners={},c=>c.caCertificate+=pki.otherCa,c=>c.caCertificate=pki.good.cert,c=>c.retainUntilMs=Date.now(),c=>delete c.controlCapabilitySha256]){
  const wrong=structuredClone(good);mutate(wrong);assert.throws(()=>operatorCallbackConfiguration(wrong));
 }
});
test('real TLS preserves fixed SNI/Host, paths, query, headers, bytes and streaming Response on fresh connections',async t=>{
 const seen=[],ports=[];let count=0;
 const server=await tlsServer(t,pki.good,async(req,res)=>{
  count++;ports.push(req.socket.remotePort);assert.equal(req.socket.servername,name);assert.equal(req.url,'/v1/runner/session/append?stable=1');
  assert.equal(req.headers.authorization,post.headers.authorization);assert.equal(req.headers['x-meri-run-binding'],'unchanged-binding');
  const chunks=[];for await(const chunk of req)chunks.push(chunk);assert.equal(Buffer.concat(chunks).toString(),post.body);
  res.writeHead(200,{'content-type':'application/json','x-owner':'unchanged'});res.write('{"str');setImmediate(()=>res.end('eam":true}'));
 });
 const raw=descriptor(),transport=createOperatorCallbackTransport(raw,{request:localRequest(server,seen)});t.after(()=>transport.close());raw.endpoint.address='10.0.0.99';
 for(let i=0;i<2;i++){const response=await transport.fetch(origin+'/v1/runner/session/append?stable=1',post);assert.equal(response.headers.get('x-owner'),'unchanged');assert.deepEqual(await response.json(),{stream:true});}
 assert.equal(count,2);assert.equal(new Set(ports).size,2);assert.equal(seen.length,2);
});
for(const mode of ['wrong-ca','wrong-san-matching-pin','expired-matching-pin','wrong-leaf'])test(`real TLS rejects ${mode} before credential/body bytes`,async t=>{
 const leaf=mode.startsWith('wrong-san')?pki.wrongName:mode.startsWith('expired')?pki.expired:pki.good;
 let received=0;const seen=[],server=await tlsServer(t,leaf,(_req,res)=>{received++;res.end();}),raw=descriptor();
 raw.endpoint.serverFingerprintSha256=mode==='wrong-leaf'?'0'.repeat(64):leafPin(leaf);if(mode==='wrong-ca')raw.caCertificate=pki.otherCa;
 const transport=createOperatorCallbackTransport(raw,{request:localRequest(server,seen)});t.after(()=>transport.close());
 const native=createNativeCapabilityClient({configuration:{origin,maxResponseBytes:1048576},credential,fetch:transport.fetch});
 await assert.rejects(native.call('runner/load',{binding},{deadlineMs:Date.now()+6000}),error=>!isAuthorityUnavailable(error));assert.equal(received,0);assert.equal(seen.length,1);
});
test('origin/headers/method refuse before connection and redirects return once without fallback',async t=>{
 const seen=[],server=await tlsServer(t,pki.good,(_req,res)=>res.writeHead(302,{location:'https://other.invalid'}).end());
 const transport=createOperatorCallbackTransport(descriptor(),{request:localRequest(server,seen)});t.after(()=>transport.close());
 for(const [url,patch]of [['https://other.invalid/v1',{}],[origin+'/v1#fragment',{}],[origin+'/v1',{method:'GET'}],[origin+'/v1',{redirect:'follow'}],
  [origin+'/v1',{headers:{host:'other.invalid'}}],[origin+'/v1',{headers:{'content-length':'999'}}]])await assert.rejects(transport.fetch(url,{...post,...patch}));
 assert.equal(seen.length,0);const response=await transport.fetch(origin+'/v1/runner/load',post);assert.equal(response.status,302);await response.text();assert.equal(seen.length,1);
 transport.close();await assert.rejects(transport.fetch(origin+'/v1',post));assert.equal(seen.length,1);
});
test('cancellation and close destroy stalled TLS work without alternate requests',async t=>{
 const sockets=new Set(),server=tcpServer(socket=>{sockets.add(socket);socket.once('close',()=>sockets.delete(socket));});server.listen(0,'127.0.0.1');await once(server,'listening');
 t.after(()=>{for(const socket of sockets)socket.destroy();return new Promise(r=>server.close(r));});const seen=[];
 const transport=createOperatorCallbackTransport(descriptor(),{request:localRequest(server,seen)});
 await assert.rejects(transport.fetch(origin+'/v1', {...post,signal:AbortSignal.timeout(50)}));
 const pending=transport.fetch(origin+'/v1',post);const rejected=assert.rejects(pending);transport.close();await rejected;assert.equal(seen.length,2);
});
test('caller cancellation remains attached after headers and aborts an unfinished response stream',async t=>{
 const seen=[],server=await tlsServer(t,pki.good,(_req,res)=>{res.writeHead(200,{'content-type':'application/json'});res.write('{');});
 const transport=createOperatorCallbackTransport(descriptor(),{request:localRequest(server,seen)});t.after(()=>transport.close());
 const stop=new AbortController(),response=await transport.fetch(origin+'/v1/runner/load',{...post,signal:stop.signal});
 const reading=assert.rejects(response.text());stop.abort();await reading;assert.equal(seen.length,1);
});
test('existing native read replay keeps the same bytes and deadline; transport adds no retries',async t=>{
 const bodies=[];const server=await tlsServer(t,pki.good,async(req,res)=>{const parts=[];for await(const part of req)parts.push(part);bodies.push(Buffer.concat(parts).toString());
  if(bodies.length===1)res.writeHead(503,{'content-type':'application/json'}).end('{"error":{"code":"WORKER_AUTHORITY_UNAVAILABLE"}}');
  else res.writeHead(200,{'content-type':'application/json'}).end('{"ok":true}');});
 const transport=createOperatorCallbackTransport(descriptor(),{request:localRequest(server)});t.after(()=>transport.close());
 const native=createNativeCapabilityClient({configuration:{origin,maxResponseBytes:1048576},credential,fetch:transport.fetch});
 assert.deepEqual(await native.call('runner/load',{binding},{deadlineMs:Date.now()+6000}),{ok:true});assert.equal(bodies.length,2);assert.equal(bodies[0],bodies[1]);
});
test('review: lost pre-response socket lets the native read owner replay the identical request within its original deadline',async t=>{
 const bodies=[],authorization=[];const server=await tlsServer(t,pki.good,async(req,res)=>{authorization.push(req.headers.authorization);const parts=[];for await(const part of req)parts.push(part);bodies.push(Buffer.concat(parts).toString());
  if(bodies.length===1)req.socket.destroy();else res.writeHead(200,{'content-type':'application/json'}).end('{"ok":true}');});
 const seen=[],transport=createOperatorCallbackTransport(descriptor(),{request:localRequest(server,seen)});t.after(()=>transport.close());
 const native=createNativeCapabilityClient({configuration:{origin,maxResponseBytes:1048576},credential,fetch:transport.fetch});
 const deadlineMs=Date.now()+6000;
 assert.deepEqual(await native.call('runner/load',{binding},{deadlineMs}),{ok:true});assert.equal(bodies.length,2);assert.equal(seen.length,2);
 assert.equal(bodies[0],bodies[1]);assert.deepEqual(authorization,['Bearer '+credential,'Bearer '+credential]);assert.ok(Date.now()<deadlineMs);
});
test('pre-response socket remains unavailable when too little original deadline remains, with no new attempt',async t=>{
 let calls=0;const server=await tlsServer(t,pki.good,async(req)=>{for await(const _chunk of req){}calls++;req.socket.destroy();});
 const transport=createOperatorCallbackTransport(descriptor(),{request:localRequest(server)});t.after(()=>transport.close());
 const native=createNativeCapabilityClient({configuration:{origin,maxResponseBytes:1048576},credential,fetch:transport.fetch});
 await assert.rejects(native.call('runner/load',{binding},{deadlineMs:Date.now()+900}),error=>isAuthorityUnavailable(error)&&error.cause?.code==='PINNED_NATIVE_SOCKET');assert.equal(calls,1);
});
test('loss after a response head stays a response failure and does not acquire pre-response replay',async t=>{
 let calls=0;const server=await tlsServer(t,pki.good,(_req,res)=>{calls++;res.writeHead(200,{'content-type':'application/json'});res.write('{');setImmediate(()=>res.destroy());});
 const transport=createOperatorCallbackTransport(descriptor(),{request:localRequest(server)});t.after(()=>transport.close());
 const native=createNativeCapabilityClient({configuration:{origin,maxResponseBytes:1048576},credential,fetch:transport.fetch});
 await assert.rejects(native.call('runner/load',{binding},{deadlineMs:Date.now()+6000}),error=>!isAuthorityUnavailable(error));assert.equal(calls,1);
});
test('local refusal, close and caller cancellation cannot become replayable socket errors',async t=>{
 const sockets=new Set(),server=tcpServer(socket=>{sockets.add(socket);socket.once('close',()=>sockets.delete(socket));});server.listen(0,'127.0.0.1');await once(server,'listening');
 t.after(()=>{for(const socket of sockets)socket.destroy();return new Promise(r=>server.close(r));});const seen=[];
 const transport=createOperatorCallbackTransport(descriptor(),{request:localRequest(server,seen)});
 const native=base=>createNativeCapabilityClient({configuration:{origin:base,maxResponseBytes:1048576},credential,fetch:transport.fetch});
 const options=()=>({deadlineMs:Date.now()+6000});
 await assert.rejects(native('https://foreign.invalid').call('runner/load',{binding},options()),error=>!isAuthorityUnavailable(error));assert.equal(seen.length,0);
 await assert.rejects(native(origin).call('runner/load',{binding},{...options(),signal:AbortSignal.timeout(50)}),error=>!isAuthorityUnavailable(error));assert.equal(seen.length,1);
 transport.close();await assert.rejects(native(origin).call('runner/load',{binding},options()),error=>!isAuthorityUnavailable(error));assert.equal(seen.length,1);
});
test('native, session, reads and intents owners use the same case transport and preserve their authentication',async t=>{
 const seen=[];const server=await tlsServer(t,pki.good,async(req,res)=>{const chunks=[];for await(const chunk of req)chunks.push(chunk);
  seen.push({path:req.url,authorization:req.headers.authorization,body:JSON.parse(Buffer.concat(chunks))});
  res.writeHead(503,{'content-type':'application/json'}).end('{"error":{"code":"UNAVAILABLE"}}');});
 const transport=createOperatorCallbackTransport(descriptor(),{request:localRequest(server)});t.after(()=>transport.close());
 const shared={origin,credential,binding,fetchImpl:transport.fetch};
 const native=createNativeCapabilityClient({configuration:{origin,maxResponseBytes:1048576},credential,fetch:transport.fetch});
 await assert.rejects(native.readiness());await assert.rejects(createNativeSdkSessionClient(shared).snapshot({}));
 const reads=createNativeReadsClient({...shared,approvedReads:{schemaVersion:'meri-native-general-reads/1',enabled:true,operations:[{id:'find_contacts',version:'0.2.0'}],maxExecuteMs:1000,maxRequestBytes:65536,maxResponseBytes:1048576}});
 await assert.rejects(reads.readAvailability());await assert.rejects(createRunnerIntentsClient({...shared,enabled:true}).readAvailability());
 assert.deepEqual(seen.map(x=>x.path),['/v1/readiness','/v1/runner/session/snapshot','/v1/runner/reads/availability','/v1/runner/intents/availability']);
 assert.ok(seen.every(x=>x.authorization==='Bearer '+credential));assert.deepEqual(seen[1].body.binding,binding);
});
for(const mode of ['truncated','large','lost','invalid-status'])test(`existing native owner refuses ${mode} response without replaying kickoff`,async t=>{
 let calls=0;const server=await tlsServer(t,pki.good,(req,res)=>{calls++;if(mode==='lost'){req.socket.destroy();return;}if(mode==='invalid-status'){res.writeHead(700).end();return;}
  res.writeHead(200,{'content-type':'application/json'}).end(mode==='large'?'x'.repeat(2048):'{"broken":');});
 const transport=createOperatorCallbackTransport(descriptor(),{request:localRequest(server)});t.after(()=>transport.close());
 const native=createNativeCapabilityClient({configuration:{origin,maxResponseBytes:1024},credential,fetch:transport.fetch,maxRequestMs:1000});
 await assert.rejects(native.call('execution/kickoff',{binding,executionKey:hash(binding)}));assert.equal(calls,1);
});
