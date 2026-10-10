# W02-16 browser worker binding — preparation report

**Session:** `20261010_021036_2afa95` (single foreground Hermes session; 30-turn/1,200 s implementation, then a 6-turn/600 s report-only closeout; no recursive/background/auto-resume).

**Base commit:** `a90e34ee45b8c2fd225747ea1da98730fbc0359b`.
**Worktree:** `C:/dev/main/meri-greenfield-worktrees/w02-browser-worker-binding` (branch `task/w02-browser-worker-binding`).

**Verdict: PREPARATION-ONLY, UNACCEPTED, source-only.** This candidate is an offline source change plus a local injected/fake test run. It is not a runtime, security, native, build or deployment result and advances no gate. Codex owns independent inspection, review, support build and admission.

## Scope

Seven allocated tracked paths, all owned by this session and no others:

1. `infra/browser-qualification/app.mjs`
2. `infra/browser-qualification/bootstrap.sh`
3. `infra/browser-qualification/host-evidence.py`
4. `infra/browser-qualification/security.test.mjs`
5. `infra/browser-qualification/component-pins.json`
6. `infra/browser-qualification/README.md`
7. `docs/coordination/reports/W02-16-BROWSER-WORKER-BINDING.md` (this report)

No new helper/module/framework/controller/worker/lock/contract/build-tool path was added. The two seccomp data files were not edited.

## Exact worker tuple (from `docs/coordination/reports/W02-08-BUILD-3-STATIC-ACCEPTANCE.md`)

| Identity | Exact value |
| --- | --- |
| Worker image | `967807252336.dkr.ecr.us-east-1.amazonaws.com/meri-greenfield/qualification-worker@sha256:bf55fdab91136344688e2c804598546e521b24d6cdbf4fde9e6a7131e6c2ec9c` |
| Image configuration ID | `sha256:6f313883ad219ebd5cc3d0dbd1df5cdf80f0f035eab5ab02c3cead4db568f471` |
| OCI `org.opencontainers.image.revision` | `0be04d0799c9c527e300b47c19176cddb0eaa231` |
| OCI `meri.qualification.kind` | `worker-inventory-only` |

The three are pinned literals in owned source (`PINS.imageConfigId/imageRevision/imageKind` in `app.mjs`; `PINNED_WORKER_CONFIG_ID/_REVISION/_KIND` in `host-evidence.py`) and are never accepted as caller-supplied expected values. The previous candidate digest `7327f045…96d75` is retained only as historical provenance (`component-pins.json` `image.previousUri`; `OLD_IMAGE` in the test) and is no longer an allowed worker.

## Behavior change

1. **Bind before create (`bootstrap.sh`).** After the immutable worker pull and credential purge, and before the sole browser `docker create`, a marker-delimited `WORKER-PROVENANCE-GUARD` runs one bounded `docker inspect` of the pulled image and requires `.Id | .RepoDigests[0] | org.opencontainers.image.revision | meri.qualification.kind` to equal `CONFIG_ID | IMAGE | REVISION | KIND`. Any missing/malformed/differing value runs `fail`, so zero browser create/start calls occur. The guard uses the existing `bounded` mechanism and the still-empty control Docker config; no new helper. Network `none`, `--cap-drop ALL`, no-new-privileges, read-only root, observer, source/support bindings, timers, cleanup, exports and the empty control config are preserved unchanged.
2. **Authoritative classifier (`host-evidence.py`, `_inspect_reasons`).** `record.imageID` (the assembled record) and `inspect.Image` (daemon image config ID) must EACH independently equal the accepted configuration ID; `inspect.Config.Image` must be the accepted worker digest; `Config.Labels['org.opencontainers.image.revision']` must equal the accepted source; `Config.Labels['meri.qualification.kind']` must equal the existing kind. A record and inspect that agree on the same substituted well-formed IID are now rejected. `_inspect_reasons` is the later admission helper and was the only function edited.
3. **Tuple refresh + provenance guard wiring (`app.mjs`)** and metadata/manifest/README updates.

## Owned source SHA256 and byte sizes (post-edit, exact)

| Path | Bytes | SHA256 |
| --- | --- | --- |
| `infra/browser-qualification/app.mjs` | 30361 | `d29250a78527acda0457a377f613cf5a6a5b66f71e9bd16c0655ac080660d757` |
| `infra/browser-qualification/bootstrap.sh` | 13121 | `205f1d22daaac9d530eb7aaef312a7569636ce917638dcabd6032c3934c4f873` |
| `infra/browser-qualification/host-evidence.py` | 89914 | `cf27ce1d1c5cf0c45ba2a1fc2a6cf6d48bd0506728202645ecb4d4f68411679f` |
| `infra/browser-qualification/security.test.mjs` | 38698 | `abd525fa7fd891f1f53f8118737232315d9644a39755dd71ceca0a03813af020` |
| `infra/browser-qualification/component-pins.json` | 10087 | `58201d00494027dbd9a7732f3a59bfc98871a38a78abb75b6131607adc634659` |
| `infra/browser-qualification/README.md` | 8715 | `b3df19db742b3790833f4accbbbf32bb885ab1df84fe6a4aade3bc49a3136df5` |

D006 support sources (three assets packaged into the never-started support image; **only `bootstrap.sh` and `host-evidence.py` changed here**):

| Support source | Bytes | SHA256 |
| --- | --- | --- |
| `bootstrap.sh` | 13121 | `205f1d22daaac9d530eb7aaef312a7569636ce917638dcabd6032c3934c4f873` |
| `host-evidence.py` | 89914 | `cf27ce1d1c5cf0c45ba2a1fc2a6cf6d48bd0506728202645ecb4d4f68411679f` |
| `seccomp.chromium-155-amd64.json` | 17188 | `e62f4c3e3e7ce6de099ba7a0e3df0881b7b407b74dc664aef70f76f6316385c6` (unchanged) |

Because `bootstrap.sh` and `host-evidence.py` bytes changed, the D006 support-image source identity changes: these new full-source hashes require a **future separately reviewed immutable support build** and a fresh template/context update. No support digest was fabricated, copied forward, built, transferred or admitted here. The old `d09740b`/`c51f27d` source acceptance and any prior support digest are **not** inherited by these bytes.

Unchanged and preserved exactly: `seccomp.default.docker-25.0.16.json` (12828 B, `9c1025c88ccaa517b648da571961838744ea2137f176bfe6a48b21294cae9c76`).

## Preserved frozen provenance

- The `host-evidence.py` regression still asserts the **39 original `4fd85f7` collector/classifier/poll/version/helper function bodies** are byte-identical; it passes. Only the later `_inspect_reasons` admission helper (absent from that baseline) was edited, so the whole modified script is **not** described as byte-identical/previously accepted — its complete hash above is reported separately.
- The frozen legacy JavaScript `classifyHostEvidence` export in `app.mjs` remains **UNQUALIFIED** and is not an admission oracle; it was not repaired or elevated. App edits were limited to the tuple/user-data/comment preparation.
- The two frozen observer replay harnesses are unchanged: `.task-inputs/codex-observer-checkpoint-audit.py` (`d1900a591a6b43b92f194223b2be1838e2d3e15eb4454d78b7e23b02140275e2`) and `.task-inputs/owner-regressions-adapted.py` (`383360dd17127cae2df73c25cb5b963e0c0e283a29022701573509231661c528`). No fixture was adapted, replaced or bypassed.

## Checks actually run (offline; captures retained under `.task-inputs/W02-16-checks/`)

- `MERI_TEST_PYTHON="C:/Users/neoma/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe" node --test infra/browser-qualification/security.test.mjs` → exit 0; **tests 14 / pass 14 / fail 0**. Capture: `.task-inputs/W02-16-checks/node-suite.out`.
- `"C:/Program Files/Git/bin/bash.exe" -n infra/browser-qualification/bootstrap.sh` → exit 0 (syntax parse only, never executed).
- `git diff --check` → exit 0.
- Test-only `MERI_TEST_PYTHON` routes all 10 Python spawns; it is never read by guest/product code and no host PATH/env shim was created. Author interpreter for this run was the bundled Python `3.12.14` (not the AL2023 3.9 target); Node `24.19.0`. Windows checks do not measure AL2023/systemd/Bash/Docker behavior.

### Disclosed fixture failure (not a first-try pass)

The owner-launcher prerequisites supplied the two frozen harnesses above but **omitted `observer-before-4863878.py`**, which `owner-regressions-adapted.py` reads from its own directory. On first run the adapted fixture therefore reported `{"passed": 30, "failed": 0}` and the suite's `/\"passed\": 33/` assertion failed. I preserved that failure, then copied the **byte-identical baseline** from the accepted earlier greenfield worktree `C:/dev/main/meri-greenfield-worktrees/w02-browser-host/.task-inputs/observer-before-4863878.py` into `.task-inputs/observer-before-4863878.py` and verified its SHA256:

`cbfd952e97936dcf5a1538ff769e4a897308d55482417fb5055860c45b27f471`.

With that exact baseline present the fixture reports `{"passed": 33, "failed": 0}` and the suite is 14/14. I did **not** adapt, weaken or bypass the fixture or the test, and I am **not** claiming the missing fixture was originally provided or that the suite passed on the first attempt.

### Guard-test limitation (explicit)

The provenance-guard test EXECUTES the actual guard lines extracted from `bootstrap.sh` (between the `WORKER-PROVENANCE-GUARD` markers) under Bash with **injected fake `bounded` and `docker` functions**, followed by **manually supplied** `docker create`/`docker start` calls that increment counters, plus static assertions that the guard is placed after the credential purge and before the single `docker create`. It holds the extracted guard text to exact reference. It does **NOT** execute the whole bootstrap, nor the real bounded/deadline/cleanup/timer/Docker-daemon behavior or native failure paths. Owner must independently verify the actual admission flow. No raw-machine capture was taken, so all interface/limit/version claims here are author-reported.

## Interpretation limits

- Local injected/fake checks are offline candidate evidence only. They do **not** establish host, native, network, metadata, sandbox or security admission.
- **Security disposition unchanged: 49 findings = 4 CRITICAL, 18 HIGH, 18 MEDIUM, 7 LOW, 2 UNDEFINED; 22 critical/high remain unresolved. Office residual-risk decision DEFERRED. Browser/native/security admission NOT GRANTED. G1 OPEN.**
- Static build acceptance does not qualify sandbox/network/metadata isolation, immutable support execution, actual AL2023/systemd/Docker compatibility, full CloudWatch reconstruction, host/root-volume cleanup, models/Temporal, current Capiro integration, product or release.
- **NOT RUN** (all forbidden in this task and not attempted): real Docker/browser/container start, ECR/registry access, AWS/cloud, image build/push, dependency install/lock change, network/provider/source/tenant data, model/paid inference, controller/watchdog change, current Meri/Capiro access, cutover, history amend.

## Return to integration owner

One owned-path commit on `task/w02-browser-worker-binding` staged from exactly the seven allocated paths (six modified + this new report). Commit SHA and clean status are recorded below by the closeout. Fresh full-source hashes above change future D006 support build/template identity; there is no stale acceptance transfer. Codex must independently inspect this commit, run relevant checks, and arrange a separate actual review, fresh source acceptance and an immutable support build before any browser-host admission can even be considered.
