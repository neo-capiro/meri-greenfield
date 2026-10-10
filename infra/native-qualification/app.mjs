// W02-10 native Fargate probe *definitions* — SYNTHETIC / PREPARATION ONLY.
//
// This CDK app synthesizes ONE new, offline, deterministic CloudFormation stack
// (`MeriGreenfield-NativeQualification`) that declares exactly two ECS task
// definitions for the already-accepted offline probe sources:
//
//   * SDK capture  -> apps/worker/qualification/probes/sdk-capture.mjs
//   * Office export-> apps/worker/qualification/probes/office-export.mjs
//
// It creates NO services, schedulers, IAM roles/policies, networking, log
// groups, secrets, assets, lookups or changes to any existing Meri/Capiro
// resource. It pins the two retained, externally-created role ARNs by immutable
// reference (plain strings) so no synthesized role can gain a policy. This
// module makes no AWS request, no context lookup and no network/socket/server
// call: synthesis is pure and offline.
//
// The worker image is NOT built and NOT admitted. `WorkerImage` is a required
// CloudFormation parameter (no default, immutable-digest pattern only); the
// all-a value below is a prominently fake placeholder used for synthetic
// validation only and is never a deployable image.

import { App, Stack, BootstraplessSynthesizer, CfnParameter, CfnOutput, aws_ecs as ecs } from 'aws-cdk-lib';
import { fileURLToPath } from 'node:url';
import { resolve as resolvePath } from 'node:path';

export const STACK_NAME = 'MeriGreenfield-NativeQualification';
export const TARGET = Object.freeze({ account: '967807252336', region: 'us-east-1' });

// New, isolated qualification image repository (same family as the accepted
// build stack). No other repo/account/region is valid.
export const IMAGE_REPOSITORY =
  `${TARGET.account}.dkr.ecr.${TARGET.region}.amazonaws.com/meri-greenfield/qualification-worker`;

// Retained, externally-created role ARNs. Reconstructed from the accepted
// private evidence file
// docs/coordination/private-evidence/W02-fargate-baseline-3-run/task-definition.json
// (both strings reconcile EXACTLY; see the W02-10 report). Plain immutable
// strings only — no IAM resource is declared, so nothing can attach a policy.
export const EXECUTION_ROLE_ARN =
  'arn:aws:iam::967807252336:role/MeriGreenfield-QualificationR-ExecutionRole605A040B-kL3yc2CIalc3';
export const WORKER_ROLE_ARN =
  'arn:aws:iam::967807252336:role/MeriGreenfield-Qualificatio-EmptyWorkerRole7C03C4DD-nOWJZv6LQdqD';

// Immutable-digest-only pattern: exact account/repo/region, no tag, 64 lowercase
// hex chars. Used both as the CloudFormation AllowedPattern and by the offline
// parser below.
export const WORKER_IMAGE_PATTERN =
  `^${IMAGE_REPOSITORY.replace(/[.]/g, '\\.')}@sha256:[a-f0-9]{64}$`;

// Prominently fake, all-a placeholder digest for synthetic synthesis/tests.
// NOT a real image; never deployable; carries no admission.
export const SYNTHETIC_QUALIFICATION_IMAGE = `${IMAGE_REPOSITORY}@sha256:${'a'.repeat(64)}`;

// The superseded baseline image digest (old7327) was never accepted for this
// ticket's refreshed recipe; it must not be offered as an accepted candidate.
export const SUPERSEDED_IMAGE_DIGEST =
  'sha256:7327f04575b09a633730b0ffe4b5fdeeeffe151a5c0db6dc027cc6edb8960d75';

const WORKER_IMAGE_RE = new RegExp(WORKER_IMAGE_PATTERN);

// Offline validator for the WorkerImage input. Accepts ONLY an immutable
// sha256 ECR URI in the exact target repository, and rejects the superseded
// baseline digest. No lookups, no AWS calls.
export function parseWorkerImage(value) {
  if (typeof value !== 'string') {
    throw new TypeError('WorkerImage must be a string');
  }
  if (!WORKER_IMAGE_RE.test(value)) {
    throw new Error(
      `WorkerImage must be an immutable sha256 digest URI in ${IMAGE_REPOSITORY} ` +
        '(no tag, no other repo/account/region)',
    );
  }
  if (value.endsWith(`@${SUPERSEDED_IMAGE_DIGEST}`)) {
    throw new Error('WorkerImage must not be the superseded, unaccepted baseline digest (old7327)');
  }
  return value;
}

// Inert, non-credential environment shared by both probes. No SDK/provider/AWS
// credentials and no arbitrary configuration.
export const PROBE_ENVIRONMENT = Object.freeze([
  { name: 'HOME', value: '/workspace/home' },
  { name: 'TMPDIR', value: '/tmp' },
  { name: 'CLAUDE_CONFIG_DIR', value: '/workspace/config' },
  { name: 'PLAYWRIGHT_BROWSERS_PATH', value: '/opt/meri-browsers' },
  { name: 'MERI_QUALIFICATION_ONLY', value: 'true' },
  { name: 'MERI_SOURCES_ENABLED', value: 'false' },
  { name: 'CHROMIUM_SANDBOX_REQUIRED', value: 'true' },
]);

export const LOG_GROUP = '/meri-greenfield/qualification/runtime';

export const PROBES = Object.freeze([
  { id: 'Sdk', family: 'meri-greenfield-qualification-sdk', streamPrefix: 'qualification-sdk', command: '/opt/meri-worker/probes/sdk-capture.mjs' },
  { id: 'Office', family: 'meri-greenfield-qualification-office', streamPrefix: 'qualification-office', command: '/opt/meri-worker/probes/office-export.mjs' },
]);

function containerDefinition(probe, image) {
  return {
    name: 'worker',
    image,
    essential: true,
    entryPoint: ['node'],
    command: [probe.command],
    user: '10001:10001',
    readonlyRootFilesystem: true,
    privileged: false,
    stopTimeout: 60,
    // drop ALL, add nothing: no extra capabilities, no devices, no tmpfs.
    linuxParameters: { capabilities: { drop: ['ALL'] } },
    environment: PROBE_ENVIRONMENT.map((entry) => ({ ...entry })),
    // Fresh, empty volumes; writable only at /workspace and /tmp.
    mountPoints: [
      { sourceVolume: 'workspace', containerPath: '/workspace', readOnly: false },
      { sourceVolume: 'tmp', containerPath: '/tmp', readOnly: false },
    ],
    logConfiguration: {
      logDriver: 'awslogs',
      options: {
        'awslogs-group': LOG_GROUP,
        'awslogs-region': TARGET.region,
        'awslogs-stream-prefix': probe.streamPrefix,
        mode: 'blocking',
      },
    },
  };
}

// Builds (and returns) the synthetic stack. Pure: adds no external calls.
export function buildNativeQualificationStack(scope, id = STACK_NAME) {
  const stack = new Stack(scope, id, {
    env: { account: TARGET.account, region: TARGET.region },
    synthesizer: new BootstraplessSynthesizer(),
    description:
      'Synthetic-only Meri native qualification task definitions (SDK capture + Office export); no services, roles, networking, log groups, secrets or assets',
  });

  const image = new CfnParameter(stack, 'WorkerImage', {
    type: 'String',
    description:
      'Required immutable sha256 ECR image applied to BOTH probe task definitions. ' +
      'No default: the owner supplies the exact reviewed digest at deploy time.',
    allowedPattern: WORKER_IMAGE_PATTERN,
    constraintDescription:
      `Must be an immutable digest URI in ${IMAGE_REPOSITORY}. ` +
      `Synthetic placeholder example (NOT deployable): ${SYNTHETIC_QUALIFICATION_IMAGE}`,
  });

  const imageValue = image.valueAsString; // => { "Ref": "WorkerImage" } in the template

  for (const probe of PROBES) {
    const task = new ecs.CfnTaskDefinition(stack, `${probe.id}TaskDefinition`, {
      family: probe.family,
      executionRoleArn: EXECUTION_ROLE_ARN,
      taskRoleArn: WORKER_ROLE_ARN,
      networkMode: 'awsvpc',
      requiresCompatibilities: ['FARGATE'],
      cpu: '2048',
      memory: '8192',
      ephemeralStorage: { sizeInGiB: 50 },
      runtimePlatform: { cpuArchitecture: 'X86_64', operatingSystemFamily: 'LINUX' },
      // Empty (fresh) docker volumes: name only, no host path, no EFS.
      volumes: [{ name: 'workspace', host: {} }, { name: 'tmp', host: {} }],
      containerDefinitions: [containerDefinition(probe, imageValue)],
    });
    new CfnOutput(stack, `${probe.id}TaskDefinitionArn`, { value: task.ref });
  }

  return stack;
}

export const OUTDIR = fileURLToPath(new URL('../../.task-inputs/cdk.out/native-qualification', import.meta.url));

export function synthesize(outdir = OUTDIR) {
  const app = new App({ outdir });
  const stack = buildNativeQualificationStack(app);
  app.synth();
  return { app, stack };
}

// Explicit CLI guard: importing this module (e.g. from the offline tests) must
// stay side-effect free; synthesis only runs when the file is executed directly.
const invokedDirectly =
  process.argv[1] !== undefined && fileURLToPath(import.meta.url) === resolvePath(process.argv[1]);
if (invokedDirectly) {
  synthesize();
  console.log(`Synthesized ${STACK_NAME} into ${OUTDIR}`);
}

export default synthesize;
