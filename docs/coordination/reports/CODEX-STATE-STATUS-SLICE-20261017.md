# Stored-key state status/vote slice — 17 October 2026

Disposition: **PARTIAL_INPUT / SOURCE-ONLY; independent review pending**. This increment implements a bounded source slice for `get_state_bill_status` and `search_state_floor_votes`; it does not complete either operation's full designation-capable input surface or the state-status-votes family. Both full operations remain in the remaining-family inventory. The SDK family remains withheld. No qualification/live result, provider effect, source completeness or current-world status is asserted.

Allocated local base: `74bf7032285ed83b17a67e2fc2b0f5308eb9862b`, task-owned checkout `meri-remaining-next`. Owned source is `apps/gateway/sources/state-status-votes/**`; this report is the only owned documentation path. Shared contracts, helpers, central registries, SDK exposure, startup, locks and infrastructure are not edited by this lane. Disk was checked at approximately 3.1 GB free; dependencies and the task-local pinned Zod overlay are borrowed without installation or archives.

## Actual stored-only branch guarantee

Source pin: `neo-capiro/capiro-backend@b525032222515d636b0dae2d46e40c7c3d8b5528`. The existing authenticated [native tool controller](https://github.com/neo-capiro/capiro-backend/blob/b525032222515d636b0dae2d46e40c7c3d8b5528/apps/api/src/meri/meri.controller.ts#L512-L557) forwards fixed tool names and flat input to the existing Core owner. No additional endpoint or unsupported no-fetch flag is invented.

The actual [state resolver](https://github.com/neo-capiro/capiro-backend/blob/b525032222515d636b0dae2d46e40c7c3d8b5528/apps/api/src/meri/meri-tools.service.ts#L3652-L3699) normalizes/validates a canonical `stateBillKey` and **returns it immediately before any designation query or live lookup**. The [shared identity owner](https://github.com/neo-capiro/capiro-backend/blob/b525032222515d636b0dae2d46e40c7c3d8b5528/packages/shared/src/index.ts#L921-L964) uses the state/year/session/bill grammar, such as `tx-2025-hb1234`, with optional special-session suffix, and lowercases/removes whitespace and dots. These are not UUID identifiers. The unchanged private `state-bill-identity.mjs` inspector has matching canonical syntax and normalization; the adapter reuses it rather than copying a regex or resolver.

For [status](https://github.com/neo-capiro/capiro-backend/blob/b525032222515d636b0dae2d46e40c7c3d8b5528/apps/api/src/meri/meri-tools.service.ts#L5478-L5610), a canonical key is followed by stored `stateBill.findUnique`; a miss returns its database-scoped honesty note and does not retry as a designation. Found rows read stored actions, votes, links and companion rows. For [votes](https://github.com/neo-capiro/capiro-backend/blob/b525032222515d636b0dae2d46e40c7c3d8b5528/apps/api/src/meri/meri-tools.service.ts#L5616-L5679), a canonical key is resolved through the same immediate-return branch and used in the stored vote query. The guarantee is source control flow at this pin; no live source execution was performed.

Designation misses take a different branch: lookup can reserve LegiScan quota, update sync state, call providers and upsert bills. That branch remains unavailable in this slice, including when a designation might happen to match a stored row. No credentials, quota, sync or provider attempt is needed to determine the supported input subset.

## Implementation outline and boundary

`handler.mjs` owns the finite two-route set and one source-effect admission rule. The canonical normalized selector must be `canonical`; otherwise the handler returns `UNAVAILABLE` before `getCredentials` or native fetch. The check runs through the existing helper's request-body seam after canonical input/current grant checks. Admitted requests are sent unchanged as flat POST bodies, so Core performs its established trim/clip/normalization once. The original request, normalized digest and empty trusted context remain bound by the existing credentials and private result carrier.

The shared native helper continues to own inert admission, current tenant/user and exact operation decision, source-grant coherence, native credentials, bounded JSON transport, deadlines/cancellation, receiving validation and the exact private carrier. No result projection, alternate authority system, database reader or fallback loop is introduced. Root owns measured partial eligibility/integration and must retain the incomplete-input classification rather than counting this as a complete family.

Supported inputs include canonical aliases accepted by the existing syntax (case, embedded whitespace/dots and special-session keys), the status tool's canonical `query` fallback, and existing state/chamber/query/limit behavior once a canonical bill key is selected. Conflicting state hints do not retarget a canonical key. Unsupported inputs include designation selectors, malformed selectors, UUID-looking strings, missing/blank bill selection and unscoped/state-only vote searches; the last branch is also stored-only in Core but is deliberately outside this smallest slice. Invalid contract shapes remain `INVALID_ARGUMENTS`, distinct from valid but unsupported input.

Unchanged receiving semantics retain status/no-row honesty, no inference from absent votes, dead-session caveats, companion status/nulls, nullable vote facts, descending SQL-date order, exact selected-key/chamber correlation and bounded vote limits. Synthetic fixtures do not prove actual source freshness, completeness, authorization, provider policy or live execution.

## Verification

Node `24.19.0` ran with `--preserve-symlinks --max-old-space-size=256 --test --test-concurrency=1` and the existing task-local dependency overlay. No new dependencies were installed. These suites exercise synthetic JSON and the canonical frozen contracts; they do not independently qualify the SDK/Zod path or live Core.

| Check actually run | Result |
| --- | --- |
| `apps/gateway/sources/state-status-votes/test/handler.test.mjs` | Initial 26/26 passed; final 27/27 passed after adding forged-normalized-selector and descending/null-date controls. |
| `packages/contracts/test/retrieval-state-status-votes.test.mjs` plus `retrieval-state-status-votes-independent.test.mjs` | 53/53 passed, unchanged frozen source. |
| Authored Markdown local links and authored-file whitespace | Passed. |

The final distinct focused set is **80 passing tests**, with no failing suite or skipped check. Adapter controls demonstrate refusal of designations/missing/malformed/UUID selectors before credential acquisition or HTTP, current grant and native-credential correlation, canonical aliases and effective trim/clip behavior, unchanged raw request/proofs, the status `query` fallback and bill-ID precedence, canonical database miss without fallback, absent-vote/dead-session honesty, independent companions, inherited-label omission, nullable/negative stored vote facts, selected-key/chamber/window/date checks, JSON date serialization, bounded transport and cancellation. A forged canonical normalized input cannot authorize a raw designation.

All task-owned test sessions exited with code 0; no background work, process termination or external mutation occurred. No production/native/provider/database/quota call, credential creation, cloud operation, activation or deployment was performed. Unrelated checkouts and processes were preserved. Root still owns independent source review, measured partial integration and publication. The full designation-capable operations/family and SDK exposure remain incomplete.
