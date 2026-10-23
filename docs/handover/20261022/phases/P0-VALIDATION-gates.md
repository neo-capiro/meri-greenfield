# P0 validation: Docker gates for PR #195 (`feat/meri-p0-telemetry`)

adj-a, 2026-10-21. Read-only on GitHub and AWS: ECR pulls of deployed images and ECS describes only. Nothing pushed. Labels:
[R] run here, [D] derived from source.

**Verdict: ACCEPT.** No product defects.
- The head `e64b2231` behaves identically to base. The image gate is 24/24 on the head and on the candidate 7 merge. Rehearsal
  timings match base within noise.
- Telemetry Core calls equal the independent counter: **164** at the median, 168 at the tail, 172 with a Clerk 503.
- A telemetry sink that throws changes nothing.
- The fix round resolved my earlier harness defect by removing the harness, and my `server.py:165` nit by moving the comparison
  into `_safe`.
- Two environment gaps in the runtime image keep two tests from running there. Both were verified elsewhere (§5).

| Tree | Commit |
| --- | --- |
| base | `main` `69fd1994` (results kept from the first round) |
| head | PR #195 `e64b2231` (the fix round on `43b705c8`) |
| candidate 7 dry run | head + `fable/c7-capture-self-stop-20261020` `d398d556` + `fable/adj-clerk503-load-20261020` `39fd6b42`. Local merge `a277f935`, not pushed |

**Method.**
- **Harness:** the PR's own `verify.py` and `in-image.sh` from `43b705c8`, since the fix round deletes them. It ran in WSL2 Docker,
  one tree at a time:
  - build the real runtime image from `apps/runtime/Dockerfile` on its pinned Node and Wolfi bases;
  - the 24-case gate as uid 1000, network none, read-only;
  - the suite groups;
  - the first-turn and D3 rehearsals, each in its own container, with a clock-step retry.
- **Proxy suites:** in the **deployed** candidate 6 proxy image (`meri-product-preview-proxy:38`,
  `qualification-worker@sha256:413ab2a6…`, LiteLLM 1.104.2). Each tree is baked in with git modes; each module runs as uid 10001.
- **Shared host:** other sessions' containers shared it, so every rehearsal recorded host clock steps. The rehearsal keeps
  `Date.now` monotonic.

## 1. Image gate (`LINUX_ONLY_TESTS`, gate reporter, uid 1000) [R]

| Tree | Result | Cases (B/R/W) |
| --- | --- | --- |
| base `69fd1994` | **24/24** | 6/6/12 |
| head `e64b2231` | **24/24** | 6/6/12 |
| candidate 7 merge `a277f935` | **24/24** | 6/6/12 |

## 2. Rehearsals [R]

### First turn

Each row lists the result of the first run, then of the clock-step retry.

| Case | base | head `e64b2231` | candidate 7 | Core calls | head telemetry Core |
| --- | --- | --- | --- | --- | --- |
| quiet | 23.76 / 23.37 s | 23.28 / 23.32 s | 23.63 / 23.56 s | 164 on all three | **164** |
| live median | 39.03 / 39.54 s | 38.85 / 38.88 s | 39.52 / 39.60 s | 164 on all three | **164** |
| live tail | 59.60 / 59.58 s | 59.54 / 59.55 s | 58.09 / 59.74 s | 168 (164 in one candidate 7 run) | **168** |
| median + Clerk 401 | fails, 14.59 / 14.61 s | fails, 14.58 / 14.58 s | fails, 14.59 / 15.57 s | 40 | — (§6) |
| median + Clerk 503 | 43.47 / 43.51 s | 43.44 / 43.47 s | 43.74 / 43.52 s | 172 | **172** |
| tail + Clerk 503 inside load | — | — | completed 76.89 / 76.90 s | 199 | 199 |

- **Timings are within noise.** Head minus base is −0.5 to +0.1 s, with identical Core calls.
- **Telemetry Core calls equal the independent counter** in every completed case. The median of 164 is confirmed, and the head
  rehearsal now asserts it.
- **Telemetry lines parse,** since the rehearsal writer JSON-parses every one. Each completed case emits 14–15 lines and exactly
  one `meri.turn.summary`, with `firstTextMs` and `resultMs` (for example, median 29 138 and 36 987 ms).
- **Stage order holds:** the rehearsal's assertions (each of the eight stages once, in order within the control chain and within
  the runner chain) passed in every run.

### D3

**9/9 on all three trees, in both the run and the retry.**

| Profile | Stop / again: base | head | candidate 7 | Stream |
| --- | --- | --- | --- | --- |
| quiet | 200 4.72 / 3.15 s | 200 4.71 / 3.15 s | 200 4.74 / 3.15 s | completed; 10 events, 0 duplicates, 0 gaps on all three |
| median | 200 7.26 / 4.84 s | 200 7.26 / 4.84 s | 200 7.27 / 4.85 s | same |
| tail | 200 10.86 / 7.24 s | 200 10.88 / 7.25 s | 200 10.88 / 7.27 s | same |

### Suite groups [R]

| Group | base | head `e64b2231` | candidate 7 |
| --- | --- | --- | --- |
| runner-diagnostics | 38/40 | 38/40 | 38/40 |
| control | 44/47 | 43/47 | 44/47 |
| worker | 193/199 | 194/199 | 194/199 |
| owner (Node) | 213/213 | 218/218 | 218/218 |
| telemetry | 19/19 | 47/47 | 47/47 |
| changed tests | n/a | 40/41 (§5a) | 46/48 (§5a, §5b) |

**Every failure exists on base, or is an environment gap (§5):**
- `runner-diagnostics`: `native-start-router-budget` (see §5b) and `pinned-native-transport`, the same on all three.
- `worker`: the same five cases on all three; base's sixth (a retry-timing case) passed on every rerun.
- `control`: timing-window tests.
  - Rerun three times alone in each image (`load-amplification` plus `lifecycle-activity`):
    - base and head: **the same 3 failures every run** (the stale 534 000 pin, "500 ms Core replies fit…" and "conservative
      tail-heavy…");
    - candidate 7: **2 every run**, because the Clerk-503 branch corrects the stale pin.

## 3. Proxy Python suites, deployed proxy image [R]

| | Modules | Tests | Non-zero modules |
| --- | --- | --- | --- |
| base | 38 | 382 | `test_model_proxy_material` (2; needs a repository `node_modules`) |
| head `e64b2231` | 40 | **406** | `test_model_proxy_material` (the same 2) |

- **Identical module by module** except the new tests: `test_main` +1 (15), `test_telemetry_context` 15, `test_telemetry_lines` 8.
  All OK.
- `test_aws_counter` (11) and `test_bedrock_transport` (31) are counted with `AWS_EC2_METADATA_DISABLED=true`, which ECS sets at
  task level. Without it they fail at import on base and head alike.

## 4. No behaviour change: review and probes

**Fix-round diff `43b705c8..e64b2231` [D].** Product code changes only where intended:
- `server.py`: `telemetry.http_outcome(response_status)`. The classification now runs inside `_safe` (`telemetry_context.py`).
- `main.py`: cleanup moves into `try/finally` and releases the borrowed writer with `telemetry_lines.uninstall()`. Cleanup errors
  still propagate.
- `owner_https.py`: drops a duplicate `health` line.
- AWS outcome label: `failed` becomes `error`.
- `control.mjs`: drops the duplicate publish observer (the store's `onPublished` already observes). It keeps a frozen spread of
  the same service, with symbol keys copied as before.
- Elsewhere: observability renames and tests. The workflow, docs and harness are removed.

**First-round review [D], still valid.** Every runtime-path edit observes and returns the same value or error:
- `postgres-store`, `lifecycle/journal`, `completion-capture`, `native-client`, `worker-http`/`input/http` (`provisional` runs the
  handler once), `prepared-run-registry`;
- the counting wrappers keep identity, and the fetch wrapper never reads a body;
- the AWS facade is reached only through `storageMethod(…, 'send')`;
- `product-model-settlement`, the owner Node files and the Python `_safe` entry points.

**Throwing-writer probes on `e64b2231` [R]:**
- **Node:** head's first-turn rehearsal with a telemetry sink that alternately throws and rejects.
  - quiet 23.38 s / 164 Core calls; median 38.86 s / 164; median + Clerk 503 43.46 s / 172.
  - **All completed and identical to the working sink, with 0 lines written.**
- **Python:** 10 request-path modules with a process-wide writer that raises `OSError`, also forced onto tests that install
  their own sink.
  - **All behaviour tests pass with the same counts:** host_composition 19, owner_https 12 (1 skipped), owner_channel 14,
    owner_startup 4, owner_admission 18, server 14, lifetime 14, product_response_settlement 15, service_entrypoint 3.
  - `test_main` passes 14 of 15. The one exception is the fix round's own
    `test_telemetry_writer_is_released_on_shutdown_startup_refusal_and_cleanup_failure` (`test_main.py:311`), which asserts the
    `health` lines its writer receives. The probe makes that writer throw, so it captures nothing. That's expected, not a defect.

## 5. Environment gaps in the runtime image (not product defects)

**a) `first-chat-observability.test.mjs:46-58`** (in changed tests on head and candidate 7) spawns `python3`. The runtime image has
no Python, so `result.status` is `null` at line 53.
- I verified it in pieces. The Node half (owner suppression token, line 49) passed in the runtime image. The Python half, run in
  the head proxy image, emits exactly `PRODUCT_PROXY_REFUSED gate=pair step=verify code=REFUSED` then
  `PRODUCT_PROXY_DIAGNOSTICS_SUPPRESSED`. Both tokens are in `first-chat-observability.mjs` and `observability.template.json`.
- **Infra only;** this is a host test (it needs Python and `aws-cdk-lib` together).

**b) `router-tls-fixture.mjs:17`** (C's `d398d556`, shared with `native-start-router-budget`) runs `openssl` at module load. The
runtime image ships no `openssl`, so `capture-self-stop.test.mjs` fails at import in the gate's changed tests. The same cause makes
`native-start-router-budget` fail to load on base.
- **With `openssl` 3.0.13 and its config copied into the candidate 7 runtime image:**
  - `capture-self-stop` **3/3 pass**: the capture survives the stop its own query close causes; a genuine Stop still ends it;
    revocation still withholds its result.
  - `task-router` 13/13.
  - `native-start-router-budget` runs for the first time: 4/5 on candidate 7 and 4/5 on base. A different 6–25 s timing case
    fails on each, under host load.
- **For C (LATER):** keep the TLS material generation out of import time, or document that this suite needs `openssl`. Otherwise
  the image gate's changed-test placement can't run it.

## 6. Candidate 7 dry-run merge [R]

- **Merge:** `e64b2231`, then `d398d556` (C's composed test on top of `51ad171e`), then `39fd6b42`. **No conflicts.**
- **Image gate 24/24.** First turn 6/6, D3 9/9.
- **Changed tests 46/48:** the two are §5a and §5b, both environment.
- **Suite groups equal head,** except the corrected budget pin.
- **Telemetry on the merge:** the new tail Clerk-503-in-load case completes (199 Core calls, equal to the independent counter).

## Observations (LATER, not defects)

- **A turn that fails before any terminal event emits no per-turn counters or summary** (the Clerk 401 case: 7 lines). Its Core
  calls land only in the background rollup.
- **`resultMs` in the summary** runs to `run.terminal` (36.99 s at the median), shorter than the rehearsal's end-to-end 38.85 s by
  design.

## Evidence

WSL `~/p0/results/{base,head2,c7b}-runtime/` (`result.json` and logs), `~/p0/proxy-out{,2}/`, `probe-out2/`, `flake-out/flake2.log`
and `ossl-out/`. Copies and scripts are in this session's scratchpad `p0/`.
