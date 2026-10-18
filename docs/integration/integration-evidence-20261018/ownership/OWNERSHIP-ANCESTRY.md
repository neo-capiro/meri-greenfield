# Meri ownership and ancestry receipt

> Superseded for current ownership, Core publication, image diagnostic and operator status by [accepted725 handoff receipt](OWNERSHIP-TRANSFER-7252f483.md). The content below is the historical22:17 snapshot.

Read-only GitHub and source readback: `2026-10-18T22:17:09.865Z`. No source edits, branch updates, comments, merges, deployments or live operations were made by this lane. The root session’s separate transfer request is [PR181 comment6255812843](https://github.com/neo-capiro/meri-greenfield/pull/181#issuecomment-6255812843). No acknowledgement was present in the inspected timeline.

## Current exact requested heads

| PR | Head / branch | Base | Status |
|---|---|---|---|
| [180](https://github.com/neo-capiro/meri-greenfield/pull/180) | `a1876afaeaa59d9da47729487d490cba8cfc9d9c`<br>`fix/audit-nine-20261018` | `141f2ada6378382f2bf7462d8a2c5dc7758230d0` | Open draft |
| [186](https://github.com/neo-capiro/meri-greenfield/pull/186) | `4d82147624cba329ffc5ade1bb027838a4e37474`<br>`fix/remaining-audit-failures-20261018` | `a1876afaeaa59d9da47729487d490cba8cfc9d9c` | Open draft |
| [181](https://github.com/neo-capiro/meri-greenfield/pull/181) | `139e0a145d0b0d8d8d5161b048a8e50643856c1b`<br>`dot/meri-fence-pool-20261018` | `a1876afaeaa59d9da47729487d490cba8cfc9d9c` | Open draft |
| [183](https://github.com/neo-capiro/meri-greenfield/pull/183) | `b51687d4dadbb8cbf8ee817490e5f95c01e60d54`<br>`dot/meri-native-usage-20261018` | `a1876afaeaa59d9da47729487d490cba8cfc9d9c` | Open draft |
| [185](https://github.com/neo-capiro/meri-greenfield/pull/185) | `67a7bfbc7df47f326e4287de8df7f0f59b110b8c`<br>`dot/meri-ca-model-receive-20261018` | `a1876afaeaa59d9da47729487d490cba8cfc9d9c` | Open draft |
| [182](https://github.com/neo-capiro/meri-greenfield/pull/182) | `58b13b1644726bb307ea3e58461c7c0a970215f9`<br>`dot/control-ca-trust-20261018` | `993f52a97e5d9edcf65c9f89423c097aa52831c7` | Open draft |

PR175 remains `993f52a97e5d9edcf65c9f89423c097aa52831c7`; the broader receiving parent is PR179 `141f2ada6378382f2bf7462d8a2c5dc7758230d0`. PR181’s exact current head is `139e0a14`, not the superseded first correction `a50ce248`.

## Confirmed ancestry and duplication boundaries

- PR186, PR181, PR183 and PR185 are **four siblings** whose common base is PR180 `a1876afa`. They are not a cumulative stack. All six pairwise changed-file intersections are empty; semantic/runtime integration remains to be qualified.
- PR185 receives original PR182 `58b13b16` as `8753a2fb6b7785866049c9d5bf387b46e5c964d9`, stable patch ID `92e22cba953b36673d333ad5a708de7c16fdaa6e`.
- PR185 receives original PR184 `6be3e4ab` as `2bc282d89189796e40fee386bf8f620ed62e5a37`, stable patch ID `ecb49044456c5b8e08615598059210692be7a7c3`. Both original/received patch IDs match exactly. **Receive185 once; do not add182/184 again.**
- PR175 is the original ancestor of182/178; PR180’s first-chat source was replayed through179 with different SHAs, documented in `MAIN-RECEIVING-SOURCE-20261018.md`. Preserve the frozen175branch.

## Transfer and source blockers

| ID | Status | Finding |
|---|---|---|
| OWN-1 | awaiting explicit receipt | No safe-stop/transfer acknowledgement exists in the inspected comments. The new root transfer request is published on PR181; remote metadata cannot establish that another workspace has no dirty/untracked source, unpublished commits or active workers. |
| SRC-1 | confirmed missing source | Shipping source commit 51f4a38e2e43d6ff050db08e3235b2b447b708cf is absent from this shared Git object database and the accessible GitHub repository returns422 No commit found. Export/publish its exact commit/tree/parents before integrating injected-fetch/kickoff diagnostics. |
| ANC-1 | confirmed | PR186, PR181, PR183 and PR185 are four sibling successors of exact a1876afa. None contains another. Every pair has a1876afa as merge base and empty changed-file intersection. This proves clean file ownership, not semantic integration or release acceptance. |
| ANC-2 | confirmed | PR185 already receives PR182 and PR184 by exact stable patch-ID cherry-picks. Do not also receive either original branch alongside185. Original commit SHAs are not ancestors of185. |
| SRC-2 | published successor | PR181 now points at139e0a14, supersedinga50ce248. The second correction lends the held session to both schedule-custody currentness reads, including absent-custody Core fallback; final comment reports128/128focused. The published source still requires separate whole-page Core batch authorization. |
| SRC-3 | published but not integrated | PR178ba701529 contains the unmounted adoption owner/0020source and three committed unapplied receiving proposals. PR179comments still request acceptance/context/issuer/budget ownership. Older receiving docs call it unpublished; remote178proves that wording historical. Do not treat unapplied proposal source as mounted product behavior. |
| SRC-4 | confirmed missing closure in requested base | d2f05436 resolves to fullSHA d2f054362521f622b9dd63c65ef5eaa3bdde8d5a. Authoritative GitHub comparison diverges froma187, mergebase21862a5e7c557f9089b245d0e2685b91420ef128, ahead3/behind139. The branch includes executor dependency closure31d8de37, WIP build/smoke94b69264 and architecture verificationd2f05436;60changedfiles. Last commit alone is not the complete document dependency receipt. |
| QUAL-1 | held | PR185 is source receipt only: combined image not built/qualified, N21 measurement stale, physical material VersionIds/live trust unproven. d2 predecessor94b69264 explicitly records no completed image build or Linux image generation smoke. Shipping operator must qualify the exact combined linux-amd64 image; no live mutation belongs to this lane. |
| QUAL-2 | held | PR183latestb516 allows optional validated Bedrock stop metrics; its unchanged title says Require metrics. Read latest source/body rather than infer mandatory metrics. Exact live Sonnet raw stream/cache/billing and provider behavior remain unqualified. |

The absence of a published successor or comment is not proof that an external workspace is clean. Before overlapping edits, obtain the receipt requested by the root session:

1. Exact final published heads for every Meri source lane and whether successors remain local.
2. Dirty/untracked files and unpublished commits/patches from each writer workspace, preserving ancestry/tree and file hashes.
3. Safe-stop acknowledgement and inventory of active workers still writing Meri files.
4. Exact shipping51f4a38e source export/publication and d2document closure/image/config/rollback handoff.
5. Current Core batch-history authority owner branch, contract and unpublished implementation; avoid duplicate Core implementation.
6. Explicit ongoing split: receiving session owns Meri source integration after transfer; dot retains Portfolio/Modules; existing shipping session alone owns AWS operations.

## Document dependency source pin

`d2f054362521f622b9dd63c65ef5eaa3bdde8d5a` is published and resolves. The exact three-commit source closure above common base `21862a5e7c557f9089b245d0e2685b91420ef128` is:

1. `31d8de37630d674b7f30a12323d216db68ec9298` — executor dependencies: Python3.13, Pillow/lxml/matplotlib/numpy/openblas, pinned wheels and PptxGenJS.
2. `94b692648c47fd509e62a621cc5b612e0d356ed3` — WIP handover and in-image smoke; commit explicitly records failed/uncompleted Docker build.
3. `d2f054362521f622b9dd63c65ef5eaa3bdde8d5a` — installed package architecture check and regression.

GitHub compare reports `diverged`, ahead3/behind139 versusa187,60changedfiles. Currenta187 lacks the closure’s128MiB archive bound and installed APK `A:x86_64` validation. The local clone is shallow; the server comparison supplies the authoritative common ancestor. No integration or image build was attempted here.

## Recent open source lanes

Searched all open PRs created2026-10-18 (31matches, limit100, not truncated), and inspected the100most-recent open-PR metadata list. Detailed bodies and current refs are retained in [recent-open-prs.json](recent-open-prs.json). Relevant older handoff comments on157/175/178/179/184/174 are retained in [github-retrieval.json](github-retrieval.json).

| PR | Current head | Topic |
|---|---|---|
| [181](https://github.com/neo-capiro/meri-greenfield/pull/181) | `139e0a145d0b0d8d8d5161b048a8e50643856c1b` | Use held retention lease for fenced history reads |
| [186](https://github.com/neo-capiro/meri-greenfield/pull/186) | `4d82147624cba329ffc5ade1bb027838a4e37474` | Resolve remaining Meri audit failures and worker type errors |
| [185](https://github.com/neo-capiro/meri-greenfield/pull/185) | `67a7bfbc7df47f326e4287de8df7f0f59b110b8c` | Receive control CA trust and model alias source |
| [183](https://github.com/neo-capiro/meri-greenfield/pull/183) | `b51687d4dadbb8cbf8ee817490e5f95c01e60d54` | Require Bedrock terminal metrics for native usage settlement |
| [180](https://github.com/neo-capiro/meri-greenfield/pull/180) | `a1876afaeaa59d9da47729487d490cba8cfc9d9c` | Fence history responses and close audit continuation gaps |
| [184](https://github.com/neo-capiro/meri-greenfield/pull/184) | `6be3e4abccebb5da56092572ccb0feddaf514d0e` | Align first-chat SDK model with authorized proxy alias |
| [182](https://github.com/neo-capiro/meri-greenfield/pull/182) | `58b13b1644726bb307ea3e58461c7c0a970215f9` | Preserve RDS trust for control private origin |
| [178](https://github.com/neo-capiro/meri-greenfield/pull/178) | `ba701529fba72bf48af41e83cd90d76287ffd94e` | Prepare atomic conversation configuration adoption |
| [179](https://github.com/neo-capiro/meri-greenfield/pull/179) | `141f2ada6378382f2bf7462d8a2c5dc7758230d0` | Receive Meri first-chat and retained source stacks |
| [177](https://github.com/neo-capiro/meri-greenfield/pull/177) | `c200b03ffda2218ef80f963d8c205627b863dc07` | Consume conversation retention rows in planner |
| [176](https://github.com/neo-capiro/meri-greenfield/pull/176) | `9e5d8097f8f67a19418b57672a9672ddd73cb00e` | Conversation-owned retention inventory snapshot |
| [175](https://github.com/neo-capiro/meri-greenfield/pull/175) | `993f52a97e5d9edcf65c9f89423c097aa52831c7` | First-chat startup, proxy envelope and Stop source repairs |
| [174](https://github.com/neo-capiro/meri-greenfield/pull/174) | `1e92094a1dedc398a75acd8f8a99024d2a90dd34` | Bind durable memory proposal continuation |
| [171](https://github.com/neo-capiro/meri-greenfield/pull/171) | `d117a7d4d6de94f25943d54c0b15d82c891b9b96` | Compose task-bound retained action and local read ports |
| [173](https://github.com/neo-capiro/meri-greenfield/pull/173) | `b1a6aea0a56c517e28e066c478ffc5b6b97f5b5c` | Select profile 0.3 in preview allocation |
| [172](https://github.com/neo-capiro/meri-greenfield/pull/172) | `432006eb2b1d87af8c73e11d4222be2a5930952b` | Prepare signed memory source transports |
| [164](https://github.com/neo-capiro/meri-greenfield/pull/164) | `1e35c1c3581246c21d5b0e56f96517840cad07ca` | Compose reviewed retained read subset and signed source ports |
| [170](https://github.com/neo-capiro/meri-greenfield/pull/170) | `2ee946e8d3e7f523a125222eb3c943389d5f7ebb` | Bind actions.query to signed task source alias |
| [169](https://github.com/neo-capiro/meri-greenfield/pull/169) | `061cc1caea493dbe4e86b95549e74dd287ff57e0` | Bind historical action read to delegated tool token |
| [168](https://github.com/neo-capiro/meri-greenfield/pull/168) | `22c3b3e8c5a0ed74d73b7c6f461d7dd5bbc15034` | Bind Florida retained receipt to selected client |
| [166](https://github.com/neo-capiro/meri-greenfield/pull/166) | `15288a7954862e348af86bf1eab119fdb30863a0` | Bind A8 client selectors to exact Core tool bodies |
| [167](https://github.com/neo-capiro/meri-greenfield/pull/167) | `2c53e6c5123d392308d84a74eb8da2e5741f5dc1` | Prepare selected action and dataset retained ports |
| [165](https://github.com/neo-capiro/meri-greenfield/pull/165) | `e2d62589742fd349907274e5ee325e39059f14f4` | Propose bounded approval metadata facts for Core |
| [157](https://github.com/neo-capiro/meri-greenfield/pull/157) | `ab83ee97e9cb88b4727291284da9e2485157c309` | Integrate Meri RD, routines and measured reads |
| [163](https://github.com/neo-capiro/meri-greenfield/pull/163) | `3cd89f4be3b3d2e348a2f5ba2c6ee3568b07ce60` | Relay retained Core reads with task-bound tool tokens |
| [161](https://github.com/neo-capiro/meri-greenfield/pull/161) | `f4cf0385471d9c57fbe7c537e3f352a0378ece24` | Receive versioned profile read window |
| [162](https://github.com/neo-capiro/meri-greenfield/pull/162) | `dee9ac55546d9a59dc6bba79cd4fc2cbba869000` | Prepare text-only document read tariff |
| [160](https://github.com/neo-capiro/meri-greenfield/pull/160) | `0114f1a97ff9ca0f7b90ec281b557d0d24c1d225` | Version get_client_context owner read window |
| [158](https://github.com/neo-capiro/meri-greenfield/pull/158) | `cdc1c04342da022117401284b4e6bbac032ef84d` | Wire task-bound retained Core source ports |
| [159](https://github.com/neo-capiro/meri-greenfield/pull/159) | `cdb5c2e7628315348af46a15f71237e16e944549` | A8 native read adapter source hardening |
| [145](https://github.com/neo-capiro/meri-greenfield/pull/145) | `22057077f0445e0661f8167721e9c8584b26a083` | Meri runtime unified integration (2026-10-18) |

## Historical wording requiring care

`RUNNER-RUNTIME-DIAGNOSTICS-20261018.md` ends with “unpublished”, but that file was committed into published PR179 `141f2ada`; the wording is stale, not evidence of current unpublished diagnostics. Likewise `MAIN-RECEIVING-SOURCE-20261018.md` calls178unpublished while current178is now published with explicitly unapplied review patches. PR180’s older184comment says58b13b1could not resolve; it now resolves as published182 and is received by185. Keep publication/source status separate from mounted behavior and live qualification.

Evidence: [current head readback](final-head-readback.json), [ancestry and patch IDs](ancestry.json), [additional source/API responses](additional-source-readback.json), [latest181comments](pr181-latest-comments.json), and [full receipt](OWNERSHIP-ANCESTRY.json).
