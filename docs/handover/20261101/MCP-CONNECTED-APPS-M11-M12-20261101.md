# MCP connected apps: M11 directory/OAuth/readiness and M12 execution/scopes/revocation (1 November 2026)

Source completion of packet items M11 and M12 for the Meri side, with the Core state machine enumerated from Core `main` so acceptance can test each transition. No AWS, deployment, browser, serving database or real connector grant was touched.

## Where each behaviour lives

| Concern | Owner | Meri source (this repository) |
|---|---|---|
| Connector directory, statuses, OAuth start/callback, signed state, nonce, expiry, discovery, hardening, finalization, disconnect | Core `capiro-backend` `apps/api/src/meri/meri-mcp*.ts`, `meri-managed-mcp.service.ts`, `connected-app-read.service.ts` | none; Meri consumes the projection below |
| Unknown create blocked through reload until the exact original is reconciled | Frontend connector library (frontend PR 391, merged) | none |
| Model-facing directory and reads (`list_connected_app_reads`, `read_connected_app`) | Meri | `packages/contracts/retrieval-0.2/connected-apps*.{schema.json,mjs}`, `apps/gateway/general-reads/families/connected-apps.mjs`, `apps/runtime/read-context/source-read-context.mjs`, `apps/worker/conversation/reads/*` |
| Current grant on every call, scope narrowing, mid-run revocation/expiry, cross-actor refusal, no custom server | Meri (worker `meri_reads` server, control reads owner, gateway) with Core as the authority | same, plus `apps/runtime/reads-owner.mjs`, `apps/runtime/read-families.mjs` |

Core PRs 330 (current catalog permissions, truthful discovery outcomes) and 334 (discovery revision preserved through credential refresh) are merged on Core `main` (`12d3da087`). Core PRs 331 (OAuth readiness after discovery; the `startMcpOAuth` receiver already awaits discovery and managed finalization on `main`) and 357 (hardening and finalization guarded by the observed revision) are open with the Codex MCP owner and were not duplicated here.

## Core connection state machine (`ClioMcpServer.connectionStatus`, Core `main` `12d3da087`)

States: `pending`, `connected`, `needs_reauth`, `error`, `disconnected`; `enabled=false` hides a row from every read regardless of status. Every status write except `disconnect` is conditional on the observed status (and, where noted, the observed `updatedAt` revision), so an older in-flight operation never erases a newer `disconnected`, `pending` or `error`.

| From | Trigger | Guard | To | Core source | Core test |
|---|---|---|---|---|---|
| none | `createServer`/`addFromCatalog`, `authType=oauth` | admin/owner | `pending` | `meri-mcp.service.ts` | `meri-mcp.service.spec.ts` |
| none | `createServer`/`addFromCatalog`, token/none | best-effort discovery | `connected` | same | same |
| any enabled | `MeriMcpOAuthService.start` | `updateMany` where status and `updatedAt` equal the admitted row | `pending`, `lastError` cleared | `meri-mcp-oauth.service.ts` | `meri-mcp-oauth.service.spec.ts` |
| `pending` | `auth()` throws or returns neither REDIRECT nor AUTHORIZED | `setStatus` skips `disconnected` | `error` | same | same |
| `pending` | `auth()` AUTHORIZED (valid tokens) | caller must discover at least one tool; managed app finalized | `connected` via `discoverTools` / `finalizeConnection`; zero tools refuses readiness | `meri.controller.ts startMcpOAuth`, `meri-managed-mcp.service.ts connectApp` | `meri-mcp-readiness.controller.spec.ts` |
| `pending` | `auth()` REDIRECT | nonce persisted on the credential row; signed state carries tenant, server, user, nonce, expiry (600 s), discovered issuer | `pending` + `authUrl` | `meri-mcp-oauth.service.ts` | `meri-mcp-oauth.service.spec.ts` |
| `pending` | callback with valid signed state | HMAC verified, expiry checked, issuer bound, owner equals starter, nonce consumed exactly once | tokens saved; `discoverTools` ≥ 1 → `connected` (generic) or `finalizeConnection` → `connected` (managed); zero tools → failure page, status unchanged by the callback and `error` from discovery | `meri-mcp-oauth.controller.ts`, `meri-mcp.service.ts discoverTools` | `meri-mcp-oauth.controller.spec.ts`, `meri-mcp.lifecycle.spec.ts` |
| `pending` | callback code exchange fails | `setStatus` skips `disconnected` | `error` | `handleCallback` | `meri-mcp-oauth.service.spec.ts` |
| `pending` | callback `error=access_denied` or missing code | nonce consumed; only `pending` rows change | `error` (cancelled / did not complete text) | `handleFailure` | same |
| any | callback with replayed, tampered or expired state | nonce already cleared or signature/expiry invalid → 400 | unchanged | `verifyState`, nonce `updateMany` | same |
| `pending`/`connected` | `finalizeConnection` | `hardenServer` count > 0; `updateMany` where status in {pending, connected} | `connected` | `meri-managed-mcp.service.ts` | `meri-managed-mcp.service.spec.ts`; revision guard in open PR 357 |
| `pending`/`connected` | hardening finds no supported read tool | conditional write | `error` ("No supported read tools are available.") | `hardenServer`, `discoverTools` | `meri-mcp.lifecycle.spec.ts` (empty policy) |
| `connected` | registry refresh `listTools` fails with Unauthorized/InvalidGrant/InvalidToken | where status and `updatedAt` equal the observed row | `needs_reauth` | `registryFor` | `meri-mcp.lifecycle.spec.ts` |
| `connected` | registry refresh fails otherwise (except Krisp 429) | same | `error` | `registryFor` | same |
| `connected` | Krisp 429 | status untouched, registry retried sooner | `connected` | `registryFor` | `meri-managed-mcp.service.spec.ts` |
| `connected` | `discoverTools` succeeds, row unchanged | revision compared after provider I/O (token refresh may bump it) | `connected`, `lastSyncAt` | `discoverTools` (PR 334) | `meri-mcp.refresh-readiness.spec.ts` |
| `connected` | `discoverTools` in flight while the row became `disconnected`/`pending` | conditional write count 0 | newer state kept, 0 reported | `discoverTools` | `meri-mcp.lifecycle.spec.ts` ("in-flight discovery cannot overwrite") |
| `connected`/`error` (managed) | `connect` again | `discoverTools` > 0 → finalize in place; 0 and current `needs_reauth` → rows replaced by a fresh `pending`; 0 otherwise → unreachable, unchanged | `connected` / `pending` / unchanged | `connectApp` | `meri-managed-mcp.service.spec.ts` |
| `needs_reauth`/`disconnected`/`error` (managed) | `connect` | existing rows deleted, new row created, OAuth started | `pending` | `connectApp` | same |
| any | `disconnect` (owner or admin) | unconditional; credential row deleted; audit | `disconnected` | `MeriMcpOAuthService.disconnect` | `meri-mcp-oauth.service.spec.ts` |
| `pending` | `cancelPending` | only `pending` | `disconnected`, credential deleted | `cancelPending` | same |
| `disconnected` | any `setStatus`, discovery or refresh | `connectionStatus: {not:'disconnected'}`; `discoverTools` returns 0 without I/O | `disconnected` | `setStatus`, `discoverTools` | `meri-mcp.lifecycle.spec.ts` |

## Projection Meri receives (Core `ConnectedAppReadService`) and what the model sees

| Core row | `list_connected_app_reads` | `read_connected_app` page | Model result in Meri |
|---|---|---|---|
| `connected`, enabled, tool in allowlist and read-only, catalog-approved | capability listed; `status:'ok'` | `ok` (recorded `tools/call` result), `partial` (`provider_result_exceeds_safe_json_boundary`), `unavailable` (`provider_reported_error` when the provider returns `isError`, `provider_result_unavailable` for a non-object result) | page JSON with the provider result; one receipt |
| `needs_reauth` | absent | `permission_required` / `connection_permission_required`, no content | page JSON plus notice: reconnect under Connected apps, do not retry |
| `disconnected` or `pending` | absent | `disconnected` / `connection_disconnected`, no content | page JSON plus notice: connect under Connected apps, do not retry |
| `error`, disabled, unapproved tool, narrowed allowlist | absent | `unavailable` / `current_read_schema_unavailable`, no content | page JSON |
| no usable row at all | `status:'unavailable'`, `capabilities:[]`, `managedAvailability` from the managed catalog | n/a | page JSON plus notice: no connected app is usable |
| authority or connection revision changed during the read, foreign owner/tenant | 403 | 403 | `ACCESS_DENIED: … not permitted for this user, client or conversation now.` |

Meri-side refusals before any Core request: grant revoked, expired, narrowed, re-issued to another actor/tenant or policy revision → `UNAVAILABLE`; endpoint/URL/credential-bearing or URL-valued arguments → `INVALID_ARGUMENTS`; a read not mounted at start is denied at the PreToolUse hook even if a later snapshot widens the grant. Every failure text is one closed code, the tool name and a fixed sentence; no bearer, secret, origin or URL appears.

## What this change added

- `packages/contracts/test/retrieval-connected-apps.test.mjs`: table over every read-page `(status, reason, content, providerResult)` combination, request binding, directory `ok ⇔ at least one capability`, and argument-borne endpoint/URL/credential refusal at any depth.
- `apps/gateway/general-reads/test/connected-apps-fixture.mjs`: the shared scene (moved out of the runtime test) and the recorded provider corpus (`tools/list`, `tools/call` success, tool-level denial, expired token) bound to the Core page each connection state yields.
- `apps/worker/conversation/reads/test/connected-apps-execution.test.mjs`: real `meri_reads` MCP server → worker transport → control composer → gateway → fixed Core HTTP source, table-driven over the corpus; actual provider content returned to the model; native credential and service secret bound per call; revocation, expiry, Core 403, late revocation, URL/credential arguments, skill narrowing, foreign actor, call ceiling.
- `apps/worker/conversation/reads/test/connected-apps-server.test.mjs`: table-driven mid-run availability transitions (narrowed, revoked, expired discovery/installation, other actor/tenant/policy revision, foreign operation, widened grant) and the precise connector notices.
- `apps/worker/conversation/reads/results.mjs`: secret-free notices for `disconnected`, `permission_required` and an empty directory.
- `apps/runtime/read-context/source-read-context.mjs`: a URL, credential or malformed connected-app selector is `INVALID_ARGUMENTS` (previously surfaced as `UNAVAILABLE`).

## Remains live-only

- A real provider grant on an isolated account and one real read against an explicitly authorized resource (Core PR 357 describes the prepared Airtable `get_table_schema` case).
- The real OAuth round trip (start → provider → callback → discovery → finalize) and the callback route/configuration activation (`CLIO_MCP_OAUTH_REDIRECT_URI`, `OAUTH_STATE_SECRET`, `OAUTH_TOKEN_ENCRYPTION_KEY`, per-app client credentials) on the deployed Core.
- Directory statuses in the deployed frontend after real discovery; the unknown-create reload behaviour (frontend PR 391).
- Shared Chrome/Krisp grants are never revoked by any test here.
