# Exact Clerk session-read interface for the Capiro owner

Parent requested this narrow supplement while relaying the [application authority request](CODEX-CAPIRO-APPLICATION-AUTHORITY-REQUEST-20261013.md). Private wire contract is pinned at Meri `7ad86d7acc1234e446cacb61c8e7f00b4bf989ab`, `packages/contracts/action-authority-0.2/validate.mjs`. Its accepted implementation source is `1afbb5a53ebbf0eca9252b3b09ceb3e404918151`. No wire or runtime behavior changes accompany this supplement.

Capiro main `4be13b0b1ed0f2f3fa014040eedbb2fc2c27dace` locks `@clerk/backend@1.34.0`. Public source at that version confirms the existing backend client supports:

```ts
await clerkService.backend.sessions.getSession(verifiedClaims.sid)
```

This issues a GET for the exact session ID. The returned session exposes `id`, `userId`, `status` and `expireAt`. See the pinned upstream [SessionAPI implementation](https://github.com/clerk/javascript/blob/%40clerk/backend%401.34.0/packages/backend/src/api/endpoints/SessionApi.ts) and [Session resource](https://github.com/clerk/javascript/blob/%40clerk/backend%401.34.0/packages/backend/src/api/resources/Session.ts). Metadata-only byte hashes and the lockfile identity are in [references.json](../../qualification/candidates/application-adapters-20261013/clerk-interface/references.json); no source body or credential was retained. This establishes the SDK method, not deployed permission or successful live behavior.

## Narrow requested implementation

Use `ClerkService.verifySessionToken` (`apps/api/src/auth/clerk.service.ts:77`) and the existing middleware's authenticated TenantContext (`apps/api/src/tenant/tenant-context.middleware.ts:111`). Obtain `sid`, subject and original expiry only from the verified claims; validate their types explicitly. The current declared `ClerkSessionClaims` is not already a closed session-authority receipt. Do not decode an unverified token or accept a session ID from the bridge body. If the existing signed bearer lacks the necessary session claim, refuse and report that compatibility gap; this handoff does not authorize JWT-template changes or a replacement token flow.

Call the exact read above through `ClerkService.backend` (`clerk.service.ts:69`). Require matching session ID, matching verified Clerk subject/current TenantContext Clerk user, active status and valid unexpired session/token bounds. Retain current native membership and any already-supported impersonation checks. Calculate bridge expiry no later than the original verified JWT, session and applicable impersonation expiry, with explicit timestamp-unit validation. Do not turn this check into a token refresh or a new local lifetime. Missing, nonactive, mismatched, expired, malformed, unavailable or timed-out reads refuse; do not use cached-active success as a fallback. Bound the wait by the original request cutoff. The inspected one-argument SDK method does not itself promise an AbortSignal parameter or physical cancellation; do not invent either guarantee.

Use current active owned conversation checks in `apps/api/src/meri/meri.service.ts:873`, existing nonarchived client visibility at `:955`, and `ContextSecurityScopeService.resolve` in `apps/api/src/context/context-security-scope.service.ts:27`. Both bridge endpoints freshly authenticate. Context additionally requires the already stored nonnull client to match the selector and current wall/portfolio policy. Stable revisions cover security-relevant facts, excluding activity/check timestamps. The existing controller's any-status conversation GET remains unsuitable for new action authorization.

The exact new POST routes remain `/api/clio/application-authority/identity` with body `{}`, and `/api/clio/application-authority/context` with body `{identitySha256,conversationId,clientId}`. The private pinned validator owns their closed responses. The context response includes independently refreshed principal and identityRevision; the hash echo only correlates. Capiro returns no Meri run/attempt/worker/fence, scope/grant or approval authority.

## Existing credentials only

Reuse Capiro's already configured `ClerkService.backend` and server-side `CLERK_SECRET_KEY`; do not copy the key into Meri or the frontend. Meri forwards only the caller's existing native bearer to the fixed Capiro bridge. No new key, credential, service account, role, permission, allowlist, network path, token mint/refresh, session creation/revocation or dashboard change is requested or authorized by this handoff. If the existing installation cannot perform this read, report that exact failure and keep the bridge closed rather than expanding permissions.

The backend owner should fixture-test supported/missing signed sid, active versus ended/revoked/expired session, mismatched subject/session, original expiry bounds, lookup outage/timeout, membership and wall removal, archive/null-client refusal, stable revisions and sanitized closed receipts. No real Clerk API was called here. The local mounted replay and245 regression checks remain the prior source evidence; live identity, product admitted-run ownership and deployment qualification remain separate.
