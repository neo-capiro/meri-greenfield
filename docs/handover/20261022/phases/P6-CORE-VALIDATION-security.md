# P6-Core independent security review: capiro-backend PR #102

adj-b-transport, 2026-10-20. Verdict only. No code edits, no GitHub comments, no AWS calls.

**Labels:** `[R]` ran or read now, `[D]` derived from source, `[I]` inference.

**Reviewed:** [neo-capiro/capiro-backend#102](https://github.com/neo-capiro/capiro-backend/pull/102), `feat/core-p6-authority-current` @ `1cd6f2b6` (one commit), into `backend-import` @ `8b23c65b` (= merge base). 23 files, +1710/−131.

**Measured against:** `P6-CORE-PLAN.md` §2 and §5, ADR §4 (which asks for mutation tests on "never cache a refusal or an unanswered result"), and Core design §6 risks 1-9.

## Verdict: **APPROVE**

**I found no security defect in K1, K2 or K3.** Nothing must change before this merges dark. Four follow-ups are worth doing before Meri's P6 starts calling `/current`; the first two are small. They are in the change list at the end.

| Focus item | Result |
| --- | --- |
| **K2:** only positive results cached | **Yes** [D] [R: mutants K01, K10, K11 killed] |
| **K2:** no 401, 503, deadline or malformed result stored | **Yes** [R] |
| **K2:** keys can't cross sessions, users, credentials or kinds | **Yes** [D] [R: K04-K06 killed] |
| **K2:** 5 s TTL capped by `expiresAtMs` | **Yes** [R: K02, K03, K07 killed]. The window starts when Clerk's answer arrives (N4) |
| **K2:** followers get the leader's exact rejection, with no second Clerk call | **Yes** [R: K12, K13 killed] |
| **K2:** bounded eviction | **Yes** [R: K08 killed] |
| **K2:** no sid, sub, jti or token in the log line | **Yes** [R: K09 killed] |
| **K2:** a revoked session is served from cache for at most 5 s | **Yes**, measured from the Clerk answer (N4) |
| **K1:** authorization matches the siblings | **Yes** [D] |
| **K1:** tenant and client isolation in the snapshot | **Yes** [D] [R: C08-C10 killed]. It relies on explicit predicates, because the transaction bypasses RLS |
| **K1:** no network call while the transaction is open | **Yes** [D] [R: C04 killed] |
| **K1:** REPEATABLE READ + READ ONLY really applied | **Yes**, on real PostgreSQL 16 [R]. This also exposes a dormant hazard (N1) |
| **K1:** closed body and size limit | **Yes** for the closed body [R]. The size limit is issue (b) |
| **K1:** 503 passes through, never wrapped as 403 | **Yes** for the Clerk 503 [R]. The membership owner's own 503 becomes 403 (N2) |
| **K1:** no information leak in error bodies | **Yes** [D] |
| **K3:** tracker can't be spoofed by an unauthenticated request | **Yes** [D] [R: T01-T03 killed] |
| **K3:** every other route unchanged | **Yes** [R] |
| **Issue (a):** control credential refused with 401 under the production mounting | **Fails closed either way.** No security impact; it is an availability problem. The future fix needs its own review (§4) |
| **Issue (b):** raw-body size limit | **Negligible impact.** Optional hardening (§4) |

## 1. K2: the Clerk session cache (`clerk.service.ts`)

**How it works** (`readCachedApplicationSession`) [D]:
- Each method's existing claim pre-checks run first, on every call, hit or miss.
- **Hit:** the entry is used only while `now < min(storedAtMs + 5000, cached.expiresAtMs)`. The proof is returned through `applicationSessionForCaller`, which caps it at **this caller's** JWT `exp` and refuses if that has passed.
- **Miss:** one in-flight promise per key. The leader runs the unchanged 2 s online read. The entry is written only after:
  - the read resolved;
  - `frozenAuthorityCopy` accepted the result;
  - the result still has `expiresAtMs > now`.
- **Cleanup:** the in-flight entry is removed in `finally`, so no rejected promise outlives its read.

**Positive-only** [D]:
- **Only one write.** `applicationSessionCache.set` appears once, after all three conditions above.
- **Nothing written on failure.** The only `catch` counts the error and rethrows the same object.
- **Pinned by mutation tests.** Writing a fake positive entry on a 401 (K10) or a 503 (K11) is caught, and so is leaving a rejected in-flight promise behind (K01).

**Keys** [D]:
- **Native:** `native:${sid}:${sub}`.
- **Control:** `control:${jti}:${sub}:${iat}:${exp}`.
- **Why they can't collide:**
  - `sid`, `sub` and `jti` must match `^[A-Za-z0-9_-]{1,256}$`, so none can contain a `:`;
  - `iat` and `exp` are safe integers;
  - the two prefixes keep native and control keys apart.
- **A native hit can't admit a marked token.** A native key never serves a marked control token: the native pre-check refuses `meri_control_credential === true` before the lookup (K16). `clerk-control-credential.spec` pins the reverse direction.
- **A different `sub` with the same `sid`** is a separate key. It misses, and Clerk's `userId` check refuses it.
- **No caller can plant an entry for a session it doesn't hold.** Every caller passes claims from `verifySessionToken`, or from the middleware's private provenance. An entry exists only after Clerk confirmed `session.id === sid` and `session.userId === sub`.

**What the cache holds** [D]:
- **Only session facts:** id, userId, status, timestamps, Clerk `actor`, `expiresAtMs`.
- **No tenant, membership, role, conversation or client fact.**
- **Every caller still reads the local facts fresh:**
  - the middleware re-reads user, membership, tenant and impersonation on every hit;
  - `clerk-session-cache-callers.spec` refuses a removed member with 403 on a cache hit, through `readApplicationAuthority`, `PortfolioLayoutController` and `ObjectiveWorkService.proof`.

**Single-flight** [R]:
- **Followers get the leader's rejection object.** The `failures.every(f => f === failures[0])` tests pin it, and a follower never starts a second call.
- **A late follower inherits only the leader's remaining deadline.** A spec pins it.
- **No negative caching:** the next caller after a settled rejection makes a fresh call.

**Bounds and timers** [R]:
- **At most 10,000 entries.** Expired entries are swept on insert, then the oldest insertion is evicted.
- **No maintenance timers:** `jest.getTimerCount() === 0`.
- **Filling the cache needs real, Clerk-confirmed sessions,** so an attacker can't grow it [D].

**Log line** [R]: `{"event":"auth.clerk_session_cache","hits","misses","joins","refused","unavailable","entries"}`, once per 60 s of traffic. The spec checks the line contains none of the seeded sid, sub, jti, token or provider-message markers, and K09 (logging the keys) is caught. The diff adds no other log line.

**Revocation window:**
- A signed-out or revoked session is served from cache for up to **5 s after the Clerk answer that cached it arrived** [D].
- `storedAtMs` is taken after the read resolves. So, measured from the moment Clerk evaluated the session, the bound is 5 s plus that read's latency: at worst about 7 s, under the 2 s deadline. See N4.

**The cache covers callers the plan did not list** [D], under the same window:
- the retained-read owners: `requiresVerifiedRetainedNativeAuthority` from `retained-florida-current.controller.ts`, `retained-principal.service.ts` and `retained-read-authority.service.ts`, all mounted;
- `usePreviewNativeRead`;
- the unmounted history-release leaf `readFreshApplicationAuthorityInTransaction`.

The docstrings were updated honestly ("bounded Clerk evidence"), and ADR §4 states the bound as "≤ 5 s per Core task". So this is in scope. See N3 for test coverage.

## 2. K1: `POST /api/clio/application-authority/current`

**Authorization** [D]:
- **Same guards as `identity`, `context` and `membership`:** controller-level `@UseGuards(RolesGuard) @Roles('standard_user')`.
- **Same middleware admission.** `current` is added to `MERI_CONTROL_POST_PATHS` and to the no-store path list, and nowhere else.
- **Provenance required.** The handler requires the middleware's private provenance for this request object, and its exact context object, through `readApplicationAuthoritySession`. The spec's "unbound request" and "copied context" cases give 403 with no transaction.
- **A second control-credential check at the handler.** The handler-time `isMeriControlAuthorityPost(req)` runs again for a control credential.
- **Read-delegation tokens are refused** on `current` (`read-delegation.spec`).

**Order:**
1. Parse the body (400).
2. Check the declared `Content-Length` (400).
3. Do the one online session read, through K2, **outside** the transaction.
4. Open one `withSystem` transaction.

There is no network I/O in that transaction [D]:
- identity, membership, conversation, research-portfolio, prospect, client visibility and client authority are all DB-only;
- a second Clerk read inside it is caught (C04);
- the spec pins the sequence `['session','transaction']`.

**Isolation inside the snapshot** [D] [R]:
- **The transaction bypasses RLS.** `withSystem` is a `bypass: true` scoped client with `app.bypass_rls = on`. It is needed so identity can re-read the original membership during impersonation, as `readCurrentApplicationAuthority` already does on its own.
- **So explicit predicates are the only tenant isolation.** I read every query on that transaction:

| Port | Query | Tenant/actor pin |
| --- | --- | --- |
| identity | `user.findFirst` | `id` + `clerkUserId` (users are global) |
| identity | `tenantMembership.findFirst` | `id`, `tenantId` (provenance), `userId`, `active` |
| identity | `impersonationSession.findFirst` | `id`, `actorUserId`, `tenantId`, not ended, not expired |
| membership | `member()` | `tenantId`, `userId`, `active` |
| membership | `fetchAccessibleClientRevisionsForClerkActor` (raw SQL) | `c.tenant_id = $tenant`; membership joined on `c.tenant_id`; wall grant on `a.tenant_id = c.tenant_id` |
| conversation | `clioConversation.findFirst` | `id`, `tenantId`, `userId`, `archivedAt: null` |
| conversation (RP) | three raw `… FOR SHARE` reads, then `loadAuthorizedResearchPortfolio` | `tenant_id` on every statement |
| prospect scope | `tenant.findUnique` / `businessDevelopmentProspect.findFirst` | `id = ctx.tenantId` / `tenantId` + `id` |
| client | `client.findFirst` | `id`, `tenantId`, not archived |
| client authority | `resolveClients` + `client.findFirst` + `memoryAccessGrants` | `tenantId` on each, and the grants' `tenantId`, `clientId`, `userId` |

  Removing the pin from client visibility (C08), the conversation (C09) or the membership snapshot (C10) is caught by the spec.
- **The returned `clientIds`** come from the same tenant-pinned roster query `/membership` uses.

**The snapshot is real** [R]. I ran the PR's compiled `PrismaService.withSystem` with `/current`'s exact options, `{ isolationLevel: 'RepeatableRead', readOnly: true }`, against `pgvector/pgvector:pg16`:

```json
"settings_inside_current_tx": [{ "isolation": "repeatable read", "read_only": "on", "bypass_rls": "on" }],
"write_inside_current_tx": "PrismaClientKnownRequestError: ERROR: cannot execute UPDATE in a read-only transaction"
```

- **Statement order:** `SET TRANSACTION READ ONLY` runs first, then the RLS GUC (`set_config`, which PostgreSQL allows in a read-only transaction).
- **Mutation tests:** dropping READ ONLY (C01) or REPEATABLE READ (C02) is caught.

**Body** [D] [R]:
- **Closed body.** `parseApplicationAuthorityCurrentBody` reuses `closedBody`, and refuses:
  - proxies;
  - non-plain prototypes;
  - symbol keys;
  - accessors and non-enumerable properties;
  - unknown keys.

  It accepts only UUID `conversationId` and `clientId`, plus an optional `expect` holding a subset of the three revision keys with `HASH` values.
- **The shared `closedBody` change is equivalent for the existing callers.** With no optional keys, `own.length >= keys.length` and every own key in `keys` means exactly `keys`.
- **Size:** see issue (b).

**Errors** [D] [R]:

| Case | Response |
| --- | --- |
| Bad body | 400 `Invalid application authority request` |
| Authentication failure | 401, from the middleware or the session read |
| Every other refusal | 403 `Application authority unavailable` |
| Clerk unanswered | 503 `Application authority unavailable` |
| Revision precondition mismatch | 409 `{"error":"CHANGED"}` |

- **No internal detail in any body.** A Prisma error is caught and becomes 403.
- **409 can't be used to probe.** It is reachable only after every authorization check passes, so an unauthorized caller can't use `expect` as an oracle.
- **The Clerk 503 passes through.** Clerk is read outside the `try`, and the `catch` also rethrows `ApplicationAuthorityUnavailableException`. C03, which removes that rethrow, survives as expected, because nothing inside the transaction raises it today.
- **The membership owner's own 503 becomes 403 in `/current`:** see N2.

**Revisions** [D]:
- **The existing functions are reused:**
  - `applicationAuthorityRevision`;
  - `applicationMembershipRevision`;
  - `applicationMembershipPermissions`;
  - the identity revision from `readCurrentApplicationAuthority`.
- **The context composition is copied, not shared,** but element for element it equals `/context`'s: `[identityRevision, [id, tenantId, userId, clientId, status, archivedAt], scope, client]`.
- **The equivalence spec** compares `/current` with all three routes, with prospect scope present.
- **No new hashing.**

**N1, a dormant hazard: READ ONLY versus the research-portfolio row locks** [R]:
- **What happens.** For a research-portfolio (RP) conversation, `loadOwnedActiveClioConversation` calls `authorizeResearchPortfolioConversation`. That issues `SELECT … FOR SHARE` on the same transaction, and PostgreSQL refuses it:

  ```json
  "rp_conversation_in_current_tx": "PrismaClientKnownRequestError: ERROR: cannot execute SELECT FOR SHARE in a read-only transaction",
  "rp_conversation_same_tx_without_readOnly": "ForbiddenException: Active tenant membership required"
  ```

- **It changes no outcome today.** An RP conversation must have `clientId === null`, and both `/context` and `/current` require a UUID `clientId` (`assertCurrentConversation`). So both routes refuse every RP conversation with 403 [D].
- **Two costs remain:**
  - each such request logs a PostgreSQL ERROR;
  - if RP conversations ever become valid for `/context`, `/current` will refuse them where `/context` admits them.
- **Not caught by the spec.** Its fake `$executeRaw` accepts any SQL, and no RP conversation goes through `current`.

## 3. K3: the throttler key (`capiro-throttler.guard.ts`, `applicationAuthorityThrottleKey`)

**Where the key comes from** [D]:
- **Only from middleware-verified provenance.** The tracker is `authority-user:${sub}` only when:
  - the request is an exact POST to one of the four paths, at guard time, with `req.path === originalUrl`;
  - **and** the module-private `applicationAuthorityRequests` WeakMap has provenance for this request object. The middleware writes it only after `verifySessionToken` and membership selection.
- **Otherwise the IP tracker applies:** `super.getTracker(req)`.

**Why an unauthenticated request can't choose a key:**
- **It never reaches the guard.** The middleware throws first, as it did before.
- **Public fields don't count.** Request fields such as `claims`, `user`, `tenantContext`, a copied `applicationAuthorityRequests` property, the body or `X-Forwarded-For` are never read. The spec's forging middleware and the direct `applicationAuthorityThrottleKey` call pin this.
- **Mutation tests:** reading a public field (T01) or `req.tenantContext` (T03) is caught.

**Every other route is unchanged** [R]:
- non-authority POSTs, case and trailing-slash variants, `identity-extra` and GETs keep the shared IP bucket;
- widening the user key to every POST (T02) is caught;
- the limits and the `ThrottlerModule` options are unchanged;
- `@nestjs/throttler` 6.7.1 uses the overridden `getTracker`, because no per-throttler `getTracker` is set.

**Middleware runs before the guard** under the production consumer mounting (`forRoutes('*')` with the real exclusions): the consumer-mounted native test records `verified` then `guard` [R].

**Load** [I]:
- **For one user, per-user keying is never tighter than before.** Previously one 30/s and 600/min bucket was shared by all traffic through an ALB node.
- **Native and control credentials share one bucket per user** (spec).
- **No 429 in a normal chat** is the shipper's §6.6 check.

## 4. The two documented issues

**(a) The control credential gets 401 under the production mounting.**
- **What happens.** With `consumer.apply(TenantContextMiddleware).exclude(...).forRoutes('*')`, Express strips the matched path into `req.baseUrl`, so inside the middleware `req.path === '/'` while `originalUrl` is the full path. `isMeriControlAuthorityPost` requires `req.path === originalUrl`, so it refuses every marked token.
- **The PR reproduces this.** Its consumer-mounted throttler test records `request-path:/:/api/clio/application-authority/identity` and then a 401. D3 is checking whether it happens live.
- **Security impact, either way.** If it is real, the refusal happens before any local DB action. Nothing widens:
  - the classifier admits nothing new;
  - `current` inherits the same refusal;
  - native sessions are unaffected (their provenance is recorded through `originalUrl`, and K3 keys them per user).
- **What it costs if real.** Availability only: every control-credential call to the four routes is refused, including the lease renewals ADR §2.2 plans on `current`. Meri's P6 can't use the control credential until this is fixed.
- **If it is not real,** the exact-path classifier admits only the four POSTs. The spec refuses `artifact`, `current/`, `CURRENT`, `current-extra`, `%63urrent`, GET, HEAD, a rewritten `originalUrl` and an absolute-form target.
- **The fix belongs in its own change-controlled PR, with its own review.** It must:
  1. **Keep two independent views of the target:** the path Express routes, and the raw request target. Comparing only `originalUrl` would let an earlier `req.url` rewrite route a control token to another handler. Inside a mounted middleware, the routed path is `req.baseUrl` plus `req.path` (with `'/'` handled), so compare that with `originalUrl` exactly.
  2. **Keep the exact, case-sensitive, no-trailing-slash set.** Express's own routing is case-insensitive and accepts one trailing slash, so variants must stay refused.
  3. **Keep the handler-time recheck** in `readApplicationAuthoritySession`.
  4. **Add a test with the production bootstrap** (`configureApiHttpApp` plus the real consumer mounting) proving:
     - admission on exactly the four routes;
     - refusal on every route variant listed above.

     Today the control-credential specs build root-mounted fake requests, which is why this went unnoticed.

**(b) The raw-body size limit** [D]:
- **What `/current` enforces:**
  - it refuses a declared `Content-Length` over 4096;
  - it bounds the validated, re-serialized body. That body can only hold two UUIDs and up to three hashes, so it is always under about 400 bytes.
- **What gets past it.** A chunked body padded with whitespace, up to the global `json({ limit: '1mb' })`, is parsed and then accepted.
- **Impact is negligible:**
  - the 1 MB global limit already applies to every route, the sibling authority POSTs included, and runs before authentication;
  - the parsed result is tiny;
  - nothing in the padding reaches any owner.
- **Optional hardening:** a route-specific `json({ limit: '4kb' })` for the authority POSTs in `bootstrap/configure-api-http-app.ts`, mounted before the global parser the way `/api/me/email-signature` is. That is a bootstrap change outside §3's file list.

## 5. Tests I ran

**Specs, base `8b23c65b` against head `1cd6f2b6`** [R]. Each file ran alone, `--runInBand`:

| Spec | Base | Head |
| --- | --- | --- |
| `auth/application-authority-current.spec.ts` (new) | — | **39/39** |
| `auth/capiro-throttler.guard.spec.ts` (new) | — | **15/15** |
| `auth/clerk-session-cache.spec.ts` (new) | — | **69/69** |
| `auth/clerk-session-cache-callers.spec.ts` (new) | — | **7/7** |
| `auth/clerk-control-credential.spec.ts` | 16/16 | 18/18 |
| `tenant/tenant-context.meri-control.spec.ts` | 24/24 | 25/25 |
| `auth/application-authority-artifact.spec.ts` | 7/7 | 7/7 |
| `auth/read-delegation/read-delegation.spec.ts` | 40/40 | 40/40 |
| `users/portfolio-layout.controller.spec.ts` | 26/26 | 26/26 |
| `auth/application-authority-boundary.spec.ts` | 7 pass, 1 fail | 8 pass, 1 fail |
| `auth/application-authority.spec.ts` | 64 pass, 11 fail | 64 pass, 11 fail |
| `auth/retained-native-authority.spec.ts` | 0 pass, 12 fail | 0 pass, 12 fail |
| `auth/application-membership.spec.ts` | fails at suite load | fails at suite load |

- **New tests:** 130 in the four new files, plus 2, 1 and 1 added to existing files: **134**, matching the PR.
- **Failures are identical at base and head:** the same 24 failing test names and the same suite-load failure, compared by name.
- **Coverage note:** these were the new specs and the existing specs the PR edits or that exercise K2's callers. The full regression sets are D3's run, not mine.

**PostgreSQL probe:** §2, `logs/head/pg-probe.log`.

**Mutation pass** (ADR §4, design risk 9) [R]: 29 mutants, each against the specs that own the property. The baseline run is unmutated and passes.

**Result: 28 of 29 killed.** The one survivor, C03, was predicted.

| ID | Mutant | Result (failing tests) |
| --- | --- | --- |
| K01 | In-flight entry never removed: rejections replayed forever | killed (60) |
| K02 | TTL 5 s → 50 s | killed (5) |
| K03 | Hit ignores the cached proof's expiry | killed (5) |
| K04 | Native key drops `sub` | killed (1) |
| K05 | Control key drops `jti` | killed (2) |
| K06 | Control key drops `iat`/`exp` | killed (1) |
| K07 | Hit or join not capped at the caller's JWT expiry | killed (2) |
| K08 | No 10,000-entry bound | killed (1) |
| K09 | Log line carries the cache keys | killed (1) |
| K10 | An answered 401 cached as a positive proof | killed (26) |
| K11 | An unanswered 503 cached as a positive proof | killed (11) |
| K12 | Followers get the 503 remapped to 401 | killed (11) |
| K13 | Followers get a copy, not the leader's rejection | killed (13) |
| K14 | Cached proof not frozen | killed (7) |
| K15 | Control claim pre-check skipped on a hit | killed (1) |
| K16 | Native marker pre-check skipped on a hit | killed (1) |
| T01 | Tracker accepts a forged public request field | killed (1) |
| T02 | User tracker on every POST, not only the four | killed (4) |
| T03 | Tracker read from `req.tenantContext` | killed (6) |
| C01 | `current` drops READ ONLY | killed (1) |
| C02 | `current` drops REPEATABLE READ | killed (1) |
| C03 | `current` wraps an in-transaction 503 as 403 | **survived, as predicted**: no 503 source exists inside the transaction today |
| C04 | Second Clerk read inside the transaction | killed (2) |
| C05 | `current` removed from the control allowlist | killed (2) |
| C06 | `expect` mismatch ignored | killed (1) |
| C07 | Declared size bound 4096 → 1 MB | killed (1) |
| C08 | Client visibility loses its tenant pin | killed (6) |
| C09 | Conversation loses its tenant pin | killed (1) |
| C10 | Membership snapshot loses its tenant pin | killed (2) |

C03 surviving is what N2's change-list item would pin: once membership's 503 passes through, a spec case gives the rethrow a source.

## 6. Other observations (non-blocking)

- **N2: the membership owner's 503 becomes 403 in `/current`.**
  - **The cause.** `/current` rethrows only `ApplicationAuthorityUnavailableException` and the 409. The membership owner throws its own `ServiceUnavailableException('Current membership unavailable')` for:
    - a roster over the bound;
    - a malformed roster row;
    - any non-HTTP error from its transaction.
  - **The divergence.** `/membership` returns those as 503, but `/current` turns them into 403. So does a Prisma or transaction error inside `/current`, which `/membership` would also have answered 503.
  - **Severity.** It fails closed, so it is not a security issue. But Meri treats 403 as a refusal and 503 as retryable, so a transient DB failure on `/current` would end a lease. That is the failure class the Clerk 503 fix removed.
  - **Plan wording.** The plan says "every other refusal is 403", and an unavailable database is not a refusal.
- **N3: the retained-read callers have no running cache test.**
  - **What they inherit.** The retained-read owners inherit the ≤ 5 s window (§1).
  - **Which tests would pin it.** `retained-native-authority.spec.ts` pins "repeats fresh Clerk/local reads on every delegated invocation". It fails 12/12 at both base and head (loader `Unexpected … runtime import`). So nothing that runs pins fresh local reads on a cache hit for those callers.
  - **The membership spec has the same problem.** `application-membership.spec.ts` fails at suite load at both base and head, so the PR's edits to it never execute. Membership equivalence is pinned instead by `application-authority-current.spec`.
- **N4: the TTL window is anchored at the end of the read.**
  - **What it means.** `storedAtMs` is taken after the Clerk read resolves, so the 5 s window is measured from the answer, not from the request.
  - **Fix.** Anchoring it at the leader's read start would make "≤ 5 s from Clerk's evaluation" strict at no cost.
  - **Clock.** The window uses `Date.now()`, so a backward wall-clock step lengthens it. A monotonic clock for the 5 s part would remove that; the expiry comparisons stay on wall-clock time. This is low risk on Fargate, where the clock slews.
- **Insert cost.** Every insert sweeps the whole map, up to 10,000 entries per miss. That is fine at the expected rate of about one miss per session per 5 s. It is noted only because the bound is otherwise attacker-proof.

## Decisions

- **APPROVE, security only.** K1, K2 and K3 meet §5 and the focus list. The cache's correctness properties survive targeted mutation testing, and the snapshot is a real REPEATABLE READ + READ ONLY transaction on PostgreSQL.
- **N1 to N4 don't block a dark merge.** `/current` has no caller until Meri's P6. N2 and N1 should be settled before P6 relies on `/current`'s status codes and coverage.
- **Issue (a) is not a security finding.** I assessed it both ways, and it fails closed. Its fix is a separate change-controlled PR with the four requirements in §4.
- **Issue (b) is accepted as is.** The route-specific parser is optional hardening outside the approved files.

## Change list

**Required before merge:** none.

**Recommended before Meri's P6 calls `/current`, in this PR or a follow-up on the same files:**
1. **N2.** In `ApplicationAuthorityController.applicationAuthorityCurrent`'s `catch`:
   - rethrow `ServiceUnavailableException` (the base class of `ApplicationAuthorityUnavailableException`) instead of only the subclass;
   - map non-HTTP errors from the transaction to `ServiceUnavailableException('Application authority unavailable')`, as `/membership`'s snapshot does.

   Add spec cases:
   - roster over the bound → 503;
   - transaction error → 503;
   - every authorization refusal still 403.
2. **N1.** Add an RP-conversation case to `application-authority-current.spec`, with a fake `$executeRaw` that rejects `FOR SHARE` after `SET TRANSACTION READ ONLY` as PostgreSQL does. Assert that `/current` and `/context` both answer 403.

   If RP conversations are ever made valid for `/context`, make the three lock statements in `authorizeResearchPortfolioConversation` conditional for a caller-owned read-only snapshot. That needs a change-control approval for `research-portfolio-artifact-authority.ts`.
3. **N4.** In `readCachedApplicationSession`, set `storedAtMs` to the leader's read start, and optionally measure the 5 s part on a monotonic clock. Then add a spec case: answer at +1.9 s, so the hit ends at +5.0 s, not +6.9 s.
4. **N3.** Extend `clerk-session-cache-callers.spec.ts` to the retained-read owners (`requiresVerifiedRetainedNativeAuthority`). On a cache hit, a removed member must be refused through each of them.

**Separate change-controlled PR:**
5. **Issue (a):** the classifier fix, with the four requirements in §4.

**Optional:**
6. **Issue (b):** a 4 kb route-specific JSON parser for the four authority POSTs, in `configure-api-http-app.ts`.

## Evidence

`P6-CORE-VALIDATION-security-evidence/`:
- `scripts/`:
  - `run.sh` and `in.sh`: install, specs and the probe;
  - `pg-readonly-probe.cjs`: the probe;
  - `mutants.cjs`, `mutate.cjs`, `mut-in.sh` and `mut-run.sh`: 29 mutants;
  - `sum.cjs`: summarises the spec results.
- `logs/`: steps, per-spec Jest JSON and logs for head and base, the probe output, and per-mutant logs.

**Environment:**
- `node:22.23.3-alpine3.24`, the version `apps/api/Dockerfile` pins;
- pnpm 9.12.0 with `--frozen-lockfile`;
- each spec file run alone with `--runInBand`;
- an unreachable `DATABASE_URL` for the unit specs, as the PR's runs used;
- `pgvector/pgvector:pg16` for the probe only.

**Migrations.** The probe database applied 450 of 488 migrations: a later research-portfolio migration fails on a fresh database. That is unrelated to this PR, and the tables the probe touches were created earlier.

---

# Follow-up review: #102 @ `05d95139` and #103 @ `749ad1d1`

adj-b-transport, 2026-10-20. Verdict only: no edits, no GitHub comments, no AWS calls.

**Scope:**
- [neo-capiro/capiro-backend#102](https://github.com/neo-capiro/capiro-backend/pull/102) `feat/core-p6-authority-current`: `1cd6f2b6` → **`05d95139`**, one new commit, 15 files.
- [neo-capiro/capiro-backend#103](https://github.com/neo-capiro/capiro-backend/pull/103) `feat/core-mounted-authority-paths` @ **`749ad1d1`**: one commit on `backend-import` @ `8b23c65b`, 7 files.

**Merging both.** An in-memory merge (`git merge-tree`) of the two heads is clean. It leaves one `mountedRequestPath` in `tenant-context.middleware.ts`, and #102's control classifier uses it.

## Verdicts

| PR | Verdict |
| --- | --- |
| **#103** | **APPROVE** |
| **#102** | **APPROVE on security.** Merge waits on one scope decision: Neo must approve or remove the clientless Research Portfolio extension (F1) |

| Check | #102 | #103 |
| --- | --- | --- |
| Classifier admits only exact mounted targets: rewritten, absolute-form, trailing-slash, `baseUrl`/`path` and off-allowlist refused | **Yes** [D] [R: X01-X06 killed] | **Yes** [D] [R: 17/19 killed; 2 equivalent under the production mount, see F3] |
| `withSystem`/RLS-bypass tenant pins (D3's §1 list) | **Confirmed** [D]. All ten ports pin tenant/actor, as in §2's table [R: C08-C10 killed] | n/a |
| N2: `ServiceUnavailableException` and transaction errors → 503, refusals stay 403 | **Yes** [R: N2a-N2f killed] | n/a |
| N4: TTL anchored at the leader's read start, on a monotonic clock | **Yes** [R: N4a, N4b killed] | n/a |
| RP `{ lock: false }` reachable only from `/current`'s read-only snapshot; old routes keep their locks | **Yes** [D] [R: R1-R3 killed, on real PostgreSQL] | n/a |
| Mutation set re-run on the new head | **49/49 killed** | **17/19 killed**; 2 survivors equivalent (F3) |
| No new spec failure vs base | **Yes** [R] | **Yes** [R] |

## 1. The classifier fix (both PRs) [D]

**The helper:**

```ts
mountedRequestPath(req) = (req.baseUrl ?? '') + (req.baseUrl && req.path === '/' ? '' : req.path)
```

**Why only an exact mounted target is admitted.** Every fixed classifier still requires the mounted path to equal the raw target with the query stripped (`originalUrl`). It then checks that same string against an exact allowlist, map or anchored regex. So admission needs:
- the client's raw target to be literally one allowlisted path; and
- Express's own view of the routed path to be identical.

**Each attack fails:**

| Attack | Why it is refused |
| --- | --- |
| **Rewritten target** | An earlier `req.url` rewrite changes `baseUrl`/`path`, so the equality fails. A rewritten `originalUrl` makes the raw target differ instead. Both cases are tested under the real `AppModule` mount. |
| **Absolute-form target** | `originalUrl` starts with `http`, so it can never equal the mounted path. |
| **Trailing slash** | Under the production `forRoutes('*')` mount, a trailed target gives a mounted path without the slash, so the equality fails. Under a root mount the equality holds, but the exact allowlist lookup refuses. |
| **Case variant, encoding, `-other`** | Not in any exact set. |
| **`baseUrl`/`path` manipulation** | Both are computed by Express from `req.url`. The client can only influence them through the raw target, which must also match `originalUrl`. |

**Unchanged:**
- the handler-time recheck in `readApplicationAuthoritySession`;
- the "no query" and "no fragment" rules of the execution, read-delegation and signed-memory classifiers.

**Where each is tested:**
- **#102:** the control classifier, through the real `configureApiHttpApp` + `AppModule.configure` (`capiro-throttler.guard.spec`) and through `tenant-context.meri-control.spec`.
- **#103:** the other six classifiers, through the same real bootstrap (`tenant-context.authority-mount.spec`, 22 cases) plus a unit matrix (`mounted-authority-request.spec`).

**Preview classifier.** `isPreviewNativeReadRoute` stays an OR of the mounted path and the raw target. That is correct: matching sends a request into the *stricter* preview branch, so a wider match fails closed.

## 2. N2, N4 and the research-portfolio path (#102) [D] [R]

**N2:**
- **What changed.** `/current`'s `catch` now:
  - rethrows any `ServiceUnavailableException` (which includes the Clerk subclass) and the 409;
  - maps a non-HTTP error to `ServiceUnavailableException('Application authority unavailable')`;
  - answers 403 for everything else.
- **Owners that see `/current`'s transaction** now propagate infrastructure failures only when called with that transaction. Legacy callers keep their mapping:
  - identity (`preserveTransactionUnavailable`);
  - bizdev prospect;
  - client authority.
- **The client-wall refusal** (`ContextResolutionError`, a plain `Error`) is explicitly mapped to 403, so a refusal never becomes a retryable 503 (N2f).
- **Prospect conflicts** stay 403, because `MeriProspectScopeConflictError` is a `ConflictException`.
- **One consequence, fail-closed.** A programming error inside the snapshot (for example a `TypeError`) now answers 503 rather than 403. Nothing is granted either way.

**N4:**
- `storedAtMs` is `performance.now()` taken when the leader starts. A hit needs `monotonicNow < storedAtMs + 5000` **and** wall-clock `now < expiresAtMs`.
- Specs pin these cases:
  - a 1.9 s read expires at +5.0 s;
  - a backwards wall-clock step can't extend the window;
  - an epoch-expired session or JWT is still refused.

**RP `{ lock: false }`:**
- **Where it can be reached.** `authorizeResearchPortfolioConversation(…, { lock: false })` is called only from `loadOwnedActiveClioConversation` when a caller transaction is passed. Only `/current` passes one (`git grep`).
- **Every other caller keeps the three `FOR SHARE` reads:**
  - `/context`;
  - read delegation;
  - `meri.service` (3 sites);
  - the institutional service;
  - artifact authority.
- **What lock-free still checks:** membership, and the current viewer-or-better grant.
- **Real PostgreSQL** (`application-authority-current.postgres.spec`, **10/10 ran and passed** on my `pg16`, none skipped):
  - lock-free READ ONLY authorization works;
  - a revoked grant or membership is still refused inside the snapshot;
  - the legacy helper still issues all three locks.
- **Mutants:**
  - R1 (a legacy caller loses its lock) is killed by the real-PostgreSQL case;
  - R2 (`/current` takes the locks) and R3 (the legacy loader drops them) are both killed.

## 3. Findings

**F1: scope. `/current` now accepts `clientId: null` for Research Portfolio conversations** [D].
- **Where it came from.** D3's report says `/current` refuses RP conversations "that `/context` accepts". That premise is wrong:
  - RP conversations are clientless (`authorizeResearchPortfolioConversation` requires `clientId === null`);
  - `/context` requires a UUID `clientId`, so it has always refused them (§2, N1 of my first review).

  To satisfy D3's "assert 200 for a Research Portfolio-scoped one", the agent extended the contract. `/current` now issues a receipt that no existing route issues, so there is no old-route equivalent to compare it with (plan §1 goal (d)).
- **The authorization itself is sound.** A null client is admitted only when all of these hold:
  - the exact loaded row carries a private, frozen proof. Only the RP owner writes it, after its checks pass on the same snapshot, so neither body nor metadata can forge it;
  - there is no prospect scope;
  - the conversation is owned, active and clientless;
  - membership is active and the RP grant is current.

  R4-R7 are killed, and the real-PostgreSQL revocation cases pass. `/context` stays UUID-only.
- **But it is outside the approved K1 contract.** The plan says the approval "covers exactly the scope below", and the request was specified with a UUID `clientId`. Meri's P6 would also have to handle `selectedClientId: null`.
- **Decision for Neo.** Approve the extension explicitly, or have the agent drop the null-client branch. Keeping `{ lock: false }` costs nothing, and without the branch RP conversations simply get 403 on both routes, as today.

**F2: cleanliness, #103.** `mountedRequestPath` is copied into five files. One exported helper (for example in `auth/`) would keep a single definition for future fixes. Not a security issue.

**F3: test gap, #103 (two mutants survived).**
- **The mutants.** Y02 (the retained classifier strips a trailing slash before its map lookup) and Y06 (the same in `historyReleaseProvenance`) survive.
- **Why that is not a code defect.** Under the production mount the equality already refuses a trailed target (mounted `…/x` ≠ raw `…/x/`), so the stripped lookup can't be reached. The mount spec's trailed cases pass with the mutant applied.
- **What is missing.** No test pins those two lookups' exactness on its own, for example under a root mount where the equality holds.
- **The fix.** Add a root-mounted, or unit, trailed case for both. The unmutated code refuses in both mount styles.

## 4. Tests run [R]

**Setup:**
- `node:22.23.3-alpine3.24`, pnpm 9.12.0 frozen;
- each file run alone with `--runInBand`;
- the Node container shares `pgvector/pgvector:pg16`'s network namespace, so the PR's PostgreSQL spec reaches its required `127.0.0.1` fixture.

**#102 @ `05d95139`:**

| Spec | Result |
| --- | --- |
| `application-authority-current` | 60/60 |
| `application-authority-current.postgres` | **10/10, not skipped** |
| `capiro-throttler.guard` (real `AppModule.configure`) | 22/22 |
| `clerk-session-cache` | 79/79 |
| `clerk-session-cache-callers` | 7/7 |
| `clerk-control-credential` | 18/18 |
| `tenant-context.meri-control` | 32/32 |
| `application-authority-artifact` | 7/7 |
| `read-delegation` | 40/40 |
| `portfolio-layout.controller` | 26/26 |

The pre-existing failures are **identical by name** to `8b23c65b`: boundary 1, authority 11, retained-native 12, and the membership suite-load failure.

**#103 @ `749ad1d1`:**

| Spec | Result |
| --- | --- |
| `mounted-authority-request` | 12/12 |
| `tenant-context.authority-mount` | 22/22 |
| `preview-native-read-mode` | 41/41 |
| `read-delegation` | 40/40 |
| `meri-execution-flow` | 19/19 |
| `meri-routine-firing` | 19/19 |
| `tenant-context.history-release-native` | 3/3 |
| `tenant-context.meri-control` | 24/24 |

The existing specs match base exactly.

**Mutation, #102: 49/49 killed.** The baseline passes (221 tests).
- **The original set, re-pointed to the new source:** K01-K16, T01-T03, C01, C02, C04-C10.
- **New mutants:**
  - N4a (TTL anchored at the reply) and N4b (wall-clock TTL);
  - N2a-N2f (each 503 or refusal mapping, including "every refusal becomes 503");
  - R1-R7 (lock confinement, a stale proof, a null client with no proof or alongside a prospect scope, a proof read from persisted metadata);
  - X01-X06 on the control classifier: the `originalUrl` equality dropped, a trailing slash accepted, reverted to `req.path`, the collapse removed, `original` taken from the mounted path, case-insensitive.

**Mutation, #103: 17/19 killed.** The baseline passes (156 tests).
- **For each fixed classifier:** the equality is dropped and the classifier is reverted to `req.path`.
- **Trailing-slash acceptance is tested** for retained, history, execution and read-delegation.
- **Also tested:** the roster equality, the preview route, and the collapse in the helper.
- **Y02 and Y06 survive,** for the reason in F3.

## 5. Decisions

- **#103: APPROVE.** It fixes the six PR96 classifiers without widening any of them. F2 and F3 are follow-ups.
- **#102: APPROVE on security.** N2 and N4 are done correctly, the lock-free path is confined, and the classifier is exact.
- **F1 is a scope question, not a security defect,** so it is Neo's decision. Merge #102 only after Neo approves the clientless RP receipt, or after the agent removes it.
- **D3's premise needs correcting.** The claim that `/context` accepts RP conversations is wrong (F1). D3 should correct it so later phases don't build on it.

## 6. Change list

**#102:**
1. **Before merge:** Neo approves the `clientId: null` Research Portfolio receipt as an amendment to O55's K1 contract, **or** the null-client branch is removed. If it is removed:
   - `parseApplicationAuthorityCurrentBody` returns to UUID-only;
   - `researchPortfolioScope` is dropped from the ports;
   - the WeakMap proof is dropped;
   - `{ lock: false }` and the PostgreSQL READ ONLY cases stay.

**#103 (follow-ups, non-blocking):**
2. **F3:** add trailed-target cases that bypass the mount collapse for `isRetainedSignedPost` and `historyReleaseProvenance`, so Y02 and Y06 die.
3. **F2:** export one `mountedRequestPath` and import it in the five files.

## Evidence (follow-up)

`P6-CORE-VALIDATION-security-evidence/followup/`:
- `scripts/`:
  - `run2.sh` and `in2.sh`: specs and mutation, per head;
  - `mutants-102.cjs` and `mutants-103.cjs`;
  - `mutate.cjs`: now supports `occurrence`;
  - `compare2.sh`: failure-set comparisons;
  - `recopy.sh`.
- `logs/`: `p102/`, `p103/`, `base/`, each with steps, per-spec Jest JSON, and `mut/` per-mutant logs and `mutants.txt`.

**An infrastructure note.** WSL ran out of memory once while copying the archives, because the host was under shared load. I re-copied them, verified sizes and archive listings, and only then ran them. No result comes from a truncated tree.

---

# Final re-check: #102 @ `946511a7` and #103 @ `43a03ada` (2026-10-21)

adj-b-transport. Verdict only: no edits, no GitHub comments, no AWS calls.

**What changed since the follow-up:**
- **#102:** one commit on `05d95139`, "Keep current authority receipts bound to UUID clients" (5 files).
- **#103 is now stacked on #102.** Its base is `feat/core-p6-authority-current`, not `backend-import`. Its own commits on top of `946511a7` are:
  - `e0787a63`: the classifier fix, rebased;
  - `43a03ada`: the shared helper plus trailing-slash cases.
- **Merge order:** #102 first, then #103.

## Status: the dynamic re-run was first blocked by the host (since resolved; see "Final results" below)

- **Specs and mutants could not run.** The Windows host's commit charge is exhausted, at 126.1 of 127.3 GB. `SearchIndexer` (PID 42528) holds **73 GB** of private memory.
- **The symptom:** `git archive` fails with `malloc failed` for 2.4 MB allocations, so no container or pnpm install can start.
- **Ready to run:** the mutation sets for both heads (`mutants-102b.cjs`: 48, `mutants-103b.cjs`: 21) and a verified-copy runner (`run3.sh`). They run as soon as memory is available.
- **Every check below is `[D]`,** read from source at the two heads.

## Static results [D]

**1. The clientless research-portfolio removal (#102) leaves no residue.**
- **Gone, with no reference left:**
  - the `researchPortfolioScope` port;
  - the `verifiedResearchPortfolioScopes` WeakMap;
  - `readApplicationAuthorityResearchPortfolioScope`;
  - the `clientId: string | null` request type;
  - `selectedClientId: string | null`.

  The only `clientId: string | null` left in `application-authority.ts` is the stored-conversation type `ApplicationAuthorityConversation`, which predates the PR.
- **`/current` is UUID-only again.** `parseApplicationAuthorityCurrentBody` requires both `conversationId` and `clientId` as keys, through `closedBody`, and both must be UUID strings. It runs first in the handler, before the session read and before the transaction. So a null or missing selector gets **400 with no read**. The spec's "rejects %s as 400 before session or snapshot reads" table now includes `null client` and `missing client`.
- **Receipt logic is restored:** it is again `scope` → `clientVisible` → `clientAuthority`, unconditionally.

**2. `{ lock: false }` is still confined.**
- **Only one call site:** `loadOwnedActiveClioConversation`, when a caller transaction is passed.
- **Only `/current` passes one:** `application-authority.controller.ts:71`.
- **Every other caller is unchanged and keeps the three `FOR SHARE` reads:**
  - `/context` (`controller:134`);
  - read delegation (`read-delegation.service.ts:405`);
  - `meri.service.ts:1022`;
  - the direct `authorizeResearchPortfolioConversation` callers.

**3. The shared helper (#103) behaves exactly as the five copies did.**
- **Same formula:** `apps/api/src/auth/mounted-request-path.ts` holds the exact expression of the five copies, `(req.baseUrl ?? '') + (req.baseUrl && req.path === '/' ? '' : req.path)`.
- **One definition** (`git grep`). All seven classifiers import it: the control classifier, retained, history, execution, routine grant, read delegation, the three signed-memory gates, roster and preview route.
- **Each call site's comparison is unchanged,** so admit and refuse results are identical by construction.
- **One `req.path` use remains, and it is out of scope.** It is the middleware's pre-existing public-route bypass fallback (`tenant-context.middleware.ts:265`). It is unchanged since `8b23c65b`, already consults `originalUrl` and `baseUrl` through `isBypassPath`, and is not part of P6 or PR96.

**4. Y02 and Y06 will most likely still survive.** This is a prediction to confirm when the run is unblocked.
- **What the new tests do:**
  - "refuses a trailing-slash retained target rewritten to the canonical mount";
  - "refuses a trailing-slash history target rewritten…".

  Both rewrite `originalUrl` to `…/x/`, while Express's mounted path stays `…/x` (the tests assert `mounts[0]` is `{ baseUrl: path, path: '/', originalUrl: path + '/' }`).
- **What actually refuses them is the equality** (`parsed !== original` or `target !== path`), before the allowlist lookup.
- **Y02 and Y06 mutate only the lookup** after the equality passes, by stripping a trailing slash. So these tests still pass under both mutants.
- **What would kill them:** a request whose mounted path *and* raw target both end in `/`, so the equality holds and only the exact lookup refuses. For example `{ baseUrl: '', path: P + '/', originalUrl: P + '/' }` through `TenantContextMiddleware.use` with a retained `Capiro…` scheme, the way `tenant-context.meri-control.spec` builds root-mounted requests. The same is needed for the history leaf.
- **The code itself is still correct.** The unmutated lookups are exact. This is the same test gap as F3, not a defect.

**5. N2 and N4 are intact.**
- **#102** since `05d95139` touches only the controller's import and port lines. These are unchanged:
  - the `catch` block;
  - `clerk.service.ts`;
  - the identity, bizdev and context-security owners;
  - `research-portfolio-artifact-authority.ts`.
- **#103's own commits** touch none of those files.

## Provisional verdicts (static)

| PR | Provisional verdict | What decides it |
| --- | --- | --- |
| **#102 @ `946511a7`** | **APPROVE** | F1 is resolved by removal, with no residue, and nothing else changed. The mutant re-run (48) should confirm it |
| **#103 @ `43a03ada`** | **APPROVE**, with F3 still open as a test gap | The new tests don't reach the lookups (§4 above). If the run confirms Y02 and Y06 survive, adding the two root-mounted trailed cases closes F3. That is a test-only follow-up, not a code defect |

## Proposed cases that should kill Y02 and Y06 (for agent 2; pending verification)

**Both cases use a root-mounted request** (`baseUrl: ''`). There Express's path and the raw target are both trailed, so the path-equality check passes, and only the exact lookup that Y02 and Y06 weaken can refuse the request.

**1. Retained.** Append to `apps/api/src/tenant/tenant-context.authority-mount.spec.ts`. It reuses that file's `retained` list and existing imports:

```ts
describe('root-mounted trailed retained targets (F3)', () => {
  it.each(retained)('refuses root-mounted trailing-slash retained target %s before its receiver', async (target, scheme) => {
    const prior = process.env.RETAINED_READS_ENABLED;
    process.env.RETAINED_READS_ENABLED = 'true';
    try {
      const middleware = new TenantContextMiddleware(
        { verifySessionToken: jest.fn() } as never, { withSystem: jest.fn() } as never, { run: jest.fn() } as never);
      const headers: Record<string, string> = { authorization: `${scheme} synthetic` };
      const req = { method: 'POST', baseUrl: '', path: `${target}/`, originalUrl: `${target}/`, url: `${target}/`,
        headers, header: (name: string) => headers[name.toLowerCase()] } as unknown as Request;
      const next = jest.fn();
      await expect(middleware.use(req, { setHeader() {} } as unknown as Response, next)).rejects.toMatchObject({ status: 401 });
      expect(next).not.toHaveBeenCalled();
    } finally {
      if (prior === undefined) delete process.env.RETAINED_READS_ENABLED; else process.env.RETAINED_READS_ENABLED = prior;
    }
  });
});
```

**2. History.** Append to `apps/api/src/tenant/tenant-context.history-release-native.spec.ts`. It reuses that file's `fixture`, `authenticate` and `path`:

```ts
describe('root-mounted trailed history target (F3)', () => {
  it('refuses a root-mounted trailing-slash history target before any lock or online read', async () => {
    const h = fixture();
    const ctx = await authenticate(h);
    Object.assign(h.req, { path: `${path}/`, originalUrl: `${path}/`, url: `${path}/` });
    await expect(h.middleware.lockOriginalApplicationAuthorityInTransaction(h.req, ctx, h.tx)).rejects.toMatchObject({ status: 403 });
    await expect(h.middleware.readFreshApplicationAuthorityInTransaction(h.req, ctx, h.tx)).rejects.toMatchObject({ status: 403 });
    expect(h.queries).toHaveLength(0);
    expect(h.active).not.toHaveBeenCalled();
  });
});
```

**How the run will check them.** `run3.sh` adds both cases to my scratch copy of `43a03ada` (`f3-cases.cjs`, never pushed). The mutation baseline must pass with them on the real code, and then Y02 and Y06 are re-run against them (`mutants-f3.cjs`).

## Final results (run 2026-10-21, after Neo freed the host's memory) [R]

**Setup:**
- one Node test container at a time (`node:22.23.3-alpine3.24`, pnpm 9.12.0 frozen), each spec file run alone with `--runInBand`;
- a `pgvector/pgvector:pg16` sidecar shares the container's network namespace. The PR's real-PostgreSQL spec needs it at `127.0.0.1`;
- each archive was copied with `dd`, and its size and listing verified, before use.

### #102 @ `946511a7`

**Specs:**

| Spec | Result |
| --- | --- |
| `application-authority-current` | 60/60 |
| `application-authority-current.postgres` | **10/10, ran, not skipped** |
| `capiro-throttler.guard` | 22/22 |
| `clerk-session-cache` | 79/79 |
| `clerk-session-cache-callers` | 7/7 |
| `clerk-control-credential` | 18/18 |
| `tenant-context.meri-control` | 32/32 |
| `application-authority-artifact` | 7/7 |
| `read-delegation` | 40/40 |
| `portfolio-layout.controller` | 26/26 |

The failing test names are **identical to base `8b23c65b`**: boundary 1, authority 11, retained-native 12, and the membership suite-load failure.

**Mutants: 46 of 48 killed.** The baseline passes (221 tests).
- **Killed:** the full K, T, C, N2, N4, R1-R3 and X sets.
- **Also killed: RM1** (the parser accepts `clientId: null` again). The spec's null-selector 400 cases catch it.
- **RM2 survived, as predicted: it is an equivalent mutant.** It makes the selector key optional in `closedBody`, but a missing selector is still `undefined`, fails the UUID-string check and gets the same 400.
- **RM3 was not applied.** Its fragment occurs twice, in `/current` and in `/context`'s reader. It was predicted equivalent anyway: `assertCurrentConversation` already requires `conversation.clientId === input.clientId`, which is a UUID.
- **No real survivor.**

### #103 @ `43a03ada` (stacked on #102)

**Specs:**

| Spec | Result |
| --- | --- |
| `mounted-authority-request` | 12/12 |
| `tenant-context.authority-mount` | 27/27, including the 5 new trailing-slash rewrite cases |
| `tenant-context.history-release-native` | 3/3 |
| `preview-native-read-mode` | 41/41 |
| `read-delegation` | 40/40 |
| `meri-execution-flow` | 19/19 |
| `meri-routine-firing` | 19/19 |
| `tenant-context.meri-control` | 32/32 |
| `application-authority-current` | 60/60 |
| `application-authority-current.postgres` | 10/10 |

No failure appears that isn't in base.

**Mutants as shipped: 19 of 21 killed.** The baseline passes (193 tests).
- **Killed:**
  - Y01, Y03-Y05 and Y07-Y19;
  - three new mutants on the shared helper: Y19 (keeps a mount's trailing `/`), Y20 (uses `req.path` only) and Y21 (returns the raw target, which makes the equality vacuous).
- **Y02 and Y06 SURVIVED,** as §4 above predicted. The new rewrite tests are refused by the path-equality check, before the lookups these two mutants weaken.

**With the two proposed root-mounted cases added** (scratch copy only, never pushed):
- **The baseline passes** (47/47), so the cases hold on the real code.
- **Y02+F3 is KILLED:** all 4 retained cases fail under the mutant.
- **Y06+F3 is KILLED:** the history case fails under the mutant.

## Final verdicts

| PR | Verdict | Change list |
| --- | --- | --- |
| **#102 @ `946511a7`** | **APPROVE** | None |
| **#103 @ `43a03ada`** | **CHANGES (test-only)**. The code is correct and no classifier is widened. The only change: add the two root-mounted trailed-target cases above, which I verified pass on the real code and kill Y02 and Y06. | 1. Add the retained case to `tenant-context.authority-mount.spec.ts`. 2. Add the history case to `tenant-context.history-release-native.spec.ts`. No source change. |

**Merge order:** #102 first. #103 is stacked on it.

## Evidence

`P6-CORE-VALIDATION-security-evidence/final/`:
- `scripts/`:
  - `run3.sh` and `in2.sh`;
  - `mutants-102b.cjs` and `mutants-103b.cjs`;
  - `f3-cases.cjs` (the proposed cases) and `mutants-f3.cjs`;
  - `compare3.sh`.
- `logs/`: `p102b/` and `p103b/`, each with steps, per-spec Jest JSON, `mut/` per-mutant logs, and `p103b/mut-f3/`.

**Cleanup:** my containers, volume, archives and WSL working folders are removed.

---

# #103 last check: `81b1d05a` on `backend-import` @ `aacaba68` (2026-10-21)

adj-b-transport. Verdict only: no edits, no GitHub comments, no AWS calls.

**State checked:**
- #102 is merged: `backend-import` = `aacaba68`.
- #103 is now based on `backend-import` (merge-base `946511a7`), with head **`81b1d05a`** ("Test root-mounted trailing-slash authority denials").

## Verdict: **APPROVE**

**1. The diff is test-only, and matches the proposed cases** [R]:
- **Size:** `43a03ada..81b1d05a` is one commit, +38 lines, touching only:
  - `apps/api/src/tenant/tenant-context.authority-mount.spec.ts` (+24);
  - `apps/api/src/tenant/tenant-context.history-release-native.spec.ts` (+14).

  No source file changes.
- **Retained case.** For each `retained` target, the request is root-mounted (`baseUrl: ''`) with the path and raw target both trailed, and `RETAINED_READS_ENABLED=true` is set and restored. It expects 401 with `next` never called. That matches my proposal; the only differences are an inert `{}` Clerk/Prisma and a real `TenantContextStore`.
- **History case.** It is the same as my proposal: a root-mounted trailed path and target, 403 from both `lockOriginalApplicationAuthorityInTransaction` and `readFreshApplicationAuthorityInTransaction`, no queries, and no online check.

**2. The specs pass on the merged tree** [R]:
- **The merged tree:** `git merge-tree --write-tree aacaba68 81b1d05a` gives `c9293cfc`, a clean merge whose tree is identical to `81b1d05a`'s.
- **Setup:** `node:22.23.3-alpine3.24`, one Node test container, each file run alone with `--runInBand`.

| Spec | Result |
| --- | --- |
| `tenant-context.authority-mount` | **31/31**, including the 4 new retained cases |
| `tenant-context.history-release-native` | **4/4**, including the new history case |
| `mounted-authority-request` | 12/12 |
| `preview-native-read-mode` | 41/41 |
| `read-delegation` | 40/40 |
| `meri-execution-flow` | 19/19 |
| `meri-routine-firing` | 19/19 |
| `tenant-context.meri-control` | 32/32 |
| `application-authority-current` | 60/60 |
| `application-authority-current.postgres` | 10/10, on the `pg16` sidecar |

**3. Mutants: 21 of 21 killed. There are no survivors** [R]. The baseline passes (198 tests).
- **Y02** (the retained classifier accepts a trailing slash) is **KILLED** by 4 failing tests.
- **Y06** (the history-release check accepts a trailing slash) is **KILLED** by 1 failing test.
- **The three shared-helper mutants are all killed:**
  - Y19 (keeps a mount's trailing `/`): 30 failing tests;
  - Y20 (uses `req.path` only): 31;
  - Y21 (returns the raw target, which makes the equality vacuous): 1.
- **Every other classifier mutant (Y01, Y03-Y05, Y07-Y18) is killed.**

**F3 is closed.** #103 is approved for merge.

**Evidence:** `P6-CORE-VALIDATION-security-evidence/last/`:
- `scripts/run4.sh`;
- `p103c/`: steps, per-spec Jest JSON, and `mut/` with per-mutant logs and `mutants.txt`;
- the console log.

My containers, volume, archive and WSL folders are removed.
