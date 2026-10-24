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
 secretKmsKeyArns:Object.fromEntries(FOUNDATION_SECRET_ROLES.map(k=>[k,k==='migrator'?['arn:aws:kms:us-east-1:967807252336:key/efe8a18d-192e-4f30-8eea-b3f65ae7755e']:[]]))});
const ofType=(t,type)=>Object.entries(t.Resources).filter(([,r])=>r.Type===type);

test('closed binding refuses foreign accounts, clusters, extra keys, wildcard secrets and shared SG reuse',()=>{
 assert.ok(validateFoundationBinding(foundationBinding()));
 for(const change of [b=>{b.account='111111111111';},b=>{b.clusterArn=b.clusterArn.replace('capiro-dev','other');},b=>{b.extra=1;},
  b=>{b.secretArns.control=['arn:aws:secretsmanager:us-east-1:967807252336:secret:*'];},b=>{b.auroraSecurityGroupId=b.albSecurityGroupId;},
  b=>{b.bedrock={};},b=>{delete b.secretArns.migrator;},
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
 assert.equal(sgs.length,4);assert.ok(sgs.every(p=>!(p.SecurityGroupEgress||[]).some(e=>e.CidrIp==='0.0.0.0/0'&&e.IpProtocol==='-1')),'no allow-all egress');
});

test('D6 NAT 443 egress exists only on control, worker and the one-shot migrator',()=>{
 const t=synthesizeFirstChatFoundation(foundationBinding());
 // CDK inlines CIDR egress on the group itself; separate egress resources only reference groups or prefix lists.
 assert.ok(ofType(t,'AWS::EC2::SecurityGroupEgress').every(([,r])=>r.Properties.CidrIp===undefined));
 const anywhere=ofType(t,'AWS::EC2::SecurityGroup').flatMap(([id,r])=>(r.Properties.SecurityGroupEgress||[]).filter(e=>e.CidrIp==='0.0.0.0/0').map(e=>({id,...e})));
 assert.equal(anywhere.length,3);assert.ok(anywhere.every(p=>p.FromPort===443&&p.ToPort===443&&p.IpProtocol==='tcp'));
 assert.deepEqual(anywhere.map(p=>p.id.replace(/Sg[A-F0-9]+$/u,'')).sort(),['Control','Migrator','Worker']);
});

test('IAM retains storage and Temporal service identity without ECS runner or model execution permissions',()=>{
 const t=synthesizeFirstChatFoundation(foundationBinding());
 const roles=ofType(t,'AWS::IAM::Role').map(([,r])=>r.Properties.RoleName);
 assert.equal(roles.length,10);assert.ok(!roles.some(role=>/MeriPreview-(runner|owner|proxy|issuer)-/.test(role)));
 const policies=ofType(t,'AWS::IAM::Policy').map(([,r])=>r.Properties);
 const control=policies.find(p=>JSON.stringify(p.Roles).includes('controlTaskRole')).PolicyDocument.Statement;
 const controlActions=control.flatMap(s=>[].concat(s.Action));
 assert.ok(controlActions.includes('s3:GetObjectVersion'));
 assert.ok(controlActions.includes('s3:ListBucket'));
 assert.deepEqual(control.filter(s=>[].concat(s.Action).includes('s3:ListBucket')).map(s=>s.Resource),[`arn:aws:s3:::${foundationBinding().checkpoint.bucket}`]);
 assert.ok(controlActions.includes('kms:Decrypt'));
 assert.ok(controlActions.every(action=>!action.startsWith('ecs:')&&!action.startsWith('bedrock:')&&action!=='iam:PassRole'));
 assert.ok(policies.every(p=>p.PolicyDocument.Statement.every(s=>![].concat(s.Action).some(a=>['ecs:RunTask','ecs:StopTask','iam:PassRole'].includes(a)))));
 for(const p of policies)for(const s of p.PolicyDocument.Statement){
  if(s.Resource==='*')assert.ok([].concat(s.Action).every(a=>['ecr:GetAuthorizationToken','ecs:ListTasks','ecs:DescribeTaskDefinition','ec2:DescribeNetworkInterfaces'].includes(a)),`wildcard only for read actions without resource scope: ${s.Action}`);
  assert.ok(![].concat(s.Action).some(a=>a.endsWith(':*')||a==='*'),'no action wildcards');
 }
});

test('native TLS removes issuer signing, service discovery and network resources while retaining control',()=>{
 const t=synthesizeFirstChatFoundation(foundationBinding());
 assert.equal(ofType(t,'AWS::KMS::Key').length,0);assert.equal(ofType(t,'AWS::KMS::Alias').length,0);
 assert.doesNotMatch(JSON.stringify(t.Resources),/Issuer|issuer|8445|kms:Sign/);
 const [[,tg]]=ofType(t,'AWS::ElasticLoadBalancingV2::TargetGroup');assert.equal(tg.Properties.HealthCheckPath,'/health/live');assert.equal(tg.Properties.Port,8080);
 assert.equal(ofType(t,'AWS::ServiceDiscovery::Service').length,1);
 assert.ok(ofType(t,'AWS::Logs::LogGroup').every(([,r])=>r.DeletionPolicy==='Retain'));
 for(const field of ['secretArns','secretKmsKeyArns']){const input=foundationBinding();input[field].issuer=[];
  assert.throws(()=>validateFoundationBinding(input),/FIRST_CHAT_FOUNDATION_BINDING_REFUSED/);}
});

test('no control-to-runner receiver or obsolete runner resource survives synthesis',()=>{
 const t=synthesizeFirstChatFoundation(foundationBinding());
 assert.doesNotMatch(JSON.stringify(t),/RunnerSg|runnerTaskRole|runnerExecutionRole|meri-preview-runner|meri-product-preview-runner/);
 const egress=ofType(t,'AWS::EC2::SecurityGroupEgress').filter(([,r])=>r.Properties.FromPort===8080);
 const ingress=ofType(t,'AWS::EC2::SecurityGroupIngress').filter(([,r])=>r.Properties.FromPort===8080);
 assert.equal(egress.length,0);
 assert.equal(ingress.length,1);assert.equal(ingress[0][1].Properties.SourceSecurityGroupId,'sg-0dc7236a6d67e4340');
});
