import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const load = name => JSON.parse(readFileSync(new URL(`../../cdk.out/qualification/MeriGreenfield-Qualification${name}.template.json`, import.meta.url)));
const build = load('Build'), runtime = load('Runtime');
const resources = (template, type) => Object.values(template.Resources).filter(r => r.Type === type).map(r => r.Properties);
const list = v => Array.isArray(v) ? v : [v];
const statements = t => resources(t, 'AWS::IAM::Policy').flatMap(p => p.PolicyDocument.Statement);

test('no existing-source imports, shared bootstrap dependency or internet routing', () => {
  for (const template of [build, runtime]) {
    const text = JSON.stringify(template);
    assert(!text.includes('Fn::ImportValue'));
    assert(!text.includes('BootstrapVersion'));
    assert(!text.includes('capiro-dev') && !text.includes('vpc-0ac26cfac7ed972be'));
  }
  for (const type of ['AWS::EC2::NatGateway', 'AWS::EC2::InternetGateway', 'AWS::EC2::VPCPeeringConnection', 'AWS::ECS::Service']) assert.equal(resources(runtime, type).length, 0);
  assert.equal(resources(runtime, 'AWS::EC2::Route').length, 0);
  for (const subnet of resources(runtime, 'AWS::EC2::Subnet')) {
    assert.equal(subnet.MapPublicIpOnLaunch, false);
    assert(['us-east-1a', 'us-east-1b'].includes(subnet.AvailabilityZone));
  }
});

test('task pins a digest, non-root, read-only-root, drop ALL and no worker IAM actions', () => {
  assert.match(runtime.Parameters.WorkerImage.AllowedPattern, /@sha256:/);
  assert(!('Default' in runtime.Parameters.WorkerImage));
  const [task] = resources(runtime, 'AWS::ECS::TaskDefinition');
  assert.deepEqual(task.RequiresCompatibilities, ['FARGATE']);
  const [c] = task.ContainerDefinitions;
  assert.equal(c.User, '10001:10001'); assert.equal(c.ReadonlyRootFilesystem, true); assert.equal(c.Privileged, false);
  assert.deepEqual(c.LinuxParameters.Capabilities.Drop, ['ALL']);
  assert(!c.DockerSecurityOptions && !c.LinuxParameters.Capabilities.Add);
  assert(!c.Secrets); assert(!c.PortMappings);
  assert.equal(c.Environment.find(e => e.Name === 'MERI_SOURCES_ENABLED').Value, 'false');
  const workerId = task.TaskRoleArn['Fn::GetAtt'][0];
  const role = runtime.Resources[workerId].Properties;
  assert(!role.Policies && !role.ManagedPolicyArns);
  assert(!resources(runtime, 'AWS::IAM::Policy').some(p => list(p.Roles).some(r => r?.Ref === workerId)));
  for (const role of resources(runtime, 'AWS::IAM::Role')) {
    const trust = role.AssumeRolePolicyDocument.Statement[0];
    assert.equal(trust.Condition.StringEquals['aws:SourceAccount'], '967807252336');
    assert.match(trust.Condition.ArnLike['aws:SourceArn'], /arn:aws:ecs:us-east-1:967807252336:/);
  }
});

test('private endpoints reject broad ingress and S3 exposes ECR layers only', () => {
  const groups = resources(runtime, 'AWS::EC2::SecurityGroup');
  const rules = [...groups.flatMap(g => g.SecurityGroupIngress ?? []), ...resources(runtime, 'AWS::EC2::SecurityGroupIngress')];
  assert.equal(rules.length, 1);
  assert.equal(rules[0].FromPort, 443); assert.equal(rules[0].ToPort, 443);
  assert(rules[0].SourceSecurityGroupId && !rules[0].CidrIp && !rules[0].CidrIpv6);
  for (const g of groups) for (const rule of g.SecurityGroupEgress ?? []) assert(!['0.0.0.0/0', '::/0'].includes(rule.CidrIp ?? rule.CidrIpv6));
  const [gateway] = resources(runtime, 'AWS::EC2::VPCEndpoint').filter(e => e.VpcEndpointType === 'Gateway');
  assert.equal(gateway.PolicyDocument.Statement.length, 1);
  assert.equal(gateway.PolicyDocument.Statement[0].Action, 's3:GetObject');
  assert.equal(gateway.PolicyDocument.Statement[0].Resource, 'arn:aws:s3:::prod-us-east-1-starport-layer-bucket/*');
});

test('DNS has exact allow names followed by a wildcard block', () => {
  const lists = resources(runtime, 'AWS::Route53Resolver::FirewallDomainList');
  assert(lists.some(l => l.Domains.length === 1 && l.Domains[0] === '*'));
  const allow = lists.find(l => l.Domains[0] !== '*');
  assert(allow.Domains.every(d => !d.includes('*') && !d.includes('capiro')));
  const [rules] = resources(runtime, 'AWS::Route53Resolver::FirewallRuleGroup');
  assert.deepEqual(rules.FirewallRules.map(r => [r.Priority, r.Action]), [[100, 'ALLOW'], [200, 'BLOCK']]);
  assert.equal(rules.FirewallRules[1].BlockResponse, 'NXDOMAIN');
  assert.equal(resources(runtime, 'AWS::Route53Resolver::FirewallRuleGroupAssociation').length, 1);
});

test('logs have context-scoped service KMS grants and caller ViaService grants', () => {
  for (const [template, suffix] of [[build, 'build'], [runtime, 'runtime']]) {
    const [key] = resources(template, 'AWS::KMS::Key');
    const s = key.KeyPolicy.Statement.find(s => s.Principal.Service === 'logs.us-east-1.amazonaws.com');
    assert(s); assert.equal(s.Condition.ArnEquals['kms:EncryptionContext:aws:logs:arn'], `arn:aws:logs:us-east-1:967807252336:log-group:/meri-greenfield/qualification/${suffix}`);
    assert(statements(template).some(s => s.Condition?.StringEquals?.['kms:ViaService'] === 'logs.us-east-1.amazonaws.com' && list(s.Action).includes('kms:GenerateDataKey*')));
  }
});

test('trusted builder preserves versioned evidence and can resolve pushed digest', () => {
  const [bucket] = resources(build, 'AWS::S3::Bucket');
  assert.equal(bucket.VersioningConfiguration.Status, 'Enabled');
  assert.equal(bucket.PublicAccessBlockConfiguration.BlockPublicPolicy, true);
  assert(!statements(build).some(s => list(s.Action).some(a => /s3:Delete|s3:PutObjectRetention|s3:PutObjectLegalHold/.test(a))));
  assert(statements(build).some(s => list(s.Action).includes('ecr:DescribeImages')));
  const [repo] = resources(build, 'AWS::ECR::Repository');
  assert.equal(repo.ImageTagMutability, 'IMMUTABLE');
  const [project] = resources(build, 'AWS::CodeBuild::Project');
  assert.equal(project.ConcurrentBuildLimit, 1); assert.equal(project.TimeoutInMinutes, 30);
  const spec = JSON.parse(project.Source.BuildSpec);
  assert(spec.phases.build.commands.find(c => c.startsWith('docker build')).endsWith(' apps/worker/qualification'));
  assert(spec.phases.post_build.commands.indexOf('[ "${CODEBUILD_BUILD_SUCCEEDING:-0}" = 1 ]') < spec.phases.post_build.commands.findIndex(c => c.startsWith('docker push')));
});
