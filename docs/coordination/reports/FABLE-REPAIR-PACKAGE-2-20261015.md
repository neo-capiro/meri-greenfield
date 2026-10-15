# Fable repair package two (meri-greenfield), 15 October 2026

One integrated candidate for dot's re-review, answering the [successor review at aac91640](https://github.com/neo-capiro/meri-greenfield/blob/aac9164001b087e072b22dafc66bc89915662c75/docs/coordination/audits/meri-comprehensive-20261015/SUCCESSOR-REVIEW-20261015.md) and audit step 1/2 of the [comprehensive audit at 82a01508](https://github.com/neo-capiro/meri-greenfield/tree/82a015083f1965851ffddbc05d4f181bb90ecac2/docs/coordination/audits/meri-comprehensive-20261015). Branch `fable/repair-package-2-20261015`. Every candidate stays HOLD until dot re-reviews the exact pins below; nothing here is accepted, activated, deployed or migrated.

## Composition

The integration branch starts at the P2a repair tip and merges each lane tip unchanged (no conflict resolution was needed). Each lane branch remains pushed at its own pin for focused review; its lane report is in `docs/coordination/reports/`.

| Lane | Branch | Pin | Base | Answers |
|---|---|---|---|---|
| P2a repairs | `fable/p2a-r-readiness-plugin-20261015` | `743ae370` | `ff52b9ea` (P2a) | P2a-R1 readiness, P2a-R2 plugin path, stale summaries, telemetry proposal T1–T4 |
| L1 | `fable/a1-pause-checkpoint-20261015` | `3dceab53` | `ff52b9ea` (P2a) | audit L1 pause/approval.wait vs checkpoint race |
| L5 + SEC-REL-01 | `fable/a2-cancel-proxy-route-20261015` | `0d88e209` | `e046be84` (P2b) | audit L5 cancel stop, SEC-REL-01 proxy query |
| P2b repairs | `fable/p2b-r-download-sync-20261015` | `246667a9` | `0d88e209` | P2b serving synchronization, stale proof rows (candidate d), test hygiene |
| DA-1/DA-4 | `fable/a3-retention-safety-20261015` | `59d8504b` | `ba40647c` | audit retention safety |
| DA-2/DA-3 | `fable/a4-artifact-internals-20261015` | `fb71cfc3` | `ba40647c` | audit artifact internals |
| Scope ledger | `fable/a5-scope-ledger-20261015` | `9fce47df` | `e76189da` (P3 design) | audit step 2 final scope/ownership ledger |
| P2c repairs | `fable/p2c-r-structure-policy-20261015` | `ac081740` | `31ed4a73` (P2c) | H1–H5, approval-port proposal, report corrections |

Integration-only commits after the merges:

- Candidate manifest e: the merged L1 change alters the hashed `apps/control/conversations/postgres-store.mjs` row, so the source proof needs a new candidate. `candidate-manifest-fable-20261015e.json` is derived mechanically from d (d preserved byte-exact, SHA-256 `28b38f7e…555f5`): 17 changed rows, 28 unchanged; the one row changed since d names d's bytes. Status stays `CANDIDATE_HOLD_SOURCE_REVIEW`. The source proof now selects e and chains d.
- Scope ledger regeneration: the integrated tree contains the P2a 43-name guard test, so the excluded-reference scan classifies one more file (`guard-test`). Counts unchanged: 96 included, 43 excluded.
- [Owner decisions of 15 October](FABLE-OWNER-DECISIONS-20261015.md) with proposed D015 text for dot.

## Checks on the integrated tree (Node v24.21.0, `MERI_REVIEW_SOURCE_ROOT` set)

| Suite | Result |
|---|---|
| `apps/worker/conversation` (test, browser, continuation, skills) | 236/236 |
| Structure + graders | 26/26 |
| Control hold composition + hold failure (synthetic) | 13/13 |
| Runtime artifacts | 26/26 |
| Runtime link mount, broker cleanup, Temporal authorization, prepared Temporal (module mocks) | 24/24 |
| Gateway tenant budget | 15 pass, 1 skip (real PostgreSQL) |
| Retention (planning/recovery, journal lease, purge safety, PG file) | 26/26 |
| Artifacts DA-2/DA-3 | 6 pass, 1 skip |
| Source proof + scope ledger + general-reads inventory | 31/31 |
| Proxy ingress (Python unittest) | 25/25 |
| Full runtime `npm test` | 189/196; 7 environment failures, listed below |
| Full control conversations | 188/195; 7 `-pg` files need database environment variables |

Runtime environment failures, all also failing outside this package:

- `image-closure`: no Docker daemon.
- `process` ×3: the host exports ambient AWS variables (`RUNNER_AMBIENT_CREDENTIAL_REFUSED`); unset, they fail on running as root.
- `runner-bootstrap-files`: root user.
- `prepared-candidate`, `prepared-candidate-config`: `@aws-sdk/client-s3` not found. **Pre-existing finding:** `apps/runtime/prepared-candidate.mjs` (since `3c0648f7`) imports `@aws-sdk/client-s3`, which `apps/runtime/package.json` does not declare; it resolved only through a stale hoisted root install. With that install present both files pass 30/30. Proposal below.

Lane reports carry the reverted-fix proofs (each new regression fails without its fix) and lane-level counts.

## Proposals for dot (not implemented here)

1. Declare `@aws-sdk/client-s3` (exact pin matching the storage package's reviewed version) in `apps/runtime/package.json` and update its lockfile, or move the S3 client construction behind the storage package. Lockfile change, so it needs approval.
2. Dependency review: `saxes` 6.0.0 + `xmlchars` 2.2.0 added as root dev dependencies (P2c, own commit `aff11390`); the image owner should confirm dev dependencies stay installed in the worker image or reclassify ajv, ajv-formats, canonicalize and saxes as runtime dependencies.
3. Candidate manifest e: freeze or reject.
4. Contracts: `HOLD_CHECKPOINT_FAILED` in the conversation-lifecycle contract (L1); telemetry receiver T1–T4 (P2a); browser approval-port binding list and `meri-browser-approval-request/2` (P2c); download-link linearization point and an optional authority revocation epoch (P2b).
5. Retire the legacy `/v1/execution/start` route or confirm a qualification-only caller (L5); align `apps/proxy/qualification/offline-policy.mjs` with the closed query (SEC-REL-01).
6. Add D015 from the owner-decisions report to `DECISIONS.md`.

## Not run

Real SDK sandbox startup on a qualified host, live CLI → proxy → provider, Playwright/Chromium and egress measurement, native Office/PDF rendering, real PostgreSQL migrations and privilege/isolation, Temporal server replay, ECS termination within the cleanup bound, Docker image build/scan/admission, AWS and deployment. None is authorized or possible offline.

## Frontend

The frontend portable-evidence bundle for capiro-frontend is produced separately (dot's checklist) and reported with its own pins; it is not part of this repository's package.
