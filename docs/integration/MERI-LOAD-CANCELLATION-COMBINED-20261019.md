# Combined load and cancellation repair — 2026-10-19

## Exact inputs and ownership

- Common base: `a16cc40d2a7ca3695eb6cc5a8d45440d0c40d040`.
- Frozen load repair: `546782fb28f0e496004f6fca790734409ff96969`, branch `repair/source348-request-load-auth-20261019`.
- Independently reviewed cancellation repair: `816b5873d693f49d0383c0808d1d2319f246052a`, branch `codex/meri-session-cancellation-20261019`; pushed and verified before integration.
- Combined branch: `codex/meri-load-cancellation-integration-20261019`, based on the load commit, with a merge of the original cancellation commit. Both original commits are retained as parents/ancestors.

The parent assigned this lane sole ownership of the overlapping session owner after the load owner froze its edits. The combined plan was to retain the load reader and its existing checkpoints, apply the reviewed cancellation cleanup to the renamed authentication implementation, explicitly reconcile its test expectation, independently review, then run the combined regressions. No frontend, shared lifetime helper, manifest, lockfile, migration, shipment input or deployment changes are part of this integration.

The supplied `c10e8e548831705b6cd2d7d92e4b8673d5a3ed3c` was fetched and inspected. It is a separate source-proof/document branch whose merge base with the load repair is a16, not a descendant of the load commit. Its proof/manifests changes were not imported into this bounded integration.

## Exact conflict resolution

Git reported a content conflict only in `apps/control/action-host/session/owner.mjs` around the authentication/current-state methods.

1. Keep the load repair's `authenticate(value, includeCurrent)` implementation, the public `authenticateSession` wrapper, `currentReceipt` helper, and module-private `authenticatedCurrentState` WeakMap capability. Each call still resolves authority afresh and produces correlated existing receipt shapes.
2. Keep the cancellation repair's lifetime-local exact `CANCELLED` error marker, matching caller/timer checks, narrow membership rethrow, and `rejectRecheck`. Validation failure while considering preservation removes the record.
3. Replace the renamed internal `authenticate` catch and standalone `readCurrentState` catch with `catch(error){rejectRecheck(r,t,error);}`. Both the public authentication method and private combined reader therefore use the same cleanup.
4. Split the load test that previously expected deletion for both timeout and cancellation. Owner deadline still rejects and removes. Three parked caller-cancellation cases (identity/context/membership) now reject without releasing a late receipt, retain the valid session, then prove a complete fresh observation with the same credential and unchanged revision/expiry.

All existing malformed/changed authority, revoked/closed/expired session, forged receipt, freshness, retention and load-count assertions remain. The original 44-case cancellation test is byte-identical to its isolated commit. `service.mjs`, `worker-http.mjs` and `load-amplification.test.mjs` are byte-identical to the frozen load commit. There is no cache, new timeout, session extension or relaxed authority check.

## Review and verification

An independent Astra ultra reviewer approved the exact combined source and test resolution before any build. It compared both parents, checked the original cancellation test blob, verified unchanged load files and negative assertions, and found no remaining blocking issue. The reviewer did not execute tests; the coordinating agent ran the checks.

Node `v24.19.0`. Owner/stream tests use the original worktree's exact-lock dependency installs through task-owned symlinks. The frozen load fixture runs with its existing `MERI_DIAGNOSTIC_IMPORT_STUBS=1` switch; its expected sibling `fe` lookup points only to the Meri `packages/ui-stream` package's installed `zod@4.6.5`. No frontend implementation is imported. Provider/Temporal/ECS imports are fixture stubs; task SQL/grant work is synthetic as documented by that fixture.

```sh
node --test --test-reporter=tap apps/control/action-host/session/authenticated-current-state.test.mjs apps/control/action-host/session/cancellation.test.mjs apps/control/action-host/session/owner-independent.test.mjs apps/control/action-host/session/transition-owner.test.mjs apps/control/action-host/session/native-credential-relay.test.mjs apps/control/conversations/test/stream.test.mjs
MERI_DIAGNOSTIC_IMPORT_STUBS=1 node --test --test-reporter=tap apps/control/conversations/test/load-amplification.test.mjs
```

The owner/stream set passed **168/168**, including all original 44 cancellation regressions and the three additional private-reader cancellation cases. The full combined load suite passed **39/39**: **207/207 focused tests total**. Console evidence is retained in `meri-load-cancellation-20261019/owner-stream.tap` and `meri-load-cancellation-20261019/load.tap` (only trailing whitespace normalized).

The unchanged load assertions confirm 31 fixed-context and 37 dynamic-context Core calls, three task checks, two stored reads, one lifecycle read, four retention checks and zero writes. Legacy fallback remains 51/62 calls and non-load publication retains its separate observations. The 500 ms reply case completed in 18.572 seconds; the legacy paired case hit its unchanged 23-second deadline in 23.002 seconds. The conservative tail-heavy case completed in 18.218 seconds with 18.152 seconds of scheduled delays. These are local synthetic latency cases, not measured deployed performance.

Syntax checks passed for the owner, both new/updated session tests, conversation service and worker HTTP boundary. Working/staged whitespace checks passed. Exact source checks confirmed the original cancellation test and all load files outside the owner/private-reader test were preserved.

The broader isolated cancellation run passed 160/162; two graph query tests returned 502 after successful session issuance. Both reproduced on exact unchanged a16 and remain unresolved, with evidence in [the original packet](meri-session-cancellation-20261019/README.md). The original setup failures and review-discovered invalid-clock failure are also retained there. No failing assertion was removed to obtain the combined result.

## Source fingerprints and limits

| File | SHA-256 |
| --- | --- |
| `apps/control/action-host/session/owner.mjs` | `9ea420929c1dd24902edbf6ccc886328fe17d39cef4fbea859c409bb30576e32` |
| `apps/control/action-host/session/authenticated-current-state.test.mjs` | `940df6eb90f589fedcd5cc124a0e072a8eab5a1d4729acea95771884523d7b9a` |
| `apps/control/action-host/session/cancellation.test.mjs` | `bf3793e81069ca52dd54ff09c3d53eb5b645a04b0905093c105629a52e234575` |
| `apps/control/conversations/service.mjs` | `461ac846980955e5d9886e63e95f45e02e605f88dbcd0f865bad89158c596889` |
| `apps/runtime/worker-http.mjs` | `666b6c8cedfd33bb7e21cf81f159d8d7ad31045ce6dd77858ef5f6f12d55e80f` |
| `apps/control/conversations/test/load-amplification.test.mjs` | `7897c400e2943e509127aeb1466b85d2f9d8ee33657fa82fa1ffe156c2a231e0` |

These checks prove the local source composition, not live latency or the incident's exact cause. Actual incident refusal body/session timestamps remain unavailable. The event-source regression exercises request cancellation and a real 100 ms subscription cutoff, not a browser. Conservative invalidation remains for errors that cannot be identified as the exact winning request cancellation. HTTP refusal statuses are unchanged. No build, AWS operation, deployment, paid model call or main merge was performed.
