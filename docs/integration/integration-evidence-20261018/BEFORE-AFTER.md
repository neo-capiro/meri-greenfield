# Combined failure verification

Published code `88026e7e5ff5a568b9c2c250c6ebb1573abe09b3`; reviewed local code `ae62b15195bbeb3ad99cdcb5c3d5105736eadf59`; identical complete tree `7b599373392e91b0ffd04f0e80b4f5a5291024c6`.

All **48 original literal failed names** are present as passing tests in the final standard/worker logs. All **21 original diagnostic occurrences** resolve; successful typecheck logs are correctly empty. Full original assertions, expected/actual values, source file/line/columns, parent comparisons and fix commits remain in [the original detailed inventory](../audit-closeout-evidence-20261018/BEFORE-AFTER-INVENTORY.md). This follow-up does not replace or suppress that evidence.

| Original case | Exact test | Classification | Published original repair | Combined |
| --- | --- | --- | --- | --- |
| S01 | independent public receiver actual PR42 query/read | test setup/environment problem | `f205fb6bdfed` | PASS |
| S02 | independent public receiver actual PR42 draft/draft | test setup/environment problem | `f205fb6bdfed` | PASS |
| S03 | independent public receiver actual PR42 prepare/pending | test setup/environment problem | `f205fb6bdfed` | PASS |
| S04 | independent public receiver actual PR42 execute/executed | test setup/environment problem | `f205fb6bdfed` | PASS |
| S05 | independent public receiver actual PR42 execute/replay | test setup/environment problem | `f205fb6bdfed` | PASS |
| S06 | independent actual pending approval error and indeterminate accounting remain non-success | test setup/environment problem | `f205fb6bdfed` | PASS |
| S07 | independent receiving refusal accepted recommendation | test setup/environment problem | `f205fb6bdfed` | PASS |
| S08 | independent receiving refusal unknown query field | test setup/environment problem | `f205fb6bdfed` | PASS |
| S09 | independent receiving refusal query digest | test setup/environment problem | `f205fb6bdfed` | PASS |
| S10 | independent receiving refusal event binding | test setup/environment problem | `f205fb6bdfed` | PASS |
| S11 | independent receiving refusal event result ref | test setup/environment problem | `f205fb6bdfed` | PASS |
| S12 | independent receiving refusal draft digest | test setup/environment problem | `f205fb6bdfed` | PASS |
| S13 | independent receiving refusal recommendation hash | test setup/environment problem | `f205fb6bdfed` | PASS |
| S14 | independent receiving refusal prepare approval confusion | test setup/environment problem | `f205fb6bdfed` | PASS |
| S15 | independent receiving refusal proposal digest | test setup/environment problem | `f205fb6bdfed` | PASS |
| S16 | independent receiving refusal proposal task substitution | test setup/environment problem | `f205fb6bdfed` | PASS |
| S17 | independent receiving refusal prepare client substitution | test setup/environment problem | `f205fb6bdfed` | PASS |
| S18 | independent receiving refusal execute approval confusion | test setup/environment problem | `f205fb6bdfed` | PASS |
| S19 | independent receiving refusal execute unknown key | test setup/environment problem | `f205fb6bdfed` | PASS |
| S20 | independent receiving refusal execute tenant-scope mismatch | test setup/environment problem | `f205fb6bdfed` | PASS |
| S21 | independent route and status cannot reclassify an actual payload | test setup/environment problem | `f205fb6bdfed` | PASS |
| S22 | independent generated browser receiver has no external/private/Node imports | test setup/environment problem | `f205fb6bdfed` | PASS |
| S23 | independent receiving accepts canonical nonconsecutive reserved event sequence | test setup/environment problem | `f205fb6bdfed` | PASS |
| S24 | initial-input generation records exact canonical provenance and one shared browser import | product defect | `49a2f2a72263` | PASS |
| S25 | standalone browser module works with no Node or private graph | test setup/environment problem | `d912ab77a978` | PASS |
| S26 | all fourteen original descriptors and all139 native rows remain exact | stale expectation | `74a1c9de931d` | PASS |
| S27 | partial binding preserves every original row and fourteen descriptors | stale expectation | `74a1c9de931d` | PASS |
| S28 | meeting schema objects stay closed and package public exports stay 0.1 only | stale expectation | `74a1c9de931d` | PASS |
| S29 | operation is mapped but unavailable and public exports stay separate | stale expectation | `74a1c9de931d` | PASS |
| S30 | operational-read schema objects stay closed and package public exports stay 0.1 only | stale expectation | `74a1c9de931d` | PASS |
| S31 | trusted default as-of is distinct from explicit date and generatedAt | product defect | `3ce470a28be6` | PASS |
| S32 | actual prepare/approve/execute API wire admits canonical normalization and immutable correlated result | stale expectation | `74a1c9de931d` | PASS |
| W01 | one SDK query persists streamed text once, hides reasoning and completes durable run | test setup/environment problem | `1ec3c56a51be` | PASS |
| W02 | nonstreamed final assistant text is displayed with a valid generated UUID | test setup/environment problem | `1ec3c56a51be` | PASS |
| W03 | SDK mirror never leaks diagnostics or makes a duplicate model query | test setup/environment problem | `1ec3c56a51be` | PASS |
| W04 | SDK missing never leaks diagnostics or makes a duplicate model query | test setup/environment problem | `1ec3c56a51be` | PASS |
| W05 | SDK sdkFailure never leaks diagnostics or makes a duplicate model query | test setup/environment problem | `1ec3c56a51be` | PASS |
| W06 | SDK duplicate never leaks diagnostics or makes a duplicate model query | test setup/environment problem | `1ec3c56a51be` | PASS |
| W07 | SDK subagent never leaks diagnostics or makes a duplicate model query | test setup/environment problem | `1ec3c56a51be` | PASS |
| W08 | revocation during query stops publication and closes SDK before another result | test setup/environment problem | `1ec3c56a51be` | PASS |
| W09 | output limit fails instead of truncating a completed response | test setup/environment problem | `1ec3c56a51be` | PASS |
| W10 | late SDK iterator is bounded by deadline and closed without a second query | test setup/environment problem | `1ec3c56a51be` | PASS |
| W11 | final assistant frame repairs a missing streamed suffix without duplicate prefix | test setup/environment problem | `1ec3c56a51be` | PASS |
| W12 | a conflicting final text refuses completion instead of silently dropping the mismatch | test setup/environment problem | `1ec3c56a51be` | PASS |
| W13 | runtime preparation mismatch records a failed run without invoking SDK | test setup/environment problem | `1ec3c56a51be` | PASS |
| W14 | terminal recording slower than 30 ms is acknowledged on the first attempt | test setup/environment problem | `1ec3c56a51be` | PASS |
| W15 | a lost acknowledgement is read back by replaying the same event ID; no second terminal event | test setup/environment problem | `1ec3c56a51be` | PASS |
| W16 | never acknowledged: settlement is finite (two rounds over two fixed event IDs) and leaves the run nonterminal for the reconciler | test setup/environment problem | `1ec3c56a51be` | PASS |

All 21 exact diagnostic records, locations/messages and results are in [JSON](BEFORE-AFTER.json). The four additional fixtures, stale option expectations, retention port composition and PR186 date follow-up are separately mapped there; their count is not folded into the original48. Actual SDK admission failures and native/image/operator gates remain open in the [integration ledger](../MERI-INTEGRATION-20261018.md).

Scrubbing replaces only local workspace paths. Upstream sublane manifests retain their source-time hashes. The outer `evidence-manifest.json` is authoritative for these published, path-scrubbed copies; a source-time manifest is not silently recomputed.
