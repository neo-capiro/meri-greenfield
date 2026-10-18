# Tracked-bill and hearing client-selector seams — 17 October 2026

## Decision and scope

HOLD named-client expansion. There is no usable name-to-client receipt in the verified existing native authority interfaces at the pinned Core source. Preserve implemented tracked-bill UUID reads and hearing unscoped/UUID reads. The frozen validators can represent a trusted named resolution; that representational support does not install a resolver or establish access. No production source, backend, shared context, contract, startup, lock, credential or deployment change is made by this audit.

Worktree: `meri-resolution-next`, reviewed base `e1845c3b0d7caa8fd3309ad96f6cb4e17f25ccce`, tree `9f3e147d6853fe975ba53e3c65b55f32419401b8`; published PR106 `382f45ae695e271bf7433343d31486ac0d57184a` has the same tree. Source reference: `neo-capiro/capiro-backend` commit `b525032222515d636b0dae2d46e40c7c3d8b5528`, tree `16723770a8e111fc66bcf70d36ff32ab71eb9928`. Disk checked at about 2.25 GiB free; no dependencies, archives or worktrees created by this author. No live source calls were performed.

## Existing owners actually checked

This conclusion follows actual module/controller wiring, not a failed endpoint-name search. Core `apps/api/src/app.module.ts` imports `ApplicationAuthorityModule`; `apps/api/src/auth/application-authority.module.ts` registers `ApplicationAuthorityController` and `ApplicationMembershipController`.

| Current interface or owner | Verified behavior | Consequence |
| --- | --- | --- |
| `POST /api/clio/application-authority/identity` | Closed empty body; current principal, identity revision and bounded times. | Establishes identity, no selector resolution. |
| `POST /api/clio/application-authority/context` | Exactly `{identitySha256, conversationId, clientId}`; the latter two require lowercase UUID syntax. | Cannot accept a name or an additional reference field. |
| `readApplicationAuthorityContext` in `auth/application-authority.ts` | Requires an owned active non-archived legacy conversation whose stored client equals the selected UUID, checks prospect scope, current client visibility and current wall authority, repeats owner reads across identity rechecks. | Useful existing resource authority; no name lookup. An explicit existing Core conversation UUID is a real resource selector. This audit does not claim that conversation mappings or native context endpoints are absent. |
| `POST /api/clio/application-authority/membership` | Empty body; active role/membership and accessible `clientIds`, membership revision, checked/expiry times; no names or aliases. | The current roster cannot establish which ID a name denotes. |
| `ContextSecurityScopeService.resolveApplicationAuthorityClient` | Rechecks the selected ID through its current actor/client wall predicate before and after selecting non-archived client/wall/grant facts. Selects no name. | Canonical grant owner suitable for a separately allocated reference assertion. |
| `MeriToolsService.ensureClientVisible` | Native UUID branch checks same-tenant non-archived ID; name branch performs exact case-insensitive same-tenant non-archived matching, returns one match or refuses ambiguity. The name query has no memory-wall predicate. | An authenticated native tool route is not a safe pre-read name resolver. |
| `ClientsController` / `ClientsService.list` / `get` | List/get tenant scope is explicit, but they return profile rows without the current actor's memory-wall predicate. List has profile/status filters, no dedicated trusted name receipt. | No roster enumeration or post-read `get_client` fallback is acceptable here. |

Fresh GitHub file reads and blob identifiers:

- `auth/application-authority.controller.ts`: `2a062be013a2da9eac28612fe435dc2b72dd5d4f`; `auth/application-authority.ts`: `4803d6199d83b1dc8b2ca0674fa52f097c2a04c7`.
- `auth/application-authority.module.ts`: `03b7291daccabf9bc8410f57b714885ae3c1ad42`; `auth/application-membership.controller.ts`: `ace4b6a766d0b212dbcce98fd2fd0d48ae219b15`; `auth/application-membership.service.ts`: `616365127574e7e0b463271ffbec3b14d4f25607`.
- `context/context-security-scope.service.ts`: `875b04f94cf5ecb40c22b7a9f2d73ca9cc3ed662`; `memory/memory-wall.helpers.ts`: `0f18c7747067c653dac87829231ae5c28370bcaa`.
- `meri/meri-tools.service.ts`: `32a7a744ba9ab812337baaf6093a37540864333b`; `clients/clients.controller.ts`: `54be4e4148352309522eb1632ca2e3750940dcb9`; `clients/clients.service.ts`: `dbc180fe215e58b64f2d101f4aba56b20095309f`.

At this pin, tracked-bill dispatch is `meri-tools.service.ts:8405–8416`: required string bounded to 80, `ensureClientVisible`, then `intelligence.listTrackedBills`. Hearing dispatch at `6319–6367` optionally resolves the same native reference before its governed hearing ContextPlane search. Resolver implementation is `9714–9756`. Passing a name into either producer would run that name query before Meri could compare the returned client ID; later result rejection would not repair the pre-read boundary. Source routes themselves exist; the blocker is the missing trusted selector association.

## Frozen reference and current runtime boundaries

`packages/contracts/retrieval-0.2/tracked-bills-validation.mjs` retains `raw.clientId.trim().slice(0,80)` exactly as `clientReference` and requires one trusted client subject. A UUID reference cannot rebind to a different subject. Name equality/collation is explicitly left to a trusted source resolver. `public-domain-hearings-validation.mjs` uses the corresponding optional, clipped reference with a second trim, correlated to `{reference,clientId}`; absent selection requires null resolution.

The current CONTROL owner is `apps/runtime/native-authority/native-read-credentials/owner.mjs`, with current UUID membership in `core-client.mjs` and finite family context in `source-read-context.mjs`. Unsupported names refuse before native credentials, native authority HTTP or budget/source execution. Source handlers additionally refuse a supplied name context before source HTTP. A model argument, fake normalized context, an ID-only membership receipt, or a selected task subject alone cannot supply the missing name association.

## Smallest additive proposal — not implemented or allocated

Add a separate fixed native authority route, leaving existing identity/context/membership bodies and frozen read contracts unchanged:

```ts
type ApplicationClientReferenceRequest = {
  identitySha256: string;       // lowercase SHA-256 of the exact current identity receipt
  clientReference: string;      // source-captured 1..80 UTF-16 units, retained exactly
  expectedClientId: string;     // lowercase UUID from the existing one-client task subject
};
type ApplicationClientReferenceReceipt = {
  identitySha256: string;
  principal: {tenantId: string; actorId: string};
  identityRevision: string;
  membershipRevision: string;
  clientReference: string;
  selectedClientId: string;
  resolutionRevision: string;
  checkedAtMs: number;
  expiresAtMs: number;
};
```

Proposed route: `POST /api/clio/application-authority/client-reference`. Both shapes must be closed ordinary inert data; strict UUID/hash/clock/length validation, bounded no-store JSON, no cookies, caller tenant/actor headers, redirects or detail payload. The reference is source-captured before the call: tracked retains any trailing whitespace introduced at clipping; hearing applies its canonical second trim. Native lookup uses the native final trim without rewriting the retained receipt reference. The echoed hash is correlation, never authorization.

Core must first establish current identity and active tenant membership and use its canonical accessible-client/wall owner **before** selecting name facts. `expectedClientId` is only an upper bound, not permission. Match exact case-insensitively using Core's existing database collation; no fuzzy matching, guessed name/UUID conversion, mailbox inference or model-directed roster scan. Resolve uniquely among currently authorized non-archived clients and require that result to equal the expected UUID. Zero matches, ambiguity, inaccessible candidates, or mismatch fail closed without profile/count/name details. This defines a reviewed authorized-candidate reference assertion; it is not a claim of parity with the old tenant-wide ambiguity query. Querying ungranted private clients merely to emulate that ambiguity is outside this proposal.

Re-read current identity, active membership, selected-client name/status and canonical wall/grant facts across asynchronous owner reads. Bind `resolutionRevision` to the exact retained reference, selected ID, native collation/version, selected name/status facts and current grant/membership revisions. Include authorized candidate identity/name revision facts sufficient to detect an added authorized duplicate; do not emit those facts. Expiry is the minimum of all current identity, membership, task and operation limits. A rename, archive, accessible duplicate, changed identity, wall/grant removal or membership change must invalidate the retained resolution. The existing membership client revision hashes the client row, but returns only a membership digest/IDs; that is useful revocation input, not a name receipt by itself.

CONTROL must compare principal against its canonical run binding, identity hash/revision against the observation, selected UUID against exactly one current client subject plus its matching resource scope, and current native membership against that UUID. Pin the original request hash, operation, source IDs, policy/task grant, retained reference, selected UUID and resolution revision on the existing invocation lifetime. Repeat the observation before credential release and after source execution/before result release; changed vectors fail closed. No new grant or credential issuer is needed.

After that separately reviewed seam exists, a family-owned `requestBody` bridge may replace **only** native `clientId` with the resolved UUID. Keep the original raw request/hash and original-reference normalization context for the frozen receiver and credential proof. This prevents a second native name lookup from retargeting between resolution and reading. It is an intentional bridge requiring allocation and tests; forwarding the original name and trusting post-read client equality is not sufficient.

Suggested exact implementation allocation:

| Owner | Files and responsibility |
| --- | --- |
| Core backend | Add `apps/api/src/auth/application-client-reference.ts` (closed wire and pure receipt/recheck logic), `application-client-reference.controller.ts` (thin fixed route), `application-client-reference.test.ts` and `application-client-reference.controller.test.ts`. Register in existing `apps/api/src/auth/application-authority.module.ts`. Extend `apps/api/src/context/context-security-scope.service.ts` and add `application-client-reference.test.ts` in that context directory for the current authorized reference assertion, reusing its wall predicate and membership owner rather than a second authorization implementation. |
| Shared Meri contract | Add closed request/receipt validators and one fixed route entry in `packages/contracts/action-authority-0.2/validate.mjs`, with new `packages/contracts/test/application-client-reference.test.mjs`. No change to existing normalized retrieval definitions or their hashes is necessary for this proposal. |
| CONTROL transport/owner | Extend `apps/control/action-host/application-adapters/authority-http.mjs` and add `client-reference-independent.test.mjs` beside it; extend `apps/runtime/native-authority/native-read-credentials/{core-client,owner,source-read-context}.mjs` and its `test/{core-client,owner,source-read-context,source-slices}.test.mjs` to observe, correlate and recheck the receipt using the existing credential lifetime. These shared paths remain root-owned. |
| Family adapters | Only after the above: `apps/gateway/sources/tracked-bills/handler.mjs`, `apps/gateway/sources/public-domain-hearings/{request-context,handler}.mjs` and family tests; retain original-reference shape and add the resolved-UUID request bridge. Root owns registry, SDK exposure and remaining-family ledger. |

Required new-seam checks: closed/inert DTOs; clipping/case/collation; no name reads before current grant; zero/ambiguous/foreign-name denial; exact selected-ID/task/resource equality; no fallback; rename/archive/duplicate/grant/session/task revocation before credential and after HTTP; expiry/deadline/cancellation/byte caps; original request hash plus native UUID body; frozen output validation. Existing UUID and unscoped hearing results must stay compatible. This is a source proposal, not a live-qualified endpoint or permission to widen SDK exposure.

## Delta verification and completion

Added only two family-owned `test/client-selector-seam.test.mjs` files. Four checks pass on Node 24 with `--preserve-symlinks --max-old-space-size=256 --test --test-concurrency=1`:

- Current CONTROL refuses named, case/whitespace, clipped and UUID-suffixed references despite an authorized multi-ID roster and an already-selected task client. No native credential, native authority HTTP, service secret, source HTTP or current-entry read occurs.
- For both existing UUID branches, a captured context followed by current membership removal/change is refused before service-secret or source access.

The existing family regression selection also passed 43/43: tracked-bill `handler.test.mjs` and hearing `handler.test.mjs` / `request-context.test.mjs`. Total observed across the two commands: 47/47, zero failures. `git diff --check` passed; other authors' simultaneous source deltas were observed and left untouched. Both task-owned command sessions exited successfully.

No initial test failure. No implementation capability gained in this bounded audit; no reviewed source publication or live qualification is claimed. Named tracked-bill/hearing reads remain blocked on the explicitly described backend/contract/current-owner seam; existing UUID/unscoped support remains intact.
