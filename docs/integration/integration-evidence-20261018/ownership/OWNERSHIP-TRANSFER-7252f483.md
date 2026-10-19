> Historical ownership receipt at its stated time. Subsequent PR187 publication/receipt is recorded in the main integration report; Shipping51 is no longer unpublished.

# Accepted Meri source handoff receipt

Read-only review at `2026-10-18T22:46:38.721437+00:00`. This supersedes the ownership and missing-Core observations in the earlier [snapshot](OWNERSHIP-ANCESTRY.md). No repository source, branch or external comment was changed by this lane; no tests, build, install, provider or live operation ran.

| Pin | Commit | Tree |
|---|---|---|
| Accepted published handoff | `7252f483c59cd676e868e40d4bf73c2ca55c137f` | `1a9dfbd00d94eb6a4bfe794b1ee435c4b66e639c` |
| Receiving source before handoff | `60829243203b9e94c4b12b8e575f375cb27f6c9b` | `f50b0d8585ee073ca507002390897315f486dc20` |
| Actual two-parent handoff merge | `334a5545c72f5d80ed82e5c46dd748269f9c3049` | `cfd67eaa2d41c07af20b9d79d20456be4f7390a5` |
| Separate later fixture follow-up | `8c587b491197bc6d0e22117d3acb6d714cb1375e` | `bd13e7108619c7423bf0cee89aa2a589623af751` |

The handoff branch is `dot/meri-release-combined-20261018`; GitHub resolves the accepted commit and branch name. The common ancestor of handoff 725 and receiving 608 is PR186 `4d82147624cba329ffc5ade1bb027838a4e37474`. Actual merge 334 has ordered parents 608 and 725. Its **only** first-parent delta is `docs/integration/COMBINED-SOURCE-HANDOFF-20261018.md`; the incoming and merged document blob is `a81fbc91d57e265e2fea81428625dee8970a6e40`. No production change or duplicate repair patch was applied by receiving this handoff.

## Exact source comparison

| Source | Paths checked against original a187-based head | Result at608 versus725 |
|---|---:|---|
| PR181 `139e0a145d0b0d8d8d5161b048a8e50643856c1b` |17|All Git blobs equal, including receipt and history metadata|
| PR183 `b51687d4dadbb8cbf8ee817490e5f95c01e60d54` |5|All Git blobs equal|
| PR185 `67a7bfbc7df47f326e4287de8df7f0f59b110b8c` |25|All Git blobs equal, including CA/model receipts|

All 47 shared source/evidence paths match exactly. PR185 already includes original 182/184 patches; receiving those originals again would duplicate source. Incoming725 differs from receiving 608 in 122 paths: the incoming handoff document plus 121 receiving-only paths comprising 60 complete executor dependency closure paths, 1 capacity-one concurrent history test and 60 date-offset/evidence paths. All receiving additions survived merge 334. The full d2 closure was received as `ea28788b6`, `2611c9baa`, `3e9676266`; it was not reduced to the final architecture guard. Date successor `665405cd23680c2c40d4df95fe183799d272fc61` was already included before this handoff. Later 8c changes only the two inherited fixtures `apps/control/retention/test/postgres-watermark.test.mjs` and `apps/runtime/test/startup-history.test.mjs`; those changes are separate from the handoff.

## Superseding ownership and qualification status

| Area | Current receipt |
|---|---|
| Ownership | User accepted published 725 source handoff. Earlier no-ack observation is historical for the received source. Root owns Meri source integration; dot retains Portfolio/Modules; operator-only work stays with the authorized shipping operator. |
| Core history | **Published and unmounted** at [78ceaf9](https://github.com/neo-capiro/capiro-backend/commit/78ceaf9bdfe00c8f013aac15eb8483312ae4f803), full SHA `78ceaf9bdfe00c8f013aac15eb8483312ae4f803`. Source batch composition exists. Production native identity owner, same-transaction original provenance lock and new online Clerk observation are absent; no route uses the port. Source doc requires Neo approval before middleware edits. Special-scope owners and Meri final response/cursor receipt integration remain dependencies. The doc's old 181 a50 pin is historical; received 181 is 139. |
| Shipping51 | `51f4a38e2e43d6ff050db08e3235b2b447b708cf` remains preserved jumpbox source per latest relay. Source-only draft publication was requested; no exact published receipt has been supplied to this lane. It is not contained in this handoff merge. Do not infer source loss. |
| Image source and qualification | Full dependency closure is received. Handoff records local exact-Dockerfile build failure from Docker vfs ENOSPC **and** successful layer-grouped diagnostic package/document generation checks. That diagnostic does not qualify the exact product Dockerfile/image. Prior broad no-package-install wording is superseded. Final canonical closure and model alias/options measurements must use final source; handoff's Oct 15 21/45 stale hashes are historical reported evidence. |
| Date and fixtures | Handoff725's date hold describes its own source; receiving 608 already includes corrected offsets/effective-timezone evidence 665. The later root fixture commit is 8c. Combined final gates must be attributed to their final pin; original PR186 4391/4391 and 20/20 counts do not qualify this combined tree. |
| Operator state | Latest relay says CodexSandboxOffline, network off and AWS profile unavailable. No fresh live state or deployment is established. Source is preserved; credential deletion is not established. Prior ECS linux/amd64 observation remains historical evidence. |

Deployment/chat hold remains active. No PR175, PR98, Portfolio/Modules, migration, credential, AWS or other live change occurred in the handoff merge: its delta is the document alone. This proof concerns source composition, not live state.

Detailed blobs, 121 receiving additions and pin assertions are in [JSON](OWNERSHIP-TRANSFER-7252f483.json). Published source readbacks: [Meri725](published-7252f483-readback.json), [Core 78 and its exact owner document](core-78ceaf9-source-readback.json). All commands are recorded in JSON; no suite was rerun for this review.
