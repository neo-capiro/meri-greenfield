# Conversational memory proposal handoff

Original Meri base: `98d3c96a2c944a8211856e98b5bd62e824b4b5f7`. Owned implementation/test tip: `64467524b119ddc34f1e30303ffce1d6a45a11fa`. Branch: `codex/meri-writes-memory-20261019`. The outline was recorded before implementation in `MEMORY-CONVERSATIONAL-WRITE-OUTLINE-20261019.md`.

## Result and ownership

`save_memory@0.2.0` can now prepare canonical immutable `memory.propose` metadata through the existing command preparer and metadata owner, without a parallel policy, SQL, command-execution or model loop. The supplied approved executor can use the already existing governed memory command source, which creates a pending candidate and submits it for Core review. Preparation never calls that executor.

This is tested Meri source; native conversational activation remains blocked. No catalog availability row, approval-action allowlist, native execution token codec, runtime composition, Core/frontend code, deployment input, migration or lockfile was changed by this lane. PR189 and the frozen first-chat inputs were not advanced. No provider, database, Core request or deployment was executed.

Owned files:

| File | Responsibility |
| --- | --- |
| `apps/control/commands/approval-metadata/memory-kind.mjs` | Frozen `memoryKind` codec: canonical memory normalization, selected-conversation context and command validation, public proposal integrity plus memory-specific provenance validation |
| `apps/control/commands/approval-metadata/memory-owner.mjs` | Fixed `memory.propose` wrapper over the one shared `createCommandApprovalMetadataOwner(configuration,action)` |
| `apps/control/intents/memory-preparer.mjs` | Inert `createMemoryProposalServices` composition over canonical metadata store, tool interface and prepare-only preparer |
| `apps/control/intents/test/memory-fixture.mjs` | Explicit synthetic policy/Core/scripted SQL boundaries around actual owners |
| `apps/control/intents/test/memory-preparer.test.mjs` | Nineteen focused proposal/governance/replay/execution/persistence/UNKNOWN cases |
| `docs/integration/MEMORY-CONVERSATIONAL-WRITE-OUTLINE-20261019.md` | Pre-implementation design and ownership |
| `docs/integration/MEMORY-CONVERSATIONAL-WRITE-HANDOFF-20261019.md` | This source receipt and receiving instructions |

## Public factory and trusted composition

```js
createMemoryProposalServices({
  metadata: {pool, preparePolicy},
  commandContext: {binding, conversationClientId},
  executor,
  now,
  newId,
  limits: {maxRequestMs, maxFactBytes},
}); // -> {commandOptions, commands, preparer}
```

`binding` is the original immutable proposal/run binding. `conversationClientId` is the current trusted conversation selection, never a model authority hint. Client-scoped input derives its UUID from that context and rejects any different supplied client. Raw actor, tenant, scope grants, required approver, command IDs, metadata IDs and attachments are not admitted as model authority. Canonical memory scope/TTL normalization remains unchanged.

`preparePolicy` is the existing authoritative policy port, not a locally fabricated permission. It chooses and rechecks scopes, required approver and immutable expiry before persistence and result release. `executor` is a supplied trusted approved-execution owner; the helper adds no fallback. `commands.prepare` and `preparer.prepare` only prepare metadata. `commands.executeApproved` uses stored immutable metadata and the supplied executor, which must recheck actual approval/current grants and retain durable idempotency.

The root integration must select memory context by action; task `{binding,clientResolution}` is not a `MemoryProposeContext`. For approved execution, obtain the governed source from the exact memoized product context:

```js
const source = memoryComposition(productContext).commandSourceFor?.({
  binding: verifiedCurrentExecutorBinding,
  scopes: admittedRunScopes,
});
```

That existing owner requires the live-session relay, canonical retention bind and actual selected-client scope. A missing/null source is unavailable. Its binding is the current verified executor binding; the approved command retains original stable tenant/actor/conversation/run provenance across a resumed attempt. Pass this source to `createPostgresCommandExecutor` with the canonical `save_memory` descriptor, original memory context, canonical command validator, approved current grant/allocation, command journal, budget, authority and approval store. It carries `personalPending:true`; never use `createCommandHttpSource` or legacy `POST /api/clio/tools/save_memory` for this composition.

The existing governed producer uses the real finite Core memory routes in `apps/control/memory/core-http.mjs`: `/api/clio/memory/review/submit`, `/review/status`, `/read_target`, `/find_by_key`. They require the member's native identity and verified service identity. A returned `pending` candidate is a review submission, not a committed-memory publication. Core remains the only review/publication owner.

## Receiving commits and shared dependencies

Receive these owned commits (root already has the early slices):

1. `300fbcc4` — memory codec/wrapper/services and outline.
2. `8b373bd7` — focused memory fixture and behavior tests.
3. `a07179fd` — actual generic durable budget executor in the fixture.
4. `0a8b5cda` — lost metadata ACK injection at the bound SQL boundary.
5. `64467524` — actual candidate journal adapter and projected suppression check.
6. This handoff commit.

Shared dependencies authored elsewhere: attachment codec `f1f0df1a`, shared metadata factory/kind registry `4a062ac4`, command preparer operation map `9f72b7c4`. Authorized local cherry-picks on this lane are respectively `0331d49e`, `f1b0b2b4`, `ce769765`; they are duplicate dependency receipts, not additional owned work and must not be received twice.

Root must preserve the shared native approval and execution holds. Current `APPROVABLE_ACTIONS` and `EXECUTION_COMMAND_ACTIONS` remain task-create-only. The existing native record/issuance contract does not establish authority to issue a memory execution capability. Do not add memory by relabeling a task token or by comparing memory to a legacy save endpoint body. Dot must supply an agreed actual native record/issuance/action/source binding before production conversational discovery/activation can claim usable approved memory execution.

## Verification

At owned source `64467524`, with the shared dependencies above:

```sh
MERI_REVIEW_SOURCE_ROOT=/dev/shm/meri-writes-memory node --test apps/control/intents/test/memory-preparer.test.mjs
```

**19/19 passed, zero skips.** The explicit source-root variable is required by the inherited `docs/qualification/candidates/durable-invocation-20261012/review/invocation-harness.mjs`; it identifies local test source only. Production code does not depend on it.

The suite crosses actual shared metadata encoding/store, command tool and prepare-only interface, intent replay journal, generic durable budget executor, PostgreSQL command-journal adapter, governed memory source/producer, PostgreSQL candidate-journal adapter and Core review/result validators. SQL pools, current-authority/approval receipts, clock, Core transport and intent journal persistence are explicitly synthetic. It exercises personal/client/firm pending proposals, model scope/authority refusal, immutable payload readback, approval/grant/fence/expiry failures, replay/conflict, retained result release, lost metadata and intent ACKs, uncertain Core submission, canonical retention gate refusal and the candidate journal's projected-suppression guard. A repeated successful command creates no second candidate or review submission; uncertain post-claim execution remains UNKNOWN/indeterminate.

The first run was 17/18: fault injection replaced `pool.connect` after the canonical store had already captured it, so the intended lost ACK was not injected. Moving the fault to the actual bound query boundary preserved all assertions and gave 18/18. Replacing the candidate journal double with the existing PostgreSQL adapter and adding projected suppression gave the final 19/19. No production assertion was weakened to pass.

All five new JavaScript modules/test files passed `node --check`; `git diff --check` passed. No live PostgreSQL constraint/concurrency, native Core authorization/token issuance, runtime startup, model tool discovery, paid provider or authenticated browser flow was run. Root owns shared integration checks and any later qualification.
