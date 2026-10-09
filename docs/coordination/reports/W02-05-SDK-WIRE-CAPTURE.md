# W02-05 SDK wire-capture preparation — implementation report

Status: **PREPARATION COMPLETE — runtime proof NOT RUN.** Bounded authoring
session (owner-authorized repair of session `20261009_182329_21b4bc`). A
separate actual review is required after this candidate. This does NOT establish
Bedrock/proxy translation, auth, budget, cancel, recovery or G1 acceptance.

- Base (pinned): `27d7f2710639529e3f2f0f8db25fc7e9aba0777f`
- Branch: `hermes/w02-sdk-capture`
- Worktree: `C:\dev\main\meri-greenfield-worktrees\w02-sdk-capture`
- Contract/schema: **UNCHANGED** — no shard, contract, lockfile, Dockerfile,
  package, ordinary `sdk-options.mjs`, infra, task-brief or other report edits.
- Native SDK/query/socket/server/browser/Office/cloud/provider/source/credential
  execution by this session: **NONE**.

## Owned paths (exactly four) and content hashes

| Path | sha256 |
| --- | --- |
| `apps/worker/qualification/probes/sdk-capture-options.mjs` | `964f4f1958dd0707198fcd21611018b9a9337e90e5f434ed24ce47beb3986b0e` (unchanged this session) |
| `apps/worker/qualification/probes/sdk-capture.mjs` | `a4fc4bad7c67681c901937ca0560d7eeacc616fc6c77bf7ead9c07d55263ce80` |
| `apps/worker/qualification/probes/sdk-capture.test.mjs` | `593acab1fb401fd27c78456a3f8e7ce2e330644298be8566f5f5394d66e8fe67` |
| `docs/coordination/reports/W02-05-SDK-WIRE-CAPTURE.md` | this file |

## Source / API evidence (installed packages read)

- `@anthropic-ai/claude-agent-sdk` **0.3.295**: `Options`, `ResolvedSettings`
  (`effective`/`provenance`/`sources` with source rows `source`/`settings`/`path`),
  `Settings` (`autoMemoryEnabled`, `autoDreamEnabled`, `claudeMdExcludes`,
  `disableAutoMode`, `disableAgentView`, `disableRemoteControl`,
  `disableWorkflows`, `remoteControlAtStartup`, `disableAllHooks`,
  `includeGitInstructions`); public exports `query`, `createSdkMcpServer`,
  `tool`, `resolveSettings`.
- Recognized env flags from installed `sdk.mjs` (29 total) as listed previously.
- `@anthropic-ai/sdk` **0.133.0** BETA Messages declarations (`BetaMessage`,
  `BetaUsage`, `BetaMessageDeltaUsage`, `BetaTextBlock`, `BetaToolUseBlock`,
  `BetaRawMessage*Event`, `BetaRawContentBlock*Event`). SSE builders carry the
  exact field sets; tests assert nested values, not declaration-name regex.

## Repairs implemented against the adversarial findings

1. **Settings resolution STOPS before construction.** Any resolution
   error/timeout/malformed `ResolvedSettings` returns before any tool/server/
   query/spawn. `validateResolvedSettings` requires the exact public shape
   (`effective`/`provenance`/`sources` with `source`/`settings` rows), so `{}`
   is rejected; managed tiers are rejected. The absolute deadline is fixed
   before the first await and also bounds `startServer`; a startup `AbortSignal`
   is provided before partial creation so a hanging startup cannot leak. Error
   reasons export only an error TYPE plus a fixed string — never opaque text.
   Deadline injection must be finite, positive and <= 60000.
2. **Strict wire sequence + roles.** `tool_use` MUST be in an assistant message
   and `tool_result` in a user message, in order after the exact synthetic
   prompt. Request 1 requires exactly one user text block equal to the synthetic
   prompt (no unrelated/additional user prompt) and exactly the wire echo tool
   advertised (reject missing/extra/duplicate). Foreign ids, extra input keys,
   `is_error:true` and mismatched result content are rejected. Alias/provider
   are never changed; unsupported features fail closed.
3. **Query cleanup + one spawn.** Cleanup uses the public AsyncGenerator
   `return()`; its rejection/timeout FAILS the capture (no invented `close()`
   requirement). Child cleanup requires an ACTUAL exit event / non-null
   `exitCode` / non-null `signalCode` within a bounded grace after kill/abort; a
   kill request or an error event alone is NOT termination. `buildSpawnHook`
   refuses a second native spawn. ALL argv is counted and hashed (`argvCount`,
   `argvBytes`, `argvHash`); only safe flag NAMES are recorded — no
   slice-to-40 and no opaque/Bearer argv value leaks.
4. **Sensitive body → hash-only failure.** `hasSensitiveBody` recursively
   detects credential-named keys/values plus standard secret patterns; a
   hash-only request forces `report.ok=false`, and the manifest/end/exit all
   reflect failure with no raw export. The exported result is a bounded typed
   shape (subtype/is_error/stop_reason/bounded num_turns, UUID-validated
   `session_id`, `resultLength`/`resultSha256`); a 1 MiB session id is rejected
   and raw messages are never exported. Every protocol record is <= 12 KiB and
   carries a `captureId` binding manifest to chunks and end; records are never
   truncated to claim success.
5. **Bounded stdout + stderr.** `writeOnce`/`writeLines` bound every write with
   a callback + drain/error/close path and a timeout, and never force
   `process.exit`. `MAX_STDERR_BYTES` is enforced: preview is bounded before
   concatenation (even a single huge chunk), the hash covers the bounded prefix,
   remaining stderr is drained without unbounded storage, and overflow is
   reported (`stderrTruncated`). The HTTP server aborts IMMEDIATELY at the body
   cap (413 + socket destroy) instead of consuming to end.
6. **Workspace preparation.** Before native spawn, an injected `prepareWorkspace`
   runs (bounded): the real implementation creates exclusive empty dirs with
   no-follow ancestor checks (symlink/non-directory rejected; non-empty dir
   rejected). It does NOT claim the Dockerfile workspace dirs are inevitably
   missing. The child env remains a replacement built from constants (the
   pinned SDK uses `options.env` as the subprocess env); SDK-added public env
   markers are recorded honestly via `spawn.envNames`.

## Checks actually run (this session, exit-0 evidence)

- `node --test apps/worker/qualification/probes/sdk-capture.test.mjs` → **52 tests, 52 pass, 0 fail** (was 44).
- `npm run check` (root) → **15 pass, 0 fail**.
- `npm test` in `apps/worker/qualification` → **81 checks pass, 0 fail**.
- `git diff --check` → clean.
- `git status --short` → only the probe + report edits (three files this session).

## Process / cleanup state

Offline only: no socket opened, no native process spawned, no loopback
connection. The real host assembles only when `main` runs on Linux
(`platform !== 'linux'` returns 2 without a host). All host effects in tests are
injected fakes, including uncooperative iterator/close/return/kill that must not
hang or falsely pass. Native runtime proof: **NOT RUN**.

## Limitations / disclosures

- Model alias stays `meri-sonnet-qualification`; the synthetic key stays a
  header/env fixture, never in a body.
- SDK env flags do not prove every opaque retry path honors them; a real capture
  can prove only exactly-two observed requests and no OBSERVED retry.
- The loopback server + closed network do not prove no attempted non-loopback
  socket; allowed AWS bootstrap/log endpoints remain.
- No flat public `remoteControl` option exists in the published types; only
  `remoteControlAtStartup` is set (documented) plus `disableRemoteControl`.
- This qualifies wire evidence only — not Bedrock translation/auth/budget/cancel/
  recovery or G1. Owner deploys only after separate review of this candidate.
