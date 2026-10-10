# W02-15 SDK decoder module extraction — independent review (review 1)

STATUS: **PASS (OFFLINE EXTRACTION-REVIEW scope only).** Evidence-only report by
one NEW independent actual Hermes reviewer session (not the implementation
session). This is neither Codex source acceptance nor a runtime/cloud/security/
scan/enforcement/transport/G1 pass. Codex (the integration owner) retains
primary integration acceptance after inspecting this closed process and report.

- Candidate commit (pinned): `aa368244ee9fce8244ec7ee1997c506bd08e143a`
- Direct parent: `bdcf817a0f5e4c5950344d83264c103106ecc3f0`
- Original W02-13 integration base: `22bf30ea049276ae1573aa79cc7872228ef095da`
- Assigned worktree: `C:/dev/main/meri-greenfield-worktrees/w02-sdk-decoder-modules-review-1`
- Assigned branch: `review/w02-sdk-decoder-modules-1`
- Sole new tracked owned path:
  `docs/coordination/reports/W02-15-SDK-DECODER-ORGANIZATION-REVIEW-1.md`
- Start state: `git status` clean; `HEAD == aa368244…`; `HEAD^ == bdcf817a…`.

## Scope and method

All 9 final source files were read in full: `scripts/reconstruct-sdk-capture.mjs`
plus `scripts/sdk-capture/{protocol,json-records,privacy,request-validation,
capture-validation,filesystem,artifacts,cli}.mjs`. The unchanged canonical test,
the accepted W02-13 implementation/review/owner-acceptance reports and the task
brief were read. The exact original decoder
`.task-inputs/W02-15-review-inputs/original-decoder.mjs` was read as data and
imported ONLY for inert pure comparison (its main guard at original L967–968
matches the entry guard, so import executes no CLI). No frozen producer/native
SDK was imported or executed. I authored my own confined reviewer audit; the
owner's `lexical-decoder-witness.mjs` was inspected before use and is labelled a
**supplied fixture**, not independent design. No source, test, contract or
dependency was edited. Windows 10, git-bash/MSYS, Node v24.19.0, reviewer-assigned
Python 3.12.14 (`-B`).

## Verified candidate bytes (independently re-hashed with sha256sum)

All 9 final-source hashes equal the implementation report; the byte-equal Git
candidate is confirmed by a clean `git status`/empty `git diff --stat` and by
re-hashing the working tree.

| Path | sha256 (observed == report) | match |
| --- | --- | --- |
| `scripts/reconstruct-sdk-capture.mjs` | `631ed9b94f26788aee09082e1d910f1415453a149490040560606247dc7f05e4` | YES |
| `scripts/sdk-capture/protocol.mjs` | `c20499a3a9e29069f6a59b58c7262fda6dfddd03068d7a49d6d73003f07e4a9e` | YES |
| `scripts/sdk-capture/json-records.mjs` | `8b889617a9565b7f1b5d29863b772b71f2c880a5fd1606b8a8b68ac2163be02d` | YES |
| `scripts/sdk-capture/privacy.mjs` | `1e894550429d84cd40e257c1c6914bf8d361f6aceff1884b4d84b048a1e98061` | YES |
| `scripts/sdk-capture/request-validation.mjs` | `cf2824f190f1d89e28b3aaf88a3031ff8d622b05a0fc91b1835c9200339df52f` | YES |
| `scripts/sdk-capture/capture-validation.mjs` | `742e38c75abf46f26b3e73520307670932c2ac171799fd4b9084e235aebfc611` | YES |
| `scripts/sdk-capture/filesystem.mjs` | `135e014dfac18c7861d5082a9721fcba6fd96a0aba5e74b8037784a78eea36b2` | YES |
| `scripts/sdk-capture/artifacts.mjs` | `8efae11eb5e4566cd05e495aa85aa1b64686577842ef74e6425bd6bfcfb2dd26` | YES |
| `scripts/sdk-capture/cli.mjs` | `0c3e57994739b57302b031bdab7d6ff5bac533eb71d2aebc44fa5408fad2b246` | YES |

Immutable inputs re-hashed and matching the brief:
`scripts/test_reconstruct_sdk_capture.mjs` `8354e1ec22c19e63b75a2ed3a6095200781d773a1a69f4dd7a9bd17e90118116`
(46476 bytes, READ ONLY, unmodified);
`original-decoder.mjs` `6e1500272262842d0679426d6bdcca0829c824610d393cdbd531267c23eb1111`
(54006 bytes). Supplied fixture
`lexical-decoder-witness.mjs` `111273922a5bf1c6888a16b992712e667666b2705ace8b939d402ab35f9e9449`.

## Module boundaries, responsibilities, interfaces (assessment)

| Module | Responsibility (cohesive, single-purpose) | Imports (decoder-internal) |
| --- | --- | --- |
| `protocol` | Immutable constants, exact field sets, pure byte/shape/canonical helpers | leaf |
| `privacy` | Credential/secret/header-sensitive predicates + scrubbing | leaf |
| `json-records` | Duplicate-key scanner + bounded transcript parsing | protocol |
| `request-validation` | Record-shape validation + synthetic request/tool semantics | protocol, privacy |
| `capture-validation` | Bounded byte snapshot + chunk/hash/decompression/semantic orchestration | protocol, json-records, privacy, request-validation |
| `filesystem` | Confined read/path/identity + destination primitives | protocol |
| `artifacts` | Exclusive artifact write/readback/scoped cleanup | protocol, filesystem |
| `cli` | Argument handling + `runCli` composition | protocol, filesystem, capture-validation, artifacts |
| entry | Thin re-export surface + main detection | cli (+ node:url/node:path) |

My independently measured import graph (static parse of every `.mjs`):

```
entry:               [protocol, privacy, json-records, capture-validation, filesystem, artifacts, cli]
protocol:            []
json-records:        [protocol]
privacy:             []
request-validation:  [protocol, privacy]
capture-validation:  [protocol, json-records, privacy, request-validation]
filesystem:          [protocol]
artifacts:           [protocol, filesystem]
cli:                 [protocol, filesystem, capture-validation, artifacts]
```

`acyclic = true` (DFS grey/black detection: zero cycles). No module imports the
entry; the entry imports `cli` for the public `runCli` plus `node:url`/`node:path`
for main detection only. No central cyclic barrel; no `import` performs
filesystem/network work (verified by reading each module — all side-effect-free
at import). Responsibilities are cohesive and match the task's requested
separation (config/protocol, domain/workflow semantics, infrastructure IO,
evidence decoding), with no god file: the largest module
(`capture-validation`, 253 lines) is one orchestration responsibility, not a
grab-bag. This satisfies the user's no-god-files preference and the AGENTS.md
focused-organization rule without a generic framework or arbitrary line quota.

## Public contract and behavior preservation (independently verified)

My own confined audit (`audit.mjs`) imported the inert original and the final
entry and reported:

- `export_count_final = 26`, `export_count_original = 26`,
  `exports_only_final = []`, `exports_only_original = []` — the entry re-exports
  exactly the original 26 names and exposes NO additional private helper
  (`errMsg`, `isInt`, `exactKeys`, `canonical`, `sortDeep`, `expectedChunkCount`,
  `MAX_REASONS`, `KEYS`, the error classes are not re-exported).
- `arity_mismatch = 0`, `body_mismatch = 0`, `type_mismatch = 0`,
  `value_mismatch = 0` across all 26 exports (function arity and
  `Function.prototype.toString()` body equality; constant deep equality).
- `realIo_fs_identity = true` (`realIo.fs === nodeFs` on both surfaces).

**I explicitly did NOT rely on `function.toString()` equality alone.** Because
toString equality cannot prove free-variable binding preservation, I
independently verified the exact regression class the audit found:

- `lexical_positive_sanity_ok = true` — a reviewer-built positive capture is
  accepted with no override.
- `lexical_over_capture = { original_ok: true, candidate_ok: true, candidate_reasons: [] }`
  — with `globalThis.TextDecoder` replaced by a throwing class, BOTH the original
  and the final candidate still accept the same positive capture. The final
  `capture-validation.mjs` now binds `TextDecoder` lexically
  (`import { TextDecoder } from 'node:util'`, L11), so the mutable global cannot
  reach it.
- `lexical_over_readCaptureFile = { read_ok: true, text: '{"a":1}\n' }` — the
  same override does not break the `filesystem.mjs` reader
  (also imports `TextDecoder` from `node:util`, L10).

The TextDecoder omission recorded in the implementation report (Codex audit,
reproduced by primary, repaired by Codex) is therefore **confirmed closed** by
my own independent witness, not merely by source-text equality.

Heuristic mutable-global closure scan across all 9 files: `TextDecoder` is
imported in both files that use it; the only unimported risky token is `Buffer`
in 5 modules, which is an intentional Node intrinsic used identically by the
original decoder (`Buffer.from/isBuffer/byteLength/allocUnsafe`) — not a binding
change. (The scan's lone `protocol: crypto` hit is a false positive: the token
`crypto` occurs only inside the import specifier string `'node:crypto'`.)

Preserved rules re-confirmed by reading and by the unchanged canonical suite:
strict duplicate-JSON scanning before `JSON.parse` for both transcript lines and
decompressed bodies; escaped-equivalent member-name comparison; fatal UTF-8 with
`ignoreBOM:true` so a BOM is retained then rejected; only JSON whitespace
space/tab/CR/LF as framing; case-sensitive exact encoding whitelist
(`identity/gzip/x-gzip/deflate`) with `zlib maxOutputLength`; mandatory
`rawBuffer` Buffer/bound/text correspondence and pre-output snapshot; immutable
transcript check in `writeCapture` before any destination side effect; metadata
shape validation before coercion/arithmetic; 32 MiB/20000/12288/4 MiB/8 MiB/
aggregate/chunk bounds; exact 64-reason cap with no rejected-value reflection;
canonical base64 with non-zero-padding-bit rejection; independent confidentiality
(`hasSensitiveBody` despite `hashOnly=false`); nlink-1 + within-API mtime/ctime
identity continuity + ancestor checks; NEW exclusive output dir, `wx` writes,
`pathedContained`, scoped failure cleanup, and re-read/re-hash verification.

## Independently run checks (captured; BOTH stdout and stderr persisted)

Runner: stdlib Python `subprocess.run`, array form, explicit cwd = worktree root,
`timeout=60` per process, `capture_output=True`. Artifacts under the NEW confined
`.task-inputs/W02-15-review-1/` (git-ignored).

| check | command | exit | timeout | sec | result |
| --- | --- | --- | --- | --- | --- |
| syntax ×9 (entry + 8 modules) | `node --check <file>` | 0 each | no | ≤0.07 | clean (0-byte out/err) |
| reviewer audit | `node .task-inputs/W02-15-review-1/audit.mjs` | 1 (scanner false positive only — see below) | no | 0.10 | closure/equiv/graph/lexical all PASS |
| supplied witness | `node .task-inputs/W02-15-review-inputs/lexical-decoder-witness.mjs` | 0 | no | 0.07 | original AND candidate accepted |
| canonical suite (ONCE) | `node --test scripts/test_reconstruct_sdk_capture.mjs` | 0 | no | 0.26 | **61 tests / 61 pass / 0 fail / 0 skipped / 0 todo** |

- Canonical suite: `duration_ms 210.2588`; stdout sha256
  `75ab1218209ef877855d4c72b9057d0b8ea2c2544ab82d1172032e8c33a271c3`, stderr
  `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` (empty).
  One benign disclosure line: `F13 disclosure: real file symlink creation denied
  by Windows; using injected fake`.
- Reviewer audit stdout sha256
  `e53c6bb382895737cbf4f5d88415b10a98879f825091e5f67d45f28852f949da`; the audit
  process exit 1 is caused ONLY by my scanner flagging the string token `crypto`
  in `'node:crypto'` as an unimported global — a false positive in my heuristic,
  **not** a source defect. Every substantive audit field is PASS
  (26==26 exports, 0 arity/body/type/value mismatches, realIo identity, acyclic,
  lexical immunity for both `validateCapture` and `readCaptureFile`).
- Supplied witness stdout sha256
  `e0c7984f5ac1859902a1381aebd98f35af524d1268a0937e40ce8873002dff49`
  (`{"boundary":"PURE_LEXICAL_BINDING_REGRESSION_NO_IO_NATIVE_NETWORK","originalAccepted":true,"candidateAccepted":true,"candidateReasons":[],"producerCalls":0,"awsCalls":0}`).
- All `node --check` streams empty; `summary.json` written under the confined
  scratch.

No broad `npm run check`/`npm test`, no install, no network, no producer/native/
cloud execution, no credential read, no source/test/contract edit.

## Substantive source findings (with severity)

- **No source defect found.** Free-variable closure, private helpers, constant
  identity, inert imports, main detection, and public API/CLI semantics are all
  preserved. Text/byte binding, strict duplicate JSON, fatal UTF-8/BOM, JSON-
  whitespace framing, raw-byte snapshot, all bounds, hash/chunk/compression,
  privacy sanitization, metadata validation, capped diagnostics, exclusive
  outputs, confined cleanup and Windows limitations behave as accepted.
- **INFORMATIONAL (non-functional): report table inaccuracy.** The W02-15
  implementation report's module table lists `decodeBody` among
  `capture-validation`'s exports; `decodeBody` is actually module-private
  (`function decodeBody`, L24 — not `export`). This does not alter any contract
  (the entry exposes only the original 26 names). Recorded for the owner's
  accuracy, not a code change.
- **INFORMATIONAL:** `parseArgs` (cli) and the request-validation/semantic helper
  functions are module-level `export`s used for internal composition; none is
  re-exported by the entry, so the public surface is unchanged. This is ordinary
  composition, not a widened product contract.

## Windows real/fake coverage and inherited limits (unchanged)

- This host denies real direct-file-symlink creation; the canonical suite's
  direct-file-symlink and one output-ancestor case use disclosed injected `fs`
  fakes, while the immediate-parent junction and the hardlink (`nlink 2`) cases
  ran **real**. Fake-based cases are not real-OS proof.
- Inherited W02-13 limits remain open and unmodified: trusted-local residual
  TOCTOU between the final identity check and any later reader; Windows
  `O_NOFOLLOW` undefined (final-file symlink protection relies on `lstat`); SDK
  result evidence is SUMMARY-only and cannot re-hash the absent result body; the
  producer end record carries no manifest hash; F10 complete CloudWatch
  collection/controller integration is out of scope.

## Scratch containment and disposition

All reviewer scratch is NEW and confined to the ignored
`.task-inputs/W02-15-review-1/` (verified ignored via `git check-ignore`;
resolved realpath inside the worktree root). Retained: `run.py`, `audit.mjs`,
`summary.json`, per-check `*.stdout.txt`/`*.stderr.txt`, and the transient
`lex-probe.txt` created then removed by `audit.mjs` itself. No OS temp or
unknown path was touched; no recursive cleanup of unknown content was performed;
`.task-inputs` and the owner-provided `W02-15-review-inputs/` (including the
supplied witness and original decoder) are preserved. No failure was hidden; my
audit's non-zero exit is disclosed above as a scanner false positive.

## Result

**PASS for OFFLINE EXTRACTION-REVIEW scope.** Candidate `aa368244…` (parent
`bdcf817a…`, original base `22bf30ea…`) is byte-verified against all 9 report
hashes; the canonical 61-case suite independently passes 61/61 (exit 0); all 9
`node --check` runs exit 0; and my own audit independently confirms the 26-name
public surface, zero arity/body/value drift, `realIo` identity, an acyclic
composed graph, and — critically — preserved lexical `TextDecoder` binding for
both `validateCapture` and `readCaptureFile` under a global-override witness.
This PASS is **not** Codex acceptance and **not** runtime/security/G1/browser/
Fargate/release acceptance; SUMMARY-only result evidence, the absent end-manifest
hash, trusted-local TOCTOU, and F10 all remain open. Codex owns primary
integration acceptance after inspecting this closed process and report.

- Review report:
  `docs/coordination/reports/W02-15-SDK-DECODER-ORGANIZATION-REVIEW-1.md`
