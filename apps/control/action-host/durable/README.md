# Durable action services

`createDurableActionServices` composes the existing PostgreSQL lookup store and delivery, approval-metadata store and current-policy owner, command journal, and PostgreSQL command executor. The executor uses the canonical durable invocation/budget owner. Construction makes no service/SQL/source calls. Existing canonical schema imports read local schema files. There is no SQL, migration, grant binding, approval creation, source call, pool shutdown, or registry mutation during construction.

```js
createDurableActionServices({
  lookup: { pool, gateway, authorize },
  metadata: { pool, preparePolicy },
  command: {
    journalPool, budgetPool, allocationJson, producerContext,
    authority, approvalStore, source, contracts, descriptor
  },
  commandContext, now, newId,
  limits: { maxRequestMs, maxFactBytes, maxResponseBytes, maxCleanupMs },
  sourceEnabled: false
}) // -> { lookup, commandOptions, commandExecutor }
```

All pools and service ports are borrowed. Their existing canonical timeout, current authority, approval, schema, grant, and accounting requirements still apply. The caller supplies the installed schemas and explicit stable allocation/grant/producer facts; use `commandExecutor.bindTrustedGrant` only under that owner's existing authority. No automatic grant binding occurs. `journalPool` and `budgetPool` may refer to the same authorized pool. No new schema is defined here.

The descriptor must match the current `create_task@0.2.0` contract's `task.create` action, operation, required grants and source requirements exactly. Context, producer facts, descriptor and limits are detached through the canonical inert JSON boundary; producer binding must equal command context binding. The same supplied clock function reaches all owners. The returned `commandOptions` is the existing command tool interface configuration, and `commandExecutor` retains its canonical execute, outcome, prepare, bind and reconcile surface. Its identity derives from the immutable command; reconstruction must reuse that command, producer context and allocation.

The default availability flag refuses new lookup invocations before delivery SQL and leaves the canonical command executor disabled. Current-authorized historical lookup reads remain available. Canonical command `readOutcome` retains its existing disabled refusal; this assembly does not create an alternative observer. Metadata preparation can create only a pending immutable proposal. Explicit `sourceEnabled:true` changes neither global registry availability nor current policy/approval requirements. No HTTP approval route is provided.

A pending approval can leave one PREPARED invocation but no reservation, charge or effect. The same proposal can execute after separate exact approval. Acknowledgment loss retains the canonical stage/liability and does not authorize automatic retry. Reconstructing owners does not regenerate the command or invocation identity, or bypass fresh authority and approval checks. Historical reconciliation preserves liability; it is not proof of result delivery.

## Local verification fixture

`test/fixture.mjs` is never imported by production. `setupDurableFixture()` reuses the existing scripted lookup, metadata, command-journal and budget fixtures; it implements no SQL parser or persistence algorithm. Set `MERI_REVIEW_SOURCE_ROOT` to this checkout before importing the existing invocation harness. The locked root dependencies needed by the contract validator are Ajv, ajv-formats, canonicalize and their pinned transitive packages; no new package/lock or installation is introduced.

The fixture returns `config`, `reconstruct(overrides)`, `ready(services)`, `tool(services)`, `call(proposal)`, `approve(proposal)`, `revokeApproval()`, `revoke()`, `close()`, and `setClock(ms)`. `ready` explicitly binds both synthetic grants. `approve` is an explicit test-operator control, separate from preparation and application routes. `lookupContext()` reserves fresh synthetic IDs/sequences; `lookupCredential`, `lookupRequest`, and `readContext` support the actual query and retained-read calls. `t` exposes the existing followthrough fixture, `f` the command fixture, `h` command accounting, `readH` read accounting, `readGateway` the actual local gateway, and `lookupSql`/`metadataSql` the retained scripted stores. `state.sourceReads` and `f.state.fetches` count synthetic source reads and task effects.

The query path uses the actual governed gateway and HTTP adapter, with a synthetic in-process response. The command path uses the actual durable executor/accounting, not the old command fixture budget. Read and command accounting use separate scripted state here, so these checks do not prove aggregate accounting across a shared real database. Reconstruct new services over the retained fixture pools; keep the original proposal and execution identity. `setClock` updates both accounting clocks and the canonical current-authority clock together.

Focused checks verify pending refusal, explicit approval, reconstructed replay, current read/approval denial, immutable completion hashes/bytes, fixed charge, and ambiguous prepare/reserve/marker/settle/journal acknowledgments. They prove local source behavior, not native PostgreSQL durability, concurrency, process restart recovery, live identity/policy/source qualification, or production activation. This lane opens no database or external service. Separately owned runtime evidence is not classified here.
