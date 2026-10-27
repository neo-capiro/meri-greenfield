# Meri Fable closeout — 27 October 2026

Author integration and regression evidence only. Hermes owns independent review and acceptance; root and Release own merge and deployment.

## Source and scope

Branch: `codex/w4-fable-meri-closeout-20261027`. Fresh GitHub main `d4c37cb06b3d845fbf1f94dbc083cf53ecc15bb7` merged with Fable `e69ea5603da8a3598114db27927739ac49b65c72` (product `61e9574ebe59a91e552cb9356be75112892bdfd7`) at local merge `115f04a6914bff835ca18c3bef44ed0210430978`. Wave 5 draft changes were not pulled into this cohort. No Core/frontend changes, migration, live configuration, target data, service, SDK/model policy or credential changes were made here.

## Finding dispositions

| Finding | Verified behavior and change |
| --- | --- |
| SQ2 | Private `client_records` SQL could use an injected `readSource`. It now refuses before that source or Core can run. Public read behavior is unchanged. |
| AC1 | Legislative approval lost the owner's effect certainty. A proven pre-send refusal remains `NOT_DISPATCHED`; a possibly sent decision remains `UNKNOWN`. |
| AC3 | Expired replay previously refused before consulting durable state. It now reads existing decision/effect owners only. Completed effects can be recovered; missing or uncertain evidence remains uncertain. No new decision or effect is dispatched after expiry. Current principal, scope and exact proposal checks still run first. |
| AC4 | LegiWatch, client records, business development and watch approval now preserve `effect:none`/access refusal instead of reporting every failure as an unknown sent decision. The same mapping is shared with legislative, sharing and Research Portfolio approval. |
| RT1 | Workspace retention now runs in its own `finally`, even if skill or SDK session cleanup throws. The failed run's bytes remain available beside the empty workspace, and cleanup failure is still reported. |
| RT2 | The artificial 1,000-directory ceiling now falls back to standard exclusive temporary-directory allocation. Existing retained bytes are never overwritten or deleted. Retention without pruning is deliberate preservation policy, not a newly invented TTL subsystem; it does not grant access to another scoped session. |
| RT3 | Terminal timeout classification now follows the terminal reason. A recovered historical Core 503 remains in Core counters and does not relabel an unrelated terminal failure. |
| MO05 management reads | Fifteen canonical pure management actions use the existing trusted Core tool endpoint before `journal.begin`, with current scope/result-release checks. No approval proposal, intent-history row, or write receipt is created. Writes and persisted `rule_preview` retain confirmation. Unknown actions cannot enter the read path. Mixed-tool `readOnlyHint` stays false. |

Read-only actions: `grants_list`, `client_links_list`, `members_list`, `annual_review_get`, `subscriptions_list`, `deliveries_list`, `watch_conversion_preview`, `output_get`, `snapshots_list`, `snapshot_get`, `taxonomy_get`, `templates_list`, `template_version_get`, `comparison_list`, `comparison_get`. Native results retain their domain DTO fields under action-specific allowlists and bounded JSON; they are not converted into write receipts. The canonical management output distinguishes a read result from an immutable approval proposal. Read requests cannot be bound into approval proposals.

Fable's seven workflow reads, ten management/action capabilities, sharing envelope fix, and delivery-derived operation keys remain integrated. The author's earlier 33 scan findings are not globally accepted by this Meri-only document; other finding owners report separately. Root resolved missing historical definitions using the recovered 70-row register, full section 16 and MO05. Q07 remains skipped.

## Author checks

- Focused combined batch: **174/174 passed**, covering approval domains, private SQL, telemetry, MO05 contracts/workflow, immutable skill pins and the generated public intent receiver.
- After final management input/output schema correction and regeneration: **97/97 passed** across `research-action.test.mjs`, `retrieval-research-portfolio-workflow.test.mjs`, `intents-application-public.test.mjs` and `additive-catalog-pins.test.mjs`.
- Runtime cleanup: **10/10 passed** in `native-files-runner.test.mjs`, including separate skill-close and session-close failures, with existing Windows portability seams. `assembled Objective` was excluded after it failed before runner setup at unchanged `createObjectiveSelectionOwner` fixture storage configuration; it is not represented as passing.
- Native Linux retention rollover: **1/1 passed** on cached `node:24-bookworm-slim` / Node 24.22.1, network disabled, source/dependencies mounted read-only, and an isolated writable `/tmp`. The test creates all 1,000 numbered retained directories and verifies prior evidence and new bytes survive.
- Full contracts build and `check:generated`: **passed**. Intents/routines generated public TypeScript consumers: **passed**. `git diff --check`: **passed**.
- No inherited thousand-failure suite, live acceptance or AWS qualification was run. No generated-output workaround was added: existing exact dependency installations were joined into this owned checkout; shared installations were not modified.

## Packages and rollout requirements

Root reserved the shared contract/catalog paths for this author. Preserve Fable's unpublished cohort versions: contracts **0.1.21**, UI stream **0.1.8**, catalog **0.2.23**. Final archive names/hashes and the frozen source commit are delivered to root and the frontend author separately; the old Fable archives must not be presented as the final changed contracts. UI stream dist is unchanged and its peer admits contracts 0.1.20 or 0.1.21. Generated intent schemas/types/receiver and catalog/skill provenance are regenerated from this integrated source.

Release must activate the existing Core `RESEARCH_PORTFOLIO_MERI_TOOLS_ENABLED` flag and required existing tool-registry entries under the release plan. The previously deployed catalog 0.2.22 cannot admit this cohort's formerly deferred 17 MO05 capabilities. Install the frozen 0.2.23 catalog with a fresh native installation receipt bound to its exact canonical hash and current enabled operations; do not reuse an old catalog receipt or widen an in-flight session. The skills `installationCatalogSha256` is repinned; immutable existing skill pins remain preserved. Deploy the matching Core management classifier and Meri image, then the frontend consuming the frozen packages. No new database migration is introduced by this Meri cohort.

Hermes review should concentrate on uncertain-write recovery after expiry, pure-read classification versus persisted previews, current client/tenant checks, bounded native DTO release, and retained-workspace preservation. Formal deployed acceptance remains with Hermes after root/Release deploy the exact reviewed heads.
