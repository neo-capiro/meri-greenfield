# Lane p2b: signed download links live behind a readiness gate, plus the p1b HOLD corrections

Branch `fable/p2b-download-links-live-20261015`, base `06b2f49` (`fable/p1b-operating-controls-20261015`). Worktree `/home/user/meri-p2b`.
Implementer: Fable. Independent validation and ACCEPT/HOLD: dot. No push, deployment, paid build, migration execution, new credential
or cloud action. Scrubbed: no secret values, tokens, private source or customer data.

## Inputs

- Product owner decision (15 Oct 2026, binding; reconfirmed by Neo): wire signed downloads into the live API once the API verifies the
  current user's access to that exact artifact before issuing a short-lived link, the bucket stays private, and links never reach logs.
- dot's HOLD of p1b `06b2f49`: (1) recheck current authority, actor, scope and expiry after the final asynchronous body and suppression
  reads, immediately before returning bytes; (2) tenant budget: separate concurrency release from financial liability; (3) number the
  tenant-budget migration source as the proposed `meri_product_budget` `0002_tenant_budgets.sql`; (4) candidate provenance hashes are
  stale and must be refreshed by their owner after the corrected source is frozen.

## Implementation outline (recorded before the substantial changes)

| Responsibility | Canonical owner | Change |
| --- | --- | --- |
| Token codec | `apps/artifacts/storage/signed-download.mjs` | unchanged |
| Link HTTP application (issue/redeem) | `apps/runtime/artifacts/download-links.mjs` | readiness fixes below |
| Readiness gate and mount | new `apps/runtime/artifacts/download-gate.mjs`, composed in `apps/runtime/product-applications.mjs`, opened by `apps/runtime/control.mjs` | new |
| Private bucket proof | new `apps/artifacts/storage/s3-private-bucket.mjs`, exposed by `createRuntimeArtifactStorage().verifyPrivate` | new |
| Configuration | `apps/runtime/config.mjs` (single validator) | optional control `downloadLinks` |
| Telemetry redaction | `apps/runtime/telemetry/redaction.mjs`, `http.mjs` | `redactPath`, broader key filter |
| Tenant budget rules | `apps/gateway/budget/tenant/policy.mjs` (kernel), stores, gate | liability separated from concurrency |

Dependency direction: runtime gate -> link application -> canonical document application; gate -> storage verifier only through the
captured `artifactStore` port. Authorization stays with the canonical session owner and the per-request `artifactOptionsOwner`;
revocation stays with the retention journal. No new orchestration, authorization or storage path; no import of Capiro implementation.

## Readiness audit against the decision, and fixes

| Check | Finding at `06b2f49` | Fix |
| --- | --- | --- |
| Issue verifies the current user's authority for the exact version | Issue ran only the canonical **inspect** (`artifact.inspect` authorization for that versionId). Download authority was evaluated only at redeem. | Issue and redeem share one authorized read: canonical inspect, generation, canonical **download** (`artifact.download` for that exact versionId, scope/conversation binding, retention, exact bytes), bytes hash, generation again, then a fresh current-authority read. A link is signed only after all pass. |
| Recheck after the final async reads (HOLD item 1) | The last authority read preceded the download body and suppression reads. | After the body and the final generation read, current authority is re-read (same actor, same scope digest, unexpired session); redeem then checks link expiry and releases with no further await. |
| Storage access only through the private store | Bytes flow only through the canonical download over the S3 adapter (`ExpectedBucketOwner`, SSE-KMS, server-side GetObject). No presigned or public object URL exists anywhere in `apps/` (searched). Privacy of the bucket itself was not verified. | Read-only `verifyPrivate` proof (all Block Public Access settings, policy status not public, `BucketOwnerEnforced`, versioning Enabled) is a gate precondition. |
| TTL short and bounded | Default 60 s, max 300 s, capped by session expiry. | Unchanged; now configurable only within 1000–300000 ms and covered by tests. |
| Token kept out of URLs/logs | Token is in the POST body (never in a URL). Telemetry recorded the raw `url.path`, so a client that put a token in a path would export it. Keys filter lacked `secret`/`signature`. No HTTP access log exists; Hono writes no request line. Errors carry closed codes. | `redactPath` on `url.path`; key filter adds `secret|password|signature`; redeem authenticates before parsing a token; query-string tokens refused; real-listener redaction test. |
| `Cache-Control: no-store`, `Referrer-Policy: no-referrer` | JSON and canonical download responses were `no-store`; no `Referrer-Policy`; canonical refusals passed through without hardening. | Every link-route response (success, canonical pass-through, gate refusal, error) is forced to `no-store`, `no-referrer`, `nosniff`. |
| Audit records | No audit write exists in the link flow; nothing records a token. | Proposal below (audit without token). |

## Mount and gate design

`createRuntimeProductApplications` wraps the canonical document application in `createDownloadLinkGate`. The routes
`POST /api/documents/links/{issue,redeem}` answer `503 {"error":{"code":"DOWNLOADS_UNAVAILABLE"}}` until `startControl` opens the gate
(after assembly, before readiness and listen); every other route is unchanged. Opening requires, in order: `downloadLinks.enabled`,
declared retention serving, the `artifactOptionsOwner` port, the `artifactStore` port with a passing `verifyPrivate`, and the key file
through `readSecret` (>= 32 bytes, read last). Closed reasons: `DOWNLOAD_LINKS_DISABLED`, `DOWNLOAD_LINK_RETENTION_UNAVAILABLE`,
`DOWNLOAD_LINK_AUTHORIZATION_UNAVAILABLE`, `DOWNLOAD_LINK_STORE_UNAVAILABLE`, `DOWNLOAD_LINK_STORE_UNVERIFIED`,
`DOWNLOAD_LINK_KEY_UNAVAILABLE`; `startControl` returns `downloads:{enabled,reason}` and the CLI prints the reason. Control still starts
when the gate is closed. Only an aborted startup rejects. The nativeCandidate composition has neither port, so its gate stays closed.

Signing key (shipping owner, no value): owner-only file named by `downloadLinks.keyFile` (example `/run/secrets/meri-download-link-key`),
at least 32 CSPRNG bytes, control role only. Rotation: replace and restart control; outstanding links (<= 5 min) become
`DOWNLOAD_LINK_INVALID`, no dual-key window needed. Required read-only IAM on the artifact bucket for the control role:
`s3:GetBucketPublicAccessBlock`, `s3:GetBucketPolicyStatus`, `s3:GetBucketOwnershipControls`, `s3:GetBucketVersioning`.

## Tenant budget (HOLD items 2 and 3)

Release now frees only the concurrency slot; the hold remains liable (states `HELD`, `RELEASED`) until `SETTLED` (measured usage) or
`NOT_DISPATCHED` (authoritative no-dispatch proof via the new `notDispatched` gate method / `recordNotDispatched` store port). Settlement
after `NOT_DISPATCHED`, proof after settlement and a second settlement with a different amount are `TENANT_SETTLEMENT_CONFLICT`; the
identical settlement replays without a further charge (stated explicitly because "double settle refused" could be read either way).
The exact reported sequence (cap 100: reserve 100, release, reserve 100) is now refused; a mutation that counts only `HELD` holds fails
the regression and two variants. The DDL is authored at `apps/gateway/budget/migrations/0002_tenant_budgets.sql`, the path
**RESERVED** for Fable (source authoring only) by `docs/coordination/tasks/CODEX-TENANT-BUDGET-0002-ALLOCATION-20261015.md` (central
commit `1b61483d`). It encodes the corrected liability design (four states, `not_dispatched_at`), not the held p1b state machine; the
allocation is numbering only and the DDL awaits dot's review. Collision recheck immediately before finalizing: all 266 fetched remote
`dot/*`, `fable/*` and `main` refs inspected, no product-budget 0002 elsewhere, every 0001 blob `bc0ff007...` (unchanged here), latest
register head `7606375d` records only this reservation; no conversation 0012/0013 used. Never executed; no grant, role, seed or default
cap; the local-baseline provisioning script does not list it. The fetch refreshed remote-tracking refs in `/home/user/meri-greenfield`
only (no checkout, branch or file change). The tenant gate remains unwired.

## Redaction evidence

`apps/runtime/artifacts/test/download-links-redaction.test.mjs` drives issue, redeem and seven token-carrying refusals (wrong actor,
forged signature, malformed JSON, token in query, token in path, extra field, revoked, expired) through the real `listenRuntime`
loopback listener with `instrumentApplication` over in-memory OpenTelemetry providers, and asserts that the token, its claims part, its
signature part and a 40-character claims prefix appear in none of: captured stdout/stderr/console output, span names/attributes/events/
status, metric attributes, refusal bodies. Negative controls run in this lane (not committed): removing `redactPath` fails the test;
logging the token in redeem fails it with "process output must not contain any part of a signed link".

## Scope note on mounting

The 0002 allocation record states that "the tenant gate and signed links remain unmounted" as a boundary of that documentation change.
This lane mounts the signed links (gate closed by default) on the product owner's 15 October decision as relayed and reconfirmed by the
lead; the tenant gate is not mounted. If dot reads the allocation record as withholding the mount, the gate can stay closed by omitting
`downloadLinks` from configuration with no code change.

## Proposals (not edited here)

For dot (Core/frontend/composition owners):
1. **Frontend**: call `POST /api/documents/links/issue {versionId}` then, within `expiresAtMs`, `POST /api/documents/links/redeem {token}`
   with the same Bearer action session and `application/json`; save the response bytes as a blob. Never place a token in a URL, query,
   fragment, `href`, history or storage; treat it as a password; show `DOWNLOADS_UNAVAILABLE` as a disabled control.
2. **Composition**: the trusted `productPortsFactory` must supply `artifactStore: createRuntimeArtifactStorage(...)` (the same storage the
   options owner uses) and `artifactOptionsOwner`, and the control configuration must declare `retention` and `downloadLinks`.
3. **Core authority**: an authorize-only probe for `artifact.download` on one versionId (no byte read) would remove the issue-time byte
   read; a Core readiness method on the authorization owner would let the gate verify more than presence.
4. **Audit**: record link issuance and redemption (versionId, actorId, tenantId, expiresAtMs, outcome code; never the token or its MAC).
5. **Tenant budget**: name the owner that produces authoritative no-dispatch proof (for example the durable dispatch ledger showing no
   provider request for the run) before `notDispatched` is wired; review the authored 0002 DDL (the allocation did not accept it).
6. **Candidate provenance (HOLD item 4)**: `scripts/qualification/assembled-image/source-proof.test.mjs` already failed at `06b2f49`
   (`apps/runtime/config.mjs` hash differs from candidate `fable-20261015c`). This lane further changes proof rows
   `apps/runtime/config.mjs` and `apps/runtime/control.mjs`. Not regenerated here: refresh through the provenance owner after the
   corrected source is frozen, preserving prior manifests.

For the shipping owner: create and mount the key file; grant the four read-only bucket permissions; keep load-balancer logs to the
request line (no body capture); account-level Block Public Access is not verified by this source.

## Checks (Node v24.21.0, scrubbed environment: `env -i PATH HOME TMPDIR LANG`)

| Check | Result |
| --- | --- |
| `apps/artifacts/storage` `node --test test/*.test.mjs` | 37/37 pass (baseline 33/33) |
| `apps/gateway/budget/tenant/test/*.test.mjs` | 15 pass, 1 skipped (real PostgreSQL case needs `MERI_TENANT_BUDGET_PG_SOCKET`; baseline 10 pass, 1 skipped) |
| `apps/runtime` `tsc --noEmit -p tsconfig.json` | pass |
| `apps/runtime` `--experimental-test-module-mocks --test --test-concurrency=1 test/*.test.mjs telemetry/test/*.test.mjs artifacts/test/*.test.mjs` | 225/232 pass; the same 7 host-fact failures as the baseline run at `06b2f49` (210/217): Docker daemon absent (image closure), root UID (3 runner tests, 1 bootstrap test), one-shot evidence `EEXIST` (artifact runtime real-compiler test), `first-run-mount` without `MERI_REVIEW_SOURCE_ROOT` |
| Root-UID tests rerun as `nobody` (`test/process.test.mjs`, `test/runner-bootstrap-files.test.mjs`) | 10/10 pass |
| `test/first-run-mount.test.mjs` with `MERI_REVIEW_SOURCE_ROOT` | 9/9 pass |
| `apps/runtime/artifacts/test/runtime.test.mjs` in a disposable worktree at `26149cd` with an empty evidence directory (worktree removed after) | 6/6 pass |
| `scripts/qualification/assembled-image/source-proof.test.mjs` | 4/5; the provenance row failure pre-exists at `06b2f49` (see proposal 6) |

Unrun: Docker image-closure build (no daemon); real PostgreSQL tenant-budget case (no migrated database, and executing the migration is
not authorized); real S3 privacy proof against a bucket and real KMS/IAM; live Core authorization; frontend integration; the full
`apps/artifacts/test` office/LibreOffice suite (not touched by this lane beyond storage, whose suite passed). Scripted SQL, synthetic S3
replies and in-memory telemetry are not live policy, storage, durability, Fargate or release evidence.

## Cleanup

All test processes exited with their runs; the disposable worktree `/tmp/meri-p2b-scratch-wt` was removed; donor `node_modules`
(`/home/user/meri-fable-complete`, `/home/user/meri-fable-resume`) are borrowed through untracked symlinks and unchanged. Other
worktrees and sessions were not touched.
