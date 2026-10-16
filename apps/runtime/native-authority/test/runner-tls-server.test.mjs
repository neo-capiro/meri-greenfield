import test from 'node:test';import assert from 'node:assert/strict';
import {compileRunnerTlsServerMaterial} from '../runner-tls-server.mjs';
import {runnerTaskServername} from '../runner-tls-client.mjs';
import {taskRouterFixture} from './task-router-fixture.mjs';
import {createRunnerTlsCertificateFixture} from './runner-tls-fixture.mjs';
const zone='runner.internal';
test('runner HTTPS material binds exact task metadata, SAN, trusted chain and private key',t=>{
 const f=taskRouterFixture(),certificates=createRunnerTlsCertificateFixture(t),original={...f.original,expiresAtMs:Date.now()+2*86400000},candidate={...f.candidate,expiresAtMs:original.expiresAtMs};
 const leaf=certificates.issueLeaf('server','DNS:'+runnerTaskServername({taskArn:candidate.taskArn,zone})),other=certificates.issueLeaf('other','DNS:'+runnerTaskServername({taskArn:candidate.taskArn,zone}));
 const metadata={TaskARN:candidate.taskArn,Cluster:candidate.clusterArn,Containers:[{Name:candidate.containerName,Networks:[{NetworkMode:'awsvpc',IPv4Addresses:[candidate.privateIPv4Address]}]}]},material={original,candidate,metadata,zone,ca:certificates.ca,...leaf};
 const options=compileRunnerTlsServerMaterial(material);assert.equal(options.minVersion,'TLSv1.3');assert.equal(options.requestCert,false);assert.equal(options.key.type,'private');assert.equal(options.cert.toString(),leaf.cert.toString());
 for(const changed of [
  {...material,metadata:{...metadata,TaskARN:candidate.taskArn.replace(/a{32}$/u,'b'.repeat(32))}},
  {...material,metadata:{...metadata,Containers:[{...metadata.Containers[0],Networks:[{NetworkMode:'awsvpc',IPv4Addresses:['10.40.1.43']}]}]}},
  {...material,key:other.key},
  {...material,original:{...original,expiresAtMs:Date.now()+1000},candidate:{...candidate,expiresAtMs:Date.now()+1000}},
  {...material,zone:'another.internal'},
  {...material,ca:leaf.cert},
  {...material,cert:Buffer.concat([leaf.cert,Buffer.from('\nforeign content')])},
  {...material,candidate:{...candidate,executionKey:'0'.repeat(64)}},
 ])assert.throws(()=>compileRunnerTlsServerMaterial(changed),/TASK_ROUTER_REFUSED/);
});
