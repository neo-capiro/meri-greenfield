import test from 'node:test';
import assert from 'node:assert/strict';
import {synthesizeFirstChatFoundation,validateFoundationBinding,FOUNDATION_SECRET_ROLES} from './first-chat-foundation.mjs';

const secret=n=>[`arn:aws:secretsmanager:us-east-1:967807252336:secret:meri/preview/${n}-AbCdEf`];
export const foundationBinding=()=>({account:'967807252336',region:'us-east-1',vpcId:'vpc-0ac26cfac7ed972be',vpcCidr:'10.40.0.0/16',
 privateSubnetIds:['subnet-0920665f91c905f01','subnet-0e38bd390f8961fef','subnet-06db79cd21239de19'],
 clusterArn:'arn:aws:ecs:us-east-1:967807252336:cluster/capiro-dev',ecrRepositoryArn:'arn:aws:ecr:us-east-1:967807252336:repository/meri-greenfield/qualification-worker',
 albSecurityGroupId:'sg-0dc7236a6d67e4340',auroraSecurityGroupId:'sg-059b4e4de0b1dcca5',endpointSecurityGroupId:'sg-01def4e5c0fe44d4a',s3PrefixListId:'pl-63a5400a',
 checkpoint:{bucket:'meri-greenfield-qual-checkpoint-967807252336-us-east-1',prefix:'product-preview/checkpoints',kmsKeyArn:'arn:aws:kms:us-east-1:967807252336:key/3a04f062-40de-4ed8-9a24-dad87c488e0c'},
 secretArns:Object.fromEntries(FOUNDATION_SECRET_ROLES.map(k=>[k,secret(k)])),
 secretKmsKeyArns:Object.fromEntries(FOUNDATION_SECRET_ROLES.map(k=>[k,k==='migrator'?['arn:aws:kms:us-east-1:967807252336:key/efe8a18d-192e-4f30-8eea-b3f65ae7755e']:[]])),
 bedrock:{inferenceProfileArn:'arn:aws:bedrock:us-east-1:967807252336:inference-profile/us.anthropic.claude-sonnet-4-6',
  foundationModelArns:['us-east-1','us-east-2','us-west-2'].map(r=>`arn:aws:bedrock:${r}::foundation-model/anthropic.claude-sonnet-4-6`),
  countTokensModelArn:'arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-sonnet-4-6'}});
const ofType=(t,type)=>Object.entries(t.Resources).filter(([,r])=>r.Type===type);

test('closed binding refuses foreign accounts, clusters, extra keys, wildcard secrets and shared SG reuse',()=>{
 assert.ok(validateFoundationBinding(foundationBinding()));
 for(const change of [b=>{b.account='111111111111';},b=>{b.clusterArn=b.clusterArn.replace('capiro-dev','other');},b=>{b.extra=1;},
  b=>{b.secretArns.control=['arn:aws:secretsmanager:us-east-1:967807252336:secret:*'];},b=>{b.auroraSecurityGroupId=b.albSecurityGroupId;},
  b=>{b.bedrock.countTokensModelArn='arn:aws:bedrock:us-east-1::foundation-model/anthropic.other';},b=>{delete b.secretArns.migrator;},
  b=>{b.checkpoint.prefix='/leading';},b=>{b.secretKmsKeyArns.control=['*'];}]){const b=foundationBinding();change(b);assert.throws(()=>validateFoundationBinding(b),/FIRST_CHAT_FOUNDATION_BINDING_REFUSED/);}
});

test('only the shared Aurora SG is touched, by one marker-sourced 5432 rule; public ingress only ALB to control 8080',()=>{
 const t=synthesizeFirstChatFoundation(foundationBinding());
 const ingress=ofType(t,'AWS::EC2::SecurityGroupIngress').map(([,r])=>r.Properties);
 const onShared=ingress.filter(p=>typeof p.GroupId==='string');
 assert.equal(onShared.length,1);assert.equal(onShared[0].GroupId,'sg-059b4e4de0b1dcca5');assert.equal(onShared[0].FromPort,5432);
 assert.ok(ingress.every(p=>p.CidrIp===undefined),'no CIDR ingress anywhere');
 assert.deepEqual(ingress.filter(p=>p.SourceSecurityGroupId==='sg-0dc7236a6d67e4340').map(p=>[p.FromPort,p.ToPort]),[[8080,8080]]);
 const sgs=ofType(t,'AWS::EC2::SecurityGroup').map(([,r])=>r.Properties);
 assert.equal(sgs.length,9);assert.ok(sgs.every(p=>!(p.SecurityGroupEgress||[]).some(e=>e.CidrIp==='0.0.0.0/0'&&e.IpProtocol==='-1')),'no allow-all egress');
});

test('D6 NAT 443 egress exists only on control, worker, issuer, owner, proxy and the one-shot migrator',()=>{
 const t=synthesizeFirstChatFoundation(foundationBinding());
 // CDK inlines CIDR egress on the group itself; separate egress resources only reference groups or prefix lists.
 assert.ok(ofType(t,'AWS::EC2::SecurityGroupEgress').every(([,r])=>r.Properties.CidrIp===undefined));
 const anywhere=ofType(t,'AWS::EC2::SecurityGroup').flatMap(([id,r])=>(r.Properties.SecurityGroupEgress||[]).filter(e=>e.CidrIp==='0.0.0.0/0').map(e=>({id,...e})));
 assert.equal(anywhere.length,6);assert.ok(anywhere.every(p=>p.FromPort===443&&p.ToPort===443&&p.IpProtocol==='tcp'));
 assert.deepEqual(anywhere.map(p=>p.id.replace(/Sg[A-F0-9]+$/u,'')).sort(),['Control','Issuer','Migrator','Owner','Proxy','Worker']);
});

test('IAM: runner has no task role; control may run only the runner family with the four required tags and pass only the runner execution role',()=>{
 const t=synthesizeFirstChatFoundation(foundationBinding());
 const roles=ofType(t,'AWS::IAM::Role').map(([,r])=>r.Properties.RoleName);
 assert.ok(!roles.includes('MeriPreview-runner-task'));assert.ok(roles.includes('MeriPreview-runner-execution'));assert.equal(roles.length,17);
 const policies=ofType(t,'AWS::IAM::Policy').map(([,r])=>r.Properties);
 const control=policies.find(p=>JSON.stringify(p.Roles).includes('controlTaskRole')).PolicyDocument.Statement;
 const run=control.find(s=>s.Action==='ecs:RunTask');
 assert.equal(run.Resource,'arn:aws:ecs:us-east-1:967807252336:task-definition/meri-product-preview-runner:*');
 assert.deepEqual(run.Condition['ForAllValues:StringEquals']['aws:TagKeys'],['meri:execution-id','meri:binding-sha256','meri:plan-sha256','meri:expires-at-ms']);
 const pass=control.find(s=>s.Action==='iam:PassRole');assert.deepEqual(pass.Condition,{StringEquals:{'iam:PassedToService':'ecs-tasks.amazonaws.com'}});
 assert.ok(JSON.stringify(pass.Resource).includes('runnerExecutionRole'));
 for(const p of policies)for(const s of p.PolicyDocument.Statement){
  if(s.Resource==='*')assert.ok([].concat(s.Action).every(a=>['ecr:GetAuthorizationToken','ecs:ListTasks','ecs:DescribeTaskDefinition','ec2:DescribeNetworkInterfaces'].includes(a)),`wildcard only for read actions without resource scope: ${s.Action}`);
  assert.ok(![].concat(s.Action).some(a=>a.endsWith(':*')||a==='*'),'no action wildcards');
 }
});

test('signing key is RSA-2048 sign-only, retained, and only the issuer task role may sign digests',()=>{
 const t=synthesizeFirstChatFoundation(foundationBinding());const [[,key]]=ofType(t,'AWS::KMS::Key');
 assert.equal(key.DeletionPolicy,'Retain');assert.equal(key.Properties.KeySpec,'RSA_2048');assert.equal(key.Properties.KeyUsage,'SIGN_VERIFY');
 const sign=key.Properties.KeyPolicy.Statement.find(s=>s.Sid==='IssuerSign');
 assert.deepEqual(sign.Condition,{StringEquals:{'kms:SigningAlgorithm':'RSASSA_PKCS1_V1_5_SHA_256','kms:MessageType':'DIGEST'}});
 assert.ok(JSON.stringify(sign.Principal).includes('issuerTaskRole'));
 const [[,tg]]=ofType(t,'AWS::ElasticLoadBalancingV2::TargetGroup');assert.equal(tg.Properties.HealthCheckPath,'/health/live');assert.equal(tg.Properties.Port,8080);
 assert.equal(ofType(t,'AWS::ServiceDiscovery::Service').length,4);
});
