# Meri first-chat ship kit for 205eead4c18882e4fc0e6c016c10dc4e5dd8c45c

Made 2026-10-22T12:15:32.871Z by make-ship-kit.mjs. Kit directory `C:/dev/fable/ship-205eead4`, clean source worktree `C:/dev/fable/ship-src-205eead4`.
Image build attempt `f11332108c34923aebd2565dae3a63a0`, measurement attempt `36622fcb862c1f79243f1bc9141f1981`, secret label `FIRST_CHAT_20261022B`,
private working directory `C:/dev/fable/meri-stage3-20261022T121427Z` (created by step 11; never inside a repository).

Already done here (no AWS mutation): seal (archive `275a24a2ab2500817116d23c49eeeb14acb83158539ef1553372dd5f3f57e2c3`, manifest `c5c009587576be3a9b9b188cabf8026812db04aacacc9e5b51ab471db7f01e8c`, 20716 files);
runnerSha256 `174e66b2c24034fc6ccb3a406daa26874a8f3c56164ce80e9d60f419d567f542` (git blob); measurement packet copied from `origin/handoff/runner-diagnostic-release-20261020` with its two source pins set to this commit
(verifier pin unchanged and still valid); C baseline and release E deployment inputs; dry request through the real verifier, recipe and
size check (`dry/`); read-only readbacks in `readback/` (services, latest revisions, stacks, outputs, live app template, secret label metadata).

Run each script from Git Bash in order. MUTATING and PRIVATE steps are the operator's. Every step prints its plan first,
refuses on wrong state, and writes its evidence into this directory (private outputs go only to the private working directory).

| # | Script | Kind | Does | Gate |
| --- | --- | --- | --- | --- |
| 1 | `01-source-put.sh` | MUTATING | S3: two create-only KMS objects (sealed source zip + manifest) | HEAD matches length, SHA256 and KMS for both |
| 2 | `02-build-request.sh` | local | request.json, verifier, recipe, size check, start request (no AWS write) | image-build-source.py verify exit 0; buildspec within 25 600 B |
| 3 | `03-image-build.sh` | MUTATING | CodeBuild: ONE product image build (30/5/0) | build id recorded; no other build active; tag new |
| 4 | `04-image-readback.sh` | read-only | wait for the build; authenticate receipt, ECR digest/tag, scan; write candidate deployment inputs | SUCCEEDED; scan COMPLETE with 0 HIGH / 0 CRITICAL; runnerSha256 joins |
| 5 | `05-measurement-prepare.sh` | local | prepare the launch-measurement payload | OFFLINE_MEASUREMENT_PAYLOAD_PREPARED_AWAITING_VERSION_PIN |
| 6 | `06-measurement-payload-put.sh` | MUTATING | S3: one create-only KMS payload object | payload-pin.json written from authenticated HEAD |
| 7 | `07-measurement-finalize.sh` | local | finalize the measurement start request | OFFLINE_MEASUREMENT_REQUEST_FINALIZED |
| 8 | `08-measurement-build.sh` | MUTATING | CodeBuild: ONE measurement build (10/5/0), no model request | build id recorded |
| 9 | `09-measurement-readback.sh` | read-only | wait; download six results; verify joins; assemble runtime values | MEASUREMENT_VERIFIED_AND_ASSEMBLED |
| 10 | `10-stage3-input.sh` | read-only | latest revisions and predicted task definitions | stage3.json written |
| 11 | `11-private-core.sh` | PRIVATE | bearer read, Core membership POST, core.json (operator only) | membership HTTP 200; summary exit 0; core-values written |
| 12 | `12-private-render.sh` | PRIVATE | certificate check, revisions unchanged, render five roles (operator only) | MERI_FIRST_CHAT_MATERIAL_RENDERED; verify-rendered exit 0 |
| 13 | `13-secret-upload.sh` | MUTATING | Secrets Manager: five new versions under a new label only | new versions carry only the label; all earlier labels unchanged |
| 14 | `14-bindings.sh` | read-only | live outputs and app template; bindings; pre-deploy ship packet | STAGE3_BINDINGS_WRITTEN; SHIP_PACKET_WRITTEN |
| 15 | `15-changesets.sh` | MUTATING | CloudFormation: create (not execute) model, issuer and app change sets | only TaskDefinition/Service changes |
| 16 | `16-execute-model.sh` | MUTATING | stop owner+proxy, execute model, start both; owner/proxy gate | 1/1/0 on rendered revisions, 120 s, one Cloud Map instance each, PAIR_READY (75 s quiet) |
| 17 | `17-execute-issuer.sh` | MUTATING | execute issuer; issuer gate; then run 18 immediately | 1/1/0, runtime.listening |
| 18 | `18-execute-app.sh` | MUTATING | execute app; control/worker gate | 1/1/0, runtime.listening, both target groups healthy |
| 19 | `19-verify.sh` | read-only | verify-outputs and public health | STAGE3_TASK_DEFINITIONS_MATCH_RENDER; HTTP 200 |

Notes
- Builds: an uncertain StartBuild is read back (`aws codebuild list-builds-for-project`), never resubmitted. A failed build stops the kit.
- 11 needs `--client-id <uuid>` only when the membership lists several clients: run `node kit.mjs 11-private-core --client-id <uuid>` from this directory.
- 12 must follow 11 within 15 minutes and refuses if any task-definition revision changed since 10.
- 13 refuses if `FIRST_CHAT_20261022B` already exists on any material secret, or a secret is at 100 versions or 20 labels; retries reuse the plan's fixed tokens.
- 15 creates all three change sets first so 17 -> 18 runs back to back (the issuer refuses unpinned control/worker revisions until the app lands).
- A failed or rolled-back stack update burns the rendered revisions: stop, then re-render under a new label (rerun from 10 with a new kit only after review).
- Rollback = forward redeploy of release E (`release-E.deployment-inputs.json`) through the same steps with a new label; not UpdateService.
- Do not deploy the foundation stack in this cycle.
