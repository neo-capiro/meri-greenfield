# W02-15 — focused SDK decoder module extraction (implementation report)

STATUS: **OFFLINE REFACTOR CANDIDATE / UNACCEPTED.** Bounded actual installed
Hermes implementation that reorganizes the accepted W02-13/ec31cf1 decoder into
focused modules WITHOUT semantic change. Codex owns integration/review/
acceptance; a separately allocated actual reviewer and Codex replay are still
required before the accepted W02-13 source is replaced. This task grants no
runtime, deployment, gate or acceptance authority.

## Provenance (two actual Hermes phases, same session)

- Exact base commit (pinned): `22bf30ea049276ae1573aa79cc7872228ef095da`
- Branch: `task/w02-sdk-decoder-modules`
- Worktree: `C:/dev/main/meri-greenfield-worktrees/w02-sdk-decoder-modules`
- Session (authoritative root readback from the session header; the launcher
  footer is the authoritative origin and was not independently read here):
  `20261010_000251_200a94`
- Phase 1 — source extraction: one installed default-profile session, cap
  30 turns / 1200 seconds. It performed the full extraction and all checks but
  **reached the 30-turn cap and returned NO commit**.
- Phase 2 — this explicit owner-selected bounded closeout: same session, cap
  10 turns / 600 seconds, no recursive delegation/background work. It wrote the
  missing report and committed the owned paths only. No test/check replay and no
  source edit occurred in phase 2; the 9 source files are byte-identical to the
  phase-1 extraction.

Codex inspected the closed launcher (zero remaining processes/readers, cleanup
confirmed), the exact owned-only dirty state, the entry, the equivalence
source/log and the final footer before authorizing this closeout.

## Scope (source organization only)

Only the allocated paths changed. The canonical test file is READ ONLY and was
not modified. No producer/options/native/provider/network/cloud execution and no
install, broad `npm run check`/`npm test`, or scratch/evidence deletion.

| Path | lines | sha256 (this commit) |
| --- | --- | --- |
| `scripts/reconstruct-sdk-capture.mjs` | entry (64) | `631ed9b94f26788aee09082e1d910f1415453a149490040560606247dc7f05e4` |
| `scripts/sdk-capture/protocol.mjs` | 133 | `c20499a3a9e29069f6a59b58c7262fda6dfddd03068d7a49d6d73003f07e4a9e` |
| `scripts/sdk-capture/json-records.mjs` | 165 | `8b889617a9565b7f1b5d29863b772b71f2c880a5fd1606b8a8b68ac2163be02d` |
| `scripts/sdk-capture/privacy.mjs` | 73 | `1e894550429d84cd40e257c1c6914bf8d361f6aceff1884b4d84b048a1e98061` |
| `scripts/sdk-capture/request-validation.mjs` | 206 | `cf2824f190f1d89e28b3aaf88a3031ff8d622b05a0fc91b1835c9200339df52f` |
| `scripts/sdk-capture/capture-validation.mjs` | 254 | `c1692bb528a515bd7d6fb13caeb6c0f72bb74448bdef03b528fdebc567d040e1` |
| `scripts/sdk-capture/filesystem.mjs` | 141 | `135e014dfac18c7861d5082a9721fcba6fd96a0aba5e74b8037784a78eea36b2` |
| `scripts/sdk-capture/artifacts.mjs` | 75 | `8efae11eb5e4566cd05e495aa85aa1b64686577842ef74e6425bd6bfcfb2dd26` |
| `scripts/sdk-capture/cli.mjs` | 45 | `0c3e57994739b57302b031bdab7d6ff5bac533eb71d2aebc44fa5408fad2b246` |
| `docs/coordination/reports/W02-15-SDK-DECODER-ORGANIZATION.md` | this file | — |

Baseline verified BEFORE extraction (unchanged inputs):

- original decoder `54006` bytes, sha256
  `6e1500272262842d0679426d6bdcca0829c824610d393cdbd531267c23eb1111`
- canonical test `46476` bytes, sha256
  `8354e1ec22c19e63b75a2ed3a6095200781d773a1a69f4dd7a9bd17e90118116`
  (re-checked at closeout: unchanged).

## Module responsibilities and dependency graph (acyclic)

| Module | Responsibility | Imports (decoder-internal) |
| --- | --- | --- |
| `protocol` | Immutable constants (`EXPECTED`, byte/chunk bounds, regexes), exact field sets (`KEYS`), small shared pure byte/shape/canonical helpers (`sha256Hex`, `isCanonicalBase64`, `countLinesUpTo`, `canonical`, `sortDeep`, `exactKeys`, `isInt`, `errMsg`, `expectedChunkCount`). Leaf. | — |
| `privacy` | Credential-key/value/header-sensitive predicates and scrubbing (`scrubSecrets`, `looksLikeSecret`, `isCredentialKey`, `hasSensitiveBody`, `SENSITIVE_HEADER_NAME`). Leaf. | — |
| `json-records` | Strict duplicate-key scanner before `JSON.parse` (`scanJsonKeys`, `MAX_JSON_DEPTH`) and bounded transcript/framing parsing (`parseRecords`). | `protocol` |
| `request-validation` | Source-specific record-field validation (headers/counters/spawn/result) + synthetic request/tool semantics; `resolveEncoding`. | `protocol`, `privacy` |
| `capture-validation` | Authoritative bounded byte snapshot + metadata/chunk/decompression/hash/semantic orchestration; `decodeBody`, `validateCapture`. | `protocol`, `json-records`, `privacy`, `request-validation` |
| `filesystem` | Trusted-local confined read/path/identity and destination primitives (`realIo`, `assertSafeAncestors`, `readCaptureFile`, `checkDestination`, `pathedContained`). | `protocol` |
| `artifacts` | Exclusive artifact construction/write/readback/scoped failure cleanup (`buildArtifacts`, `writeCapture`). | `protocol`, `filesystem` |
| `cli` | Argument handling/diagnostics and public `runCli` composition. | `protocol`, `filesystem`, `capture-validation`, `artifacts` |

Measured graph (phase-1 private `equivalence-check.mjs`):

```
protocol: []
json-records: [protocol]
privacy: []
request-validation: [protocol, privacy]
capture-validation: [protocol, json-records, privacy, request-validation]
filesystem: [protocol]
artifacts: [protocol, filesystem]
cli: [protocol, filesystem, capture-validation, artifacts]
```

Zero import cycles. No module imports the central entry. The entry imports only
`cli` (plus `node:url`/`node:path` for main detection); importing any module or
the entry performs no filesystem/network work. Main-module detection remains
only at the original entry.

## Original/final public exports and preservation proof

The original entry exported exactly 26 names; the final entry re-exports the
same 26 from their new modules (the entry does NOT expose private helpers).
The phase-1 private equivalence check asserted, for every original export:
presence, `typeof`, function arity AND byte-identical
`Function.prototype.toString()` body; deep-equal constant values; and
`realIo.fs` identity. Result: **EQUIVALENCE_OK, export_count 26, 0 problems**.

Names: `EXPECTED`, `MAX_INPUT_BYTES`, `MAX_LINES`, `MAX_RECORDS`,
`MAX_RECORD_BYTES`, `MAX_REQUEST_BYTES`, `MAX_DECOMPRESSED_BYTES`,
`MAX_TOTAL_RAW_BYTES`, `MAX_CHUNKS_PER_REQUEST`, `sha256Hex`, `scrubSecrets`,
`looksLikeSecret`, `isCredentialKey`, `hasSensitiveBody`, `isCanonicalBase64`,
`countLinesUpTo`, `parseRecords`, `MAX_JSON_DEPTH`, `scanJsonKeys`,
`validateCapture`, `realIo`, `assertSafeAncestors`, `readCaptureFile`,
`checkDestination`, `writeCapture`, `runCli`.

Behavior preservation: the extraction moved source verbatim (no logic edits).
All preserved rules remain: frozen producer constants/paths/prompt; duplicate
JSON checks before parse; escaped-equivalent keys; fatal UTF-8 with BOM retained
then rejected; only JSON whitespace; case-sensitive `identity/gzip/x-gzip/
deflate`; mandatory rawBuffer Buffer/bound/text correspondence and snapshot;
immutable transcript check before output; metadata shape validation before
coercion; 64-reason cap and no rejected-text reflection; 32 MiB/20000/12288/
4 MiB/8 MiB/aggregate/chunk bounds; canonical base64/source-4096/fullset/hash/
duplicate policy; sanitized headers/credential rejection; exact synthetic tool
roundtrip; summary-only limits; nlink-1 / Windows within-API timestamps /
ancestor checks; exclusive output and scoped cleanup.

## Commands, counts, exits, timeouts, log hashes (phase 1, retained)

1. Baseline hashes (`sha256sum`) — both inputs matched the brief (see Scope).
2. Syntax check (once), `node --check` on the entry + all 8 modules via stdlib
   `subprocess` argument array, explicit `cwd`, Python 3.12.14 with `-B`:
   **9/9 exit 0**. `ALL_SYNTAX_OK True`.
   log `.task-inputs/w02-15-decoder/syntax-check.log` sha256
   `26312979ce2db755585512bebdcbdfe3698cf0caa8a77f7688db2e36cffaec06`.
3. Canonical suite (ONCE), `node --test scripts/test_reconstruct_sdk_capture.mjs`,
   60 s outer timeout, captured stdout+stderr, Node v24.19.0:
   **61 tests, 61 pass, 0 fail, 0 skipped, exit 0** (duration_ms 201.2222).
   - stdout sha256 `784307576b0d45de6a5fa8621c92efe3f79a6231975d68332ac706e3c83ec8a2`
   - stderr sha256 `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` (empty)
   - one benign disclosure line on stdout:
     `F13 disclosure: real file symlink creation denied by Windows; using injected fake`.
4. Private equivalence/acyclic check (once), `node equivalence-check.mjs`:
   **EQUIVALENCE_OK**, export_count 26, cycles 0. log
   `.task-inputs/w02-15-decoder/equivalence-check.log` sha256
   `7f451bb14e7457ace906ef96d84b54f77e9c6b5010e59f872c1522ab37107dc0`.

No test/check was replayed in phase 2 (prohibited). No broad check was run.

## Failures and source corrections (honest)

- Extraction/source: **zero** canonical-suite failures, syntax failures,
  equivalence problems or import cycles on the first measured runs. No source
  correction was required. The canonical test file remains byte-exact
  (`8354e1ec…`); no test was fitted to the refactor.
- Phase-1 process: the 30-turn cap was reached and **no commit was returned** —
  an honest phase-1 incompleteness, not a test failure.
- Phase-2 closeout mistakes (recorded, not softened): (1) the report was first
  written by a relative path that resolved against a stale shell cwd, landing it
  at `.task-inputs/w02-15-decoder/docs/coordination/reports/`. (2) That stray
  copy — created exclusively by this session under the confined, git-ignored
  scratch — was then deleted (`rm -rf .task-inputs/w02-15-decoder/docs`) and the
  correct absolute path was intended but not reached before the phase-1 turn
  cap. Neither action was a test failure, and no retained log/evidence or
  unknown file was deleted. Both are corrected in this phase 2.

## Private scratch disposition and containment

All scratch/evidence is exclusively NEW and lives under the ignored
`.task-inputs/w02-15-decoder/` (`.task-inputs/` is git-ignored; verified with
`git check-ignore`). Resolved absolute containment verified: `realpath` =
`<WT>/.task-inputs/w02-15-decoder`, inside the worktree root. Retained files
(with sha256): `run_syntax_check.py` `8b3b32596bc9374f091b1519baa6018de7f4475bef4a2dee05057866aa3008bd`,
`syntax-check.json` `611be7e550c1f4b3eea34983272971f96c7839253cac5b02490ce4914995a29e`,
`syntax-check.log` `26312979ce2db755585512bebdcbdfe3698cf0caa8a77f7688db2e36cffaec06`,
`run_canonical_suite.py` `dc4dd8f4c791e480b8757b87f88435e2939b14f4dd9e02e5610a8f7d8ac571d1`,
`canonical-suite.stdout.txt` `784307576b0d45de6a5fa8621c92efe3f79a6231975d68332ac706e3c83ec8a2`,
`canonical-suite.stderr.txt` `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`,
`canonical-suite.console.txt` `cc7ffedffe4db345b08e5f73d2cc0210b70f9f4f7e4214a87c82431ef8a300af`,
`equivalence-check.mjs` `c56ae77fddf5ae9c50fc2376e129a92caa0a655069c40d622e67225890c9c52f`,
`equivalence-check.log` `7f451bb14e7457ace906ef96d84b54f77e9c6b5010e59f872c1522ab37107dc0`,
`original-decoder.mjs` `6e1500272262842d0679426d6bdcca0829c824610d393cdbd531267c23eb1111`
(git `HEAD` snapshot imported by the check with its CLI inert). No recursive
cleanup was performed; logs are preserved as evidence; nothing outside the new
confined scratch was touched. `.task-inputs` and unknown existing files were
never deleted.

## Remaining limits

- This is a **source-organization** candidate only. No runtime/cloud/gate
  authority. All live/scan/enforcement/transport/runtime/log/G1 gates remain
  OPEN. A separately allocated actual Hermes review and Codex replay are
  required before any acceptance or replacement of the accepted W02-13 source.
- Inherited W02-13 limits, unchanged: trusted-local residual TOCTOU between the
  final identity check and a later reader; some Windows file-symlink cases use
  disclosed injected fakes while junction/hardlink cases are real; SDK result
  evidence is SUMMARY-only and cannot re-hash the absent result body; the
  producer end record carries no manifest hash; F10 complete CloudWatch
  collection/controller integration is out of scope.

## Gate status / handoff

No AWS/network/provider/native SDK/browser/Office/Docker/server/socket, no
dependency/package/lock/global-config change, no credential read, no
push/amend/base switch and no background work occurred. Ordinary
development-model use inherent in this session is the only external
interaction. No acceptance or self-review is claimed. Reviewable commit contains
ONLY the ten allocated paths, added explicitly. Distinct actual Hermes review
plus primary verification are still required.
