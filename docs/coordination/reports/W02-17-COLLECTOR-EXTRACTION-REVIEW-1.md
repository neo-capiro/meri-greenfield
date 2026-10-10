# W02-17 collector extraction — distinct actual review 1

**Source-only verdict: SOURCE-ONLY PASS (with qualifications). Independently inspected and re-executed by a distinct actual Hermes review session. Not a Codex acceptance and not a deployment/security/G1/Office/runtime admission.**

- Candidate commit / exact source base: `b2c59265bc1868b96aa55af44491eaa12304a1dd`
- Allocation ancestor: `32401bca6104c7a1c6c877d48a7a5dc0d94e9362`
- Review worktree / branch: `C:/dev/main/meri-greenfield-worktrees/w02-browser-collector-modules-review-1` / `task/w02-browser-collector-modules-review-1`
- Author session (excluded from review): `20261010_030543_04ba88` (two capped partials, no commit). Reviewer session: `20261010_035843_8c7449` (this). The original reviewer invocation closed `08:06:03.709803Z` with no report and no commit; this is its owner-authorized explicit closeout continuation under a 12-turn/600-second bound. No self-review, no automatic continuation.
- Status retained: **INCOMPLETE RUNTIME ASSEMBLY / sourceManifestCoverage=false / NO-BUILD / NO-HOST**. The unchanged flat-three loader/context/support recipe does not bind, import or package these modules. No D006/protocol or runtime-acceptance transfer.

Distinguish source inspection from execution: the 39-body / 24-deferred / config / default / import / state claims below are **source- and AST-bound** findings. Only the canonical Node run and the independent Python checks are execution evidence. Author claims and the owner closed-partial audit are treated as assertions, not independent passes.

## Inputs verified before inspection (raw SHA256)

| Input | Bytes | SHA256 | Result |
| --- | ---: | --- | --- |
| `.task-inputs/W02-17-candidate-manifest.json` | 3911 | `5c0a517025109216112d6c27500c20326a1307ef3de6be877162ca78d6abfa0b` | match |
| `.task-inputs/W02-17-review-input-manifest.json` | 2248 | `e0bc02bb4ad065ff1b621b62198fce22c678df002437455dc72676aba6af2601` | match |
| `.task-inputs/W02-17-COLLECTOR-EXTRACTION-BRIEF.md` | 15809 | `da179b388d154453ac1decfab5fcd179ea13f1b264ff58d8cac9e72401ca2528` | match |
| `.task-inputs/W02-17-partial-source-audit.md` | 11275 | `3265191ce55519db52bd7a5f6ba0f20c64a0c9c69ccf2ac406bba72a5b1e3f4b` | match |
| `.task-inputs/W02-17-reference-entry.py` | 89914 | `cf27ce1d1c5cf0c45ba2a1fc2a6cf6d48bd0506728202645ecb4d4f68411679f` | match |
| `.task-inputs/W02-17-frozen-body-map.json` | 5290 | `828517fde4ca5c7fb7a6ad0f3329a64cb9a41967e2500589ed5193cce0fd42c3` | match |
| `.task-inputs/codex-observer-checkpoint-audit.py` | 10615 | `d1900a591a6b43b92f194223b2be1838e2d3e15eb4454d78b7e23b02140275e2` | match |
| `.task-inputs/owner-regressions-adapted.py` | 8842 | `383360dd17127cae2df73c25cb5b963e0c0e283a29022701573509231661c528` | match |
| `.task-inputs/observer-before-4863878.py` | 36537 | `cbfd952e97936dcf5a1538ff769e4a897308d55482417fb5055860c45b27f471` | match |

The frozen 39-map canonical hash `ca0739e1504be61e819789af646dbad0950b6e67e141016a94969dba0ba65ea7` was independently reproduced as `sha256(json.dumps(map, sort_keys=True, separators=(',',':')))` over the 39-entry array. Working HEAD was clean and equal to the exact source base; `git status` clean before and after checks.

## Candidate manifest and diff scope

All 16 manifest records were verified against **both** the working files and the candidate Git blobs (length + SHA256) — zero drift. `git diff --name-status 32401bc..b2c5926` is exactly the 12 allocated paths (12 files changed, +1507/-816): report (A), README/component-pins/entry/security.test.mjs (M), and the six `host_evidence/*.py` package files plus `module-regressions.py` (A). Exactly six package files exist; no unallocated path is touched.

## 39 frozen bodies, 24 deferred, boundaries, globals, defaults, imports, state (source-bound)

An independent AST pass using the oracle's UTF-8 `read_text` / `ast.get_source_segment` convention found:

- All 39 frozen FunctionDef/ClassDef segments appear **exactly once** across entry + six modules: 0 missing, 0 duplicate, 0 byte/hash mismatch, 40032 bytes total.
- The six modules contain **no** non-frozen top-level definitions — responsibility boundaries are clean.
- All **24 deferred entry** top-level definitions are **byte-identical** to the reference entry (0 mismatches); the entry defines **no** frozen name (no shadow or duplicated implementation). The reference entry independently contains all 39 frozen bodies unchanged.
- Symtable (nested scopes/comprehensions) found **no unresolved global** in any of the five modules. Import graph is acyclic: `config` ← `evidence_io`/`classification` ← `collection`; `poll` ← `config`; entry imports all five.
- Config module assignment AST and values are preserved vs the reference entry (including the W02-16 worker tuple: image `…@sha256:bf55fdab…`, configuration ID `sha256:6f313883…`, OCI revision `0be04d07…`, kind `worker-inventory-only`; the old digest is retained only as provenance). `PINNED_IMAGE`, `BROWSER_ROOT`, `BROWSER_EXE_PATTERN`, bounds and `_HEX64` match.
- Definition-time defaults retain defining-module bindings: `evidence_io._read_bytes(limit=MAX_EXE_BYTES)`, `collection.collect_observation(expected_sha=PINNED_BROWSER_SHA256)`, `poll.run_bounded_poll(deadline_s=MAX_POLL_SECONDS=300)`. Rebinding the defining-module global does not forward into the compiled default.
- Entry sets `sys.dont_write_bytecode = True` (entry line 14) before the first `host_evidence` import (entry line 18).
- `collection` owns exactly ONE `_CANCEL` and ONE `_EXE_HASH_CACHE`; the entry aliases those same dicts.
- Python 3.9 grammar (`ast.parse(..., feature_version=(3,9))`) parses entry + six modules with no error. This is grammar only; it does **not** prove native Python 3.9 runtime/API compatibility.

Historical W06/W02-16 versus W02-17 attribution: the entry header comments and README describe earlier owner-completion work on deferred admission/export/bootstrap helpers. Those 24 deferred bodies are unchanged here; the W02-17 change is the extraction of the 39 frozen bodies into the package. Header text attributed to W06 owner completion should not be read as this refactor's authorship.

## Template/harness audit (source)

`module-regressions.py` reads the three immutable oracles (hash-checked before use), loads the real entry + package, and replays through a test-only `_OwnerProxy` that routes collector-internal names to `collection` and entry-owned CLI/capture/signal names to the entry. Audited reform anchors match the fixtures exactly:

- `patch_codex` hits `{loader:2, write:1, exit:1}`; the two loader lines are removed (module pre-loaded), the fixed result-write `(HERE/'codex-observer-checkpoint-results.json').write_text` is replaced by an in-memory `_ORACLE_SINK.append(summary)`, and the exit is rewritten either to `assert summary['failed']==0` (embedded) or `_codex_failed=summary['failed']` (direct).
- `patch_owner` hits `{a:1, audit:1, write:1, exit:1}`; `audit=` is replaced by `CODEX_EMBEDDED` (the embedded copy that carries the restored assertion), and the owner's fixed result-write is replaced by in-memory capture. The previously dropped assertion is restored. `CODEX_ADAPTED` no longer appears.
- Collector `_read`/`_starttime`/`_hash_exe`/`_boot_id`/`_ns_inodes`/`_file_identity`/`_evidence_read`/`_task_ids`/`_CollectionIssue`/cache route to `collection`; `collect_observation`/`run_bounded_poll`/`_install_signals`/`_atomic_write`/`_dump`/`MAX_OBSERVATION_BYTES` stay on the entry; `os`/`time` patches reach the shared stdlib module objects — all consistent with the brief's patch-routing requirement. No production forwarding wrapper, dynamic loader or source rewriting exists in the candidate.
- The raw-body Node check now uses the **literal six-name allowlist** (not a glob) and rejects duplicate definitions. No oracle input is redirected to dummy content; the entry source read remains real.

## Execution evidence (actual)

**Canonical (run once, whole-process bound ≤120 s).** Command and environment as recorded in `.task-inputs/W02-17-review-1/canonical/`:

```
MERI_TEST_PYTHON=C:\Users\neoma\AppData\Roaming\uv\python\cpython-3.12.13-windows-x86_64-none\python.exe
PYTHONUTF8=1 PYTHONIOENCODING=utf-8 ; PATH=/c/Program Files/Git/bin:$PATH
timeout 150 node --test infra/browser-qualification/security.test.mjs
```

Result: **exit 0**, `tests 14 / pass 14 / fail 0 / skipped 0`, `duration_ms 15905.7562`, wall `16.301 s`, stderr empty (sha256 `e3b0c442…b855`). stdout sha256 `e727638b003ba3fb0f3ce91dbc3bf5d520612c02aaafc972139349f0173beeca`. All 14 original meaningful cases preserved (seccomp identity, synthesized template, bootstrap, provenance guard fails-closed with zero creates, module-aware replays, run-record acceptance/rejection, export reconstruction, PutLogEvents classifier, py3.9 grammar/no-bytecode, frozen-body equality, timer window, forged-flow rejection, strict export, injected capture/assembly). Only one canonical run was executed; no unchanged canonical/harness was re-run for positive coverage.

**Independent confined Python checks** — `.task-inputs/W02-17-review-1/independent_checks.py`, 23 assertions, all PASS. Accurate description of each (they are **not** 23 unique behavioral cases):

- Real, effective behavioral checks (candidate entry + package imported from the real worktree): entry/collection `_CANCEL` and `_EXE_HASH_CACHE` are the same objects (A1–A2); mutation propagates both directions (A4–A5); the effective collection `_read` fake is called with exact args `("w02-17-review-probe", 4097)` while a distinct entry alias is never invoked and rebinding the entry alias alone does not change collection's binding (D1–D4); definition-time defaults equal the defining-module globals and do not dynamically forward (B1–B4); config runtime values preserved (C1–C3).
- Structural / source-inspection assertions (weaker): A3 (collection reference stability), A6–A7 (shared primitive identity), C4 (`PINNED_IMAGE != BROWSER_ROOT`), and **E1–E4** which merely inspect the harness source for `audit=CODEX_EMBEDDED`, the restored `assert summary['failed']==0`, absence of `CODEX_ADAPTED`, and aggregation over `codexEmbedded.failed`.

**Replay group counts (author-recorded facts, qualified).** The retained `.task-inputs/W02-17-owner-oracle-facts.json` reports: codexDirect 23/0, codexEmbedded 23/0 (duplicate coverage of direct — same fixture), owner 33/0, newCases 7/0, integrity 5/0, `errors {}`, interpreter `3.12.14`. The 23 embedded are **not** another 23 distinct tests; distinct groups are 23 direct + 33 owner + 7 new + 5 integrity, with the embedded 23 duplicating the direct 23. These are author-retained captures; this review reproduced their structural shape and the harness anchors but did not re-derive each of the 33 owner/23 codex case facts.

## Failed-second-replay witness

**Attempt 1 — FAILED (preserved).** The generator `.task-inputs/W02-17-review-1/make_forcedfail.py` resolved the wrong path, so the variant file was never produced (`FileNotFoundError` / `can't open module-regressions-forcedfail.py`, exit 2). An **unchanged control copy** of `module-regressions.py` was then executed from the scratch directory and returned `ok=true` (codexEmbedded 23/0, `errors {}`) — this only re-exercised the harness and is **not** counted as new unique coverage. The generator was then corrected in the new file `make_forcedfail_v2.py` (attempt 2 below); the v1 failure and its control reexecution are retained as history.

**Attempt 2 — SUCCEEDED (new confined witness).** `.task-inputs/W02-17-review-1/make_forcedfail_v2.py` reads the **unmodified real candidate** `infra/browser-qualification/module-regressions.py`, injects exactly ONE failing record into the embedded codex replay only (leaving the rest byte-identical), and writes the variant into the scratch dir. Executed with the verified 3.12.14 interpreter (`-Xutf8 -B`, whole-process bound ≤120 s):

```
C:/Users/neoma/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe -Xutf8 -B module-regressions-forcedfail-v2.py
```

Result: **exit 1** in `867 ms`; summary `ok=False`; `codexDirect.failed=0` (direct replay untouched), `codexEmbedded.failed=1` (**the failed second replay is counted in the final aggregation**), `errors={'owner':'AssertionError: '}` (the embedded `assert summary['failed']==0` fired), stderr empty. stdout sha256 `0feb3cddc0d1d42527722d38d929f65804645625c645ba1162dab0526d01abbc`. This is a genuinely new, confined witness: it demonstrates on a controlled failed second replay that both the restored embedded assertion and the final aggregation enforce. It edits no candidate file and reads the original read-only oracles. Baseline that the unmodified harness exits clean is the canonical run above (exit 0); the earlier unchanged-control copy reexecution is **not** counted as coverage.

Source stability: the nine source/test files were re-hashed after all checks and were **unchanged** (40032-byte frozen total; `source_stable=True, changed=[]`).

## Limits of this review

- Source inspection is broad but is not execution equivalence; moved bodies matching the frozen map proves byte equality, not runtime behavior.
- The adapter's `_OwnerProxy` allowlist is the audited set only; a future fixture target could require fresh routing review.
- Canonical Python execution used 3.12.13, not the requested 3.12.14 (see interpreter note). Python 3.9 grammar is not native 3.9 behavior.
- No real `/proc`, executable, signal, subprocess, network, browser, Docker or cloud path was exercised; injected fakes were used. Universal import-time IO absence is not claimed.

## Interpreter qualification (requested vs actual)

The allocation requested the bundled Python 3.12.14. The reviewer's first search looked in `uv`/Programs paths and used **3.12.13** (`cpython-3.12.13-windows-x86_64-none`) for the canonical run. Root independently verified that **Python 3.12.14 exists** at `C:/Users/neoma/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe`. Earlier reviewer text stating "the host lacks 3.12.14" is **retracted**: the path was simply not found by the reviewer's search. Root's own canonical-14 pass on 3.12.14 is separate evidence not produced here.

## Remaining gates (unchanged by this review)

Runtime assembly INCOMPLETE; sourceManifestCoverage=false; NO-BUILD; NO-HOST; ~49,064-byte entry retains 24 deferred functions; 49 findings / 22 CRITICAL+HIGH remain OPEN; Office DEFERRED; G1 OPEN; paid Bedrock 0. No AWS/network/provider/model/Docker/browser/native/Office/build/deploy/role/source/current-Meri/cutover action or security waiver was taken. Codex acceptance of the exact commit remains separate.
