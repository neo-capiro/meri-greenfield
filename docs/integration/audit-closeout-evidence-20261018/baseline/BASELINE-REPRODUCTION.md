# Pinned closeout baseline reproduction

Read-only source/dependency controls before repairs. Source was not edited.

| Pin | Standard | Focused worker | Runtime / control diagnostics |
|---|---|---|---|
| PR180 `a1876afaeaa59d9da47729487d490cba8cfc9d9c` | 4357 passed / 32 failed / 4389 | 4 passed / 16 failed / 20 | 3 / 18 |
| Immediate parent `1aa5c66e9283024e78ad6f26f5450cbc61a37659` | 4357 passed / 32 failed / 4389 | 4 passed / 16 failed / 20 | 3 / 18 |
| Receiving baseline `141f2ada6378382f2bf7462d8a2c5dc7758230d0` | 4356 passed / 33 failed / 4389 | 4 passed / 16 failed / 20 | 3 / 18 |

Candidate has exactly **48 distinct named failures** across the two commands. Its 32 standard names equal the published inventory; all 48 fail identically on the immediate parent and receiving baseline. Receiving baseline adds one history metadata source fingerprint failure already resolved by PR180. Compiler outputs are byte-identical across all three source pins: 21 project occurrences, 19 unique path/line/column/code diagnostics.

Audit bundle SHA-256: `761712caae2671d5dc8c56cb49c1126d01b6373f89a99ebeaa923efe966947e8`. Its original candidate was `43db1dfa`, published equivalent `7e4e7582`, tree `ca3f3a59e556e191a2a76c74c5deb87cc356af5a`. All eight worker fixture/service/store/test source hashes remain byte-identical at the newer requested candidate `a1876afa`; measured runs above establish counts independently.

Environment: Node `v24.19.0`, npm `11.9.0`, TypeScript `5.9.3`; all 14 lockfiles are byte-identical. Immutable matching dependency installs were reused, with contracts dependencies physically copied inside each worktree and each `@capiro/meri-contracts` resolving its own worktree. `TZ=America/Toronto`, `NODE_OPTIONS` unset for historical reproduction.

```sh
env -u NODE_OPTIONS TZ=America/Toronto npm run check
env -u NODE_OPTIONS TZ=America/Toronto node --test apps/worker/conversation/test/options-trust.test.mjs apps/worker/conversation/test/activity.test.mjs apps/worker/conversation/test/terminal-settlement.test.mjs
env -u NODE_OPTIONS TZ=America/Toronto node apps/runtime/node_modules/typescript/bin/tsc --noEmit --pretty false -p apps/runtime/tsconfig.json
env -u NODE_OPTIONS TZ=America/Toronto node apps/runtime/node_modules/typescript/bin/tsc --noEmit --pretty false -p apps/control/conversations/tsconfig.json
env -u NODE_OPTIONS TZ=UTC node --experimental-vm-modules --test packages/contracts/test/document-application-independent.test.mjs packages/contracts/test/retrieval-public-domain-query.test.mjs
```

The final diagnostic environment control passes 83/83 on candidate and receiving baseline. It proves the VM-module and timezone-sensitive failures depend on the invocation environment; it does not erase those failures from the historical 32. Initial missing Zod/Temporal dependency setup attempts remain separately labeled and are excluded from source counts.

## Every original failing test

| ID | Exact test / declaration | Initial category | Baseline |
|---|---|---|---|
| S01 | independent public receiver actual PR42 query/read<br>`packages/contracts/test/action-application-independent.test.mjs:17:128` | test setup/environment problem | Same named failure on all three pins |
| S02 | independent public receiver actual PR42 draft/draft<br>`packages/contracts/test/action-application-independent.test.mjs:17:128` | test setup/environment problem | Same named failure on all three pins |
| S03 | independent public receiver actual PR42 prepare/pending<br>`packages/contracts/test/action-application-independent.test.mjs:17:128` | test setup/environment problem | Same named failure on all three pins |
| S04 | independent public receiver actual PR42 execute/executed<br>`packages/contracts/test/action-application-independent.test.mjs:17:128` | test setup/environment problem | Same named failure on all three pins |
| S05 | independent public receiver actual PR42 execute/replay<br>`packages/contracts/test/action-application-independent.test.mjs:17:128` | test setup/environment problem | Same named failure on all three pins |
| S06 | independent actual pending approval error and indeterminate accounting remain non-success<br>`packages/contracts/test/action-application-independent.test.mjs:18:1` | test setup/environment problem | Same named failure on all three pins |
| S07 | independent receiving refusal accepted recommendation<br>`packages/contracts/test/action-application-independent.test.mjs:36:3` | test setup/environment problem | Same named failure on all three pins |
| S08 | independent receiving refusal unknown query field<br>`packages/contracts/test/action-application-independent.test.mjs:36:3` | test setup/environment problem | Same named failure on all three pins |
| S09 | independent receiving refusal query digest<br>`packages/contracts/test/action-application-independent.test.mjs:36:3` | test setup/environment problem | Same named failure on all three pins |
| S10 | independent receiving refusal event binding<br>`packages/contracts/test/action-application-independent.test.mjs:36:3` | test setup/environment problem | Same named failure on all three pins |
| S11 | independent receiving refusal event result ref<br>`packages/contracts/test/action-application-independent.test.mjs:36:3` | test setup/environment problem | Same named failure on all three pins |
| S12 | independent receiving refusal draft digest<br>`packages/contracts/test/action-application-independent.test.mjs:36:3` | test setup/environment problem | Same named failure on all three pins |
| S13 | independent receiving refusal recommendation hash<br>`packages/contracts/test/action-application-independent.test.mjs:36:3` | test setup/environment problem | Same named failure on all three pins |
| S14 | independent receiving refusal prepare approval confusion<br>`packages/contracts/test/action-application-independent.test.mjs:36:3` | test setup/environment problem | Same named failure on all three pins |
| S15 | independent receiving refusal proposal digest<br>`packages/contracts/test/action-application-independent.test.mjs:36:3` | test setup/environment problem | Same named failure on all three pins |
| S16 | independent receiving refusal proposal task substitution<br>`packages/contracts/test/action-application-independent.test.mjs:36:3` | test setup/environment problem | Same named failure on all three pins |
| S17 | independent receiving refusal prepare client substitution<br>`packages/contracts/test/action-application-independent.test.mjs:36:3` | test setup/environment problem | Same named failure on all three pins |
| S18 | independent receiving refusal execute approval confusion<br>`packages/contracts/test/action-application-independent.test.mjs:36:3` | test setup/environment problem | Same named failure on all three pins |
| S19 | independent receiving refusal execute unknown key<br>`packages/contracts/test/action-application-independent.test.mjs:36:3` | test setup/environment problem | Same named failure on all three pins |
| S20 | independent receiving refusal execute tenant-scope mismatch<br>`packages/contracts/test/action-application-independent.test.mjs:36:3` | test setup/environment problem | Same named failure on all three pins |
| S21 | independent route and status cannot reclassify an actual payload<br>`packages/contracts/test/action-application-independent.test.mjs:37:1` | test setup/environment problem | Same named failure on all three pins |
| S22 | independent generated browser receiver has no external/private/Node imports<br>`packages/contracts/test/action-application-independent.test.mjs:42:1` | test setup/environment problem | Same named failure on all three pins |
| S23 | independent receiving accepts canonical nonconsecutive reserved event sequence<br>`packages/contracts/test/action-application-independent.test.mjs:54:1` | test setup/environment problem | Same named failure on all three pins |
| S24 | initial-input generation records exact canonical provenance and one shared browser import<br>`packages/contracts/test/conversation-initial-input-public.test.mjs:50:1` | stale expectation | Same named failure on all three pins |
| S25 | standalone browser module works with no Node or private graph<br>`packages/contracts/test/document-application-independent.test.mjs:76:1` | test setup/environment problem | Same named failure on all three pins |
| S26 | all fourteen original descriptors and all139 native rows remain exact<br>`packages/contracts/test/retrieval-action-item-binding.test.mjs:88:1` | stale expectation | Same named failure on all three pins |
| S27 | partial binding preserves every original row and fourteen descriptors<br>`packages/contracts/test/retrieval-action-item-independent.test.mjs:26:1` | stale expectation | Same named failure on all three pins |
| S28 | meeting schema objects stay closed and package public exports stay 0.1 only<br>`packages/contracts/test/retrieval-meeting-source.test.mjs:361:1` | stale expectation | Same named failure on all three pins |
| S29 | operation is mapped but unavailable and public exports stay separate<br>`packages/contracts/test/retrieval-memory-proposals.test.mjs:120:1` | stale expectation | Same named failure on all three pins |
| S30 | operational-read schema objects stay closed and package public exports stay 0.1 only<br>`packages/contracts/test/retrieval-operational-reads.test.mjs:394:1` | stale expectation | Same named failure on all three pins |
| S31 | trusted default as-of is distinct from explicit date and generatedAt<br>`packages/contracts/test/retrieval-public-domain-query.test.mjs:101:1` | test setup/environment problem | Same named failure on all three pins |
| S32 | actual prepare/approve/execute API wire admits canonical normalization and immutable correlated result<br>`packages/contracts/test/task-command-application-public.test.mjs:25:1` | stale expectation | Same named failure on all three pins |
| W01 | one SDK query persists streamed text once, hides reasoning and completes durable run<br>`apps/worker/conversation/test/activity.test.mjs:5:1` | test setup/environment problem | Same named failure on all three pins |
| W02 | nonstreamed final assistant text is displayed with a valid generated UUID<br>`apps/worker/conversation/test/activity.test.mjs:6:1` | test setup/environment problem | Same named failure on all three pins |
| W03 | SDK mirror never leaks diagnostics or makes a duplicate model query<br>`apps/worker/conversation/test/activity.test.mjs:7:437` | test setup/environment problem | Same named failure on all three pins |
| W04 | SDK missing never leaks diagnostics or makes a duplicate model query<br>`apps/worker/conversation/test/activity.test.mjs:7:437` | test setup/environment problem | Same named failure on all three pins |
| W05 | SDK sdkFailure never leaks diagnostics or makes a duplicate model query<br>`apps/worker/conversation/test/activity.test.mjs:7:437` | test setup/environment problem | Same named failure on all three pins |
| W06 | SDK duplicate never leaks diagnostics or makes a duplicate model query<br>`apps/worker/conversation/test/activity.test.mjs:7:437` | test setup/environment problem | Same named failure on all three pins |
| W07 | SDK subagent never leaks diagnostics or makes a duplicate model query<br>`apps/worker/conversation/test/activity.test.mjs:7:437` | test setup/environment problem | Same named failure on all three pins |
| W08 | revocation during query stops publication and closes SDK before another result<br>`apps/worker/conversation/test/activity.test.mjs:8:1` | test setup/environment problem | Same named failure on all three pins |
| W09 | output limit fails instead of truncating a completed response<br>`apps/worker/conversation/test/activity.test.mjs:9:1` | test setup/environment problem | Same named failure on all three pins |
| W10 | late SDK iterator is bounded by deadline and closed without a second query<br>`apps/worker/conversation/test/activity.test.mjs:10:1` | test setup/environment problem | Same named failure on all three pins |
| W11 | final assistant frame repairs a missing streamed suffix without duplicate prefix<br>`apps/worker/conversation/test/activity.test.mjs:12:1` | test setup/environment problem | Same named failure on all three pins |
| W12 | a conflicting final text refuses completion instead of silently dropping the mismatch<br>`apps/worker/conversation/test/activity.test.mjs:13:1` | test setup/environment problem | Same named failure on all three pins |
| W13 | runtime preparation mismatch records a failed run without invoking SDK<br>`apps/worker/conversation/test/activity.test.mjs:14:1` | test setup/environment problem | Same named failure on all three pins |
| W14 | terminal recording slower than 30 ms is acknowledged on the first attempt<br>`apps/worker/conversation/test/terminal-settlement.test.mjs:14:1` | test setup/environment problem | Same named failure on all three pins |
| W15 | a lost acknowledgement is read back by replaying the same event ID; no second terminal event<br>`apps/worker/conversation/test/terminal-settlement.test.mjs:16:1` | test setup/environment problem | Same named failure on all three pins |
| W16 | never acknowledged: settlement is finite (two rounds over two fixed event IDs) and leaves the run nonterminal for the reconciler<br>`apps/worker/conversation/test/terminal-settlement.test.mjs:19:1` | test setup/environment problem | Same named failure on all three pins |

Initial categories above describe observed failure boundaries. Repair lanes must verify intended contracts before final cause classification. Full original assertions, expected/actual values, exact diagnostics, source hashes, counts and scrubbed log manifest are in [baseline-reproduction-inventory.json](baseline-reproduction-inventory.json). Every raw failed run is preserved locally; publish only scrubbed logs. Scrubbing replaces absolute task directories only. No source or tracked/generated file was modified for reproduction.
