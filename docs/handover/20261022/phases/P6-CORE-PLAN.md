# P6-Core: Core-side authority changes for the Meri hot path (implementation plan)

> **Historical phase plan.** This dated source/evidence is retained for lineage. Current work follows the [approved Runtime V1 migration](../plan/AGENTCORE-RUNTIME-MIGRATION-20261024.md) and [standing requirements](../STANDING-REQUIREMENTS.md). Keep applicable canonical Core and telemetry behavior; do not execute obsolete per-turn Fargate, model-proxy, proof-reuse or warm-pool instructions. Root assigns current files and qualification.


**Repository:** `capiro-backend`. You need GitHub access and a Linux box with Docker. **You never need AWS, and must not use it.**

**What you deliver:** one pull request into `backend-import`. The Meri shipper reviews it, sends it to an **independent security review** (required: this is change-controlled auth code), merges it, deploys it to preview and validates it live (§6, §9).

**Companion documents** (in this repository, `docs/hot-path/`):
- `ADR-HOT-PATH-REDESIGN.md`: the accepted design. §2.2 covers the authority lease; §2.6 lists the Core changes K1-K4.
- `adj-g-CORE-SIDE-DESIGN.md`: the Core design this plan implements (G §1 K1, §2 K2, §3 file list, §5 numbers, §6 risks).
- `CONSOLIDATION-CORE.md`: how `backend-import` was assembled. §3 covers the 503 fix and §5 the K1/K2 consistency notes.

**Approval status:** this work is approved under decision O55, recorded in ADR §7.4:
- K1: approved;
- K2: approved as a positive-only cache keyed by session, 5 s TTL, with 503 kept;
- K3: approved;
- K4 (the ALB rule): the shipper does it at cut-over.

The files carry a `⛔ CHANGE-CONTROL` header. **Leave the headers in place.** The approval covers exactly the scope below; anything beyond it needs a new approval.

## 0. Orientation (read first, about 15 min)

**Who calls this:**
- **Meri** (a separate service) asks Core "is this user still allowed to do this?" through three routes under `apps/api/src/auth/`:
  - `POST /api/clio/application-authority/identity`: `ApplicationAuthorityController.applicationAuthorityIdentity`;
  - `POST …/context`: `applicationAuthorityContext`;
  - `POST …/membership`: `ApplicationMembershipController` / `ApplicationMembershipService.read`.
- **Each answer is a receipt** carrying content-hash revisions (`identityRevision`, `membershipRevision`, `contextRevision`) and `checkedAtMs`/`expiresAtMs`.
- **Two credential kinds** reach these routes:
  - **the browser's native Clerk session JWT** (has a `sid`);
  - **Meri's control credential:** a marked Clerk template token, `meri_control_credential: true`, with no `sid`. `isMeriControlAuthorityPost`, `tenant-context.middleware.ts:~86-95`, admits it only on those three POSTs.

**How a check works today** (`tenant-context.middleware.ts`, `readApplicationAuthority`, about lines 710-722):
1. **One online Clerk read:**
   - `ClerkService.assertActiveApplicationAuthoritySession` (`clerk.service.ts:~130-175`, `client.sessions.getSession(sid)`) for a native session;
   - `assertActiveMeriControlCredentialSession` (`:~180-225`, `client.sessions.getSessionList({userId, status:'active'})`) for the control credential.
   - Each has its own 2 s deadline.
2. **Then local checks:** `readCurrentApplicationAuthority` (`:~806-882`) reads user, membership, tenant and impersonation rows. It already accepts an optional caller transaction.
3. **The routes repeat this:**
   - `/context` (`application-authority.ts` `readApplicationAuthorityContext`, about lines 135-185) reads identity twice plus a recheck;
   - `/membership` (`application-membership.service.ts` `readWith`) reads identity twice plus a recheck, and takes three snapshots.

**The cost** (G §0, §5): a Meri "session resolve" = identity + membership + context + membership ≈ **7 online Clerk reads**. A median Meri first turn makes ≈ **224 Core calls ≈ 370-390 Clerk reads**. Every Clerk read is a network call with a 2 s timeout, and a slow Clerk was the cause of a class of failed turns.

**The 503 rule** (commit `8a23d6d7`, merged into `backend-import` by the step-3 PR, see §10):
- When Clerk does not answer (timeout, transport error, 429/5xx), the online checks throw `ApplicationAuthorityUnavailableException` (`apps/api/src/auth/application-authority-unavailable.ts`, a `ServiceUnavailableException`). It reaches the client as **503**, which Meri may retry.
- An answered refusal stays **401/403**.
- **Every change in this plan must keep that rule.**

**Other callers of the Clerk check** inherit K2 and must be covered by its tests. Both go through `TenantContextMiddleware.readApplicationAuthority`:
- `PortfolioLayoutController.operate` (`apps/api/src/users/portfolio-layout.controller.ts:~35`);
- `ObjectiveWorkService.proof` (`apps/api/src/clients/objectives/work/objective-work.service.ts:~94`).

**The throttler** (`apps/api/src/app.module.ts:~92-95,161`) is a global `ThrottlerGuard` with `short` 30 per 1 s and `long` 600 per 60 s, keyed by the default tracker (`req.ip`). Behind the shared ALB, with no `trust proxy`, every Meri request shares one key per ALB node.

## 1. Goals and the numbers

| Item | Today | After this PR alone (Meri unchanged) | After Meri's P6 also ships (uses `current` + the lease) |
| --- | --- | --- | --- |
| Clerk reads per session resolve | 7 | **≈ 1 per 5 s per session** (K2 cache; repeated checks inside 5 s hit) | — |
| Clerk reads per median Meri first turn | ≈ 370-390 [G §0] | ≈ 15-30 [D: one read per (session or credential, 5 s window)] | **≈ 2-10** [G §5] |
| Core authority calls per turn | ≈ 224 (runner) + Send + stream | unchanged (Meri still calls the 3 routes) | **≈ 6-10**: 1 combined check at Send, 1 at lease issue, renewals every 15 s [ADR §2.2, G §5] |
| Core calls per authority check | identity 1, context ≥ 2 identity reads, membership 2 + 3 snapshots | the same calls, with Clerk hits | **`current`: 1 Clerk read + 1 consistent DB snapshot** |
| A Clerk sign-out or revocation visible to Core | at the next call | ≤ 5 s per Core task (K2) | ≤ 5 s + Meri's ≤ 30 s renewal [ADR §4] |
| Membership, role, tenant, conversation or client changes visible to Core | at the next call | **unchanged: read from the DB on every call** | unchanged |
| Throttling of Meri control traffic | shared per ALB node | **per verified user** on authority routes (K3) | — |

**Correctness goals:**
- (a) no refused, unanswered or malformed Clerk result is ever cached;
- (b) the 503 rule holds on every path, cached or not;
- (c) cache keys never let one session's or credential's proof serve another;
- (d) `current`'s revisions equal those the three existing routes compute for the same state, so Meri can compare them;
- (e) the existing three routes keep their exact behaviour apart from caching.

## 2. Design

### 2.1 K2: the Clerk verified-session cache (`apps/api/src/auth/clerk.service.ts`)

A per-process cache inside `ClerkService`, used by **both** `assertActiveApplicationAuthoritySession` and `assertActiveMeriControlCredentialSession`.

| Rule | Exact behaviour |
| --- | --- |
| **What is cached** | Only a **positive** result: the `ActiveApplicationAuthoritySession` each method already returns after all its checks pass (user match, `active`, timestamps, `expiresAtMs > now`). Store a frozen copy, and return a fresh frozen copy on every hit. |
| **What is never cached** | Every throw: 401 `UnauthorizedException`, `ApplicationAuthorityUnavailableException` (503), a deadline miss, a malformed list, an exception from the SDK. Nothing is stored on any non-success path. |
| **Key, native** | `native:${sid}:${sub}`, from the already-validated claims (each method's existing regex pre-checks run **before** the lookup, every time, hit or miss). |
| **Key, control credential** | `control:${jti}:${sub}:${iat}:${exp}`. The control credential's online read is by user (`getSessionList`), so the key pins the specific credential instance (CONSOLIDATION-CORE §5 c). `isWellFormedMeriControlCredentialClaims` runs before every lookup. |
| **TTL** | An entry is valid while `now < min(storedAtMs + 5000, cached.expiresAtMs)`. **5000 ms is a constant**, not configuration. A hit re-checks `cached.expiresAtMs > now`, and the claims' `exp` (already in the pre-checks). |
| **Single-flight** | One in-flight promise per key. Concurrent callers for the same key await the leader's promise. They get the leader's result or the leader's **same** rejection (401 or 503). Nothing is cached on rejection, and the in-flight entry is removed in `finally`. A follower never starts a second Clerk call. |
| **Deadline** | The existing 2 s per online read stays. A follower inherits the leader's remaining time, never more. |
| **Bounds** | At most 10,000 entries. On insert, drop expired entries; if still full, drop the oldest insertion. No timers (`setInterval`) and no background refresh. |
| **Tenant isolation** | The cached fact is "this Clerk session or credential is currently active for this user". It is not a tenant, membership, role or conversation fact. Every caller still runs `readCurrentApplicationAuthority` (DB) and the route's own checks on every call, so a hit **never** skips a tenant or membership check. A different `sub` with the same `sid` is a different key, and therefore a miss. |
| **Observability** | Once per 60 s, if any traffic occurred, one structured log line, the same style as the middleware's existing `auth.denied` line: `{"event":"auth.clerk_session_cache","hits":n,"misses":n,"joins":n,"refused":n,"unavailable":n,"entries":n}`. **No sid, sub, jti or token** in it. |
| **Comments** | Update the docstring of `assertActiveMeriControlCredentialSession` ("No positive proof is cached across calls or requests") to describe the 5 s positive cache exactly. |

**Out of K2:** `verifySessionToken` (JWT verification) is already local and JWKS-cached by the SDK; don't change it.

### 2.2 K1: `POST /api/clio/application-authority/current`

**One combined, consistent check:** one Clerk read plus one read-only database snapshot. It returns everything Meri's three calls return today. **Nothing calls it until Meri's P6.** The existing three routes stay unchanged.

**Request** (closed body, ≤ 4096 bytes, unknown keys refused with 400 as the siblings do):

```json
{"conversationId":"<uuid>","clientId":"<uuid>","expect":{"identityRevision":"<hash>","membershipRevision":"<hash>","contextRevision":"<hash>"}}
```

`expect` is optional. It may hold any subset of the three keys, and each value must match the existing revision hash format. Add `parseApplicationAuthorityCurrentBody` next to `parseApplicationAuthorityContextBody` in `application-authority.ts`.

**Response 200:** one receipt with every field from one snapshot:

```json
{
  "principal":{"tenantId":"…","actorId":"…"},
  "role":"…","permissions":["…"],"clientIds":["…"],
  "identityRevision":"…","membershipRevision":"…","contextRevision":"…",
  "conversationId":"…","selectedClientId":"…",
  "checkedAtMs":0,"expiresAtMs":0
}
```

- `role`, `permissions`, `clientIds` and `membershipRevision` are computed **exactly** as `ApplicationMembershipService.readWith` computes them (`applicationMembershipPermissions`, `applicationMembershipRevision`).
- `identityRevision` is exactly as `readCurrentApplicationAuthority` computes it.
- `contextRevision` is exactly as `readApplicationAuthorityContext` computes it: `applicationAuthorityRevision('context', [identityRevision, conversation facts, conversationScope, client])`.
- `expiresAtMs` = `min(session.expiresAtMs, impersonation expiry if any, checkedAtMs + 120000)`.
- **Reuse the existing revision functions.** Don't duplicate them.

**The flow:**
1. **Body and authorization.** Parse the body. `RolesGuard` + `standard_user`, as the siblings.
2. **One online session read.** Factor the first half of `readApplicationAuthority` into a middleware method, e.g. `readApplicationAuthoritySession(req, ctx)`: provenance check, then `assertActiveApplicationAuthoritySession` or `assertActiveMeriControlCredentialSession`. It goes through the K2 cache. **Do this before opening the transaction:** never hold a DB transaction across a network call.
3. **One transaction, `REPEATABLE READ` and `READ ONLY`,** on one connection. Prisma: `$transaction(fn, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead })`, with `SET TRANSACTION READ ONLY` as the first statement. The precedents are `federal-register.service.ts:~102,237` and the middleware's history-release methods (`lockOriginalApplicationAuthorityInTransaction`, `readFreshApplicationAuthorityInTransaction`: "caller owns the one REPEATABLE READ transaction"). Add optional `isolationLevel` and `readOnly` options to `PrismaService.withTenant` (and `withSystem` if you use it) in `apps/api/src/prisma/prisma.service.ts`. Inside it:
   - (a) the identity facts: `readCurrentApplicationAuthority(provenance, ctx, session, tx)`;
   - (b) the membership snapshot: factor `ApplicationMembershipService.snapshot`'s body into a method that takes the caller's `tx`, with no second identity read and no triple compare;
   - (c) the owned active conversation: `loadOwnedActiveClioConversation` (`application-authority-resource.helpers.ts`), extended to accept `tx`;
   - (d) the conversation scope: `authorizeMeriProspectScope` / `BizDevMeriScopeService`. **Verify** it can take `tx`. If threading `tx` there needs changes beyond those helpers, stop and report it in the PR, and don't widen scope silently;
   - (e) client visibility: `assertCurrentClientVisible`, with `tx`;
   - (f) client authority: `ContextSecurityScopeService.resolveApplicationAuthorityClient` (`context-security-scope.service.ts`), with `tx`.
4. **Compute the receipt.** If `expect` is present and any supplied revision differs, answer **409** `{"error":"CHANGED"}`. Otherwise answer 200 with the receipt.
5. **Errors:**
   - `ApplicationAuthorityUnavailableException` passes through as **503**. Do **not** wrap it in a catch-all 403; the 503 fix had to correct exactly that in `/context`.
   - Every other refusal is **403** `Application authority unavailable` (401 for authentication failures, as the middleware already does).
   - A conflict is 409.

**Inside one consistent snapshot, the "read, re-read, compare" loops of the old routes are unnecessary.** They existed because those reads were separate statements. **Do not remove them from the old routes**; those stay as they are.

**The control credential:**
- **Allowlist:** add `/clio/application-authority/current` to `MERI_CONTROL_POST_PATHS` (`tenant-context.middleware.ts`, read by `isMeriControlAuthorityPost`). Meri renews its lease with the control credential (ADR §2.2). Update the comment there ("exactly three authority POST uses" becomes four).
- **Docs and specs:** update every document or spec that pins the list of three. Search the tree with `git grep -n "identity|context|membership"` restricted to `apps/api/src/auth` and `apps/api/src/tenant`.
- **Wiring:** `ApplicationAuthorityModule` (`application-authority.module.ts`) must provide whatever the controller now needs, for example `ApplicationMembershipService`, which is already a provider.

**Overlaps not to touch here** (CONSOLIDATION-CORE §5 d): `/artifact` and `read-mode-observation` make their own Clerk read. K2's cache already makes those cheap. Restructuring them is a follow-up, not this PR.

### 2.3 K3: throttler key for authority routes (`apps/api/src/app.module.ts`)

**The guard:** replace the global `ThrottlerGuard` provider with a subclass, e.g. `CapiroThrottlerGuard` in `apps/api/src/auth/capiro-throttler.guard.ts`, that overrides `getTracker(req)`. Verify the exact signature in the installed `@nestjs/throttler` version, usually `protected async getTracker(req: Record<string, any>): Promise<string>`.

**The tracker:**
- **On `POST /api/clio/application-authority/{identity,context,membership,current}`** where the tenant middleware recorded provenance: tracker `authority-user:${claims.sub}`.
  - **The middleware runs before guards in Nest. Verify this with a test.**
  - Export one small helper from `tenant-context.middleware.ts`, e.g. `applicationAuthorityThrottleKey(req): string | null`, that reads the module-private `applicationAuthorityRequests` WeakMap and returns the key or `null`.
- **Every other request:** unchanged, `super.getTracker(req)`.

**Limits:** the existing `short` and `long` throttlers now apply **per user** on those routes. No new limit values.

**Explicitly not in K3:** `trust proxy`, a global key change, and limits for any other route.

## 3. File-by-file change list

All paths are under `apps/api/src/`. Every AUTH file keeps its change-control header.

| File | Change | AUTH |
| --- | --- | --- |
| `auth/clerk.service.ts` | K2: the cache and single-flight around both online checks; the per-minute aggregate log line; the docstring update | **AUTH** |
| `auth/application-authority.controller.ts` | K1: `@Post('current')` with the same decorators (`HttpCode(200)`, `Cache-Control: no-store`, JSON content type) | **AUTH** |
| `auth/application-authority.ts` | K1: the closed body parser; the combined receipt builder (reusing the revision functions) | **AUTH** |
| `auth/application-membership.service.ts` | K1: a snapshot method that runs inside a caller `tx` (`readWith`/`read` stay unchanged for the old route) | **AUTH** |
| `tenant/tenant-context.middleware.ts` | K1: `readApplicationAuthoritySession(req, ctx)` (the online-read half of `readApplicationAuthority`), `current` in `MERI_CONTROL_POST_PATHS`. K3: `applicationAuthorityThrottleKey(req)` | **AUTH** |
| `context/application-authority-resource.helpers.ts`, `context/context-security-scope.service.ts` | K1: accept an optional `tx` (authorization decisions; behaviour unchanged without one) | **AUTH** |
| `business-development/bizdev-meri-scope.authorization.ts` / `bizdev-meri-scope.service.ts` | K1: an optional `tx`, **only if** needed for §2.2 step 3(d). Report it in the PR | **AUTH (if touched)** |
| `auth/application-authority.module.ts` | K1 wiring | **AUTH** |
| `prisma/prisma.service.ts` | Optional `isolationLevel` and `readOnly` for `withTenant` (and `withSystem` if used) | review |
| `auth/capiro-throttler.guard.ts` (new), `app.module.ts` | K3 | review (rate-limit policy) |
| Specs (next section) | new and updated | tests |

**No migrations, no schema change, no new environment variable, no new dependency.**

## 4. Tests

Use the existing jest setup and the existing specs' fakes for Clerk (`clerk.client.sessions.getSession`/`getSessionList` stubs) and Prisma. Inject a clock where the code already does, or use `jest.useFakeTimers()` with `Date.now` mocked. Name the new specs so they run in the `src/auth` and `src/tenant` sets.

### K2 (`auth/clerk-session-cache.spec.ts`, new; plus updates to `clerk-control-credential.spec.ts`)

1. **Positive hit:** two checks with the same native claims within 5 s → one `getSession` call; both results deep-equal and frozen. The same for the control credential with `getSessionList`.
2. **TTL:** a hit at `t+4999 ms`; at `t+5000 ms` a new Clerk call.
3. **Revoked session not served beyond 5 s:**
   - the first call is active; Clerk then reports the session `revoked`/`ended`;
   - a check at `t+4.9 s` is served from cache (documented, accepted);
   - a check at `t+5.0 s` calls Clerk and **throws 401**;
   - the following check calls Clerk again, which proves the refusal was not cached.
4. **Expiry inside the TTL:** if `cached.expiresAtMs` (session `expireAt`/`abandonAt`/JWT `exp`) passes before 5 s, the next check is a miss and is refused per the existing logic.
5. **No negative caching, for each of:**
   - 401 from an inactive session;
   - user mismatch;
   - malformed timestamps;
   - `getSessionList` returning no live session;
   - a timeout or SDK error (503).

   In each case, a second identical check makes a second Clerk call.
6. **503 semantics:** a Clerk timeout or transport/429/5xx on a miss still throws `ApplicationAuthorityUnavailableException` (503), exactly as before. Single-flight followers of a failing leader all receive 503, and the next check calls Clerk again.
7. **Single-flight:** N concurrent checks for one key make exactly one Clerk call. A follower that arrives after the leader settles makes a new call (or hits, if the leader succeeded).
8. **Key isolation:**
   - the same `sid` with a different `sub` → separate keys; the second is a miss, and Clerk's `userId` mismatch → 401;
   - a different `jti` for the same user → separate control-credential keys;
   - a native key never collides with a control key.
9. **Tenant isolation:** with a cache hit, `TenantContextMiddleware.readApplicationAuthority` still runs its DB checks. Make membership inactive between two calls inside 5 s: the second call is **refused 403**, with the Clerk cache hit and the DB check refusing. Repeat through both other callers (`PortfolioLayoutController.operate`, `ObjectiveWorkService.proof`) via their existing spec fakes.
10. **Bounds:** past 10,000 entries the oldest is evicted, and the size never exceeds the bound.
11. **The log line:** it contains only the counter keys. Assert no `sid`, `sub`, `jti` or token substring appears for test values seeded with recognisable markers.

### K1 (`auth/application-authority-current.spec.ts`, new; and the boundary spec)

1. **Shape and equivalence:** for one fixture state, `current`'s `identityRevision` equals `/identity`'s, its `membershipRevision`, `role`, `permissions` and `clientIds` equal `/membership`'s, and its `contextRevision` equals `/context`'s.
2. **One Clerk read** per `current` call (count the stub calls), and **one** transaction, opened with `RepeatableRead` and `READ ONLY`. Assert the isolation option and the first statement.
3. **`expect`:** a matching subset gives 200. Any mismatch gives **409**, and nothing is written.
4. **503:** a Clerk timeout gives **503**, not 403 or 401.
5. **Refusals → 403:**
   - an archived conversation, or one owned by another user;
   - a client not visible;
   - membership inactive;
   - a tenant mismatch;
   - impersonation expired.
6. **Body:** unknown keys, a bad UUID, a bad hash, an oversize body → 400.
7. **The control credential:**
   - admitted on `current`;
   - **still refused** on every non-allowlisted route;
   - the allowlist test now lists exactly four paths. Update `tenant-context.meri-control.spec.ts`.
8. **The old routes are unchanged:** the existing `application-authority.spec.ts`, `application-membership.spec.ts`, `application-authority-boundary.spec.ts` and `application-authority.module.spec.ts` pass. Only add expectations for `current`; don't weaken any assertion.

### K3 (`auth/capiro-throttler.guard.spec.ts`, new)

1. **Authority routes are keyed by user:** two different users from one IP get separate buckets.
2. **Other routes are unchanged:** a non-authority route stays keyed by IP.
3. **The 31st request in 1 s** from one user on an authority route gives 429. Another user is unaffected.
4. **A request without provenance** falls back to the IP key.

### Regression sets (must show no new failures vs the base commit; §13)

- `src/auth`, `src/tenant`, `src/bootstrap`, `src/config`, `src/meri`, `src/users`, `src/clients/objectives`, `src/context`, `src/business-development`;
- the full `apps/api` `tsc --noEmit` typecheck;
- `nest build` for `api`.

## 5. Security requirements (the reviewer checks these)

- **Positive-only caching.** Prove it with the tests in §4 K2 items 5-6.
- **No cache key shared** across sessions, credentials, users or credential kinds.
- **No tenant, membership, role, conversation or client fact is cached.**
- **The 503 rule is preserved on every path, including `current`.**
- **The control credential** gains exactly one route (`current`).
- **The receipt revisions are computed by the existing functions:** no new hashing.
- **No secret, token, sid, sub or jti** appears in any log.

**Request an independent security review in the PR description.** Point it at this section, ADR §4, and G §6 risks 1-9.

## 6. Acceptance criteria (the shipper checks these on preview after deploy)

1. **`current` answers 200**, with a receipt whose revisions equal the three existing routes' for the same user and conversation. It is exercised with a Meri test credential, once the shipper has added the ALB rule (K4).
2. **The existing three routes behave exactly as before.** Meri's first-chat flow completes, with no new 401/403.
3. **The K2 log line on preview** shows hits much greater than misses during a Meri turn (≥ 80 % hits during a two-turn chat), and `refused`/`unavailable` counted separately.
4. **Revocation:** sign out a test session, and Core refuses it within ≤ 5 s on every Core task (check two tasks if more than one runs).
5. **A forced Clerk slowness** (if the shipper can simulate it) still gives 503 and a retryable turn.
6. **K3:** Meri's control traffic is no longer limited per ALB node. No 429 during a normal two-turn chat.

## 7. Out of scope

- **K4** (the ALB rule on `capiro-prod-alb`): the shipper does it at cut-over.
- **Any Meri-side change:** the lease, using `current`, or contract files in meri-greenfield.
- **A Core-signed pass, Clerk webhooks, or a revocation push:** not adopted (ADR §7.6).
- **Restructuring `/artifact` or `read-mode-observation`:** a follow-up.
- **`trust proxy` or global throttling changes.**
- **Any migration.**

## 8. Rollback

- **Redeploy the previous Core image.** No data changes, no migrations.
- **`current` is unused until Meri's P6,** so removing it has no effect.
- **The cache is in-process and disappears with the old image.**

## 9. Validation checklist (the shipper)

- [ ] **The diff touches only §3's files.** Change-control headers are intact. No new env vars, migrations or dependencies.
- [ ] **K2 code review:**
  - caching happens only after all checks pass;
  - nothing is cached in any `catch`;
  - the in-flight entry is removed in `finally`;
  - the bound is enforced;
  - frozen copies are returned.
- [ ] **K1 code review:**
  - one Clerk read before the transaction;
  - one `RepeatableRead` + `READ ONLY` transaction;
  - 503 passes through;
  - the revision functions are reused;
  - the old routes are untouched.
- [ ] **K3 code review:** only authority routes change their tracker.
- [ ] **§4 tests present,** and the §4 regression sets show no new failures against the base (the PR description has the comparison table, see §13.5).
- [ ] **Independent security review:** approved.
- [ ] **Preview:** the image is built with the Core ship-kit path (`CONSOLIDATION-CORE.md` §6), deployed, and §6 items 1-6 checked. The K4 ALB rule is added by the shipper before item 1.

## 10. Base branch

- **Branch from `backend-import` after the step-3 PR** (D3's merge of the live 503 fix, `CONSOLIDATION-CORE.md` §6 step 3) has merged.
- **Before you start, check:**

  ```bash
  git fetch origin
  git merge-base --is-ancestor 0f5d7e15 origin/backend-import && echo "503 fix present"
  ```

  If it is not present, **wait**. K2 must preserve the 503 rule introduced there, and K1/K2 edit the same files the step-3 merge resolves (`clerk.service.ts`, `application-authority.controller.ts`; CONSOLIDATION-CORE §5 a).
- **File:line references** in this plan were taken at `backend-import` = `f4a238aa` (PR96 + PR97 merged), before step 3. **Re-locate every reference by its function or string on your head.** The step-3 merge changes `clerk.service.ts` (the 503 throws) and `application-authority.controller.ts` (the 503 pass-through in `/context` and possibly `/artifact`).
- **Branch name:** `feat/core-p6-authority-current`. One PR into `backend-import`.
- **The PR description includes:**
  - the §13 commands run and their results;
  - the failure comparison against the base commit;
  - a pointer to §5 for the security reviewer.

## 11. Effort

About **5-7 engineer-days:**

| Work | Days |
| --- | --- |
| K2 | 1.5 |
| K1, including the `tx` threading and the equivalence tests | 2.5-3.5 |
| K3 | 0.5 |
| Regression runs and the PR | 1 |

The security review is extra calendar time, not engineering time.

## 12. Parallel work and conflicts

- **Meri's P0** (telemetry, agent 1) is in another repository: no conflict.
- **Meri's P6** consumes `current`. It starts after this PR is deployed and K4 is applied.
- **Inside capiro-backend:** any other open PR touching the §3 AUTH files conflicts. Check `gh pr list` for PRs touching `apps/api/src/auth/` or `apps/api/src/tenant/` before you start, and rebase before opening.

## 13. Environment: a fresh Linux box

### 13.1 Install

```bash
# Node 22.x (apps/api/Dockerfile pins NODE_VERSION=22.23.3; engines: >=20.11.0) and pnpm 9.12.0 via corepack
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt-get install -y nodejs
sudo corepack enable && corepack prepare pnpm@9.12.0 --activate
git clone https://github.com/neo-capiro/capiro-backend.git && cd capiro-backend
git switch backend-import && git switch -c feat/core-p6-authority-current
pnpm install --frozen-lockfile
pnpm --filter @capiro/api prisma:generate
```

`apps/api/Dockerfile` pins its Node version through `NODE_VERSION` (`node:${NODE_VERSION}-bookworm-slim`; `22.23.3` at `f4a238aa`). Re-read it on your head and match its major version.

### 13.2 Build and typecheck

```bash
pnpm --filter @capiro/shared build 2>/dev/null || true   # if api imports a built workspace package; check apps/api/package.json deps
cd apps/api
npx nest build                  # the "build" script
npx tsc --noEmit --rootDir .    # the main typecheck; the full `pnpm typecheck` also runs ~15 project tsconfigs
```

**If the build complains about another workspace package,** build it with `pnpm --filter <name> build` (turbo: `pnpm build:backend` at the root builds the backend set).

### 13.3 Jest sets

Run from `apps/api`, sequentially, to avoid contention flakes:

```bash
node --experimental-vm-modules node_modules/jest/bin/jest.js --runInBand --forceExit src/auth src/tenant
node --experimental-vm-modules node_modules/jest/bin/jest.js --runInBand --forceExit src/bootstrap src/config src/meri src/context src/users src/clients/objectives src/business-development
```

**A failure that appears only under load:** re-run that one spec alone (`--runInBand <file>`) before treating it as real.

### 13.4 Postgres (only if a spec you touch needs a real database)

```bash
docker compose up -d postgres     # docker-compose.yml: pgvector/pgvector:pg16, user/password/db capiro
export DATABASE_URL=postgresql://capiro:capiro@localhost:5432/capiro
pnpm --filter @capiro/api prisma:migrate:dev   # local dev database only
```

- The K1, K2 and K3 specs in §4 are unit tests with Prisma and Clerk fakes and need no database. Prefer that.
- **Never run migrations** against anything but this local container.

### 13.5 Compare against the base

Run §13.2-§13.3 on the base commit, a clean worktree of `origin/backend-import`, and on your branch. In the PR, list every failing test with its base result. **"No new failure" is the bar.** Pre-existing failures are expected on this repository; record them, and don't fix them here.
