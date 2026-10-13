# Application authority adapters and mounting

These source modules connect a fixed native authority HTTP boundary to the accepted opaque session and action host. They do not implement Clerk verification, native membership/wall policy, Meri run lifecycle, approval decisions or source activation.

`createCapiroApplicationAuthorityClient({origin,fetchImpl,now,limits:{maxRequestMs,maxResponseBytes},enabled=false})` owns the HTTPS transport for exactly two proposed routes. It sends only the supplied native bearer plus JSON content/accept headers, refuses redirects/non-200/invalid media or encoding, bounds content length and streamed bytes, parses fatal UTF-8 JSON, applies the private wire validator, and cancels owned response bodies on refusal or late acquisition. Limits are 1..30000ms and 1..131072 bytes. No ambient fetch, environment, credential loading, connection or request occurs on import/construction. `enabled:false` refuses before transport.

The private cross-application owner is `packages/contracts/action-authority-0.2/validate.mjs`; it is not registered in or published from the frozen public package. It owns these exact proposed contracts:

| POST path | Body | Response |
| --- | --- | --- |
| `/api/clio/application-authority/identity` | `{}` | `{principal:{tenantId,actorId},identityRevision,checkedAtMs,expiresAtMs}` |
| `/api/clio/application-authority/context` | `{identitySha256,conversationId,clientId}` | `{identitySha256,principal:{tenantId,actorId},identityRevision,conversationId,selectedClientId,contextRevision,checkedAtMs,expiresAtMs}` |

Neither endpoint exists in the inspected Capiro `4be13b0b` source. The client is executable against a matching deployment or isolated synthetic producer; this does not certify a native endpoint. A hash echo correlates a request, not authentication. The context response must independently derive its current principal and identity revision from the authenticated native session and match the identity receipt exactly. It must authorize the exact existing, active, owned, nonnull-client conversation and its current selected client, including current portfolio/client-wall rules. Null-client conversations are refused for this slice; browser hints do not create a selection policy.

Capiro must own stable revisions based on verified native session identity and current membership/role/impersonation facts, and relevant conversation/client/wall/portfolio authorization facts. Activity timestamps are not stable revisions. Receipt expiry cannot extend the verified original token/session or active impersonation expiry. The required current native-session revocation check still needs a supported official backend API established and implemented by that owner; the inspected `verifyToken` path alone is not an online revocation gate. Existing middleware may provision, self-heal or audit, so read intent is not a globally side-effect-free native invocation.

`createApplicationContextAdapters({client,currentRun,commandContext,now,limits:{maxRequestMs,maxFactBytes}})` returns the existing session owner's `verifyIdentity` and `resolveContext` ports. The command context is server-owned and prebound, with exactly `{binding,clientResolution:{reference:UUID,clientId:UUID}}`. It cannot be supplied by the browser. Empty hints select this owned host context; supplied conversation/run/client hints must match. Native identity is checked against the bound tenant/actor. `resolveContext` now receives `identityCredential` only as trusted call context from the session owner; it is neither returned nor logged and creates no second credential registry.

`currentRun(binding,{signal})` is the unchanged canonical Meri interface and returns a JSON string `{binding,policyRevision,deadlineMs,checkedAtMs}`. The adapter checks it before and after native context authorization, preserves the full binding, and refuses policy/fence changes. This is a **required borrowed current-state owner**: accepted Meri source has no general product implementation, and qualification registry/synthetic state is not promoted here. Exactly one client Scope is derived from the native-confirmed client and current run's policy revision; unrelated scopes are not admitted. Its context revision binds the native identity/context revisions to the full Meri run and policy. Snapshot freshness, expiry, principal and revision correlation are enforced here; the HTTP client alone only promises bounded transport and wire shape. Every operation preserves its original cutoff. Cooperative cancellation does not prove remote request or physical socket termination.

## Runnable mounting seam

`createApplicationActionHost({services,client,currentRun,hostPorts,now,limits,sessionLimits,enabled=false})` returns `{app,close,status}`. `hostPorts` is exactly `{reserveLookup,issueLookupCredential,issueExecution}` from the trusted current control owners. `services` is the accepted `createDurableActionServices` result; it is borrowed and retains its immutable allocation, producer and command context. Host limits are `{maxRequestMs,maxRequestBytes,maxResponseBytes}`. Session limits are `{maxSessions,maxRequestMs,maxTtlMs,maxFactBytes}` from the accepted session owner.

The mounted `app.handle` serves the existing `/api/action-followthrough/session` issuance route and four query/draft/prepare/execute routes. Native bearer is only for issuance; subsequent requests use its opaque action bearer. Accepted host and command owners continue all current checks and explicit approval behavior. Default disabled returns a content-free503 without authority/source calls. Closing invalidates only the owned process-local session registry; it does not close borrowed services, pools, HTTP clients or the current-run owner. Session restart/close remains fail closed.

```js
const client = createCapiroApplicationAuthorityClient({
  origin: approvedCapiroOrigin, fetchImpl: hostFetch, now,
  limits: {maxRequestMs: 3000, maxResponseBytes: 65536}, enabled: admitted
});
const mounted = createApplicationActionHost({
  services, client, currentRun, hostPorts, now,
  limits: {maxRequestMs: 3000, maxRequestBytes: 65536, maxResponseBytes: 131072},
  sessionLimits: {maxSessions: 100, maxRequestMs: 3000, maxTtlMs: 60000, maxFactBytes: 65536},
  enabled: admitted
});
const listener = await listenActionApplication({
  app: mounted.app, host: '127.0.0.1', port: 0, lifetimeMs: 30000
});
// Frontend's same-origin transport calls session first, then the existing action routes.
// Never log native or action credentials. No permissive CORS is added.
// Finally: await listener.close(); mounted.close(); borrowed resources remain caller-owned.
```

This is the existing bounded loopback listener, not a deployed public server. The authored test runs that real HTTP mounting with synthetic fixed-route native responses, canonical currentRun from the explicitly synthetic identity owner, actual accepted lookup/proposal/command owners and inert SQL/source ports. It demonstrates issuance→query→draft→pending proposal→unapproved refusal→explicit fixture approval→one effect→same-proposal replay→revocation. No Capiro, Clerk, native database, cloud, model, customer or paid endpoint was called. Production descriptors remain unavailable and default source flags remain off.
