# W02-05 SDK wire-capture preparation — implementation report

Status: **PREPARATION COMPLETE — runtime proof NOT RUN.** Bounded authoring
session (owner-authorized repair of session `20261009_182329_21b4bc`) that
flips the independent repair-3 audit from 6/14 to 14/14 without weakening any
privacy or deadline control. A separate actual Hermes review and independent
Codex acceptance precede any build/native qualification. This does NOT establish
Bedrock/proxy translation, auth, budget, cancel, recovery or G1 acceptance.

- Base (pinned): `fdf2035600a35a10974813aac787a0e091b51e74`
- Branch: `hermes/w02-sdk-capture`
- Worktree: `C:\dev\main\meri-greenfield-worktrees\w02-sdk-capture`
- Contract/schema: **UNCHANGED** — no shard, contract, lockfile, Dockerfile,
  package, ordinary `sdk-options.mjs`, infra, task-brief or other report edits.
- Native SDK/query/resolveSettings/child/socket/server/loopback/Office/browser/
  cloud/AWS/model/provider/credential/private-source/network execution by this
  session: **NONE**. All host effects are injected pure fakes.

## Owned paths (exactly four) and content hashes

| Path | sha256 |
| --- | --- |
| `apps/worker/qualification/probes/sdk-capture-options.mjs` | `964f4f1958dd0707198fcd21611018b9a9337e90e5f434ed24ce47beb3986b0e` (unchanged) |
| `apps/worker/qualification/probes/sdk-capture.mjs` | `fc912e242924f0b58ce293292ad4d181ca500f77de5dfd35185e6f532f0f9776` |
| `apps/worker/qualification/probes/sdk-capture.test.mjs` | `93eb4e948700910185aa41b698a66eb3821ff607b38b66f28ce2dce4b80a78b5` |
| `docs/coordination/reports/W02-05-SDK-WIRE-CAPTURE.md` | this file |

## Independent audit (reproduced, then flipped)

- Original audit `.task-inputs/codex-sdk-repair3-audit.mjs` against base
  `fdf2035`: **6 pass / 8 fail → REJECT** (reproduced before editing).
- Same audit re-run against this candidate (source sha
  `fc912e242924f0b58ce293292ad4d181ca500f77de5dfd35185e6f532f0f9776`, scratch
  copy in ignored `.task-inputs/_reaudit.mjs`): **14 pass / 0 fail →
  NO_REPRODUCED_BLOCKER**. Effects: fake host/process/stdio only.

## Repairs (each genuine failure flipped)

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

## Checks actually run (this session, exit-0 evidence)

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
