# Action session issuance and frontend context

**ACCEPT_SOURCE** for the missing opaque action-session binding. The backend now verifies a native identity through its trusted owner, resolves the authoritative current conversation/run/client through a separate trusted owner, and issues a bounded opaque credential for the existing action application. Clerk identity and browser selectors alone cannot supply that context. The actual local HTTP exercise uses synthetic verifier/context ports and reaches the accepted lookup, draft, pending proposal and explicitly approved execution/replay owners.

Reviewed source: `e5ee1858ea8271925cf3d9fdf172743b3903c03a`; independent review: `558e9c9b8a98947dfef718b81671e87fb3a11311`; author packet: `b0e70fd0a7e082885be917ff8d9092c12b5d070e`. Independent46/46 at `aca37f81b2a795f2502dc8c0dc36cdbc10d72d2a` is retained; the final canonical HTTP-helper reuse passed24/24 affected checks, with the owner/integration bytes unchanged. Root combined verification passed **184/184**, zero failed/skipped/cancelled, at `e410ae3078c6d9de535bed6dfd4254ec5d918f92` in11.921seconds. Root process group479162 exited and was observed absent.

The [implemented protocol and mounting example](../../../apps/control/action-host/session/README.md) are the frontend handoff. Use a same-origin frontend server adapter/reverse proxy; no permissive CORS is added. Bootstrap is:

```http
POST /api/action-followthrough/session
Authorization: Bearer <native identity credential>
Content-Type: application/json

{}
```

The body may instead contain only UUID selectors `conversationId`, `runId` and/or `clientId`. Missing selectors are chosen only by the authoritative context owner; explicit selectors must match its authorized result. The exact success response is:

```json
{"credential":"<opaque action session>","expiresAtMs":1234567890000,"context":{"tenantId":"<tenant>","actorId":"<actor>","conversationId":"<UUID>","runId":"<UUID>","selectedClientId":"<UUID>"}}
```

Keep that credential and UI correlation context in memory. Use the action credential on the existing query/draft/prepare/execute routes and retain the original selected result/hash and immutable proposal. Continue consuming action responses through the accepted public0.1.1 `receiveActionResponse`; that package's bytes and artifact are unchanged. The bootstrap is a separate minimal protocol; it does not return scopes, tool credentials, approval authority or the private full execution binding.

`createActionSessionOwner` owns the bounded process-local registry and adapts the existing host authentication/current-state ports. `createActionSessionApplication` owns the fixed issuance route, reusing canonical bounded JSON decoding and no-store/nosniff responses. Each use freshly verifies native identity and authoritative context, correlates receipts, preserves original revisions/full binding/client/scopes and clips the original expiry. Revocation/close and context changes refuse release, including after awaited owner calls. The registry survives graph reconstruction within the same case/owner; process replacement or another owner cannot authenticate those sessions. No durable/distributed-session, refresh, retry or physical cancellation claim is made.

The optional `sessionFactory` on `createLocalApplicationCase` supplies internally owned synthetic verification/context ports. In that mode `openHost` returns `{app,identityCredential,closeGraph?}`; the bootstrap credential reaches only the trusted synthetic harness out of band. The same actual listener handles bootstrap and action routes. The native identity bearer is refused on action routes; the HTTP-issued opaque credential succeeds. Existing default case behavior remains unchanged, and borrowed pools are never closed by the new owner. No approval route was added.

Preserved negative controls found and repaired late revocation release, hostile request/owner accessors, URL fragment admission, caller-controlled routing traps, a later deadline being advertised to identity owners, and unchecked issuance output fields. The original failure captures remain in the independent review packet. The final implementation shares one closed issuance validator at creation and HTTP release, limits it to4096UTF-8 bytes, and passes the original HTTP cutoff through all owner calls. Error bodies expose only documented fixed codes. No original negative test was weakened.

Final root preservation audit passed118 checks: all10,967 PR45 entries remain, with10,965 byte-exact; only the two allocated existing case/ports files changed. All93 members of four session/baseline author/reviewer manifests match. The earlier58-check session-only audit is retained separately. Original contracts, production registry availability, scope139/selected96/deferred43, source-off defaults and prior raw failures remain preserved. Root groups479162,480115,480135 were freshly observed absent; both owned dependency links were removed, preserving the borrowed dependency directory.

**Still unqualified:** live native-token verification, authoritative deployed conversation/run/client adapters, frontend browser consumption and native PostgreSQL reconstruction. The injected synthetic ports do not establish those adapters. Native evidence remains under its separate owner's control and was not inspected or published. No model/provider/native engine call, infrastructure spend, cloud/security/database/customer-data mutation, image operation, main merge or shared frontend edit occurred. G1 remains OPEN.

The six accepted pilot templates now have a runnable **unpaid deterministic baseline**, source `d16896b348daa765f3cb069732c9a70e5ffe13b0`, independently accepted at `11d1dcb3a90ffafd93c0dcbfaa08f931d18baeb1`. Root passed **25/25** baseline controls and a standalone **6/6** run at `3072a01c97bda7b0bdd40381bfd948600af49b24`, in10.777 and3.974seconds respectively. Each case starts with a fresh demo/store/opaque session, validates the accepted public responses and current hashes, and closes with a verified401 and no subsequent effects. All six have zero approvals and task effects. The harness keeps all six denominator rows when a case or cleanup fails. Independent negatives found skipped close after a stats error and unbounded post-close handler/body waits; those raw failures and the repaired controls are retained. This is an in-process Fetch/application exercise of the earlier frozen demo gold, distinct from the shared-pool HTTP session fixture. It is not language routing, model quality, a new native tenant namespace or a real-request benchmark.

Run `node evals/action-followthrough/local-baseline/cli.mjs --run` with the existing pinned dependencies. Import/help/invalid arguments are inert. [Baseline report](CODEX-ACTION-PILOT-BASELINE-20261013.md) and [usage](../../../evals/action-followthrough/local-baseline/README.md) record the six cases and effects. Qualified human requests remain0. Paid execution still lacks the exact AWS route price/preflight and a new spending decision; the proposed18 inference/18 CountTokens,144,000 input/4,608 output and0.75USD ceiling are unapproved. No old budget remainder or the separate AWS jobs'5USD allowance was used.

Frontend coordination is recorded on [PR16's bootstrap contract](https://github.com/neo-capiro/capiro-frontend/pull/16#issuecomment-6137429682) and [same-origin transport note](https://github.com/neo-capiro/capiro-frontend/pull/16#issuecomment-6137527366). The prior shared-allocation milestone is [PR45](https://github.com/neo-capiro/meri-greenfield/pull/45). The source and all unchanged original fixtures are preserved for the frontend/native owners to consume through their existing lanes.
