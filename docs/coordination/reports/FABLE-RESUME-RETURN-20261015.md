# Fable return to dot, 15 October 2026: pickup of the handoff pin and dot's ordered tasks 1 to 4 and the local part of 6

Repository `neo-capiro/meri-greenfield`. Base: dot's handoff pin `215930c8092577e84da563b1496d1cca9a4ad4d7` (tree `70aeef73e9d8a1ba8592787a1cd1cac115b6ed85`) from `dot/meri-handoff-to-fable-20261015`, with `1003f12d` and `700f203e` verified as ancestors. Branch `fable/meri-resume-20261015`, pushed; the exact head and tree of this return are the commit that adds this file (`git log -1`). No pull request. Author: Fable (Claude Fable 5.1, session `session_01Y14BF1SXTjvNYdttGCJ9Me`). Nothing here is image, native-provider, Temporal-server or live acceptance; no AWS action, build, scan, credential, product database, migration execution, provider call, deployment or legacy deletion occurred.

## 1. Owned paths and complete diff

- `docs/qualification/candidates/fable-resume-20261015/**` (receipts and README), `docs/coordination/reports/FABLE-RESUME-RETURN-20261015.md`.
- `scripts/qualification/first-chat-rehearsal/{rehearsal-support.mjs,composed-next-turn-rehearsal.mjs,provider-standin.mjs}` (new) and `composed-rehearsal.mjs` (helpers moved to the support module; behavior unchanged, receipts prove it).
- Through `4609faa` no product source, contract, lock, migration, Dockerfile, proof row or candidate manifest changed. From `e32353f` one product proof row changed (`apps/control/conversations/native-preparation-journal.mjs`, the gap 5 exclusion) and a new candidate manifest `candidate-manifest-fable-20261015.json` enumerates it; `source-proof` 5/5 against that candidate; the other 44 proof rows and the Dockerfile remain at their pinned bytes; no contract, lock or migration changed. Test-only additions: `lifecycle-seed.mjs`, `allocation-exclusion-pg.test.mjs`, the scripted store fixture and the restorer fixture.

Complete diff: `git diff 215930c..<this head>`.

## 2. Results per dot task

| Dot task | Delivered | Evidence | Not established |
| --- | --- | --- | --- |
| 1 Recover the pin | worktree at the pin, ancestry verified, subtree pins recorded, dependencies copied from the identical-lock PR86 worktree, fresh clusters with dot's migrations 0001–0009 | candidate README | — |
| 2 Linux fixture rerun | repaired process suite 7/7, runtime+process 15/15, source-proof 5/5, typechecks pass, conversations 246/246 (with the migration isolation attestation), worker 138/138, control-core 260/260, scripts-local 27/27, runtime-tests 167/168 (Docker control, host fact); reruns and reasons retained; composed first-chat rehearsal 2/2 unchanged at the pin (corrected: it runs off the lifecycle path and does not exercise completion capture) | `checks/*`, `rehearsal/composed-at-pin.json` | native, image, live; completion capture with the real CLI |
| 3 Artifact slice | 21/21 wheel payloads verified against the inventory; offline require-hashes install and full import readback on the host profile; SDK source-pin discrepancy traced to the stale worker pin at `d5207dc` versus `de599e4` | `artifact/*` | the agreed CPython 3.13.5 / glibc 2.41 gate and the four core artifact regressions (literal path rebinding refused here); renderer gate |
| 4 Bundled-Node blocker | public comparison limited to two inspected tags: v24.22.0 (14 Oct, newest in the index) ships a `gzwrite.c` byte-identical to v24.21.0, lacking the two `df84af25` resets; the other differences from upstream are listed separately; no other release inspected; no base selected, HOLD unchanged | `node-zlib/node24-gzwrite-comparison.json` | any remedy; shipping owns build and scan |
| 6 Multi-turn, local part | two-prompt rehearsal over the real control plane with the real CLI written; finding: lifecycle-path prompts are client-composed and always reach the provider, so the rehearsal fails closed before allocation without a trusted stand-in at the configured proxy host; stand-in module ready | `rehearsal/next-turn-1.json` (retained failure), `rehearsal/next-turn-preflight.json` | the two-turn run itself; needs an environment owner to bind and trust the stand-in, or an approved route |
| 5, 7 | nothing bindable here | — | every owner-held binding; first usable chat remains UNRUN |

## 3. Findings for dot

1. Lifecycle-path prompts cannot be zero-turn: `createConversationInput` marks messages `client_composed`, and the CLI 2.1.295 sends them to the provider even when the text is a local slash command; the string-prompt path handles `/status` locally. Any local multi-turn qualification with the real CLI therefore needs a provider stand-in trusted by the CLI's bundled trust store, or the real route.
2. The product launch environment is exactly five variables; a CA variable cannot be injected from a rehearsal, so stand-in trust is a host-level binding, not a script option.
3. The worker component pin for `packages/contracts/validate.mjs` is stale against `de599e4`; a new worker candidate record is the fix, not an edit of either file.
4. Neither of the two inspected Node 24 releases (v24.21.0 and v24.22.0, the newest in the release index on 15 October) carries the upstream zlib `gz_write` error-path resets of `df84af25` in its tagged `deps/zlib/gzwrite.c`; no other release, binary or image was inspected, so nothing is concluded about them.

## 3b. Full baseline at the pin and corrections after dot's acceptance note

All 37 suites were run at the pin (`fable-resume-20261015/full-baseline/`): 27/37 green, 8,985/9,096. Four differences from PR86 are classified in the candidate README. Two are findings against the pin: the public contract provenance drift in `conversation-application.metadata.json` originates in Fable's own slice A (`service.mjs` changed) and needs the contracts owner to regenerate `dist` (no wire change); and `native-restorer-pg.test.mjs` seeds a resume target with `store.accept`, which dot's hardened accept now refuses with `NEXT_RUN_NOT_RESERVED`. The other two are a reproducible LibreOffice cleanup host fact and a load-dependent timing assertion that passes in isolation.

Corrections requested by dot: the first-chat rehearsal at the pin does not exercise completion capture (it runs off the lifecycle path); the claim is corrected in the README. The exact denied commands and denial texts for the stand-in trust and the Codex path, with their scope (this disposable cloud container; no shared host; the Codex path is Fable's own baseline shim, unchanged), are in `DENIED-OPERATIONS.md`; those operations stay stopped. The artifact proposal keeps the committed disposable-environment runbook; no installed Codex runtime is replaced. Logs are public in the candidate directory with `MANIFEST.sha256.json` as the retrieval and verification route; `CLEANUP-RECEIPT.json` is the cleanup receipt.

## 3c. Dot's review of 15 October (reviewed head `dbe53bb`): responses per forwardable task

| Dot task | Done | Where | Left with its owner |
| --- | --- | --- | --- |
| 1 Evidence publication | six missing logs published as `.log.txt`, cancellation receipts recovered, manifest rebuilt from tracked deliverables, every remote file verified at the final SHA (31/31 at `4609faa`); re-verified at the head of this return | `MANIFEST.sha256.json`, README cleanup section | — |
| 2 Claims | native-authority corrected to 342/344 at the pin; Node claims narrowed to the inspected v24.21.0 and v24.22.0; `df84af25`'s resets distinguished from the other upstream differences; reruns kept distinct | README, `node-zlib/` | — |
| 3 Contracts and worker pin | metadata-only regeneration request recorded with the proof that bundle, declarations and schema are byte-identical; worker validator pin facts recorded (`c2449fd5…` 3,311 bytes at `d5207dc` versus `bc72b4cb…` 3,606 bytes at `de599e4`) | README (this slice) | contracts owner regenerates; worker qualification owner issues the new candidate record |
| 4 Restorer fixture | `NEXT_RUN_NOT_RESERVED` preserved; fixture reseeded through the canonical lifecycle continuation (resume at fence 2 in the same conversation; fork at fence 1 in a new conversation with a fresh session); inode-preserving replay and UNKNOWN assertions kept; 3/3 | `lifecycle-seed.mjs`, `native-restorer-pg.test.mjs`, `gap5/` | — |
| 5 Gap 5 invariant | focused implementation in the allocation claim under the conversation lock; composed real-PostgreSQL controls for active (CLAIMED, ALLOCATED, ADMITTED, launch-claimed, STARTED) and UNKNOWN predecessors, retirement acknowledgement without physical proof, physical stop without revocation, successful retirement and revocation, concurrent attempts, exact replay and the separate-conversation fork; initial failures retained; the lifecycle journal's cross-run guard (`RUN_RANGE_CLOSED` on the retired source) reviewed and exercised | `native-preparation-journal.mjs`, `allocation-exclusion-pg.test.mjs`, new candidate manifest | dot's ACCEPT or HOLD on the source change and on the new proof-row candidate |
| 6 Retention | revision 2 written: suppression versus purge, exact-version deletion with readback, rollback-safe reconciliation after restores, full reference inventory (completion checkpoints, next runs, selected outputs and reads included), fresh allocations requested (`0010`, artifacts `0002`), eight owner decisions, acceptance list | `FABLE-RETENTION-DELETION-PROPOSAL-V2-20261015.md` | dot and the named owners decide; no code written |
| 7 Stopped operations | kept stopped; the one-time approval question for the stand-in trust binding is written with container identity, mount scope, read-only trust-path probes for Node and the pinned CLI, literal bounded commands with rollback, cleanup that removes only the created CA file, hosts line and key directory, and no blanket permission rule | `FABLE-STANDIN-APPROVAL-PACKET-20261015.md` | the owner approves once or declines |

## 4. Environment and cleanup at return

Non-root uid 30033, private `TMPDIR`, scrubbed environment; clusters under `/tmp/meri-resume-pg-20261015` stopped at return (restarted for this slice's suites and stopped again, `CLEANUP-RECEIPT-gap5.json`); no test-owned process remains; the host Codex dependency shim is unchanged (`python3 -> /usr/bin/python3`); the scratch venv and wheelhouse live in the session scratchpad only. Receipts were scanned for credential patterns (0 hits).

## 5. Decisions requested

1. ACCEPT or HOLD on this return's commits (no product source changed through `4609faa`; from `e32353f` the gap 5 proof-row change and its candidate manifest, recorded by dot as ACCEPT SOURCE ONLY and ACCEPT CANDIDATE RECORD on 15 October).
2. Whether an environment owner will bind `proxy.synthetic.invalid` to the qualification stand-in and trust its certificate in a disposable Linux environment so the two-turn rehearsal can run, or whether multi-turn qualification waits for the approved provider route.
3. Whether the stale worker component pin should be reconciled by a new worker qualification candidate now.
4. ACCEPT or HOLD on the gap 5 source change (`native-preparation-journal.mjs`) and the new proof-row candidate `candidate-manifest-fable-20261015.json` (13 changed rows, no image acceptance).
5. ACCEPT, HOLD or edits on the retention revision 2 and its eight owner decisions.
6. Approve once or decline the stand-in trust binding in the disposable container (section 7 of the packet).
