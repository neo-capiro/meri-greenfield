# W02-05 SDK wire-capture — independent Hermes review 6

Status: **REVIEW COMPLETE — runtime proof NOT RUN.** Separate actual Hermes
reviewer (this session), never the implementation writer. Report-only ownership;
no acceptance, deployment or gate authority. Codex independently accepts/rejects.

- Candidate (exact): `85ca1efd09f4d6c03d3e4d6048966db30c16b7a5` on
  `review/w02-sdk-capture-6` (worktree
  `C:\dev\main\meri-greenfield-worktrees\w02-sdk-review-6`), HEAD clean.
- Reviewed delta = Codex owner correction `3b8eabf1e7f29a2a48f083c4d947c3cadff82e1e`
  .. `85ca1ef` (the second Codex owner correction, on top of Hermes repair-4).
- Historical repair-4 base of the lineage: `fdf2035600a35a10974813aac787a0e091b51e74`.
- Prior review: `W02-05-SDK-REVIEW-5.md` at commit
  `8689125132f571bf7190d11d5c748ab6f4dc5800` (read directly, unchanged).

## Exact reviewed-file hashes (sha256, measured this session)

| Path | sha256 |
| --- | --- |
| `apps/worker/qualification/probes/sdk-capture-options.mjs` | `964f4f1958dd0707198fcd21611018b9a9337e90e5f434ed24ce47beb3986b0e` (unchanged) |
| `apps/worker/qualification/probes/sdk-capture.mjs` | `4b71228ed0ce49f4bc39c2abcc497d7b76fea30ffd115ca796a13dff7edd6840` |
| `apps/worker/qualification/probes/sdk-capture.test.mjs` | `38a3018af9702affe042bb8a2bf8f9078c5353446c2599f16d933f163c751c72` |
| `docs/coordination/reports/W02-05-SDK-WIRE-CAPTURE.md` | `1f840b51e2c958484138545b268f72043bb9937014a32bf77c7f5e218fe8c843` |

All three match the brief-declared SHAs byte-for-byte. `sdk-capture.mjs`
git-blob `1ecbfb495fe2dce7abfda606ca5464ad94f46625`. `git diff --check` clean;
review worktree clean apart from ignored `.task-inputs/`.

## Scope / exact-scope check

- `git diff --name-status 3b8eabf..85ca1ef` → only `sdk-capture.mjs`,
  `sdk-capture.test.mjs`, `W02-05-SDK-WIRE-CAPTURE.md` (M/M/M). Options file
  byte-unchanged (`964f4f19…`).
- Full lineage `git diff --name-only fdf2035..85ca1ef` → exactly the same three
  files. No contract, shard, lockfile, package, Dockerfile, infra, task-brief or
  other report touched anywhere in the lineage.

## What actually ran (true exit-0 evidence) and what could not

The fresh review checkout has **no `apps/worker/qualification/node_modules`**, so
the suite cannot load in situ (module-level `readFileSync` of the pinned SDK
declarations). Per brief I did not install. I verified the reviewed files are
byte-identical (`sha256` equal on all three + options) to the sibling
implementation worktree `C:\dev\main\meri-greenfield-worktrees\w02-sdk-capture`,
which is at the **same commit `85ca1ef`** and whose pinned `node_modules` I used
**read-only**. Every check exercises the exact reviewed bytes. Node v24.19.0.

| Check | Result |
| --- | --- |
| `node --test …/sdk-capture.test.mjs` (owned) | **73 pass / 0 fail**, exit 0 |
| `npm test` in `apps/worker/qualification` (`static.test.mjs`) | **81 pass / 0 fail**, exit 0 |
| `node --test probes/*.test.mjs` | **154 pass / 0 fail** (= 73 + 81) |
| Root `npm run check` (contracts + session) | **15 pass / 0 fail**, exit 0 |
| Adversarial replay `.task-inputs/_reaudit.mjs` (pin `4b71228e…`) | **14 pass / 0 fail**, `NO_REPRODUCED_BLOCKER`, exit 0 |
| Author's own independent probe `.task-inputs/_review6_probe.mjs` (this review) | **55 pass / 0 fail** |

Counts reproduce the owner statement (73/81/15/14) exactly. Attribution is
honest: 51 pre-existing sdk-capture tests + 4 added by the first Codex correction
(`3b8eabf`) + 18 = 73 (the correction chain 52→61→65→73; 8 more in this delta).

## Findings — disposition of review-5 F1–F4

**F1 (stale hash table / attribution in the report) — CLOSED.** The report's
hash table now lists the current bytes (`4b71228e…` / `38a3018a…`), the stale
`93eb4e94…` is gone, and `fc912e24…` survives only in the clearly-labelled
"Historical Hermes repair-4" section where it belongs. The pinned base line is
corrected (`3b8eabf` latest, `fdf2035` historical) and both corrections are
attributed to **Codex**, explicitly disclaiming Hermes authorship. The count
narrative (61 historical → 65 → 73) is accurate; 73/81/15/14 all reproduce.

**F2 (bounded-grace residual) — CLOSED.** `outputGuard` replaces the per-write
50ms grace with one `WeakMap` guard per stream: exactly one persistent `error`
observer and one `close` observer, retained until the stream actually closes.
Independently verified (pure `Writable`/`EventEmitter`/plain fakes, no real
stdout):
- A `'error'` delivered **300 ms** after a `write-timeout` (well beyond the old
  50 ms) is absorbed; the error observer is still present (count 1), sticky
  failure rejects all later writes, and both observers are removed at `close`
  (`listenerCount('error')==0`, `listenerCount('close')==0`).
- A late error after an **otherwise successful** callback is absorbed, sticky,
  and rejects future writes; the write count stays 1.
- An `'error'` emitted synchronously *just after* a successful callback cannot
  let `writeLines` pass (post-callback re-check returns `ok:false`).
- 3000 sequential writes keep listeners at exactly 1/1 (no MaxListeners, no
  per-write subscription growth); a timed-out write leaves no leaked timer or
  subscriber.
- Malformed writer (`write` not a function) yields a bounded `TypeError` result,
  no throw; early `errored`/`destroyed` streams fail immediately.
- The direct-CLI footer `process.exitCode = code || process.exitCode || 0`
  preserves a stdout failure both before and after an (otherwise) successful
  `main` resolution; the exact source footer is exercised with a fake process.

Assessed against the real Node `Writable` contract: `'error'` then `'close'` is
the terminal sequence for `destroy(err)`; observers are removed at that `close`.
The design does **not** rely on arbitrary post-close events, and holding the
observers until `close` with a weak key adds no strong stream leak.

**F3 (second-request validator accepted extra assistant blocks) — CLOSED.**
`validateToolRoundTrip` now collects every assistant content block and requires
`length === 1 && type === 'tool_use'`. Independently reproduced rejection of an
extra `text`, `thinking`, `image`, unknown-type or `null` block prepended to the
assistant message, an extra trailing assistant text block, and an extra
assistant text message — each fails (`assistant content must be exactly the
emitted tool_use block`). The valid round-trip and optional real tool-use
metadata (`caller`, `toolset_name`) remain accepted; the fixed SSE emits exactly
one `tool_use` `content_block_start`.

**F4 (camelCase credential-key false negative) — CLOSED.** `isCredentialKey` now
splits acronym and camelCase word boundaries before applying the existing
credential-segment set. Independently confirmed detection of `clientSecret`,
`clientPassword`, `accessToken`, `refreshToken`, `awsAccessKeyId`, `APIKey`,
`HTTPAuthorization`, `bearerToken`, `authorization`, `aws_secret_access_key`,
`privateKeyId`, plus the pre-existing snake_case forms; and continued non-detection
of `max_tokens`, `input_tokens`, `output_tokens`, `cache_creation_input_tokens`,
`cache_read_input_tokens` and their camelCase equivalents (`maxTokens`,
`inputTokens`, `cacheCreationInputTokens`, `inputTokensUsed`), plus `keyframes`,
`monkey`, `tokenizer`, `tokens`. Nested/array bodies still resolve correctly.
No reintroduction of the repair-3 `max_tokens` false positive.

## Residual observations (non-blocking, disclosed)

- **R1 (defense-in-depth false positive, pre-existing).** A *singular* `token`
  or `key` segment still flags as credential-named (e.g. `tokenCount`,
  `privateKeyId`, `PublicKeyComment`, `KeyValue`). This is the intended
  semantic rule and predates this delta (delimiter splitting already produced
  the singular segment); the required plural `*_tokens` accounting fields remain
  permitted, so it is not a regression.
- **R2 (sticky stream failure).** A `write-timeout`/`write-late` sets
  `guard.failed` permanently for that stream, so future writes on a recovered
  stream are refused. Fail-closed by design and disclosed in the source comment.
- **R3.** Post-close events are not treated as a production event contract;
  observers are removed at the Node terminal `close`.

## Positive confirmations (independent, not test-mirroring)

The eight repair-3 closures and the repair-4 hardening remain intact: semantic
credential detection; opaque error NAME → `Error`; fixed validation reasons;
argv exposes names only with hashed values; `main` exit from emitted `ok:false`
+ write outcome; expired output deadline writes nothing; child `close` (not
stderr `end`) gates PASS; write-callback error stays handled; one-spawn
enforcement with `onViolation` abort; every construction/startup/iteration/
cleanup/exit path bounded and fail-closed. Re-confirmed by reading the exact
source and by my own counterexample probes, not only green tests.

## Limitations / disclosures

- Missing `node_modules` in this checkout is an environmental blocker for the
  suite in situ; I ran the byte-identical files in the sibling worktree at the
  same commit and used its pinned `node_modules` read-only. No dependency was
  installed and no network used.
- F2 was exercised against synthetic `Writable`/`EventEmitter`/plain-object
  fakes, not live `process.stdout`; the reachability of a late stdout failure in
  production is not proven here.
- No native SDK/query/child, browser, Office, socket, server, cloud, AWS, model,
  provider, credential or private-source call occurred. All host effects were
  injected pure fakes.
- Native wire capture, Fargate run, image build, Bedrock
  translation/auth/budget/cancel/recovery and G1 remain **NOT RUN**. Green
  fixtures do not prove real native wire behaviour. No acceptance or deployment
  authority is claimed here.

## Verdict

**ACCEPT-FOR-CODEX-DECISION (no confidentiality or lifecycle blocker
reproduced).** Review-5 F1–F4 are genuinely closed in this exact delta; the
owner counts reproduce (73/81/15/14); scope is exactly three files with options
byte-unchanged; all declared SHAs match. R1–R3 are bounded residual/design
notes for owner awareness. Codex independently accepts/rejects; this document
establishes no acceptance, gate change or runtime proof.