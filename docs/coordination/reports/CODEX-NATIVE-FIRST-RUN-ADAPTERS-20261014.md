# Canonical first-run authority/session adapter join

**ACCEPT_SOURCE_ONLY** at `a41c822abf11639808acb69b5d0399b690f2c856`; **HOLD_NATIVE_QUALIFICATION**. Base is unchanged draft PR67 `c87a7321db17091db4baac75182d4727ad8acd75`, independently read back from GitHub during this task. Dedicated branch/worktree: `codex/native-first-run-adapters-20261014`, `/workspace/meri-first-run-adapters`. Supported startup wait returned ready. Prior checkouts/evidence stay preserved.

## Completed local join

- `apps/runtime/native-authority/task-authority.mjs` provides a bounded, closed `.verify` adapter to the existing `native.call('worker/authorize', {capability,binding,operation,inputSha256}, {signal,deadlineMs})` owner. It validates the exact canonical WorkerAuthorization receipt and current clocks/scopes/client/binding/hash. Disabled/missing providers, malformed or boolean receipts, cancellation and expired authority refuse. No retry or signer/credential/task capability is created. Existing private worker HTTP routes now reuse this adapter.
- `first-run-ports.mjs` provides inert `createNativeFirstRunPorts`: canonical application-authority identity/context adapter plus the existing durable SDK-session owner, over the same borrowed admitted-run owner. Its `currentRun` establishes identity/context currentness; its `withCurrentAllocation` owns SDK persistence/fences. Native task verification and independently observing `registration.read` are captured with their original receivers. Construction performs no IO/allocation; default disabled; missing native verifier or observation refuses SDK registration before SQL effects.
- Only the resulting compiled `{identityContext,sdkSessionOwner}` ports are supplied to existing `assembleControl({...,productPorts})`. No worker/request/configuration JSON can install authority. No new HTTP observation endpoint, authority system, model loop, schema, migration or recovery path was added.

Trusted-owner assembly is now one explicit join:

```js
const productPorts = createNativeFirstRunPorts({
  identity: {origin: approvedAuthorityOrigin, commandContext, fetchImpl},
  admission: currentAdmittedRunOwner,
  native: currentNativeCapabilityClient,
  registration: independentlyObservingNativeOwner,
  enabled: true, now, limits: {maxRequestMs, maxFactBytes},
});
const control = assembleControl({configuration, pool, client,
  native: currentNativeCapabilityClient, productPorts, now});
```

These are borrowed compiled owners, not configuration JSON or evidence of qualification. The native verifier called inside `withCurrentAllocation` must not reacquire that same allocation lock. Local independent controls confirm this composition adds no such re-entry; actual provider behavior remains unqualified.

## Verification actually run

Initial `1c5cb7ab581071ecf0d10614bc8895d4ae7f5a7e` implemented the join. Independent review reproduced a digest-coercion bug: a non-string inputSha256 could execute toString and reach a scripted native transport before refusal. Failed **0/1** capture remains exact. The repaired adapter checks string type before regex or transport.

| Check | Source/result | Evidence scope |
| --- | --- | --- |
| New adapter/composition controls | staged initial source,14/14 PASS | Canonical authority Fetch/context and SDK owner SQL protocol, scripted native/observation boundaries |
| Original worker RPC compatibility |1c5cb7ab,2/2 PASS| Scripted SDK with original task-authorized private routes |
| Independent coercion reproduction |1c5cb7ab,0/1 FAIL| One coercion/native dispatch; unchanged failed assertion preserved |
| Repaired adapter + RPC checks |a41c822a,16/16 PASS| Exact committed production source |
| Independent repaired controls |a41c822a,18/18 PASS| Includes strict digest, captured prototype methods/same owner, no currentRun reacquisition, in-lease revocation rollback and in-flight cancellation |
| Root independent assertion reproduction |a41c822a,4/4 PASS| Four added independent assertions only; no broad repetition |

Raw streams, source/diff/test hashes, commands and independent review are retained under `docs/qualification/candidates/native-first-run-adapters-20261014`. Every allocated test process group was absent at completion; no kill/reap/timeout was needed. Pinned dependencies were borrowed via task-owned links from unchanged PR67 installed trees; no install/lock change occurred. Those task-owned links were removed after checks; original dependency trees are retained. No product/native identity, task signature, SDK process, model or database was exercised.

## Minimal externally missing bindings

1. **Current application authority and admitted run:** approved canonical authority HTTPS origin and real identity/session/membership/context receipts; trusted exact `commandContext`; approved product current allocation/schema/pool owner. Existing canonical POST `/api/clio/application-authority/{identity,context}` remains the identity/context protocol. UUIDs, raw `/me` payloads and fixture grants do not replace it.
2. **Genuine native task verifier:** the real current `worker/authorize` implementation and approved server/task capability transport bindings. This adapter proves correlation/refusal, not cryptographic authenticity, native task launch, policy or physical isolation. The existing qualification worker observer advertises runtimeQualified:false and is not substituted.
3. **Independent SDK registration reader:** native supervisor/owner `.read({binding,key,signal,deadlineMs})` that corroborates actual SDK init and first main mirror key, exact0.3.295/2.1.295 pins, stable observation identity/hash and original expiry. No production implementation exists locally. PR67's first callback supplies a selector only; booleans/worker JSON/partial interruption evidence cannot establish observation or refresh expiry.

The qualification owner's reusable PostgreSQL migration/SDK checks remain synthetic loopback/package evidence, not product identity/model acceptance; every qualification schema and fixture source is unchanged. The coordinator's **backend PR2 three read-only routes** are now the frontend receiving plan; PR23's historical empty allowlist is superseded. That receiving plan was not changed here and does not confer task or application-authority context permissions. No staging is assumed.

This source slice adds nothing to optional resume/replacement/recovery. A real end-to-end run still needs approved model/proxy/runtime and physical isolation bindings. DOCX creation still needs a separately explicitly approved output run, current output/source grants and approved storage/renderer resources; output remains awaiting approval. No live credentials, native DB operation, paid provider call, new AWS resource, persistent security change, document generation, source activation, frontend/cleanup action, production write, merge or deployment occurred. Missing native bindings are pending, not denied or attempted.
