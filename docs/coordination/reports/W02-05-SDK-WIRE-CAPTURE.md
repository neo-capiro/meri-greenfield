# W02-05 SDK wire-capture preparation — implementation report

Status: **PREPARATION COMPLETE — runtime proof NOT RUN.** This report covers one
bounded authoring session (owner-authorized repair of session
`20261009_182329_21b4bc`). It prepares a later, owner-run, credential-free
native capture. It does NOT establish Bedrock/proxy translation, auth, budget,
cancel, recovery or G1 acceptance.

- Base (pinned): `a41e83b085c154b1bd1b4847aa4543b88244880e`
- Branch: `hermes/w02-sdk-capture`
- Worktree: `C:\dev\main\meri-greenfield-worktrees\w02-sdk-capture`
- Contract/schema: **UNCHANGED** (no shard, contract, lockfile, Dockerfile,
  package, ordinary `sdk-options.mjs`, infra or other report edits).
- Native SDK/query/server/socket/Office/browser/cloud/provider/source
  execution by this session: **NONE**.

## Owned paths (exactly four) and content hashes

| Path | sha256 |
| --- | --- |
| `apps/worker/qualification/probes/sdk-capture-options.mjs` | `964f4f1958dd0707198fcd21611018b9a9337e90e5f434ed24ce47beb3986b0e` |
| `apps/worker/qualification/probes/sdk-capture.mjs` | `09822b8dbabd8fd37b393b502231ee0d0dc8dcb9e26557100bcdb48ffe25566c` |
| `apps/worker/qualification/probes/sdk-capture.test.mjs` | `04b4969031928272219083d9e929e01c7e82234648906eb3bcf26ef5546ed8fa` |
| `docs/coordination/reports/W02-05-SDK-WIRE-CAPTURE.md` | this file |

## Source / API evidence (installed packages read this session)

- `@anthropic-ai/claude-agent-sdk` **0.3.295** (`sdk.d.ts`, `sdk.mjs`):
  every capture option name is declared in the `Options` type; `createSdkMcpServer`,
  `tool`, `query`, `resolveSettings` are public exports; `Settings` declares
  `autoMemoryEnabled`, `autoDreamEnabled`, `claudeMdExcludes`, `disableAutoMode`,
  `disableAgentView`, `disableRemoteControl`, `disableWorkflows`,
  `remoteControlAtStartup`, `disableAllHooks`, `includeGitInstructions`.
- Recognized environment flags (from installed `sdk.mjs`): `CLAUDE_CODE_MAX_OUTPUT_TOKENS`,
  `CLAUDE_CODE_MAX_RETRIES`, `CLAUDE_CODE_NONSTREAMING_TIMEOUT_RETRIES`,
  `CLAUDE_CODE_DISABLE_NONSTREAMING_FALLBACK`, `CLAUDE_CODE_NO_MODEL_FALLBACK`,
  `CLAUDE_CODE_DISABLE_MODEL_ACCESS_FALLBACK`, `CLAUDE_CODE_DISABLE_THINKING`,
  `CLAUDE_CODE_DISABLE_ADAPTIVE_THINKING`, `DISABLE_PROMPT_CACHING`,
  `DISABLE_INTERLEAVED_THINKING`, `CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS`,
  `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC`, `DISABLE_TELEMETRY`,
  `CLAUDE_CODE_ENABLE_TELEMETRY`, `DISABLE_ERROR_REPORTING`, `DISABLE_BUG_COMMAND`,
  `DISABLE_FEEDBACK_COMMAND`, `DISABLE_GROWTHBOOK`, `DISABLE_AUTOUPDATER`,
  `DISABLE_UPDATES`, `DO_NOT_TRACK`, `CLAUDE_CODE_DISABLE_BACKGROUND_TASKS`,
  `CLAUDE_CODE_DISABLE_MCP_TASK_BACKGROUND`,
  `CLAUDE_CODE_DISABLE_OFFICIAL_MARKETPLACE_AUTOINSTALL`,
  `CLAUDE_CODE_DISABLE_AUTO_MEMORY`, `CLAUDE_CODE_DISABLE_AGENT_VIEW`,
  `CLAUDE_CODE_DISABLE_WORKFLOWS`, `CLAUDE_CODE_DISABLE_GIT_INSTRUCTIONS`,
  `CLAUDE_CODE_DISABLE_FAST_MODE`.
- `@anthropic-ai/sdk` **0.133.0** BETA Messages declarations
  (`resources/beta/messages/messages.d.ts`): `BetaMessage` (container,
  context_management, diagnostics, stop_details, stop_reason/stop_sequence
  nullable), `BetaUsage` (cache_creation, inference_geo, output_tokens_details,
  server_tool_use, service_tier, speed, iterations, fallback_credit, …),
  `BetaMessageDeltaUsage`, `BetaTextBlock` (citations nullable), `BetaToolUseBlock`
  (caller), `BetaRawMessageStart/Delta/StopEvent`,
  `BetaRawContentBlockStart/Delta/StopEvent`. SSE builders carry these exact
  field sets; tests assert nested values, not just declaration names.

## Repairs implemented against the adversarial findings

1. **Preflight before construction.** `runCapture` performs a pure parent-env
   scan first and returns via `emptyReport` (no tool/server/query/spawn, and no
   `resolveSettings` call) on failure. `AWS_REGION`, `AWS_DEFAULT_REGION`,
   `AWS_EXECUTION_ENV`, `ECS_CONTAINER_METADATA_URI[_V4]` are permitted markers
   but are NEVER copied into the replacement child env (which is built from
   constants). Actual credentials, credential URIs/tokens/files/profiles,
   provider selectors and endpoint/helper/proxy injections are rejected by NAME
   only — values are never read or printed.
2. **Absolute deadline before awaits.** The deadline is fixed at entry;
   `resolveSettings`, each stream `next()`, `stream.return()` and `server.close()`
   are bounded by `boundedWait`. Violations abort the query/input immediately via
   the `onAbort` callback wired into the loopback server. Owned sockets are
   tracked and destroyed on close; the `Query` iterator is explicitly closed.
   Child cleanup requires an ACTUAL exit event / non-null `exitCode` / non-null
   `signalCode`; a kill request or an error event alone is NOT termination, and
   uncertainty fails. Injected fakes prove the iterator/close/kill-never-complete
   paths no longer hang or falsely pass.
3. **Custom spawn conformance.** The real spawner forwards the SDK `AbortSignal`,
   pipes `stdin`/`stdout` for the SDK exclusively, and continuously drains
   `stderr` into bounded scrubbed evidence (`stderrBytes`, `stderrSha256`,
   scrubbed preview) — opaque stderr/exceptions are never exposed raw.
4. **Strict two-request validation.** Request 2 must be prompt → assistant
   `tool_use` → user successful `tool_result`, exactly one tool/name/arguments,
   using the EMITTED tool-use id. Foreign ids, wrong roles/order, extra input
   keys, `is_error:true`, unrelated prompts, extra tools, and an out-of-set
   advertised tool set are rejected. Peer is the exact loopback address and
   `Host` must equal the bound `127.0.0.1:<port>`; oversized and incomplete
   requests abort promptly.
5. **Complete SSE fixtures** using the locked BETA declarations (see evidence),
   including nullable Message/container/diagnostics/stop_details/
   context_management, the full Usage/cache_creation/inference_geo/
   output_tokens_details/server_tool_use/service_tier/speed/iterations/
   fallback_credit set, `delta.context_management`, delta usage fields,
   `text.citations:null`, and `tool-use caller:{type:"direct"}`. Public settings
   `disableAgentView`/`disableRemoteControl`/`disableWorkflows` are set.
6. **Bounded output.** `main` emits newline-delimited JSON records: a
   length/hash manifest, then indexed base64 chunks per request, then an end
   record, with awaited backpressure drainage and no `process.exit`. Unknown
   secret headers, Bearer-valued headers and arbitrary opaque errors are
   scrubbed; a raw body that looks like it contains secret material is exported
   hash-only (no raw bytes).

## Checks actually run (this session, exit-0 evidence)

- `node --test apps/worker/qualification/probes/sdk-capture.test.mjs` → **44 tests, 44 pass, 0 fail** (was 32 before repair).
- `npm run check` (root) → **15 pass, 0 fail** (unchanged).
- `npm test` in `apps/worker/qualification` → **81 checks pass, 0 fail** (unchanged; the new suite is intentionally standalone).
- `git diff --check` → clean.
- `git status --short` → only the three new probe files (report added with them).

## Process / cleanup state

Imported/tested offline only: no server socket opened, no native process
spawned, no loopback connection made during the test run. The probe's real host
is assembled only when `main` runs on Linux (`platform !== 'linux'` returns
code 2 without building a host). All host effects in tests are injected fakes.
Native runtime proof: **NOT RUN**.

## Limitations / disclosures (unchanged scope)

- Model alias stays `meri-sonnet-qualification`; a real capture must observe the
  locked synthetic key and loopback base URL.
- SDK env flags do not prove every opaque retry path honors them; a real capture
  can prove only exactly-two observed requests and no OBSERVED retry.
- The loopback server and closed network do not prove no attempted non-loopback
  socket; allowed AWS bootstrap/log endpoints remain.
- No flat public `remoteControl` option exists in the published types; only
  `remoteControlAtStartup` is set (documented), plus `disableRemoteControl`.
- This qualifies wire evidence only — not Bedrock translation/auth/budget/cancel/
  recovery or G1. Owner deploys only after separate review.
