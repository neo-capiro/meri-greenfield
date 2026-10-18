# Combined Meri source handoff — 18 October 2026

Status: source composition only. The release, first chat, image and deployment
holds remain active. This branch does not merge PR175 or main, apply migrations,
change credentials/IAM/network/live SQL, or cut accepted product scope.

## Exact received source

The branch `dot/meri-release-combined-20261018` starts at draft PR186
`4d82147624cba329ffc5ade1bb027838a4e37474` (stacked directly on PR180
`a1876afaeaa59d9da47729487d490cba8cfc9d9c`). It then cherry-picks,
without conflicts, the complete descendants of these sibling source heads:

| Source | Exact original head | Received scope |
| --- | --- | --- |
| Draft PR181 | `139e0a145d0b0d8d8d5161b048a8e50643856c1b` | Whole-response retention fence, held-lease watermark and scheduled custody reads |
| Draft PR183 | `b51687d4dadbb8cbf8ee817490e5f95c01e60d54` | Validated native usage with optional Bedrock terminal metrics |
| Draft PR185 | `67a7bfbc7df47f326e4287de8df7f0f59b110b8c` | Control CA source and first-chat SDK model alias |

PR186's code paths have no direct file overlap with these three source branches.
The eight cherry-picked commits after PR186 passed `git diff --check`; no merge
conflict or manual content resolution occurred. PR186's separate published
evidence records 4,391/4,391 standard tests, 20/20 focused worker tests and
zero runtime/control TypeScript diagnostics on its exact code tree
`859f84abf40d0ed565088b621f5c26a6f824877d`. Those counts do not qualify
this combined tree, and PR186 source acceptance is now **HOLD** for the date
regression below. PR186's retained scrubbed evidence files contain trailing
whitespace, so a full PR186 diff whitespace check reports notices even though
its code-path check passes.

PR181's final focused Linux run passed 128/128 history, schedule, retention and
public-contract tests, including capacity-one composition with absent and
positive scheduled custody. Its bounded pool is scripted, not real PostgreSQL.
PR183's focused source checks passed 62/62 with a LiteLLM app stub. PR185's
focused Linux CA, renderer, SDK alias and native authorization checks passed;
its local diagnostic container completed material initialization, but its
fresh-process readback probe stopped in a DNS fixture. The constituent source
receipts contain the exact commands and results. No test suite or native image
build has run on this combined tree at this handoff.

## Remaining receiving work

- Independent PR186 review found a regression in
  `packages/contracts/retrieval-0.2/public-domain-query-validation.mjs:14–28`:
  explicit legacy offsets can be treated as unzoned. On Node 24.19 across
  UTC, Toronto and Tokyo, `January 1, 2020 12:30 PM -0500` yielded 12:30Z
  instead of 17:30Z; `Jan 1 12:30:00 -0500 2020` and AM with +0530 also
  mis-normalize. Public schema admits these strings. The source owner has the
  minimal repair and three-timezone regression; do not accept PR186 or this
  combined tree until that fix is received and checked. No repair is made here.
- Four inherited retention/history fixture failures from PR186 remain:
  `postgres-watermark.test.mjs:50` lacks `journal.withTransition` in its inner
  synthetic fixture; three `startup-history.test.mjs` cases return 503 because
  the fixture omits `conversationCurrentness` (expected 200, 409, 200). The
  dedicated stop worktree has no source edits or commit.
- A Core-owned whole-page batch authorization decision is still required for
  history release. The pool fix does not make independent Core writes atomic
  with Meri's response fence.
- Source image lane `dot/meri-image-deps-20261018` remains separate at
  `d2f054362521f622b9dd63c65ef5eaa3bdde8d5a`. Live ECS PR121 readback
  identifies Linux/amd64. The exact checked-in Dockerfile build stopped on
  local Docker vfs ENOSPC; a layer-grouped local diagnostic built and checked
  the pinned APK/wheel set and document generation. Frozen 15 October image
  closure has 21/45 stale hashes and must be re-pinned against final source.
- PR98 frontend remains separate. N21 model measurement is stale. Actual
  Sonnet 4.6 stream/cache billing, product image, live PostgreSQL contention,
  authenticated first chat and deployment remain unqualified. PR175 remains
  unchanged at `993f52a97e5d9edcf65c9f89423c097aa52831c7`.

The receiving agent should inspect exact ancestry, repair the four fixtures
without weakening assertions, re-run focused composition and required final
gates on its eventual final source, then return exact source/image/config
pins and evidence to dot. No main merge or deployment is authorized here.
