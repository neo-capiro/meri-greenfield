# W02-13 — Standalone SDK raw-capture decoder repair (implementation report)

STATUS: **OFFLINE DECODER CANDIDATE / UNACCEPTED.** Bounded actual Hermes
implementation followed by explicitly allocated Codex completion. Codex owns
acceptance; a separate actual independent Hermes
review and Codex replay are still required. This task grants no runtime,
deployment, G1 or acceptance authority.

- Exact base commit: `6176ce11217213f1f3b30801349864106c85a21a`
- Branch: `task/w02-sdk-capture-decoder`
- Worktree: `C:/dev/main/meri-greenfield-worktrees/w02-sdk-capture-decoder`
- Seed source commit: `28b569f4302f2652ca1cf54eaf714610b8a6280c`
- Observed implementation session id: `20261009_225228_53da1e`
  (launcher footer is authoritative; no self-referential candidate hash is
  embedded in this report)

## Scope (three paths added by Hermes, then modified by Codex)

| Path | lines | sha256 (after Codex completion) |
| --- | --- | --- |
| `scripts/reconstruct-sdk-capture.mjs` | 968 | `6e1500272262842d0679426d6bdcca0829c824610d393cdbd531267c23eb1111` |
| `scripts/test_reconstruct_sdk_capture.mjs` | 891 | `8354e1ec22c19e63b75a2ed3a6095200781d773a1a69f4dd7a9bd17e90118116` |
| `docs/coordination/reports/W02-13-SDK-CAPTURE-DECODER.md` | this file | — |

Nothing else changed: no controller, producer/probe/options/tests, Office
decoder, contracts, infra, packages, lockfiles, task briefs or other reports;
no push/amend/rebase/global config/approval bypass. The original Hermes commit
added these three paths; Codex completion modifies exactly these three.
Historical author checks below describe their stated stage, not acceptance.

### Seed provenance (retained)

Seeded byte-exact from Git commit `28b569f` via `git show` (no working-tree
copy), LF only, zero CRLF, `xb` exclusive create, expected SHA256 verified
before write:

| Seed path | bytes | sha256 (pre-repair) |
| --- | --- | --- |
| `scripts/reconstruct-sdk-capture.mjs` | 28276 | `ba889b5de797b0e1cf33626e7b108b502cdee9f000691a6c7e5406e7f6f2f051` |
| `scripts/test_reconstruct_sdk_capture.mjs` | 14173 | `a5925a25b9f97a789af1251d8e815c7c70c170c13f5ed84993c9aa35ca1c6970` |

This is the seed-repair of the F10/F11/F12/F13/F15 lineage. **F10 (log
collector / controller) is OUT OF SCOPE and UNACCEPTED.** A fixed standalone
decoder cannot establish complete CloudWatch collection; live run/scan/
enforcement/task/log/G1 gates stay OPEN.

## Reference inputs read (read-only)

- `apps/worker/qualification/probes/sdk-capture.mjs` sha256
  `4b71228ed0ce49f4bc39c2abcc497d7b76fea30ffd115ca796a13dff7edd6840`
- `apps/worker/qualification/probes/sdk-capture-options.mjs` sha256
  `964f4f1958dd0707198fcd21611018b9a9337e90e5f434ed24ce47beb3986b0e`
- `docs/coordination/tasks/W02-05-SDK-WIRE-CAPTURE.md`,
  `W02-05-SDK-REVIEW-6.md`, `W02-05-SDK-OWNER-STDIO-CORRECTION.md`,
  `docs/qualification/G1-REMAINING-WORK.md`
- root `…/.task-inputs/native-run-candidate-28b569f-audit/REPORT.md` (all 15
  findings), `…/native-run-admission-gap-audit/REPORT.md`
- root private `…/private-evidence/W02-11-implementation-1/query-used.md`
  (query sha256 `48631aadd2132d27d938c58c1961f4ed00c17d3520a6f0a080aa71e28d75812e`)

The producer SDK/native source was read as data only; it is never imported or
loaded at runtime. All source constants/shapes below were reconciled against the
exact `buildOutputLines` / `classifyRequest` / `sanitizeHeaders` /
`hasSensitiveBody` / `validateResultMessage` code and options constants.

## Repair design (F11, F12, F13; test/provenance part of F15)

Node builtins only (`fs`, `crypto`, `util`, `path`, `zlib`, `url`). Strict
all-before-write; on any input defect it returns reasons and writes NOTHING.

### F11 — exact field shapes + independent confidentiality

- Every record now has an **exact allowed key set** enforced (manifest 11,
  request-chunk 6, end 5, request metadata 8, counters 3, spawn 13, result 7,
  header 2). Extra/missing/unknown fields are rejected before any output. The
  end record rejects any invented `*hash` field.
- `hashOnly` must be the **boolean false**; missing / non-boolean / `'false'` /
  `0` / `true` are all rejected.
- Independent credential detector re-implemented (delimiter + camelCase + acronym
  segment splitting; credential segments `key/apikey/token/secret/password/
  passwd/passphrase/credential/credentials/authorization/bearer/cookie`;
  secret-like patterns sk-ant / AKIA|ASIA / JWT / Bearer; depth>12 fails closed).
  Any credential-bearing or secret-like request body is rejected **regardless of
  the producer `hashOnly` claim**. Plural SDK accounting fields
  (`max_tokens`/`input_tokens`/`output_tokens`/`cache_creation_input_tokens`)
  remain supported; only singular segments flag.
- Independent **header sanitiser verifier**: entries must be exactly
  `{name,value}` strings, names sorted+unique+non-secret; any sensitive header
  name (`authorization|cookie|api-?key|auth|token|secret|credential|password|
  bearer`) must carry `<redacted>`; non-sensitive values must be scrub-fixed
  points, non-secret, and bounded to 256 chars (or exactly 256+`<truncated>`).
  Unredacted `authorization` / `x-api-key` values are rejected.
- Spawn is validated for exact fields, types, bounds, sanitisation and success
  facts (spawned/cleanedUp true, stderr not truncated, `argvFlags` are sanitised
  flag names/`--hashed-…` only, `envNames` sorted+unique names only, includes
  `ANTHROPIC_BASE_URL`, **no values**). Result is validated as the exact 7-field
  SUMMARY (success / is_error:false / end_turn / UUID session / bounded types).
  Counters must be exactly 1/1/1. Rejected values never appear in reasons.

### F12 — chunk totals / sequence membership

- Chunk `total` is tied to the declared `rawLength` (4096-char source rule):
  `expected = ceil(ceil(raw/3)*4 / 4096)`. Every chunk must carry that total;
  all chunks of an index must agree (no overwrite). Declared totals like
  `1_000_000` are rejected immediately, before any reconstruct loop (bounded
  reasons ≤ 64).
- `seq` must be an integer in `0 .. total-1`; per-chunk base64 must be canonical
  (re-encodes identically), within the source 4096-char bound, and non-final
  chunks must be exactly 4096 chars. Exact set cardinality/contiguity is checked
  (`chunks.size === total`, every `0..total-1` present). Extra unique seq are
  rejected, never silently dropped.
- Duplicate policy: an **explicit identical-delivery duplicate** (all fields
  equal) is tolerated and counted; changed duplicates, conflicting totals,
  mixed captureId, unknown records and truncated records are rejected.
- Raw byte length+sha256 and decompressed length+sha256 are recomputed and
  compared; gzip/x-gzip/deflate/identity only; per-request raw ≤ 4 MiB,
  decompressed ≤ 8 MiB, combined raw ≤ 8 MiB enforced before allocation.

### F13 — filesystem identity + evidence preservation

- Input read checks the **final file AND its immediate parent plus all
  ancestors** for symlink/junction (a real Windows junction is reported as a
  symlink by `lstat`, verified on this host). The previous defect (only
  ancestors-of-dirname) is fixed.
- Full bounded read of the **original bytes** with **strict fatal UTF-8**
  (`TextDecoder(fatal:true)`); replacement decoding is gone.
- Identity continuity: `lstat`-vs-`fstat` cross-identity (dev/ino/size/nlink),
  fd-before-vs-fd-after and path-before-vs-path-after within-API mtime/ctime
  continuity, plus a post-read re-`lstat` of the path. Append/replace/truncate
  races are detected. Windows path-stat vs fd-stat ctime are never compared
  across APIs (only within the same API), as required.
- Output is a NEW exclusive directory: parent chain validated non-symlink,
  existing destination rejected, `..`/NUL traversal rejected, fixed
  allow-listed filenames only. Artifacts persist the **original raw transcript
  bytes**, each **raw request bytes** and **decompressed original bytes**, and a
  canonical `capture-report.json` with independently recomputed per-file byte
  counts and SHA256 (re-read and re-verified after writing). On any write
  failure only the just-created owned directory is removed and removal is
  verified — no parent/query/foreign-tree deletes, no partial output.

### Output artifacts (per successful run)

`capture-transcript.ndjson` (exact input bytes) · `request-1.raw` ·
`request-1.body` · `request-2.raw` · `request-2.body` · `capture-report.json`.
The report carries `inputSha256` (original transcript) and an independent
`framingSha256` over the canonical framed records. **The producer `sdk-capture-end`
has no manifest hash and is not invented**; only the fields it actually carries
are cross-checked.

### F15 (test/provenance part) — confined fixtures + honest teardown

Fixtures use ONLY the absolute assigned scratch
`<worktree>/.task-inputs/testscratch/w02-13-tests-<pid>-<n>/`; every path is
resolved-confinement checked before creation; the single new run directory is
removed in a `finally`/`after` hook with a post-cleanup existence verification.
No `os.tmpdir`/default tempfile. `.task-inputs` and the owner query are never
deleted.

## Historical first Hermes-session tests (counts, failures + repair history)

Command: `node --test scripts/test_reconstruct_sdk_capture.mjs`
First-session final result: **39 tests, 39 pass, 0 fail, exit 0** (Node v24.19.0,
`ℹ duration_ms ≈ 152`). `node --check` passes for both owned modules.

Coverage: positive identity + gzip + multi-chunk fixtures with real `max_tokens`
and redacted auth headers; optional `caller`/`toolset_name` metadata; plural
`*_tokens` accounting accepted; F11 missing/extra/unknown/nonboolean-hashOnly/
malformed counters/spawn/result, nested camel/acronym credential keys, secret
string/header/preview leakage despite rebound hashes; F12 conflicting totals,
seq≥total, changed duplicate, missing/extra chunk, huge declared total (bounded
reasons), canonical-base64 padding/trailing junk, byte/decompression bounds and
encoding mismatch, mixed UUID / missing / truncated end, oversized record; F13
full bounded read, invalid UTF-8, direct/immediate-parent/ancestor symlink
(real junction where permitted, injected fake with disclosure otherwise), path
replace, append/truncate, path-vs-descriptor identity mismatch, output
ancestor/traversal/existing/exclusive-write/write-failure-cleanup, and
independent artifact re-hash vs original bytes.

### Preserved failure history (honest)

First executed run: **35 pass / 4 fail, exit 1.** Each failure, root cause and
repair:

1. `positive: multi-chunk …` — my fixture padded the synthetic user prompt,
   breaking the exact-prompt semantic check. Fixture defect (not decoder):
   fixed by sizing via an extra `system` field so the exact prompt is preserved.
2. `F12: non-canonical base64 padding …` — `.slice(0,-1)+'='` was a no-op when
   the body base64 already ended in `=`; fixed to append `=` (length not a
   multiple of 4).
3. `F13: path-vs-descriptor identity mismatch …` — an injected fake spread a
   `Stats` object, dropping prototype methods (`fstBefore.isFile is not a
   function`); fixed with a prototype-preserving stat clone.
4. `F13: traversal / outside destination …` — `path.join(dir,'..','escape')`
   normalised the `..` away, so the guard was never exercised; fixed to pass a
   literal `../` string.

After the fixes: 39/39 pass. A subsequent decoder tightening (a literal
`<truncated>` header value shorter than 266 chars must not be misread as a
truncated value) was applied and the suite re-run: **39/39 pass, exit 0**. No
failure is omitted or softened.

## Owner witness (implementation-2) and same-session resume repairs

**Resume authority/bounds.** Explicit owner-selected bounded continuation of the
SAME actual Hermes session `20261009_225228_53da1e` through the already-qualified
H00 resume path — not an automatic retry, new session, self-resume, acceptance
or review. Exact HEAD/base unchanged at
`6176ce11217213f1f3b30801349864106c85a21a`. Max 25 turns / 1200 seconds. Codex
exclusively snapshotted the exact pre-resume bytes before launch at root private
`docs/coordination/private-evidence/W02-13-implementation-2-inputs`
(manifest SHA256 `9ac3a1f7d8275cf91b26bb3b375a6b2d669f9f314418a7b411ae6f300612e56c`);
initial working hashes were decoder `fd580cfd…`, tests `16a549ba…`, full report
`d8569ea8…`. No Codex source edit occurred. The first session's index held the old
863-byte report skeleton while the full 14026-byte report was working-only; this
resume stages the final full report before commit.

**Parent owner witness (measured, not hypothetical).** Parent executed
`.task-inputs/W02-13-owner-witness-1/results.json`
(sha256 `e7dd9ef370c6ddd41e5670af3c992889d59b5aaa021a8f328bdc3501c3e22f62`) ONCE
against the exact decoder `fd580cfd…`; awsCalls 0 / nativeSdkCalls 0; the two
temporary owner-fixture files were absent after the run. A positive
API-faithful fixture was accepted, and FIVE negative checks FAILED
(reasonCount 0 unless noted):

1. duplicate body member `apiKey` (synthetic value) then `apiKey:null` — accepted;
2. duplicate header `value` (unredacted synthetic text) then `<redacted>` — accepted;
3. invalid UTF-8 inside the base64-decoded body — accepted;
4. `parseRecords` diagnostic contained a rejected input excerpt;
5. input hardlink with `nlink 2` — accepted.

These measured failures are retained here and are NOT erased by this resume.

**Repairs (only these narrow measured gaps; all prior checks preserved).**

- **A — strict bounded duplicate-JSON-key detection.** A full JSON member scanner
  (`scanJsonKeys`, depth bound 64) runs on EVERY NDJSON record AND every
  decompressed body BEFORE `JSON.parse`, at every nesting depth, decoding JSON
  string escapes/`\uXXXX` so escaped/colliding names compare by decoded value.
  Same names in distinct object scopes are allowed; escaped string text that
  merely resembles a key is allowed. No regex approximation.
- **B — fatal UTF-8 for the reconstructed/decoded body.** The decompressed request
  bytes are strict-`TextDecoder(fatal:true)` decoded for identity AND
  gzip/x-gzip/deflate before scanning; replacement decoding is rejected. Original
  raw/transcript bytes and recomputed hashes are unchanged.
- **C — constant diagnostics.** JSON-parse/decompression/body failures now return
  fixed reasons with no `error.message`, no input excerpt, no rejected value,
  sentinel, secret-like text, unknown field value or zlib error. Untrusted field
  values are no longer interpolated into reasons.
- **D — hardlink rejection.** `nlink !== 1` on the path-lstat AND fd-fstat BOTH
  before and after the read is rejected. `sameIdentity` now compares dev/ino/size
  and the hardlink gates are explicit (`nlink===1` in four observations); symlink/
  junction/immediate-parent/ancestor, exclusive-destination and race checks are
  retained, with no weaker comparisons or inventory normalisation.

**New regressions (same owned test file).** 11 added tests: duplicate body
credential overwritten by null; duplicate header value overwritten by `<redacted>`
(with no-leak assertion); duplicate NDJSON envelope field; scanner
unicode/escaped/nested collisions plus positive distinct-scopes and escaped text;
invalid UTF-8 in identity AND gzip-compressed bodies with all hashes/chunks
rebound; malformed NDJSON/body/decompress diagnostics asserting NO sentinel leak
(in-memory and offline CLI); a real confined hardlink (`nlink 2`) rejection plus
injected before/after path/fd hardlink races; and a single-link positive read.

**Result.** `node --test scripts/test_reconstruct_sdk_capture.mjs` →
**50 tests, 50 pass, 0 fail, exit 0** (Node v24.19.0). `node --check` passes for
both modules. Existing 39 tests were kept meaningful (no assertions relaxed, no
old failures removed); the hardlink-positive/link case ran on a real NTFS link
on this host. The first-session failure history (35 pass/4 fail → 39/39 → 39/39
and the four fixture repairs) above is preserved unchanged.

## Windows / API limits (disclosed)

- `fs.constants.O_NOFOLLOW` is `undefined` on this Windows host (treated as 0);
  final-file symlink protection relies on `lstat`, not the open flag.
- Windows file-symlink creation is denied without privilege, so the
  direct-file-symlink and one output-ancestor case ran via injected, clearly
  logged `fs` fakes (the immediate-parent/ancestor junction test used a real
  junction). Reported honestly; the fake-based cases are not real-OS proof.
- Identity checks reduce but do not eliminate TOCTOU: a residual window remains
  between the final `lstat` identity check and any later external reader. This is
  documented in the report `limits` field and is not claimed as a guarantee.

## Provenance retained (not rewritten)

- W02-11 actual session `20261009_222232_edfab9` produced `28b`, reached the max
  40 iterations (a model estimate of 26 was incorrect). Python had an initial
  dataclass import failure then 1 error + 1 failure before a reported 41 pass;
  Node reported 18 pass on the first observed run — **not independent
  acceptance**. The old Python/Node fixtures used OS temp with no observed
  teardown; exact absolute generated names and cleanup are unknown, and **this
  repair cannot claim to clean those unknown old paths.**
- W02-11 Hermes deleted the owner query with the entire ignored `.task-inputs`;
  orchestration reconstructed an exact private `query-used.md` matching the
  prelaunch SHA, deletion openly recorded. A W02-13 private exact-query copy
  exists before launch; the assigned-WT query is preserved.
- The worktree provides no OS sandbox. Prior reports/evidence are not rewritten.

## Findings / limit disclosures

- Producer exports a bounded SDK result **SUMMARY** only — no result body. This
  decoder cannot independently re-hash or re-verify the absent result body or
  the producer's pre-summary `MERI_WIRE_DONE` check; `resultSha256` is treated as
  a summary value, never as fabricated full-result proof.
- Producer `sdk-capture-end` carries no manifest hash; none is invented.
- F10 log collector/controller remains OUT OF SCOPE; a standalone decoder cannot
  establish complete CloudWatch collection.

## Gate status / handoff

No native SDK, provider, socket/server, AWS/cloud, source, browser, Office,
controller, launcher or background process was run. No acceptance, deployment,
gate change or self-review is claimed. All live/scan/enforcement/transport/
runtime/log/G1 gates remain OPEN. A **separate actual independent Hermes review**
and **Codex replay** are still required before any acceptance.


## Codex owner completion after closed Hermes candidate (R1-R7)

Codex authored this section and the completion after explicit owner transfer.
This is not independent review or acceptance. Completion starts from clean
`3cde028cf31223f2f050d7ac35e13061ee37c683`, which remains preserved as its direct
parent, and owns only the same decoder, test and report paths.

### Actual closed-session history and forbidden post-commit check

Both actual invocations used Hermes session `20261009_225228_53da1e`:

- Implementation-1 ran 2026-10-10 02:52:25.907659Z to 03:01:14.081469Z,
  max 40 turns / 1800 seconds. It reached the 40-iteration cap, returned no
  commit, and closed its process/tree/readers with cleanup confirmed. The
  35/4 -> 39/39 -> 39/39 author check history above remains unchanged. Its
  staged report was an 863-byte skeleton while the 14026-byte full report was
  working-only; explicit same-session continuation later committed it.
- Implementation-2 was expressly owner selected after five measured negative
  failures, max 25 turns / 1200 seconds. It ran 03:09:32.755562Z to
  03:15:21.936038Z and returned `3cde028`, with process/tree/readers closed and
  cleanup confirmed. No authoritative exact turn count is exposed; no cap
  warning was observed. The model estimate is not turn-count evidence.
- The 50/50 suite was repeated for retained output and after commit by internal
  verification nudges. A later nudge also ran **`npm run check` outside the
  allocated checks**. It failed, exit 1: two test imports could not find `ajv`
  from `packages/contracts/validate.mjs`. No install or package edit followed.
  The original committed report predates that failure. It remains a forbidden
  post-commit check and a failed broader check; no environment explanation
  converts it into a pass. Codex completion did not repeat that command.

Original `3cde028` SHA256 values remain retrievable: decoder
`d3c0757bf40dc7efac329fd5fae70bf1cb87e5fe53a590848848e1f474880650`, tests
`b8f645c14a2d2ec84113abc3848a283436cfc30b7f893c00e79987cfc6b7ee63`, report
`41a199475703df2198c3e2b7c15b716e81d57ed32dc591f9d4d29615071d7cb1`.

### Measured reason for transfer and narrow repairs

The prior Codex support audit recorded R1-R7. Parent separately reproduced six
failures against `3cde028` in owner witness-3 results (SHA256
`3262947ab3e72349c3cced2fb299600c62e1a9b5913a4e5f1b882502cd66fe96`): rawBuffer
mismatch accepted; null entry and structured index threw TypeError; BOM body
and NBSP/VT framing accepted; mixed-UUID failures returned 100 reasons. Other
source findings were reflected unknown CLI arguments, test checkout-basename/
Windows-separator hardcoding, and an unclosed test-only inspection fd.

- **R1:** Validation snapshots one bounded Buffer, fatal-decodes the same bytes,
  requires exact supplied text/byte correspondence, then parses and exports the
  snapshot. Explicit rawBuffer must be a Buffer within 32 MiB. Invalid UTF-8,
  non-round-tripping surrogate text and mismatched bytes reject before parse
  or output. Changed validated transcript bytes refuse output before any
  destination side effects.
- **R2:** Exact entry shapes and integer indices are checked before sorting or
  dereference. Entries failing full metadata validation cannot enter arithmetic
  or chunk setup. Null/array/primitive entries and structured indices/lengths
  reject without coercion, TypeError or output.
- **R3:** Fatal UTF-8 uses `ignoreBOM:true` to retain BOM for strict JSON rejection
  at transcript and body boundaries. Framing removes only JSON whitespace:
  space, tab, CR and LF. Encoding uses the frozen producer's case-sensitive
  identity/gzip/x-gzip/deflate whitelist; all four positives remain.
- **R4/R5:** Unknown-argument diagnostics are constant. One validation reason
  accumulator enforces the global 64-reason cap.
- **R6/R7:** Scratch derives from the current checkout without fixed basename or
  separator. Before recursive cleanup, tests require resolved containment and
  a non-symlink run root; only the exclusively created run directory is removed.
  The append/truncate fixture closes its inspection fd in `finally`.

The frozen producer, semantic fields, duplicate-key/confidentiality checks,
canonical base64/chunk membership, byte export, nlink/identity/Windows timestamp
checks, byte/decompression limits and other paths are unchanged. Producer
modules were never imported or executed.

### Codex checks and newly observed failure history

Eleven tests were added; all previous fifty remain. They cover rawBuffer type,
oversize, mismatch, invalid UTF-8 and mutation; malformed metadata; BOM transcript
and bodies in all four encodings; JSON whitespace; encoding case; no-reflection
CLI diagnostics; 64 reasons; portable containment and no-output behavior. The
previous five owner failures rerun within the retained suite. Six newer owner
failures have fresh focused compositions as well.

1. First revised suite: **61 / 61 pass / 0 fail / exit 0**, duration 386.3493 ms;
   both owned modules passed `node --check`. Output SHA256
   `ec9850a9261b32aae43c98dc358524f67ca678e3020e1864a912d79a2e327098`.
2. A new private 27-case replay matched expected validation dispositions and the
   retained TOCTOU limit. A separate new structured-`rawLength` composition then
   **failed with TypeError**: arithmetic continued after metadata validation
   failed. Failure witness SHA256
   `b758b2b4974881c3884e1c858e7748ae7442fa89d663f974315927b00a72c482`;
   first replay results
   `3574a7a9ebca8cdff8355ec865f69f51543fd02d4ab9c1370f4ec74b95b55ccc`.
   This new measured failure justified the early continuation and added malformed
   length cases, followed by one revised suite and focused replay.
3. Final revised suite: **61 / 61 pass / 0 fail / exit 0**, duration 214.5359 ms;
   both `node --check` checks passed. Output SHA256
   `c5c7f4e50ed41d3d7bc58e39ad7c5d8a07c7e2edecc72806aaabb7b02da9490e`.
4. Final source-bound replay: **27 cases matched expected dispositions plus the
   new structured-length witness rejected without throwing**, exit 0. Twelve
   scanner cases cover Unicode/astral/slash-equivalent duplicate keys, nested
   arrays, distinct scopes, trailing JSON/commas and valid escaped strings. Four
   compression positives pass; real gzip expansion above 8 MiB and raw request
   above 4 MiB reject. The six earlier owner failures reject/no-reflect/no-export
   within 64 reasons. Temporary fixture/output paths are confirmed absent.

New private evidence is under this WT `.task-inputs/testscratch/`:
`w02-13-codex-completion-tests-{1,2}.txt` and
`w02-13-codex-completion-audit-{1,2}/`. Final replay script SHA256
`10e93e0cf9dd1b46b5cd96da802c4b2c93c3476dfe073716b49d1aa8b58c8c4c` pins the
final decoder hash in the scope table. Final results SHA256
`faa619a1c8596cb36fb737b8396b42e9e95697e87e822a735808073167cf34a4`; additional
witness `287f3824484b6099552ab710ab081146aaaaa82975847b43d129f910f97186a0`.
The sole later test-file change removed an extra EOF blank line; no executable
statement changed after the final suite. These are Codex author checks.

The 27th audit composition injects an ancestor change after initial validation:
zero post-open ancestor checks and acceptance of unchanged file bytes remain
observed. This is the disclosed trusted-local TOCTOU limit, not hostile-root
enforcement proof. Windows file-symlink tests still use disclosed fakes when
privilege is denied; junction/hardlink tests are real where noted. SDK result
SUMMARY-only limits, absent producer end hash, F10 collection/controller and all
live/scan/enforcement/transport/runtime/log/G1 gates remain OPEN. No Codex
completion command invoked native/provider/cloud execution, whole-repository
checks or an actual reviewer. A separately allocated actual Hermes review and
parent acceptance remain required. This completion is a review candidate only.
