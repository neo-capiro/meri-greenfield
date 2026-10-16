import test from 'node:test';
import assert from 'node:assert/strict';
import {planPrivateModelProxy} from './model-proxy-plan.mjs';

const sha='a'.repeat(64);
const secret=name=>({valueFrom:`arn:aws:secretsmanager:us-east-1:967807252336:secret:${name}:::${'a'.repeat(32)}`,
 contentSha256:sha});
function binding(){return {schema:'meri.product-model-proxy.plan/1',enabled:false,
 account:'967807252336',region:'us-east-1',
 placement:{vpcId:'vpc-0ac26cfac7ed972be',
  clusterArn:'arn:aws:ecs:us-east-1:967807252336:cluster/capiro-dev',
  privateSubnetIds:['subnet-0920665f91c905f01','subnet-0e38bd390f8961fef']},
 image:{uri:`967807252336.dkr.ecr.us-east-1.amazonaws.com/meri-model-proxy@sha256:${sha}`,
  sourceCommit:'b'.repeat(40),litellmVersion:'1.104.2',
  upstreamDigest:'sha256:3d88bd757134a00e8c00237b85a021ab1f6d54abb9c1df750f411dbe7256a500',
  reviewedScanSha256:sha},
 roles:{executionRoleArn:'arn:aws:iam::967807252336:role/proxy-execution',
  proxyTaskRoleArn:'arn:aws:iam::967807252336:role/proxy-bedrock',
  runnerTaskRoleArn:'arn:aws:iam::967807252336:role/runner-no-bedrock'},
 network:{runnerSecurityGroupIds:['sg-11111111111111111'],nlbSecurityGroupId:'sg-22222222222222222',
  proxySecurityGroupId:'sg-33333333333333333',ownerSecurityGroupId:'sg-44444444444444444',
  bedrockEndpointSecurityGroupId:'sg-55555555555555555',
  platformEndpointSecurityGroupIds:['sg-66666666666666666','sg-77777777777777777',
   'sg-88888888888888888','sg-99999999999999999'],
  privateSubnetRouteTables:{'subnet-0920665f91c905f01':'rtb-aaaaaaaaaaaaaaaaa',
   'subnet-0e38bd390f8961fef':'rtb-bbbbbbbbbbbbbbbbb'},
  s3PrefixListId:'pl-aaaaaaaaaaaaaaaaa'},
  material:{serverTls:secret('model-proxy-server'),ownerBridgeClient:secret('model-owner-client')},
 owner:{fixedOrigin:'https://model-owner.meri-native.capiro.ai:8444',
  currentRunPort:'authenticated-private-bridge',budgetNamespace:'meri_product_budget'}};}

test('disabled plan fixes server TLS and task-bound bearer, one budget owner and bounded provider role',()=>{
 const plan=planPrivateModelProxy(binding());
 assert.equal(plan.enabled,false);
 assert.equal(plan.placement.taskDesiredCount,0);
 assert.equal(plan.listener.protocol,'TCP');
 assert.equal(plan.listener.preserveClientIp,true);
 assert.equal(plan.listener.tlsTermination,'proxy-task-only');
  assert.deepEqual(plan.listener.admissionProof,{
   bearer:'opaque-task-bound-sha256',source:'direct-tls-socket-ipv4',
   lease:'fresh-ecs-task-eni-current-join',recheck:['before-admission','before-provider-send']});
  assert.deepEqual(Object.keys(plan.material).sort(),['ownerBridgeClient','serverTls']);
 assert.deepEqual(plan.routes.worker,['POST /v1/messages?beta=true',
                                     'POST /v1/messages/count_tokens?beta=true']);
 assert.deepEqual(plan.routes.public,[]);
 assert.deepEqual(plan.iam.runnerProviderActions,[]);
 assert.equal(plan.owner.budgetNamespace,'meri_product_budget');
 assert.equal(plan.network.requiresNoNatModelEgress,true);
 assert.equal(plan.iam.proxyRole.foundations.length,3);
 assert.equal(plan.network.platformEndpointServices.length,4);
 assert.equal(plan.network.s3LayerPath.routeTableIds.length,2);
});

test('wrong image, owner, credential and identity boundaries refuse synthesis',()=>{
 const changes=[
  b=>{b.enabled=true;},b=>{b.image.uri='ghcr.io/berriai/litellm:latest';},
  b=>{b.image.litellmVersion='latest';},
  b=>{b.roles.proxyTaskRoleArn=b.roles.runnerTaskRoleArn;},
  b=>{b.network.proxySecurityGroupId=b.network.runnerSecurityGroupIds[0];},
  b=>{b.network.nlbSecurityGroupId=b.network.runnerSecurityGroupIds[0];},
  b=>{b.network.platformEndpointSecurityGroupIds[0]=b.network.proxySecurityGroupId;},
  b=>{delete b.network.privateSubnetRouteTables['subnet-0920665f91c905f01'];},
  b=>{b.network.s3PrefixListId='pl-unreviewed';},
   b=>{b.material.runnerClientCa=secret('legacy-runner-ca');},
  b=>{b.material.ownerBridgeClient=b.material.serverTls;},
  b=>{b.owner.budgetNamespace='qualification';},
  b=>{b.owner.fixedOrigin='http://untrusted.example:8444';},
  b=>{b.placement.privateSubnetIds=[b.placement.privateSubnetIds[0]];},
 ];
 for(const change of changes){
  const b=binding();change(b);
  assert.throws(()=>planPrivateModelProxy(b),/PRODUCT_MODEL_PROXY_BINDING_REFUSED/);
 }
});
