# Fable resume at dot's handoff pin: pickup, Linux fixture rerun, baseline and composed first-chat rehearsal

Pin `215930c8092577e84da563b1496d1cca9a4ad4d7` (tree `70aeef73e9d8a1ba8592787a1cd1cac115b6ed85`; apps `361be12c62285f7c8757065eb14e8e070928e520`, packages `3d9f128f3197a4e267812f6b40bb64bd9a47bf58`, scripts `561906992b75f484cd74785f94dd0a73f228d262`), fetched from `origin/dot/meri-handoff-to-fable-20261015` into the new worktree branch `fable/meri-resume-20261015`. `1003f12d` and `700f203e` verified as ancestors; worktree clean before the runs. Author: Fable. This directory answers dot's ordered tasks 1 and 2 (`DOT-HANDOFF-TO-FABLE-20261015.md` §9) and records the composed first-chat rehearsal at the pin. Nothing here is image, native-provider, Temporal-server or live acceptance; all native, task, session and object ports in the runtime fixtures are synthetic, and the composed rehearsal uses the real CLI with a zero-turn prompt over local disposable PostgreSQL.

## Environment

Linux 6.18 container, Ubuntu 24.04.5, non-root user `meri` (uid 30033), Node 24.21.0 (`/opt/nvm/versions/node/v24.21.0/bin/node`), PostgreSQL 16.15 local Unix-socket clusters provisioned fresh for this pin under `/tmp/meri-resume-pg-20261015` by `provision-postgres.sh start --data …` (initdb, trust auth, fsync off, migrations 0001–0009 applied from the pin, including dot's `completion_checkpoints` and sequence ranges), private `TMPDIR=/home/meri/resume-tmp` (mode 700), process environment cleared (`env -i`) with only `HOME`, `PATH`, `TMPDIR` and the `MERI_*` fixture selectors. Node dependencies were copied from the PR86 worktree because every lock file is byte-identical between `700f203` and the pin (`git diff --stat 700f203 215930c -- '**/package-lock.json'` is empty); root links recreated with `link-dependencies.sh`. Docker is present but the image-closure control is a known host failure (no daemon access for the non-root user).

## Results

| Check | Command (as uid 30033, cwd worktree) | Receipt | Result |
| --- | --- | --- | --- |
| Fixture syntax | `node --check apps/runtime/test/process-fixture.mjs`, `node --check apps/runtime/test/process.test.mjs` | stdout in `checks/process.test.log` header | pass |
| Repaired process suite | `node --test --test-isolation=none --test-concurrency=1 apps/runtime/test/process.test.mjs` | `checks/process.test.log` | 7/7, 0 skipped, 0 cancelled; includes the canonical completion capture, the exact completion replay and the 503 current-authority refusal |
| Broader runtime composition | `node --test --test-isolation=none --test-concurrency=1 apps/runtime/test/runtime.test.mjs apps/runtime/test/process.test.mjs` | `checks/runtime-process.test.log` | 15/15, 0 skipped |
| Source proofs | `node --test --test-isolation=none --test-concurrency=1 scripts/qualification/assembled-image/source-proof.test.mjs` | `checks/source-proof.test.log` | 5/5 |
| Baseline suites, first run | `run-suites.mjs --only source-proof,runtime-typecheck,conversations-typecheck,runtime-tests,conversations-tests,worker-conversation,control-core,scripts-local` | `checks/RESULTS-baseline-first-run.json` | source-proof 5/5; runtime-typecheck pass; conversations-typecheck pass; runtime-tests 167/168 (Docker control); conversations-tests 207/246; worker-conversation 106/107; control-core 95/103; scripts-local 27/27 |
| Conversations rerun | same runner, `--only conversations-tests`, with `MERI_SEQUENCE_MIGRATION_TEST_ISOLATED=1` and `MERI_SEQUENCE_MIGRATION_TEST_DATA_DIRECTORY=/tmp/meri-resume-pg-20261015/kickoff` | `checks/RESULTS-conversations-isolated.json` | 246/246 |
| Worker and control-core rerun | same runner, `--only worker-conversation,control-core`, after copying the root `node_modules` tree | `checks/RESULTS-worker-control-rerun.json` | worker-conversation 138/138; control-core 260/260 |
| Composed first-chat rehearsal, script unchanged since `700f203` | `MERI_REVIEW_SOURCE_ROOT=$PWD MERI_REHEARSAL_RECEIPT=… node --test scripts/qualification/first-chat-rehearsal/composed-rehearsal.mjs` | `rehearsal/composed-at-pin.json`, `rehearsal/composed-at-pin.stdout.txt` | 2/2: first chat `completed` with the real CLI 2.1.295 (sha `4503bfe1…`), native stopped and physical stop proven after the activity and after worker close; cancellation after launch `cancelled` with no second dispatch. The runner at the pin requires dot's completion route, which the controller composition now mounts, so the unchanged rehearsal exercises the completion capture |

Reruns and their reasons, retained in the first-run receipt:

1. The 39 `conversations-tests` failures of the first run are all `sequence-range-migration-pg.test.mjs` cases refusing with `EXPLICIT_ISOLATED_LOCAL_POSTGRES_REQUIRED` because the two isolation-attestation variables were not supplied. They attest the already private cluster; the rerun supplies them and does not change any test.
2. The `worker-conversation` (1 file) and `control-core` (8 files) failures of the first run are `ERR_MODULE_NOT_FOUND` for packages resolved from the repository root (`ajv` and the other root packages): the new worktree had only the five root links. Copying the root dependency tree from the PR86 worktree, whose lock is identical, fixed resolution; no source changed.
3. The `runtime-tests` Docker image-closure control fails on this host as recorded in every Fable baseline; it is not rerun.

Counts match the independent 353 relay where the groups coincide (worker 138, source-proof 5) and are larger where dot's handoff added tests (conversations 246, control-core 260, runtime-tests 168 with the fixture repair). Groups overlap and are not summed.

## Cleanup

After each group: `ps -u meri` shows no test-owned process; `/home/meri/resume-tmp` is empty; the two clusters stay running for the following slices and are stopped at return with `provision-postgres.sh stop --data /tmp/meri-resume-pg-20261015`. No image, container, cloud resource, credential, provider call, product database or migration execution is involved; receipts were scanned for credential patterns (0 hits) and the runner scrubs credential-shaped variables.

## Finding carried to the artifact slice (dot task 3)

The worker qualification `component-pins.json` row for `packages/contracts/validate.mjs` pins 3,311 bytes with sha `c2449fd5…`, the file as of `d5207dc`. The file changed in `de599e4` ("Compile canonical public validators on first use") to 3,606 bytes, sha `bc72b4cb…`, which is the current content at the pin. So the discrepancy dot reported is a stale worker-image build-dependency pin against a later accepted source change, not a modified file. Reconciliation belongs to the worker qualification candidate owner through a new candidate record; neither file is edited here and the historical receipts are preserved.
