# W02-16 browser worker binding — independent review 1

**Session:** `20261010_023431_041505` (single foreground Hermes session; distinct from author session `20261010_021036_2afa95`; 20-turn/1,200 s bound; no recursive/background/auto-resume). **Role:** independent reviewer, not author.

**Base commit:** `28b2169b72f5832c41c5af4a3ed0986b3c2abf43`.
**Parent:** `a90e34ee45b8c2fd225747ea1da98730fbc0359b`.
**Worktree:** `C:/dev/main/meri-greenfield-worktrees/w02-browser-worker-binding-review-1` (branch `review/w02-browser-worker-binding-1`).
**Owned output:** this NEW file only. No source/test/prior-report/contract edits.

## Verdict: SOURCE-ONLY PASS (offline/static evidence only)

The seven-file candidate commit `28b2169` was reviewed at the source level against its parent and all supplied inputs. Every claimed snapshot hash, fixture hash, tuple literal, guard placement and classifier binding was independently reproduced. The canonical suite passes 14/14 on the supplied fixtures. No blocking source defect was found. This is **not** runtime, native, build, security or deployment acceptance — see Interpretation limits.

## Hash verification (independent, `sha256sum`/`wc -c`)

All nine `candidate-manifest.json` `source` entries reproduce byte-exactly. No raw-byte drift:

| Path | Bytes | SHA256 | Match |
| --- | --- | --- | --- |
| `infra/browser-qualification/app.mjs` | 30361 | `d29250a78527acda0457a377f613cf5a6a5b66f71e9bd16c0655ac080660d757` | YES |
| `infra/browser-qualification/bootstrap.sh` | 13121 | `205f1d22daaac9d530eb7aaef312a7569636ce917638dcabd6032c3934c4f873` | YES |
| `infra/browser-qualification/host-evidence.py` | 89914 | `cf27ce1d1c5cf0c45ba2a1fc2a6cf6d48bd0506728202645ecb4d4f68411679f` | YES |
| `infra/browser-qualification/security.test.mjs` | 38698 | `abd525fa7fd891f1f53f8118737232315d9644a39755dd71ceca0a03813af020` | YES |
| `infra/browser-qualification/component-pins.json` | 10087 | `58201d00494027dbd9a7732f3a59bfc98871a38a78abb75b6131607adc634659` | YES |
| `infra/browser-qualification/README.md` | 8715 | `b3df19db742b3790833f4accbbbf32bb885ab1df84fe6a4aade3bc49a3136df5` | YES |
| `docs/coordination/reports/W02-16-BROWSER-WORKER-BINDING.md` | 11020 | `d630de66e1b8bb9760f31bf3f3123a0661ad96cb0b931f66e1cf213d9541e166` | YES |
| `infra/browser-qualification/seccomp.chromium-155-amd64.json` | 17188 | `e62f4c3e3e7ce6de099ba7a0e3df0881b7b407b74dc664aef70f76f6316385c6` | YES |
| `infra/browser-qualification/seccomp.default.docker-25.0.16.json` | 12828 | `9c1025c88ccaa517b648da571961838744ea2137f176bfe6a48b21294cae9c76` | YES |

Three supplied frozen input fixtures also reproduce byte-exactly:

| Fixture | SHA256 | Match |
| --- | --- | --- |
| `.task-inputs/codex-observer-checkpoint-audit.py` | `d1900a591a6b43b92f194223b2be1838e2d3e15eb4454d78b7e23b02140275e2` | YES |
| `.task-inputs/owner-regressions-adapted.py` | `383360dd17127cae2df73c25cb5b963e0c0e283a29022701573509231661c528` | YES |
| `.task-inputs/observer-before-4863878.py` | `cbfd952e97936dcf5a1538ff769e4a897308d55482417fb5055860c45b27f471` | YES |

Seccomp preservation: `git diff a90e34e 28b2169 -- infra/browser-qualification/seccomp.*.json` is **empty** — both profiles are byte-identical to the base and both hashes match the manifest.

## Tuple verification against supplied static acceptance

`docs/coordination/reports/W02-08-BUILD-3-STATIC-ACCEPTANCE.md` (the supplied static acceptance) states: image digest `sha256:bf55fdab...2ec9c`, referenced config `sha256:6f313883...68f471`, source/consumed run `0be04d0799c9c527e300b47c19176cddb0eaa231`.

- Immutable worker reference `bf55fdab91136344688e2c804598546e521b24d6cdbf4fde9e6a7131e6c2ec9c` — matches (host-evidence `PINNED_IMAGE`, app.mjs `PINS.image`, pins `image.uri`, README).
- Configuration ID `sha256:6f313883ad219ebd5cc3d0dbd1df5cdf80f0f035eab5ab02c3cead4db568f471` — matches (`PINNED_WORKER_CONFIG_ID`, `PINS.imageConfigId`, `image.configurationId`).
- OCI revision `0be04d0799c9c527e300b47c19176cddb0eaa231` — matches (`PINNED_WORKER_REVISION`, `PINS.imageRevision`, `image.revision`).
- Kind `worker-inventory-only` — matches (`PINNED_WORKER_KIND`, `PINS.imageKind`, `image.kind`).

All four are pinned literals. `PINNED_WORKER_CONFIG_ID/_REVISION/_KIND` in `host-evidence.py:22-26` are module constants and `grep` finds no assignment from a caller/argument; `PINS.*` in `app.mjs:36-45` are frozen literals. The previous digest `7327f045...` is retained only as `image.previousUri` / `OLD_IMAGE` and is rejected as an allowed worker.

## Behavior verification

**1. Pre-create provenance guard (`bootstrap.sh`).** Guard block at lines 154–161 is positioned after the immutable pull (148), scoped logout (149), credential purge (150–152) and purge assertion (153), and strictly before the sole browser `docker create` (167). `grep` confirms exactly one browser `docker create`/`--pull never` in the file. The guard runs one bounded `docker inspect` (`bounded 10`) of `$IMAGE` and requires `.Id | .RepoDigests[0] | Config.Labels['org.opencontainers.image.revision'] | Config.Labels['meri.qualification.kind']` to equal `CONFIG_ID|IMAGE|REVISION|KIND`. Both the command substitution (`|| fail`) and the comparison (`|| fail`) fail closed, so a missing/malformed/differing value runs zero create/start calls. It uses the exported empty `DOCKER_CONFIG="$CONTROL_DIR"` (line 114) — no new helper, config or framework. ENV allowlist, mounts, control config, observer, source/support bindings, timers, cleanup and exports are unchanged.

**2. Authoritative classifier (`host-evidence.py:_inspect_reasons`, lines 618–640).** Caller at line 723 passes `image = rec['workerImage']` and `image_id = rec['imageID']`. The function now requires:
- `Labels['meri.qualification.run'] == run_id` (line 628, unchanged) then, via `elif`, `Labels['org.opencontainers.image.revision'] == PINNED_WORKER_REVISION` (630) and `Labels['meri.qualification.kind'] == PINNED_WORKER_KIND` (632);
- `image == PINNED_IMAGE and Config.Image == PINNED_IMAGE` (634);
- `imageID == PINNED_WORKER_CONFIG_ID and inspect.Image == PINNED_WORKER_CONFIG_ID` (639) — each bound independently to the fixed accepted IID.

A record and inspect that agree on the same substituted well-formed IID therefore still reject. The prior form bound `inspect.Image` only to `image_id` (self-consistency); the new form binds both to the fixed accepted pin — strictly stronger.

**3. Tuple refresh / manifest / README** propagate the same literals (`app.mjs` user-data exports `BROWSER_HOST_WORKER_CONFIG_ID/_REVISION/_KIND`; `component-pins.json` schema `w02-16-browser-worker-binding/1`; README updated).

## Independent checks actually run (this review session)

| Check | Command | Result |
| --- | --- | --- |
| Canonical suite | `MERI_TEST_PYTHON="C:/Users/neoma/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe" node --test infra/browser-qualification/security.test.mjs` | tests 14 / pass 14 / fail 0, exit 0, 16.85 s (≤120 s). Capture `.task-inputs/W02-16-review-1/node-suite.out` |
| Bash parse | `"C:/Program Files/Git/bin/bash.exe" -n infra/browser-qualification/bootstrap.sh` | exit 0 (parse only, never executed; bash 5.3.15 cygwin — Windows, not Linux proof) |
| Whitespace | `git diff --check a90e34e 28b2169` | exit 0 |
| Frozen Python bodies | local `ast` comparison of `4fd85f7:host-evidence.py` vs HEAD | 39 frozen bodies present; `all identical True`; only excluded/reallocated helpers differ |
| Raw source bytes | `sha256sum` + `wc -c` vs manifest | 9/9 exact |
| Fixtures | `sha256sum` | 3/3 exact |
| Seccomp | `git diff` | empty (unchanged) |

The 39-body check independently confirms only the later admission boundary (`_inspect_reasons`) changed among classifier/admission helpers; `main`, `_load_json`, `_dump`, `verify_run_record`, `classify_put_response` and the `build_export_plan`→`build_export_protocol` set are the pre-existing exclusion/allocation set, not part of the frozen 39.

## Prioritized source findings

No blocking defect. Observations, all non-blocking:

1. **LOW (test-evidence limit, disclosed).** The new guard test `worker provenance guard fails closed before the sole browser create` extracts the guard text and EXECUTES it under a harness that replaces `bounded` with a pass-through and injects synthetic `docker create`/`start` counters. It proves the extracted guard predicate and ordering (`guard` text between markers held to exact reference; `b.index('…offline-extractable') < index('docker create')`), not whole-bootstrap execution, native deadline, timer or Docker-daemon behavior. The author report discloses this. Owner must independently verify the real admission flow.
2. **INFO (`host-evidence.py:618-640`, no weakening).** The rewrite drops the old `SHA256_PREFIXED.fullmatch(image_id)` shape check but replaces it with exact equality to `PINNED_WORKER_CONFIG_ID`, which is strictly stronger; a substituted-but-well-formed IID now rejects.
3. **INFO (`host-evidence.py:628-633`, no bypass).** The `elif` chain skips the revision/kind label checks when `Labels` is not a dict or the run label mismatches. Admission still fails in those cases via the run/`Labels` reason, so there is no accept-by-omission path.
4. **INFO (disclosed debt).** `host-evidence.py` remains a ~1370-line collector; the tuple change is a narrow, cohesive edit confined to constants plus `_inspect_reasons`, adding no module/framework and no god-file growth. The owner has queued a separate module split before host packaging — outside this review's scope.

## Coverage / module assessment

The suite exercises the actual Python helpers with injected pipes/processes and now adds: (a) user-data export presence of the new tuple; (b) static guard-marker ordering; (c) executed guard positives and five negatives (missing, wrong IID, old immutable ref, wrong revision, wrong kind); (d) run-record negatives `old-worker-digest`, `joint-iid-substitution`, `record-iid-differs`, `inspect-iid-differs`, `missing-record-iid`, `malformed-record-iid`, `missing-inspect-image`, `wrong/missing-revision-label`, `wrong/missing-kind-label`. This covers the required bad/missing/malformed/old/substituted ref/IID/revision/kind and joint-substitution cases. No additional targeted negative case was needed; the review ran no extra ad-hoc negatives. Module boundaries are unchanged; `_inspect_reasons` remains the single allocated admission boundary; `classifyHostEvidence` in the frozen JS remains UNQUALIFIED and was not elevated.

## Preserved failure history (author-reported, cross-checked)

The author recorded a first-run failure: `owner-regressions-adapted.py` reads `HERE/'observer-before-4863878.py'` (its own directory) and reported `{"passed": 30, "failed": 0}` when that third fixture was absent, failing the suite's `/"passed": 33/` assertion. The byte-identical baseline (`cbfd952e…`) was then supplied and the fixture now reports `{"passed": 33, ...}`. I confirm the fixture is present with the exact hash and that the suite asserts `"passed": 33`. This review reproduces the green state only; it did not re-run the missing-fixture state.

## Interpretation limits

- All evidence here is offline/static/source-level on Windows. It does **not** establish AL2023/systemd/Bash/Docker behavior, native sandbox/renderer isolation, network/metadata denial, real browser output, CloudWatch reconstruction or host/root cleanup.
- The guard test's injected `bounded`/`docker` and synthetic create/start are not whole-bootstrap or native proof; not overstated.
- **Security disposition unchanged: 49 findings = 4 CRITICAL, 18 HIGH, 18 MEDIUM, 7 LOW, 2 UNDEFINED; 22 critical/high remain open. Office residual-risk DEFERRED. Browser/native/security admission NOT GRANTED. G1 OPEN. Paid Bedrock spend in this task: 0.**
- **Changed support-source bytes** (`bootstrap.sh`, `host-evidence.py`) change the D006 support-image source identity; they require a **fresh, separately reviewed immutable support build and template/context rebinding**. No prior source acceptance (`d09740b`/`c51f27d`) or support digest transfers to these bytes.
- **NOT RUN** (forbidden here, not attempted): Docker/browser/container start, ECR/registry/AWS/cloud, image build/push, dependency install/lock change, network/provider/source/tenant access, paid/model inference, controller/watchdog change, current Meri/Capiro access, cutover, history amend.

## Disposition

SOURCE-ONLY PASS for the exact reviewed commit `28b2169`. Owner retains responsibility for independent replay, exact-source acceptance, the fresh immutable support build and the physical-cleanup / renderer-isolation / native / SKD gates, all of which remain later and unproven here.
