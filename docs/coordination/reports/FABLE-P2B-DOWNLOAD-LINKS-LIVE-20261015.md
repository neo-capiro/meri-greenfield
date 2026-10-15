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
| Recheck after the final async reads (HOLD item 1) | The last authority read preceded the download body and suppression reads. | At `e046be84`: after the body and the post-body generation read, current authority is re-read (same actor, same scope digest, unexpired session). **Incomplete** (successor review): that authority read was itself the last await, so a suppression or barrier closure committed during it was not observed. Superseded by the successor-review repair below (final generation read after the final authority read). |
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
6. **Candidate provenance (HOLD item 4)**: at `e046be84` `scripts/qualification/assembled-image/source-proof.test.mjs` failed
   (`apps/runtime/config.mjs` hash differs from candidate `fable-20261015c`) and this lane left the rows unrefreshed. The successor
   review named these stale rows; they are now recorded in a new Fable candidate `fable-20261015d` (see the successor-review section).
   It is still a source-review candidate only; dot freezes or rejects it.

For the shipping owner: create and mount the key file; grant the four read-only bucket permissions; keep load-balancer logs to the
request line (no body capture); account-level Block Public Access is not verified by this source.

## Checks at `e046be84` (historical; Node v24.21.0, scrubbed environment: `env -i PATH HOME TMPDIR LANG`)

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

## Successor-review repairs (15 October 2026)

Branch `fable/p2b-r-download-sync-20261015`, base `0d88e209` (`fable/a2-cancel-proxy-route-20261015`: P2b `e046be84` plus the L5 and
SEC-REL-01 repairs). Worktree `/home/user/meri-p2b-r`. Acceptance: `SUCCESSOR-REVIEW-20261015.md`, P2b row and owner action 3.

**Status: P2b remains HOLD and its independent review remains incomplete.** That review stopped before a final report and returned
two non-sensitive findings: a pre-response retention/authorization synchronization issue in serving, and stale candidate proof rows.
These repairs address those two findings through ordinary owner changes. They do not complete, retry or replace the stopped review,
and they claim no acceptance. The reviewer's verified financial-liability correction is unchanged (no file under `apps/gateway`
differs from the base). Native PostgreSQL behaviour, privileges, isolation and provenance qualification remain pending.

### Outline (recorded before the changes)

| Finding | Owner | Change |
| --- | --- | --- |
| Serving synchronization | `apps/runtime/artifacts/download-links.mjs` `authorizedRead` | Add a final generation read after the final authority read. Document one linearization point. |
| Stale proof rows | Fable candidate manifests in `scripts/qualification/assembled-image/` | New candidate `d` derived from `c`, with `c` preserved byte-exact. `source-proof.test.mjs` selects `d`. |
| Test hygiene | `apps/runtime/package.json` test script; `artifacts/test/runtime.test.mjs` | Add the module-mocks flag. Write each run's evidence to a fresh directory. |

There is no new module, no new dependency and no change to the retention owner, the token codec, canonical contracts, migrations or
the image recipe.

### Serving synchronization (successor finding 1)

**Verified counterexample at `0d88e209`.** `authorizedRead` read the suppression generation a second time and only then awaited the
final authority read (`current()`). That authority read was the last await before release or signature, so it was the only thing
standing between the last retention check and the bytes leaving. I verified that the generation function is the only retention
check in this path. It reads the same journal rows as the canonical `createRetentionReadGate`, checks the recovery barrier before and
after, and refuses any non-RELEASED subject. Expiry and `life.check()` were the only checks after the authority read, and both are
synchronous.

Six changes committed while that final authority read was pending were never observed, and every one of them succeeded:

| Change committed during the final authority read | `redeem` | `issue` |
| --- | --- | --- |
| Suppression | 200, bytes released | 200, token signed |
| Suppress-and-release cycle | 200, bytes released | 200, token signed |
| Recovery-barrier closure | 200, bytes released | 200, token signed |

**Retention owner semantics (checked, not assumed).**
- `apps/control/retention/suppression.mjs`: suppression appends to the ledger first and projects the journal row second. It records
  `cannotRecall: issuedSignedUrlsUntilExpiry, runningWorkerUntilOwnCleanup`, and an uncertain projection closes the serving barrier.
- The read gate offers no read lease or barrier that suppression waits for. Readers cannot hold anything across release.
- `policy.mjs` requires a positive `coolingPeriodMs` before purge eligibility.
- The DA-1/DA-4 retention-safety branch (`origin/fable/a3-retention-safety-20261015` @ `59d8504b`) changes purge planning and
  execution and PostgreSQL lease reuse. It changes neither the read gate nor the suppression owner. Runtime still composes only the
  read gate, and live purge stays disabled.

**Fix (`3a790efe`).** After the final authority read, `authorizedRead` now awaits one more generation read. That read re-runs the full
canonical journal check (barrier, state, generation) and must equal the generation read before the bytes were fetched. Those two
reads are the last awaited operations. The checks that follow, through release or signature, are all synchronous: actor, scope
digest, session expiry, link expiry and request lifetime. The post-body generation read stays as an early refusal before an
authority read is spent.

**Linearization point.** Each issue or redeem takes effect at its **final authority read**. At that instant the session was observed
current with the same actor and scope digest. Retention was also servable throughout the whole interval: the generation is a
strictly increasing retention ledger sequence, so finding it equal before the byte read and after the authority read proves no
suppression or release committed in between. The barrier was open at both ends, and the states were RELEASED or absent.

What each kind of change means, by when it commits:

| Change | When it commits | Effect |
| --- | --- | --- |
| Suppression, release or barrier closure | Before the final generation read, including during the final authority read | Refused; nothing is released or signed |
| Authority change | Before the final authority read | Refused; nothing is released or signed |
| Suppression or barrier closure | After the final generation read | Ordered after the read |
| Authority change | After the final authority read | Ordered after the read |

"Ordered after the read" means the same thing in both later cases. It is equivalent to the change committing just after a download
that had already completed. This matches the retention design:
- suppression revokes access from its commit onwards, and records issued access it cannot recall;
- purge is a separate step that needs the subject to stay suppressed for a positive cooling period, so no read linearized before a
  suppression can observe a purge;
- a link signed before a suppression is still revoked by it, because its redemption is a new read that sees the advanced generation.

Two point reads of independent stores always leave a final window like this. Closing it would need a read lease that suppression
waits for, and the retention owner offers none. I put the retention check last because the canonical artifact service orders its own
reads the same way: authority first, then `servable` before release.

**Regressions** (synthetic scripted owners in `apps/runtime/artifacts/test/download-links.test.mjs`; four new tests):

| Test | What it covers | At the base source |
| --- | --- | --- |
| 1 | Redeem, for each of the three changes during the final authority read: the expected 410/503 code, the canonical download ran, no bytes released | Fails |
| 2 | Issue, the same three changes: no token signed | Fails |
| 3 | Authority revoked during the post-body generation read (the "final generation read" at the base pin), for both issue and redeem: refused | Passes; guards the order |
| 4 | Pins the documented read order (post-body generation, final authority, final generation). An authority change during the final generation read is ordered after the read. Session expiry is still checked synchronously after it | Fails (its order assertion) |

The existing redeem case "revoked during the final suppression read" is unchanged and still refused.

**Reverted-fix proof.** I restored the base `download-links.mjs` and kept the new tests: tests 1, 2 and 4 failed, and all 17 others
passed. A scratch probe with the base source showed all six counterexamples above succeeding. With the fix, the same probe returned
410, 410 and 503 for each route. The fixed source was then restored; the probe was not committed.

### Stale candidate proof rows (successor finding 2)

**What was stale.** `source-proof.test.mjs` failed at `0d88e209` (and already at `e046be84`). Candidate `fable-20261015c` recorded four
proof rows at bytes that later commits changed:

| Proof row | Changed by |
| --- | --- |
| `apps/runtime/config.mjs` | `a90a7ab8` telemetry, `26149cd2` download-link gate, `6af75bfb` L5 |
| `apps/runtime/control.mjs` | `a90a7ab8`, `26149cd2` |
| `apps/runtime/temporal-worker.mjs` | `6af75bfb` |
| `apps/runtime/test/prepared-temporal.test.mjs` | `6af75bfb` |

No other proof manifest under `docs/qualification/candidates/**` or `scripts/qualification/**` hashes any file this branch changed.
The P2b files outside the 45-row proof set have no rows.

**New candidate (`9ba9c9b5`).** The candidate manifests in this directory are Fable-authored. Each candidate is a new file, and
earlier candidates are never rewritten. The repository has no generator, so I derived `candidate-manifest-fable-20261015d.json`
mechanically from `c` and the current bytes:
- carried unchanged from `c`: historical manifest, prior dot manifest, rule, pickup head and status `CANDIDATE_HOLD_SOURCE_REVIEW`;
- `previousCandidate` is `c`, preserved byte-exact;
- 17 changed rows and 28 unchanged rows.

| Row | `c` sha256 (previousCandidateSha256) | `d` sha256 |
| --- | --- | --- |
| `apps/runtime/config.mjs` | `3bec69435fae9157aeb3d7c5b3181828c5c345dbe25a7259550b39547efd8810` | `3a1a136ddeccac2983040113c9de16a91110a70178964da601c839db8f169b71` |
| `apps/runtime/control.mjs` | `ae032c58f380db2c0165af815ed0f94a6d5d1746ccc7527e81cd4e80e6a51b3c` | `399698afaa8cac6851f9f40590b1bbf0173e73541125a6b25be65af75ad18ee0` |
| `apps/runtime/temporal-worker.mjs` | `d070c8ec2d83857c5488f96326059cb49be1123b4d7ac955ee4100d79de21cea` | `1261353767a00898a27ec368f1914f3a67cacfc6113faf284f6a58d537b1f5d8` |
| `apps/runtime/test/prepared-temporal.test.mjs` (newly enumerated) | `654ba8b9c9b00dc6e83dd92cc561c374e68839179055e006c98cb43f95b8d5ba` (= historical) | `268de545811af6b2e89b04e6f1ae76f4e6493cc7e7d3dbb3b7f8b912052453cc` |

**Source-proof changes.** `source-proof.test.mjs` now:
- selects `d`;
- asserts every earlier candidate byte-exact, including `c` (`0ab37ea1be7b1bb0a966d12a0fe9f244bf32a73647d91feb81cb73355d8dc261`);
- carries every earlier historical hash;
- requires each row changed since `c` to name `c`'s bytes.

`download-links.mjs` (changed here) is not one of the 45 proof rows. No image acceptance transfers to `d`.

### Test hygiene (`fa8aba50`)

- **Module mocks.** Four runtime test files call `mock.module` without `--experimental-test-module-mocks`, so they failed to load
  under the documented `npm test --prefix apps/runtime`: `download-links-mount`, `first-run-mount`, `prepared-candidate-startup` and
  `prepared-candidate-control-lifetime`. The test script now passes the flag.
- **Evidence writes.** `artifacts/test/runtime.test.mjs` wrote with `wx` into the committed historical `test/evidence/` directory, so
  every run failed with `EEXIST`. The `finally` cleanup write masked the earlier `mkdir` `EEXIST`. Each run now uses a fresh
  `mkdtemp` directory: under `MERI_ARTIFACT_EVIDENCE_DIR` when that is set (kept), otherwise under the OS temporary directory (removed
  after the test). Exclusive writes are kept, committed receipts are unchanged, and no generated evidence is committed. I ran it twice
  in a row and got 6/6 both times. With `MERI_ARTIFACT_EVIDENCE_DIR` set, the run retained both DOCX files, the receipt and the
  cleanup record.

### Checks (Node v24.21.0, this host, `MERI_REVIEW_SOURCE_ROOT=/home/user/meri-p2b-r`)

| Check | Before (base `0d88e209`) | After |
| --- | --- | --- |
| `apps/runtime` documented script, without the flag (base script) | 210 tests: 200 pass, 10 fail | n/a (script changed) |
| `apps/runtime` `node --experimental-test-module-mocks --test test/*.test.mjs telemetry/test/*.test.mjs` (`npm test` after the change) | 224 tests: 219 pass, 5 fail | 224 tests: 219 pass, 5 fail (same 5) |
| `apps/runtime` `artifacts/test/*.test.mjs` | 22 tests: 21 pass, 1 fail (`EEXIST`) | 26 tests: 26 pass |
| Link tests (`download-links` and `download-links-redaction`) | 16/16 | 20/20 |
| `apps/gateway/budget/tenant/test/*.test.mjs` | unchanged source | 16 tests: 15 pass, 1 skipped (real PostgreSQL, no socket) |
| `apps/artifacts/storage/test/signed-download.test.mjs` | unchanged source | 4/4 |
| `scripts/qualification/assembled-image/source-proof.test.mjs` | 4/5 (stale rows) | 5/5 |
| `apps/runtime` `npm run typecheck` | not run at base | pass |

The 10 base failures without the flag are the 4 module-mock files that failed at load, the 5 host failures below, and one listener
test ("actual control listener mounts canonical opaque issuance...") that timed out under shared-host load and passes in both flagged
runs.

The same 5 failures occur at the base and after the change. All are host facts, not caused by this lane:
- Docker image closure: no Docker daemon.
- Three runner process tests: the host environment exports AWS credential variables, which the runner refuses as
  `RUNNER_AMBIENT_CREDENTIAL_REFUSED` (names only, no values recorded). With those variables unset, the same tests fail with
  `RUNNER_WORKSPACE_REFUSED` under the root UID.
- `runner-bootstrap-files` cleanup-failure case: root UID.

A rerun as `nobody` failed on permission setup in this worktree (10/10 of those files failed), so I discarded it. The earlier
`e046be84` report records 10/10 for the same files as `nobody` in its own setup.

### Unrun

| Check | Why not run |
| --- | --- |
| Real PostgreSQL tenant-budget case | No migrated database, and running a migration is not authorized |
| Docker image closure, and building, scanning or admitting candidate `d` | No Docker daemon; build, scan and admission are not authorized |
| Real S3 privacy proof, KMS and IAM; live Core authorization; frontend integration | Not available or not authorized in this lane |
| A concurrency test against a real retention journal (PostgreSQL) for the new final read | The synthetic journal shows ordering only. It is not native durability or isolation evidence |

### Proposals for dot

1. Review the documented linearization point. If any authority change committed before release must refuse, rather than only one
   committed before the final authority read, the authority owner needs a revocation epoch or lease that suppression and session
   revocation both respect. That is a Core/retention contract change, not a local fix. This lane did not make it.
2. Freeze or reject candidate `d`. Its rows are source-review provenance only.
3. Update `apps/runtime/README.md` (not owned here) if you want the `npm test` line to mention `MERI_REVIEW_SOURCE_ROOT` for
   `first-run-mount`.

### Residual risks

- After the final generation read there is an irreducible window up to response delivery, and after the final authority read there
  is one up to the final generation read. Both are documented as post-linearization.
- An authority value that changes and then changes back (ABA) between the start and final authority reads is not detected. The final
  value was current at the linearization point.

### Commits

`3a790efe` (serving linearization), `fa8aba50` (test script flag, rerun-safe evidence), `9ba9c9b5` (candidate `d`), then this report.

### Cleanup

All test processes exited with their runs. The OS-temporary evidence directories were removed by the test. The scratch probe was
deleted. Retained evidence from the `MERI_ARTIFACT_EVIDENCE_DIR` run stays only in the session scratchpad, not in Git. `node_modules`
are borrowed through untracked symlinks:
- `apps/runtime` from `/home/user/meri-a2`, whose lockfile is byte-identical;
- all others from `/home/user/meri-fable-complete`.

Nothing was pushed. No other worktree or session was touched.
