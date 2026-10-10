# W02-10 native Fargate probe definitions — independent review 1

REPORT-ONLY. Separate real Hermes reviewer. This document records an independent
STATIC/SYNTHETIC audit of exact candidate commit
`390903a0ffddedb61bba5c8a47562864be7633c2` (branch `review/w02-native-probes-1`,
worktree `C:\dev\main\meri-greenfield-worktrees\w02-native-probes-review-1`). It records no
acceptance, no deployment, no merge/push, no image/probe admission and no gate promotion.
Independent Codex owner verification and decision are still required.

## Scope and constraints honored

- Candidate pinned base: `390903a` parent = `5e606c7618e9ef38f7f1fba39e521edb7b6da511`
  (matches the brief's pinned base). Verified via `git rev-parse 390903a^`.
- The commit adds exactly the five allocated paths, all purely additive (121/78/191/103/269
  insertions, 0 deletions): the two `infra/native-qualification/*` sources + pins + README,
  and `docs/coordination/reports/W02-10-NATIVE-FARGATE-PROBES.md`. No other tracked path
  changed; worktree was clean at start.
- Review was pure/static/synthetic: no AWS/Docker/native browser/SDK/Office/model/provider/
  socket/server/network/download/credential call, no dependency install, no IAM import
  mutation, no writes outside this worktree's ignored `.task-inputs/`. The only private
  source read was the single permitted file
  `docs/coordination/private-evidence/W02-fargate-baseline-3-run/task-definition.json`.

## Dependency / source context (disclosed)

This review worktree has NO `node_modules`. Per the brief, source/package/lock were compared
against `C:/dev/main/meri-greenfield-worktrees/w02-native-probes` and that worktree's
installed root-junction deps were used READ ONLY.

- Sibling worktree is at the SAME commit `390903a`, clean, with the same five source files
  byte-identical (sha256 verified on disk — see table). `node_modules` is a symlink to the
  shared checkout `C:/dev/main/meri-greenfield-kickoff-20261009/node_modules`.
- Installed versions confirmed by resolving through that junction:
  `aws-cdk-lib 2.273.0`, `aws-cdk 2.1145.0`, `constructs 10.8.1` — matching the brief.
- `package.json` / `package-lock.json`: this review WT and the sibling WT are IDENTICAL both
  raw (`af1c6ca6…` / `b2293773…`) and after LF-normalization. This is normalized/identity
  equality, NOT byte-identity with the CRLF kickoff checkout. No dependency was installed or
  modified.

## File hashes (sha256, committed = on-disk)

| path | sha256 | report claim |
| --- | --- | --- |
| `infra/native-qualification/app.mjs` | `7b452601b5ecd5cf932149b7104bc8a36d76f1f064d5a6432829c95dd9ecd611` | MATCH |
| `infra/native-qualification/security.test.mjs` | `cb31fe1efcd5c8d065c0eca13458350a402599087f0031b856ec4926bea9b069` | MATCH |
| `infra/native-qualification/component-pins.json` | `38fea4364c4be6f672ec626bebe73f2e41dfe1761af11339ca659bbd267ebf82` | MATCH |
| `infra/native-qualification/README.md` | `6f5fbd382f23757b91e650194fae5268770572b52be62820ca160172cde81162` | MATCH |
| `docs/coordination/reports/W02-10-NATIVE-FARGATE-PROBES.md` | `9526bb7107474bb9c5f3cd556af76d882a4e88a18e710510f7b7c5a6fbae6ae3` | report notes "hash in the commit" |

## Role reconciliation (required check vs private evidence)

Against `docs/coordination/private-evidence/W02-fargate-baseline-3-run/task-definition.json`:

- `executionRoleArn` = `arn:aws:iam::967807252336:role/MeriGreenfield-QualificationR-ExecutionRole605A040B-kL3yc2CIalc3` — EXACT match with `EXECUTION_ROLE_ARN`.
- `taskRoleArn` = `arn:aws:iam::967807252336:role/MeriGreenfield-Qualificatio-EmptyWorkerRole7C03C4DD-nOWJZv6LQdqD` — EXACT match with `WORKER_ROLE_ARN`.

No discrepancy. Both are emitted verbatim as immutable string references; no `AWS::IAM::Role`
or `AWS::IAM::Policy` resource exists, so no imported role can gain a policy.

## Independent synthesis evidence

Independent reviewer driver (in ignored `.task-inputs/review/`, importing the
candidate-exact `app.mjs` and calling its exported `synthesize(outdir)` with output redirected
into THIS review worktree's scratch) reproduced, twice deterministically:

- Template: `MeriGreenfield-NativeQualification.template.json`
- Bytes: `6082`; sha256 `7895fa997a8521fe7adc03cb7c468b1987de8875518ae0d8ab6f284496b13080`
- This EXACTLY matches `component-pins.json` (`templateBytes` 6082, `templateSha256` 7895fa99…)
  and the PROBES report.
- `Resources` = { `SdkTaskDefinition`, `OfficeTaskDefinition` }, both `AWS::ECS::TaskDefinition`.
- `Parameters` = { `WorkerImage` } only. `Outputs` = { `SdkTaskDefinitionArn`, `OfficeTaskDefinitionArn` }.
- Cloud-assembly `validation-report.json` = `{ version, title: "Validation Report", pluginReports: [] }`
  → "no findings" claim is TRUE. Manifest lists only stack/tree/feature-flag artifacts — no assets.

## Template audit (independent, full read)

Confirmed in the emitted template: only two `AWS::ECS::TaskDefinition` resources; no
`AWS::IAM::*`, `AWS::EC2::*`, `AWS::Logs::*`, `AWS::KMS/S3/SecretsManager/Route53/Lambda/
Scheduler/Events::*`, `AWS::ECS::Service/Cluster`, `Fn::ImportValue`, `Fn::GetAtt`,
`BootstrapVersion` or `AWS::CDK::Metadata` (BootstraplessSynthesizer). `WorkerImage` is
`String`, has NO `Default` key, and an immutable AllowedPattern bound to the exact new repo
`967807252336.dkr.ecr.us-east-1.amazonaws.com/meri-greenfield/qualification-worker`. Both
task definitions reference the same `{"Ref":"WorkerImage"}`. Each task: FARGATE / awsvpc /
Linux X86_64, cpu 2048, memory 8192, ephemeral 50 GiB (Volumes `Host:{}` fresh, no EFS/docker
volume config); one essential `worker` container, `User 10001:10001`,
`ReadonlyRootFilesystem true`, `Privileged false`, `StopTimeout 60`, `Capabilities.Drop:[ALL]`
and nothing else (no tmpfs/devices); no PortMappings/Secrets/HealthCheck/Hostname/
DockerSecurityOptions/ExtraHosts/SystemControls/CredentialSpecs/RepositoryCredentials/
DnsServers/DnsSearchDomains/VolumesFrom/Ulimits. Explicit `EntryPoint:["node"]` and `Command`
`["/opt/meri-worker/probes/sdk-capture.mjs"]` / `["/opt/meri-worker/probes/office-export.mjs"]`
— no `runtime.mjs` reference anywhere. Seven inert env entries only. `awslogs` `mode=blocking`
to `/meri-greenfield/qualification/runtime` in `us-east-1` with distinct prefixes
`qualification-sdk` / `qualification-office`.

## Source distinction (IMPORTANT) — handling is correct

- The CloudFormation `AllowedPattern` validates URI SHAPE only: a JS reproduction confirmed it
  ACCEPTS both the prominently-fake all-a digest AND the superseded old7327 digest
  (`7327f04…0d75`, 64 hex), and rejects a tag / other repo. So the CFN pattern is a shape guard,
  not an image admission.
- `parseWorkerImage` is an UNUSED offline helper (not wired into synthesis; only tests call it).
  It additionally rejects the old7327 digest. This is the exact source distinction the brief
  called out and it is accurately represented: nothing claims CFN rejects old/fake images, and
  no claim treats a JS regex as proving CloudFormation runtime semantics.
- Neither digest is an admitted image; owner's exact digest + reviewed change-set gate remains
  mandatory. The preliminary Codex newline-bypass hypothesis has no code counterpart and is not
  a finding.

## Checks actually run (source/dependency context disclosed)

Run in the sibling worktree `w02-native-probes` (SAME commit `390903a`; the five source files
there are byte-identical to the candidate; root-junction `node_modules` used READ ONLY):

- `node --test infra/native-qualification/security.test.mjs` — **14/14 pass, 0 fail**.
- `npm run check` (root15) — **15/15 pass, 0 fail**.
- `npm run check:infra` (infra6) — **6/6 pass, 0 fail** (re-synthesizes the PRE-EXISTING
  `infra/qualification` app into the git-ignored `cdk.out/`; no tracked file changed).
- Sibling worktree `git status` remained clean after all checks.
- Side-effect scan of `app.mjs`/`security.test.mjs`: no `fromAsset`/`Lookup`/`valueFromLookup`/
  `Token`/`child_process`/`spawn`/`execSync`/`process.env`/`http`; test uses `readFileSync`
  only to read the synthesized template. The only `socket` hits are comment text "no network/socket".

## Findings

No material discrepancy found. Independent synthesis reproduces the claimed template hash
exactly; role ARNs reconcile verbatim; family/entrypoint/command/env/volume/logging/parameter
shape matches the brief; resources are exactly two task definitions with no authority
expansion; the CFN-vs-offline-validator distinction is accurately represented.

## Residuals / not proven here (owner admission scope, NOT run)

Full native/image/security/one-run admission, watchdog-before-launch, reconstruction, visual
and cleanup evidence remain UNRUN — definition synthesis proves none of those live facts. Live
IAM/empty-role behavior, network/DNS controls, fresh STS identity, one-run deadline/watchdog,
CloudWatch delivery and SDK/Office reconstruction are owner steps. The worker image is not
built/admitted; image is owner-supplied at deploy time. G1/G2 and any deployment remain
unpromoted. No AWS action was taken in this review.

Verdict: **NO DEFECT FOUND within this static/synthetic review scope; report-only.** Independent
Codex owner verification/decision still required.
