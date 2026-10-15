# Fable completion return, 15 October 2026: dot's completion packet, lanes 1 and 2, and the dependency packet

Repository `neo-capiro/meri-greenfield`. Branch `fable/meri-complete-20261015` from the exact pin `b5be44d5141ae5fd3830aed789cb7ad525506c4e` (tree `efc4b7bf87480d65fc4e6090c2a83b8e6d9dcf4d`). Source completion and project completion are reported separately, as dot requires: this return completes Fable's authorized source lanes; it is not a finished Meri deployment.

## 1. §11 commit ledger

| Commit | Tree | Content | Status |
| --- | --- | --- | --- |
| `b5be44d5141ae5fd3830aed789cb7ad525506c4e` | `efc4b7bf…` | pin (dot: ACCEPT SOURCE ONLY for `e32353f`, ACCEPT CANDIDATE RECORD, ACCEPT EVIDENCE PUBLICATION) | base |
| `9430eed2acb7eaa86f6459158d0000cbef433fe1` | `38e6103a…` | lane 1: two-distinct-target race control; return-report corrections | source, for dot's review |
| `746fc5bf63398da982fe76032afbf0a2bf92eced` | `60e19ae4…` | lane 2: retention subsystem (purge disabled), revision 3, revised stand-in packet, `control-retention` suite | source, for dot's review |
| evidence commits after these | see `git log` | `lane1/`, `lane2/`, this return, cleanup receipt, manifest | evidence only |

Exact SHAs of the evidence commits are in the branch history; the manifest is rebuilt at the final commit and verified remotely (section 6).

## 2. Changed files

Lane 1: `apps/runtime/native-authority/test/allocation-exclusion-pg.test.mjs`, `docs/coordination/reports/FABLE-RESUME-RETURN-20261015.md`, `docs/qualification/candidates/fable-resume-20261015/README.md`.
Lane 2: `apps/control/retention/{boundary,policy,inventory,ledger,memory-journal,suppression,storage-port,purge,reconciliation,index}.mjs`, `apps/control/retention/schema/retention.draft.sql`, `apps/control/retention/test/{fixture,policy-inventory,ledger-suppression,storage,purge-reconciliation}.*`, `docs/coordination/reports/FABLE-RETENTION-DELETION-PROPOSAL-V3-20261015.md`, `docs/coordination/reports/FABLE-STANDIN-APPROVAL-PACKET-20261015.md`, `scripts/qualification/local-baseline/suites.json` (one line).
No proof row, contract, lock, migration or Dockerfile changed in either lane: `source-proof` 5/5 at `9430eed`; the 45 rows are at the `fable-20261015` candidate bytes.

## 3. Tests, commands, environment and results

Runner: `node scripts/qualification/local-baseline/run-suites.mjs --out <dir> --repo /home/user/meri-fable-complete --only <suites>` as uid 30033 with the scrubbed environment, Node v24.21.0, PostgreSQL 16.15 local clusters, migration isolation attestation. Each `RESULTS.json` records head, tree, uncommitted-path count, the exact command per suite, exit code, counts and stdout/stderr SHA-256.

| Suite | Commit | Result | Record |
| --- | --- | --- | --- |
| source-proof | `9430eed` (clean) | 5/5 | `lane1/` |
| conversations-tests | `9430eed` (clean) | 246/246 | `lane1/` |
| native-authority | `9430eed` (clean) | 349/349 (pin 342/344; +5 new controls, two restorer failures fixed at `e32353f`) | `lane1/` |
| control-core | `746fc5b` (one untracked evidence directory) | 260/260 | `lane2/` |
| control-retention | `746fc5b`, then the evidence commit (clean) | 10/10 | `lane2/`, `lane2/rerun-clean/` |
| scripts-local | `746fc5b` | 27/27 | `lane2/` |

Initial failures and reruns are retained in the candidate README (lane 2: the hung storage call and the re-parsed policy).

## 4. Gate-by-gate status (definitions unchanged; the handoff's §7 and §10 remain authoritative)

| Gate | Status | Dependency |
| --- | --- | --- |
| W00–W01 / REL01–02 | local-artifact (ledger reconciliation at PR86, earlier return) | dot review |
| W02 / G1 | UNRUN live; local-artifact only (image recipe trace, wheel verification, Node zlib comparison) | admitted image, scan table, base-digest policy (shipping) |
| W03 / G2 | draft packet only | shipping owner inventory |
| W04 / G3 / REL03,06 | source tests at the pin | source bindings, two-tenant live cases |
| W05 / durability | ACCEPT_SOURCE for gap 5 (`e32353f`); lane 1 race control at `9430eed` for review; completion/next-run journals at the pin | Temporal, dedicated DB, admitted image |
| W06 / UI integration | UNRUN | frontend owner binding |
| W07 / artifacts/browser | local-artifact (host-profile wheels); gate UNRUN | artifact bucket/KMS/grant, dedicated browser host |
| W08 / G5 | UNRUN | current authority bindings |
| W09 / REL09 / G6 | UNRUN | held-out suites need live bindings |
| W10–W11 / G6–G7 | UNRUN | admitted candidate, shipping action |
| Retention/deletion (§10) | ACCEPT_SOURCE candidate: policy, ledger, suppression, storage semantics, planning, reconciliation with purge disabled (`746fc5b`) | migration allocation, evidence sink, bucket holds, legal values, read-path wiring |
| First usable authenticated chat | UNRUN | every binding in dot's §6 |
| Two-turn and recovery rehearsal (real CLI) | HOLD | one-time approval of the stand-in packet step 2 |

Image digest and deployment receipts: none; nothing was built, scanned or deployed.

## 5. Outstanding owner decisions and dependencies

1. Dot: review of `9430eed` and `746fc5b`; ACCEPT or HOLD.
2. Central owner: migration allocations (`0010`, artifacts `0002`); then Fable writes the PostgreSQL retention adapter and the trigger amendment.
3. Shipping: evidence sink binding and write-once semantics; product bucket lock/hold configuration; the §6 binding inventory.
4. Product and legal: cooling period, per-class retention, policy id and version.
5. Environment owner: one-time approval of the stand-in packet step 2 (or decline).
6. Dot's source owner: contracts metadata regeneration, worker candidate record, allocation check (in progress, not touched here).
7. Frontend and backend owners: authority and preview-session integration.

## 6. Cleanup and retrieval

Clusters stopped, no uid 30033 process, no extra CA, no hosts mapping, Codex shim unchanged, worktree clean at each evidence commit (`CLEANUP-RECEIPT-complete.json`). `MANIFEST.sha256.json` at the final commit lists every tracked deliverable; every entry is fetched back from GitHub at that SHA and matched by hash and size before this return is reported.
