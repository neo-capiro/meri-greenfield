# W02-02 proxy preparation — independent Hermes review

Status: **REPAIR-REQUIRED** (not accepted; not integrated). Preparation-only.
Reviewer is a separate real Hermes session. Exit 0 below is NOT acceptance; Codex
owns the decision.

- Reviewer session ID: `20261009_170702_2bf928`
- Base commit: `08b5c33d6b53a3758ed6c1835d6e55825939c0cb`
- Reviewed HEAD: `059d610110488d99f2b89be1ae226ccdaf6302a6`
- Branch / worktree: `hermes/w02-proxy-review` @
  `C:\dev\main\meri-greenfield-worktrees\w02-proxy-review`
- Reviewed delta: `08b5c33..059d610` == exactly the twelve allocated added files
  (`git diff --name-status` all `A`). First rejected `0575bb4` was compared; the
  repair commit `059d610` rewrites 7 of those files.
- Root rejection context `…/reports/W02-02-CODEX-REVIEW-FIRST.md` read read-only.

Scope honored: no model/Bedrock call, no proxy/DB/Redis/server start, no
migration, no image build, no push, no credential retrieval, no cloud deploy, no
recursive delegation, no global/profile change. Synthetic Bedrock spend remains
$0. Scratch confined to `apps/proxy/qualification/.runtime/**` (gitignored).

## 1. Checks (exact commands, exit codes, counts)

| Command | Exit | Result |
| --- | --- | --- |
| `npm run check` (root, Codex-owned, unchanged) | 0 | tests 15 / pass 15 / fail 0 / skipped 0 |
| `npm --prefix apps/proxy/qualification test` | 0 | tests 26 / pass 26 / fail 0 / skipped 0 |
| `git diff --check` | 0 | no whitespace errors |

Nested suite opens no socket; `check` shells to `test`; no OS-Temp script.
Green checks do NOT establish the defects below — all four were reproduced with
the reference's own pure functions, without modifying tracked code.

## 2. Independently reproduced upstream pins (independently VERIFIED this session)

The recorded candidate evidence is honest. I re-derived it from the public
registry/source rather than trusting the artifact:

- `LICENSE` @ tag `v1.104.2` sha256 = `b170d6bf8e8835dd357e011681db028f4d51e2fb0ea892058f56e01fb39b8273`
  — **matches** `component-pins.json`.
- GitHub tag `v1.104.2` → commit `fc3920bf403124ad075bc04990f999f7e0612e12`
  — **matches** recorded `sourceCommit`.
- PyPI `1.104.2` metadata: wheel sha256 `416c3538ea78b08d637ec45564a919232aa2093e73adb9dd7752f7cff2ec585e`
  (36850695 B) and sdist sha256 `f766de3dd38b977ca70f17f409df04c0a9a3e90aed82582a965d348b6e2fe399`
  (19706913 B), `License-Expression: MIT`, `requires_python >=3.10,<3.15` — **all match**.
- **Wheel downloaded and hashed**: `416c3538ea78b08d637ec45564a919232aa2093e73adb9dd7752f7cff2ec585e`
  — matches exactly.
- Source citations inside the verified wheel checked line-for-line:
  `llms/base_llm/anthropic_messages/transformation.py:151-176`
  `max_retry_on_anthropic_messages_http_error` returns `2`, `should_retry_…`
  only on HTTP 400 invalid-thinking (retry limitation is real and correctly
  stated); `proxy_server.py:5231/5252 yaml.safe_load`; `__init__.py:204/211/212`
  redaction defaults `False`; `litellm_core_utils/exception_mapping_utils.py:2407`
  appends `Messages: …` when `redact_messages_in_exceptions is False`;
  `proxy/spend_tracking/budget_reservation.py:248/380/451`; unrecognized
  `litellm_settings` keys fall to `setattr(litellm, key, value)` (~`6380`) so the
  redaction flags are a supported config placement. Image digest/signature/
  non-root claims remain honestly NOT VERIFIED (no Docker here); not re-checked.

## 3. Negative reproductions (exact, unmodified code)

Scratch: `apps/proxy/qualification/.runtime/adv.mjs` (A–F) and `adv2.mjs` (G–H).
Run: `cd apps/proxy/qualification && node .runtime/adv.mjs`.

### R1 — nested strict-classifier claim is FALSE (silent admission of unsupported nested fields)
`parseMessagesBlocks` (`offline-policy.mjs:149-165`) validates only a few fields
per block; `tool_result.content` (`:158-159`) is not recursively classified;
`system` array blocks (`:199-202`) are never inspected. Results (all `ADMITTED`):
- `text` block with nested `cache_control` → ADMITTED
- `tool_use` block with nested `cache_control` → ADMITTED
- `tool_result` block with nested `cache_control` → ADMITTED
- `system: [{type:'text',…,cache_control}]` → ADMITTED
- `tool_result.content = [{type:'image',…}]` → ADMITTED
- `tool_result.content = [{type:'document',…}]` → ADMITTED
- `text` block with unknown nested key `citations` → ADMITTED

Top-level unknown keys ARE denied (`UNKNOWN_FIELD`), so the discipline is applied
only one level deep. This contradicts `README.md:62-66` (“nested … features are
denied from their actual raw header/body representation. No silent strip or
sanitize-and-pass”), the `offline-policy.mjs` header, and
`W02-02-PROXY-PREPARATION.md:41`. **This is the prohibited overclaim** noted in
the review brief: admitted nested features are claimed enforced.

### R2 — cache tier not charged while cache features are admitted
`offline-policy.mjs:239-241` hardcodes `cacheWriteTokens: 0` / `cacheReadTokens: 0`;
`estimateCostMicrousd` (`:265`) charges only `input*inputPerMTok + output*outputPerMTok`.
Repro: a `cache_control`-bearing request is ADMITTED with
`approxInputTokens=1065, cacheWriteTokens=0`, estimate `{costMicrousd:10875}`.
This contradicts ticket item 5 (“charge the highest applicable token/cache tier”)
and `README.md:68-70` (“worst-case reservation before dispatch”). The
component-pins `knownGaps` notes the surcharge omission, but the README/report
present the reservation as worst-case without that qualification.

### R3 — trusted (branded) DTO aliases the caller body (mutable reference)
`offline-policy.mjs:233-234` stores `body.messages` (and tool `input_schema`
objects) by reference; the DTO is not a snapshot. Repro (`adv2.mjs` G): after
admission, mutating the caller's `body.messages[0].content` to an `image` block
and appending an `evil` tool is reflected in `parsed.request.messages` /
`parsed.request.tools`, and `admitMessagesFeatures(parsed.request)` still returns
allowed (the brand survives). The classifier's guarantee does not survive to the
point of translation/dispatch.

### R4 — completed tool block exposed on a FAILED stream
`validateStream` mutates `base.completedToolBlocks` in place (`:471`) and the
error/cancelled branches (`:491-493`) return a copy that still carries it. Repro
(`adv.mjs` F):
- completed `tool_use` block then `error` → `{ok:false, success:false,
  reasonCode:'stream_error_after_http200', completedToolBlocks:[0]}`
- completed `tool_use` block then `cancelled` → `{…:'stream_cancelled',
  completedToolBlocks:[0]}`

A complete, executable-looking tool block is returned on a failed stream, which
contradicts `README.md:80-81` (“semantic failures never mark success or expose a
partial command”). Inclusive `success:false` gates a correct caller, but the
field is a latent misuse footgun named in the review brief.

## 4. Fixes from the first rejection — confirmed working (positive)

Reproduced against unmodified code (`adv2.mjs` H):
- unregistered key id → `unknown_key`; grant missing binding fields →
  `malformed_grant`; identity missing binding fields → `malformed_identity`
  (mandatory-field checks via frozen `RunBinding`, `additionalProperties:false`).
- Old key with a genuine advanced fence → `STALE_ATTEMPT` (grant authoritative
  over caller attribution); copy-of-key on another genuine run → `BINDING_MISMATCH`.
- Nested `thinking` block → denied (`unsupported_server_tool`), so the retry-path
  mitigation (deny thinking) holds within the reference.
- Budget: two near-ceiling reservations cannot both cross the cap; settlement
  never clamps real liability (`LEDGER_BREACHED` / `OVER_RESERVED_BOUND` retain
  real consumption and quarantine later dispatch); unresolved hold retained until
  explicit `provider_reconciliation`; TTL/process-loss keeps the hold; resets
  refused. Streams enforce start/index/identity/type/order/usage/terminal and
  complete tool JSON (incomplete JSON not added to `completedToolBlocks`).

## 5. Minor / honesty

- `docs/coordination/reports/W02-02-PROXY-PREPARATION.md:169` says “21 tests”
  while its check table (`:117`) says 26 — stale count from `0575bb4`.
- `offline-policy.mjs:380` stamps `pricingRevision` from the same `pricing`
  object that supplies costs, so the `STALE_PRICING` check (`:259`) cannot fire on
  the `admitModelRequest` path; it only fires in the isolated `estimateCost` test.
  Fail-closed overall, but the admission-time “stale pricing” claim is weaker than
  it reads.
- `settleBudget` OVERFLOW branch (`:318-321`) leaves `unresolved` without bumping
  `revision` or setting `breached` — fail-closed but inconsistent with siblings.

## 6. Remaining live blockers (unchanged; NOT RUN)

Assembled immutable image build/signature/non-root/read-only verification;
Postgres/Redis topology and least privilege; headless real virtual-key
issuance/revocation/cache-failure; authenticated broker task-to-grant binding,
current-run/fence checks and quiet-stream cancellation; native strict shared-team
reservation under concurrency plus durable broker unknown-charge holds /
reconciliation with verified current Bedrock pricing and token limits;
real SDK 0.3.295 / CLI 2.1.295 Messages header/feature/tool/stream/cancel/resume
and no-retry behaviour (the hardcoded `max_retry_on_anthropic_messages_http_error
= 2` remains unmitigated by config); trusted proxy-only Bedrock role with exact
ARNs and denied worker direct routes; TLS/private ingress and isolated Fargate
failure/replacement. G1 incomplete; W03 promotion and cutover blocked.

## 7. Verdict

**REPAIR-REQUIRED.** The recipe, pins, license scope, image honesty, redaction
placement and the credential/binding/settlement fixes are sound and independently
reproduced. But the offline reference does not satisfy its own advertised
fail-closed invariants: R1 (nested classifier permissiveness — an enforced-denial
overclaim), R2 (cache tier uncharged while cache admitted), R3 (mutable trusted
DTO), R4 (completed-tool exposure on failed streams). Fix by enforcing nested
classification/immutability and charging the applicable tier, or by downgrading
the claims to match the code — do not leave the overclaim. No implementation was
repaired here. Codex owns the acceptance decision.
