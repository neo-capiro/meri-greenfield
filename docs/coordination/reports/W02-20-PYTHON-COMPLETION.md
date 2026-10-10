# W02-20 Python completion — source-only handoff

Status: **UNACCEPTED (source-only, author-prepared)** — a distinct actual exact-commit
review and Codex owner independent replay remain mandatory before any gate moves. Not
acceptance. Status strings **INCOMPLETE RUNTIME ASSEMBLY / NO-BUILD / NO-HOST** and
`sourceManifestCoverage=false` apply throughout.

## Scope and inputs

- Session 20261010_044603_f5a15a; explicit continuation 1
  `.task-inputs/W02-20-CONTINUATION-1.md` SHA256
  `01ee284b6d27fdbe6ddcceadf1b94873168ca2e24ffcde6cfe2c6b83576f6d4d`.
- Base (clean) `77dcd1644221c14dbdb19aa9574a456b9df4b21a`, branch
  `task/w02-browser-python-completion`, worktree
  `C:\dev\main\meri-greenfield-worktrees\w02-browser-python-completion`.
- Controlling brief `.task-inputs/W02-20-ADOPTED-IMPLEMENTATION-v2.md` SHA256
  `7f1064bd823b8fb506e6dfe387074eb77277e3b0981f91b1d1e20bb733530c64` (read in full).
- Owner inputs `.task-inputs/W02-20-owner-inputs/` verified before use:
  `manifest-v2.json` SHA256 `5b4f1fc0…97969322` = **11 records, all byte+sha verify OK**;
  old `manifest.json` `279820de…` unchanged; `frozen-source.json` `b29707ff…`;
  `patch-routing-supplement.json` `94808ad6…`; `precise-path-exceptions.json`
  `7d14ca8c…`. W17 entry `b9325f77a2528c3370f1a719eda909b3303826fcb028eb5b008ed12eba78b5dc`
  confirmed as the launch source; `git show 4fd85f7:…` present.
- Interpreter: bundled `python.exe` 3.12.14 with `-X utf8 -B` for every fixture and
  author check; test-only `MERI_TEST_PYTHON`; process-local Git Bash.

## Result: focused modules + small entry (13 owned paths)

| Path | Change | Bytes | SHA256 (short) |
| --- | --- | --- | --- |
| `infra/browser-qualification/host-evidence.py` | small composition entry | 3265 | 66a50dc6… |
| `…/host_evidence/config.py` | + moved pins/patterns/bounds | 3728 | 0c555429… |
| `…/host_evidence/evidence_io.py` | + 6 strict/bounded JSON helpers | 3577 | c9cf64b9… |
| `…/host_evidence/source_binding.py` | NEW | 2002 | 5ebb52c8… |
| `…/host_evidence/admission.py` | NEW | 19842 | 6bac77ee… |
| `…/host_evidence/browser_capture.py` | NEW | 5179 | 1b7d7e5e… |
| `…/host_evidence/export_protocol.py` | NEW | 11050 | df036706… |
| `…/host_evidence/cli.py` | NEW | 8707 | 1fbf9a59… |
| `infra/browser-qualification/module-regressions.py` | harness wiring + cases | 24574 | 76406f28… |
| `infra/browser-qualification/security.test.mjs` | inventory + capture route | 41082 | 4f64008c… |
| `infra/browser-qualification/component-pins.json` | inventory/status | — | — |
| `infra/browser-qualification/README.md` | status/modules/interpreter | — | — |
| `docs/coordination/reports/W02-20-PYTHON-COMPLETION.md` | NEW (this report) | — | — |

`__init__.py`, `classification.py`, `collection.py`, `poll.py` are byte-identical
(`d1f27734…`, `a9b05cc2…`, `bbcd697a…`, `8868ff31…`).

## Extraction facts (author-verified against owner maps)

- 24 deferred functions moved to the 6 allocated destinations; **22 RAW_BODY_EXACT
  byte-identical** (probe: all 24 segment bytes/sha match before edit).
- `source_manifest` and `_inspect_reasons` carry the **only two permitted** `__file__`
  value-node changes to `_source_root()`; allowed-body bytes 522/5751 match.
- Exactly one new private helper; `exactNewLocator` matches and its SHA256
  `9d3c4e5b…b096cd0` holds.
- 38 original top-level assignments present once; aggregate
  `9082 bytes / 488df045…682742`; 48 named bindings; 63 legacy entry aliases; ONE
  `_CANCEL` + ONE `_EXE_HASH_CACHE` owned by `collection`; acyclic dependency edges
  as in the adopted table; no module imports the CLI/entry.
- Entry defines zero functions; `sys.dont_write_bytecode = True` precedes package
  imports; `sys.exit(main())` guard retained.

## Verification (actual commands)

Scratch (new, gitignored `.task-inputs/W02-20-author-checks/`, exclusive files):
`probe_segments.py` ALL_OK; `check_modules.py` RESULT PASS (py39 grammar ×11; no dup
defs; 22 raw + 2 path-exception bodies; helper; 38/48; 63+48 aliases; per-function
globals resolve; shared identity; bytecode-before-import); `baseline_compare.py`
RESULT PASS — W17-frozen vs W20 outputs byte-identical for source_manifest structure,
build_export_protocol (fixed ts 1700000000000), validate_export, 9 classify_put_response,
8 timer_record, strict/bounded IO, `_dump` exit/stdout, classify. **Only the observer
`source_manifest` hash changed** (new entry bytes — expected source-identity change, not
a behavior change); bootstrap/seccomp hashes unchanged and equal to on-disk bytes.

Harness `module-regressions.py` (direct run, exit 0): codexDirect 23/23,
codexEmbedded 23/23 (**duplicate** coverage), owner 33/33, newCases 26/26
(continuation 2; previously 19), integrity 10/10, `errors {}`, `ok true`. Owner replay
requires a flattened single-file view of the real current sources because the deferred
defs moved out of the entry; the legacy `observer-before-4863878.py` comparison therefore
reads a TEST-ONLY flattened file in original order (a unique `x`-opened file under a fresh
exclusive `.task-inputs/W02-20-harness-*` dir; no regeneration, no assertion lowered).

Canonical `node --test infra/browser-qualification/security.test.mjs`, run **once** in
continuation 2 through an explicit stdlib `subprocess` wrapper with a hard `timeout=120`:
argv `["node","--test","infra/browser-qualification/security.test.mjs"]`, cwd the worktree,
`MERI_TEST_PYTHON=<bundled 3.12.14>`, Node v24.19.0. Machine-readable envelope (fresh
exclusive dir `.task-inputs/W02-20-canonical-lul81rpj/`): start 2026-10-10T09:34:15Z, end
2026-10-10T09:34:30Z, elapsed 15.074 s (≤120), timed_out false, **returncode 0**, stdout
1395 bytes / sha256 `954f176b73c34cf645c353e150a0b1b3798ce3e8d7ce79ea7565f531e81ed299`,
stderr 0 bytes / sha256 `e3b0c442…`, **tests 14, pass 14, fail 0**, cancelled 0, skipped 0,
duration_ms 15017.26. Envelope source pins: security.test.mjs `4f64008c…`,
module-regressions.py `6a5d82a6…`, host-evidence.py `66a50dc6…`. Side effect: the suite
synthesizes `cdk.out/browser-qualification/*` (existing canonical behavior; synthesis only).
Counts: 23 direct, 23 embedded, 33 owner asserted inside `codex and owner observer replays
remain truthful`; embedded failure propagation preserved.

Historical attribution: the earlier continuation-1 run invoked `timeout 130 node --test …`;
its raw stdout supports 14 PASS / 0 FAIL / ~21 s / exit 0, but its **configured ≤120 s
ceiling is NOT certified** and is preserved as-is, not retroactively upgraded. The
continuation-2 envelope above is the first captured proof of a configured `timeout=120`.

Canonical-suite adaptations (no assertion lowered): the compile test now enumerates the
11 `host_evidence/*.py` files; the 39-frozen-body test lists the 11 modules; the bounded
capture test routes `process_platform_linux` to `host_evidence.browser_capture` (its
actual defining module). Frozen 43 patch-call sites are **routes, not 43 unique tests**;
only the intentional caller fake-effect/restoration controls plus the preserved
ineffective entry-alias negative controls claim behavioral coverage.

## Preserved failures / attribution

- Continuation item 1 `_value_dump` list-index fix: applied; rechecked green (owner 33/33).
- Run 2 (`mr2`) failed: owner `ValueError: substring not found` — deferred defs no longer
  in the entry; fixed by the flattened view. Preserved at
  `.task-inputs/W02-20-author-checks/mr2.*`.
- Run 3 (`mr3`) failed one new case: assembly-source restoration asserted inside the
  patch context; fixed by moving the check outside. Preserved at `mr3.*`.
- Final `mr4.*` green; all runs kept separately.
- Continuation-2 narrow repairs (owner DATA-only audit F1–F3): the capture caller now
  intercepts ALL application `open`/`os.read`/`os.killpg` before invoking the real
  `capture_browser`, asserts the exact two `xb` writes (empty bytes), the fake
  process/clock/platform effects, no default/real fallback, and observes
  `bc.process_platform_linux` restoration AFTER the context; the assembly caller replaces
  real missing-file reads with strict bounded/load ledgers on the actual `browser_capture`
  bindings (unexpected IO raises); all new scratch (invocation dir, cwd, bounded file,
  flattened view) is confined to a fresh exclusive `.task-inputs/W02-20-harness-*` dir,
  and the flattened view is a unique `x`-opened file there; `source_manifest` gained
  mapped-IO fixtures for the canonical guest root, present `seccomp.json`, the fallback
  profile name, and wrong/missing-layout refusal through the actual moved caller (with
  `_source_root` an explicit test seam). New cases 19 → 26. `mr5.*` green.

## Limits (not claimed)

No Python3.9 native, AL2023, Docker, browser, renderer, seccomp, systemd, CloudWatch,
ECR, host or build/deploy execution. No image/source security admission; the pinned
image's 22 unresolved CRITICAL/HIGH findings, the 49 findings, Office DEFERRED and G1
OPEN are unchanged. Custom external-entry symlink/custom-loader layouts remain
unsupported; only canonical sibling layout + abspath + cwd-independence + profile-name
fallback are demonstrated. The flat-three loader/context/support recipe does not cover
the eleven package files; the future 14-asset pre-import protocol is separately
allocated. Paid Bedrock unchanged (0 / $10). No source connectivity, cloud, provider,
model, native, IAM, network, worker, bootstrap, profile, app, controller, build-helper,
lock or contract edits; no push/amend.


## Codex owner metadata completion (after actual Hermes continuation2)

Returned719f6fa85b928473e62c3b3174831c457e6acf9d and its152-file/14-Git-record snapshot remain preserved (manifest6733211cb6109e503ce28a8d0c7dffddef8c514edceb930b40b0a14c863072be). Root inspection found the continuation changed the harness but left its component inventory at the old24574/76406f28 hash. Codex corrected only that inventory record to 30059 bytes / 6a5d82a6473af1ce503e9650e0a9dee82d0942dd786f34f15131b02e77971296. All other13 inventory rows already match raw files. Production modules, entry, canonical suite and the repaired harness are unchanged by this metadata completion; no test replay was performed merely for this correction. The earlier table records continuation1 source sizes; the current raw inventory is controlling for the completed candidate. New ordinary owner completion commit is required, followed by independent owner checks and a distinct actual exact-commit review. Status remains UNACCEPTED/source-only; no runtime/build/host/security/G1 admission.
