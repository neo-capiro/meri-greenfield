# Browser wire and recovery independent source review

Proportionate outline before source review: canonical binding/planner/volume validators retain their existing ownership. Inspect the closed eight-member source2 closure and separate pure recovery boundary, sealed raw/Git evidence and exact deltas. Run only new guarded parser/reconciliation controls after support-closure validation; never import wire_capture or invoke CLI/cloud entrypoints. Verify finite-number, duplicate-key, original-run/deadline/window/complete-pagination/singleton constraints and permanently false deletion/cleanup admission. Sole tracked output is this report; dedicated base92c5a9d and ignored evidence only. No AWS, provider/network, install, native host, reservations, freezes, deletion or G1 authority.

## Verdict and concrete repair

SOURCE2 HOLD for author report-only commit `1a0d8d8f265cd2d795598e6dfb733b85d3962d2c`, base `92c5a9d430aa4e8d022b4b6697ff8ecd75662ce3`. The finite-number repair is present at all three parser boundaries. The new recovery function still accepts malformed pagination/envelope metadata and returns a positive owned ID. This review did not author or modify candidate sources. No deletion, dispatcher or runtime admission follows from any result.

Two narrow source findings explain the six independent failed controls:

1. `recovery/volume_reconcile.py`, `reconcile`: `token = page.get('NextToken')` followed by `if token is None: break` accepts an explicitly present null token as complete inventory. Require an absent token for completion, or a present nonempty bounded string before continuation. Null/boolean/numeric/empty tokens must refuse under the intended closed shape.
2. `source2/volume_action.py`, `singleton`: `not current.get('NextToken')` accepts null, false, zero and empty string as a complete direct reread. It also permits unknown envelope fields. Require the exact reviewed singleton envelope before canonical volume validation; for this fixed CLI response, `Volumes` alone is the expected complete shape. Keep any newly supported metadata explicit and typed rather than truthiness-based.

The second issue is an unchanged canonical domain function, newly used to establish the recovery result. Repair its one canonical owner and regenerate both affected closures; do not duplicate a weaker validator inside recovery. Preserve raw response/error evidence. No change to IAM, mutation scope, original deadlines or volume security assertions is indicated by these findings.

## Exact failed inputs

Each case uses one synthetic correctly tagged available unattached 1 GiB gp3 volume, canonical KMS/AZ, valid create time, fixed original run/window/C900 and consumed-create record. The inventory and direct positive control succeeds. The six expected refusals instead return `POSITIVE_OWNED_ID_REQUIRES_SEPARATE_CLEANUP_REVIEW`, volume `vol-0123456789abcdef0`:

| Failed control | Inventory envelope delta | Fresh direct envelope delta |
|---|---|---|
| page-explicit-null-token | `NextToken: null` | ordinary singleton |
| direct-malformed-token-null | ordinary complete page | `NextToken: null` |
| direct-malformed-token-false | ordinary complete page | `NextToken: false` |
| direct-malformed-token-zero | ordinary complete page | `NextToken: 0` |
| direct-malformed-token-empty | ordinary complete page | `NextToken: ""` |
| direct-unknown-envelope-key | ordinary complete page | `Unexpected: true` |

All six returned `admittedDeletion=false` and `qualificationCleanupPassed=false`. These are pure fake-response observations, not measured AWS responses or physical resource actions. No live correctness claim is made about AWS returning these malformed values.

The exact fixed literals, original input, volume, requests and resulting facts are retained in the independent source and raw stdout. Current capture binding must authenticate original protected records and current caller separately; injected fake `identity()` calls establish call order, not real identity.

## Independent check and provenance

One newly authored guarded child ran once, Python 3.12.14 `-I -B`, shell false, 60-second direct-child bound, replacement environment and raw binary output. It exited 1 in 0.125 seconds, 2026-10-10T21:01:26.298153Z–21:01:26.424497Z: **36 finite controls, 30 PASS / 6 FAIL**. No source patch or behavior replay occurred. The original 12 controls and author's 22-group broad suite were not replayed.

The checks cover seven invalid JSON inputs across binding, bootstrap and real planner owner-file boundaries; a finite binding value; the complete positive reconciliation; zero/multiple/foreign/attached/partial/expired/direct-time drift refusal; and the six malformed envelope cases. Twenty of the 21 parser negatives reached the actual numeric/constant/duplicate parser rejection. The planner's `-1e309` case refused earlier with `owner file changed before read` at its Windows lstat/fstat identity guard. It establishes refusal, not numeric-parser reach for that one case. That guard observation remains retained; no filesystem normalization or rerun concealed it. The finite positive exercises binding only. Static inspection verifies all three use `parse_float` with `math.isfinite`, constants and duplicates refused; those finite runtime observations are not universal numeric proof.

The full support closure was checked before any candidate imports, and after the child. The child imports only binding, bootstrap, pure planner, recovery and its canonical volume dependency; `wire_capture` is denied by a finder and remained absent. Socket/process audit guards were installed before candidate imports and recorded no attempted physical events. No bootstrap main, CLI/capture entrypoint, reservations, freezes, AWS/model/provider, install, server or native host operation was invoked.

All 73 final manifest files rehashed exact before/after. Actual author HEAD, sole report diff and raw Git report were independently captured and compared. Source2's eight members and separate recovery closure were verified before imports, and the original ordinary `build` function AST remains identical. This review's code inspection found no algorithm change in ordinary planner products; author local product-equality evidence remains dated DATA, not an independent planner behavior replay.

| Retained input/output | Bytes | SHA256 |
|---|---:|---|
| author final manifest | 49392 | 8ac581a5b282494ed286b86263dee0e74676d0df211d7eee2a0b70f470d84d08 |
| author report | 7337 | 74b7901498a20a696e99239197520bab6b09dbed7d6a9205add479fbf55f1bb4 |
| source2 closure | 1310 | 945182899a425a333f93facb2c7cdc47e5b552c2cd8dc5a2331c6e743e99e117 |
| recovery closure | 745 | 4249ecba0f32b06a537e66ced1934d3ac379ae362bcc6451c7d2d9f6ec127150 |
| volume_reconcile.py | 4604 | 78a6ba473713c7645b198cdf305f03a2e1f6e293b212291836bf7460a6ff4e62 |
| source2 wire_binding.py | 7124 | 18252026762df180bba9cf8725c49643fb9f0d3e8fdfae0c5011aa54e06637db |
| source2 volume_action.py | 4859 | 9b21442c2e68b3b66de75b38380bdce328e0bf36a1b68e6c48a55e87f1dd7c37 |
| source2 run_action.py | 5891 | 18431c26b47503cf27d85de41b83372311a6dcc5cf12a7e07d045618846cff4c |
| source2 prepare_fixtures.py | 7461 | 3f68bba2a2e960835dad2fd7fad9d672b9b72484cb3e744f3304e51a59cc3636 |
| independent raw stdout | 8496 | a7f4eb400e83ff718a6374fb9d035c1b16e52f82ecedfea6ffb91b8b552ba224 |

Evidence lives in this review worktree's ignored `.task-inputs/wire-recovery-review-1/`, including sealed file inventory, original fixed control source, process receipt, binary streams, pre/post records and three own raw Git reads. Stderr is empty. The source and evidence hashes establish byte identity within a trusted checkout; they are not authority attestations.

## Historical qualifications and remaining hold

The author's first count labels double-counted the historical parser case. Actual retained unittest output is 22 groups: 11 unchanged domain groups, one repaired parser group, ten new groups. Its DATA-only label correction retains original result and `.FIRST` source copies without behavior replay. Historical records referring to the old control/preparation paths must bind their preserved `.FIRST` bytes, not current metadata-corrected bytes. This review distinguishes the 73 final current records from those historical path references and statically checks the preserved function/class AST equivalence. No blanket recursive-current-byte identity is claimed.

Initial file discovery used an ignored-directory rg search with no matches, then explicit hidden discovery; an initial report filename guess was absent, then the actual sole Git path was read. Both were read-only navigation failures, not candidate execution.

The pure reconciliation remains a separate cohesive module composing canonical original/window and volume validation. It returns raw pages/direct observations and false admission flags, without adding a dispatcher or second lifecycle authority. Operational original-record authentication, exact-ID first-delete path, uncertain-create and late billing fallback still require separately allocated review. A late cleanup cannot reset original C900 or pass qualification. No ACK, empty inventory, access denial or positive owned ID proves absence. Actual error-wire/TestState behavior, physical cleanup, host/browser sandbox, source connectivity, security disposition and G1 remain open. Current Meri is untouched.

Direct-child timeout and post-capture byte caps do not establish descendant containment or an in-flight output bound. Filesystem and injected capture/clock integrity remain trusted assumptions. This report concludes the source review with HOLD and preserves all six failures.
