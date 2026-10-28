# W5-M7-03 — model-budget-independent management of an existing routine

Listing routines and explicitly approving pause/delete of future firings from an already-persisted exact session no longer read tenant model-policy settings or construct execution limits. The existing authenticated session expiry bounds these management operations. This is a finite MR-03 continuation, not full M7 completion or deployed acceptance.

## Source and ownership

- New isolated checkout: `work/m7-management-budget-20261027`; branch `codex/wave5-m7-management-budget-20261027`.
- Base: immutable Wave5 M5/M7 integration `1f1ca0e3aacefb2e001f45fa4fa4ae91e9c30cb2`, tree `9b9f536da807f8f47d916b2107be1227645a97c6`. Its independent integration review is separate from this continuation.
- Owner: Wave5 M7; root coordinates publication/integration, Hermes owns independent review and acceptance, Release owns later target operations. M5 confirmed no overlap with its document/file owners.
- Exactly six claimed files: `apps/control/schedules/runtime-context.mjs`, its `test/runtime-context.test.mjs`, `apps/runtime/native-authority/routines-owner-composition.mjs`, its adjacent test, `apps/runtime/test/native-schedule-intents.test.mjs`, and this handoff.
- Original M5/M7 branches, the integration checkpoint and all Wave4 patches are preserved. No public schema, package, metadata, catalog, lock, migration or release configuration changed.

## Existing owners and finite change

The schedule runtime context already receives null destination/limits from current Core policy for list/cancel. Previously its constructor nevertheless required a positive model budget or execution allocation. The native context owner also read model-policy settings before every management phase, including for a completed source run. Eight new selected tests fail against that unchanged source.

The existing runtime context now accepts exactly one of allocation, positive execution limits, or a private `managementExpiresAtMs` facet. The last option contains the real authenticated expiry and no execution budget. Canonical request normalization precedes a closed management check: only `list_scheduled_tasks`, or `cancel_scheduled_task` with `running=leave` and no selected runs, is admitted. Create/update/current-work cancellation is rejected before authority reads, schedule reads or identity preparation. No new public request field or framework was introduced.

The native owner selects this context only when the first exact-session run read finds a persisted run. It retains identity, client/General scope, current unreserved head, policy, all existing version checks, schedule ownership/generation, retention, explicit approval and replay. Initial binding and execution paths still read valid positive model policy and reject drift. An initial request cannot discard its budget requirement if the run becomes persisted; a persisted management request cannot fall back to an initial binding if its run disappears. The prior image-only exception is unchanged.

Existing fresh Core policy must still authorize every phase. Cancel receipts retain the stored schedule's limits and distinguish future firings stopped from physical stop. No placeholder budget is invented, no source of execution authority is removed, and no model-cap exhaustion behavior is claimed: this owner does not query monthly spend.

## Verification

Toolchain: Node `24.22.1`, explicitly `C:/Program Files/nodejs/node.exe`. Existing dependency caches are borrowed through ignored task-owned junctions; no install/cache mutation. Relevant pins remain AJV `8.20.0`, Temporal client `1.24.0`, AWS S3 `3.1141.0`, AI SDK `7.0.137`, contracts npm `0.1.22` and UIstream npm `0.1.9`. The local worker contracts link points to this checkout. An initial load attempt failed for a missing Temporal junction before assertions; that setup failure is retained separately.

Affected suite:

```text
node --experimental-test-module-mocks --test --test-concurrency=1 apps/control/schedules/test/runtime-context.test.mjs apps/runtime/native-authority/test/routines-owner-composition.test.mjs apps/runtime/test/native-schedule-intents.test.mjs
```

Final result: **68 passed, 0 failed, 0 skipped**, exit 0. Thirteen tests were added; existing blanket management-budget denials were replaced by positive management cases and explicit initial-binding/execution denials. No test was disabled. Coverage includes zero/unavailable/changing model policy with zero model-policy reads for management; public list and explicit pause/delete with ACK replay once; positive execution limits and drift refusal; expiry/current policy, owner/head, non-image versions, retention, revocation and generation fences; and initial/persisted transition boundaries. Real application/context/journal owners run against existing scripted Core, SQL and Temporal fixtures; no network listener or live provider was used.

Unchanged-source witness: the eight selected management tests fail, exit 1, under `--test-name-pattern='management context|management does not read|public management remains available'`. Three reject the unsupported management configuration; native/public cases expose the original model-policy dependence.

A mutation removing the vanished-persisted-run guard fails `persisted management cannot fall back...` with a missing expected rejection, exit 1. The source is restored byte-for-byte to the fully passing version. `node --check` on the five changed executable/test files and `git diff --check` pass. Package source equality with immutable archive source `74890bb96232dcce96d4fb4f31359038efb9db63` is verified; no regeneration/repack or provenance relabel.

Task-local evidence: `work/m7-management-budget-evidence-20261027/{base-witness.txt,focused-tests.txt,mutation.txt,mutation-restored.txt,dependency-attempt.txt}`. The earlier 67-test pass is retained as `focused-tests-before-persistence-cases.txt`. Exact final commit/tree and evidence hashes are supplied in the parent handoff.

## Remaining scope and next step

Fresh-page/bootstrap/successor selection remains a separate MR-03/MF-18 allocation. This patch does not alter Stop/firing/consent or any other M7 row. The full 14-ID remaining-work matrix is `outputs/WAVE5-M7-REMAINING-MATRIX.txt`; broader M7 source and affected live proof remain open.

No broad suite, runtime build, package build, target/DB/cloud/browser/model action, push, PR, merge, deployment or formal acceptance was performed. Current Core policy still governs; the constructor still requires its configured static task/workflow and model-policy port for execution callers. Later deployed observations must use the authorized healthy cohort and existing target gates. Root should send this exact source for independent Hermes review before integration/publication. Retain the isolated checkout and ignored cache links; no task-owned process/port or external resource remains.
