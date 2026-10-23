---
name: reference-meri-in-image-test-recipe
description: "How to run meri-greenfield tests and the real Claude CLI INSIDE the deployed runner image (WSL2 Docker) with runner task-def constraints, plus the WSL clock-step trap that fakes failures"
metadata:
  node_type: memory
  type: reference
  originSessionId: 8ea69adf-d918-4e1a-8e90-fddb5c405451
  modified: 2026-10-21T16:07:49.748Z
---

Run tests/CLI inside the exact Meri runner image (D1 preflight, 2026-10-20):
- Pull read-only: `aws ecr get-login-password --profile capiro-dev` → temp file → `docker login --password-stdin` in WSL `Ubuntu-24.04` → delete file → pull by digest (`meri-greenfield/qualification-worker@sha256:...`).
- Constraints from `describe-task-definition meri-product-preview-runner:<rev>`: `--read-only --user 1000:1000 --cap-drop ALL --cpus 1 --memory 2g`, tmpfs (uid=1000) for `/workspace`, `/tmp`, `/run/meri`; `--network none --add-host proxy.meri.internal:127.0.0.1` for a local fake provider.
- `.dockerignore` strips most test dirs from the image: bind-mount the worktree's test dirs read-only at `/opt/meri/<dir>`, and for the 24-case Linux gate also `apps/gateway/test` (gate FIXTURE_PATHS). To test a source fix in-image, bind-mount the changed source file over the image copy.
- Harness/scripts kept in `C:\dev\fable\adj-reports\adj-b-D1-evidence\scripts\` (run-cli.sh, run-sdk.sh, cli-preflight.mjs, fake-provider.mjs).

**Trap:** WSL2 Docker wall clock can step BACKWARDS 1–2.5 s; operation lifetimes then refuse (`REMOTE_TASK_REFUSED`) and TLS certs with notBefore=now become "not yet valid". Symptom: a call's done-time < sent-time. Re-run before believing any timing failure. Measured 2026-10-21: `Date.now()` stepped back 1,608 times in 60 s (max 1,047 ms) inside a container; Windows 0. It fakes `INITIAL_INPUT_EXPIRED`, `NATIVE_EXECUTION_RESTORE_UNKNOWN` and `NATIVE_COMPLETION_CAPTURE_UNKNOWN` in composed next-turn tests, which pass 8/8 on Windows; a 60 s `setInterval` probe of `Date.now()` proves it in a minute.
- **Also fakes authority refusals** (10-20 deadline sweep). The context adapter requires `checkedAtMs ≥ call start` with zero tolerance, so a −457 ms step refused a delta publish 40 ms later (NATIVE_AUTHORITY_UNAVAILABLE / SESSION_REFUSED). The activity then fenced and failed `HOLD_CONTROL_MISSING`.
- **Steps happen under load:** concurrent containers, or Node tests running on the Windows host at the same time.
- **Run one rehearsal container at a time.** The first-turn and D3 rehearsals on `fable/adj-sweep-deadlines-20261020` record `clockSteps`; a run with one is void.
- In the image, `chown` only non-`node_modules` files (`find … -name node_modules -prune -o -exec chown`). A full `chown -R` copies up the whole image layer and adds minutes.

**Gate without building an image** (C8 review, 10-21; scripts in `adj-reports/adj-e-notes/c8/`):
- Take an existing runtime image with the same dependencies (check there is no `package*.json`/Dockerfile diff), e.g. `meri-p0-runtime:69fd19945c6f`.
- Bind-mount read-only over it: the production files changed since that image, plus the 10 `FIXTURE_PATHS`.
- Run the 3 gate files with the build reporter, `--read-only`, uid 1000.
- - **Prefer an image built AT the base** when one is local (`docker images | grep meri-p0-runtime:<sha12>`, e.g. `3c56c3e981ba`): then only the branch's own files need mounting. C11 recipe: `adj-reports/adj-e-notes/c11/c11-linux.sh` (gate, then 218 node/pg files, then proxy python).
- **Openssl-dependent composed router suites:** the runtime image has no openssl. Run them in `pgvector/pgvector:pg16` (has `/usr/bin/openssl`) with the image's node and a copy of `/opt/meri`. Include `docs/`: the PG suites import `docs/qualification/...`.

**Known pre-existing flakes** (fail at base `62a7495d` too; 10-20 capture-chain review):
- `native-start-router-budget` "reproduction": `remainingMs` > 0, about 3/26 at base.
- `worker-load-retention` "deadline during release …": a 200 ms deadline race, about 2/5.
- 10-21 (C8 review): every case in that file flakes, a different one each run, on base and head alike ("nested authority call…", "reproduction…", "native start completes…").
- Before blaming a branch, interleave head/base runs: it differed 8/27 vs 3/26 when run sequentially, but 2/10 vs 1/10 interleaved.

**Why:** the production CLI had never been run in-image before 10-20; this recipe proved it works and reproduced the runner's `code=UNKNOWN`. Related: [[project-meri-native-start-unknown-pinned-transport]], [[reference-meri-greenfield-windows-test-env]]
