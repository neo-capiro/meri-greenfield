---
name: reference-portfolio-preview-frontend-ship-flow
description: "How capiro-frontend reaches portfolio-preview (revs 12-18), the ship-kit generator, rollback limits, and the stale browser specs that fail on serving"
metadata:
  node_type: memory
  type: reference
  originSessionId: 8ea69adf-d918-4e1a-8e90-fddb5c405451
  modified: 2026-10-20T11:05:44.575Z
---

**Flow** (every release, revs 12–18, read back 2026-10-20):
1. `git -c core.autocrlf=false archive --format=zip` of the commit.
2. The commit's own `scripts/verify-preview-archive.py` appends `source-commit.txt` and checks every member against its Git blob.
3. Put the zip as a NEW VERSION of `s3://capiro-portfolio-preview-source-967807252336-us-east-1/inputs/portfolio-source.zip` (one key, versioned, SSE-S3).
4. CodeBuild `capiro-portfolio-preview-build` with a one-shot `buildspecOverride` and env `EXPECTED_SHA`/`EXPECTED_S3_VERSION` (the build pins `CODEBUILD_SOURCE_VERSION`).
5. The image lands in ECR `capiro/portfolio-preview` with tag = commit. Tags are IMMUTABLE and there is no lifecycle policy.
6. The operator reads the scan back with `describe-image-scan-findings`, since the build role lacks it. `describe-images` shows no summary under BASIC registry scanning. The gate is 0 findings.
7. A change set on stack `Capiro-Portfolio-Preview-Service` (cluster/service `capiro-portfolio-preview`, container `portfolio-web:5188`, health `/healthz`), with only `ImageUri` changed.

**Rev 18** = `67fdf56b`:
- CodeBuild `8b5264dc` by dot; two failed attempts before it.
- Change set `meri-fe18-67fdf56b`.
- Its buildspec pins `apps/web/Dockerfile` `b737adc8…` plus an awk build-heap patch `e6178ba2…`.
- The live template equals `C:\dev\fable\frontend-meri-wire\REVIEWED_PREVIEW_TEMPLATE.yml` and has no NoEcho parameters.

**Kit**:
- `node C:/dev/fable/ship-fe-kit/make-fe-ship-kit.mjs <sha> --worktree <clean wt> --label <x> [--tests …] [--browser-specs …]` writes `C:/dev/fable/ship-fe-<sha8>`.
- The kit has steps 00–08 plus `R1-rollback-to-<rev>`. The generator runs 00–02 itself; `02b-rehearse` runs the buildspec in WSL Docker. Mutating steps run only through their `.sh` (`--execute`).
- First kit: `87d804bc`, 10-20. See [[project-meri-greenfield-fable-shipping]].

**Traps**:
- CloudFormation DEREGISTERS the old task-def revision when an update completes; revs 11–17 are INACTIVE. "Rollback to :N" after completion means a change set with the recorded rev-N parameters, which registers rev-N content as a new revision. During the rollout, use `cancel-update-stack`. The ECS circuit breaker (rollback on) reverts failed tasks by itself.
- The shared Windows `node_modules` in `C:\dev\fable\capiro-frontend` junctions `@capiro/meri-client` to another worktree and has meri-contracts 0.1.8. Test a commit in WSL2 with a fresh `npm ci --ignore-scripts` (31 s) instead.
- At `67fdf56b`, 22 browser specs fail on serving itself. They are stale and are not in any build:
  - `meri-conversation-host.spec.ts:38` expects history body `{limit:100}`; the app now sends `{after:0,limit:100}`.
  - 20 `meri-files-*` tests expect the session in `Authorization` instead of `X-Meri-Action-Session`.
  - `meri-task-command-workflow:12`.
  - Compare against the serving commit before calling a failure a regression.
- The Windows AWS CLI needs `PYTHONUTF8=1` to print the app's `▲`/`✓` log lines.
- The first `python.exe` on PATH is a tool venv. Use the py-launcher CPython at `C:/Users/neoma/AppData/Local/Python/pythoncore-3.14-64/python.exe`.
