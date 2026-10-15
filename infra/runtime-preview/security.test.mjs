import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {buildTemplates} from './app.mjs';
import {validateParameters} from './parameters.mjs';
import {appendPolicy,checkpointPolicyStatements} from './policy-patches.mjs';
import {buildActionBundle} from './action-bundle.mjs';
import {templateBytes} from './common.mjs';
const templates=buildTemplates(),foundation=templates['MeriRuntime-Preview-Foundations'],data=templates['MeriRuntime-Preview-Data'],services=templates['MeriRuntime-Preview-Services'];
const resources=t=>Object.values(t.Resources);
const hash=b=>createHash('sha256').update(b).digest('hex');

test('synthesis is deterministic and contains no custom executor or production foundation replacement',()=>{
  assert.deepEqual(buildTemplates(),templates);
  const all=Object.values(templates).flatMap(resources);
  for(const type of ['AWS::EC2::VPC','AWS::ECS::Cluster','AWS::ECR::Repository','AWS::S3::Bucket','AWS::EC2::NatGateway','AWS::Lambda::Function','AWS::StepFunctions::StateMachine','AWS::PCA::CertificateAuthority'])assert.ok(!all.some(r=>r.Type===type),type);
  assert.ok(all.every(r=>!r.Type.startsWith('Custom::')));
  assert.ok(Object.values(templates).every(t=>templateBytes(t).byteLength<=51200),'offline file-body templates fit ValidateTemplate limit');
  for(const t of Object.values(templates)){assert.equal(t.Rules.AccountAndRegion.Assertions.length,2);assert.equal(t.Parameters.ExpectedAccountId.NoEcho,true);}
});

test('zero service activation, no runner service/schedule, original roleless task and explicit execution roles',()=>{
  const list=resources(services).filter(r=>r.Type==='AWS::ECS::Service');assert.equal(list.length,5);assert.ok(list.every(r=>r.Properties.DesiredCount===0&&r.Properties.EnableExecuteCommand===false));
  assert.equal(services.Resources.RunnerService,undefined);
  for(const name of ['Runner','Poller','Temporal','Relay'])assert.equal(services.Resources[name+'Definition'].Properties.TaskRoleArn,undefined);
  for(const name of ['Control','Proxy'])assert.ok(services.Resources[name+'Definition'].Properties.TaskRoleArn);
  for(const r of resources(services).filter(r=>r.Type==='AWS::ECS::TaskDefinition')){
    assert.deepEqual(r.Properties.RequiresCompatibilities,['FARGATE']);assert.equal(r.Properties.NetworkMode,'awsvpc');
    for(const c of r.Properties.ContainerDefinitions){assert.equal(c.Privileged,false);assert.equal(c.ReadonlyRootFilesystem,true);assert.deepEqual(c.LinuxParameters.Capabilities.Drop,['ALL']);assert.equal(c.LinuxParameters.InitProcessEnabled,true);assert.ok(c.User);}
    const app=r.Properties.ContainerDefinitions.find(c=>c.Name==='application');assert.equal(app.Secrets,undefined);assert.equal(app.Environment,undefined);assert.deepEqual(app.DependsOn,[{ContainerName:'bootstrap',Condition:'SUCCESS'}]);
  }
});

test('private runner cannot reach DB/Temporal/ECS/Bedrock or Internet through generated egress',()=>{
  const out=resources(foundation).filter(r=>r.Type==='AWS::EC2::SecurityGroupEgress'&&r.Properties.GroupId.Ref==='RunnerGroup');
  assert.ok(out.length>0);assert.ok(out.every(r=>r.Properties.CidrIp!=='0.0.0.0/0'));
  assert.ok(out.every(r=>![5432,7233].includes(r.Properties.ToPort)));
  const destinations=out.map(r=>r.Properties.DestinationSecurityGroupId?.Ref);
  for(const name of ['DatabaseGroup','TemporalGroup','EcsEndpointGroup','BedrockEndpointGroup'])assert.ok(!destinations.includes(name));
  const internet=resources(foundation).filter(r=>r.Type==='AWS::EC2::SecurityGroupEgress'&&r.Properties.CidrIp==='0.0.0.0/0');assert.equal(internet.length,1);assert.equal(internet[0].Properties.GroupId.Ref,'RelayGroup');assert.equal(internet[0].Properties.ToPort,443);
  assert.ok(resources(foundation).filter(r=>r.Type==='AWS::EC2::Subnet').every(r=>r.Properties.MapPublicIpOnLaunch===false));
});

test('public HTTPS defaults deny; only canonical method/path families forward',()=>{
  assert.equal(services.Resources.PublicListener.Properties.DefaultActions[0].FixedResponseConfig.StatusCode,'404');
  const rules=resources(services).filter(r=>r.Type==='AWS::ElasticLoadBalancingV2::ListenerRule');assert.equal(rules.length,3);
  const paths=rules.flatMap(r=>r.Properties.Conditions.find(c=>c.Field==='path-pattern').Values);
  assert.deepEqual(paths.sort(),['/api/action-followthrough/session','/api/conversations/submit','/api/conversations/history','/api/conversations/cancel','/api/conversations/events','/api/conversations/events/*/stream'].sort());
  assert.ok(!paths.includes('/api/conversations/*'));assert.ok(rules.every(r=>r.Properties.Conditions.some(c=>c.Field==='http-request-method')));
  assert.ok(rules.every(r=>r.Properties.Conditions.reduce((n,c)=>n+(c.Values??c.HttpRequestMethodConfig?.Values??[]).length,0)<=5));
});

test('new DNS allow association precedes existing priority101 without editing it; discovery excludes runner',()=>{
  const association=services.Resources.PreviewDnsAssociation.Properties;
  assert.equal(association.Priority,100);assert.equal(association.MutationProtection,'ENABLED');
  assert.equal(foundation.Resources.PrivateZone.Type,'AWS::ServiceDiscovery::PrivateDnsNamespace');
  assert.deepEqual(resources(services).filter(r=>r.Type==='AWS::ServiceDiscovery::Service').map(r=>r.Properties.Name).sort(),['control','proxy','relay','temporal']);
  assert.equal(services.Resources.RunnerDiscovery,undefined);
  assert.deepEqual(services.Resources.PreviewDnsRules.Properties.FirewallRules.map(r=>r.Action),['ALLOW']);
});

test('database and credentials retain by default and no application SQL/autoscale/deletion task is emitted',()=>{
  const db=data.Resources.Database;assert.equal(db.Properties.MultiAZ,false);assert.equal(db.Properties.DBInstanceClass,'db.t4g.small');assert.equal(db.Properties.AllocatedStorage,'20');assert.equal(db.Properties.MaxAllocatedStorage,undefined);assert.equal(db.Properties.PubliclyAccessible,false);assert.equal(db.Properties.DeletionProtection,true);assert.equal(db.DeletionPolicy,'Retain');assert.equal(db.UpdateReplacePolicy,'Retain');assert.equal(db.Properties.ManageMasterUserPassword,true);assert.equal(db.Properties.MasterUserPassword,undefined);assert.equal(data.Resources.Parameters.Properties.Parameters['rds.force_ssl'],'1');
  assert.ok(resources(data).filter(r=>['AWS::SecretsManager::Secret','AWS::KMS::Key'].includes(r.Type)).every(r=>r.DeletionPolicy==='Retain'&&r.UpdateReplacePolicy==='Retain'));
  assert.equal(data.Parameters.BackupRetentionDays.Default,undefined);assert.equal(services.Parameters.LogRetentionDays.Default,undefined);
});

test('control IAM binds actual source-emitted tags, original tuple, runner definition and sole execution PassRole',()=>{
  const statements=services.Resources.ControlRole.Properties.Policies[0].PolicyDocument.Statement;
  const run=statements.find(s=>s.Action.includes('ecs:RunTask'));assert.deepEqual(run.Resource,{Ref:'RunnerDefinition'});assert.deepEqual(Object.keys(run.Condition.StringEquals).sort(),['aws:RequestTag/meri:execution-id','aws:RequestTag/meri:binding-sha256','aws:RequestTag/meri:plan-sha256','aws:RequestTag/meri:expires-at-ms'].sort());
  const pass=statements.find(s=>s.Action.includes('iam:PassRole'));assert.deepEqual(pass.Resource,{'Fn::GetAtt':['RunnerExecutionRole','Arn']});
  const stop=statements.find(s=>s.Action.includes('ecs:StopTask'));assert.equal(stop.Condition.DateLessThan,undefined);assert.equal(Object.keys(stop.Condition.StringEquals).length,4);
  assert.ok(!statements.some(s=>s.Action.includes('ecs:RegisterTaskDefinition')||s.Action.includes('ecs:ExecuteCommand')||s.Action.includes('s3:DeleteObject')));
  for(const n of ['Control','Poller','Proxy','Temporal','Runner','Relay']){const s=services.Resources[n+'ExecutionRole'].Properties.Policies[0].PolicyDocument.Statement.find(s=>s.Action.includes('secretsmanager:GetSecretValue'));assert.deepEqual(s.Resource,{Ref:n+'CapsuleArn'});}
});

test('parameter boundary rejects outside/overlapping networks, broad caller and stale or unbound values',()=>{
  const t={Parameters:{PrivateSubnetA:{Type:'String'},PrivateSubnetB:{Type:'String'},PublicSubnetCidrA:{Type:'String'},PublicSubnetCidrB:{Type:'String'},CallerCidr:{Type:'String'}}},v={PrivateSubnetA:'a',PrivateSubnetB:'b',PublicSubnetCidrA:'10.80.240.0/24',PublicSubnetCidrB:'10.80.241.0/24',CallerCidr:'192.0.2.1/32'},context={vpcCidr:'10.80.0.0/16',occupiedCidrs:['10.80.0.0/24']};
  assert.equal(validateParameters(t,v,context),true);
  for(const change of [{PublicSubnetCidrB:v.PublicSubnetCidrA},{PublicSubnetCidrA:'10.81.0.0/24'},{PublicSubnetCidrA:'10.80.0.0/24'},{PublicSubnetCidrA:'10.80.241.3/24'},{CallerCidr:'0.0.0.0/0'},{PrivateSubnetB:'a'},{unexpected:'x'}])assert.throws(()=>validateParameters(t,{...v,...change},context));
  const i={Parameters:{RuntimeImage:services.Parameters.RuntimeImage}};assert.throws(()=>validateParameters(i,{RuntimeImage:'111111111111.dkr.ecr.us-east-1.amazonaws.com/synthetic@sha256:'+'a'.repeat(64)}));
});

test('policy proposals preserve all original statements and reject stale baselines or duplicate preview SIDs',()=>{
  const baseline=Buffer.from(JSON.stringify({Version:'2012-10-17',Statement:[{Sid:'OriginalEcrOnly',Effect:'Allow',Principal:'*',Action:'s3:GetObject',Resource:'arn:aws:s3:::synthetic-starport/*'}]}));
  const statements=checkpointPolicyStatements({controlRoleArn:'arn:aws:iam::111111111111:role/meri-runtime-preview-control',bucket:'synthetic-private-checkpoint',keyArn:'arn:aws:kms:us-east-1:111111111111:key/12345678-1234-1234-1234-123456789012',prefix:'native-preview/synthetic'});
  const result=appendPolicy({baselineBytes:baseline,expectedSha256:hash(baseline),statements:statements.endpoint});assert.equal(result.status,'PROPOSED_NOT_APPLIED');assert.deepEqual(JSON.parse(result.proposedBytes).Statement[0],JSON.parse(baseline).Statement[0]);
  assert.throws(()=>appendPolicy({baselineBytes:baseline,expectedSha256:'f'.repeat(64),statements:statements.endpoint}));assert.throws(()=>appendPolicy({baselineBytes:result.proposedBytes,expectedSha256:result.proposedSha256,statements:statements.endpoint}));
  assert.ok(statements.bucket.every(s=>s.Effect==='Deny'));assert.ok(!statements.endpoint.some(s=>[].concat(s.Action).some(a=>a.includes('Delete')||a.includes('List'))));
});

test('P0 and supplied hashes never grant execution; missing bindings and old inventory stay HOLD',()=>{
  const packet=buildActionBundle({templates,parameterSets:{},evidence:{observedAtMs:1},source:{},pricing:{},owners:{},bindings:{},now:()=>7200000});
  assert.equal(packet.status,'HOLD_MISSING_EXECUTION_BINDINGS');assert.equal(packet.P1P8Authorized,false);assert.equal(packet.irreversibleDeletionAuthorized,false);assert.equal(packet.cloudWritesPerformed,false);assert.ok(packet.blockedBy.includes('fresh-action-time-readback'));assert.ok(packet.blockedBy.includes('exact-paid-resource-stop-plan'));assert.equal(packet.phases.length,8);assert.ok(packet.phases.every(p=>p.approvalRequired));
});
