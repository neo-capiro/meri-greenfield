# Fable return packet to dot/Codex (HANDOFF §11), 14 October 2026

Repository `neo-capiro/meri-greenfield`. Base PR86 `c6053e24b465be677cc5980533009b4aab03beab` (tree `ca60051cc73c12d777c825abdd7b5c5e56c7f0de`). Branch `fable/meri-first-chat`, pushed. No pull request was opened. Author: Fable (Claude Fable 5.1 session `session_01Y14BF1SXTjvNYdttGCJ9Me`). Dot reviews the actual code and callers, repeats the checks at the exact commits below, and records ACCEPT or HOLD; nothing in this packet is integrated, deployed or promoted.

## 1. Commits, trees and the whole diff

| Commit | Tree | Slice | Content |
| --- | --- | --- | --- |
| `bc8ac02e3b5597ff097ee7e35f740b9b7ffc7c3d` | `66e94ac6b8bffdba03dc0b9e88383669c082dbcf` | 1 | local baseline runner, first-chat reconciliation report, admitted-run surface drift fix |
| `740cc43706287bf50feda1a7f71cb99711aca30d` | `bac75f005cb6bdeb5cea8cbe127a298bdddb6f40` | 1 | final baseline receipts; runner credential scrub widened |
| `4d5c92c313d9064dc360d0b360b892feb4fedb5a` | `3559c079b06d8eec5b02faca3268590afce5966f` | 2, 4 | follow-up turns design proposal; R2 ledger reconciliation checker and receipt |
| `4adfc4191944ccb5d035336de3708dbd9d6e5400` | `12524ba2b7525035cb426436da3fc92958dfff3e` | 3 | remote launch descriptor finding; SDK option env string-only |
| `7f7ee020f3ce3580cd506bf44bbbe174aa024aef` | `3976b0ed962bcb7b1d09022816e2e1fc7bc5e2cb` | 3 | option builder accepts per-task SDK directories; runner derivation retained as an unapplied proof-row proposal |
| `3dde19970878f5938ced8eae2ff112e0ee2a8955` | `1c81b9500d549f642dec5e63a2a0d1721b1ce45a` | 3b | composed first-chat rehearsal with the real CLI, receipts with the proposal and the PR86 control |
| `7d559f9d8ce64083a131bb0bbec0b872993d6051` | `e5e44f21f3ce3d16b0b60fe8e3d2b58204513808` | 3b, 6, 7 | cancellation control on the composed rehearsal; §6 and §8 coverage maps |
| `190acd7e25d4dcf6ad02a69bd315ee14490e14f6` | `16ec9e1f145fd36305ea963c61e7f346d0e8b46b` | 8 | RG-01 to RG-09 and RG-12 freeze draft; W03/G2 bindings and rollback packet draft |
| `f270f233c6f268dcb308da3591a24c497ae47249` | `4ea1c9e36c112efe62b41b282a72ec21fab45012` | 9 | this return packet and the final-head check receipt |
| `2d7e429eaeff381c5e95f6a558f518f86115a01b` | `bee399b97753e0a65c14088e8a5d530ad515fd29` | 6b | real-PostgreSQL store controls (`store-pg.test.mjs`) and their receipt; §6 map gap 6 closed |
| `6a004b1` (see `git log`) | — | 5 prep | runtime image dependency trace and base-variant candidates (`FABLE-IMAGE-DEPENDENCY-TRACE-20261014.md`) |
| (this commit) | (recorded in `git log`) | 7b | retention and deletion design proposal, approval gate (`FABLE-RETENTION-DELETION-PROPOSAL-20261014.md`) |

Complete diff: `git diff c6053e2..<this commit>`; at `190acd7` it is 93 files, 16259 insertions, 6 deletions. Product source changes are exactly five files (four edits and one new test file); everything else is under `scripts/qualification/**` and `docs/**`:

- `apps/control/conversations/skills/admission.mjs`: the closed `own()` list of the admitted-run owner surface gains the optional, documented `currentTaskRun` method (one line). Behavior for every previously accepted owner is unchanged.
- `apps/control/admitted-runs/independent/owner-independent.test.mjs`: the independent control's expected owner surface lists the documented method (one line). This edits an independent reviewer's control and is called out for dot's explicit review.
- `apps/worker/conversation/options.mjs`: `buildConversationOptions` no longer places `undefined` entries in `env` (the remote launch plan admits only strings), and accepts the optional pair `sdkConfigDirectory`/`sdkSecureStorageDirectory` (both or neither, absolute, no `/../`, no trailing slash, not equal, not nested), placing them in `env` as `CLAUDE_CONFIG_DIR`/`CLAUDE_SECURESTORAGE_CONFIG_DIR`. Without the pair the output is identical to the string-only form.
- `apps/worker/conversation/test/activity.test.mjs`: the option control asserts string-only env, no account keys, the accepted directory pair and four refusals.
- `apps/control/conversations/test/store-pg.test.mjs` (new): the scripted store controls against the local Unix-only PostgreSQL 16 inspection database, 14 controls, collected by the existing `conversations-tests` suite glob.

Dependency, license, lock and image changes: none. No `package.json`, lock, `Dockerfile`, migration or public contract changed. All 45 proof rows are unchanged at every committed head (`scripts/qualification/assembled-image/source-proof.test.mjs` 3/3). Untracked local state only: root `node_modules` links created by `scripts/qualification/local-baseline/link-dependencies.sh` (gitignored).

## 2. Owned paths

- `scripts/qualification/local-baseline/**`, `scripts/qualification/r2-reconciliation/**`, `scripts/qualification/first-chat-rehearsal/**`
- `docs/qualification/candidates/fable-local-baseline-20261014/**`, `docs/qualification/candidates/fable-r2-reconciliation-20261014/**`, `docs/qualification/candidates/fable-first-chat-rehearsal-20261014/**`, `docs/qualification/candidates/fable-durability-controls-20261014/**`
- `docs/coordination/reports/FABLE-*-20261014.md` (nine reports including this packet)
- the five product files above

## 3. Intended behavior and interfaces per slice

| Slice | Delivered | Interfaces touched | IDs |
| --- | --- | --- | --- |
| 1 Baseline and first-chat reconciliation | `run-suites.mjs` (37 suites, `RESULTS.json` with head/tree, host facts, per-suite commands, failing test names), `provision-postgres.sh` (two local PostgreSQL 16 clusters on the socket paths the tests hard-code), `link-dependencies.sh` (the recipe's root links plus two test-only links), `subreaper.py`; report `FABLE-FIRST-CHAT-RECONCILIATION-20261014.md` | none public; the admission owner key list | HANDOFF §5 1–7 reconciliation; R-07/R-08, REL-04 (drift fix); W09 tooling |
| 2 Follow-up turns | design proposal only, approval gate before code | none | W05/W06, REL-05, RG-12 |
| 4 Ledger reconciliation | `reconcile.mjs` joins the five R2 ledgers, catalog 0.2.15, 14 skill manifests and adapter families; zero drift at PR86; 96 selected capabilities map to operations, 0 handlers bound, 97 operations pending | none | W00–W01, REL-01, REL-02; 139 capabilities (96/43), 14 skills, 12 requirements, 12 gates, 9 tickets, 10 findings |
| 3 Descriptor finding | `capture-sdk-descriptor.mjs` records the real SDK 0.3.295 launch descriptor for the product option set and runs it through the remote launch gates; three receipts; option builder reconciliations; the runner derivation as `proposals/gap2-runner-sdk-directories.patch`; report `FABLE-REMOTE-LAUNCH-DESCRIPTOR-FINDING-20261014.md` with gaps 1 (fixed), 2 (worker side fixed, runner side proposed) and 3 (dot's decision) | `buildConversationOptions` optional keys | W02/G1, W05; §5 items 5–6 |
| 3b Composed rehearsal | `composed-rehearsal.mjs`: real PostgreSQL 16, real remote controller, remote task application, independent supervisor, real CLI 2.1.295, product runner and option builder, durable first-session store; zero-turn `/status`; with the proposal applied to the working tree only: `completed` with physical stop proven and a refused replay; cancellation after launch: `cancelled`, physical stop proven, no second dispatch; PR86 control: fails at the SDK options pin | none | §5 item 7 locally (not live), §6 lifecycle; W05/W09 |
| 6, 7 Coverage maps | every §6 and §8 requirement mapped to controls with evidence level, class, gaps, proposed controls and owners | none | §6, §8; RG-12, W05, W07 |
| 8 Freeze and W03 drafts | RG-01 to RG-09 and RG-12 definitions, denominators, cohorts, owner fixture inputs and preconditions; W03/G2 binding inventory from the configuration schema with readbacks, owners, UNBOUND state, separation, IAM/keys/logs/retention requirements and rollback notes | none | RG-01..09, RG-12; W03/G2; REL-09 rollback drill (not run) |

## 4. Tests, commands, environment and outputs

Environment: Linux 6.18 container, Node 24.21.0 (`/opt/nvm/versions/node/v24.21.0/bin/node`), non-root user `meri` (uid 30033), PostgreSQL 16 local clusters with `fsync=off` and trust authentication under `/tmp/meri-local-baseline-pg`, LibreOffice 24.2.7.2, Python 3.13.16 with PyMuPDF pinned to 1.24.14, Docker absent, no network use by any check. Every runner invocation scrubs credential-shaped variables (receipts list the scrub).

| Check | Command | Receipt | Result |
| --- | --- | --- | --- |
| Full local baseline at `c6053e2` plus slice 1 | `node scripts/qualification/local-baseline/run-suites.mjs --out <dir>` | `docs/qualification/candidates/fable-local-baseline-20261014/author/final/RESULTS.json` | 28/37 suites green; 8640/8756 controls pass; every failure classified in the candidate README as a host fact (Docker, Codex host paths, private backend mirror, protected qualification database, LibreOffice process-group difference, PyMuPDF version) and none as a source regression |
| Ledger reconciliation | `node scripts/qualification/r2-reconciliation/reconcile.mjs` | `docs/qualification/candidates/fable-r2-reconciliation-20261014/RECONCILIATION.json` | zero drift |
| Touched suites after the option-builder changes | `run-suites.mjs --only source-proof,worker-conversation,runtime-typecheck,runtime-tests,scripts-local,gateway-selected-skills` | `docs/qualification/candidates/fable-first-chat-rehearsal-20261014/checks/RESULTS-touched-suites-worker-directories.json` | `source-proof` 3/3, `runtime-typecheck` pass, `runtime-tests` 111/112 (Docker control only), `worker-conversation` 135/135, `gateway-selected-skills` 36/36, `scripts-local` 27/27 |
| Descriptor capture | `node scripts/qualification/first-chat-rehearsal/capture-sdk-descriptor.mjs --out …` (three variants) | `sdk-descriptor-capture*.json` in the rehearsal candidate | PR86 options fail the inert-JSON gate; this head passes it; with the proposed directories every directory gate passes; the credential-in-env observation remains |
| Composed rehearsal | `MERI_REVIEW_SOURCE_ROOT=$PWD MERI_REHEARSAL_RECEIPT=… node --test scripts/qualification/first-chat-rehearsal/composed-rehearsal.mjs`, run twice: with the patch applied to the working tree and reverted, and at PR86 bytes | `composed/with-proposal.json`, `composed/with-proposal-cancellation.json`, `composed/control-pr86-runner*.json`, stdout files, `composed/attempts/` | with proposal: both tests PASSED; PR86 control: both FAILED at `NATIVE_EXECUTION_SDK_OPTIONS_REFUSED` (retained) |
| Final head | `run-suites.mjs --only source-proof,scripts-local,worker-conversation` | `checks/RESULTS-final-head.json` in the rehearsal candidate | `source-proof` 3/3, `scripts-local` 27/27, `worker-conversation` 135/135 |
| Real-PostgreSQL store controls | `run-suites.mjs --only conversations-tests,source-proof` | `docs/qualification/candidates/fable-durability-controls-20261014/RESULTS-conversations-tests.json` | `conversations-tests` 147/147 (14 new), `source-proof` 3/3 |

Reruns and their reasons are recorded in the candidate READMEs: the baseline had one stalled suite terminated and retained as a redacted diagnostic; the office suites were rerun with the supplied `soffice`; the touched suites were first run with the clusters stopped (30 socket refusals, retained) and then started; the rehearsal script had three retained attempts before the final form (a missing review-source-root refusal, a first passing run and a first control run of script revision 1).

## 5. Findings for dot's independent review

1. PR86 drift fixed: the admission owner refused the canonical admitted-run owner because its closed key list omitted the documented `currentTaskRun` (17 controls affected, no production caller yet). Routine fix plus one edit to an independent control.
2. The product option builder and the remote launch gates disagree at PR86 (three gaps). Gap 1 is fixed. Gap 2 needs a proof-row change to the runner or a non-proof injection point: the patch is retained unapplied and the composed rehearsal proves it closes the gap. Gap 3 needs the launch-template matcher decision; a configured template cannot match the SDK's descriptor today without carrying the per-task proxy credential.
3. The rehearsal serves `runner/load` and `runner/publish` from the PostgreSQL store inside the test instead of the production relay (`native-runner-gateway.mjs` to `/internal/conversations/*`); all other routes are the product applications. The relay has its own controls (`native-runner-gateway.test.mjs`).
4. Resolution coupling: `apps/runtime` imports `@aws-sdk/client-s3` through the recipe's root link rather than its own lock; any lock addition is an owner allocation.
5. Host coupling: 24 test files hard-code the Codex Python interpreter path and 11 the `soffice` path; the product `check` scripts do not express the Node flags and concurrency their tests need. `suites.json` records the required invocation per suite.
6. PyMuPDF 1.28 prints a deprecation warning to stdout that the Python bridge parses as JSON; the repository pins no PyMuPDF version.
7. No retention or deletion owner exists for published artifacts, transcripts, events, uploads, browser state, previews, telemetry or backups; no signed-URL surface exists (downloads are session-authorized responses).

## 6. Decisions and inputs that block the remaining plan

From dot: (a) ACCEPT or HOLD on the follow-up turns design; (b) the gap 2 proof-row decision (apply the patch with a fresh candidate manifest and a new 44-row pin, or name a non-proof injection point); (c) the gap 3 matcher shape; (d) review of the independent-control edit; (e) the RG freeze table; (f) the retention and deletion design proposal (`FABLE-RETENTION-DELETION-PROPOSAL-20261014.md`) and the signed-URL question; (g) whether the replacement-admission ordering of §6 map gap 5 is the intended invariant (the store sequence controls against real PostgreSQL, gap 6, are done).

From the shipping owner: the private scan finding table for the PR86 image, confirmation of the base variant behind the pinned digest, and the base-image digest policy (the dependency trace and the candidate shapes are already in `FABLE-IMAGE-DEPENDENCY-TRACE-20261014.md`; the trace also records that zero High/Critical is unreachable on any glibc Debian base until Debian fixes zlib and gcc-12 libstdc++), and every binding in `FABLE-W03-BINDINGS-PACKET-DRAFT-20261014.md` (product database and migration execution, Temporal, control/runner origins, authority bridge, native capability provider, proxy/model/budget pin, ECS task request, preparation intent values, artifact bucket and KMS, browser and renderer hosts).

From the QA owner: the 75-real-request seed, the 200-case set with a held-out split, the labelled oracles, the two-tenant adversarial fixtures and the document benchmark set with its human rubric.

## 7. Unrun native and live gates

Image build, scan and admission; Fargate task launch and isolation; Temporal server, namespace authorization and workflow durability; backend authority bridge with a real Clerk session; provider route and any model turn; S3/KMS object publication; browser and renderer host sandboxes for this base; frontend binding and the 337 native UI rows; every RG gate measurement; every REL ticket; every §10 threshold. The first usable authenticated chat (§5) is not achieved: all seven items need owner bindings that do not exist. G1 remains OPEN; G2 to G7 are unaccepted.

## 8. Cleanup, resource ownership, rollback

- Resources created: two local PostgreSQL 16 clusters under `/tmp/meri-local-baseline-pg` (stopped at return with `provision-postgres.sh stop`; data left on disk, disposable), root `node_modules` links (gitignored), receipt directories under `/home/meri` (copies retained in Git), a non-root user `meri` on this container. No container image, cloud resource, credential, token, product database, migration execution, provider call or deployment. No existing branch, worktree, fixture or evidence was modified or deleted.
- Processes: none owned by the runs remain at return (checked with `ps -u meri` after the final rehearsal); the host's pre-existing zombie is not ours to reap.
- Secrets: no secret value in Git, logs or receipts; the one diagnostic that had captured host environment variables was redacted before publication and the runner scrub widened; receipts hash the synthetic proxy credential.
- Rollback: `git revert` of the eight commits (or branch deletion) restores PR86 exactly. The two product changes are additive optional keys; no caller, contract, lock, migration, image recipe or public DTO depends on anything added here.

## 9. Requirement-to-evidence matrix

| HANDOFF item | ACCEPT_SOURCE (at PR86 plus this branch) | local-artifact (this host) | image-qualified / admissible | live |
| --- | --- | --- | --- | --- |
| §5 items 1–7 first usable authenticated chat | first-chat path reconciled; drift fixed; option builder reconciled; runner derivation proposed | composed rehearsal: completed, cancelled and failed runs with the real CLI, physical stop proven (proposal applied, synthetic facts) | UNRUN (scan-blocked PR86 image) | UNRUN (all seven bindings) |
| §6 conversation, stream, recovery | coverage map section 1–3; existing controls listed per sentence; new real-PostgreSQL store controls | baseline suites green; rehearsal receipts; `conversations-tests` 147/147 | — | UNRUN (gaps 1–5 of the map) |
| §7 full R2 (W00–W11, REL, RG, capabilities, skills) | ledger reconciliation zero drift; RG freeze draft; W03 packet draft; 96 selected capabilities mapped, 0 handlers bound | — | — | UNRUN (every gate) |
| §8 documents, storage, browser/renderer | coverage map; existing owners and adapters | local-artifact render/formula receipts in the baseline | UNRUN (executor paths in the image) | UNRUN (bucket, KMS, hosts, rubric) |
| §9 database, infrastructure, shipping | migrations source-reviewed only; W03 packet lists every binding UNBOUND | — | — | UNRUN; no AWS action taken |
| §10 acceptance thresholds | definitions drafted for freeze | — | — | UNRUN (no case set, no environment) |

Dot records ACCEPT or HOLD per commit. Fable stops here with the branch pushed, the clusters stopped and the worktree clean.
