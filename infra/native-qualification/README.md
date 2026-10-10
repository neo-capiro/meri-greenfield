# Native qualification task-definition definitions

Preparation-only CDK application for the two native Fargate probe *definitions* (SDK
wire capture and Office export). This is a bounded synthetic definition spike, not G2
foundation, not image admission and not a release.

`node infra/native-qualification/app.mjs` synthesizes ONE new, offline, deterministic
stack `MeriGreenfield-NativeQualification` for approved account 967807252336/us-east-1.
The stack declares exactly two `AWS::ECS::TaskDefinition` resources and two ARN outputs.
It creates no services, schedulers, IAM roles/policies, networking, log groups, secrets,
assets or lookups, imports nothing, and changes no existing Meri/Capiro resource.

## What it declares

- Families `meri-greenfield-qualification-sdk` and `meri-greenfield-qualification-office`.
- FARGATE / awsvpc / Linux X86_64, cpu 2048, memory 8192, ephemeral 50 GiB.
- Exactly one essential `worker` container per task: UID/GID `10001:10001`,
  `readOnlyRootFilesystem`, non-privileged, drop `ALL` capabilities, `stopTimeout` 60,
  no ports/healthcheck/secrets/hostnames/devices/host namespaces.
- Explicit `EntryPoint:["node"]` and `Command` `[/opt/meri-worker/probes/sdk-capture.mjs]`
  or `[/opt/meri-worker/probes/office-export.mjs]`, so the image's `runtime.mjs`
  entrypoint cannot run accidentally.
- Fresh empty `workspace` and `tmp` volumes, writable only at `/workspace` and `/tmp`.
- Inert environment only: `HOME`, `TMPDIR`, `CLAUDE_CONFIG_DIR`,
  `PLAYWRIGHT_BROWSERS_PATH`, `MERI_QUALIFICATION_ONLY`, `MERI_SOURCES_ENABLED`,
  `CHROMIUM_SANDBOX_REQUIRED`. No injected SDK/provider/AWS credential and no arbitrary
  configuration.
- `awslogs` logging with `mode=blocking`, group `/meri-greenfield/qualification/runtime`,
  region `us-east-1`, and distinct deterministic prefixes `qualification-sdk` /
  `qualification-office`.
- Two immutable string role references (execution + empty worker). No IAM resource is
  declared, so no imported role can gain a policy.

## Image parameter

`WorkerImage` is a required `String` CloudFormation parameter with **no default** and an
immutable-digest `AllowedPattern` for the exact new repository
`967807252336.dkr.ecr.us-east-1.amazonaws.com/meri-greenfield/qualification-worker`. Both
definitions reference the same parameter. The all-a digest shown in component-pins.json is
a prominently fake synthetic placeholder; it is never deployable and carries no admission.
`parseWorkerImage` (exported from `app.mjs`) is the offline validator and additionally
refuses the superseded, unaccepted baseline digest (old7327).

## Offline checks

Synthesis is pure and offline: no AWS call, context lookup, network, socket, server,
browser, SDK or Office execution. Importing the module is side-effect free; synthesis runs
only under the explicit CLI guard when the file is executed directly.

```
node infra/native-qualification/app.mjs                                   # deterministic synth
node --test infra/native-qualification/security.test.mjs                  # 14 offline shape/security tests
```

Synthetic output is written only to the ignored `.task-inputs/` scratch directory. These
pins were exercised against the shared read-only pinned dependencies; the root
`package.json`/`package-lock.json` reconcile to the shared checkout after line-ending
normalization only (the checkout is CRLF, this worktree is LF) — no dependency was
installed or modified.

## Owner run prerequisites (NOT proven by this definition synthesis)

Definition synthesis proves none of the following live facts. Before any launch the owner
must, separately and with independent review:

1. Finalize the reviewed image/source/digest and the security disposition.
2. Review the full all-ADD CloudFormation template and a change set; confirm only the two
   named task definitions are created.
3. Re-check current live IAM (execution role can pull the image and write logs only; worker
   role empty), network/DNS controls and a fresh exact STS identity.
4. Obtain a separate one-run admission and set the original launch deadline/watchdog
   **before** launch.
5. Run one task at a time in the existing isolated new cluster/subnet/SG with public IP
   disabled.
6. Capture complete paginated logs with stable tokens plus SDK/Office reconstruction,
   hash and visual evidence, and confirm task/child cleanup.

The image is not built and not admitted; no image, probe or G1 acceptance is claimed here.
