# W02-13 SDK-capture decoder — independent review 1

STATUS: **PASS (OFFLINE SOURCE REVIEW scope only).** Evidence-only report by one
new independent actual Hermes reviewer (session `20261009_234713_2ea7d5`). This
is neither Codex source acceptance nor a live/runtime/scan/enforcement/transport/
CloudWatch/G1 pass. The Codex integration owner retains acceptance and any future
runtime/cloud admission.

- Candidate commit: `ec31cf1d34abb1c928bfd85ba1b4e62f1d1a0386`
- Direct parent: `3cde028cf31223f2f050d7ac35e13061ee37c683`
- Original implementation base: `6176ce11217213f1f3b30801349864106c85a21a`
- Assigned worktree: `C:/dev/main/meri-greenfield-worktrees/w02-sdk-capture-decoder-review-1`
- Assigned branch: `review/w02-sdk-capture-decoder-1`
- Sole new tracked owned path: `docs/coordination/reports/W02-13-SDK-CAPTURE-DECODER-REVIEW-1.md`
- `git status` at start: clean; `HEAD == ec31cf1…`; `HEAD^ == 3cde028…`.

## Verified candidate bytes (independently re-hashed with sha256sum)

| Path | bytes | observed SHA256 | expected | match |
| --- | --- | --- | --- | --- |
| `scripts/reconstruct-sdk-capture.mjs` | 54006 | `6e1500272262842d0679426d6bdcca0829c824610d393cdbd531267c23eb1111` | same | YES |
| `scripts/test_reconstruct_sdk_capture.mjs` | 46476 | `8354e1ec22c19e63b75a2ed3a6095200781d773a1a69f4dd7a9bd17e90118116` | same | YES |
| `docs/coordination/reports/W02-13-SDK-CAPTURE-DECODER.md` | 26555 | `17e8253cf7df93bc7639c78de80c7019b7da3307c274626c70cca4c01e148584` | same | YES |

Read-only reference data re-hashed (not imported/executed):

- `apps/worker/qualification/probes/sdk-capture.mjs` `4b71228ed0ce49f4bc39c2abcc497d7b76fea30ffd115ca796a13dff7edd6840` (51899 bytes) — matches.
- `apps/worker/qualification/probes/sdk-capture-options.mjs` `964f4f1958dd0707198fcd21611018b9a9337e90e5f434ed24ce47beb3986b0e` (17469 bytes) — matches.

`git diff --stat 3cde028… ec31cf1…` = exactly the three paths above
(+373 / −79). No other path changed. The completion diff is confined to the
R1–R5 repairs described below.

## Scope and method

All three candidate files were read in full. The frozen producer/options were
read as source data only and never imported or executed. The candidate decoder
was compared field-by-field against the producer's `buildOutputLines`,
`classifyRequest`, `sanitizeHeaders`, `hasSensitiveBody` and
`validateResultMessage`. One canonical owned suite was run once; two
`node --check` checks and one reviewer-constructed private adversarial probe were
also run. No source was patched. Reviewer runtime: Windows 10, git-bash/MSYS,
Node v24.19.0, the assigned Python 3.14 interpreter (`-B`).

## Independently run checks (captured; BOTH stdout and stderr persisted)

Runner: stdlib Python `subprocess.run` array form, explicit cwd = worktree root,
`timeout=60`, `capture_output=True`. Logs under
`.task-inputs/review1/` (ignored). `summary.json` `e7a5c62d137ac92e203a992a5f067fbf6c57cb73059af240c409f6d3c309c58d`.

| check | command | exit | timed_out | time | result |
| --- | --- | --- | --- | --- | --- |
| syntax decoder | `node --check scripts/reconstruct-sdk-capture.mjs` | 0 | no | 0.047 s | clean (0 bytes out) |
| syntax tests | `node --check scripts/test_reconstruct_sdk_capture.mjs` | 0 | no | 0.044 s | clean (0 bytes out) |
| canonical suite | `node --test scripts/test_reconstruct_sdk_capture.mjs` | 0 | no | 0.242 s | **61 tests / 61 pass / 0 fail / 0 skipped / 0 todo** |

Captured log SHA256: canonical stdout `893c568a2e87bf7581ffdbdfdafb56c2f4095e5b43922724adb029a751ada3d5`,
canonical stderr `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`
(empty); both `node --check` streams empty. Node reported `duration_ms 189.5227`.

The author's claim of 61/61 is **independently reproduced** by my own single run
(mine 189.5 ms vs the author's final 214.5 ms — a normal timing difference, not a
discrepancy). The author's report also records an earlier 61/61 (386.3 ms) and a
separate structured-`rawLength` TypeError that justified the narrow repair.

Private adversarial probe (reviewer-authored, pure imports only, synthetic
bounded fixtures; `.task-inputs/review1/adversarial.mjs` `ba93832cf71be00478df43dfdc43ffd2c3da517a68621649212e885fcdb24ebd`,
output `adversarial.out.txt` `32cc6f973bb46fd7aaa9c63c6a95af899cc50d4a154c5988b02308111c88f10d`):
**12 checks, 12 pass, 0 fail, exit 0.** Covers: astral surrogate-pair escape
colliding with a literal emoji key; slash-escaped key colliding with a literal
slash key; trailing-token and duplicate-complete-value rejection; same name in
distinct scopes allowed vs same scope rejected; malformed array/comma rejection;
canonical base64 strictness (including non-zero padding bits `AB==` rejected);
an invented `end.manifestHash` rejected; structured `rawLength` with a
non-callable `toString` not throwing and rejecting; structured/fraction/boolean/
array index rejection; CLI canary not reflected; duplicate body key rejection.
(Two initial probe failures were defects in my own fixture — a wrong base64
expectation and my builder performing `rawLength` arithmetic — corrected before
the recorded run; they are not decoder defects.)

## Substantive source findings

### 1. Producer protocol integration — MATCH

- Decoder `KEYS` (decoder L146–155) exactly mirror the producer's emitted shapes:
  manifest 11 fields, chunk 6, end 5, request 8, counters 3, spawn 13, result 7,
  header 2. Compare producer `buildOutputLines` (producer L1044–1088) and the
  `runCapture` return (L1014–1036) — identical names.
- `EXPECTED` constants (decoder L46–56) match `sdk-capture-options.mjs`:
  model `meri-sonnet-qualification`, `mcp__wire__echo`, `meri-wire-token`,
  `meri-wire-tool-result`, tool_use id `toolu_meri_wire_01`, the exact synthetic
  prompt, the two accepted paths, `EXPECTED_REQUESTS = 2`, `MAX_CHUNK_BYTES = 4096`.
- One UUID: `captureId` validated as UUID and required equal on every record
  (L600–606). Exactly indices 1,2 (L627–639). A single manifest and single end
  record are required (L584–585).
- Independent confidentiality despite `hashOnly=false`: `hasSensitiveBody(json)`
  is evaluated and rejects credential/secret bodies regardless of the producer
  claim (L720–723); `validateHeaders` independently re-verifies redaction.
- Exact synthetic prompt, model, `stream:true`, single advertised wire tool, and
  the tool_use/tool_result ids, roles, ordering and input/content are enforced in
  `validateFirstRequest`/`validateSecondRequest` (L385–441), mirroring the
  producer's `validateFirstRequest`/`validateToolRoundTrip`.
- Source argv/env/header sanitization and clean-spawn facts are enforced in
  `validateSpawn` (L481–515): `argvFlags` limited to safe names or
  `--hashed-<12 hex>`, `envNames` sorted/unique names including
  `ANTHROPIC_BASE_URL`, stderr bounded, `stderrTruncated === false`.
- No invented producer end-manifest hash: the end record is shape-checked to 5
  fields and any `*hash`-named field is rejected (L621–622). No manifest hash is
  synthesized.
- The absent SDK result body / `MERI_WIRE_DONE` marker is **not** claimed: the
  decoder validates only the 7-field SUMMARY (`validateResult`, L517–527) and
  documents in the report `limits` string (L762) that it cannot re-verify the
  absent result body or the producer's pre-summary marker. `resultSha256` is
  treated as a summary value only. This is honest and correct.
- Optional caller/toolset_name and plural `*_tokens` accounting fields are
  preserved: semantic validators do not use `exactKeys` on nested body objects,
  and `isCredentialKey` splits plural `tokens` (not a credential segment). The
  suite's positive cases assert `caller`/`toolset_name` acceptance.

### 2. Strict JSON before parsed-body confidentiality — PASS

`scanJsonKeys` (L246–341) runs on **every NDJSON record line before `JSON.parse`**
(L217) and on **every decompressed body before `JSON.parse`** (L714). It decodes
JSON string escapes (`\uXXXX`, `\"`, `\\`, `\/`, …) so escaped/colliding member
names compare by decoded value at every nesting depth, with a per-object `seen`
set (distinct scopes allowed). Independently confirmed: an astral surrogate-pair
escape collides with a literal emoji key; `\/` collides with a literal `/`;
trailing JSON, malformed arrays/commas and nesting beyond `MAX_JSON_DEPTH = 64`
are rejected; escaped quoted string content and same-name-different-scope are
accepted. All transcript and body bytes use `TextDecoder('utf-8',{fatal:true})`
(L566, L711); parse/decompression/JSON diagnostics are constant strings with no
rejected excerpt or secret-like value.

### 3. Source chunk framing — PASS

`expectedChunkCount(rawLength)` (L767–771) ties `chunk.total` to the declared
`rawLength` via the 4096-char rule. `seq` must be an integer in `0..total-1`;
per-chunk base64 must be canonical (`isCanonicalBase64`, L166–173 — re-encodes
identically; independently confirmed that non-zero padding bits `AB==` are
rejected), within the source bound, and non-final chunks must be exactly 4096
chars (L659–678). Exact cardinality/contiguity (`chunks.size === total`, every
`0..total-1`) is required (L682–697). Raw and decompressed byte hashes are
recomputed and compared (L699–709). The identical-redelivery duplicate policy is
explicit and counted (`slot.duplicates`, L671–676); changed duplicates,
conflicting totals, extra unique seq, missing/truncated records all fail. Bounds
enforced: 32 MiB transcript, 20000 lines/records, 12288-byte record, 4 MiB raw
per request, 8 MiB decompressed, 8 MiB aggregate, ≤64 reasons. Real compressed
expansion is bounded by `zlib` `maxOutputLength: MAX_DECOMPRESSED_BYTES` **and** a
post-decode length check (L359–360, L705) — not merely declared metadata.

### 4. R1 — one authoritative byte source — PASS

`validateCapture` (L551–568) snapshots the sole byte source with
`Buffer.from(...)`, requires an explicit `rawBuffer` to be a `Buffer` within the
bound, fatal-decodes the snapshot, and requires exact text/byte correspondence
**before** parse/export. `writeCapture` refuses if
`sha256Hex(result.inputBuffer) !== result.report.inputSha256` before any
destination side effect (L887–889). The CLI default read path supplies
`rawBuffer` from `readCaptureFile` (L947–955). Genuine `inputSha256` binds the
original exported transcript bytes.

### 5. R2 — malformed entries / structured metadata — PASS

A shape+integer-index pre-check runs before any dereference/sort (L633–635):
`requestManifest.some((e) => !exactKeys(e, KEYS.request) || !isInt(e.index,1,2))`.
Because `exactKeys` returns false for non-objects, `null`/array/primitive entries
short-circuit before `e.index` is touched; structured/fraction/boolean/array
indices fail `Number.isInteger` and are rejected without coercion. The repaired
early continuation `if (v.reasons.length) continue;` (L647) prevents any invalid
metadata from entering arithmetic or chunk setup, so a structured `rawLength`
with a non-callable `toString` cannot reach `totalRaw += entry.rawLength`.
Independently confirmed: that composition does not throw and rejects (the earlier
TypeError was my own fixture's arithmetic; the decoder itself is clean).

### 6. R3 — BOM / framing / encoding — PASS

`TextDecoder('utf-8',{fatal:true, ignoreBOM:true})` retains the BOM (U+FEFF) at
the transcript and body boundaries (L566, L711, L848) so a BOM is retained and
then rejected by strict JSON. Transcript framing trims only JSON whitespace
space/tab/CR/LF (L204) — never Unicode trim's NBSP/VT/FF/BOM. BOM bodies reject in
identity/gzip/x-gzip/deflate; the encoding whitelist is exact case-sensitive
(`decodeBody`, L355–365, no `toLowerCase`), so `GZIP`/`Deflate`/`IDENTITY` reject
while all four proper encodings stay positive. Verified by the suite and by my
reading of the completion diff (the `toLowerCase()` was removed).

### 7. R4/R5 — diagnostics — PASS

`parseArgs` returns the constant `'unexpected argument'` (L941) with no reflected
value. A single `addReason` accumulator caps reasons globally at `MAX_REASONS = 64`
(L553–556). Independently confirmed: the CLI does not reflect an
`--unexpected=<canary>` argument, and a many-mixed-UUID composition yields exactly
64 reasons. No parser/zlib raw excerpt reaches the CLI or report.

### 8. R6/R7 — scratch confinement — PASS

`WT_ROOT` is derived from `import.meta.url` (test L29–31); `SCRATCH_ROOT =
WT_ROOT/.task-inputs/testscratch`; no implementation basename or host-specific
separator is hardcoded (L39–43, L883–890). The `after` hook verifies resolved
confinement and that the run root is not a symlink **before** `rmSync` of only the
exclusively-created run directory (L58–67); the owner query and `.task-inputs` are
never deleted. The append/truncate fixture closes its inspection fd in `finally`
(L489–496). My single canonical run left `.task-inputs/testscratch/` empty
(cleanup verified); the owner query `W02-13-review-1-query.md` is preserved.

### 9. Input/output integrity — PASS, with a documented residual

`readCaptureFile` (L809–850) does a full bounded read loop, strict fatal UTF-8,
`nlink===1` gates at four observations (path pre/post, fd before/after),
path-vs-fd and fd-before-vs-fd identity plus within-API mtime/ctime continuity,
and `assertSafeAncestors` over the immediate parent and every ancestor (L789–803).
Output is a NEW exclusive directory (`mkdirSync` throws `EEXIST`), files written
with flag `wx`, `pathedContained` containment checks, failure cleanup scoped to
the owned directory, and a canonical `capture-report.json` with per-file size and
SHA256 recomputed and re-verified after writing (L884–928). **Residual TOCTOU:**
`assertSafeAncestors` is invoked only **pre-open** (L813); there is no post-open
ancestor recheck. This is a trusted-local TOCTOU reduction, **not** a hostile-OS
proof, and it is disclosed in the report `limits` field. Windows
`O_NOFOLLOW` is undefined (treated as 0), so final-file symlink protection relies
on `lstat`; this is disclosed in the author report.

### 10. No gate relaxation — PASS

The candidate changes only the three owned paths; no producer, options,
contracts, packages, lockfiles, task briefs or other reports changed. F10
(log collector / controller `28b569f`) remains out of scope and unaccepted.
Offline tests cannot establish CloudWatch transport, runtime, scan, IAM/network,
surviving external enforcement, source admission or G1. Windows symlink fake
coverage is not real-OS proof.

## Historical truth retained (inspected, not overwritten)

The author report retains, and my read confirms, the required history: W02-11
session `20261009_222232_edfab9` rejected controller `28b…`, hit the 40 cap, had
Python failures before a reported 41 pass and Node 18 pass, with unknown old
OS-temp cleanup that this repair cannot claim to clean; W02-13 initial session
`20261009_225228_53da1e` hit the 40 cap / no commit with 35/4 → 39/39 → 39/39 and
an 863-byte staged skeleton vs a 14026-byte working report; the owner witness's
five measured negative failures; the same-session resume returning `3cde028`
with 50/50; the forbidden post-commit `npm run check` that failed (exit 1, `ajv`
missing from `packages/contracts/validate.mjs`) with no install/repair; and the
Codex completion including the preserved structured-`rawLength` TypeError before
the narrow repair. Failed and forbidden checks stay visible.

## Unavailable capabilities / limits of this review

- OFFLINE ONLY: no AWS/network/provider API, no SDK/native CLI, no browser, no
  Office, no Docker, no server/socket, no launcher/prepare/execute, no
  deployment, no credential read, no producer execution/import. No direct model
  call beyond the ordinary installed-Hermes session.
- Windows file-symlink creation is privilege-denied on this host: in my canonical
  run the direct-file-symlink and one output-ancestor case ran via disclosed
  injected `fs` fakes; the immediate-parent junction and the hardlink (`nlink 2`)
  cases ran **real** on this host. Fake-based cases are not real-OS proof.
- This review cannot prove live policy, browser, durability, Fargate, CloudWatch
  transport, scan, enforcement or release/G1 acceptance.
- `assertSafeAncestors` post-open recheck absence is a disclosed residual, not a
  new attacker-root deployment gate and not a native test.

## Cleanup and evidence

Reviewer scratch is confined to this worktree's ignored `.task-inputs/review1/`
(`run_checks.py`, `summary.json`, six `*.bin` logs, `adversarial.mjs`,
`adversarial.out.txt`). No recursive cleanup of unknown paths was performed; the
owner query and `.task-inputs` are preserved; the canonical suite's own
`testscratch` run directory was verified removed. `git status` shows only the new
report as untracked (plus ignored `.task-inputs`). No source edit, push, amend,
rebase or other-base checkout occurred. Reviewer bounds (max 40 turns / 1800 s)
were not exceeded.

## Result

**PASS for OFFLINE SOURCE REVIEW scope.** The candidate `ec31cf1…` (parent
`3cde028…`, original base `6176ce1…`) matches all three expected hashes; the
owned suite independently passes 61/61 (exit 0); both `node --check` checks pass;
and my private adversarial probe passes 12/12. The reviewed source substantively
satisfies criteria 1–10, with the disclosed TOCTOU and Windows-fake limitations
reported as-is. This PASS is **not** Codex acceptance and **not** a live, scan,
enforcement, transport, runtime, CloudWatch or G1 pass. A Codex replay/acceptance
decision by the integration owner is still required.

- Review report: `docs/coordination/reports/W02-13-SDK-CAPTURE-DECODER-REVIEW-1.md`
