import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:https';
import {createServer as createTcpServer} from 'node:net';
import {createRunnerPoststartTransport,classifyRunnerPoststartTransportError} from '../runner-poststart-transport.mjs';
import {createRunnerTlsCertificateFixture} from '../native-authority/test/runner-tls-fixture.mjs';
test('transport failure classification is a fixed category, never a Node exception string',()=>{
 for(const [code,category] of [['ENOTFOUND','DNS'],['EAI_AGAIN','DNS'],['ECONNREFUSED','TCP'],['ECONNRESET','TCP'],
  ['ERR_TLS_CERT_ALTNAME_INVALID','TLS'],['UNABLE_TO_VERIFY_LEAF_SIGNATURE','TLS'],['ETIMEDOUT','TIMEOUT']]){
  const error=Object.assign(Error('private host, key and token must not escape'),{code});
  assert.equal(classifyRunnerPoststartTransportError(error),`RUNNER_POSTSTART_${category}`);
 }
 assert.equal(classifyRunnerPoststartTransportError(Object.assign(Error('secret'),{code:'ARBITRARY_SECRET'})),'RUNNER_POSTSTART_REFUSED');
 assert.equal(classifyRunnerPoststartTransportError({get code(){throw Error('secret');}}),'RUNNER_POSTSTART_REFUSED');
});
test('a refused loopback connection reports TCP without the address or exception',async()=>{
 const listener=createTcpServer();await new Promise(resolve=>listener.listen(0,'localhost',resolve));const port=listener.address().port;
 await new Promise(resolve=>listener.close(resolve));
 const client=createRunnerPoststartTransport({origin:`https://localhost:${port}`,ca:Buffer.from('public CA fixture')});
 await assert.rejects(client.post('challenge',{}),error=>error.code==='RUNNER_POSTSTART_TCP'&&error.message===error.code&&error.cause===undefined);
});
test('poststart transport uses pinned HTTPS, no redirect and distinct pending status',async t=>{
 const fixture=createRunnerTlsCertificateFixture(t),leaf=fixture.issueLeaf('poststart','DNS:localhost');let mode='success',calls=0;
 const server=createServer({key:leaf.key,cert:leaf.cert},(request,response)=>{calls++;assert.equal(request.url,'/v1/runner-poststart/'+(mode.endsWith('redeem')?'redeem':'challenge'));assert.equal(request.method,'POST');assert.equal(request.headers.authorization,undefined);response.setHeader('content-type','application/json');if(mode==='pending'){response.statusCode=503;response.end(JSON.stringify({error:{code:'RUNNER_POSTSTART_PENDING'}}));}else if(mode==='pending-invalid'){response.statusCode=503;response.end(JSON.stringify({error:{code:'PRIVATE_BODY'}}));}else if(mode==='redirect'){response.statusCode=302;response.setHeader('location','https://elsewhere.invalid');response.end('{}');}else if(mode==='http'){response.statusCode=429;response.setHeader('x-private-header','private header value');response.end('private response body');}else if(mode==='protocol'){response.end('private invalid json body');}else if(mode==='slow-redeem')setTimeout(()=>response.end(JSON.stringify({schemaVersion:1})),150);else if(mode==='delayed-redeem')setTimeout(()=>response.end(JSON.stringify({schemaVersion:1})),60);else response.end(JSON.stringify({schemaVersion:1}));});
 await new Promise(resolve=>server.listen(0,'localhost',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));
 const origin='https://localhost:'+server.address().port,client=createRunnerPoststartTransport({origin,ca:fixture.ca});
 assert.deepEqual(await client.post('challenge',{schemaVersion:1}),{schemaVersion:1});mode='pending';await assert.rejects(client.post('challenge',{schemaVersion:1}),{code:'RUNNER_POSTSTART_PENDING'});
 mode='redirect';await assert.rejects(client.post('challenge',{schemaVersion:1}),{code:'RUNNER_POSTSTART_HTTP'});
 mode='http';await assert.rejects(client.post('challenge',{schemaVersion:1}),error=>error.code==='RUNNER_POSTSTART_HTTP'&&error.message===error.code&&error.cause===undefined);
 mode='protocol';await assert.rejects(client.post('challenge',{schemaVersion:1}),error=>error.code==='RUNNER_POSTSTART_PROTOCOL'&&error.message===error.code&&error.cause===undefined);
 mode='pending-invalid';await assert.rejects(client.post('challenge',{schemaVersion:1}),{code:'RUNNER_POSTSTART_HTTP'});
 const wrong=createRunnerPoststartTransport({origin,ca:Buffer.from('not the CA')});await assert.rejects(wrong.post('challenge',{}),{code:'RUNNER_POSTSTART_TLS'});assert.equal(calls,6);
 mode='delayed-redeem';const delayed=createRunnerPoststartTransport({origin,ca:fixture.ca,maxRequestMs:500});
 assert.deepEqual(await delayed.post('redeem',{schemaVersion:1}),{schemaVersion:1});
 mode='slow-redeem';const bounded=createRunnerPoststartTransport({origin,ca:fixture.ca,maxRequestMs:40});
 await assert.rejects(bounded.post('redeem',{schemaVersion:1}),{code:'RUNNER_POSTSTART_TIMEOUT'});assert.equal(calls,8);
});
