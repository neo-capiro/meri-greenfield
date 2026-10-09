# W02-05 SDK wire-capture — independent Hermes review 5

Status: **REVIEW COMPLETE — runtime proof NOT RUN.** Separate actual Hermes
reviewer (this session), never the implementation writer. Report-only ownership;
no acceptance, deployment or gate authority. Codex independently accepts/rejects.

- Candidate (exact): `3b8eabf1e7f29a2a48f083c4d947c3cadff82e1e` on
  `review/w02-sdk-capture-5` (worktree
  `C:\dev\main\meri-greenfield-worktrees\w02-sdk-review-5`).
- Candidate = Hermes repair4 `74e5d0b47f157598e759b4a01793afb56a1b19f0` plus an
  explicitly Codex-attributed owner correction `3b8eabf`.
- Pinned base of the lineage: `fdf2035600a35a10974813aac787a0e091b51e74`.

## Exact reviewed-file hashes (sha256, measured this session)

| Path | sha256 |
| --- | --- |
| `apps/worker/qualification/probes/sdk-capture-options.mjs` | `964f4f1958dd0707198fcd21611018b9a9337e90e5f434ed24ce47beb3986b0e` |
| `apps/worker/qualification/probes/sdk-capture.mjs` | `724a281b87c6003644fa0b07fd0ee4529287192156faa7b01a279c416b52f994` |
| `apps/worker/qualification/probes/sdk-capture.test.mjs` | `b4bf30631ff6321bfe96a2420989e0ccc691fe1f00f7e6869547f12ede76389d` |
| `docs/coordination/reports/W02-05-SDK-WIRE-CAPTURE.md` | `4dd8eb56707981fab6c0fde45f35201b51411fa80c08f8a40d5aae40c7a2e20c` |

`sdk-capture.mjs` matches the owner-declared correction hash
`724a281b…b52f994`. `git diff --check` clean; review worktree clean.

## Scope / exact-scope check

- `git diff --name-only fdf2035 3b8eabf` → sdk-capture.mjs, sdk-capture.test.mjs,
  W02-05-SDK-WIRE-CAPTURE.md (options unchanged). No contract, lockfile, package,
  Dockerfile, infra, task-brief or other report touched.
- Candidate delta `74e5d0b..3b8eabf` touches exactly sdk-capture.mjs and
  sdk-capture.test.mjs (owner correction), matching its attribution.

## What actually ran (true exit-0 evidence) and what could not

The fresh review checkout has **no `apps/worker/qualification/node_modules`**, so
`sdk-capture.test.mjs` cannot even load here: lines 88–89 do a module-level
`readFileSync` of the pinned SDK declarations and fail with `ENOENT` (reproduced,
`node --test …` exit 1). Per brief I did not install. Instead I ran the
**byte-identical** reviewed files (verified `diff` SAME against this worktree) in
the sibling implementation worktree `w02-sdk-capture`, also at `3b8eabf`, whose
pinned `node_modules` I read **read-only**. Every check below therefore exercises
the exact reviewed source bytes.

| Check | Result |
| --- | --- |
| `node --test apps/worker/qualification/probes/sdk-capture.test.mjs` (owned) | **65 pass / 0 fail**, exit 0 |
| Existing worker suite `apps/worker/qualification` (`npm test`) | **81 pass / 0 fail**, exit 0 |
| Root `npm run check` (contracts + session) | **15 pass / 0 fail**, exit 0 |
| Adversarial replay `.task-inputs/_reaudit.mjs` (source sha pinned to `724a281b…`) | **14 pass / 0 fail**, `NO_REPRODUCED_BLOCKER`, exit 0 |
| `git diff --check` | clean |

Counts reproduce the owner statement (65/81/15/14). The original Hermes repair4
report's "61 tests" describes its own pre-correction source; the corrected
candidate is 65. Attribution retained honestly: 4 added tests are the owner's.

## Pinned public declarations independently verified (read-only)

- **Options** (`@anthropic-ai/claude-agent-sdk` 0.3.295 `sdk.d.ts`): all 29
  `CAPTURE_OPTION_FIELDS` are declared. `fallbackModel`/`resume`/`continue`/
  `sessionStore`/`sessionStoreFlush` exist in the type but are never set and are
  actively rejected by `validateCaptureOptions`.
- **Settings**: all 21 keys asserted by the suite are declared; `permissions`
  fields `ask`/`defaultMode`/`disableBypassPermissionsMode`/
  `blockReadsOutsideWorkingDirectories`/`additionalDirectories` declared.
- **ThinkingConfig** includes `{ type: 'disabled' }`. **CanUseTool** options
  expose `mcpServer: { name: string; source: string }`; `source: 'sdk'` is the
  documented in-process-SDK-server provenance used by the callback.
- **ResolvedSettings** `{ effective, provenance, sources:[{source, settings, ...}] }`
  matches `validateResolvedSettings`.
- **Beta Messages** `MessageCreateParamsBase` requires `max_tokens`, `messages`,
  `model`; `system`/`thinking`/`tools`/`metadata`/`stream` declared. The full-pinned
  positive fixture uses these real public shapes and is not hash-only.
- **BetaUsage**: all 12 fields declared and matched by `completeUsage`;
  `service_tier`/`speed` = `'standard'` valid.
- **MCP surface**: `createSdkMcpServer` options (`version`/`alwaysLoad`/`timeout`)
  and `tool(...)` extras `{ alwaysLoad }` are real. `WIRE_TOOL_TIMEOUT_MS` 5000 ≥
  the documented 1000ms floor.
- **Pinned argv builder** function `je(e,t){return \`${e}=${t}\`}` is present
  (grep count 1) — supports the `'='`-split argv-value sanitizer assumption.

## Repair-3 failures — independently re-closed

Reproduced via the 14-case adversarial replay and direct probes: semantic
credential detection (real `max_tokens`/`*_tokens` are not credential keys; full
Messages fixture yields `hashOnly:[false,false]` + 2 chunks); opaque error NAME →
`Error`; fixed validation reasons (no interpolation of method/path/peer/id/
subtype/stop_reason); argv exposes names only (`--api-key`, `--settings`; values
hashed) with full count/bytes/hash; `main` exit derives from emitted `ok:false` +
write outcome (exit 1); expired output deadline writes nothing; child `close`
(not stderr `end`) gates PASS with final stderr snapshot; write-callback error
stays handled (coupled case, no uncaught). No blocker reproduced.

## Concrete findings

**F1 — Stale hash table / attribution in the reviewed report (medium, artifact).**
`sdk-capture.mjs` at 74e5d0b hashes `fc912e24…`; the report's "Owned paths …
content hashes" table still lists that value (and test `93eb4e94…`), but the
reviewed candidate files are `724a281b…` and `b4bf3063…`. The owner correction
`3b8eabf` changed those two files (and added 4 tests → 65) **without updating
`W02-05-SDK-WIRE-CAPTURE.md`** (the report is byte-identical between 74e5d0b and
3b8eabf; last commit touching it is 74e5d0b). The report also still says "61
tests" and does not credit the owner correction. No runtime effect; the report
should be corrected by its owner (this reviewer may not edit it).

**F2 — `writeOnce` bounded-grace residual can surface an uncaught error (low/medium).**
`writeOnce` (sdk-capture.mjs:1094–1133) removes its `error`/`close` observers
`WRITE_CALLBACK_GRACE_MS` (50ms) after settlement. A stream `'error'` delivered
**later** than that grace is no longer absorbed. Reproduced with a pure `Writable`
whose write callback never fires (→ `write-timeout`), destroyed with an error
250ms later: `process` `'uncaughtException'` **fired** (`uncaughtFired:true`). The
in-suite regression (test line 931) only covers the coupled/immediate error. This
is the deliberate anti-listener-leak tradeoff, but it is a real residual: `main`
writes to `process.stdout`, so a late stdout error after a timed-out/errored write
would be uncaught. Owner-decided hardening (e.g. a non-throwing `error` observer
kept for the write window, or settlement tied to the stream error rather than a
fixed grace).

**F3 — Second-request validator accepts extra assistant blocks (low).**
`validateToolRoundTrip` (sdk-capture.mjs:274–321) enforces counts of user-text/
`tool_use`/`tool_result` and ordering but not absence of other assistant content.
Reproduced: a request whose assistant message also carries an arbitrary text block
is **accepted** (`accepted:true`). No confidentiality impact (assistant content in
this loopback capture derives from the probe's own SSE), but it slightly weakens
the "exact echo" wire assertion. A stricter "assistant messages contain only the
one tool_use block" check would close it.

**F4 — camelCase credential-key false negative (low, defense-in-depth).**
`isCredentialKey` (sdk-capture.mjs:129–134) splits keys on non-alphanumerics, so a
credential smuggled in a single camelCase segment (e.g. `clientSecret`) is not
treated as credential-named (reproduced `detected:false`), while `apiKey`/
`api_key`/`access_token` are. Real Anthropic Messages fields are snake_case and
the required accounting fields pass, so this does **not** reintroduce the repair-3
`max_tokens` false positive. Residual only; any fix must not re-falsify numeric
`*_tokens` fields.

## Positive confirmations (independent, not test-mirroring)

Fixed model/loopback host/peer/accepted-path checks; two independent raw and
decompressed hashes with bounded base64 chunks; header redaction; argv value
stripping; error-type allowlist; one-spawn enforcement with `onViolation` abort;
`stdioDone` bound to child `close`; every construction/startup/iteration/cleanup/
exit path bounded and fail-closed. These were re-confirmed by reading the exact
source and by my own counterexample probes, not only by the green suite.

## Limitations / disclosures

- Missing `node_modules` in this checkout is an environmental blocker for the
  suite in situ; I ran the identical files in the sibling worktree and read its
  pinned declarations read-only. No dependency was installed and no network used.
- F2's reachability depends on real `process.stdout` late-error semantics and was
  exercised against a synthetic `Writable`, not live stdout.
- No native SDK/query/child, browser, Office, socket, server, cloud, AWS,
  provider, credential or private-source call occurred. All host effects were
  injected pure fakes.
- Native wire capture, image build, Fargate run, Bedrock
  translation/auth/budget/cancel/recovery, session/file recovery and G1 remain
  **NOT RUN**. Green fixtures do not prove real native wire behaviour. No
  acceptance or deployment authority is claimed here.

## Verdict

**ACCEPT-FOR-CODEX-DECISION (no confidentiality or lifecycle blocker reproduced).**
The eight repair-3 failures are genuinely closed and the owner counts reproduce
(65/81/15/14). Recommended before Codex acceptance: **F1 corrected by the owner**
(stale hashes + attribution in the report); F2/F3/F4 are bounded-residual or
strictness hardening for owner decision. Codex independently accepts/rejects; this
document establishes no acceptance, gate change or runtime proof.