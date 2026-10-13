# Opaque action sessions

This opt-in process-local owner supplies the existing host's `authenticateSession` and `readCurrentState` ports. It creates no native identity, run, scope, grant, approval or refresh authority. Importing creates no services or credentials.

## Frontend transport

On the same application origin, send `POST /api/action-followthrough/session` with `Content-Type: application/json` and `Authorization: Bearer <native identity credential>`. The body is a closed object with optional UUID `conversationId`, `runId` and `clientId` hints. `{}` is valid: only the trusted current-context resolver may select missing values. Any provided hint must equal its authorized result.

A successful 200 response is exactly:

```json
{"credential":"<opaque action session>","expiresAtMs":1234567890000,"context":{"tenantId":"<tenant>","actorId":"<actor>","conversationId":"<UUID>","runId":"<UUID>","selectedClientId":"<UUID>"}}
```

Keep the opaque credential in memory. Use it as the bearer for the existing `query`, `draft`, `prepare` and `execute` routes; the native identity bearer cannot be substituted there. The context is a server-selected UI context receipt, not permission to author grants or approval fields. Task preparation still returns an immutable approval-required proposal; only the existing explicit approval/executor path can mutate tasks. Recommendation provenance retains its supporting-snapshot meaning.

Responses have JSON content type, `Cache-Control: no-store` and `X-Content-Type-Options: nosniff`, with no permissive CORS. The minimal success object is limited to 4096 UTF-8 bytes and validated by the same `assertActionSessionReceipt` owner used at issuance. Errors are content-free `{ "error": { "code": "..." } }`: 404 `SESSION_ROUTE_NOT_FOUND`, 405 `SESSION_METHOD_REFUSED`, 400 `SESSION_REQUEST_INVALID`, 413 `SESSION_REQUEST_TOO_LARGE`, or 401 `SESSION_REFUSED` for authentication/context/expiry/cancellation/capacity/invalid-output refusal. Hints with invalid values refuse issuance; no fallback or silently broadened context is selected. No native token, tool credential, scope list or full binding is returned.

## Trusted host interfaces

`createActionSessionOwner({mode:'process-local', verifyIdentity, resolveContext, now, limits})` returns `issue`, `authenticateSession`, `readCurrentState`, `revoke`, `close` and nonsecret `status`.

- `issue({identityCredential,hints?,signal?,deadlineMs?})` returns the exact receipt above.
- `verifyIdentity({credential,signal,deadlineMs})` returns `{principal:{tenantId,actorId},identityRevision,checkedAtMs,expiresAtMs}` after native identity verification.
- `resolveContext({identityCredential,identity,identitySha256,hints,signal,deadlineMs})` returns `{identitySha256,binding,scopes,selectedClientId,contextRevision,checkedAtMs,expiresAtMs}` from authoritative current state. The hash binds the exact fresh identity receipt; it does not independently authenticate the injected port.
- `authenticateSession({credential,signal?,deadlineMs?})` returns the existing host authentication receipt; `readCurrentState({authentication,signal?,deadlineMs?})` accepts only receipts actually issued for a currently retained session and returns the existing hash-bound current-state receipt.

Limits are required: `maxSessions` (1..1000), `maxRequestMs` (1..30000), `maxTtlMs` (1..300000), `maxFactBytes` (1..131072). Random 32-byte tokens are indexed by digest. Up to 64 authentication receipt hashes per session are retained. Fresh verifier and resolver calls recheck original identity/context revisions, principal, binding, selected client and scopes. Expiry can only shorten; changed or revoked context refuses and removes that session. Revocation while a port is pending is checked before another port or receipt release. Closing/restarting loses all sessions and fails closed. The native credential remains only in the process-local record for revalidation and is cleared on removal; no token is logged. Expired entries are bounded and removed on use or subsequent issuance.

`createActionSessionApplication({owner,now?,maxRequestBytes?,maxRequestMs?})` returns a Fetch `handle`. Defaults are 4096 request bytes and 3000ms; maxima are 65536 bytes and 30000ms. The original HTTP cutoff is passed to `issue` and clipped by the owner's cutoff and trusted receipts. Canonical `jsonBody` owns bounded decoding/cancellation; canonical `response` owns transport headers. Route-specific native Request accessors avoid invoking caller getters. No listeners are opened here; the existing bounded Node HTTP bridge can mount `handle`.

## Existing local case composition

The optional trusted `sessionFactory({verifyIdentity,resolveContext,now,deadlineMs})` on `createLocalApplicationCase` returns this owner. Its `openHost({pool,closeGraph?})` then returns `{app,identityCredential,closeGraph?}`: the synthetic bootstrap credential is out-of-band harness input, never an action credential or logged value. The same app/listener handles issuance and all four action routes. The session registry survives graph reconstruction with the case and closes with it. Without this option the accepted legacy `{app,credential,closeGraph?}` behavior is unchanged. Borrowed pools and ports are never closed by the session owner.

The local source exercise uses one scripted budget state and synthetic identity/context/source ports, with actual HTTP, canonical host, lookup, metadata, proposal and command owners. It is not native database, Clerk, live-current-policy, source, deployment or frontend qualification. A live host must provide a verified native-token-to-backend-principal adapter and authoritative current conversation/run/client resolver; Clerk identity alone does not establish those facts. Production descriptors remain unavailable. No refresh, automatic retry, multi-process session persistence or physical cancellation guarantee is claimed.

A frontend transport adapter must use the same origin and the host backed by this same process-local owner. Reconstructing service graphs within one retained case preserves its sessions; replacing/closing the owner or routing to a different process does not. There is no durable session or distributed-session claim.

Explicit synthetic mounting with the existing listener (no credentials printed):

```js
const localCase = createLocalApplicationCase({
  mode: 'synthetic-local', deadlineMs,
  sessionFactory: ({verifyIdentity, resolveContext, now}) =>
    createActionSessionOwner({mode: 'process-local', verifyIdentity, resolveContext, now,
      limits: {maxSessions: 8, maxRequestMs: 1000, maxTtlMs: 20000, maxFactBytes: 65536}})
});
await localCase.setup({pool}); // caller-supplied, explicitly admitted fixture pool
const graph = localCase.openHost({pool});
const listener = await listenActionApplication({app: graph.app, host: '127.0.0.1', port: 0, lifetimeMs: 10000});
// Pass graph.identityCredential out-of-band to the synthetic test client only.
// Obtain the distinct action credential via POST /api/action-followthrough/session.
// Finally: await listener.close(); localCase.close(); do not close the borrowed pool here.
```

The trusted context port additionally receives the original native `identityCredential` to make a fresh authenticated authority request. This is server-only call context, never a response field or browser-supplied authority receipt; it avoids a second credential handoff registry. Existing callbacks can ignore this additive field.
