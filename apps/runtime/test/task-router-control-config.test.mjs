import test from 'node:test';
import assert from 'node:assert/strict';
import {compileControlTaskRouterConfiguration} from '../config.mjs';
import {candidateFixture} from './prepared-candidate-fixture.mjs';

function product(){
 const configuration=structuredClone(candidateFixture().configuration);
 configuration.privateHttp={hostname:'0.0.0.0',port:8082,frontendOrigin:configuration.native.origin};
 configuration.nativeCandidate.multiRun={runWindowMs:600000,materialDirectory:'/run/meri/material',dynamicInitialRuns:true};
 configuration.nativeCandidate.taskOrigin=configuration.native.origin;
 configuration.nativeCandidate.taskHttp.frontendOrigin=configuration.native.origin;
 configuration.taskRouter={enabled:true,runnerCaFile:'/run/meri/runner-ca.pem',zone:'runner.internal.example',vpcId:'vpc-abc123'};
 return configuration;
}

test('task router opt-in derives one pinned task network from the issued task request',()=>{
 const c=product(),plan=compileControlTaskRouterConfiguration(c);
 assert.equal(plan.runnerCaFile,c.taskRouter.runnerCaFile);
 assert.equal(plan.zone,c.taskRouter.zone);
 assert.deepEqual(plan.network,{clusterArn:c.nativeCandidate.taskRequest.cluster,taskDefinitionArn:c.nativeCandidate.taskRequest.taskDefinition,
  vpcId:c.taskRouter.vpcId,subnetId:'subnet-1234',securityGroupIds:['sg-1234']});
});
test('router refuses a shared origin, ambiguous task network or incomplete private listener before startup effects',()=>{
 const changes=[
  c=>delete c.privateHttp,
  c=>c.privateHttp.port=8080,
  c=>delete c.nativeCandidate.multiRun,
  c=>c.nativeCandidate.taskOrigin='https://task.synthetic.invalid',
  c=>c.nativeCandidate.taskRequest.networkConfiguration.awsvpcConfiguration.subnets.push('subnet-5678'),
  c=>c.nativeCandidate.taskRequest.networkConfiguration.awsvpcConfiguration.securityGroups.push('sg-1234'),
  c=>c.nativeCandidate.taskRequest.networkConfiguration.awsvpcConfiguration.assignPublicIp='ENABLED',
  c=>c.nativeCandidate.taskHttp.port=8081,
  c=>c.taskRouter.zone='task.invalid:443',
  c=>c.taskRouter.extra=true,
 ];
 for(const change of changes){const c=product();change(c);assert.throws(()=>compileControlTaskRouterConfiguration(c));}
 assert.equal(compileControlTaskRouterConfiguration(candidateFixture().configuration),null);
});
