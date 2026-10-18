# Artifact current-authority contract: `capiro.meri-artifact-authority.v1`

**Status: DRAFT for Core review.** Ledger D31 (#121 6246636849, item 6). Nothing is mounted, keyed, rendered or activated.
The golden vectors are SYNTHETIC: `docs/integration/artifact-current-authority.vector.json`.

**Ownership** (dot, #121 6246642210):

| Part | Owner |
|---|---|
| The current-authority facts and this wire | R0 / lane C (this document) |
| The receiver at `POST /api/clio/application-authority/artifact` | Core |
| The in-process `artifactOptions` object (pool, allocation, validators, executor, …) | Meri. It is never sent to Core and never comes from Core. |

Core's receipt is an authorization **fact**. It is not a grant, a capability, a credential or an options object.

## 1. Where the receipt is used

`/api/documents/{create,revise,inspect,download,preview,preview-publish}` calls the documents options owner
(`apps/runtime/product-ports/documents.mjs`). That owner is late-bound to control's action-session owner, and it calls the in-process
`authority.resolve({sessions, credential, intent, body, requestSha256, deadlineMs, signal})`. The call answers
`{artifactOptions, selectedClientId, credential, limits, enabled, recheck}`, or null.

Meri's implementation is `apps/runtime/artifacts/core-authority.mjs`. It makes one **observation** per `resolve` and one per `recheck`.
Each observation has three steps, and each step fails closed:

1. **Session (Meri-local).** Control's own action-session owner authenticates the caller's `action_session_…` token. It then reads
   the session's current binding, scopes and selected client. Each read re-verifies identity and context at Core through the
   session owner.
2. **Native bearer (RC1 option A).** `sessions.nativeCredentialFor({binding, selectedClientId})` returns the run's live
   action-session native credential. Meri admits it only if it is not a marked candidate credential and not the service secret.
   Meri looks it up again after it reads the service secret.
3. **Core receipt.** Meri calls the route in §3 and then joins the receipt to the session (see §5).

The first observation **pins** these facts: binding, scopes, selected client, principal, `identityRevision`, `contextRevision`,
`operations`, `limits` and `authorityRevision`. The runtime application calls `recheck` at admission, before and after every effect
port (versions, objects, executor, authority, authorize, previews) and before release. Each `recheck` makes a new observation. It
refuses `ACCESS_DENIED` unless the pin is unchanged.

`authorize` is the artifact service's decision for each action. It allows an action only when all of these hold:
- the intent needs the action (§4.3);
- Core's latest observation allows the action;
- the call carries the pinned binding and scopes.

Its receipt never outlives the latest observation.

## 2. Facts per documents request

| Fact | Source | Authority | Meri consumer |
|---|---|---|---|
| Tenant and actor | The action session binding; Core `principal` must equal it | **Core** (Clerk session, membership) | the join, the pin |
| Conversation, run, attempt, worker, fence | The action session binding (`RunBinding`) | conversation: **Core** (owned, active, not archived; the same checks as `/context`). Run, attempt, worker, fence: **Meri-local** | `context.binding`, the pin, `authorize` |
| Selected client, and that it is visible now | The session's single client scope; Core echoes `selectedClientId` | **Core** (`assertCurrentClientVisible`, `resolveApplicationAuthorityClient`, prospect scope) | `selectedClientId`, `context.scopes`, the pin |
| Scopes and `policyRevision` | The action session | **Meri-local** (Meri policy revision; D15) | `context.scopes`, `authorize` |
| Document intent kind | The route: `create`, `revise`, `inspect`, `download`, `preview`, `preview-publish` | Meri names it; **Core** decides it | the request `intent`, §4.3 |
| Allowed artifact operations | Receipt `operations` | **Core** | `authorize` and receipt validation |
| Artifact byte ceiling | Receipt `limits.maxArtifactBytes`, or null | **Core** (only if Core has an existing tenant ceiling; otherwise null) | `context.maxBytes` = min(run ceiling, Core ceiling, response limit) |
| Request, response and time bounds; max versions per lineage; preview bytes and renderer admission; download-link TTL (≤ 5 min, never beyond the session) | Control configuration, renderer qualification, the download gate | **Meri-local**. This contract adds none of them. | `limits`, `previewOptions`, `download-gate.mjs` |
| Native credential | The live action-session bearer, per call; never stored or cached | **Core** issues and verifies it (Clerk) | the `Authorization` header only |
| Service identity | The Core `INTERNAL_SERVICE_SECRET` file, re-read per call | **Core** verifies it (`ToolServiceSecretGuard`) | the `x-internal-service-secret` header only |
| Run capability (`documentOptions.credential`) and `authority.check` (current-tool-authority over the admitted run) | The `runOptions` owner | **Meri-local** composition. Its business and source ports are D19 and are not this route. | the artifact service |
| Allocation, producer context, descriptor, evidence, assets, `sourceEnabled` | The `runOptions` owner | **Meri-local** | `artifactOptions` |
| Retention and suppression: conversation active and not archived; client present and visible | Folded into `contextRevision` | **Core** | any change refuses at the next recheck |
| Retention and suppression: suppression generation, recovery barrier, purge cooling | The retention journal | **Meri-local** (`meri_artifacts.retention_*`) | the retention gate, download links |
| Expiry | Receipt lifetime (§7), session expiry, bearer expiry, request deadline | Core supplies the lifetime; Meri supplies the clock | `authorize` expiry, the lifetimes |

## 3. Wire

**Route.** `POST /api/clio/application-authority/artifact`. Success is HTTP 200 with the receipt. Every other status is a refusal (§6).

**Authentication.** The request needs all of the following:
- `Authorization: Bearer <native bearer>`: the user's live Clerk session token, held by the action session (RC1 option A). Core's
  normal tenant middleware verifies it.
- `x-internal-service-secret: <Core INTERNAL_SERVICE_SECRET>`, checked by `ToolServiceSecretGuard`. This is the same verified service
  identity as `/api/clio/tools/*` and `/api/clio/approvals/native/*`.
- The `standard_user` role.

The **marked control credential is never accepted.** Under Core #83 SEC D1, the control credential reaches only
`application-authority/{identity,context,membership}`. Core refuses it here with 403. Meri never sends it: `authority-credentials.mjs`
refuses every marked candidate credential (identity, task, control, proxy) and the service secret as a bearer, before any request.

**Transport.** `redirect: error`, `credentials: omit`, `cache: no-store`. The request carries `content-type: application/json`,
`accept: application/json` and `accept-encoding: identity`. The response must be `application/json` (an optional `charset=utf-8` is
allowed) with no content encoding. The request is at most 1024 bytes and the receipt at most 4096 bytes. Meri allows at most 3 s per
call by default (10 s maximum), and never past the request deadline. Meri never retries.

### 3.1 Request (closed; every key required; the bytes are serialized in this key order)

```json
{
  "contract": "capiro.meri-artifact-authority.v1",
  "observationId": "<UUIDv4, fresh per call>",
  "conversationId": "<lowercase UUID: the action session's conversation>",
  "clientId": "<lowercase UUID: the action session's selected client>",
  "intent": "create | revise | inspect | download | preview | preview-publish",
  "requestSha256": "<64 lowercase hex: canonical SHA-256 of {intent, body}>"
}
```

`requestSha256` is only a correlation value. It is not source proof or a grant. Meri recomputes it from the parsed body before it
calls Core. Core echoes it and does not interpret it. Tenant and actor are not in the body: Core takes them from the bearer.

### 3.2 Receipt (HTTP 200; closed; every key required)

```json
{
  "contract": "capiro.meri-artifact-authority.v1",
  "observationId": "<echo>",
  "principal": {"tenantId": "<UUID>", "actorId": "<UUID>"},
  "identityRevision": "<64 hex: the same derivation as /identity>",
  "conversationId": "<echo>",
  "selectedClientId": "<echo of clientId>",
  "contextRevision": "<64 hex: the same derivation as /context>",
  "intent": "<echo>",
  "requestSha256": "<echo>",
  "operations": ["<sorted, unique, non-empty subset of §4.2>"],
  "limits": null,
  "authorityRevision": "<64 hex>",
  "checkedAtMs": 0,
  "expiresAtMs": 0
}
```

- `limits` is `null` or `{"maxArtifactBytes": 1..16777216}`.
- `checkedAtMs` and `expiresAtMs` are integers on Core's clock, with `0 < expiresAtMs - checkedAtMs <= 60000`.

Meri refuses a receipt with `ACCESS_DENIED` in any of these cases:
- a key is extra or missing;
- an echo differs;
- a revision is not 64 lowercase hex;
- the principal is not a UUID;
- `operations` are unsorted, duplicated or unknown, or do not cover the intent;
- `limits` has another shape;
- the lifetime is outside (0, 60 s].

The vector file lists 18 such refusals.

## 4. Core receiver (what Core implements)

This mirrors `readApplicationAuthorityContext` (`apps/api/src/auth/application-authority.ts`). The guards are `RolesGuard` with
`standard_user`, `ToolServiceSecretGuard` and the control-credential refusal.

### 4.1 Steps

1. **Parse the body.** It must be closed (`closedBody` with the six keys). `contract` must be the literal value, `observationId` a
   UUIDv4, the ids UUIDs, `intent` in the enum and `requestSha256` 64 hex. Otherwise answer 400.
2. **Read and re-read**, exactly as `/context` does: identity, then the conversation (owned by the actor, `status = 'active'`,
   `archivedAt = null`, `clientId` equal to the request's), then the conversation scope (prospect link), then client visibility, then
   client authority, then identity again, then the same reads again, then `recheckCurrent`. Add the current membership
   (`status = active`, role among the admitted roles) as `/membership` reads it.
3. **Decide `operations`** (§4.2). If any operation the intent needs (§4.3) is missing, answer 403.
4. **Derive the revisions.**
   - `contextRevision`: the existing `/context` derivation.
   - `authorityRevision`: `applicationAuthorityRevision('artifact', [identityRevision, contextRevision, membershipRevision, role,
     operations, limits])`, or any deterministic digest over every fact Core consulted. Meri treats it as opaque and requires it to be
     equal across all observations of one request.
5. **Set the times.** `checkedAtMs` is Core's `Date.now()` after the last read. `expiresAtMs = min(checkedAtMs + 60000, identity
   expiresAtMs)`. If that is not greater than `checkedAtMs`, answer 403.
6. **Respond.** Answer 200 with `Cache-Control: no-store` and `application/json; charset=utf-8`. The body is exactly the receipt.

Every other refusal is 403 `Application authority unavailable`, with no disclosure. Nothing is persisted: there is no ledger, no
cache and no idempotency key.

### 4.2 `operations`

The vocabulary is closed and sorted: `artifact.download`, `artifact.generate`, `artifact.inspect`, `artifact.preview-publish`,
`artifact.revise`.

**v1 rule (existing semantics, no new policy):** an active member with an admitted role (`standard_user`, `user_admin`,
`capiro_admin`) for whom the client is visible gets all five. If Core already has a narrower rule, for example a read-only membership,
Core applies it. The field exists so that a later rule needs no wire change.

### 4.3 Operations each intent needs (`INTENT_OPERATIONS`)

| Intent | Needs |
|---|---|
| create | `artifact.generate` |
| revise | `artifact.revise` |
| inspect | `artifact.inspect` |
| download | `artifact.download` |
| preview | `artifact.download`, `artifact.inspect` |
| preview-publish | `artifact.download`, `artifact.inspect`, `artifact.preview-publish` |

## 5. The join, the pin and `authorize` (Meri)

**Join.** `principal` must equal the session binding's `{tenantId, actorId}`. `conversationId` must equal `binding.conversationId`
and `selectedClientId` must equal the session's selected client. The session must have exactly one client scope, and it must be the
selected client.

**Pin.** The canonical SHA-256 of these facts: binding, scopes, selected client, principal, `identityRevision`, `contextRevision`,
`operations`, `limits` and `authorityRevision`. Any change between observations of one request refuses with `ACCESS_DENIED`. That
covers membership, role, client visibility, an archived conversation, a narrowed operation set, a newly added ceiling, and a session
scope or fence change.

**`authorize({action, resource, requestSha256, binding, scopes, deadlineMs})`** answers the artifact service's closed receipt:

```
{receiptId, decision: 'allow', action, binding, scopesSha256, resourceSha256, requestSha256, expiresAtMs}
```

Here `expiresAtMs = min(latest observation expiry, deadlineMs)`. `authorize` makes no Core call: the runtime application rechecks
immediately before and after it.

**Version scope stays Meri-local.** The artifact service still requires each version's tenant, conversation and scopes to match the
context. Core has no knowledge of versions.

## 6. Errors and Meri's mapping

| Core answer | Meri code (`/api/documents/*` status) |
|---|---|
| 200 with a valid receipt | allowed |
| 200 with an invalid, mismatched, oversized or non-JSON body | `ACCESS_DENIED` (403) |
| 400 | `ACCESS_DENIED` (403). Meri sent a malformed body; this is never retried. |
| 401 | `SESSION_REFUSED` (403) |
| 403 | `ACCESS_DENIED` (403) |
| 404 (route not mounted), 409, 429, 5xx, a redirect or a network error | `UNAVAILABLE` (503) |
| The caller's deadline passes or the caller aborts | `DEADLINE` (408) or `CANCELLED` (499) |

The response outcome follows the runtime application:
- a refusal at `resolve` or at the admission recheck is `NOT_DISPATCHED`;
- a refusal after a write began is `UNKNOWN`;
- a refusal after a read began is `READ_UNAVAILABLE`;
- a refusal at release is `RESULT_NOT_RELEASED`.

Refusal bodies carry closed codes only. No bearer, secret or body is ever logged or echoed.

## 7. Clock, `checkedAtMs` and replay

This follows dot's execution-capability review point 2 (#121 6246551969).

- Meri records `startedAtMs = now()` before it sends. After it reads and validates the whole body, it records
  `observedAtMs = now()`. The receipt's **local** `checkedAtMs` is `observedAtMs`, so it always lies in `[started, now]`.
- Core's `checkedAtMs` and `expiresAtMs` are compared only with each other. Meri uses their difference, a lifetime of at most 60 s,
  counted from its own `startedAtMs`:

  ```
  localExpiresAtMs = startedAtMs + (expiresAtMs - checkedAtMs)
  ```

  Transit time and clock skew can only shorten it. A receipt whose lifetime already elapsed on Meri's clock is refused. The vector's
  Core times are 5 s ahead of Meri and are accepted.
- The effective expiry of an observation is the minimum of the local receipt expiry, the bearer's expiry, the session's expiry and the
  request deadline.
- **Replay.** Every call has a fresh `observationId` that Core must echo. An old or cached response cannot satisfy a new call. Meri
  never reuses an observation across requests. An old `checkedAtMs` is never used as freshness.

## 8. Idempotency

The route is a pure read. Repeating it is safe, and each call answers a fresh evaluation. There is no idempotency key and no Core
state. The documents write itself (create or revise) keeps its existing idempotency: `deliveryId`, the durable invocation and the
journaled budget reservation. This contract does not change any of that.

## 9. Credential handling

- **Nothing is stored.**
  - The bearer is resolved per observation from the live action session (option A). It is held only for that call. It never enters
    `artifactOptions`, `documentOptions.credential` or a log.
  - Meri refuses a `runOptions` capability that equals the bearer.
- **Attended only.** `/api/documents/*` always has a live action session, at most 300 s. Unattended document generation (routines)
  is out of scope. It would need a run-bound capability or delegation (option B), which is pending Neo's unattended policy and is
  not created here.
- **Service secret.** It is read through the runtime's owner-only `readSecret` on every call, so rotation needs no restart. Its path
  and bytes must differ from every candidate credential file. A file that later holds a candidate credential fails closed.

## 10. Meri implementation and composition

| File | Role |
|---|---|
| `apps/runtime/artifacts/core-authority-wire.mjs` | Pure, closed request and receipt checks; `INTENT_OPERATIONS`; status mapping |
| `apps/runtime/artifacts/core-authority-client.mjs` | The fixed-route transport (§3, §7) |
| `apps/runtime/artifacts/authority-credentials.mjs` | Service-secret custody and bearer admission (§9) |
| `apps/runtime/artifacts/core-authority.mjs` | The in-process `authority.resolve`, `recheck` and `authorize` (§1, §5) |
| `apps/runtime/artifacts/authority-composition.mjs` | `composeDocumentsFamily({configuration, runOptions?, executor?, …})` returns `{family, authority, missing}` |
| `apps/runtime/artifacts/configuration.mjs` | The optional `artifacts.authority: {origin, serviceSecretFile}` key. `origin` is a bare https origin equal to `nativeCandidate.identity.origin`. `serviceSecretFile` is an absolute POSIX path. |
| `apps/runtime/product-ports/documents.mjs` | Composes the options owner only when an authority **and** `artifacts.authority` exist. An authority that names its `origin` or `now` must match. |

**Composed disabled.** The options owner is composed only when every one of these exists:
- `artifacts.enabled`;
- `artifacts.authority`;
- `nativeCandidate`;
- a readable service secret;
- the two Meri-local owners: `runOptions` and `executor`.

Otherwise the store-only family stays in place, `/api/documents/*` answers 503, and `missing` names each gap by key.

**The remaining Meri-local gap** is the `runOptions.read` owner. Its contract:

```
runOptions.read({binding, scopes, selectedClientId, intent, body, requestSha256,
                 authority: {operations, limits, expiresAtMs}, signal, deadlineMs})
  -> {allocationJson, producerContext, descriptor, evidence, assets, maxBytes, authority: {check}, credential, sourceEnabled?}
   | null
```

It comes from the admitted run: the current allocation from `createPostgresAdmittedRunOwner`, the run capability and
current-tool-authority `check`, the canonical `create_word` or `create_excel` descriptor, and G1 `sourceEnabled`. The second gap is
the fixed executor configuration (`createFixedRuntimeArtifactExecutor`: the approved Python, node and pptx paths, and the Office
libraries in the image). Both are R0's, not Core's. A Core receiver alone does not open `/api/documents/*`.

## 11. Golden vectors

`docs/integration/artifact-current-authority.vector.json` contains:
- two cases, `create` with no Core ceiling and `download` with a 1 MiB ceiling, each with the Meri request, its exact JSON bytes, the
  receipt and the Meri-clock timing;
- the request headers, with placeholders only;
- the status mapping;
- 18 receipt refusals.

`apps/runtime/artifacts/test/core-authority.test.mjs` checks all of them. Core's receiver spec should parse the same requests and
emit receipts that pass `assertArtifactAuthorityReceipt` (port `core-authority-wire.mjs` or test against the vector file).

## 12. Open engineering questions (Core / dot)

1. **The control-credential refusal on this route.** The route uses the user bearer plus the service secret. Which Core mechanism
   marks and refuses the control credential here (Core #83 SEC D1)? Is it the same one that keeps the control credential off
   `tools/*`?
2. **Membership in the decision.** Should `/artifact` call the `/membership` owner internally, so that `authorityRevision` covers role
   and membership? Or is `contextRevision` (client authority) enough? Meri needs only that any change alters one of the pinned
   revisions.
3. **D19 overlap.** Once D19's `authorizeBusiness` supplier exists, should this receipt double as the business decision for
   `create_word`/`create_excel` (grant `artifact.publish`)? Or should it stay separate, with the run capability's `authority.check`
   doing its own Core read? Today `authority.check` is a Meri-local composition and is not covered here.
4. **Existing tenant document ceilings.** If Core has none, it answers `limits: null`. Meri's ceilings then apply unchanged, and no
   new policy is created.
5. **Call volume.** Meri makes one Core call per observation. A full download makes about 13 observations by port count: resolve, the admission recheck, two around each of three `authorize` calls, two around the version read, two around the object read, and the release recheck. A create makes more. The synthetic test path made 5 before its first storage read. That is the same order as the session owner's own identity and context re-reads. Is that acceptable for the preview
   listener (D20 capacity)? If not, Core and Meri can agree on a per-request observation budget. The 60 s maximum lifetime is
   already the bound on staleness between rechecks.

## Appendix A: composer diffs (R0 applies them; not edited by this lane)

**`apps/runtime/cli.mjs`** (control only). This is behavior-preserving today: with no `runOptions` or `executor`, the family stays
store-only.

```diff
-  const productPorts=role==='control'?{productPortsFactory:(await import('./product-ports/index.mjs')).createProductPortsFactory()}:{};
+  let productPorts={};
+  if(role==='control'){
+   // Documents (D31): the Core artifact authority composes only with every input present; otherwise the store-only family stays
+   // and `missing` names the gaps by key (runOptions and executor are Meri-local owners R0 supplies here when they exist).
+   const [{createProductPortsFactory,PRODUCT_FAMILIES},{composeDocumentsFamily}]=await Promise.all([import('./product-ports/index.mjs'),import('./artifacts/authority-composition.mjs')]);
+   const documents=await composeDocumentsFamily({configuration:c});
+   if(c.artifacts?.enabled===true&&documents.missing.length)process.stderr.write(JSON.stringify({event:'runtime.documents.unavailable',missing:documents.missing})+'\n');
+   productPorts={productPortsFactory:createProductPortsFactory({families:PRODUCT_FAMILIES.map(([name,factory])=>[name,name==='documents'?documents.family:factory])})};
+  }
```

**`apps/runtime/config.mjs`.** No change. `artifacts` is already admitted for control, and `compileRuntimeArtifactsConfiguration` now
validates `artifacts.authority`.

**`apps/runtime/control.mjs`.** No change. `assembleControl` already calls `bindDocumentsSessions(productContext, sessions)`. The
`now` passed to `composeDocumentsFamily` must be control's clock: both default to `Date.now`, and `documentsFamily` refuses a mismatch.

**`apps/runtime/product-ports/index.mjs`.** No change. `cli.mjs` maps the `documents` entry.

**`infra/product-preview/first-chat/render-material.mjs`.** Unchanged refusal messages are elided as `...`. This reuses the reads service secret (the same Core
`INTERNAL_SERVICE_SECRET`), so it adds no new secret material.

```diff
@@ parseFeatures (features.artifacts)
-  const storage=['region','bucket','prefix','expectedBucketOwner','kmsKeyId'],a=record(f.artifacts,'features.artifacts',['enabled'],storage);
+  const storage=['region','bucket','prefix','expectedBucketOwner','kmsKeyId'],a=record(f.artifacts,'features.artifacts',['enabled'],[...storage,'authority']);
-  if(!bool(a.enabled,'features.artifacts.enabled')){if(storage.some(k=>a[k]!==undefined))fail(...);out.artifacts={enabled:false};}
+  if(!bool(a.enabled,'features.artifacts.enabled')){if([...storage,'authority'].some(k=>a[k]!==undefined))fail(...);out.artifacts={enabled:false};}
   else{
-   record(a,'features.artifacts',['enabled',...storage]);
+   record(a,'features.artifacts',['enabled',...storage],['authority']);
+   const authority=a.authority===undefined?false:record(a.authority,'features.artifacts.authority',['enabled']).enabled===true;
-   try{compileRuntimeArtifactsConfiguration({artifacts:{...a}});}catch{...}
+   try{const {authority:_,...store}=a;compileRuntimeArtifactsConfiguration({artifacts:store});}catch{...}
-   out.artifacts={enabled:true,region:a.region,bucket:a.bucket,prefix:a.prefix,expectedBucketOwner:a.expectedBucketOwner,kmsKeyId:a.kmsKeyId};
+   out.artifacts={enabled:true,region:a.region,bucket:a.bucket,prefix:a.prefix,expectedBucketOwner:a.expectedBucketOwner,kmsKeyId:a.kmsKeyId,...(authority?{authority:true}:{})};
   }
@@ after features.reads is parsed
+ if(out.artifacts?.authority===true&&out.reads?.enabled!==true)fail('RENDER_INPUT_REFUSED','features.artifacts.authority reuses the reads Core service secret: it needs features.reads enabled');
@@ control featureKeys
- if(features.artifacts!==undefined)featureKeys.artifacts=features.artifacts.enabled?{...features.artifacts,...(features.retention?{tenantId:k.tenantId}:{})}:{enabled:false};
+ if(features.artifacts!==undefined){const {authority,...store}=features.artifacts;featureKeys.artifacts=store.enabled?{...store,...(features.retention?{tenantId:k.tenantId}:{}),
+  ...(authority?{authority:{origin:k.coreOrigin,serviceSecretFile:PATHS.readsServiceSecret}}:{})}:{enabled:false};}
```

The header doc becomes `artifacts?: {enabled:false} | {enabled:true, region, bucket, prefix, expectedBucketOwner, kmsKeyId,
authority?: {enabled:true}}`. Add a case to `render-features.test.mjs`. `origin` is `core.coreOrigin`, which already equals the
rendered `nativeCandidate.identity.origin`, so the runtime equality check holds.
