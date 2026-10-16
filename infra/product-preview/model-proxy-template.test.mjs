import test from 'node:test';
import assert from 'node:assert/strict';
import {synthesizeDisabledModelProxyTemplate} from './model-proxy-template.mjs';

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

test('template is unsatisfiably disabled and describes private TCP resource path',()=>{
 const template=synthesizeDisabledModelProxyTemplate(binding());
 assert.deepEqual(template.Conditions.ProductProxyDisabled,{'Fn::Equals':['false','true']});
 for(const value of Object.values(template.Resources))
  assert.equal(value.Condition,'ProductProxyDisabled');
 const resources=template.Resources;
 assert.equal(resources.ModelProxyNlb.Properties.Scheme,'internal');
 assert.equal(resources.ModelProxyTcpListener.Properties.Protocol,'TCP');
 assert.equal(resources.ModelProxyTargetGroup.Properties.TargetGroupAttributes[0].Value,'true');
 assert.equal(resources.ModelProxyBedrockEndpoint.Properties.PrivateDnsEnabled,true);
 assert.equal(resources.ModelProxyS3Gateway.Properties.VpcEndpointType,'Gateway');
 assert.equal(resources.ModelProxyS3Gateway.Properties.RouteTableIds.length,2);
 assert.equal(resources.ModelProxyS3LayerEgress.Properties.DestinationPrefixListId,
  binding().network.s3PrefixListId);
 assert.equal(resources.ModelProxyService.Properties.DesiredCount,0);
 assert.equal(resources.ModelProxyService.Properties.NetworkConfiguration.AwsvpcConfiguration.AssignPublicIp,'DISABLED');
 assert.equal(resources.ModelProxyTask.Properties.ContainerDefinitions[0].ReadonlyRootFilesystem,true);
 assert.equal(resources.ModelProxyTask.Properties.ContainerDefinitions[0].Image,binding().image.uri);
  assert.deepEqual(resources.ModelProxyTask.Properties.ContainerDefinitions[0].Secrets.map(s=>s.Name),
   ['CAPIRO_PROXY_SERVER_TLS','CAPIRO_PROXY_OWNER_CLIENT']);
  assert.equal(resources.ModelProxyExecutionPolicy.Properties.PolicyDocument.Statement.at(-1).Resource.length,2);
  assert.equal(JSON.stringify(template).includes('RUNNER_CA'),false);
 assert.equal(resources.ModelProxyProviderPolicy.Properties.Roles[0],'proxy-bedrock');
 assert.equal(resources.ModelProxyExecutionPolicy.Properties.Roles[0],'proxy-execution');
 assert.equal(Object.values(resources).filter(value=>value.Type==='AWS::EC2::SecurityGroupIngress').length,8);
 assert.equal(Object.values(resources).filter(value=>value.Type==='AWS::EC2::SecurityGroupEgress').length,9);
 const ingress=Object.values(resources).filter(value=>value.Type==='AWS::EC2::SecurityGroupIngress')
  .map(({Properties:p})=>`${p.SourceSecurityGroupId}:${p.GroupId}:${p.FromPort}`);
 const egress=Object.values(resources).filter(value=>value.Type==='AWS::EC2::SecurityGroupEgress'
   &&value.Properties.DestinationSecurityGroupId)
  .map(({Properties:p})=>`${p.GroupId}:${p.DestinationSecurityGroupId}:${p.FromPort}`);
 assert.deepEqual(ingress.sort(),egress.sort());
 assert.deepEqual(template.Outputs,{});
});

test('active input or wrong reviewed image cannot synthesize disabled resources',()=>{
 const active=binding();active.enabled=true;
 assert.throws(()=>synthesizeDisabledModelProxyTemplate(active),/PRODUCT_MODEL_PROXY_BINDING_REFUSED/);
 const wrong=binding();wrong.image.upstreamDigest='sha256:'+sha;
 assert.throws(()=>synthesizeDisabledModelProxyTemplate(wrong),/PRODUCT_MODEL_PROXY_BINDING_REFUSED/);
});
