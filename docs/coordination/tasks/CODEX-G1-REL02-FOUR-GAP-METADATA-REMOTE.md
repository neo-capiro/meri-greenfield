# H4 REL-02 four-file structural gap allocation

Owner: Codex remote pickup `01a12b12-337d-7a01-9f8b-b790558c9d00`. Worker: one bounded Hermes H4 session. Exact base `354631c2548d5702bf51fd9f4667c57f90ee8761` on `task/remote-rel02-four-gap-20261011`. This is **read-only source metadata recovery**, not contract, handler or gateway implementation.

## Objective and source

The accepted scope is 139 native IDs: 96 selected and 43 deferred. The published 93-intent report names 86 literal input schemas, two partial enum imports and five absent federal-market schemas. Independently inspect exactly the four frozen `neo-capiro/capirov2@fd8765ec01d292013758606204f2c9d886cd31c1` files below through Git object reads, verify their blob IDs and raw SHA256, and produce a reviewable field/enum/dispatch metadata report for the seven structural gaps. Separate advertised structural schema, helper defaults/coercions, and actual result/authorization unknowns. Propose narrow next contract tasks and ownership; do not claim complete output contracts or parity.

Read this repository's `AGENTS.md`, implementation standards, the remote pickup and continuation instructions, the existing `CODEX-G1-REL02-REMAINING-CAPABILITY-METADATA.md` report, canonical scope ledger/catalog and affected frozen source context. The Capiro checkout at `C:\dev\capirov2` is dirty and **read-only**; use `git -C ... show <exact-commit>:<exact-path>` rather than its working tree. No current Capiro code may be copied into greenfield.

| Frozen path | Expected Git blob |
| --- | --- |
| `apps/api/src/federal-spending/federal-market-meri-tools.service.ts` | `7c5b09c86ca519996d63cecb8c95d7b54bad5c6b` |
| `apps/api/src/retrieval/retrieval-v2.types.ts` | `71f80b0d94d78537ab6c5f150ab7960417d319d0` |
| `apps/api/src/meri/meri-data-search.helpers.ts` | `3194549806fa74147ab61d2ba40ef4182bee42f7` |
| `apps/api/src/meri/meri-client-context.helpers.ts` | `b35e0d20396a4a2a8764ab2c8dab4db7d7df12e4` |

## Ownership and verification

The only writable tracked path is new `docs/coordination/reports/CODEX-G1-REL02-FOUR-GAP-METADATA-REMOTE.md`. This task brief is root-owned and read-only to the worker. All schemas, catalog, validators, tests, contracts, locks, migrations, and other reports are read-only. Owned scratch may be written only under ignored `.task-inputs/remote-rel02-four-gap-1/`; do not print or commit private source excerpts, credentials, customer records or ignored raw captures.

Record a short implementation outline in the report before substantive extraction: canonical owners, exact inputs/outputs, no runtime authority, failure/unknown boundaries, and verification. Verify exact commit/blob/raw SHA256 before reading facts. Reconcile the seven gaps against the canonical selected ledger and state explicitly what the four files cannot establish. Provide source file/line coordinates for each extracted fact, but paraphrase behavior rather than copy source bodies. No product checks are claimed; run focused read-only integrity/count checks, record exact commands/exits and report any failed attempt. Return a clean documentation commit, changed-path list, evidence hash, and a finite next-task proposal for Codex review.

Maximum 25 agent turns and 30 minutes wall time, final five turns reserved for verification/report/commit. No AWS, GitHub writes, network acquisition, source connection, native/Docker execution, provider/model calls other than the Hermes coding session, paid job, credential read, child/background agent, merge or deployment. End the session after the handoff. Codex will independently inspect the commit/evidence and verify physical process exit.
