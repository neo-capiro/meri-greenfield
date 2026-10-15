# Fable return to dot, 15 October 2026: pickup of the handoff pin and dot's ordered tasks 1 to 4 and the local part of 6

Repository `neo-capiro/meri-greenfield`. Base: dot's handoff pin `215930c8092577e84da563b1496d1cca9a4ad4d7` (tree `70aeef73e9d8a1ba8592787a1cd1cac115b6ed85`) from `dot/meri-handoff-to-fable-20261015`, with `1003f12d` and `700f203e` verified as ancestors. Branch `fable/meri-resume-20261015`, pushed; the exact head and tree of this return are the commit that adds this file (`git log -1`). No pull request. Author: Fable (Claude Fable 5.1, session `session_01Y14BF1SXTjvNYdttGCJ9Me`). Nothing here is image, native-provider, Temporal-server or live acceptance; no AWS action, build, scan, credential, product database, migration execution, provider call, deployment or legacy deletion occurred.

## 1. Owned paths and complete diff

- `docs/qualification/candidates/fable-resume-20261015/**` (receipts and README), `docs/coordination/reports/FABLE-RESUME-RETURN-20261015.md`.
- `scripts/qualification/first-chat-rehearsal/{rehearsal-support.mjs,composed-next-turn-rehearsal.mjs,provider-standin.mjs}` (new) and `composed-rehearsal.mjs` (helpers moved to the support module; behavior unchanged, receipts prove it).
- No product source, contract, lock, migration, Dockerfile, proof row or candidate manifest changed: `source-proof` 5/5 at every commit; all 45 runtime proof rows remain at their pinned bytes.

Complete diff: `git diff 215930c..<this head>`.

## 2. Results per dot task

| Dot task | Delivered | Evidence | Not established |
| --- | --- | --- | --- |
| 1 Recover the pin | worktree at the pin, ancestry verified, subtree pins recorded, dependencies copied from the identical-lock PR86 worktree, fresh clusters with dot's migrations 0001–0009 | candidate README | — |
| 2 Linux fixture rerun | repaired process suite 7/7, runtime+process 15/15, source-proof 5/5, typechecks pass, conversations 246/246 (with the migration isolation attestation), worker 138/138, control-core 260/260, scripts-local 27/27, runtime-tests 167/168 (Docker control, host fact); reruns and reasons retained; composed first-chat rehearsal 2/2 unchanged at the pin | `checks/*`, `rehearsal/composed-at-pin.json` | native, image, live |
| 3 Artifact slice | 21/21 wheel payloads verified against the inventory; offline require-hashes install and full import readback on the host profile; SDK source-pin discrepancy traced to the stale worker pin at `d5207dc` versus `de599e4` | `artifact/*` | the agreed CPython 3.13.5 / glibc 2.41 gate and the four core artifact regressions (literal path rebinding refused here); renderer gate |
| 4 Bundled-Node blocker | public comparison: newest Node 24 (v24.22.0, 14 Oct) ships the same unfixed `gzwrite.c` as v24.21.0; the three upstream changes are enumerated; no base selected, HOLD unchanged | `node-zlib/node24-gzwrite-comparison.json` | any remedy; shipping owns build and scan |
| 6 Multi-turn, local part | two-prompt rehearsal over the real control plane with the real CLI written; finding: lifecycle-path prompts are client-composed and always reach the provider, so the rehearsal fails closed before allocation without a trusted stand-in at the configured proxy host; stand-in module ready | `rehearsal/next-turn-1.json` (retained failure), `rehearsal/next-turn-preflight.json` | the two-turn run itself; needs an environment owner to bind and trust the stand-in, or an approved route |
| 5, 7 | nothing bindable here | — | every owner-held binding; first usable chat remains UNRUN |

## 3. Findings for dot

1. Lifecycle-path prompts cannot be zero-turn: `createConversationInput` marks messages `client_composed`, and the CLI 2.1.295 sends them to the provider even when the text is a local slash command; the string-prompt path handles `/status` locally. Any local multi-turn qualification with the real CLI therefore needs a provider stand-in trusted by the CLI's bundled trust store, or the real route.
2. The product launch environment is exactly five variables; a CA variable cannot be injected from a rehearsal, so stand-in trust is a host-level binding, not a script option.
3. The worker component pin for `packages/contracts/validate.mjs` is stale against `de599e4`; a new worker candidate record is the fix, not an edit of either file.
4. No Node 24 release carries the zlib `gz_write` error-path fix as of v24.22.0.

## 4. Environment and cleanup at return

Non-root uid 30033, private `TMPDIR`, scrubbed environment; clusters under `/tmp/meri-resume-pg-20261015` stopped at return; no test-owned process remains; the host Codex dependency shim is unchanged (`python3 -> /usr/bin/python3`); the scratch venv and wheelhouse live in the session scratchpad only. Receipts were scanned for credential patterns (0 hits).

## 5. Decisions requested

1. ACCEPT or HOLD on this return's commits (no product source changed).
2. Whether an environment owner will bind `proxy.synthetic.invalid` to the qualification stand-in and trust its certificate in a disposable Linux environment so the two-turn rehearsal can run, or whether multi-turn qualification waits for the approved provider route.
3. Whether the stale worker component pin should be reconciled by a new worker qualification candidate now.
