# W02-05 SDK wire-capture preparation — implementation report

Status: **PREPARATION COMPLETE — runtime proof NOT RUN.** Latest changes are an
explicit **Codex owner correction**, based on `3b8eabf1e7f29a2a48f083c4d947c3cadff82e1e`,
of separate actual Hermes review-5 findings F1–F4. The earlier Hermes repair-4
session and its 61-test results are retained below as historical evidence.
A new separate actual Hermes review of this exact owner delta and independent
Codex acceptance precede any build/native qualification. This does NOT establish
Bedrock/proxy translation, auth, budget, cancel, recovery or G1 acceptance.

- Latest owner-correction base (pinned): `3b8eabf1e7f29a2a48f083c4d947c3cadff82e1e`
- Historical repair-4 base: `fdf2035600a35a10974813aac787a0e091b51e74`
- Branch: `hermes/w02-sdk-capture`
- Worktree: `C:\dev\main\meri-greenfield-worktrees\w02-sdk-capture`
- Contract/schema: **UNCHANGED** — no shard, contract, lockfile, Dockerfile,
  package, ordinary `sdk-options.mjs`, infra, task-brief or other report edits.
- Native SDK/query/resolveSettings/child/socket/server/loopback/Office/browser/
  cloud/AWS/model/provider/credential/private-source/network execution by this
  session: **NONE**. All host effects are injected pure fakes.

## Current source content hashes / latest owner scope

The latest Codex correction owns only capture source, capture tests and this
report. The options file is listed for provenance and is byte-unchanged.

| Path | sha256 |
| --- | --- |
| `apps/worker/qualification/probes/sdk-capture-options.mjs` | `964f4f1958dd0707198fcd21611018b9a9337e90e5f434ed24ce47beb3986b0e` (unchanged) |
| `apps/worker/qualification/probes/sdk-capture.mjs` | `4b71228ed0ce49f4bc39c2abcc497d7b76fea30ffd115ca796a13dff7edd6840` |
| `apps/worker/qualification/probes/sdk-capture.test.mjs` | `38a3018af9702affe042bb8a2bf8f9078c5353446c2599f16d933f163c751c72` |
| `docs/coordination/reports/W02-05-SDK-WIRE-CAPTURE.md` | this file |

## 2026-10-09 Codex owner correction following separate Hermes review 5

Separate reviewer report commit `8689125132f571bf7190d11d5c748ab6f4dc5800`
reviewed candidate `3b8eabf`; its F1–F4 are addressed here by Codex, not Hermes.
The prior `3b8eabf` owner correction added four tests to historical Hermes's 61,
giving 65. This correction adds eight more, giving **73**.

- **F1 — exact hashes and attribution:** current source/test hashes above now
  match the final LF-normalized bytes. Historical counts and hashes below refer
  only to their named earlier candidate. No Hermes authorship is claimed for
  either Codex correction.
- **F2 — stream lifetime and CLI failure:** one WeakMap guard per stream retains
  one error observer and one close observer until actual close. Per-write
  subscribers and their deadline timers are removed immediately on settlement;
  there are no per-record grace timers. A sticky failure rejects future writes,
  and `writeLines` checks for an error immediately after a successful callback.
  An error on actual `process.stdout` sets nonzero CLI status even after an
  otherwise successful main; the direct footer preserves that status if the
  error races main resolution. Closing removes the shared observers. Pure
  Writable tests cover errors beyond the former 50ms grace after timeout and
  success, 1,000 writes with constant listeners and zero settled subscribers,
  callback/error ordering, and exact source-extracted guard/footer with fake
  process state. No real stdout error or native process is induced.
- **F3 — fixed assistant content:** across assistant messages in request two,
  the only content block may be the one emitted `tool_use`. Its existing id,
  name/input, ordering and result checks stay enforced. Extra text, thinking,
  image, unknown/null blocks or an extra assistant text message fail. Optional
  real tool-use metadata (`caller`, `toolset_name`) remains accepted. The fixed
  SSE emits exactly one tool-use block; this does not invent a production-wide
  Messages content restriction.
- **F4 — semantic credential names:** camelCase and acronym word boundaries
  are split before applying the existing credential-segment set. `clientSecret`,
  `accessToken`, `awsAccessKeyId` and `HTTPAuthorization` are detected, while
  `max_tokens`, other plural `*_tokens` accounting fields and their camelCase
  equivalents remain valid. Full pinned Messages positive capture still passes.

Latest checks (owner-run, pure fakes only): owned **73/73**, existing worker
**81/81**, root **15/15**, and the previous 14-case adversarial audit re-pinned
only to the current source SHA **14/14**. Whitespace check is clean. These are
regressions run by the current author, not the required separate review of this
new delta. Runtime proof and all deployment gates remain open.

## Historical Hermes repair-4 audit (reproduced, then flipped)

- Original audit `.task-inputs/codex-sdk-repair3-audit.mjs` against base
  `fdf2035`: **6 pass / 8 fail → REJECT** (reproduced before editing).
- Same audit re-run against this candidate (source sha
  `fc912e242924f0b58ce293292ad4d181ca500f77de5dfd35185e6f532f0f9776`, scratch
  copy in ignored `.task-inputs/_reaudit.mjs`): **14 pass / 0 fail →
  NO_REPRODUCED_BLOCKER**. Effects: fake host/process/stdio only.

## Historical Hermes repair-4 changes (superseded where owner corrections say so)

1. **Credential detection is now semantic.** A key is credential-named only
   when one of its non-alphanumeric-separated segments is a credential word, so
   the required Anthropic Messages accounting fields (`max_tokens`,
   `input_tokens`, `output_tokens`, `cache_creation_input_tokens`,
   `cache_read_input_tokens`) are NOT treated as secrets. The full pinned
   Messages positive fixture (model/max_tokens/stream/system/thinking/metadata/
   tools/messages) now captures two normal requests and reconstructs chunks
   (hashOnly `[false,false]`, manifest ok). Opaque `api_key`/`access_token`/
   `authorization` still force hash-only failure with no raw export. Model alias
   unchanged.
2. **No opaque name/id text.** `errorType` maps any unknown error name (e.g.
   `sk-ant-…`) to `Error` via a fixed allowlist; the foreign tool_use id reason
   is a fixed string with no value; classifyRequest reasons no longer echo
   method/path/peer; result subtype/stop_reason reasons are fixed. Every
   manifested/non-body/error field was scanned for the sentinel and does not
   leak.
3. **argv flags export names only.** `sanitizeArgvFlag` splits at the first `=`
   (the pinned SDK argv builder emits `--flag=value`), keeps a strict short
   flag-name form, and hashes anything else — so `--api-key=…`/`--settings={…}`
   leak nothing. Full argv count/bytes/hash still cover the ACTUAL argv (no
   slice-to-40).
4. **Final exit derives from emitted protocol + write outcome.** `main` marks
   failure when any emitted record has `ok:false` or the write fails — an
   in-memory `report.ok` alone can no longer yield exit 0. The shared `main` body
   is exercised by the audit through a pure injected seam (no SDK/native effect).
5. **Child exit ≠ stdio drained.** The real spawner exposes an internal
   `record.stdioDone` completion contract (stderr `end` or child `close`) that
   the orchestrator awaits (bounded) BEFORE a PASS and only then snapshots the
   final stderr accounting. A late/absent EOF fails; the public AsyncGenerator
   `return()` is still used (no invented SDK method).
6. **Write-callback error stays handled.** `writeOnce` keeps its error/close
   observers for a bounded grace after a callback error so the late Node stream
   `'error'` is absorbed (real `Writable` test: no uncaught error, no leak).
7. **Bounded one-shot output deadline.** `writeLines` uses ONE fixed absolute
   deadline, rejects a non-finite deadline, and checks the clock before each
   write and after every callback; an already-expired deadline writes nothing
   and fails. The fatal-output fallback is itself bounded and non-raw; no forced
   `process.exit`.

## Historical Hermes repair-4 checks (61-test candidate only)

- `node --test apps/worker/qualification/probes/sdk-capture.test.mjs` → **61 tests, 61 pass, 0 fail** (was 52).
- Independent repair-3 audit (scratch re-pin) → **14 pass, 0 fail**.
- `npm run check` (root) → **15 pass, 0 fail**.
- `npm test` in `apps/worker/qualification` → **81 checks pass, 0 fail**.
- `git diff --check` → clean.

## Process / cleanup state

Offline only: no socket, no native process, no loopback connection. The real
host assembles only when `main` runs on Linux. Native runtime proof: **NOT RUN**.

## Limitations / disclosures

- Alias stays `meri-sonnet-qualification`; `max_tokens` required in real bodies
  is never omitted; the synthetic key stays a header/env fixture.
- Green fixtures do NOT prove real native wire behaviour; only a real
  credential-free owner-run capture can, and only for exactly-two observed
  requests / no OBSERVED retry.
- Loopback + closed network do not prove no attempted non-loopback socket;
  allowed AWS bootstrap/log endpoints remain.
- Wire evidence only — not Bedrock translation/auth/budget/cancel/recovery or
  G1. Separate actual Hermes review and independent Codex acceptance precede
  build/native qualification. No build/run/G1/Bedrock-budget/cutover authority.
