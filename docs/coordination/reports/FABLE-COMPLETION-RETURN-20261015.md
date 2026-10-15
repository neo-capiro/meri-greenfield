# Fable completion return, 15 October 2026: dot's completion packet, lanes 1 and 2, and the dependency packet

Repository `neo-capiro/meri-greenfield`. Branch `fable/meri-complete-20261015` from the exact pin `b5be44d5141ae5fd3830aed789cb7ad525506c4e` (tree `efc4b7bf87480d65fc4e6090c2a83b8e6d9dcf4d`). Source completion and project completion are reported separately, as dot requires: this return completes Fable's authorized source lanes; it is not a finished Meri deployment.

## 1. §11 commit ledger

Base `b5be44d5141ae5fd3830aed789cb7ad525506c4e`, tree `efc4b7bf87480d65fc4e6090c2a83b8e6d9dcf4d`. Every commit on `fable/meri-complete-20261015` in order, with its tree and classification; the ledger identifies source and reporting history and does not assert that every check ran at every commit (section 3 ties each receipt to its exact clean or dirty source).

| Commit | Tree | Classification |
| --- | --- | --- |
| `9430eed2acb7eaa86f6459158d0000cbef433fe1` | `38e6103aeaf7e3d0998708dfad204c944585683b` | lane 1: distinct-target journal race control and report corrections; dot: ACCEPT SOURCE ONLY |
| `746fc5bf63398da982fe76032afbf0a2bf92eced` | `60e19ae4c9d9f73968a1710121831fdb1f2c9ca4` | lane 2: retention subsystem, revision 3, revised trust packet; dot: HOLD SOURCE ACCEPTANCE (six corrections, section 2b) |
| `e3eaecccf85780f573ce55413b21304144b11b1f` | `f6e4f4310ffd8a4a86e590947a6c4dc45f553bad` | lane receipts, return and cleanup reporting (evidence; lane 2 record carries one uncommitted path) |
| `47812050be93d97d8716f4369b2f74d6428fc1d7` | `440470ad39d6910b4c1600bf129eebcaefb71478` | lane 1 SHA correction (evidence); the clean source of the retention rerun |
| `7bcc2155cc3214ea5b1efc3f26230e3e0a437a54` | `0169b960de0c6c22cc8028296a0e5704545ef0d2` | clean retention rerun record and rebuilt manifest (evidence) |
| `035390e8aaf3d25089a956d841b74fa11b0f3c5b` | `57c02643286b3533cc7ff2def62d9d68eacd4379` | stand-in source and test change (provider-standin.mjs, provider-standin.test.mjs) plus probe and denial reporting; not evidence-only |
| `d2acf82ad567e26fd894b630436b88fab91c8068` | `d8a08a2f15dcd40aad40edf0e3a1df9945f6ba91` | rebuilt manifest after probe receipts; head reviewed by dot |
| `0662b2fae76135f2f817e9516dadd026e544d70c` | `771a98547bb57521bcfdb12a00fa7cefa3bad082` | cherry-pick of dot's 602d8d4 (provenance metadata regeneration; source-only accepted by dot); authorship preserved |
| `6e1a1fab3f94f72b02a1fbf1dbbbf81c1294bc36` | `6b7a037ba0d34dd9e3387605f02e02125411fe3a` | cherry-pick of dot's c83b7cf (worker validator pin candidate); authorship preserved |
| `7fbf232425fbcb9172e03e561720722154b9efbf` | `f8c1a718f1d303631e90f1b55868a39a2e331105` | cherry-pick of dot's b11a6c9 (clean-source check receipts); authorship preserved |
| `eb4869737d793edf546a0c95e54d415792770aaf` | `79c00a6676a104c29d1e0bbd05b2d510397a8acc` | lane 3: migrations 0010 and artifacts 0002, PostgreSQL retention adapter, S1–S4 runtime slices, candidate manifest b; for dot review |

Evidence commits after the last row (this return, lane 3 receipts, cleanup receipt, manifest) are appended by `git log` and the manifest is rebuilt at the final commit.

## 2. Changed files

Lane 1: `apps/runtime/native-authority/test/allocation-exclusion-pg.test.mjs`, `docs/coordination/reports/FABLE-RESUME-RETURN-20261015.md`, `docs/qualification/candidates/fable-resume-20261015/README.md`.
Lane 2: `apps/control/retention/{boundary,policy,inventory,ledger,memory-journal,suppression,storage-port,purge,reconciliation,index}.mjs`, `apps/control/retention/schema/retention.draft.sql`, `apps/control/retention/test/{fixture,policy-inventory,ledger-suppression,storage,purge-reconciliation}.*`, `docs/coordination/reports/FABLE-RETENTION-DELETION-PROPOSAL-V3-20261015.md`, `docs/coordination/reports/FABLE-STANDIN-APPROVAL-PACKET-20261015.md`, `scripts/qualification/local-baseline/suites.json` (one line).
Lane 3: `apps/control/conversations/migrations/0010_retention.sql`, `apps/artifacts/migrations/0002_retention.sql`, `apps/control/retention/postgres-journal.mjs` (+ `test/postgres-journal-pg.test.mjs`, `suppression.mjs`, `reconciliation.mjs`), `apps/runtime/{temporal-authorization,prepared-run-issuance-store,prepared-run-issuer,prepared-run-bindings,runner-bootstrap-files}.mjs` with their tests, the proof rows `apps/runtime/{config,control,temporal-worker,prepared-candidate-config,prepared-candidate}.mjs` (enumerated in `candidate-manifest-fable-20261015b.json`), `scripts/qualification/assembled-image/source-proof.test.mjs`, `scripts/qualification/local-baseline/provision-postgres.sh`, `docs/coordination/reports/FABLE-RUNTIME-SLICES-OUTLINE-20261015.md`.
Lanes 1 and 2 changed no proof row, contract, lock, migration or Dockerfile. Lane 3 adds the two reserved migrations (source only; no application authority) and changes five runtime proof rows, each enumerated with both hashes, a reason and the decision; no contract, lock or Dockerfile changed; dot's provenance commits change `packages/contracts/dist` metadata only.

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
| Retention/deletion (§10) | ACCEPT_SOURCE candidate: policy, ledger, suppression, storage semantics, planning, reconciliation with purge disabled (`746fc5b`); allocated migrations 0010 and artifacts 0002 with trigger amendments and the PostgreSQL adapter over real PostgreSQL (`eb48697`) | evidence sink, bucket holds, legal values, read-path wiring, trusted-owner migration execution |
| S4 Temporal trusted-client authorization | ACCEPT_SOURCE candidate: one token provider for both pinned 1.24.0 connection types, closed config, wired (`eb48697`) | token issuer (shipping), real-server controls UNRUN |
| S1 durable per-run issuer | ACCEPT_SOURCE candidate over the store contract and disposable adapter (`eb48697`) | central allocation for the issuance store schema; capability authority and secret-store reference model (shipping) |
| S2 production composition | ACCEPT_SOURCE candidate: ports composed from startup-supplied owners, declared multi-run without owners fails startup (`eb48697`) | the genuine two-turn harness with the real CLI (stand-in approval) |
| S3 per-run bootstrap files | ACCEPT_SOURCE candidate: materializer and release with Linux controls (`eb48697`); the per-run transport port is frozen in the outline, not yet wired into the registry | capsule, DNS and certificate delivery (shipping); registry wiring after dot's review of the port |
| First usable authenticated chat | UNRUN | every binding in dot's §6 |
| Two-turn and recovery rehearsal (real CLI) | HOLD | one-time approval of the stand-in packet step 2 |

Image digest and deployment receipts: none; nothing was built, scanned or deployed.

## 4b. Stand-in trust-path probes (after the lanes; no trust change)

Probes N1 and C1 of the packet ran without any trust-store or hosts change (`rehearsal/standin-probes-20261015.json`). Findings: Node consults the system store only with `--use-system-ca`; the pinned CLI 2.1.295 verifies TLS (`tls_untrusted_ca`, cost 0, no request reached the listener) and honors `NODE_EXTRA_CA_CERTS`; with it the CLI probed `GET /api/hello` and posted to `/v1/messages?beta=true`, which the stand-in's exact-path routing refused. The stand-in is corrected (pathname match, hello probe) and covered by `scripts/qualification/first-chat-rehearsal/provider-standin.test.mjs`, which pins a throwaway CA in the client. A rerun of C1b against the corrected stand-in was denied by the permission classifier and is recorded verbatim; C2 needs step 2. The corrected stand-in's routing control is a Node HTTPS client, not the real CLI, and commit `035390e8` is a stand-in source and test change, not evidence-only. C1b did not complete genuine CLI or multi-turn execution. Dot holds execution of both routes; the qualification-only process-scoped extra-CA proposal is written in `FABLE-STANDIN-PROCESS-CA-PROPOSAL-20261015.md` and not executed. A second bounded route (harness-only `NODE_EXTRA_CA_CERTS` in the launch template) is described in the packet for dot's decision; it departs from the product launch environment and is not taken.

## 5. Outstanding owner decisions and dependencies

1. Dot: review of `9430eed` and `746fc5b`; ACCEPT or HOLD.
2. Central owner: allocation for the S1 issuance store schema (the retention allocations `0010` and artifacts `0002` were recorded on 15 October and are now implemented).
3. Shipping: evidence sink binding and write-once semantics; product bucket lock/hold configuration; the §6 binding inventory.
4. Product and legal: cooling period, per-class retention, policy id and version.
5. Environment owner: one-time approval of the stand-in packet step 2, or dot's decision on the harness-only extra-CA route, or decline.
6. Dot's source owner's provenance commits are published, source-only accepted and integrated in order on this branch (0662b2f, 6e1a1fa, 7fbf232); the migration allocations are recorded (0009 confirmed, 0010 and artifacts 0002 reserved for Fable) and implemented at `eb48697`.
7. Frontend and backend owners: authority and preview-session integration.

## 6. Cleanup and retrieval

Clusters stopped, no uid 30033 process, no extra CA, no hosts mapping, Codex shim unchanged, worktree clean at each evidence commit (`CLEANUP-RECEIPT-complete.json`). `MANIFEST.sha256.json` at the final commit lists every tracked deliverable; every entry is fetched back from GitHub at that SHA and matched by hash and size before this return is reported.
