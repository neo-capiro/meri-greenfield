# W02-20 Python completion — distinct exact-commit review 1 (final)

VERDICT: **INCOMPLETE — bounded OFFLINE source preparation.**
A distinct actual Hermes reviewer's offline source assessment of exact commit
`70a7ae60ea8027c1c8a3d1d27edd34276e13f11d`. The allocated mandatory
38-assignment **complete-multiset** result did not close as a single successful run: the
one authorized DATA child for fact-correction-2 returned `ok=false` (fact-correction-1's
single attempt had already failed). No ACCEPT is claimed. This is NOT runtime, assembly,
packaging, security, host, G1 or release acceptance. All runtime/assembly/native limits
below are retained.

- Candidate/base/HEAD: `70a7ae60ea8027c1c8a3d1d27edd34276e13f11d`; report lineage `e3f060b…` → `191bab03f7c12f0b8c32dc29e01f8c136a747726`.
- Branch/worktree: `task/w02-browser-python-completion-review-1` / `C:/dev/main/meri-greenfield-worktrees/w02-browser-python-completion-review-1`
- Session: `20261010_055254_5cb7fd` (continued under review-1 closeout, fact-correction-1, fact-correction-2).
- Reviewer authorship: independent Hermes review. Root Codex owner-check/metadata-correction/
  preservation artifacts and the author report are separately attributed and are NOT this review.

## Frozen allocations / pins verified (raw bytes)

| Input | Bytes | SHA256 | Status |
|---|---:|---|---|
| `.task-inputs/W02-20-REVIEW-1-ALLOCATION.md` | 12109 | `8a7fcefd…9767` | VERIFIED |
| `.task-inputs/W02-20-REVIEW-1-CLOSEOUT-1.md` | 14366 | `d89103a0…1dfe` | VERIFIED |
| `.task-inputs/W02-20-REVIEW-1-FACT-CORRECTION-1.md` | 4080 | `46249978…480a` | VERIFIED |
| `.task-inputs/W02-20-REVIEW-1-FACT-CORRECTION-2.md` | 14011 | `1a0646a0ee716abb5d465e8e920f33d70a3a6a0e157ad4b9ebb1426317e322cc` | VERIFIED |
| root `.task-inputs/W02-20-review-1-closeout-readiness.md` | 13346 | `412d49ab…07b3` | VERIFIED |
| root `.task-inputs/W02-20-review-1-closed-preserved/manifest.json` | 68966 | `48da3cd9…6ef4` | VERIFIED |
| root `.task-inputs/W02-20-review-1-fact-correction-preserved/manifest.json` | 100339 | `170efc83e46c95ca861f00c7a28cc951d6a2c0683d69841571dae0801b156ca2` | VERIFIED (per manifest) |
| worktree `.task-inputs/W02-20-review-inputs-and-source-manifest.json` | 13058 | `106b9956935495bc30c0dcb64b17380f4257288f27392b0461f248f426d3020a` | VERIFIED |
| worktree `.task-inputs/W02-20-owner-inputs/manifest-v2.json` | 1973 | `5b4f1fc0…9322` | VERIFIED |
| three immutable oracles | — | `d1900a59…`, `383360dd…`, `cbfd952e…` | byte-identical to manifest |

HEAD/branch/status confirmed before and after every step. The fact-correction-2 child and
wrapper each independently re-checked the manifest exactly 13058B / `106b9956…` (`sourcePins`
=21, `inputCopies`=15) and confirmed **all 21 source pins and all 15 immutable copies match**
pre and post; both children show 21-pin stability. Interpreters (retained evidence,
attributed): Node `v24.19.0`, bundled Python `3.12.14`.

## 1. Source-map reconciliation (independent, reviewer-authored)

Run offline over source **text/AST only** (no candidate helper imported except the one v2 control).

- **Earlier-39**: all 39 definitions occur exactly once, each body byte-identical to
  `earlier-39-map.json`. Includes the class `_CollectionIssue` by whole raw body hash — the
  reason the 63-record pass covers **62 function argument ASTs plus one whole raw class body**,
  not an undifferentiated 63-function-signature run.
- **deferred24 body identity** (vs `frozen-source.json`): **22/22** nonexception moved bodies
  byte-identical (raw body sha256/bytes), plus the **2** permitted path-expression exceptions
  to `allowedBodySha256`/`allowedBodyBytes` — `source_manifest` 522B `8917be20…` and
  `_inspect_reasons` 5751B `68a87fe0…` — both exact.
- **`_source_root`**: defined once, exactly 90 bytes, locator text exact, uses
  `os.path.dirname(os.path.dirname(os.path.abspath(__file__)))` — abspath preserved, no
  realpath/resolve, no cached mutable root, no `__file__` mutation.
- **63 definition-provider provenance**: each of the 63 frozen names is defined exactly once in
  its frozen target module; the entry imports that exact name from that module (no rename), and
  the raw-body destination checks supply frozen-module provenance. This is a source/import-map
  **defining-module vs entry-import** statement + raw-body check — it is NOT a separately
  measured frozen-target or runtime `__globals__` provider identity for every name.
- **38 assignments**: **UNCLOSED** (§6). The fact-correction-2 child's raw output shows the
  substantive predicates true — 38/38 rows, `Counter(fullAST)` equal, `Counter((targetTuple,
  fullAST))` equal (complete values/multiplicities), 48 name occurrences / 48 distinct, 5 tuple
  target nodes, nonstate **36 complete rows in order** equal, state each once, both state rows in
  `collection` (36 config / 2 collection), `_CANCEL` before `_EXE_HASH_CACHE` — **but** the
  child's own `state_order_equal_frozen` term compared 3-field actual rows
  `(targets, ast, module)` against 2-field frozen rows `(targets, ast)`, so the conjunction
  returned `ok=false`. That is a reviewer-script comparison-shape defect, and the single
  authorized attempt is spent, so the complete proof did not close as one successful result.
- **Structure**: 64 unique top-level defs, no duplicate names; entry defines nothing (small
  composition); relative-import-aware import graph acyclic. 48 bound targets counted.

## 2. Canonical suite — ran exactly ONCE (retained, not repeated)

`node --test infra/browser-qualification/security.test.mjs`, wrapper timeout 120s, elapsed
14.546s, `rc=0`, `timed_out=false`, `exception=null`, **14 PASS / 0 FAIL / 0 SKIP**,
14488.1293ms; 21 pre/post pins stable. stdout 1392B `a9805a73…f097`; stderr empty. Counts:
codexDirect 23/0, codexEmbedded 23/0, owner 33/0, newCases 26/0, integrity 10/0, errors `{}`,
three fixtures verified; owner-capture 25/0. Direct and embedded 23 are the same oracle run
twice. The canonical's allocated local file fixtures/CDK synthesis mean its pass is not a
universal "no filesystem activity" claim. **Not rerun.**

## 3. Exactly ONE corrected v2 caller control — COMPLETED (13/13)

`.task-inputs/W02-20-review-1-closeout-1/`; one bounded child, rc 0, outer elapsed 0.406s, pins
stable; stdout 3733B `2f62e913…`, stderr empty. Against the actual fixed
`host_evidence.browser_capture.assemble_run_record`: exact full-root finite text+JSON ledgers
under a virtual root (never created); result consumption; `source_manifest` called once;
negative = fresh map minus `browser.stderr` → a specific **`Audit`** exception that is **not
OSError**; all THREE patched globals restored on both paths; IO sentinels
(`builtins.open`,`os.open`,`os.read`,`os.write`,`os.remove`,`os.mkdir`,`subprocess.Popen`,
`signal.signal`) fired zero times (scope limited to those named entry points, not all OS
activity); direct wrong-root/traversal guards rejected.
- The v2 child records only those **three helper identities**. The shared
  `_CANCEL`/`_EXE_HASH_CACHE` runtime identity (`entry._CANCEL is col._CANCEL`, etc.) was
  observed by the **original first-session `reconcile.py`**, NOT by the v2 caller child.
- The old control wrapper's stream cap is **post-capture truncation/flagging, not a
  bounded-memory reader**; its 3,733-byte output was not truncated. Its **initial `git rev-parse`
  subprocess ran OUTSIDE the 30s child bound**.

## 4. Retained historical failures / qualifiers (unchanged, immutable)

Initial 40-turn/no-commit partial; `_value_dump` AttributeError; mr2 aborted owner/two integrity
failures; mr3 restoration failure; mr4 green; continuation1 narrated 130s configured timeout;
original OS Temp / real missing-file fixture reads; nonexclusive flattened-view write;
continuation2 stdout.txt 1417 raw bytes / SHA `954f176b…` vs decoded/LF length 1395 (raw hash
matches raw 1417 bytes); author 14 PASS/0 FAIL/~15.074s; prior reviewer 30-turn cap with no
commit; first-session `json.load(string)` and `ClassDef.args` script errors and the defaults
quote-style artifact; second-session assignment positional-order assumption; the earlier
positional `reconcile_closeout.json` `assignments_all_ok=false` (18 allowed-relocation
mismatches) and intersection-only `ast_diffs=[]` (insufficient). **fact-correction-1** child
(one attempt, `10:33:21Z`, rc1): parsed stored `ast.dump` strings as source → `Expr` →
`AttributeError`; artifacts (`assignments_multiset.py` 4252B `c718cd35…`, `run_data_once.py`
3157B `e6913909…`, `data-run/envelope.json` 1419B `a721490a…`, stdout 0B `e3b0c442…`, stderr
607B `4e91fc3f…`) preserved. All earlier author/reviewer failures and the 191 INCOMPLETE outcome
remain historical.

## 5. NEW fact-correction-2 DATA child — ran once, `ok=false` (fact UNCLOSED)

Authored `.task-inputs/W02-20-review-1-fact-correction-2/` (absent before this resume):
`assignments_multiset.py` 8115B `f184ce2d8449b8f222bafd906b3396e25cbc007efd1154eba897f64155077775`
and `run_data_once.py` 4351B `3f467f1614d55d7d8e3bf5e779875af9ccfec3e576c745d7dfaaf0fe4e28b656`.
Stdlib only; raw `read_bytes` hashing; the new wrapper used **no Git subprocess**, fixed argv,
`shell=False`, `stdin=DEVNULL`, `subprocess.run(timeout=30)` (hard bound over the complete
child). Single invocation outcome: **rc=1, timed_out=false, exception=null, elapsed 0.172s**,
21 source + 15 input pins stable; stdout.bin 31199B
`c4ef02156ede697eec5169cbd76366b33e3bfaeb87a9c67e2f4a5b51df7aa9d9`; stderr.bin 0B
`e3b0c442…`; envelope `.task-inputs/W02-20-review-1-fact-correction-2/data-run/envelope.json`.
Child `failures=["state row order differs"]`; every other predicate true (see §1). Sources read
exactly: config.py 3728B `0c555429…ff2e`, collection.py 19858B `bbcd697a…dbce`, frozen-source.json
35219B `b29707ff…8ec5`. **No repair, retry, or alternative inline run.** Source/raw-Git equality
and the clean 191 base are attributed to the retained owner/launcher observations, not to this
child.

## 6. Remaining limits (NOT promoted)

**sourceManifestCoverage=false / INCOMPLETE RUNTIME ASSEMBLY / NO-BUILD / NO-HOST**: the
flat-three source/context/loader/support protocol cannot authenticate or package the eleven
imported `host_evidence` modules; future 14-asset pre-import protocol/version/source/context/
packaging acceptance is separately allocated. The 63-provider check is a source/import-map
identity, not runtime `__globals__` equality. IO sentinel scope is only the named entry points.
Python 3.9 `feature_version` parsing is grammar only, not actual AL2023/Python 3.9 execution. No
actual kernel/sandbox/browser/process-namespace/systemd/log/ECR/host cleanup or native
acceptance. The assignment proof, even had it closed, would be an AST-fact proof only — it does
not establish regex-constructor execution, candidate imports, lifecycle/shared-dictionary
behavior, runtime provider binding, or general semantic equivalence. All 49 scan findings / 22
severe remain OPEN; Office DEFERRED; G1 OPEN; paid Bedrock 0; current Meri/Capiro untouched;
independent Fargate unchanged. No security relaxation or host launch follows.

## 7. Closure

Only writable tracked path: this report. Candidate source, harness, canonical suite, oracles,
pins, README, author report and all prior scratch/evidence are read-only; the 21 source pins and
15 input copies show no drift. This report is committed alone as an ordinary reviewer-attributed
commit atop `191bab03f7c12f0b8c32dc29e01f8c136a747726` (no amend/push). Parent (Codex) owns
source acceptance, integration, owner checks and every future runtime admission.
