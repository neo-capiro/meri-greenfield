// W02-10 offline security/shape tests for the synthetic native-qualification
// task-definition stack. PREPARATION ONLY.
//
// These tests synthesize the stack offline into the ignored `.task-inputs`
// scratch (deterministic, no AWS call, no context lookup, no network/socket/
// server) and assert against the ACTUAL emitted template. Nothing here mutates
// existing stacks/sources. Importing `./app.mjs` is side-effect free (it only
// synthesizes under its explicit CLI guard); the tests call `synthesize()`.

import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { App } from 'aws-cdk-lib';

import {
  STACK_NAME,
  TARGET,
  IMAGE_REPOSITORY,
  EXECUTION_ROLE_ARN,
  WORKER_ROLE_ARN,
  WORKER_IMAGE_PATTERN,
  SYNTHETIC_QUALIFICATION_IMAGE,
  SUPERSEDED_IMAGE_DIGEST,
  PROBE_ENVIRONMENT,
  LOG_GROUP,
  OUTDIR,
  buildNativeQualificationStack,
  parseWorkerImage,
  synthesize,
} from './app.mjs';

// Refresh the deterministic synthetic template in .task-inputs, then read it.
synthesize();
const TEMPLATE_FILE = 'MeriGreenfield-NativeQualification.template.json';
const template = JSON.parse(readFileSync(join(OUTDIR, TEMPLATE_FILE), 'utf8'));

const RESOURCES = Object.entries(template.Resources ?? {});
const TASK_DEFS = RESOURCES.filter(([, r]) => r.Type === 'AWS::ECS::TaskDefinition').map(
  ([id, r]) => ({ id, props: r.Properties }),
);
const byFamily = (family) => TASK_DEFS.find((t) => t.props.Family === family);
const containerOf = (taskDef) => taskDef.props.ContainerDefinitions[0];
const text = JSON.stringify(template);

test('stack declares exactly two task definitions and nothing else', () => {
  assert.equal(RESOURCES.length, 2);
  assert.deepEqual(new Set(RESOURCES.map(([, r]) => r.Type)), new Set(['AWS::ECS::TaskDefinition']));
  assert.deepEqual(Object.keys(template.Parameters), ['WorkerImage']);
  assert.deepEqual(
    Object.keys(template.Outputs).sort(),
    ['OfficeTaskDefinitionArn', 'SdkTaskDefinitionArn'],
  );
  assert.deepEqual(
    TASK_DEFS.map((t) => t.props.Family).sort(),
    ['meri-greenfield-qualification-office', 'meri-greenfield-qualification-sdk'],
  );
  assert.equal(STACK_NAME, 'MeriGreenfield-NativeQualification');
  assert.deepEqual(TARGET, { account: '967807252336', region: 'us-east-1' });
  // Each output publishes the resource ARN by Ref.
  for (const [name, out] of Object.entries(template.Outputs)) {
    assert.deepEqual(out.Value, { Ref: name.replace('Arn', '') });
  }
});

test('no IAM/network/log/service/secret/asset/lookup authority expansion', () => {
  for (const [, r] of RESOURCES) {
    assert.doesNotMatch(
      r.Type,
      /^AWS::(IAM|EC2|Logs|KMS|S3|SecretsManager|Route53|Lambda|Scheduler|Events)::/,
    );
    assert.notEqual(r.Type, 'AWS::ECS::Service');
    assert.notEqual(r.Type, 'AWS::ECS::Cluster');
  }
  for (const forbidden of [
    'Fn::ImportValue',
    'Fn::GetAtt',
    'BootstrapVersion',
    'AWS::CDK::Metadata',
    'aws:cdk:asset',
    'AssetParameters',
    '"Secrets"',
    'CfnParameter',
  ]) {
    assert.equal(text.includes(forbidden), false, `template must not contain ${forbidden}`);
  }
  // No source URL, provider credential, or user setting anywhere in the
  // template body (the stack Description names the forbidden categories, so it
  // is excluded from the credential scan).
  assert.doesNotMatch(text, /https?:\/\//);
  const withoutDescription = JSON.stringify({ ...template, Description: undefined });
  assert.doesNotMatch(withoutDescription, /(api[_-]?key|secret|password|credential|token)/i);
});

test('WorkerImage is a required immutable-digest parameter with no default', () => {
  const p = template.Parameters.WorkerImage;
  assert.equal(p.Type, 'String');
  assert.equal(Object.hasOwn(p, 'Default'), false, 'must have no default (no image admission)');
  assert.equal(p.AllowedPattern, WORKER_IMAGE_PATTERN);
  assert.match(p.AllowedPattern, /@sha256:\[a-f0-9\]\{64\}\$$/);
  assert.equal(new RegExp(p.AllowedPattern).test(SYNTHETIC_QUALIFICATION_IMAGE), true);
  assert.match(p.Description, /No default/i);
  assert.ok(p.ConstraintDescription.includes(IMAGE_REPOSITORY));
});

test('both task definitions use the same exact image parameter', () => {
  const images = TASK_DEFS.map((t) => containerOf(t).Image);
  assert.deepEqual(images, [{ Ref: 'WorkerImage' }, { Ref: 'WorkerImage' }]);
  assert.deepEqual(images[0], images[1]);
});

test('execution role is retained and SDK/Office omit the task role entirely', () => {
  assert.equal(text.includes('AWS::IAM::Role'), false);
  assert.equal(text.includes('AWS::IAM::Policy'), false);
  for (const t of TASK_DEFS) {
    assert.equal(typeof t.props.ExecutionRoleArn, 'string');
    assert.equal(t.props.ExecutionRoleArn, EXECUTION_ROLE_ARN);
    assert.equal(Object.hasOwn(t.props, 'TaskRoleArn'), false);
  }
  assert.equal(text.includes(WORKER_ROLE_ARN), false, 'historical empty role must not enter future definitions');
});

test('component pins bind the actual role-free synthetic template and execution role', () => {
  const pins = JSON.parse(readFileSync(new URL('./component-pins.json', import.meta.url), 'utf8'));
  const raw = readFileSync(join(OUTDIR, TEMPLATE_FILE));
  assert.equal(pins.syntheticStack.templateBytes, raw.length);
  assert.equal(pins.syntheticStack.templateSha256, createHash('sha256').update(raw).digest('hex'));
  assert.equal(pins.roles.executionRoleArn, EXECUTION_ROLE_ARN);
  assert.equal(pins.roles.workerRoleArn, null);
  assert.equal(pins.roles.taskRoleArnOmitted, true);
  assert.equal(pins.roles.legacyWorkerRoleArn, WORKER_ROLE_ARN);
});

test('platform, sizing, networking and fresh empty volumes', () => {
  for (const t of TASK_DEFS) {
    assert.deepEqual(t.props.RequiresCompatibilities, ['FARGATE']);
    assert.equal(t.props.NetworkMode, 'awsvpc');
    assert.equal(t.props.Cpu, '2048');
    assert.equal(t.props.Memory, '8192');
    assert.deepEqual(t.props.EphemeralStorage, { SizeInGiB: 50 });
    assert.deepEqual(t.props.RuntimePlatform, {
      CpuArchitecture: 'X86_64',
      OperatingSystemFamily: 'LINUX',
    });
    assert.deepEqual(t.props.Volumes, [
      { Name: 'workspace', Host: {} },
      { Name: 'tmp', Host: {} },
    ]);
    for (const v of t.props.Volumes) {
      assert.deepEqual(v.Host, {}, 'volume must be a fresh empty volume, not a host path');
      assert.equal(Object.hasOwn(v, 'EFSVolumeConfiguration'), false);
      assert.equal(Object.hasOwn(v, 'DockerVolumeConfiguration'), false);
    }
  }
});

test('single hardened essential container with no privilege/port/secret surface', () => {
  for (const t of TASK_DEFS) {
    const c = containerOf(t);
    assert.equal(t.props.ContainerDefinitions.length, 1);
    assert.equal(c.Name, 'worker');
    assert.equal(c.Essential, true);
    assert.equal(c.User, '10001:10001');
    assert.equal(c.ReadonlyRootFilesystem, true);
    assert.equal(c.Privileged, false);
    assert.equal(c.StopTimeout, 60);
    assert.deepEqual(c.LinuxParameters, { Capabilities: { Drop: ['ALL'] } });
    assert.deepEqual(Object.keys(c.LinuxParameters), ['Capabilities']);
    for (const forbidden of [
      'PortMappings',
      'Secrets',
      'HealthCheck',
      'Hostname',
      'DockerSecurityOptions',
      'ExtraHosts',
      'SystemControls',
      'CredentialSpecs',
      'RepositoryCredentials',
      'WorkingDirectory',
      'DnsServers',
      'DnsSearchDomains',
      'Links',
      'VolumesFrom',
      'Ulimits',
      'ResourceRequirements',
      'DependsOn',
    ]) {
      assert.equal(Object.hasOwn(c, forbidden), false, `container must not define ${forbidden}`);
    }
    assert.notEqual(c.DisableNetworking, true);
  }
});

test('entrypoint and command run the exact probe and never runtime.mjs', () => {
  const sdk = containerOf(byFamily('meri-greenfield-qualification-sdk'));
  const office = containerOf(byFamily('meri-greenfield-qualification-office'));
  assert.deepEqual(sdk.EntryPoint, ['node']);
  assert.deepEqual(office.EntryPoint, ['node']);
  assert.deepEqual(sdk.Command, ['/opt/meri-worker/probes/sdk-capture.mjs']);
  assert.deepEqual(office.Command, ['/opt/meri-worker/probes/office-export.mjs']);
  assert.equal(text.includes('runtime.mjs'), false);
  assert.equal(sdk.Command[0], office.Command[0].replace('office-export', 'sdk-capture'));
});

test('environment is exactly the inert allowlist with no credentials', () => {
  const expected = new Map(PROBE_ENVIRONMENT.map((e) => [e.name, e.value]));
  assert.equal(expected.size, 7);
  for (const t of TASK_DEFS) {
    const env = containerOf(t).Environment;
    assert.deepEqual(new Map(env.map((e) => [e.Name, e.Value])), expected);
    assert.equal(Object.hasOwn(containerOf(t), 'EnvironmentFiles'), false);
    for (const e of env) {
      assert.doesNotMatch(e.Name, /AWS_|ANTHROPIC|OPENAI|BEDROCK|TOKEN|SECRET|API_?KEY|PASSWORD|CREDENTIAL|DATABASE|DB_/i);
    }
  }
  assert.equal(expected.get('MERI_SOURCES_ENABLED'), 'false');
  assert.equal(expected.get('MERI_QUALIFICATION_ONLY'), 'true');
  assert.equal(expected.get('CHROMIUM_SANDBOX_REQUIRED'), 'true');
});

test('volumes mount writable only at /workspace and /tmp', () => {
  for (const t of TASK_DEFS) {
    const mounts = containerOf(t).MountPoints;
    assert.deepEqual(mounts, [
      { SourceVolume: 'workspace', ContainerPath: '/workspace', ReadOnly: false },
      { SourceVolume: 'tmp', ContainerPath: '/tmp', ReadOnly: false },
    ]);
  }
});

test('logging exports bounded blocking awslogs with distinct deterministic prefixes', () => {
  const prefixes = [];
  for (const t of TASK_DEFS) {
    const lc = containerOf(t).LogConfiguration;
    assert.equal(lc.LogDriver, 'awslogs');
    assert.equal(lc.Options.mode, 'blocking');
    assert.equal(lc.Options['awslogs-group'], LOG_GROUP);
    assert.equal(lc.Options['awslogs-region'], 'us-east-1');
    assert.equal(Object.hasOwn(lc, 'SecretOptions'), false);
    assert.notEqual(lc.Options['awslogs-stream-prefix'], 'qualification');
    prefixes.push(lc.Options['awslogs-stream-prefix']);
  }
  assert.deepEqual(new Set(prefixes), new Set(['qualification-sdk', 'qualification-office']));
});

test('synthesis is deterministic across independent runs', () => {
  const secondOutdir = join(OUTDIR, '..', 'determinism-check');
  const app = new App({ outdir: secondOutdir });
  buildNativeQualificationStack(app);
  app.synth();
  const second = JSON.parse(readFileSync(join(secondOutdir, TEMPLATE_FILE), 'utf8'));
  assert.deepEqual(second, template);
});

test('parseWorkerImage accepts only the exact immutable target digest', () => {
  assert.equal(parseWorkerImage(SYNTHETIC_QUALIFICATION_IMAGE), SYNTHETIC_QUALIFICATION_IMAGE);
  const other = `${IMAGE_REPOSITORY}@sha256:${'b'.repeat(64)}`;
  assert.equal(parseWorkerImage(other), other);
  const bad = [
    `${IMAGE_REPOSITORY}:latest`,
    `${IMAGE_REPOSITORY}`,
    `967807252336.dkr.ecr.us-east-1.amazonaws.com/meri-greenfield/other@sha256:${'a'.repeat(64)}`,
    `123456789012.dkr.ecr.us-east-1.amazonaws.com/meri-greenfield/qualification-worker@sha256:${'a'.repeat(64)}`,
    `967807252336.dkr.ecr.us-west-2.amazonaws.com/meri-greenfield/qualification-worker@sha256:${'a'.repeat(64)}`,
    `${IMAGE_REPOSITORY}@sha256:${'a'.repeat(63)}`,
    `${IMAGE_REPOSITORY}@sha256:${'A'.repeat(64)}`,
    `${IMAGE_REPOSITORY}@sha256:${'a'.repeat(64)} `,
    '',
    42,
  ];
  for (const value of bad) {
    assert.throws(() => parseWorkerImage(value), undefined, `must reject: ${String(value)}`);
  }
});

test('parseWorkerImage rejects the superseded unaccepted baseline digest', () => {
  const superseded = `${IMAGE_REPOSITORY}@${SUPERSEDED_IMAGE_DIGEST}`;
  assert.equal(new RegExp(WORKER_IMAGE_PATTERN).test(superseded), true); // shape-valid...
  assert.throws(() => parseWorkerImage(superseded), /superseded|old7327/i); // ...but refused
});
