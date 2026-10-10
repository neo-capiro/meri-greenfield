# W02-10 native Fargate probe definitions

Hermes bounded implementation writer, bounded completion session. Preparation only. This
ticket prepares two new ECS task-definition *definitions*; it authorizes no image/probe
admission, no AWS call and no G1 promotion. The image is still unbuilt and unaccepted.
Definition synthesis proves none of the live IAM/network/DNS/STS facts required before any
launch. A separate Hermes review and independent Codex acceptance are still required; this
report claims no launch and no gate pass.

## Basis

- Base commit (pinned): `5e606c7618e9ef38f7f1fba39e521edb7b6da511`.
- Branch / worktree: `hermes/w02-native-probes` / `C:\dev\main\meri-greenfield-worktrees\w02-native-probes`.
- Owned files: the five allocated NEW paths only. Scratch and synthetic output stayed in
  the ignored `.task-inputs/` directory; no other untracked path was created.

## Dependency reconciliation (read-only)

The worktree root `package.json` and `package-lock.json` reconcile to the shared checkout
`C:\dev\main\meri-greenfield-kickoff-20261009`:

| file | worktree raw sha256 | kickoff raw sha256 | normalized (LF) sha256 |
| --- | --- | --- | --- |
| package.json | `af1c6ca64af37febe9950a6beaf996d7dd0b4a1cfce54b2409c200b8c48aea60` | `272aa39691aabab8bd977b9f76e2b79ab934242c92c05bfbb045e9ed638c5c94` | both `af1c6ca64af37febe9950a6beaf996d7dd0b4a1cfce54b2409c200b8c48aea60` |
| package-lock.json | `b2293773bf4ddc6d23425b7d718b79575384679999b86fd3caad78e6eda4a42d` | `6ebc34334a3c00482b954241d3b8cb1b2fa6125ef5630525c75d5d8ce122c327` | both `b2293773bf4ddc6d23425b7d718b79575384679999b86fd3caad78e6eda4a42d` |

Raw bytes differ by line endings only (the shared checkout is CRLF, this worktree is LF
per `* text=auto eol=lf`); after stripping CR the hashes are identical. This is NOT byte
identity — it is normalized identity. An ignored local `node_modules` junction to that
checkout's `node_modules` was reused read-only. Installed versions confirmed:
aws-cdk-lib `2.273.0`, aws-cdk `2.1145.0`, constructs `10.8.1`. No dependency was installed
or modified.

## Role reconciliation (required check)

The brief's two ARNs were reconciled exactly against the single permitted private evidence
file `docs/coordination/private-evidence/W02-fargate-baseline-3-run/task-definition.json`:

- execution role `arn:aws:iam::967807252336:role/MeriGreenfield-QualificationR-ExecutionRole605A040B-kL3yc2CIalc3` -> **exact match**
- empty worker role `arn:aws:iam::967807252336:role/MeriGreenfield-Qualificatio-EmptyWorkerRole7C03C4DD-nOWJZv6LQdqD` -> **exact match**

No discrepancy. Both are used as immutable string references; no IAM resource is declared,
so no imported role can gain a policy. Existing role names are not authorization; the live
IAM/network checks and fresh STS remain owner admission steps outside this ticket.

## Synthesized stack

`node infra/native-qualification/app.mjs` synthesizes one deterministic, offline,
bootstrapless stack `MeriGreenfield-NativeQualification` (967807252336/us-east-1):

- Exactly two `AWS::ECS::TaskDefinition` resources (families
  `meri-greenfield-qualification-sdk` and `meri-greenfield-qualification-office`) and two
  ARN outputs. No other resource; no services/schedulers, IAM roles/policies, networking,
  log groups, secrets, lookups, assets or imports.
- Both use the required `WorkerImage` parameter (`{"Ref":"WorkerImage"}`): type String, NO
  default, immutable-digest `AllowedPattern` for the exact new qualification repository. The
  all-a digest in the constraint description / component-pins is a prominently fake
  synthetic placeholder and is never treated as image admission. `parseWorkerImage`
  additionally refuses the superseded, unaccepted baseline digest (old7327).
- Each task: FARGATE/awsvpc/Linux X86_64, cpu 2048, memory 8192, ephemeral 50 GiB; one
  essential `worker` container, UID/GID `10001:10001`, read-only root, non-privileged, drop
  `ALL`, stopTimeout 60, no ports/healthcheck/secrets/hostnames/devices/host namespaces;
  explicit `EntryPoint:["node"]` and the exact probe `Command` (so `runtime.mjs` cannot run);
  fresh empty `workspace`/`tmp` volumes writable only at `/workspace` and `/tmp`; the seven
  inert environment entries; `awslogs` `mode=blocking` to
  `/meri-greenfield/qualification/runtime` with distinct deterministic prefixes
  `qualification-sdk` / `qualification-office`.

Synthetic template: `.task-inputs/cdk.out/native-qualification/MeriGreenfield-NativeQualification.template.json`,
6082 bytes, sha256 `7895fa997a8521fe7adc03cb7c468b1987de8875518ae0d8ab6f284496b13080`
(determinism anchor, not deployment evidence). CDK validation report: no findings.

## Files and hashes (sha256)

- `infra/native-qualification/app.mjs` — `7b452601b5ecd5cf932149b7104bc8a36d76f1f064d5a6432829c95dd9ecd611`
- `infra/native-qualification/security.test.mjs` — `cb31fe1efcd5c8d065c0eca13458350a402599087f0031b856ec4926bea9b069`
- `infra/native-qualification/component-pins.json` — `38fea4364c4be6f672ec626bebe73f2e41dfe1761af11339ca659bbd267ebf82`
- `infra/native-qualification/README.md` — `6f5fbd382f23757b91e650194fae5268770572b52be62820ca160172cde81162`
- `docs/coordination/reports/W02-10-NATIVE-FARGATE-PROBES.md` — this file (hash in the commit).

`app.mjs` differs from the first-session uncommitted artifact
`05e6245ef48c44bfeee529119e52d570b807dd8a0a942788433227c944a073eb`: the `aws-cdk-lib`
named-export bug was fixed (`aws_ecs as ecs` -> `ecs.CfnTaskDefinition`) and synthesis was
moved behind an explicit CLI guard so importing the module is side-effect free.

## Checks actually run

- `node infra/native-qualification/security.test.mjs` — **14/14 pass**, 0 fail. Covers exact
  resource/role/image/entrypoint/volume/mount/logging/platform shape, single hardened
  container, inert environment, no IAM/network/log/secret/asset/lookup expansion, required
  no-default immutable parameter, deterministic re-synthesis, and `parseWorkerImage`
  accept/reject (wrong repo/account/region/tag/length/uppercase, and the superseded digest).
- `npm run check` (root15) — **15/15 pass**, 0 fail.
- `npm run check:infra` (infra6) — **6/6 pass**, 0 fail.

`npm run check:infra` re-synthesizes the pre-existing `infra/qualification` app into the
git-ignored `cdk.out/` directory (existing accepted behavior); no tracked file changed.

## Limits and residuals

- The image is not built and not admitted; the parameter value is owner-supplied at deploy
  time and is never an accepted candidate here. No old7327 candidate is accepted.
- Synthesis proves none of: live IAM/empty-role behavior, network/DNS controls, fresh STS
  identity, task/child cleanup, CloudWatch delivery, or SDK/Office reconstruction. Those are
  owner admission steps.
- Determinism identity above is normalized-line-ending identity for the root manifests, not
  raw byte identity.
- G1, G2 and any deployment remain unpromoted. No cutover, no production change.

## Owner run prerequisites (recorded, not executed)

1. Finalize the reviewed image/source/digest and security disposition.
2. Review the full all-ADD CFN template and change set; confirm only the two named task
   definitions are created.
3. Re-check live IAM (execution pull+logs only, worker empty), network/DNS and a fresh exact
   STS identity.
4. Obtain a separate one-run admission and set the original launch deadline/watchdog before
   launch; one task at a time in the existing isolated new cluster/subnet/SG with public IP
   disabled.
5. Capture complete paginated logs with stable tokens plus SDK/Office reconstruction,
   hash and visual evidence, and confirm task/child cleanup.
