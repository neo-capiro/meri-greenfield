# Stored no-bill floor-vote extension - 17 October 2026

Disposition: **PARTIAL_INPUT / SOURCE-ONLY; independent review and shared integration pending**. This extends the existing `search_state_floor_votes` adapter to the native stored branch with no effective bill selector. Canonical stored-key reads remain supported. Supplied designation/invalid selectors remain unavailable; `get_state_bill_status` still requires a canonical selector. Neither full operation nor the state-status-votes family is completed, and SDK exposure remains withheld.

Task-owned checkout `meri-resolution-next`, local base `e1845c3b0d7caa8fd3309ad96f6cb4e17f25ccce`. Owned changes are only `apps/gateway/sources/state-status-votes/**` and this report, with a separately owned rule/locale seam report. No shared owner/helper, contract, registry, SDK, ledger, lock, startup, infrastructure, credential or backend code changed in this lane. Disk capacity was checked at approximately 2.67 GB free; the existing Node/dependency overlay was borrowed without installs or archives. Repository standards and the sparse checkout's continuation guide were read through Git without expanding the worktree.

## Pinned actual source guarantee

The source pin is `neo-capiro/capiro-backend@b525032222515d636b0dae2d46e40c7c3d8b5528`; `apps/api/src/meri/meri-tools.service.ts` has blob `32a7a744ba9ab812337baaf6093a37540864333b`.

The actual [floor-vote producer](https://github.com/neo-capiro/capiro-backend/blob/b525032222515d636b0dae2d46e40c7c3d8b5528/apps/api/src/meri/meri-tools.service.ts#L5616-L5680) calls `resolveStateBillKey` only inside `if (rawBillId)`, after its existing `optionalString(input,'billId',60)` normalization. An absent/null/empty/whitespace-only selector bypasses the resolver entirely. That branch constructs optional state-prefix, chamber and motion predicates, then calls stored `stateRollCallVote.findMany` with descending date order and bounded take. It has no designation lookup, live provider, quota reservation or ingestion fallback.

A supplied canonical key still follows the resolver's [immediate canonical return](https://github.com/neo-capiro/capiro-backend/blob/b525032222515d636b0dae2d46e40c7c3d8b5528/apps/api/src/meri/meri-tools.service.ts#L3652-L3699). A supplied designation can instead fall through to a stored designation query and then a live lookup on a miss; this extension continues to refuse it even if it might happen to match a stored row. The proof is pinned source control flow, not an attempted native call.

Floor-vote `query` is a motion search and is never used as a bill selector. A query resembling `TX HB 1234` or a canonical bill key therefore remains a motion predicate on the no-bill branch. Status has a different canonical query fallback, preserved by its existing canonical normalizer. The extension does not unify those meanings.

## Guard and integration interface

The implementation outline keeps source-effect admission in one pure family module, shared by CONTROL and the handler. The existing helper remains the owner of current grants, credential correlation, bounded HTTP, receiving and private result wrapping. No resolver, regular-expression copy, source query or second authorization system is added.

New [request-context.mjs](../../../apps/gateway/sources/state-status-votes/request-context.mjs) exports `assertStoredStateRequest(operation, rawRequest)`. It resolves only the existing family contract, snapshots inert input, and uses `contract.normalizeInput(rawRequest,{})` and its `metadata.selector`:

| Canonical metadata | Admission |
| --- | --- |
| `selector.kind === 'canonical'` | Either fixed operation; existing stored-key behavior. |
| `selector.kind === 'missing'` and operation is `search_state_floor_votes` | Newly admitted stored no-bill branch, with optional state/motion/chamber/limit. |
| Any designation/invalid selector, or missing status selector | `UNAVAILABLE` before native credentials or tool HTTP. |
| Invalid shape/type, extra trust/no-fetch fields or hostile object graph | `INVALID_ARGUMENTS` before native credentials. |

The function returns the frozen original flat request. Trusted context remains exactly `{}`. No new flag, endpoint, context field or output projection is introduced. Native trim/clip/case normalization still sees the original request, including optional nulls, whitespace, raw limits and query text.

[handler.mjs](../../../apps/gateway/sources/state-status-votes/handler.mjs) retains `createStateStatusVotesHandlers(configuration,operations)` and the two fixed POST routes. It reuses canonical shape admission and the existing inert `retainedCall` boundary before pure preflight, preserving the established `INVALID_ARGUMENTS` rejection for forged normalized input/digest. Preflight still runs before the helper/per-call credential factory and repeats at the existing request-body seam. A forged normalized input/digest cannot promote a raw designation or substitute a canonical key into a no-bill request.

Root must import this guard in the current native-context owner before obtaining native credentials and include its transitive source in measurement. The prior shared owner validated raw state requests using the normalized Input schema; that rejects raw `billId:null` even though the canonical Request normalizer classifies it as missing. Root confirmed it will use the canonical state preflight for raw admission, narrowly for this family. That shared change and mounted-owner DELTA tests belong to root and were not edited or counted as verification here.

## Receiving and remaining boundary

The unchanged frozen receiving contract admits multiple stored bill keys when no bill is selected, checks any requested state prefix on every row, and preserves chamber/motion predicates, bounded vote count, SQL date serialization/order and actual empty-source honesty. An unscoped no-bill request may return rows from multiple states because that is the native query's existing semantics. An empty page does not acquire completeness, absence evidence, member-level filtering or a vote outcome/tally claim. No automatic pagination, alternate route or fallback is added.

Remaining work includes effect-safe full designation resolution and its owner contract. This source increment does not reduce the two remaining full-operation counts or qualify source freshness, corpus completeness, current native authorization or live/provider behavior. Existing canonical status and vote behavior is preserved; the historical stored-key report remains unchanged as historical evidence.

## DELTA verification

Only the new focused DELTA suite was executed, as requested; the old full suites are reserved for root's coherent integration run. Node `24.19.0` used `--preserve-symlinks --max-old-space-size=256 --test --test-concurrency=1`.

| Check actually run | Result |
| --- | --- |
| `apps/gateway/sources/state-status-votes/test/no-bill-delta.test.mjs` | Initial 7/7 passed; expanded shared-preflight alias/null coverage then 8/8 passed. Final diff review identified and preserved the old forged-selector error ordering with shared inert call validation; added direct DELTA assertions and **8/8 passed** again. |
| Owned `.mjs` syntax, whitespace and report local links | Passed. |
| Existing baseline adapter suite | Not rerun in this lane. Its one old omitted-selector refusal case was updated to preserve status-only refusal; designation/invalid controls remain for both operations. |

DELTA assertions cover pure canonical case/dot/clip aliases; effective absent/null/empty/blank floor selectors; status omissions remaining unavailable; original raw request/private carrier and request-correlated empty context; motion query versus status fallback; per-row state prefix and unscoped multiple-state output; chamber/motion/count/date and empty-note receiving; current tenant/actor/operation/source grants; credential proof correlation; supplied designation/invalid/UUID and forged-input refusal before credential factories; extra trust fields and inert hostile inputs.

All task-owned commands exited; no background task remains. No Core/Intel/provider/database/quota call, credential creation, deployment or external mutation occurred. Independent review, shared integration, fresh source measurements, full checks and draft publication remain with root.
