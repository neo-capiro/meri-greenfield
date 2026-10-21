# P1 validation record

Branch: `feat/meri-p1-budget-table` → `main` (draft; do not merge). Final base: `bce707763f2cbabe1a73a99aee7b7ec206fa6996`. Implementation and prior evidence through `c44b4126490495579c0f4821a6ae00e417ab7e13`; the final candidate is the PR head, including the final-base remote-intents caller correction below. Evidence date: 2026-10-21.

P1 centralizes existing hot-path allowances and their composition without shortening, extending or reordering the existing operations. The table has **278 hops**. Production inputs are `startupMs=30000`, `shutdownMs=10000`, `requestMs=25000`, `runWindowMs=900000`; the fixed original-expiry fixture is in `packages/runtime/test/budget-fixture.mjs`. JavaScript and Python produce the same digest:

`81f345019ea00738c562647c2f9f0c767b2d92404cda4b04d05490603d7c09b1`

The digest covers sorted hop IDs and effective values, excluding absolute wall-clock timestamps and descriptive metadata. Different admitted root limits may yield a different digest.

## Scope and commit organization

| Family | Canonical implementation and changed owners |
| --- | --- |
| Table, extraction and guards | `packages/runtime/hot-path-budgets.mjs`; independent base-source golden extractor, nesting/margin tests, constructor/library registry and reviewed literal exceptions. Old load-only import paths are migrated. |
| Runtime and control | Runtime inputs and owned fetch/AWS transports; control/prepared roots, native authority and session receivers; explicit retention, schedule, artifact, issuer and objective-owner allowances. |
| Runner, worker and conversations | Runner bootstrap/process transports, activity/continuation/session store, worker roots, conversation events/journal, browser/host/readiness owners, generated workflow projection. |
| Owner, proxy and renderer | Node owner pool/HTTP/AWS/fetch options; Python loader, lifetime, discovery, boto/uvicorn options; full rendered proxy table and cross-language fixture. |
| Validation documentation | This record, [exact mutation edits](p1-mutation-checks.json), and [inventory delta](p1-inventory-delta.json). The four supplied plans/design inputs are local reference files and are excluded from the PR. |
| Telemetry — existing startup seam | One closed `meri.budget.table` startup proof from control, runner, owner and proxy, with no values or metrics; no new temporal-worker event. Its emitted schema remains closed and contains no tenant or prompt data. |

Commits separate the table, control, worker, runtime, owner/proxy and remaining ports, followed by compatibility fixtures, the final-base inventory update and validation evidence. Telemetry is part of the existing implementation commits; it is not the last commit in the rebased history. The PR records the final candidate SHA.

The final base preserves `native-preparation-journal` admitting restoration state `starting` (`96b6da6d`), the remote worker's `TMPDIR` lifetime (`3c56c3e9`), and C10/C11 conversation-survives-deploy semantics (`bce70776`). The latter adds two diagnostic policies: a burst of 20 messages and a 60,000 ms window. Both are now table entries; all previous 276 effective values remain unchanged. The golden was regenerated independently from `bce70776`. References were relocated by symbols, not old line numbers.

## Implementation decisions requiring review

- **Independent lifetimes:** `kind: "independent"` extends the plan's categories for pre-runtime initialization, terminal cleanup and durable workflow policies that are not nested in a live turn request. Each requires a positive duration, explicit owner and reason. Actual request children remain nested; `derived` identifies documented caps, counts, expiry metadata or inherited bounds. This preserves existing values instead of inventing misleading containment edges.
- **Nesting and existing exceptions:** both languages pin the 2,000 ms admission margin. Serial children are checked individually and their unchanged sum is reported. The stricter ADR 10% and 1.5× tail targets retain dated, phase-owned exceptions. Core's equal request allowance retains its shared abort signal and explicit P6 exception.
- **Issuer retries:** issuer AWS clients retain the effective base SDK default of **three attempts**, now explicit. Other already-single-attempt clients stay at one. Setting every issuer to one as the plan's generic SDK wording suggests would change behavior; the golden records the actual base value.
- **Workflow projection:** direct workflow import of the canonical module fails Temporal's webpack bundle on `node:crypto`. `packages/runtime/generate-workflow-budgets.mjs` emits the checked TypeScript projection for the nine duration strings and the objective lifecycle poll/retry constants. All values are unchanged, and the actual Temporal workflow bundle succeeds.
- **Dependencies and resources:** explicit owned fetch options use `undici` 7.30.0; AWS handlers use direct `@smithy/node-http-handler` 4.12.1, the existing transitive version. Owners close resources they create. SDK model options and `litellm-product-config.yaml` are unchanged.
- **Material bounds:** concise factual metadata keeps the complete table inside existing limits; no subset or increased file/bundle cap is used. The actual renderer proxy config is 30,744 bytes (32,768 cap); its bundle is 50,731 bytes (65,536 cap). The cross-language fixture is 30,343/41,027 bytes respectively. Renderer and material admission checks pass.
- **Fixture adjustment:** the startup-pair expiry test uses a valid table window and a local fake monotonic clock instead of an invalid 200 ms window. Real asyncio timers and product budgets are unchanged. Other existing fixtures explicitly supply their old defaults. Two CLI refusal fixtures now serialize valid production-shaped roots and a turn window so they reach their intended workspace/owner refusal; they perform no work that waits on those allowances. Product values are unchanged. Eight current public contract provenance manifests were regenerated from the source edits; all 33 wire JavaScript, schema and declaration artifacts remain byte-identical. Historical evidence was not rewritten.

## Verification results

Host tools: Node 24.19.0, Python 3.13.16 with pinned proxy dependencies, TypeScript 5.9.3 and OpenSSL 3.0.13. AWS credentials and metadata access were disabled. Node test files ran serially within each queue. This is host evidence; the unavailable gates below remain unqualified.

### Phase 1: complete original-base comparison

The complete suite run compared `3c56c3e981ba868a2af103c4cae9f65a0d47458d` with the P1 working tree before the final-base rebase. It covers 684 baseline and 696 head file/check records. It is retained separately and is **not** described as a run against `bce70776`. [Per-file commands, attempts and case outcomes](p1-host-checks-phase1.json) retain the original failures and later reruns. [The complete failure table](P1-PHASE1-FAILURES.md) lists every remaining base/head failure by name.

| Suite | Base passed / total | Base failed / skipped / cancelled | Head passed / total | Head failed / skipped / cancelled |
| --- | ---: | ---: | ---: | ---: |
| budget-currentness | 60 / 60 | 0 / 0 / 0 | 60 / 60 | 0 / 0 / 0 |
| contracts | 4384 / 4386 | 2 / 0 / 0 | 4386 / 4386 | 0 / 0 / 0 |
| control | 460 / 487 | 27 / 0 / 0 | 469 / 487 | 18 / 0 / 0 |
| extra-changed | 1646 / 1701 | 55 / 0 / 0 | 1644 / 1701 | 57 / 0 / 0 |
| infra | 203 / 210 | 5 / 2 / 0 | 203 / 210 | 5 / 2 / 0 |
| infra-python | 52 / 52 | 0 / 0 / 0 | 52 / 52 | 0 / 0 / 0 |
| native-authority | 803 / 818 | 15 / 0 / 0 | 812 / 822 | 10 / 0 / 0 |
| owner | 218 / 218 | 0 / 0 / 0 | 221 / 221 | 0 / 0 / 0 |
| p1 | 3 / 3 | 0 / 0 / 0 | 20 / 20 | 0 / 0 / 0 |
| python | 384 / 406 | 1 / 21 / 0 | 393 / 416 | 2 / 21 / 0 |
| runtime | 773 / 843 | 63 / 6 / 1 | 781 / 851 | 64 / 6 / 0 |
| telemetry | 47 / 47 | 0 / 0 / 0 | 50 / 50 | 0 / 0 / 0 |
| worker | 195 / 199 | 4 / 0 / 0 | 195 / 199 | 4 / 0 / 0 |
| worker-nested | 657 / 684 | 27 / 0 / 0 | 663 / 684 | 21 / 0 / 0 |

Counts use the last whole-file run, with one explicit exception: baseline `runtime-values.test.mjs` combines five observed cases before its 180 s harness timeout and three disjoint selected cases, covering all eight cases (7 pass, 1 failure). The original timeout is retained. Narrow passing reruns never replace the original whole-file totals. The reads/server SDK-cancellation case still does not complete; its timeout is recorded separately from the eleven selected other cases.

All new failing names in this completed comparison have either a passing unchanged selected rerun, a corrected existing fixture followed by a passing whole-file rerun, or a paired base/head reproduction. Short test-window failures occurred in Python discovery/readiness, native BD reads, runtime funding/general/KB reads, retained reads and S3 acknowledgement tests; the original failures and exact subsequent commands remain visible. Production deadlines were not increased.

Shared names alone were not treated as proof of equivalent behavior. Missing explicit fixture arguments were corrected to their exact removed defaults. The two process-test failures have an official baseline watchdog/SIGKILL mode and head 502 mode; excluded temporary diagnostic copies with a longer test watchdog reproduced the same 502 errors on both trees. Those diagnostic copies do not change the candidate or totals. The historical renderer test fails at byte equality on the base and earlier at missing historical budget configuration on head; it remains a known changed failure mode, not an identical-cause claim.

Runtime TypeScript checks passed on both phase-1 trees. The Temporal workflow bundle passed after its pure generated projection was used. Eight current provenance metadata manifests were regenerated; all 33 public wire/schema/declaration files remained byte-identical, and 230 consumer assertions plus ten generation checks passed.

### Phase 2: final-base comparison

The branch was rebased onto `bce707763f2cbabe1a73a99aee7b7ec206fa6996`. Fresh affected-suite runs are recorded separately from phase 1. The independent golden now has 278 hops; the previous 276 values are unchanged and the two new diagnostic policies retain 20 messages / 60,000 ms. Canonical table, margin, workflow projection and fixture checks pass 18/18. The C11 diagnostics/deploy-survival tests pass 11/11; history consumer tests pass 36/36; all ten generation checks pass. Final-base runtime TypeScript check passes.

The final comparison is being assembled from four disjoint, serial-per-file queues: full owner/Python coverage and three balanced affected-source lists, with fresh telemetry and composed end-of-turn coverage. Unchanged phase-1 results are eligible for reuse only when their source and fixture closure hashes match both final trees.

The original new-test audit covered 45 cases with 58 isolated intended-assertion mutations; the resume adds one composed regression case and two isolated mutations (46 cases / 60 mutations total). Node/Python no-default guards pass on head and fail on the original and final bases; the C11 default/caller probes are included. The static image audit resolves 10 fixture roots through 417 modules with no budget-test-fixture imports. This is a source audit, not a Docker run.
### Final-base resume: explicit remote-intent transport budgets

A read-only independent source review identified one missed production caller: `runRemoteConversation` constructed `createRunnerIntentsClient` without `limits`, after P1 removed that constructor's defaults. With both source access and intents enabled, startup would throw before the worker/listener ran. The correction supplies the original 65,536-byte request and 262,144-byte response caps and `native.intent.prepare` (30,000 ms) from the existing table. No hop, effective value, retry, wire contract, or feature flag changes.

The canonical owner stays the remote-runner composition root; the existing intent client still owns transport validation and failure semantics. The regression test invokes the real client through remote startup, checks availability and prepare requests carry the task credential and exact binding, and checks both disabled gates remain inert. The constructor registry now covers that production caller. Removing its supplied limits fails both the composed test (`INVALID_COMMAND` before execution) and the registry guard. Both mutations were restored.

Fresh host checks on Node 24.19.0 / Python 3.12.14: canonical budgets, nesting/margins and Node guards **22/22**; Python budget/guard suites **8/8**; composed intent regression **1/1**; runtime TypeScript **pass**. The Node guard fails all three cases against final base `bce70776`; Python's three guard cases also fail there as required. The previous Python 3.13 pinned-environment evidence is retained separately; this resume does not claim native proxy image qualification.

A focused final-base regression comparison is running against the exact baseline and head, one test file per process. Its results will be appended before the draft is handed off. No full-suite or image claim is inferred from these focused checks.

## Not run / not established

| Gate | Status and reason |
| --- | --- |
| Docker runtime image gate, expected 24/24 (B6/R6/W12) | **Not run:** Docker unavailable. Host tests and the fixture import audit do not establish this gate. |
| Ten-case first-turn rehearsal, including Clerk-503 and 164-call median | **Not run:** required Docker runtime unavailable. |
| Nine-case D3 rehearsal | **Not run:** required Docker runtime unavailable. |
| Real PostgreSQL suites | **Not run:** disposable PostgreSQL unavailable in this environment; no substitute scripted fixture is claimed as PostgreSQL evidence. Includes execution-broker/broker-stack/broker-cleanup, native preparation and `*-pg` suites; see final comparison for the full exclusion list. |
| Pinned native proxy image / unsupported native qualification cases | **Not run:** host skips are retained (21 Python skips); host checks do not replace image qualification. |
| Base/head wall-clock timing within ±10% | **Not established:** concurrent host load and recorded timing flakes prevent a trustworthy timing comparison. Golden values prove numerical preservation, not live latency. |
| Live startup log proof | **Not run:** no AWS access or deployment was performed. Shipper verifies the emitted digest after deployment. |

No AWS access, GitHub Actions workflow changes or merge was performed. The PR stays draft for the unavailable validation gates.

## Reproduction

Run from the repository root with the locked dependency installs and Node/Python versions above. Export `MERI_REVIEW_SOURCE_ROOT="$PWD"`; set `MERI_TEST_PYTHON` and `P1_PYTHON` to the pinned Python executable as needed. Node suites use `--experimental-test-module-mocks --test --test-concurrency=1`.

```bash
npm run typecheck --prefix apps/runtime
P1_PYTHON="$(command -v python3)" node packages/runtime/test/generate-hot-path-budget-golden.mjs bce707763f2cbabe1a73a99aee7b7ec206fa6996
node packages/runtime/generate-workflow-budgets.mjs
node --experimental-test-module-mocks --test --test-concurrency=1 packages/runtime/test/*.test.mjs apps/runtime/native-authority/test/hot-path-margins.test.mjs
node --experimental-test-module-mocks --test --test-concurrency=1 apps/proxy/product/*.test.mjs
node --test --test-concurrency=1 infra/product-preview/first-chat/render-material.test.mjs
# Run each namespace-package module in its own process and retain a combined status.
p1_test_status=0
for test_file in apps/proxy/product/test/test_*.py apps/proxy/product/test_*.py apps/proxy/qualification/test/test_*.py; do
  test_module=${test_file%.py}
  python3 -B -m unittest "${test_module//\//.}" || p1_test_status=1
done
test "$p1_test_status" -eq 0
```

The golden generator reads the final base's Git blobs and installed dependency sources; it does not derive expected numbers from the new table. Review regenerated output before accepting it. The isolated timing rerun was:

```bash
python3 -B -m unittest -v apps.proxy.product.test.test_service_pair_discovery.DiscoveryTests.test_real_source_reader_compiles_policy_only_from_fresh_pair_and_never_caches apps.proxy.product.test.test_telemetry_context.TelemetryContextTests.test_inference_response_and_readiness_survive_outcome_classification_failure
```

Restore the uncommitted qualification harness from `43b705c8:scripts/qualification/p0-telemetry/` for Docker runtime/proxy/infra validation. Run it against the committed candidate and the exact final base, one container at a time. The required image gate, rehearsals and PostgreSQL commands remain the supplied P1 plan's §13 validation gates.

## Mutation audit

[The machine-readable audit](p1-mutation-checks.json) contains every new test, its exact edited source, the change that makes it fail and the command to reproduce its assertion. Tests include the new data-driven schema/poison case. Temporary mutations are absent from the candidate.

| Test family | New cases | Deliberate edits that turn the tests red |
| --- | ---: | --- |
| Canonical table and margin model | 16 | Remove freezing, nested/serial/independent/unbounded checks or phase exceptions; relax the two-period renewal or 2,000 ms invariant; include wall-clock expiry in the digest; change a golden value, either C11 diagnostics value, or capture model; replace an owner-configured pool cap; misclassify workflow ownership. |
| Node and Python no-default guards | 6 | Restore `maxRequestMs=3000` / `max_request_ms=3000`; wire a caller to the wrong hop or omit the ECS binding compiler allowance; restore either C11 diagnostics default or omit either caller field; replace boto connect timeout with `1`; replace the lease hop with the fetch hop. |
| Root inputs and transports | 2 | Reverse rendered/candidate root precedence; invent a 900,000 ms fallback; change fetch headers to `300001` or AWS request timeout to `1`. |
| Worker, runner, bootstrap and workflow projection | 5 | Remove startup assertion or Temporal `connectTimeout`; invent a turn root; replace selected metadata allowance with `2000`; change generated `30 minutes` to `29 minutes`. |
| Native session and required constructor arguments | 2 | Omit `operationMaxRequestMs`; restore native request/load defaults. |
| Proxy admission, owner refusal and cross-language fixture | 7 | Swallow the budget refusal code; change fixture fetch connect `10000` to `10001`; omit admission validation; weaken nested/margin checks; omit independent/derived metadata or unbounded ownership checks. |
| P0 startup proof | 7 | Remove a control/owner/proxy/runner emission; remove recursive duplicate suppression; bypass either digest sanitizer; permit `tenantId` in the closed Node schema. |

## Inventory delta

All 620 supplied rows were relocated again on `bce70776`: 2,845 named anchors resolve, with no unresolved source anchors. **23 pre-existing hops** were discovered in source files omitted from that inventory. The rebase onto `bce70776` adds **two separate C11 deltas**, for **25 total inventory deltas**. These are additions to the table's coverage, not changes to effective delays. Final base C10/C11 contributes two further entries: `control.session.diagnostics.burst=20` and `control.session.diagnostics.window=60000`. The total inventory delta is 25 entries (23 prior discoveries plus 2 newly landed policies). Source paths, named anchors and original extraction patterns are recorded in [p1-inventory-delta.json](p1-inventory-delta.json).

| Canonical hop | Unchanged effective value |
| --- | --- |
| `artifact.authority.request` | 3,000 ms |
| `gateway.completion.admission` | 3,000 ms |
| `gateway.document.vision` | 30,000 ms |
| `gateway.generalRead.defaultRuntime` | 900 seconds |
| `intents.availability` | 30,000 ms |
| `material.initialize.request` | 5,000 ms |
| `native.continuation.admission` | 300,000 ms |
| `native.continuation.authority` | 30,000 ms |
| `native.continuation.request` | 3,000 ms |
| `native.execution.cleanup` | 3,000 ms |
| `native.execution.request` | 10,000 ms |
| `native.execution.skew` | 1,000 ms |
| `native.intent.prepare` | 30,000 ms |
| `native.read.observation` | 3,000 ms |
| `native.read.reference` | 3,000 ms |
| `native.read.request` | 3,000 ms |
| `native.retained.credential` | 30,000 ms |
| `native.retained.source` | 15,000 ms |
| `native.routine.receipt` | 30,000 ms |
| `proxy.diagnostics.burst` | 20 count |
| `proxy.diagnostics.window` | 60,000 ms |
| `withdrawal.propagation` | 30,000 ms |
| `withdrawal.staleness` | 30,000 ms |

### C11 rebase additions

Commit `843115b6`, included in base `bce70776`, introduced the following defaults in `createSessionRefusalDiagnostics`. P1 preserves both values and passes them explicitly from `createActionSessionOwner`. These are separate from the 23 earlier discoveries. The existing golden test and constructor guard cover both values; six additional isolated mutations fail at the intended assertions.

| Canonical hop | Unchanged effective value | Named source anchor |
| --- | --- | --- |
| `control.session.diagnostics.burst` | 20 lines | `createSessionRefusalDiagnostics.burst` |
| `control.session.diagnostics.window` | 60,000 ms | `createSessionRefusalDiagnostics.windowMs` |
