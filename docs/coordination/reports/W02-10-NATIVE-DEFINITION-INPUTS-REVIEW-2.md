# W02-10 native-definition registration inputs — independent review 2

REPORT-ONLY. Distinct actual Hermes reviewer (not the implementation or any runtime
session). This document records an independent STATIC/DATA audit of the exact locally
PREPARED registration inputs for the W02-10 native qualification task definitions. It
records no acceptance, no AWS/CFN action, no change-set execution, no image/probe
admission, no gate promotion, no merge/push and no code change. Independent Codex owner
verification and any later cloud admission remain required.

No AWS action has occurred by this preparation. Every input file below is data-only
(`DATA_ONLY_NOT_AWS_EVIDENCE` / `PREPARATION_ONLY_NOT_EXECUTED`); none is an AWS readback
or a live service-pattern proof. Local static inspection of a template cannot establish
CloudFormation service-pattern behavior.

## Subject and hashes

- Review worktree: `C:\dev\main\meri-greenfield-worktrees\w02-native-definition-inputs-review-2`
- Branch: `review/w02-native-definition-inputs-2`
- Pinned base commit: `1d809e01667f5aead769bee5512bb10143aed12f` (clean at start; verified `git rev-parse HEAD`)
- Accepted source candidate: `390903a0ffddedb61bba5c8a47562864be7633c2` (verified ancestor of HEAD)
- Prepared-input directory: `.task-inputs/W02-10-native-definition-inputs-2/`

Input file bytes / SHA256 (independently recomputed on disk; all match `manifest.json`):

| input | bytes | sha256 | vs manifest |
| --- | --- | --- | --- |
| `manifest.json` | 745 | `80c1c6062ccbde948b292fcf3d67ce6fa7ac85f9cca5be9493026fb583e4319a` | n/a (matches brief) |
| `parameters.json` | 231 | `b15ee6ba35cd7099e8b4988a64777f51d5fa513b0dde9c1752b46ba389d380e4` | MATCH |
| `proposed-create-change-set.json` | 7416 | `684530328db1a0a36f87f05bb227d3cf871041fca3e3cc1f3e31b5b7a60df167` | MATCH |
| `scope.json` | 2207 | `e29f3dd29c1199b00b0dc883ecb37562861a91364172ea6d5ab4147cff9f1225` | MATCH |
| `template.json` | 6082 | `7895fa997a8521fe7adc03cb7c468b1987de8875518ae0d8ab6f284496b13080` | MATCH |

`proposed-create-change-set.json` and `template.json` SHA256 also match the exact values
named in the review brief.

Source bytes (unchanged since the accepted candidate — Git blob identity, not a re-read of
a possibly-different worktree):

| source path | bytes | sha256 (on disk = accepted) | git blob @HEAD | git blob @390903a0 |
| --- | --- | --- | --- | --- |
| `infra/native-qualification/app.mjs` | 8473 | `7b452601b5ecd5cf932149b7104bc8a36d76f1f064d5a6432829c95dd9ecd611` | `b1c746d8b9621c2392d8be2bfbb683ba81b97aa5` | `b1c746d8…` |
| `infra/native-qualification/component-pins.json` | 6173 | `38fea4364c4be6f672ec626bebe73f2e41dfe1761af11339ca659bbd267ebf82` | `139c30e1707511c927de01414cb5762fa5ebfabf` | `139c30e1…` |
| `infra/native-qualification/security.test.mjs` | 11200 | `cb31fe1efcd5c8d065c0eca13458350a402599087f0031b856ec4926bea9b069` | `96fdd1559a0a6d7c448385f60bc0a5ce63c94912` | `96fdd155…` |
| `infra/native-qualification/README.md` | 4464 | `6f5fbd382f23757b91e650194fae5268770572b52be62820ca160172cde81162` | `5ba8aec87cd331572039ba7ab25f3721137db0ed` | `5ba8aec8…` |

`git diff 390903a0..HEAD -- infra/native-qualification/` is empty and all four HEAD blob
hashes equal the candidate's: the four source bytes are byte-identical to the accepted
offline candidate. No code/substantive logic changed; no new code exists to review.

Worker image parameter value (independently matched across `parameters.json`, the request
`Parameters`, and `scope.workerImage`):

`967807252336.dkr.ecr.us-east-1.amazonaws.com/meri-greenfield/qualification-worker@sha256:bf55fdab91136344688e2c804598546e521b24d6cdbf4fde9e6a7131e6c2ec9c`

This is the newly successful, statically reconciled attempt-3 build only
(`docs/coordination/reports/W02-08-BUILD-3-STATIC-ACCEPTANCE.md`). It is
**NOT_RUNTIME_OR_SECURITY_ACCEPTED**. All 49 scan findings (4 CRITICAL / 18 HIGH /
18 MEDIUM / 7 LOW / 2 UNDEFINED), including the added MEDIUM `CVE-2026-107655` (cups),
remain OPEN; the Office residual-risk decision is DEFERRED; W02-14 enforcement is
unaccepted. Registration must not run or pull the image, and implies no SDK/Office
admission. The prior bad `527e6d8` / old `7327` / all-`a` fake digests are never offered.

## Git / process discipline honored

- Worktree clean at start and after this review; `git status --porcelain -uall` is empty.
- Only the NEW allocated report path is added by this review. The scratch directory
  `.task-inputs/W02-10-review-2/` (stdlib verifier) is covered by `.gitignore:12
  .task-inputs/` and is not committed. All prepared inputs are preserved unchanged.
- No AWS/CFN/Docker/native-browser/SDK/Office/model/provider/socket/server call; no
  dependency install; no test replay; no network. Static inspection plus stdlib
  JSON/hash/Git reads only.
- `core.autocrlf=false`; the prepared input bytes are LF-exact and hashed as-is.

## Request / template property audit

Request `proposed-create-change-set.json` top-level keys are exactly:
`ChangeSetName`, `ChangeSetType`, `ClientToken`, `Description`, `Parameters`, `StackName`,
`TemplateBody`.

- `StackName` = `MeriGreenfield-NativeQualification` (the NEW stack) — correct.
- `ChangeSetType` = `CREATE` — correct; no `UPDATE`.
- No `Capabilities`, no `RoleARN`, no `Resources` (import), no `UsePreviousTemplate`,
  no `ImportExistingResources`.
- `Parameters` = the single `WorkerImage` entry above, byte-equal to `parameters.json`.
- `TemplateBody` is an embedded JSON string whose UTF-8 bytes are **exactly** the 6082-byte
  `template.json` (recomputed SHA256 `7895fa997a8521fe7adc03cb7c468b1987de8875518ae0d8ab6f284496b13080`,
  exact byte match). The body is the retained exact accepted offline output.

Template `template.json` top-level keys: `Description`, `Outputs`, `Parameters`,
`Resources`.

- `Resources` = exactly two, both `AWS::ECS::TaskDefinition`: `SdkTaskDefinition` and
  `OfficeTaskDefinition` (the two NEW IDs). No other resource of any type.
- `Outputs` = exactly two: `SdkTaskDefinitionArn` -> `{"Ref":"SdkTaskDefinition"}`,
  `OfficeTaskDefinitionArn` -> `{"Ref":"OfficeTaskDefinition"}`.
- `Parameters` = exactly one: `WorkerImage`, `Type: String`, **no `Default` key**,
  immutable-digest `AllowedPattern` bound to the exact new repository. Both task
  definitions reference the same `{"Ref":"WorkerImage"}`.
- No `Transform`, `AWS::Serverless`, `Custom::`/custom resource, `Fn::ImportValue`,
  `Fn::GetAtt`, `AWS::CDK::Metadata`, `BootstrapVersion`, asset parameter, lookup, secret,
  log-group, IAM/EC2/KMS/S3/SecretsManager/Route53/Lambda/Scheduler/Events resource,
  `AWS::ECS::Service`/`Cluster`, networking or bucket. The only `Capabilities` substring in
  the template text is the container `LinuxParameters.Capabilities.Drop: ["ALL"]`.

Per-definition properties (both identical except family/stream-prefix/command):

- Families `meri-greenfield-qualification-sdk` / `meri-greenfield-qualification-office`.
- `RequiresCompatibilities: ["FARGATE"]`, `NetworkMode: awsvpc`, `RuntimePlatform`
  `X86_64`/`LINUX`, `Cpu "2048"`, `Memory "8192"`, `EphemeralStorage {SizeInGiB: 50}`.
- `ExecutionRoleArn` / `TaskRoleArn` = the exact retained isolated role ARNs (immutable
  strings; no IAM resource declared, so nothing can attach a policy).
- Exactly one essential `worker` container: `User "10001:10001"`,
  `ReadonlyRootFilesystem: true`, `Privileged: false`, `StopTimeout: 60`,
  `LinuxParameters.Capabilities.Drop: ["ALL"]` and nothing else; no
  ports/healthcheck/secrets/hostname/devices/host namespaces.
- Fixed entrypoint/command: `EntryPoint ["node"]` and `Command`
  `["/opt/meri-worker/probes/sdk-capture.mjs"]` or
  `["/opt/meri-worker/probes/office-export.mjs"]`. No `runtime.mjs` reference anywhere, so
  the image entrypoint cannot run accidentally.
- Fresh empty `workspace` and `tmp` volumes (`Host: {}`; no EFS/Docker volume config)
  mounted writable only at `/workspace` and `/tmp`.
- Exactly the seven inert environment entries (`HOME`, `TMPDIR`, `CLAUDE_CONFIG_DIR`,
  `PLAYWRIGHT_BROWSERS_PATH`, `MERI_QUALIFICATION_ONLY=true`, `MERI_SOURCES_ENABLED=false`,
  `CHROMIUM_SANDBOX_REQUIRED=true`) and no others; no credential-bearing name.
- `awslogs` `mode=blocking`, group `/meri-greenfield/qualification/runtime`, region
  `us-east-1`, distinct prefixes `qualification-sdk` / `qualification-office`.

`scope.expectedFutureChanges` (`newStack`, two ADD IDs, resource type) is consistent with
the template above.

## Findings

No material defect found within this prepared-input review scope. The two source
distinctions the brief calls out are accurately represented and not overstated:

1. `AllowedPattern` is a URI-SHAPE guard only. It would accept the superseded `7327…`
   digest and the all-`a` placeholder (both shape-valid). It is not an image admission.
   The unused `parseWorkerImage` JS helper additionally refuses `7327…`, but it is not
   wired into synthesis and is not CloudFormation enforcement. The actual explicit
   owner-supplied `WorkerImage` parameter and the future reviewed change-set must enforce
   the exact digest — this review does not claim the template rejects old/fake images.
2. No `no-new-privileges` (NNP) claim is made; the role ARN reference is not fresh
   authority proof.

## Prerequisites before any mutation or execution (owner scope, NOT proven here)

1. Full fresh STS identity, new-name absence and current execution/worker role readbacks;
   the retained role-name strings are not current authority.
2. Actual all-ADD change-set review before any execution; a later service-add change-set
   is separate.
3. Owner full inspection and separate one-run admission/deadline/watchdog before any
   `RunTask`.
4. No `RunTask`, provider/source/browser/Office execution by this registration; no
   application/G2/G1 cutover claim.

## Limitations / residuals (explicitly not established)

- Local code inspection does NOT establish CloudFormation service-pattern behavior.
- A registered definition is NOT runtime admission; scanner counts, CPU/memory sizing and
  template bytes do not prove a working sandbox.
- The preserved old-14, the Windows-wrapper result and the broad-npm missing-`ajv` history
  were NOT re-run here; unchanged tests/synthesis/import modules were deliberately not
  replayed.
- The image is NOT_RUNTIME_OR_SECURITY_ACCEPTED; 49 scan findings (22 severe) remain OPEN,
  Office residual risk is DEFERRED and W02-14 enforcement is unaccepted.

## Verdict

**PASS** for the prepared DEFINITIONS-ONLY INPUT REVIEW scope. The prepared
template/parameters/change-set request are internally consistent, exact-byte reconciled to
the accepted offline template, additive-only (two NEW `AWS::ECS::TaskDefinition` resources
and two outputs, no default parameter, no import/update/capability/authority expansion), and
carry the exact reviewed attempt-3 digest only as an owner-supplied parameter. This PASS is
scope-limited: it is NOT runtime, security, deployment, service-pattern or gate acceptance.
Codex owns acceptance and any later cloud admission.
