import test from 'node:test';
import assert from 'node:assert/strict';
import {planPrivateModelProxy,MODEL_PROXY_EXISTING} from './model-proxy-plan.mjs';
import {binding,reseal,sha} from './model-proxy-test-fixture.mjs';

test('plan fixes direct Cloud Map transport, NAT Bedrock path, reused S3 gateway and one budget owner',()=>{
 const b=binding(),plan=planPrivateModelProxy(b);
 assert.equal(plan.desiredCount,0);
 assert.equal(plan.listener.transport,'direct-tcp');
 assert.equal(plan.listener.loadBalancer,null);
 assert.equal(plan.listener.port,8443);assert.equal(plan.listener.name,'proxy.meri.internal');
 assert.equal(plan.listener.tlsTermination,'proxy-task-only');
 assert.deepEqual(plan.listener.admissionProof,{
  bearer:'opaque-task-bound-sha256',source:'direct-tls-socket-ipv4',
  lease:'fresh-ecs-task-eni-current-join',recheck:['before-admission','before-provider-send']});
 assert.deepEqual(plan.network.bedrockPath,{kind:'nat',port:443});
 assert.deepEqual(plan.network.s3Gateway,{endpointId:'vpce-0cdaa6b79d616aa1c',prefixListId:'pl-63a5400a',reused:true});
 assert.equal(plan.services.proxy.runtimeUser,'10001:10001');
 assert.equal(plan.services.owner.runtimeUser,'1000:1000');
 assert.equal(plan.services.proxy.origin,'https://proxy.meri.internal:8443');
 assert.equal(plan.owner.origin,'https://owner.meri.internal:8444');
 assert.deepEqual(plan.services.proxy.securityGroupIds,[b.network.proxySecurityGroupId]);
 assert.deepEqual(plan.services.owner.securityGroupIds,[b.network.ownerSecurityGroupId,b.network.dbClientSecurityGroupId]);
 assert.equal(plan.services.owner.image,b.images.nodeRuntime.uri);
 assert.equal(plan.services.proxy.initImage,b.images.nodeRuntime.uri);
 assert.equal(plan.owner.budgetNamespace,'meri_product_budget');
 assert.deepEqual(plan.routes.worker,['POST /v1/messages?beta=true','POST /v1/messages/count_tokens?beta=true']);
 assert.deepEqual(plan.routes.public,[]);
 assert.deepEqual(plan.iam.runnerProviderActions,[]);
 assert.equal(plan.iam.proxyRole.foundations.length,3);
 assert.equal(JSON.stringify(plan).includes('GetInferenceProfile'),false);
 assert.deepEqual(plan.iam.observer.describeServices,[
  'arn:aws:ecs:us-east-1:967807252336:service/capiro-dev/meri-product-preview-proxy',
  'arn:aws:ecs:us-east-1:967807252336:service/capiro-dev/meri-product-preview-owner']);
 assert.equal(plan.iam.observer.describeTasks,'arn:aws:ecs:us-east-1:967807252336:task/capiro-dev/*');
 assert.deepEqual(plan.iam.observer.listTasks.condition,{ArnEquals:{'ecs:cluster':MODEL_PROXY_EXISTING.clusterArn}});
 assert(Object.isFrozen(plan.services.proxy.material.expected));
});

test('foundation-owned rules: runner 8443, proxy to owner 8444, endpoints, S3, NAT 443 and Aurora via the marker',()=>{
 const b=binding(),n=b.network,rules=planPrivateModelProxy(b).network.foundationOwnedRules;
 const key=r=>`${r.groupId}:${r.port}:${r.sourceSecurityGroupId??r.destinationSecurityGroupId??r.destinationPrefixListId??r.cidrIp}`;
 assert.deepEqual(rules.ingress.map(key).sort(),[
  `${n.proxySecurityGroupId}:8443:${n.runnerSecurityGroupIds[0]}`,
  `${n.ownerSecurityGroupId}:8444:${n.proxySecurityGroupId}`,
  `sg-059b4e4de0b1dcca5:5432:${n.dbClientSecurityGroupId}`].sort());
 assert.deepEqual(rules.egress.map(key).sort(),[
  `${n.runnerSecurityGroupIds[0]}:8443:${n.proxySecurityGroupId}`,
  `${n.proxySecurityGroupId}:8444:${n.ownerSecurityGroupId}`,
  `${n.proxySecurityGroupId}:443:sg-01def4e5c0fe44d4a`,`${n.proxySecurityGroupId}:443:pl-63a5400a`,
  `${n.ownerSecurityGroupId}:443:sg-01def4e5c0fe44d4a`,`${n.ownerSecurityGroupId}:443:pl-63a5400a`,
  `${n.proxySecurityGroupId}:443:0.0.0.0/0`,`${n.ownerSecurityGroupId}:443:0.0.0.0/0`,
  `${n.ownerSecurityGroupId}:5432:sg-059b4e4de0b1dcca5`].sort());
 assert(rules.ingress.concat(rules.egress).every(r=>r.protocol==='tcp'));
 assert(!rules.egress.some(r=>r.port===8443&&r.groupId!==n.runnerSecurityGroupIds[0]));
});

test('an existing bedrock-runtime endpoint adds an endpoint path; NAT 443 stays for the ECS/EC2 API',()=>{
 const b=binding();b.network.bedrockRuntimeEndpoint={endpointId:'vpce-0123456789abcdef0',securityGroupId:'sg-01def4e5c0fe44d4a'};
 const plan=planPrivateModelProxy(b);
 assert.equal(plan.network.bedrockPath.kind,'interface-endpoint');
 assert(plan.network.foundationOwnedRules.egress.some(r=>r.groupId===b.network.proxySecurityGroupId&&r.cidrIp==='0.0.0.0/0'&&
  r.purpose==='ECS/EC2 API via NAT (no ECS endpoint)'));
 assert(plan.network.foundationOwnedRules.egress.some(r=>r.purpose==='bedrock-runtime endpoint'));
 assert(plan.network.foundationOwnedRules.ingress.some(r=>r.groupId==='sg-01def4e5c0fe44d4a'&&r.sourceSecurityGroupId===b.network.proxySecurityGroupId));
});

test('wrong image, owner, credential, placement and identity boundaries refuse',()=>{
 const changes=[
  b=>{b.enabled=false;},b=>{b.schema='meri.product-model-proxy.plan/1';},
  b=>{b.image=b.images.proxy;},
  b=>{b.images.proxy.uri='ghcr.io/berriai/litellm:latest';},
  b=>{b.images.proxy.uri=b.images.proxy.uri.replace('@sha256:',':');},
  b=>{b.images.proxy.litellmVersion='latest';},
  b=>{b.images.proxy.upstreamDigest='sha256:'+sha('0');},
  b=>{b.images.proxy.uri=b.images.nodeRuntime.uri;},
  b=>{b.images.nodeRuntime.sourceCommit='HEAD';},
  b=>{b.roles.proxyTaskRoleArn=b.roles.ownerTaskRoleArn;},
  b=>{b.roles.ownerExecutionRoleArn=b.roles.proxyExecutionRoleArn;},
  b=>{b.roles.runnerTaskRoleArn='arn:aws:iam::967807252336:role/runner';},
  b=>{b.logGroups.owner=b.logGroups.proxy;},
  b=>{b.serviceDiscovery.ownerRegistryArn=b.serviceDiscovery.proxyRegistryArn;},
  b=>{b.serviceDiscovery.proxyRegistryArn='arn:aws:servicediscovery:us-east-1:000000000000:service/srv-aaaaaaaaaaaaaaaa';},
  b=>{b.network.proxySecurityGroupId=b.network.runnerSecurityGroupIds[0];},
  b=>{b.network.ownerSecurityGroupId=b.network.dbClientSecurityGroupId;},
  b=>{b.network.dbClientSecurityGroupId='sg-059b4e4de0b1dcca5';},
  b=>{b.network.proxySecurityGroupId=b.network.endpointSecurityGroupId;},
  b=>{b.network.nlbSecurityGroupId='sg-0aaaaaaaaaaaaaaa9';},
  b=>{b.network.s3Gateway.endpointId='vpce-0123456789abcdef0';},
  b=>{b.network.s3Gateway.prefixListId='pl-unreviewed';},
  b=>{delete b.network.bedrockRuntimeEndpoint;},
  b=>{b.network.bedrockRuntimeEndpoint={endpointId:'vpce-0123456789abcdef0',securityGroupId:b.network.proxySecurityGroupId};},
  b=>{b.network.runnerSecurityGroupIds=[];},
  b=>{b.placement.vpcId='vpc-1234abcd';},
  b=>{b.placement.clusterArn='arn:aws:ecs:us-east-1:967807252336:cluster/meri-product-preview';},
  b=>{b.placement.privateSubnetIds=[b.placement.privateSubnetIds[0]];},
  b=>{b.material.owner.valueFrom=b.material.proxy.valueFrom;},
  b=>{b.material.owner.valueFrom=b.material.proxy.valueFrom.replace(/:::.*$/u,':::'+'9'.repeat(32));},
  b=>{b.material.proxy.valueFrom=b.material.proxy.valueFrom.replace(/:::.*$/u,'');},
  b=>{b.material.proxy.runnerClientCa={};},
  b=>{b.material.proxy.expected.runtimeUser='1000:1000';},
  b=>{b.material.proxy.expected=reseal({...b.material.proxy.expected,runtimeUser:'1000:1000'});},
  b=>{b.material.proxy.expected=reseal({...b.material.proxy.expected,role:'control'});},
  b=>{b.material.owner.expected=reseal({...b.material.owner.expected,imageDigest:b.material.proxy.expected.imageDigest});},
  b=>{b.material.owner.expected=reseal({...b.material.owner.expected,sourceCommit:'c'.repeat(40)});},
  b=>{b.material.proxy.expected=reseal({...b.material.proxy.expected,sha256ByPath:{...b.material.proxy.expected.sha256ByPath,'/run/meri/proxy.json':sha('9')}});},
  b=>{b.material.proxy.expected=reseal({...b.material.proxy.expected,sha256ByPath:{'/tmp/proxy.json':b.startup.proxyConfigSha256}});},
  b=>{b.material.proxy.expected=reseal({...b.material.proxy.expected,sha256ByPath:{...b.material.proxy.expected.sha256ByPath,'/run/meri/..':sha('1')}});},
  b=>{b.material.proxy.expected.materialContractSha256=sha('0');},
  b=>{b.startup.ownerConfigSha256=b.startup.proxyConfigSha256;},
  b=>{b.startup.proxyConfigSha256='';},
  b=>{b.owner.budgetNamespace='qualification';},
  b=>{b.owner.fixedOrigin='https://owner.meri.internal:8444';},
  b=>{b.account='000000000000';},
 ];
 for(const change of changes){
  const b=binding();change(b);
  assert.throws(()=>planPrivateModelProxy(b),/PRODUCT_MODEL_PROXY_BINDING_REFUSED/);
 }
});
