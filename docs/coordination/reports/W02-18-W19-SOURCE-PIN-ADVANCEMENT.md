# W02-18 / W19 source-pin advancement — W02-22 implementer report

STATUS: SOURCE-ONLY IMPLEMENTATION RETURNED. An author verdict is NOT owner acceptance.
No runtime, IAM, TestState, browser, deployment or security admission is claimed.

## 1. Exact base, authority and pins

- Worktree: `C:/dev/main/meri-greenfield-worktrees/w02-native-teststate-closure`; branch `task/w02-native-teststate-closure`.
- Staging base (exact launcher): `8221ed1762ce0c85691e79bb41e75043a8c72425` (sole parent `d271c6c88272bcd0e00d097bfca1ffd2448766f7`).
- Brief `.task-inputs/W02-22-allocation-1/ADOPTED-BRIEF.md` 23059 B / SHA256 `4cf9d0091754dafec55d0a9cde82f7e8040cbccc9fc2fd66b7dd6860c3ada79f` — MATCH.
- `staging-manifest.json` 120544 B / `5692d735e6216831dcfa21d96f1c8ae745b0ca3e6cbf1ed921e28661433f45b4` — MATCH.
- `.task-inputs/W02-22-owner-inputs/pack-manifest.json` 16128 B / `81c84ebdb367295031dfa6b1ecab87af8b77b5575ae9126b8267ef1e91c5915e` — MATCH (64 pack files).
- `.task-inputs/W02-22-owner-inputs/inputs.json` 57770 B / `4bfc19279b1c54408483d22b8b954bb7dfb375b779c4bd6a5dc6fa909cafa3c9` — MATCH.
- Supplements: `PACK-AUDIT.md` `f011a295…`, `pack-audit-result.json` `98eaf44d…` — MATCH (read as DATA).
- Pinned Node `C:/Program Files/nodejs/node.exe` v24.19.0, SHA256 `3602f2bb1a10f2cbab4c36886218a33c1ab3db87290e73b033c46c77147d0237`.

One candidate test run of the changed suite (plus one explicitly justified targeted replay, §6) was
executed. No AWS/TestState/IAM/role/register/RunTask/browser/native/Docker/build/host/network/provider
action; no cutover, no root integration, no current Meri/Capiro change.

## 2. Owned paths (exactly four) — final SHA256

| path | final SHA256 |
| --- | --- |
| `scripts/native-teststate/binding.mjs` | `ba2432bc18ec8a1ece64bc37687c9258b6d5312be08b60323b9d4afa0ecabbfb` |
| `scripts/test-native-teststate.mjs` | `0ab146a00949d66da821e5c611ce8d5e9fa7028ca8294a68d0b6f1601f9bdb1e` |
| `docs/qualification/NATIVE-TESTSTATE-REQUESTS.md` | `d22e6a298119fe492d9b164512ff97c0fe679865cfd7809b039f734df82682a7` |
| `docs/coordination/reports/W02-18-W19-SOURCE-PIN-ADVANCEMENT.md` (new) | `aef23f839e2fe71540a301a280f865518b715daaa946dd49346689676ccd1ec6` |

Everything else stayed read-only: the eight W19 compiler sources, the accepted W18 seven + scanner two,
the copied packs/manifests/inputs/old helpers/evidence, and all shared coordination.

## 3. Fixed eight-record source table (accepted W19 closure, raw Git9f bytes)

`binding.mjs` now carries the fixed complete eight-record table; the first six positions preserve the
original W14/W18 order and the two appended members complete the closure. `script`/`bytes`/`sha256`:

| # | repository path | bytes | sha256 |
| -: | --- | ---: | --- |
| 1 | infra/native-enforcement/app.mjs | 618 | e03076acb2ccda59bd38c2e2763f94af0d057f6c6c1bd3e699e25c72314ab1ed |
| 2 | infra/native-enforcement/lib/binding.mjs | 16458 | 8df3f2f02e23a4f3587a342dcb882404c7c0f70be6e57b84b9d1b0af0eaea35a |
| 3 | infra/native-enforcement/lib/expressions.mjs | 13776 | 933dcca53027688be2e6373bed818890882f239bc5da5af1af827277213b87aa |
| 4 | infra/native-enforcement/lib/workflow.mjs | 25002 | 09171cbc66ce0efbd643969d92c92c742f89d0b41804eefd65064f2175aa39ca |
| 5 | infra/native-enforcement/lib/infrastructure.mjs | 4780 | c0ddb78cbfb28ed0fd3360b0dec86d12371240fb7d87c0452dec0408454a53af |
| 6 | infra/native-enforcement/lib/task-definition.mjs | 8996 | 3d45d054150c5e7706253694a725761afb96abe5a39d1a3ecc0bfb1adb686436 |
| 7 | infra/native-enforcement/lib/probe-profiles.mjs | 4920 | 67dff6ffb4025e1767226a5bb330998ad78bd9d76083319adb910a22e3397660 |
| 8 | infra/native-enforcement/canary-task-definition.mjs | 2612 | 524135d00aec413a6393e69a7d22974160109b01cc4ced71d35f26440d3e4df5 |

All eight worktree files match these exact raw bytes (verified by `sha256sum` before the check). The
raw input prechecks (static-pins 10904/`fc9f1beb…`, graph 112210/`2c962d23…`) run BEFORE the sole fixed
compiler import; the branded deeply-immutable provenance, Buffer snapshots, strict JSON, lexical
TextDecoder, bounded read/close/error handling and CLI behaviour are unchanged. The unknown
`sourceReader` property remains ignored and is never invoked.

## 4. Literal edges (16 repository + 1 builtin) and closure facts

App reaches all eight; the graph is acyclic. Read from `inputs.json.literalEdges` and the exact sources:

- `app.mjs` → lib/binding, lib/expressions, lib/workflow, lib/infrastructure, canary-task-definition (5)
- `lib/binding.mjs` → node:crypto (builtin), lib/task-definition, lib/probe-profiles (3)
- `lib/expressions.mjs` → lib/binding, lib/probe-profiles (2)
- `lib/workflow.mjs` → lib/binding, lib/expressions, lib/probe-profiles (3)
- `lib/infrastructure.mjs` → lib/binding, lib/workflow, lib/probe-profiles (3)
- `canary-task-definition.mjs` → lib/probe-profiles (1)

Total 16 repository edges + 1 `node:crypto` builtin edge; no dynamic `import`/`require` in these exact
bytes; leaf `probe-profiles`/`task-definition` have no imports. This is a finite literal DATA inventory,
not a general JS grammar parser nor an import-time-IO proof. Planner/module ownership is still the five
W18 paths (four production plus the existing test — the fifth is a test, not a product module; exact
paths: `scripts/prepare-native-teststate.mjs`, `scripts/native-teststate/{binding,files,requests}.mjs`,
`scripts/test-native-teststate.mjs`); scanner two: `scripts/sdk-capture/{json-records,protocol}.mjs`.

## 5. Retained raw requests and the only plan delta

All four complete retained raw request files reproduce byte-exactly from the real branded binding +
their retained seed bytes; every other non-bulk old plan fact matches the copied 22-key original record
with strict key order. The single intentional value delta is `plan.source.records` six→eight (fixed
order above). Verified for identity / list-started-by / list-running / list-stopped:

| case | request bytes | request SHA256 | selectedMemberHash |
| --- | ---: | --- | --- |
| identity | 117706 | 3db20205c1f4dbe619dc62b749ef0a6698097f4a87e9254b22e9da9b1fe57606 | c72ac96045904091101c93c73e6b2b035ad7ef993ed9f98a5f56de60b8e4f829 |
| list-started-by | 117770 | 4206f8ae8a1d19f5743fefad415e000a13f32e0aa7e72eee547ffb1b1d99d10d | 8dadb529a90e9e006ae9b57378af89ece269d766d5f70a8a688f9c9784e24879 |
| list-running | 117710 | ce2bf06f9fbd1672abb97ad93ee4973e02eca4c5889a19b5da4b2946ef6dfd45 | 8dadb529a90e9e006ae9b57378af89ece269d766d5f70a8a688f9c9784e24879 |
| list-stopped | 117710 | ee57b439f45fc15ac028d11908e2dbde43f519ba1e8a9cec0031644f0944b725 | 8dadb529a90e9e006ae9b57378af89ece269d766d5f70a8a688f9c9784e24879 |

Graph identity (112210/`2c962d23…`), static-pins input (10904/`fc9f1beb…`), `staticBindingId`
`0599b1c8ed11af66130c08a54db950cac3cc79ba6e4941fa00ba2493fe907548`, target/role/provenance/limitations
and the four exact seeds are unchanged; the seed/times and `expectedTimeoutSeconds` all match their
retained records.

## 6. Runtime matrix and canonical result

Real-loader coverage runs the production internal reader/compiler in fresh confined clones (W18 five +
scanner two + compiler eight + exact inputs), same pinned Node, `shell:false`, bounded child, no caller
`sourceReader`/importer injection, never importing the candidate test as an oracle:

- 1 pristine control — positive eight-file loading/graph/binding provenance.
- 8 genuinely-missing clones + 8 syntax-valid raw-drift clones (length-preserving space→tab flip) — one
  per compiler member; exactly the target is absent/drifted while the other members still match; exact
  `source unreadable: <path>` / `source drift: <path>` refusal BEFORE import.
- 2 post-await mutations (targeting `probe-profiles` and `canary-task-definition` separately): call →
  retain pending Promise → `pending` → mutate → `await`; asserted post-compile `source drift: <path>`
  refusal with fixed graph/input otherwise unchanged.
- 2 mismatches: old-six loader + new eight-file compiler, and new eight-file loader + old-six compiler
  — both refuse with no fallback, in fresh clones only.

Canonical suite envelope (replay capture):

- command: `node --test scripts/test-native-teststate.mjs`; cwd = worktree root; shell false; external
  cap 120 s; pinned Node v24.19.0 (`3602f2bb…`); child stdin DEVNULL; children get stripped
  `NODE_OPTIONS`/`NODE_PATH`/provider-AWS vars (names only; observed removed: none in this shell) and a
  confined child `TMP`/`TEMP`/`TMPDIR`.
- start 2026-10-10T11:34:56Z, end 2026-10-10T11:35:01Z, elapsed 4043 ms, exit 0.
- `# tests 62 / pass 62 / fail 0 / skipped 0`, stderr 0 bytes. Original 37 cases retained (updated
  six→eight expectations); 25 new cases added.
- raw source20 + input66 (64 pack files + 2 literal aliases) + 6 supplements = 92 snapshot rows —
  pre/post `IDENTICAL`.
- captures: `.task-inputs/W02-22-author-checks/replay/{canonical.stdout.txt,canonical.stderr.txt,envelope.json,snapshot-before.txt,snapshot-after.txt}`.

### First failure history (preserved, not erased)

Run 1 (`.task-inputs/W02-22-author-checks/`): exit 1, elapsed 3294 ms, `tests 62 / pass 51 / fail 11`.
All failures were in the new matrix, not in the retained 37: the 8 raw-drift cases threw
`ReferenceError: appendFileSync is not defined` (a missing test-file import), and the 2 post-await + 1
old-six-loader mismatch cases surfaced the loader's real size bound (`maxBytes = pin.bytes + 1` turns a
byte-growth drift / a 618-byte file pinned at 422 into `source unreadable: <path>` rather than
`source drift`). This is a concrete, in-scope test repair: the drift cases now use a length-preserving
in-place mutation, the assertions accept the loader's exact `source unreadable`/`source drift` phrasing,
and the missing import was removed. The targeted replay (§6) is clean. No unchanged rerun, no
post-commit replay.

## 7. Incomplete checks and honest limits

- Import ordering / phase refusal is established by inspected control order plus the exact refusal
  message, not by measured zero-import instrumentation; local clone checks do not prove hostile-FS
  safety, comprehensive import-time-IO absence, or live policy.
- A bounded direct-child timeout is not proof of descendant-tree cleanup.
- Native A/B literal products and the 22-grid / 34-eval JSONata evidence were NOT re-run or rewritten
  (owner oracle/exporter work, out of scope here); the old helper/evaluator and old outputs remain
  unchanged.
- No TestState/IAM/PassRole/registration/RunTask/response-decoder/AWS/native/browser/provider call; no
  build, Docker, host, security or G1 admission; cutover not performed. Sources stay disabled; the
  constant future role is not created/trusted/authorized.
- 49 scan findings / 22 severe OPEN, Office DEFERRED, paid Bedrock $0, independent Fargate app/control
  and current Meri/Capiro unchanged, no root integration. The graph still CONTAINS mutators; only the
  fixed selected state request is read-only.

Return: ordinary exact-four-path commit, clean worktree, no push/amend, no ignored inputs committed.
