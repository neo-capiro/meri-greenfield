import test from 'node:test';
import assert from 'node:assert/strict';
import {request as httpsRequest} from 'node:https';
import {loadRunnerHttpsMaterial} from '../runner-https-material.mjs';
import {listenRuntime} from '../http-server.mjs';
import {taskRouterFixture} from '../native-authority/test/task-router-fixture.mjs';
import {createRunnerTlsCertificateFixture} from '../native-authority/test/runner-tls-fixture.mjs';
import {runnerTaskServername} from '../native-authority/runner-tls-client.mjs';

function fixture(t){
 const f=taskRouterFixture(),certificates=createRunnerTlsCertificateFixture(t),zone='runner.internal';
 const original={...f.original,expiresAtMs:Date.now()+2*86400000};
 const candidate={...f.candidate,expiresAtMs:original.expiresAtMs};
 const leaf=certificates.issueLeaf('task','DNS:'+runnerTaskServername({taskArn:candidate.taskArn,zone}));
 const metadata={TaskARN:candidate.taskArn,Cluster:candidate.clusterArn,Containers:[{Name:candidate.containerName,Networks:[{NetworkMode:'awsvpc',IPv4Addresses:[candidate.privateIPv4Address]}]}]};
 const tls={zone,caFile:'/ca',certFile:'/cert',keyFile:'/key',candidateFile:'/candidate',metadataFile:'/metadata'};
 const files=new Map([['/ca',certificates.ca],['/cert',leaf.cert],['/key',leaf.key],['/candidate',Buffer.from(JSON.stringify(candidate))],['/metadata',Buffer.from(JSON.stringify(metadata))]]);
 return {original,candidate,certificates,zone,tls,files,read:async path=>files.get(path)};
}

test('runner startup requires exact original-bound TLS files before opening HTTPS',async t=>{
 const f=fixture(t),load=overrides=>loadRunnerHttpsMaterial({original:f.original,taskArn:f.candidate.taskArn,tls:f.tls,read:f.read,...overrides});
 const material=await load();assert.equal(material.minVersion,'TLSv1.3');
 await assert.rejects(load({taskArn:f.candidate.taskArn.replace(/a{32}$/u,'b'.repeat(32))}),/TASK_ROUTER_REFUSED/);
 f.files.set('/candidate',Buffer.from(JSON.stringify({...f.candidate,privateIPv4Address:'10.40.1.43'})));
 await assert.rejects(load(),/TASK_ROUTER_REFUSED/);
 f.files.set('/candidate',Buffer.from('{invalid'));
 await assert.rejects(load(),/TASK_ROUTER_REFUSED/);
});

test('the trusted runner material serves the existing receiver over TLS 1.3',async t=>{
 const f=fixture(t),tls=await loadRunnerHttpsMaterial({original:f.original,taskArn:f.candidate.taskArn,tls:f.tls,read:f.read});
 const listener=await listenRuntime({configuration:{http:{hostname:'127.0.0.1',port:0,frontendOrigin:'https://client.invalid'},limits:{requestMs:1000,shutdownMs:1000}},tls,
  application:{handle:async request=>Response.json({path:new URL(request.url).pathname})},readiness:async()=>({})});
 t.after(()=>listener.close());
 const body=await new Promise((resolve,reject)=>{
  const request=httpsRequest({hostname:'127.0.0.1',port:listener.address.port,servername:runnerTaskServername({taskArn:f.candidate.taskArn,zone:f.zone}),ca:f.certificates.ca,
   minVersion:'TLSv1.3',rejectUnauthorized:true,method:'POST',path:'/v1/native-task/inspect'},response=>{
    assert.equal(response.statusCode,200);assert.equal(response.socket.getProtocol(),'TLSv1.3');const chunks=[];response.on('data',chunk=>chunks.push(chunk));response.on('end',()=>resolve(Buffer.concat(chunks).toString()));});
  request.on('error',reject);request.end();
 });
 assert.deepEqual(JSON.parse(body),{path:'/v1/native-task/inspect'});
});
