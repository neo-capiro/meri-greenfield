import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:https';
import {createRunnerPoststartTransport} from '../runner-poststart-transport.mjs';
import {createRunnerTlsCertificateFixture} from '../native-authority/test/runner-tls-fixture.mjs';
test('poststart transport uses pinned HTTPS, no redirect and distinct pending status',async t=>{
 const fixture=createRunnerTlsCertificateFixture(t),leaf=fixture.issueLeaf('poststart','DNS:localhost');let mode='success',calls=0;
 const server=createServer({key:leaf.key,cert:leaf.cert},(request,response)=>{calls++;assert.equal(request.url,'/v1/runner-poststart/'+(mode.endsWith('redeem')?'redeem':'challenge'));assert.equal(request.method,'POST');assert.equal(request.headers.authorization,undefined);response.setHeader('content-type','application/json');if(mode==='pending'){response.statusCode=503;response.end(JSON.stringify({error:{code:'RUNNER_POSTSTART_PENDING'}}));}else if(mode==='redirect'){response.statusCode=302;response.setHeader('location','https://elsewhere.invalid');response.end('{}');}else if(mode==='slow-redeem')setTimeout(()=>response.end(JSON.stringify({schemaVersion:1})),150);else if(mode==='delayed-redeem')setTimeout(()=>response.end(JSON.stringify({schemaVersion:1})),60);else response.end(JSON.stringify({schemaVersion:1}));});
 await new Promise(resolve=>server.listen(0,'localhost',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));
 const origin='https://localhost:'+server.address().port,client=createRunnerPoststartTransport({origin,ca:fixture.ca});
 assert.deepEqual(await client.post('challenge',{schemaVersion:1}),{schemaVersion:1});mode='pending';await assert.rejects(client.post('challenge',{schemaVersion:1}),{code:'RUNNER_POSTSTART_PENDING'});mode='redirect';await assert.rejects(client.post('challenge',{schemaVersion:1}),{code:'RUNNER_POSTSTART_REFUSED'});
 const wrong=createRunnerPoststartTransport({origin,ca:Buffer.from('not the CA')});await assert.rejects(wrong.post('challenge',{}),{code:'RUNNER_POSTSTART_REFUSED'});assert.equal(calls,3);
 mode='delayed-redeem';const delayed=createRunnerPoststartTransport({origin,ca:fixture.ca,maxRequestMs:500});
 assert.deepEqual(await delayed.post('redeem',{schemaVersion:1}),{schemaVersion:1});
 mode='slow-redeem';const bounded=createRunnerPoststartTransport({origin,ca:fixture.ca,maxRequestMs:40});
 await assert.rejects(bounded.post('redeem',{schemaVersion:1}),{code:'RUNNER_POSTSTART_REFUSED'});assert.equal(calls,5);
});
