# Product owner interfaces: source closure, 16 October 2026

Status: **disabled / unmounted; activation HOLD**. These successor interfaces create no listener, issuer, credential, database, task or deployment. The sealed archive at `e4fc10347c7bf557eff93423e42816834b009a4e` **excludes these successor sources**; its digest cannot qualify an image containing them. A reviewed successor commit, fresh archive and exact image qualification are required.

## Proxy to canonical owner

[`owner_channel.py`](../../apps/proxy/product/owner_channel.py) exposes `make_product_owner_bridge(*, policy, exchange, host_gate, request_id, binding, deadline_ms, grant_id, capability_sha256, now_ms=None)`. Its returned factory accepts the constructor-captured request observer and supplies `ProductSession.make_owner_bridge`. The bridge exposes `reserve`, `bind_complete_capture`, `settle_complete` and `read_outcome`.

The trusted `exchange(channel, path, body, timeout_seconds)` port must use the fixed HTTPS origin on **8444**, pinned mTLS, two distinct persistent connections (`operation` and `capture`), bounded I/O, and no redirects, cache or automatic retries. Its synchronous `abort()` must close and permanently retire both connections. `OwnerReply` contains bounded bytes and **transport-derived** `OwnerTlsEvidence`; a field echo does not authenticate TLS or task identity. One process-lifetime `OwnerHostGate` is shared across host sessions.

[`owner-channel.mjs`](../../apps/proxy/product/owner-channel.mjs) exposes `createProductOwnerServiceGate()` and `createProductOwnerChannel({clientPolicy,persistedFacts,ownerPorts,serviceGate,now,maxExchangeMs=3000})`. The inert handlers accept `(body, peer)`:

| Handler | Exact POST path |
| --- | --- |
| `open` | `/v1/internal/product-model/owner/session/open` |
| `operation` | `/v1/internal/product-model/owner/operation` |
| `poll` | `/v1/internal/product-model/owner/capture/poll` |
| `reply` | `/v1/internal/product-model/owner/capture/reply` |

The future listener must enforce empty query, the body cap, pinned mTLS, a fresh proxy-task lease and TLS-derived `peer` on every POST. The protocol binds separate operation/capture connection IDs to an owner-generated session, original request/binding/grant and deadline. Capture poll/reply invokes the independently registered host request/complete-response observer. It cannot echo the operation claim as evidence.

`ownerPorts` is the trusted `{pool,pricing,limits,checkCurrentConversation}` bootstrap. `persistedFacts` is the existing [`createProductProxyPersistedFacts`](../../apps/proxy/product/product-owner-facts.mjs): it joins the exact ISSUED model grant, accepted run/client, native allocation, all immutable grant intents and current product admission. `createProductProxyOwnerComposition` retains the existing reservation/settlement owners and the **same borrowed pool and `meri_product_budget` ledger**. No Python budget database, LiteLLM budget ledger or second reservation owner is introduced. The UNKNOWN hold precedes dispatch; settlement requires complete native usage/EOF. Only canonical `BudgetCommitUncertain` permits historical outcome recovery.

## Private native credential delivery

[`createProductOwnerCredentialDelivery`](../../apps/proxy/product/owner-credential-delivery.mjs) accepts `{binding,selectedClientId,expiresAtMs,origin,currentOwner,delivery:{read},fetchImpl,now,limits,enabled=false}`. Limits are `{maxRequestMs,maxFactBytes,maxCredentialMs}`; credential leases are capped at five minutes. It exposes `available` and `checkCurrentConversation({binding,deadlineMs,signal?})`.

The exact private `delivery.read({binding,selectedClientId,deadlineMs,signal})` result is `{schemaVersion:1,leaseId,binding,selectedClientId,credential,credentialSha256,checkedAtMs,expiresAtMs}`. Trusted startup supplies the real delivery authority, using an already reviewed material owner if appropriate; no new file authority or issuer is inferred. Fresh reads before and after the existing `createNativeIdentityContext` join must retain lease identity and actual bearer digest. The canonical native identity/context and current-run owner enforce the configured tenant, actor, client and full run binding. Every expiry only shortens the operation. The only public result is the canonical seven-field currentness receipt; bearer/lease material is absent from receipts and errors.

Settled foreign/archive/HTTP denials fail the call and permit a fresh check. The module observes actual native response-body reads through EOF or acknowledged cancellation. Unresolved delivery, fetch, current-run or response-body work quarantines that instance and prevents new work.

## Temporal delivery writer and ownership handoff

[`temporal-product-token-writer.mjs`](../../apps/runtime/temporal-product-token-writer.mjs) exposes `parseTemporalProductTokenWriterConfiguration`, `inspectTemporalProductTokenDelivery`, `createTemporalProductTokenLease` and `createTemporalProductTokenWriter({configuration,delivery,now,timers})`. Configuration defaults to `{enabled:false}`. Enabling requires the exact role (`control` or `temporal-worker`), subject, workload principal, authorization configuration and request bound. The writer exposes `start`/`refresh`, `close`, `status`, `healthy` and `watch`.

Its injected `delivery.read` receives `{schemaVersion:1,role,subject,workloadPrincipal,namespace,audience,issuer,signal}`. The closed reply is `{schemaVersion:1,state,identity:{role,subject,workloadPrincipal},observedAtMs,validUntilMs,token}`. `CURRENT` supplies `{token,expiresAtMs,claims:{namespace,audience,issuer}}`; `REVOKED`/`UNAVAILABLE` require null token and validity. The delivery owner must authenticate the real workload/issuer and current revocation state. Shape/claim equality is configuration consistency, not signature verification or issuer authority.

The source writer owns an **initially absent** task-local token path, exclusive lock and atomic replacement lifecycle on Linux. It refuses to adopt or overwrite predecessor material. Existing static material-init still owns the Temporal token path and its receipt: mounting this writer requires an explicit inventory/receipt and volume ownership handoff, an empty writer-owned path, and stopping prior readers/writers. Removing the static token entry from only one inventory is insufficient.

The existing `temporal-authorization.mjs` remains the token consumer: control uses the `apiKey` callback; the native worker receives the initial key and `setApiKey` updates. Bootstrap must join writer/authorization loss watchers to readiness, polling stop and connection closure. File replacement or deletion cannot revoke a token already cached by a client or accepted by a server. Issuer/server revocation and cached-connection fences require qualification before activation.

## Identities, pending work and remaining bootstrap

- The conversation worker uses its original opaque model bearer and direct TLS socket/ENI proof to the proxy; it receives no provider, database, owner-service or Temporal issuer credential.
- The proxy's mTLS identity, task lease and deployment revision authenticate its **separate** owner channel. The owner task/principal is distinct from the proxy and worker. Node requires TLS 1.3 peer evidence. Certificate fields supplied in JSON cannot establish those identities.
- Native Core bearer delivery stays inside the trusted owner. Temporal control and poller use their separately pinned role/subject/workload identity. No identity above substitutes for another.
- One Node service gate must cover all sessions sharing the canonical pool/facts resolver; another gate for either same resource is refused. Python retains one host gate. Unknown external work poisons those gates; constructing a fresh session or resolver cannot reconcile unknown I/O. Credential and writer owners also retain their pending-work fences. Retirement/reconciliation must prove ownership and stop before replacing a poisoned service.

Required real bootstrap remains: owner HTTPS :8444 listener and two-connection mTLS client; certificate trust/material provenance, certificate-to-task binding, fresh proxy-task lease and current owner self-task lease verification; trusted persisted bearer/session and current native credential delivery; reviewed pricing and the canonical pool; bounded ECS/ENI observer clients/IAM; the proxy's accepted TLS :8443 socket adapter; and the actual pinned LiteLLM native route/callback. The configured owner ARN alone supplies no current owner authority. Issuer transport, signing-key custody, database/network bindings and Temporal startup/rotation/stop integration remain explicit activation inputs. Native Linux TLS, source-IP preservation, actual provider wire and database uncertain-commit behavior are qualification gates. Source interfaces alone establish none of them.

## Current check receipts

Focused source receipts: Node owner channel **9 passed** after explicitly setting `MERI_REVIEW_SOURCE_ROOT` to the checkout root (the initial grouped invocation omitted it and that file refused); credential delivery **26 passed** and Temporal writer **7 portable passed** in the first group, with **5 Linux-only checks UNRUN**; Python owner channel **10 passed**. Root's coherent infrastructure source check is **62 passed**. These are local/synthetic source checks.

The initial combined Python discovery was **65/70 passed**, with **5 `upstream_callback` failures**. The upstream callback module alone passed **9/9**. Root's read-only trace reproduced the failure without the new channel tests: a preexisting `host_composition` test imports the callback inside patched `sys.modules`, leaving a stale package attribute and later class-identity mismatch after re-import. Both affected files are byte unchanged from `e4fc103`.

The corrected invocation first imports the canonical `apps.proxy.product.upstream_callback` module in the test process, then constructs and runs the unchanged discovery suite: **70/70 passed**, 0.836 seconds. From the repository root, using the pinned Python interpreter and existing site-packages `PYTHONPATH`, the exact arguments were:

```text
-c "import apps.proxy.product.upstream_callback; import unittest; s=unittest.defaultTestLoader.discover('apps/proxy/product/test',pattern='test_*.py'); r=unittest.TextTestRunner(verbosity=1).run(s); raise SystemExit(not r.wasSuccessful())"
```

No `top_level_dir` argument, source edit or test edit was used. This records the explicit pre-import remedy; it does not claim plain discovery passes. No successful live LiteLLM route, Linux writer mount, credential issuance, SQL execution or deployment is claimed.
