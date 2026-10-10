# W02-14 phase7 conditional finite-proof delta review

CLOSED at 2026-10-10T06:57:10.074891+00:00. Read-only Codex source/data review, not candidate authorship, actual Hermes review, acceptance or service qualification. Source basis is staged five-path phase7 change atop `280a2a222d4443a03e96c7cd3c17571fa4329163`; no commit is claimed. No tests, candidate imports/evaluation, native/cloud calls or tracked edits were performed. This report is the only new ignored output.

## Disposition

No material blocker was found to retaining the **conditional arithmetic upper bounds** for this staged change. The new RunShape condition rejects the measured malformed singleton/nested-array responses before RetainRun. The direct projection now maps scalar ARN fields from the same validated immediate objects. It narrows admissible sources and restores direct count <= immediate task count <=4; filter/map/distinct do not duplicate selected ARN values. Existing namespace syntax constrains the selected strings to the reviewed ASCII namespace. The historical selected-array raw-subset bound remains conservative and need not be replaced by a tighter four-entry bound.

This is a proof delta, not a fresh execution of derive.py or a new universal proof. The historical proof is exactly pinned to280a and includes the now-repaired shape counterexample. Its source hash/line references and counterexample must remain historical; simply changing its source pin or claiming it executed against phase7 would be inaccurate. This review links that historical proof to the new exact byte inventory below. A future commit and independent review/owner verification must bind these actual bytes before source acceptance; native gates remain open.

## Exact source delta

All old nine file blobs were read from Git280a and matched the owner checkpoint manifest. Six old files are raw-identical. Three old files change only within allocated scope: workflow, canonical fixture source and appended README. Two additional paths are new, giving eleven candidate pins. All five staged blobs equal the current on-disk bytes: `{"docs/coordination/reports/W02-14-RUN-SHAPE-REPAIR.md": true, "infra/native-enforcement/README.md": true, "infra/native-enforcement/lib/workflow.mjs": true, "scripts/test-native-enforcement.mjs": true, "scripts/test-native-run-shape.mjs": true}`.

Workflow prefix before the RunShape repair and suffix starting at `pass('RetainRun',...)` are byte-identical to280a. Therefore all builder calls, literal ctx object updates/keys, nonlaunch graph structure, limits, fallback, task/Catch assignments, ledger fields, record and final outputs are unchanged. The affected compiled expressions are only the RunShape condition and the direct subexpressions substituted into RetainRun (stored direct, certainty count and failure count). RetainRun's object **shape** is unchanged. No new field or input authority enters persistent state.

Removing the new `runShapeFixtures` declaration/comment block from the canonical fixture file yields the exact280a file bytes; the implementation-mirroring canonical test was removed. The README retains the exact old byte prefix plus its phase7 appendix. The prior coordination source report is unchanged; the new report preserves the partial/author/source-only status.

| Candidate path | Bytes | SHA256 | Delta |
| --- | ---: | --- | --- |
| `infra/native-enforcement/app.mjs` | 422 | `813a912999253b147d3d88ac50d24fbe7dd063aa98c3453a9e5e825d3fe7f70c` | raw-identical to 280a |
| `infra/native-enforcement/lib/binding.mjs` | 7772 | `a14cea09763f44cd727857b2031700b4cadc9f9b53ba049e3b0ba237207db007` | raw-identical to 280a |
| `infra/native-enforcement/lib/expressions.mjs` | 12917 | `e5a1931f3058e02e20bff10faf837b65eac11c226077e9a66d0501d323b4b648` | raw-identical to 280a |
| `infra/native-enforcement/lib/workflow.mjs` | 23805 | `4dfca118e7ea7c5f59ff684f9a9301fbd8e96cccb9eaf6b187403fb7b5ecdc19` | changed in allocated scope |
| `infra/native-enforcement/lib/infrastructure.mjs` | 3625 | `6e57537dfbb675a8bc7673e26185cd4df0f769637ac3b783c4cca02681b95ae0` | raw-identical to 280a |
| `infra/native-enforcement/lib/task-definition.mjs` | 7965 | `fbe770912afaa119c50a9e1681a691a605b94c8a6f9ebd686e3555ab9e9a36ad` | raw-identical to 280a |
| `infra/native-enforcement/README.md` | 16300 | `9d99625df554cf55a37b6746528405935dc788a46a45bd507de43c27331ee250` | changed in allocated scope |
| `scripts/test-native-enforcement.mjs` | 21460 | `d294a9635f8ad17c6c73071e106dd95ae17bd732115d9fb18022348f7ff5978e` | changed in allocated scope |
| `docs/coordination/reports/W02-14-NATIVE-ENFORCEMENT.md` | 8505 | `e8b7630a7ac57dfd1693c06074c6691894af3d5bfa8f7510d65de72821a97065` | raw-identical to 280a |
| `scripts/test-native-run-shape.mjs` | 8884 | `9a1fbbe47131765fe38055f5e21ba0fc49b77de09d3df15e849f6635bd3286be` | NEW |
| `docs/coordination/reports/W02-14-RUN-SHAPE-REPAIR.md` | 7133 | `f706a68ddabe3f08dd17193bc85f0494689370ff35436fb848b3f1d32ef0bbb0` | NEW |

## Bound transfer, with the original assumptions retained

The source/data builder inventory still matches all historical entries: 31 literal pass builders,7 prepare builders,9 records and10 Task builders. Initialize remains31 keys; only launchObservedEnd/overflowed can add to33 ctx keys. Binding/expressions/task-definition/infrastructure modules are exact old bytes, so the adopted raw32768, ledger16384, ctx196608, output131072, refs16384, owned4+overflow6 and network-pin limits are unchanged.

The old proof uses actual B<=4L and conservative guard6L<=cap. New direct values remain a nonduplicating selection of bounded raw scalar strings, so serialized direct <=5461 remains valid; fallback still copies direct twice (direct and queue). The new <=4 count is a stronger reachable-shape fact, **not needed to lower or reconstruct the old estimate**. Existing fallback preservation and normal guarded-ctx cases are unchanged. Under the same compact serialization, finite binary64, fixed owner-admitted input and standard JSONata selection/merge assumptions, retained upper bounds therefore remain:

| Bound category | Actual UTF8 byte upper bound |
| --- | ---: |
| Normal complete variables |153940|
| Fallback ctx |147675|
| Fallback complete variables |170543|
| Largest assembled record Output |108135|
| Normal FinalUnknown / FinalConfirmed |130924 /130922|
| Fallback final Output |117716|

These are bounds on successfully returned explicit variable/Output values. They exclude service input/context, preprojection Task results, transient evaluation/merge allocation, definition/history/logs and transport encoding. The fallback bound does **not** show that its stricter6L predicate passes; repeated compact fallback or expression/runtime failures can prevent terminal progress. Neither this delta nor the old arithmetic proves service cleanup, sufficient time/current IAM, StopTask success, STOPPED, guard/wire behavior or physical termination.

## Focused regression evidence, read only

The original malformed-RunTask witness remains separate: singleton taskArn array previously admitted launch certainty; five nested ARNs were flattened despite a top-level count1. The promoted test reads the actual candidate expressions and runtime hash, uses relative candidate imports plus explicit runtime/output arguments, writes a single fresh wx result and adds no product or infrastructure behavior. Its16 fixtures are 2 valid +13 malformed +1 empty. The retained promoted result has81 evaluations and rejects all13 malformed fixtures via LaunchUncertain. Empty tasks still pass RunShape but explicitly assert false certainty/true qualification failure. The promoted source now explicitly asserts both owned and overflow netId/netIp/stopAttempted preservation, consumed attempt and discovery routing. Its source does not run a full workflow or prove StopTask/terminal effects. The prior private harness and author-reported48 canonical history remain preserved; the canonical set is now the original47, not replayed by this review.

Promoted result `C:\dev\main\meri-greenfield-worktrees\w02-native-enforcement\.task-inputs\W02-14-hermes-repair-7\h7-promoted-run-shape-result.json` SHA256 `7475866de138b03b8c69dc0e23a7ae780f7fc36cabff43337e97b18729946c72`. Reported source hashes match the actual current source bytes. No new test execution occurred in this review.

## Historical proof payload inventory

| Historical file | Current retained SHA256 |
| --- | --- |
| `PROOF.md` | `3d0902de81bb080ec562aca2d21828ac96e60c66dd9500234e57bc48bfb40981` |
| `ARITHMETIC.json` | `943835b05a4f33565c92b581e18cf0b0f6aaf6641a8fb881e520beec46a68c99` |
| `derive.py` | `059d27a0ce95df6ce6d8f5f070b512c974e1c06a97d78652e0571e4212679ac5` |
| `arithmetic-run-1-failure.txt` | `6a6da29465e858c694037abb6c1224697181c38c021d56768a367d81aace9bdf` |

The proof/ARITHMETIC/derive remain pinned to280a. derive.py contains exact old source hash assertions and exclusive output creation; it was neither edited nor run against phase7. Its first failed builder-count support invocation remains retained. The conditional mathematical argument survives this narrower input guard, while exact-source pinning is supplied by this separate delta report rather than by rewriting prior evidence.

No acceptance or native/security/G1/Office admission is granted. Fresh candidate commit, distinct actual review, owner source/replay and final service/IAM/wire/surviving-enforcement/physical-cleanup evidence remain parent-owned.
