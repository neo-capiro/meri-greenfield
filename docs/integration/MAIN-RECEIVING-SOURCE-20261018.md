# Main receiving source composition, 18 October 2026

## Implementation outline

This source-only branch receives the published broader retained-capability source, the accepted first-chat repairs, the signed-memory and retention stack, and the A8 and Florida follow-ups into one reviewable successor to `main` at `8b123bea`. It does not change the deployed first-chat pin or qualify a new image.

Canonical owners remain unchanged: runtime owns runner startup and Stop, gateway source adapters own client-scoped reads, control owns conversation and retention persistence, and the existing allocation/render inputs own feature selection. The receiving branch composes those published implementations; it introduces no parallel authority, transport, persistence, or migration owner. Shared entry points are resolved by preserving both published call paths and their feature gates.

The branch starts at broader receiving `85e89741`. Before receipt, compare ancestry and Git blobs: the deployed `107af36b` runner CA fix is already present by exact content and must not be replayed. Receive the missing A8 PR159/166, Florida PR168, accepted first-chat PR175, and stacked memory PR172/173/174/176/177 once each. Resolve any shared-file conflicts against their canonical owners and document the final content and missing lanes below.

Verification is limited to affected composition, imports, syntax, types, targeted source tests, and a source diff review on Linux. A passing source check cannot qualify the old N21 image for this source. The first-chat shipping lane remains on PR175; this branch is a later source integration. Keep migrations, capability selections, source access, and retention behind their existing holds. There is no main merge, AWS build, deployment, live SQL, IAM, or network action in this task.

## Receipt and verification

The receiving worktree was created at `85e8974175e83ef0971c33eeaed01f4696287af0`, itself a descendant of `main` `8b123bea4c90794dc2d766814b6ddbdbfe0928bc`. It already contains PR160–165, PR167 and PR171 by ancestry. PR169/170 were received within PR171 through equivalent patch-ID cherry-picks. The two files changed by deployed N21 `107af36b89686bb8545b200e05a39f2c4733b56b` match that commit's Git blobs exactly (`9646e3aa` runner authority, `c5a07525` test); replaying it would duplicate content. At the post-audit source head, the main-facing diff is 19,020 files because it receives the whole published broader source; the incremental receipt above broader is 132 files. Historical evidence files account for most of the main-facing volume.

| Published source | Receiving disposition |
| --- | --- |
| A8 PR159 `cdb5c2e7` then PR166 `15288a79` | Clean cherry-picks `4b7556183` and `37fc6ba68`. PR160–165 were already present. |
| Florida PR168 `22c3b3e8` | Clean cherry-pick `e89bae383`; the selected-client guard and its test are retained. |
| First-chat PR175 `993f52a9` | Seven post-`107af` commits received as `683ceeb8d` through `53549d71f`; first-chat shipping stays pinned to PR175 itself. |
| Memory PR172 → 173 → 174 → 176 → 177, head `c200b03f` | Merge `53ae0f583`, retaining the complete published lineage. PR173 updates the source preview allocation, schedule and policy to profile `0.3.0`. Its old N21 image receipt is not a new image qualification. |
| Published memory target branch `d5da00d0` | Its two file-only `0018_memory_candidate_targets.sql` commits received as `f5d9b29d8` and `99560504d`; final SQL SHA-256 `e13b87c87972eaac4a5106a39ccd25d0da6396124719f1dc0dbcbfd2a0d1612d`. Earlier source behavior is already composed in broader `5bb4fcbd9`; the later whole-row payload deletion proposal is explicitly held as described below. |

Conflicts were resolved without selecting one owner's behavior over another. `cli.mjs` keeps broader schedule gating and PR175 runner diagnostics. Conversation activity keeps admitted run budgets and browser cleanup uncertainty while reporting PR175 stages and cleanup failures. The lifecycle fixture keeps the broader claimed allocation and PR175 original reconciliation. The central migration allocation ledger keeps both prepared-approval and memory reservations. Git's automatic merge of runtime `cli.mjs`/`control.mjs` retains PR175 Stop reconciliation and memory continuation binding. One memory relay startup test had asserted identity with the underlying ports, although the relay wraps them to fence calls after close; `b38fa6d8a` now verifies forwarding and the close fence.

The published `0018` and `0019` SQL are source only. The fixed first-chat migration plan still stops at conversation `0017`; there was no SQL apply. The separate allocated `0002_candidate_retention_delete.sql` and `0002_memory_preparation_tombstone.sql` source files are not in this receiving tree. On the published 0018 branch, `e65f1d00f`'s `retention-payload-owner.mjs` is not present: it proposes whole-row candidate deletion, while the current central allocation requires a payload tombstone retaining replay keys and hashes. This needs the memory/retention owner's redesign and qualification, not an automatic transplant. Earlier 0018-branch source behavior (`a822e42f8`, `91fbd6289`, `6cd19f2a3`) is already composed in broader source; its allocation text is also retained. PR178 rollover implementation is a separate unpublished lane and is excluded. Retained operations remain held, and the memory planner still lacks a production all-class inventory and row-deletion route; purge remains closed.

### Focused Linux checks

| Check | Observed result |
| --- | --- |
| Syntax on the 97 added/changed `.mjs` modules versus broader `85e89741` | 97/97 passed. |
| 39 changed test files across A8, Florida, first-chat, signed memory and retention | Initial 529 tests: 527 passed, 1 failed, 1 skipped. The failure was the relay identity assertion above; the affected startup file passed 11/11 after correction. The full 39-file set was not repeated. |
| Capability policy and Linux SDK pin | 8/8 and 12/12 passed. The SDK pin run includes the full proposed profile over real POSIX workspace and plugin directories, qualifying the three Windows-only fixture failures in the prior PR171 receipt on Linux. |
| Python encoder to actual Node owner-wire decoder | 4/4 passed. |
| Direct imports of runtime CLI/control/worker, activity, lifecycle, retention purge and gateway reads integration | 7/7 passed without startup. |
| Preview runtime-values/render suites with explicit source root and Python | 28/30 passed. Two failures remain at the stale launch receipt: `receipt.inputs.policyRevision` differs after PR173, and `runnerSha256` differs after PR175. No qualified image or receipt was re-pinned. |
| Runtime and conversation-control typechecks | Failed with 3 and 18 diagnostics respectively, all in unchanged worker capability/egress files. Those files and both TypeScript configurations are byte-identical to broader `85e89741`; this source receipt does not claim green typechecks. |
| Whitespace, merge and provenance review | `git diff --check 85e89741 HEAD` passed; no unresolved merge entries. PR177 is an ancestor, and the `107af` Git blobs match exactly. The full main-facing diff contains pre-existing whitespace in historical evidence files; no mass evidence rewrite was made. |

The first dependency/test launches failed on absent per-package local installs and `MERI_REVIEW_SOURCE_ROOT`; pinned `npm ci` in this disposable worktree and the explicit source root resolved those setup failures. Tests used synthetic fixtures only. No AWS build, image push, deploy, main merge, credential/IAM/network change, paid model call, or live SQL occurred.

### Post-receipt finding ledger

Neo's broader audit at `c200b03f` was reproduced against the exact receiving head `d185b610` before repair. The independent source fixes were received as the commits below. “Fixed” means the reproduced source behavior and its focused regression pass on Linux; it does not claim deployed availability.

| Finding | Status | Receiving fix and evidence |
| --- | --- | --- |
| P1 history suppression during awaited Core currentness released saved transcript/list or next-turn result | **Fixed** | `7ed0b3451` adds final retention checks after awaited Core reads and before next-turn reservation. Three new cases failed before the fix; history HTTP 48/48 and turn settlement 4/4 passed afterward. |
| P2 successor completed or failed before start acknowledgement became UNKNOWN and skipped continuation | **Fixed** | `a25b51aa3` accepts proven natural completed/failed successor state for the continuation. Cancellation still refuses, and lost start acknowledgement stays UNKNOWN. Two regressions failed before repair; focused lifecycle tests 61/61 passed. |
| Stop commit plus lost acknowledgement plus session revocation skipped both cleanup owners | **Fixed** | `ced3bc490` retains the generated cancel event ID and original verified binding/scopes. A bounded, internal journal terminal-fence readback authorizes only the already requested cleanup; a revoked caller receives UNKNOWN. The combined regression failed before repair and now attempts both owners; an uncommitted negative attempts neither. Lifecycle/Stop tests passed 84/84. |
| P2 mail page two refused a fresh authorization decision ID | **Fixed** | `77c003662` excludes only that ephemeral ID from prior/current subject equivalence; every page still requires fresh authority and stable subject/scope/anchor/filter checks. Gateway mail tests 91/91 passed. `0c7b580c8` updates a stale test assertion to require the public 0.1 minor rather than the obsolete 0.1.5 patch; contract mail tests then passed 38/38. Mail remains unavailable in production. |
| P2 identical memory page with later recording timestamp was refused as replay | **Fixed** | `1ba828bd8` accepts only later timestamp drift for otherwise identical retained records, preserving the first durable row. Backdated, expiry and content changes still refuse. Journal/migration 17/17 and gateway 68/68 passed. |
| P2 selected task required structured output without requesting it from the SDK | **Fixed** | `0878dc48e` supplies pinned JSON schema output format for both admitted original compilers and refuses unknown originals before native RPC. The actual activity query option is asserted; focused selected/next-turn tests passed 6/6. The separate existing selected MCP read test remains 16/17 and reproduced against the unfixed base. |
| P2 XLSX read defaulted to Word for `{versionId}` | **Fixed** | `4d4efd3c5` selects the descriptor from canonical publication- and retention-gated immutable version metadata, checking version, actor, tenant, conversation, scopes, spec hash, MIME and filename. It preserves the public body, refuses unavailable/mismatched records and release during lookup. Artifact owner checks passed 21/21; the required authority ports are not yet composed by the current CLI, so this is source evidence only. |
| Suppression committed after the last service-level retention check | **Current architectural hold** | A cross-owner atomic serving fence is still needed for absolute commit-order guarantees. The reproduced mid-Core leak above is fixed; no live retention availability is claimed. |

The combined changed-area run on this receiving tree passed 150/150 conversation-control, 159/159 gateway, 27/27 runtime and 38/38 mail-contract tests. All 20 changed `.mjs` files passed Node syntax checks, and `git diff --check d185b610 HEAD` passed. This was a focused 374-test run, not a repeat of the broad 4,353-test suite. Retained capabilities, mail, selected output and XLSX reads were exercised with source/synthetic fixtures only; their live routing and image/config qualification remain held.

### Main-merge and release holds

The checked `main`, broader, PR175 and PR177 trees have no tracked CI workflows; GitHub reports zero Actions workflows and deployments. The branch-protection and repository-webhook reads returned HTTP 403, so external automatic build/deploy triggers and implicit traffic activation on `main` merge remain **unverified**. The deployment owner must check them before any main merge. The deployment packet remains draft and requires fresh source-bound Linux image/config/readback, migration and live qualification. This receiving PR is a next source-integration review, not the PR175 first-chat shipping pin.
