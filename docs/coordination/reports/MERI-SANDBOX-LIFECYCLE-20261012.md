# Qualification probe watchdog and cleanup source repair

Author disposition: source candidate ready for independent review; native/runtime admission remains HOLD. Exact source freeze `bb44e802de14b5483c51ea1a58448ca23a5f11a0`, tree `82c7559422819d3c83718da01bbb6fe0434153f6`, based on PR15 `14be9fc614568a74133b89f2b229e50c9b030322`. Dedicated branch `task/meri-sandbox-lifecycle-20261012` and worktree `/workspace/meri-sandbox-lifecycle-20261012`; original branches and intermediate freezes remain preserved. Independent reviewer: memory_reviewer. Independent replay reported 44/44 scripted controls, 282/282 worker, 244/244 root, 7/7 public distribution and 17/17 context checks passing against the exact source freeze; the reviewer owns the separate final preservation audit and disposition. No publication or merge by this author.

## Result and actual callers

`runtime.mjs` now awaits the same cohesive owned-child supervisor used by `office-export.mjs`. Its only child entrypoints are `browser.mjs` and `artifacts.mjs`. Linux detached ownership is required before spawn. The supervisor bounds raw and retained stdout/stderr, enforces an absolute monotonic deadline, contains cancellation/errors/overflow with at most one owned-group kill request, and requires child close plus definite group absence. Exit, kill acknowledgement, permission errors and unknown group observations cannot establish cleanup. Late events cannot change a returned result or cause a new kill. A semantic failure with confirmed cleanup permits the next independent required probe; cancellation or unknown cleanup produces NOT-RUN/HOLD instead.

`browser.mjs` uses the browser-specific lifetime for loopback-server acquisition, official MCP connect/listTools/every callTool, and concurrent client/server cleanup. Server close requires its callback. One monotonic execution deadline covers parked operations and gaps between them; cleanup grace also rejects synchronous completion after its absolute bound. Stderr overflow fails the probe. Late server acquisition and late MCP startup completion receive bounded cleanup attempts. API cleanup is explicitly separate from physical process-group death, which only the outer native supervisor can observe.

The three actual CLI paths translate SIGINT/SIGTERM through the shared cancellation installer, without import-time listeners. Repeated signals retain the bounded cleanup wait and disposal removes only owned listeners. Runtime installs this bridge only around its owned-child phase after existing prechecks: an earlier DNS wait retains default OS termination behavior. Office cancellation denies directory acquisition when already aborted, interrupts pending writes and refuses later records/success. Already-written bytes cannot be recalled. Abort evidence remains bounded and cannot establish successful capture delivery.

No new task/tenant authority DTO, model loop, state store, sandbox implementation or artifact publication service was introduced. The SDK/MCP/Playwright and existing Office byte/file verifier remain their respective owners.

## Preservation and testability

The separate fixture-only commit `41ded012694bbe0d90e18506ae57c50168f1a3fc` repairs two pre-existing Linux Office test failures. `main` forwards optional group ports with production defaults unchanged. Synthetic generated children have a valid fake PID and WeakMap-owned close state; unknown fake handles refuse and absence is reported only for a known closed handle. Every original assertion and test name remains. `fixture-preservation.json` proves the enumerated inverse fixture changes restore the complete original 42,459 bytes; independent review additionally checks assertion ASTs. The original complete fixture and Office source are retained as evidence.

The eleven-file protocol, export facts/file validation, reconstruction, original static tests, artifact generator, lockfiles, Dockerfile, component pins, public 0.1 schema and private catalog bytes remain unchanged. Existing export streaming accepts an optional cancellation signal; record encoding and validation are unchanged.

Root allocated exactly four new finite context members and exactly three 53→57 membership expectations. Root additionally allocated only the test script expansion in worker package.json: the five original suites plus existing Office and both new lifecycle suites. No dependency or lock change. The final source identity manifest covers all changed source files; the finite context identity packet records 57 files / 1,026,634 bytes without assembling or building an image. Root owns derived builder/collector identity rollover and independent packaging review.

## Checks and retained failures

| Check | Result | Evidence |
| --- | --- | --- |
| Actual worker `npm test` including all new suites | 282/282 pass | `worker-final.*` |
| Root `npm run check` | 244/244 pass | `root-check-physical.*` |
| Public generated distribution | 7/7 pass | `public-distribution.*` |
| Finite context tests at exact final source freeze | 17/17 pass | `context-freeze.*` |
| Original static + Office plus new focused controls before final CLI phase addition | 177/177 pass | `lifecycle-preabort-repair.*` |
| Source/coordination-only Git diff whitespace check | pass | `packet-hygiene.json` |

All evidence paths above are under `docs/qualification/candidates/sandbox-lifecycle-20261012/author/`. Receipts retain commands, exits, stdout/stderr hashes, source HEAD/diff identities and owned-process cleanup. `source-freeze.json` verifies that the final worker receipt's source HEAD plus recorded diff exactly equals the frozen source. Earlier preliminary diff receipts preceded staging new modules and therefore omitted those untracked files; the final worker receipt and full source manifest establish the final tested bytes.

The whole evidence packet diff check reports original trailing whitespace in retained failed-test stdout. Those bytes are intentionally preserved; `packet-hygiene.json` distinguishes this from the clean source/coordination check.

Preserved negative/failure evidence:

- Independent original baseline: 146/148 pass, two Office fixture cleanup failures; original supervisor four expected controls failed. Raw independent records are copied with provenance, and the review lane retains its originals.
- Initial new author suite: 20/21 pass. The new test incorrectly expected a returned failed object from the unchanged browser step driver, which actually rejects. Corrected to assert rejection and no later call; raw failure retained.
- Initial inverse fixture checker removed an existing fake PID outside the changed helper. The corrected narrowly scoped inverse restores the entire original file; checker failure is recorded.
- Initial root check: 242/244 pass with borrowed dependency symlinks. One generated-path comparison and one filesystem-permission test refused donor paths. Physical copies of byte-matching exact-lock dependencies resolved both without source/assertion changes. Donor trees were not modified and no lifecycle hooks ran.
- Context check: 14/17 pass before root approved the three precise membership expectation changes; all three 57-versus-53 failures are retained.
- Independent Office cancellation controls exposed post-generation write handling and pre-aborted directory creation. Both were repaired and independently replayed; review lane retains original raw failures.
- Freeze `2f182431a78f4ccb200a5e4adfd62b0ad3afa508` installed runtime cancellation before an existing unbounded DNS precheck. Root's source diagnosis and exact prior runtime bytes are retained. The bridge now begins only with child ownership. Intermediate `87144573d12ea72e9d88e5d6f531f96623d8f045` and its new failing continuation control are preserved: a cancelled but clean first child no longer attempts the next probe facade.

Eighteen captured local source-check groups exited and were positively observed absent; required descendant reaping is recorded in `owned-process-cleanup.json`. No SDK native binary, browser, renderer, OS sandbox, native host signal, Docker, DB, cloud, provider/model, customer or frontend operation was executed. Only ordinary source test processes and scripted resource ports were used. The owned temporary worker dependency symlink was removed after independent replay; exact-lock physical root/contracts copies remain ignored local dependencies. Donor trees remain untouched.

## Remaining gates

Independent source acceptance is separate from native/runtime acceptance. Target image/build/scan/license admission, real process-group identity/death, native SIGINT/SIGTERM/SIGKILL behavior, Chromium sandbox, renderer isolation, egress, external watchdog and host-death cleanup remain UNRUN/HOLD. Non-Linux fallback observes only direct-child close. Existing runtime precheck DNS bounds are outside this child repair and remain unqualified. A standalone diagnostic browser/artifact entry does not provide the outer owned-group observation.

The selected runtime/Temporal owners still owe trusted task A/B authority, identity/auth/expiry/revocation, native checkpoint recovery/stale rejection, durable runtime integration and artifact publication admission. Source connectivity remains disabled. No infrastructure action, spend authority or security approval is inferred. G1 remains open; this qualification source packet does not enter later runtime gates.
