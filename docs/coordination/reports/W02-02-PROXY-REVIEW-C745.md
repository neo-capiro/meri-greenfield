# W02-02 proxy preparation — independent FINAL review

Status: **ACCEPT AS OFFLINE PREPARATION** (not a live/security/G1 acceptance; Codex
owns the decision). One required documentation correction noted in §6. No
implementation was edited.

- Reviewer session ID: `20261009_170702_2bf928` (separate real Hermes reviewer)
- Reviewed HEAD: `c745e65b449f2d79fe1d1471a001d5506a4b7b67`
- Base: `08b5c33d6b53a3758ed6c1835d6e55825939c0cb`
- Branch / worktree: `hermes/w02-proxy-review-final` @
  `C:\dev\main\meri-greenfield-worktrees\w02-proxy-review`
- Delta `08b5c33..c745` = the same twelve allocated added files (`git diff
  --name-status` all `A`; four commits: `0575bb4`, `059d610`, `010e2bd`, `c745`).
  Specifically inspected `059d610..010e2bd4f2239398820c9841df852be9e63180f` and the
  owner thin fix `c745e65`.
- Root context read read-only: `W02-02-CODEX-REVIEW-SECOND.md` and the preserved
  `W02-02-PROXY-REVIEW.md` in the kickoff tree.

Scope honored: no model/Bedrock/CountTokens call, no proxy/DB/Redis/server start,
no migration, no image build, no push, no credential retrieval, no cloud deploy,
no recursive delegation, no global/profile change. Synthetic Bedrock spend $0.
Scratch confined to `apps/proxy/qualification/.runtime/**` (gitignored).

## 1. Checks (exact commands, exit codes, counts)

| Command | Exit | Result |
| --- | --- | --- |
| `npm run check` (root, Codex-owned, unchanged) | 0 | tests 15 / pass 15 / fail 0 / skipped 0 |
| `npm --prefix apps/proxy/qualification test` | 0 | tests **28** / pass 28 / fail 0 / skipped 0 |
| `git diff --check` | 0 | no whitespace errors |

Nested suite opens no socket; `check` shells to `test`; no OS-Temp script. Green
checks are not the evidence below — every case was reproduced with the reference's
own pure functions (scratch `apps/proxy/qualification/.runtime/final.mjs` +
standalone runs), no tracked code modified.

## 2. ALL prior owner rejections now FAIL-CLOSED (reproduced)

From `W02-02-CODEX-REVIEW-SECOND.md`, against HEAD `c745`:

| Reproduction | Result |
| --- | --- |
| `system` array containing a thinking block | denied `unsupported_thinking_block` |
| `system` text block with 1h `cache_control` | denied `unsupported_cache_control` |
| `tool_result.content` containing a thinking block | denied `unsupported_thinking_block` |
| Unknown `message.api_base` | denied `routing_or_credential_override` |
| Tool definition with `cache_control` | denied `unsupported_cache_control` |
| Unknown `tool_result.routing_override` | denied `routing_or_credential_override` |
| Mutate branded DTO to bounds 1 / spread-forge it | mutation throws (deep-frozen); forged copy → `unparsed_or_forged_request_dto` |
| Reserve 5M+5M, first unresolved, reconcile first 6M | `ledger_breached`, `breached=true`, committed **11,000,000**, later reserve denied |

## 3. My prior R1–R4 (059d610 review) now FAIL-CLOSED (reproduced)

- **R1 nested classifier** — now strict/deep. `offline-policy.mjs:173-232`
  (`checkAllowedKeys`, `validateTextBlock`, `validateMessageContent`) and
  `:269-313` validate message/system/text/tool_use/tool_result/tool-definition/
  tool_choice/metadata with exact allowed keys. Denied: nested `cache_control`
  on text/tool_use/tool_result/system; top-level and message-level `cache_control`;
  `tool_result.content` image/document/thinking; unknown nested key `citations`;
  unknown top-level field. Local tool `input`/`input_schema` is intentionally
  DATA (any JSON) and passes — matches the owner's stated design and the suite's
  safe user/tool-data test.
- **R2 cache tier** — no admission can carry `cache_control` (denied pre-translation),
  so the previously uncharged cache tier is no longer reachable; the ticket's
  "highest applicable tier" concern is moot for the admitted subset.
- **R3 mutable trusted DTO** — fixed. `offline-policy.mjs:319-332` deep-freezes the
  DTO (`deepFreeze`, `:111-117`) and stores provenance in a private `WeakMap`
  (`:145-147`); `createCredentialRegistry` (`:124-136`) stores a deep-frozen
  `structuredClone`. Reproduced: DTO frozen, mutation throws, post-parse mutation
  of the raw body does not change the DTO, and a spread copy loses the brand
  (`unparsed_or_forged_request_dto`).
- **R4 completed tool on failed stream** — fixed by owner `c745`. Tool indexes go
  to a private `pendingToolBlocks` (`offline-policy.mjs:553,590`) returned only on
  the whole-stream success path (`:619`). Reproduced: error / cancelled /
  truncation / duplicate-terminal / invalid-final-usage each return
  `success:false` with `completedToolBlocks: []`; the valid sequence returns `[0]`.

## 4. Trusted token-count observation (reproduced)

`createTrustedCountObservation` + `estimateCostMicrousd` (`offline-policy.mjs:347-382`):
missing observation → `missing_trusted_count_observation`; `source:'wire_claim'`
→ `untrusted_count_observation_source`; raw-headers change (canonical-hash
mismatch) → `count_observation_mismatch`; NaN count → `unknown_cost_estimate`;
`maxOutputTokensBound` mismatch → `count_observation_mismatch`; oversize input/
output → `oversize_input`/`oversize_output`. char/4 is gone from the admission
path (`approxInputChars` is diagnostic-only and unused by `estimateCostMicrousd`).
Fixture pricing/counts are labelled NOT current Bedrock/provider bounds.

## 5. Independently re-verified upstream pins (unchanged, honest)

Re-derived from public registry/source on HEAD (the 010e/059/texts are historical):
`LICENSE`@`v1.104.2` sha256 `b170d6bf…` matches; GitHub tag → `fc3920bf…`;
PyPI wheel/sdist hashes `416c3538…` / `f766de3d…`, MIT, `>=3.10,<3.15` match; a
freshly downloaded wheel hashed `416c3538…`. Wheel source citations checked
line-for-line (`transformation.py:151-176` retry=2 on HTTP400 invalid-thinking;
`proxy_server.py:5231/5252`; `__init__.py:204/211/212`; `exception_mapping_utils.py:2407`;
`budget_reservation.py:248/380/451`; `litellm_settings` setattr fallback). Image
digest/signature/non-root remain honestly NOT VERIFIED (no image built).

## 6. Findings to record (non-code, no implementation edit)

- **D1 (documentation, required correction).** `docs/coordination/reports/W02-02-PROXY-PREPARATION.md`
  mis-states the final test count: the check table (`:150`) says “27 tests” and the
  Repair v3 note (`:84`) says “now 27”, while the Evidence-paths bullet (`:202`)
  still says “21 tests”. Actual final HEAD runs **28**. Correct to 28 (and the
  stale 21).
- **D2 (attribution, required correction).** The completed-tool-privacy and
  overflow-quarantine changes are the **owner/root** thin fix `c745e65`
  (author `Neo Martinez`), NOT the Hermes `010e2bd` session. The report does not
  attribute it to Hermes (good) but also does not record it or the final HEAD SHA;
  the header still shows branch `hermes/w02-proxy` and “result commit: none yet”.
  Codex should record `c745e65b449f2d79fe1d1471a001d5506a4b7b67` and the 28 count.
- **D3 (minor, cosmetic).** `offline-policy.mjs:317` names the diagnostic-only
  `approxInputChars` but assigns `canonicalSha256(body).length`, which is always 64
  hex chars, not a character count. It is unused by the estimator (comment says
  diagnostic-only); rename or drop to avoid future misuse.
- **D4 (honesty checks pass).** README/report/component-pins no longer overclaim:
  retry limitation `max_retry_on_anthropic_messages_http_error` (hardcoded 2, no
  config knob) is stated as an unmitigated live blocker with no “all retries
  disabled” claim; nested-denial claims now match the code; redaction flags are a
  supported placement; empty callbacks is explicitly not redaction.

## 7. Remaining live blockers (NOT RUN — must stay explicit)

Assembled immutable image build/signature/non-root/read-only verification;
Postgres/Redis topology and least privilege; headless real virtual-key
issuance/revocation/cache-failure; authenticated broker task-to-grant binding,
current-run/fence checks and quiet-stream cancellation; native strict shared-team
reservation under concurrency plus a durable broker unknown-charge hold /
reconciliation with verified current Bedrock pricing and token limits; real SDK
0.3.295 / CLI 2.1.295 Messages header/feature/tool/stream/cancel/resume and
no-retry behaviour; trusted proxy-only Bedrock role with exact ARNs and denied
worker direct routes; TLS/private ingress and isolated Fargate failure/replacement.
The one free owner CountTokens native-FM call (31 synthetic tokens) is not an
invocation/role/proxy token-count/wire/capability qualification. G1 incomplete;
W03 promotion and cutover blocked.

## 8. Verdict

All prior owner rejections and my prior R1–R4 now fail-closed under independent
reproduction, the combined-liability budget case preserves real 11M liability and
quarantines the ledger, the trusted count observation binds the canonical raw hash
and denies missing/unverified/mismatched/unsafe counts, settlement/reconciliation
re-check combined committed spend, and completed tool blocks stay private on every
failed stream. The recipe, pins, license scope, image honesty and redaction
placement remain sound.

**Recommend ACCEPT ONLY as offline preparation**, conditional on the §6 D1/D2
documentation corrections (test count 27→28 / 21→28 and recording the root-owned
`c745e65` fix and final HEAD SHA — do not attribute the owner fix to Hermes). This
grants no live proxy, auth, Fargate, security, budget or SDK compatibility
acceptance. G1/W03/cutover remain blocked; Bedrock spend $0. Codex owns acceptance.
