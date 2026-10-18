# Run-bound read delegation (RC1 option B): contract draft

| Field | Value |
|---|---|
| Status | **Draft, source design only.** No credential is minted, no route, table or key is created, and nothing is activated. |
| Draft owner | Reads lane (rt-reads), assigned by dot in PR #121 comment 6245899753 |
| Reviewers | Core integration owner: issuance, storage, revocation, middleware. R0: Meri runtime consumption. dot: contract. |
| Decisions needed | **Neo**: any change to `apps/api/src/tenant/tenant-context.middleware.ts` (change-control banner, lines 1–12); creating or enabling any persistent delegation; unattended read authority. **dot**: this contract. |
| Basis | Core #84 @ `f655d5f5`, Meri integration `497479c7`. Investigation: PR #121 comment 6245757066. Option A ack: 6245772555. Expiry fix: 6245911765. |

## 1. Why B exists, and what it is not

Option A relays the user's live action-session bearer. It is limited to that session's lifetime, at most 300 s after issue, and gives no reads to unattended runs (schedules, routines, the planner, long reads). B gives a run a Core-issued, run-bound authority to make **read-only** tool calls after the browser session has gone, and only within Core-recorded limits.

Non-goals:
- writes, intents, approvals or any tool with `sideEffect !== 'none'`;
- any route that is not listed in §4;
- replacing Meri's task admission, allocation or budget, which stay authoritative;
- any static or shared user token;
- refreshing a Clerk session on the user's behalf.

## 2. Existing owners reused (nothing new where one exists)

| Concern | Existing owner reused |
|---|---|
| Live user identity at issuance (attended) | `ClerkService.assertActiveApplicationAuthoritySession`: `sid` plus an online session check. The authority branch in `tenant-context.middleware.ts:515-527` |
| Membership, role, client visibility | `application-membership.service.ts` / the `application-authority/membership` receipt, which is what Meri's native-read owner already calls |
| Server-to-server identity | `ToolServiceSecretGuard` (`x-internal-service-secret`), and later the D7-3 workload issuer key if Core adopts it for reads |
| Consent, delegation, per-target token, proof use, current facts | The Objective workload pattern: `objective-consent-policy.ts` (policy id/revision, bounded duration), `objective-workload-issuance*.ts` (issuance record, decision record, proof-use record), `objective-workload-jwt.ts` (typed JWT bound to method, path and body), `objective-workload-current.ts` (current-facts read in the same transaction) |
| Read operation set | Retrieval catalog `retrieval-0.2/catalog.json`, canonical sha256 `f351ebad…`. Lane 2's 76 read operations (`familyReads()`), all `sideEffect: none`, `approvalBoundary: none` |
| Spend | Meri durable tool budget (`apps/gateway/budget/*`), which charges per operation from the run allocation |
| Run currentness | Meri task verifier, admitted-run owner and allocation (`read-task-verifier.mjs`, `admitted-run-owner.mjs`) |

## 3. Shape: delegation plus per-call read token

Two Core records and one short token, mirroring the Objective consent → delegation → per-target workload token pattern:

1. **Read delegation** (Core row, long-lived within limits). Created once per run (attended) or per scheduled occurrence (unattended, §9). Binds the scope (§5), the operation set (§4), the expiry (§6) and revocation (§7).
2. **Read token** (per call, short-lived). Issued by Core under a current delegation for **one** read request: method, path and body hash. It lives at most 60 s, is single use, and its `jti` is recorded.
3. **Use.** Meri presents the read token plus the service secret on that one request. Core verifies the token, re-reads the delegation as current, and resolves the tenant context from the delegation, never from a user bearer.

No user bearer is stored or used after issuance.

## 4. Operation, audience and path binding

- `audience`: `capiro:meri-native-read:v1` (new, read-only).
- `operationsDigest`: the canonical sha256 of the sorted `[{id, version}]` list the run may call. It must be a subset of the 76 lane 2 read operations and a subset of the run's Meri allocation `allowedOperations`. Core checks every entry against the pinned catalog `sideEffect: none` and `approvalBoundary: none`.
- **Allowed targets** (method POST only; empty query; exact path):

| Target | Condition |
|---|---|
| `/api/clio/tools/{name}` | `name` is the native id of an operation in `operationsDigest`. Core keeps an explicit read-name allowlist, because the tools controller also runs writes |
| `/api/clio/application-authority/read-mode-observation` | Only for the five mode operations (`MODE_READ_OPERATIONS`), and only with `operation` in `operationsDigest` |
| `/api/clio/clients/check-ref` | Only when an operation in `operationsDigest` takes a client reference |

- A read token names exactly one target and the sha256 of the exact request body. Any other method, path, query or body is refused (403). The retained-signed routes stay on their own `CapiroRetained` contract and are not covered by B.

## 5. Scope

| Field | Attended (run) | Unattended (occurrence) |
|---|---|---|
| `tenantId`, `actorId` (Core user), `membershipId` | required | required |
| `clientId` | the run's single selected client (Meri run scopes are exactly one client scope) | the routine's client |
| `conversationId`, `runId`, `attemptId`, `writerFence` | required | `runId`/`attemptId` of the occurrence's run |
| `scheduleId`, `occurrenceId`, `consentId` | — | required (§9) |
| `policyRevision` | required, strict equality at every use | same |
| `allocationSha256` | the Meri allocation the run was admitted under | same |

A delegation never widens: no wildcard client, no tenant-only scope, and no second actor. Impersonation headers are refused, as on the authority branch.

## 6. Expiry and renewal

- **Attended issuance:**
  - Allowed only from a live user session: an unmarked token with `sid` and an online active-session check, the same branch as `identity`.
  - Called by Meri control while option A's relay still yields a bearer for that exact run and client.
  - `expiresAt = min(run deadline, issuedAt + policy.defaultDurationMs (proposed 30 min, as Objective), tenant limit, Clerk session expiry if the policy says so)`.
- **Renewal:**
  - Only by issuing a **new** delegation through the same attended path. The old one is revoked in the same transaction (lineage `supersedes`).
  - There is no silent extension, and nothing is renewed without a live session (attended) or a current consent (unattended).
- **Read token:** at most 60 s, `nbf` = issue time, `exp ≤ delegation.expiresAt`. Meri bounds its transport by `min(token exp, delegation expiresAt, run deadline)`, the same propagation as the option A fix.
- **Time source:** Core's database clock, as in `objective-workload-current.ts`. Skew allowance is at most 5 s, as the marked-token check uses.

## 7. Revocation

A delegation is revoked, terminally, when any of these happens:
- the run reaches a terminal state, is cancelled (Stop) or is fenced (`writerFence` advanced) — Meri control calls revoke;
- the user is deactivated, or the membership role, status or client visibility changes so the scope no longer holds — Core, checked at every use and swept on the event;
- the policy revision changes;
- for unattended delegations, the routine is deleted or paused or its consent is withdrawn.

In-flight requests: a read token is checked at request start, and Core re-reads the delegation as current before releasing the response. A revoked delegation withholds the response (409/403) even if the source query ran.

Attended only: the Clerk session ending does **not** revoke an attended delegation by default, because outliving the browser session is B's purpose. Neo decides whether attended delegations should instead die with the session (§11, question 1).

## 8. Cancellation and budget

- **Cancellation:** Meri's run Stop calls revoke, then aborts in-flight transports. Core treats a revoked delegation exactly like an expired one.
- **Budget:**
  - Meri's durable tool budget stays the spend owner. Every read still reserves and settles against the run allocation before dispatch, and a refusal leaves no reservation.
  - Core records `maxReadTokens` per delegation as defence in depth: the run allocation's scheduled operation count, capped at 256. Core refuses token issuance past it. It is a ceiling, not a charge.

## 9. Unattended authority (needs Neo)

- **Consent.** Unattended reads need an explicit consent record created by the user while signed in (when creating or confirming a routine). Its terms come from a Core policy `capiro.meri-read-delegation-consent` with an id and a revision, as `objective-consent-policy.ts` has.
  - The consent binds tenant, actor, client, `scheduleId`, `operationsDigest`, `policyRevision`, and an expiry of at most the policy maximum.
  - The model is the platform maximum, which tenant admins may only restrict (D015 #17 / N3).
- **Per occurrence.** When a scheduled occurrence starts, Meri control asks Core for an occurrence delegation by `consentId` and `occurrenceId`. Core issues it only if:
  - the consent is current;
  - the membership is active and the client is still visible;
  - the occurrence's run binding is the one Meri's schedule owner admitted.
- **Limits.** No Clerk session is required at occurrence time. **That is the policy change Neo must approve.** Without approval, unattended runs keep option A's behaviour: no reads.

## 10. Wire (bounded; placeholders only — no credential appears in this document)

**Issue a delegation:** `POST /api/clio/application-authority/read-delegations`
- Attended: `Authorization: Bearer <live user session token>` plus `x-internal-service-secret: <service secret>`.
- Unattended: service secret plus the `consentId` in the body, no user bearer.
- Request (max 16 KiB; additional properties refused):

```json
{"schemaVersion":1,"mode":"attended","binding":{"tenantId":"<uuid>","actorId":"<uuid>","conversationId":"<uuid>","runId":"<uuid>","attemptId":"<uuid>","writerFence":1},
 "clientId":"<uuid>","policyRevision":"<64 hex>","allocationSha256":"<64 hex>","operationsDigest":"<64 hex>","operations":[{"id":"search_tracked_bills","version":"0.2.0"}],
 "requestedExpiresAtMs":1800000000000,"supersedes":null}
```

Unattended adds `"mode":"unattended","consentId":"<uuid>","scheduleId":"<uuid>","occurrenceId":"<uuid>"`.

- Response:

```json
{"schemaVersion":1,"delegationId":"<uuid>","audience":"capiro:meri-native-read:v1","operationsDigest":"<64 hex>","expiresAtMs":1800001800000,"maxReadTokens":64,"checkedAtMs":1800000000000}
```

The response carries no secret material. The delegation id is a reference, not a credential: it is useless without the service identity and a per-call token.

**Issue a read token:** `POST /api/clio/application-authority/read-delegations/{delegationId}/tokens`
- Service secret only. Request:

```json
{"schemaVersion":1,"method":"POST","path":"/api/clio/tools/search_tracked_bills","bodySha256":"<64 hex>","operation":{"id":"search_tracked_bills","version":"0.2.0"},"runId":"<uuid>","attemptId":"<uuid>","writerFence":1}
```

- Response: `{"schemaVersion":1,"token":"<opaque>","expiresAtMs":<≤ now+60000>}`.
- Token claims (typ `capiro-meri-read+jwt`): `iss`, `aud` (`capiro:meri-native-read:v1`), `sub` = `delegationId`, `jti`, `iat`, `nbf`, `exp`, `method`, `path`, `bodySha256`, `operation`, `tenantId`, `actorId`, `clientId`, `runId`.
- Signed by a Core read-delegation key. Key custody follows D7-2/D7-3 and is decided by Core and Neo.

**Use:** the target request carries `Authorization: CapiroMeriRead <token>` plus `x-internal-service-secret`. `TenantContextMiddleware` gets a new branch, accepted only for the §4 targets. It verifies the signature, `aud`, `exp`/`nbf`, method, path, empty query and body hash, and enforces single use of `jti`. It loads the delegation as current (§7) and builds the tenant context from it, with no provisioning, identity rebind, self-heal or `lastSeenAt` write.

**Revoke:** `POST /api/clio/application-authority/read-delegations/{delegationId}/revocations`
- Service secret. Body: `{"schemaVersion":1,"reason":"run_terminal|cancelled|fenced|superseded|consent_withdrawn"}`.
- Idempotent and terminal.

**Errors:**
- 401 for a missing or invalid credential.
- 403 for scope, target, operation, audience or policy refusals.
- 409 for revoked or changed authority.
- 410 for an expired delegation.
- 429 for `maxReadTokens` exhausted.

Meri maps every error to `UNAVAILABLE` or `ACCESS_DENIED`, as the native-read owner does today.

## 11. Open questions for review

1. Should attended delegations die with the Clerk session that created them (safer, but long attended runs still fail), or live to the run deadline (the purpose of B)? Neo decides.
2. Should the per-call token be signed by a new Core read key or reuse the D7-3 RS256 workload issuer? Core and Neo decide.
3. Storage: proposed Core tables `meri_read_delegations`, `meri_read_tokens` (jti use) and `meri_read_delegation_consents`. They would be CREATE-only in Core's schema, with migration ownership by the Core integration owner and a snapshot first.
4. Should `check-ref` stay on the per-call token, or move under the delegation issuance once (it is a read of the same scope)?
5. The cap on `maxReadTokens`, and whether Core should also enforce a per-delegation rate.

## 12. Acceptance tests the implementation must carry (source)

- **Core:**
  - Issuance refuses a marked control token, a sidless token, an inactive session, a membership or client mismatch, an operation outside the catalog's read set or outside the allocation, and a scope wider than one client.
  - The read token refuses a different method, path, query or body, a reused `jti`, expiry, a revoked or superseded delegation, a policy-revision change, and a write tool name.
  - The middleware branch never provisions, rebinds or writes `lastSeenAt`.
- **Meri:**
  - The read broker bounds the transport by `min(token exp, delegation expiry, run deadline)` and aborts in flight at that moment.
  - Stop revokes before aborting.
  - No bearer, token or secret is persisted or logged.
  - Unattended runs without approved consent stay `UNAVAILABLE`.
