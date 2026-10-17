# Tracked-bills UUID source slice

Base: task-owned `meri-remaining-next`, continuing from
`74bf7032285ed83b17a67e2fc2b0f5308eb9862b`. This slice implements
`search_tracked_bills@0.2.0` for explicit UUID references only. Names and missing
selectors remain unsupported by this adapter; no name resolver is fabricated.

## Implementation outline

`apps/gateway/sources/tracked-bills/handler.mjs` exports
`createTrackedBillsHandlers(configuration, operations)`, binds one fixed native
route, checks the admitted UUID/reference and current lineage, and wraps the
native DTO with the frozen binding/subject evidence. The existing native handler
owns authority decisions, credentials, bounded HTTP receiving and the outer
private carrier. Frozen tracked-bills contracts own normalization, row/count and
enrichment validation. Fixtures/tests use source-shaped synthetic JSON and the
existing bill-text authority fixture.

Root owns helper eligibility, current native client membership and context
capture, dispatch integration, manifests, SDK policy/exposure and the ledger.
Only the source directory and this report are edited by this slice author.

## Exact native and receiving interfaces

Source inspected through GitHub at `neo-capiro/capiro-backend`
`b525032222515d636b0dae2d46e40c7c3d8b5528`:

- [Active dispatch](https://github.com/neo-capiro/capiro-backend/blob/b525032222515d636b0dae2d46e40c7c3d8b5528/apps/api/src/meri/meri-tools.service.ts#L2735)
  and [native wrapper](https://github.com/neo-capiro/capiro-backend/blob/b525032222515d636b0dae2d46e40c7c3d8b5528/apps/api/src/meri/meri-tools.service.ts#L8405-L8417).
- [Native tenant/nonarchived resolver](https://github.com/neo-capiro/capiro-backend/blob/b525032222515d636b0dae2d46e40c7c3d8b5528/apps/api/src/meri/meri-tools.service.ts#L9714-L9757).
- [Manual-list facade](https://github.com/neo-capiro/capiro-backend/blob/b525032222515d636b0dae2d46e40c7c3d8b5528/apps/api/src/intelligence/intelligence.service.ts#L288-L296)
  and [actual manual tracking owner](https://github.com/neo-capiro/capiro-backend/blob/b525032222515d636b0dae2d46e40c7c3d8b5528/apps/api/src/intelligence/intelligence-manual-bill-tracking.ts#L23-L52).
- [Shared bill-detail projection](https://github.com/neo-capiro/capiro-backend/blob/b525032222515d636b0dae2d46e40c7c3d8b5528/apps/api/src/intelligence/intelligence-bill-discovery.shared.ts#L152-L166),
  used by the manual owner's global enrichment query without invoking discovery.

The route is `POST /api/clio/tools/search_tracked_bills`; the original flat
`{clientId}` body is retained. Core resolves the selector then calls
`listTrackedBills(clientId, tenantId)`. This is distinct from the UI
`getTrackedBills` discovery path. Manual rows are tenant/client scoped, ordered
by creation descending, and enriched from global Congress bill rows. Missing
enrichment remains null. Total is the length of the returned tracking array;
there is no operation pagination or 50-row cap.

Frozen raw input requires a `clientId` string with `maxLength: 16384`.
The trusted context is exactly `{binding, subject, clientReference}`:

- `subject` is exactly one canonical UUID client under the current binding.
- `clientReference` is exactly `raw.clientId.trim().slice(0,80)`, retaining case
  and any space at the clipping boundary. It is not replaced by the subject ID.
- The supported native UUID branch checks `clientReference.trim()` because
  Core's resolver performs a second trim after the wrapper's trim/cap pass.
- Normalized input is `{clientId: subject.entityIds[0]}`. UUID comparison is
  case insensitive, while request/reference and context lineage remain exact.

The result hook returns `{binding, subject, data: nativeDto}`. This is the frozen
receiving envelope, separate from the shared outer five-field private carrier.

## Required current owner controls and limits

Native resolution proves same tenant and nonarchived status; it has no actor
wall predicate. It is insufficient by itself. Root must verify the exact UUID
against the current native client-membership observation, selected client
subject and run scopes before the tool request, and recheck before release.
Client-reference capture must use the original admitted request. Fresh context
lineage must allow only authorization-decision receipt rotation while retaining
the binding, subject selection and exact reference; the adapter itself requires
the full current binding/subject at execution.

The exact operation decision, `tool.read`, `tracked_bills` source and native
user/service credentials remain required. Empty rows, global bill enrichment,
notes, counts and timestamps do not prove current legislative status, global
bill visibility, exhaustive source coverage or authoritative absence.

## Verification and state

Root added tracked-bills eligibility, current native UUID membership/context
capture, exact selected-client scope checking and the three-key lineage seam
before the focused run. This slice author changed no shared implementation.
Source tests use synthetic current authority; mounted-owner and release
integration remain separately owned checks.

Final focused tests passed **43/43**, zero skips: 16 new adapter checks and 27
frozen tracked-bills contract checks. Node 24.19.0 used
`--preserve-symlinks --max-old-space-size=256 --test --test-concurrency=1`; the
task-local worker dependency overlay remains Zod 4.6.7.

- [Final full output](../../../apps/gateway/sources/tracked-bills/test/evidence/focused.txt)
  and [command/status metadata](../../../apps/gateway/sources/tracked-bills/test/evidence/focused.json).
- [Initial 42/43 output](../../../apps/gateway/sources/tracked-bills/test/evidence/initial-focused.txt)
  and [initial command/status metadata](../../../apps/gateway/sources/tracked-bills/test/evidence/initial-focused.json).

The first failure was a test-fixture alias: `structuredClone` retained a shared
reference between context binding and authority binding, so the attempted
context forgery changed both. The corrected test detaches the context before
changing it and still requires the exact `ACCESS_DENIED` rejection. Production
behavior and the assertion were not weakened.

Coverage includes uppercase/padded UUIDs, the clipping-boundary second trim,
name/missing-selector refusal before credentials/tool HTTP, context and grant
proof mismatches, nullable enrichment and manual notes, count/order/identity
correlations, tracking sets above 50 rows, whole-response byte refusal and
cancellation/expiry. No manual tracking data is relabeled as discovery or
current legislative truth.

State: **UUID source slice implemented; SDK exposure unclaimed; qualified/live
zero**. Names require a genuine future current resolver; they remain held
without preventing this independent UUID implementation. Independent source
review and parent-owned installation/registration remain separate. No native
provider, client DB, private data, startup, credential creation, activation or
deployment occurred. All task-owned test processes exited.
