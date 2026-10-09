# W02-02 proxy preparation — independent delta review (stream tool identity)

Status: **ACCEPT AS OFFLINE PREPARATION** (not a live/security/G1 acceptance; Codex
owns the decision). Delta-only review of `c745..1ba`. No implementation edited.

- Reviewer session ID: `20261009_170702_2bf928` (separate real Hermes reviewer)
- Reviewed HEAD: `1ba863bd0c2113e99a2271a5d53a89b18be72bd8`
- Base for this delta: `c745e65b449f2d79fe1d1471a001d5506a4b7b67`
- Branch / worktree: `hermes/w02-proxy-review-identity` @
  `C:\dev\main\meri-greenfield-worktrees\w02-proxy-review`
- Delta `c745..1ba` (`git diff --name-status`) = 3 files, all owned:
  `apps/proxy/qualification/offline-policy.mjs`,
  `apps/proxy/qualification/test/offline-policy.test.mjs`,
  `docs/coordination/reports/W02-02-PROXY-PREPARATION.md`.
  Commits: owner thin fix `7aeffa9c066c6cc65ed5080414994f3a8256e9e1` (code) and
  owner/docs `1ba863b` (counts + provenance).
- My prior review commit `70e99c2e50f34307fd42139c5932c65180902b65` (reviewed `c745`)
  is preserved unchanged at `reports/W02-02-PROXY-REVIEW-C745.md`; upstream
  metadata and the full prior audit were not repeated.

Scope honored: no implementation edit, install, provider/model/cloud/server/socket/
native execution, push, amend, delegation or global change. Scratch only
`apps/proxy/qualification/.runtime/**` (gitignored). CountTokens spend $0.

## 1. Checks (exact, this HEAD)

| Command | Exit | Result |
| --- | --- | --- |
| `npm run check` (root, Codex-owned, unchanged) | 0 | tests 15 / pass 15 / fail 0 |
| `npm --prefix apps/proxy/qualification test` | 0 | tests **29** / pass 29 / fail 0 |
| `git diff --check` | 0 | no whitespace errors |

Nested suite opens no socket. Green checks are not the evidence — the new cases
were reproduced with the reference's own functions (`apps/proxy/qualification/.runtime/delta.mjs`).

## 2. Delta change (owner `7aeffa9`)

`offline-policy.mjs` only: (a) `validateStream` now keeps a `toolIds` Set and
rejects a `tool_use` id already seen at another index (`:565-572`); (b)
`content_block_delta` and `content_block_stop` reject any supplied identity field
that disagrees with the originating block — `blockKind` on delta (`:582`), `name`/
`id` on delta (`:582`) and on stop (`:592`); (c) `approxInputChars` is now
`JSON.stringify(body).length` (real length, diagnostic-only) instead of the
64-char sha256 hex length. Completed tool indexes still go to a private
`pendingToolBlocks` returned only on whole-terminal success.

No admission, classification, credential-binding, settlement, reconciliation or
reservation function changed — the diff does not touch `admitModelRequest`,
`reserveBudget`, `settleBudget`, `reconcileBudget`, `committedMicrousd`,
`estimateCostMicrousd`, `parseAnthropicMessagesRequest` (beyond the diagnostic
line) or any DENY branch.

## 3. Reproduced new cases + positive (independent)

All PASS, each `success:false` with `completedToolBlocks: []`:
- delta conflict `name:'other'` → `stream_block_identity_mismatch`
- delta conflict `id:'other'` → `stream_block_identity_mismatch`
- delta conflict `blockKind:'text'` → `stream_block_identity_mismatch`
- stop conflict `name:'other'` → `stream_block_identity_mismatch`
- stop conflict `id:'other'` → `stream_block_identity_mismatch`
- stop conflict `blockKind:'text'` → `stream_block_identity_mismatch`
- duplicate `tool_use` id across indexes → `stream_block_identity_mismatch`

Consistent positives (must still pass):
- delta/stop restating the SAME name/id/blockKind → `success:true`,
  `completedToolBlocks:[0]`
- two distinct tool ids at indexes 0/1 → `success:true`, `[0,1]`
- `approxInputChars` (561) == `JSON.stringify(body).length` (561).

## 4. No regression / prior limits intact

Re-ran the prior composed reproductions at `1ba`: combined-liability case still
`ledger_breached`, `breached:true`, committed **11,000,000**, later reserve denied;
valid stream still returns `completedToolBlocks:[0]`; local tool `input` remains
DATA (any JSON) by design. No budget/admission drift observed.

## 5. Docs (owner `1ba863b`) — prior D1/D2 addressed

`W02-02-PROXY-PREPARATION.md` now records the Hermes repair implementation
`010e2bd`, the separately attributed owner fixes `c745` and `7aeffa9`, the final
code candidate `7aeffa9`, the final 29-test count in the check table and Evidence
section, the 27 historical note, and removes the stale 21. The owner fixes are
explicitly labelled owner changes, not Hermes output. The diagnostic
`approxInputChars` is described as unused for token/price admission. No remaining
documentation overclaim found.

## 6. NOT RUN (live gates — must stay explicit)

Real live authentication / virtual-key issuance-revocation-cache; trusted
token-count (CountTokens) and concurrency behaviour; durable broker unknown-charge
holds and reconciliation with verified current Bedrock pricing/limits; real SDK/
CLI Messages header/tool/stream/cancel/resume wire behaviour and the unmitigated
native invalid-thinking HTTP400 retry-2 path; TLS/private ingress; isolated
Fargate build/non-root/failure-replacement. The single free owner CountTokens
native-FM call is not an invocation/role/wire/count-capability qualification;
spend $0. G1 incomplete; W03 promotion and cutover blocked.

## 7. Verdict

The owner thin fix `7aeffa9` closes the third-party-found stream identity gap
(conflicting name/id/blockKind on delta/stop and duplicate tool-use ids) without
touching budget/admission and without regressing any prior fail-closed invariant;
the composed regression test and my independent reproduction agree, and root 15 /
nested 29 / `git diff --check` all exit 0. **Recommend ACCEPT as offline
preparation only.** This grants no live proxy, auth, Fargate, security, budget or
SDK compatibility acceptance. Codex owns acceptance.
