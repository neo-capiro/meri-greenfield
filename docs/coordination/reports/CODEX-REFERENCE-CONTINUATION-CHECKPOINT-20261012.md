# Meri selected capability continuation checkpoint

This checkpoint responds to the 17:37 UTC disconnect report. The executor answered read-only checks at 17:38:36 UTC and remains available. No capability work is blocked by that notification. This is a preserved intermediate handoff, not completion of the rebuild or runtime acceptance.

## Published integrations

PR28, <https://github.com/neo-capiro/meri-greenfield/pull/28>, is OPEN/DRAFT and unmerged at `a3e946c1fa264ae7b33205f5b87804ee1ef75773`. Source freeze `4566cef6417428d46274a14f7937ca11df66ae9d`, tree `bd830c104bc911d9aedd9a1059204b62b0f715a5`; independent integration review `3c24f2d2b14b75075cfe2aab5e057f9a8c1d9844`; packet freeze `780607f7775969340966912b1657473a16c91e9c`. Its 394-member manifest SHA256 is `be7b7b05910666664885e9c22dafcf9489a0fe20a1da7ee53cf6c10d6e11e819`.

PR28 adds nine selected read boundaries across disclosures, acquisition personnel and federal bill/status/vote/text reads. Root expanded source tests passed 1666/1666. Separate independent connected controls passed 86/86, including unavailable responses and zero inner effects for all 46 typed gateway operations. Preservation audits passed 319/319 root and 193/193 plus 61/61 independent. Public tests passed 7/7, and generated/type checks passed. The independent reviewer verified the exact root broad receipt rather than rerunning that suite. Raw failures, repairs and process exit evidence are retained.

Catalog 0.2.6 remains canonical: **139 original capabilities; 96 selected, 43 deferred; 45 mapped unavailable and 51 pending; 46 typed unavailable operations**. The extra typed operation is a partial action-item boundary and does not silently add a mapped original capability. Public 0.1 and private 0.2 remain separate. Prior descriptors and original disposition/boundary text are preserved.

PR26, <https://github.com/neo-capiro/meri-greenfield/pull/26>, is OPEN/DRAFT and unmerged at `2aa0a33bdaf36af1224cfdb840bc493e53cea9f3`. It added sixteen prior selected reads, with source freeze `4280ebaba4cab554baf7e6b23175c34d21027097`, independent review `a896b3e0edfa0e5971e166fea483fd51402bf641`, and packet freeze `a3205cc892591d657bcb2a33a7575aced42c73b0`. Root 1304/1304, independent 1366/1366, original-source audit 5458/5458 and public 7/7 plus generation/types passed. Its 478-member manifest SHA256 is `491977a7d9ae6f5caad3a7b53733d25b77f925684f1e56fb23d6130c5584e60d`.

PR28 is stacked on PR26, which is stacked on PR24. No main merge occurred. Main was last verified at `8b123bea4c90794dc2d766814b6ddbdbfe0928bc`; RC1 tag object `b157217e69d36da1b53fa5944a0781a2f53a2f79`, peeled `2f06feccca731d6cd388612cd568185ecc29668f`, remained unchanged at publication. Original preservation/accepted/evidence-only PRs and original PR2 ancestry are retained; do not duplicate PR2 integration.

## Ten source-accepted capabilities awaiting integration

All six families below now have independent **ACCEPT_SOURCE** for their exact pre-registry source. They are not yet integrated into the canonical registry and do not change the published ledger above. Full SHA identities, author packets, branches and review-only commit history are in `reference-checkpoint/candidate-freezes.json`.

| Family | Capabilities | Source | Author packet | Independent review | Independent source tests |
| --- | ---: | --- | --- | --- | ---: |
| Legislative directory | 2 | c511b4bf6ee3 | 62a9f7e3c71d | 7f287767e15b | 34/34 |
| PE references | 3 | c9770ef235ae | 3348a42ff427 | e79a7ca4abaf | 32/32 |
| Rule status | 1 | 95442b40d006 | 86c701c87f36 | b3670edb527a | 40/40 |
| Certification status | 1 | fa59df3739a2 | 1142bbd7dabd | 498f3ef3b6df | 27/27 |
| Stored intelligence and dataset metadata | 2 | 450d48fc158d | 7761e705a594 | 720098fb1b99 | 60/60 |
| Facility representation | 1 | 530416e49076 | 417e9942bd3e | f041eed2e46b | 27/27 |

Facility source remains `530416e490763155c5531140f4b70e95a9493b7b`, tree `b0b9210fabbb06422a912562dde257b8e54fa01b`. Root author checks passed 22/22, 6001 original blobs remained identical, and nine paired references were verified. Independent tests passed 27/27, full source 1339/1339, public 7/7 plus generation/types, and source audit 93/93. No source repair was requested. Author packet has ten manifest members, SHA256 `60322fa07832f9cc5696a299721909169a02018075287eb081c6fa158457f67e`; reviewer packet has 24 members, SHA256 `a41c8f09f59542be09ab4db481853acd137a372c9b8d1503ea1cfebffd9adbe6`. Final author metadata verification passed 53/53 at separate review-only commit `f9b4dbcbbce74565aba852f6d529d006b948653f`, without broad/source/runtime reruns. The follow-up six-member manifest SHA256 is `c13b9cbcccd255320e1d94c994fcee7e302bf46c142a6888f250efbbe8ad47fb`; the original source verdict and review manifest remain unchanged.

Stored-reference source has independent 60/60 behavior, 33/33 reference and 65/65 source/packet checks. Reviewer freeze `720098fb1b99a5fd15c602940f3621ab0aace68f` has a 20-member manifest, SHA256 `ea69808f6554e070516fa3e9ae182f8fafb9b7082f4ca2de18541afe16aa40af`. Author 31/31, full 1321/1321 and public 7/7 receipts were byte-audited. Reviewer checker failures and interrupted audit evidence are preserved. No production defect was found.

These families retain explicit limitations: facility DTO lineage does not establish current authorization or federal geographic joins; certification requires a trusted supported `comparisonLocale`; rule stage/comment computations require separate trusted `stageAsOf` and `commentAsOf` anchors. Directory and PE boundaries preserve source projection/fallback semantics. Stored intelligence and metadata do not authorize source rows, queries or freshness. Reports record intentional restrictions and all raw failures; no private source body was published.

## Next integration outline and ownership

Root exclusively owns `/workspace/meri-reference-reads-20261012`, branch `task/meri-reference-reads-20261012`, based on PR28 receipt `a3e946c1fa264ae7b33205f5b87804ee1ef75773`. Only checkpoint documentation is added so far. No domain source, catalog or loader change has begun. Complete the following within the existing source-only authority:

1. Preserve author and reviewer branches and import only the six exact accepted source families, their original tests and review evidence. Avoid merge commits or duplicated ancestors when cherry-picking review-only sequences.
2. Compose the existing private 0.2 canonical loader and descriptor registry. Reuse canonical inert JSON admission, subject validation and digest functions. Keep domains cohesive, without a second registry or authorization system. Adapt each explicit factory/normalizer signature; facility returns a direct selection and needs `{input: selection}` at the loader boundary. Do not copy private producer implementations.
3. Preserve all 46 prior descriptors, public 0.1 bytes, original 139 inventory entries and disposition text. If all ten accepted operations integrate, proposed catalog 0.2.7 is **56 typed unavailable / 55 mapped unavailable / 41 pending**, still 96 selected/43 deferred. This is a target, not current acceptance.
4. Keep handlers null, availability unavailable, source connectivity disabled and qualification pending. Caller-supplied model arguments cannot supply trusted clocks, locale, binding or subject. Do not silently change approved memory self-review semantics.
5. Run focused integration checks, one necessary full source suite and public generation/types. Save raw streams, exact source/tree/diff and owned process exit evidence. Repair actual defects, preserving every failure and negative control. Produce a full derived ledger and exact-source/hash packet.
6. Obtain independent combined source review before a new draft continuation PR. No runtime gate can close from these local checks.

`memory_reviewer` owns `/workspace/meri-reference-integration-review-20261012`, branch `review/meri-reference-integration-20261012`: only the new independent integration test, review report and `reference-integration-review/**` evidence. Criteria were frozen before candidate inspection at `4491a1e`; clean resumable checkpoint `8c48e75a76e990ddf3c20f31ca32366546107b5c` records 15/15 baseline checks and passing test syntax. Its 58 independent connected controls are frozen but UNRUN until an exact combined candidate exists. Both owned groups are absent. Its 14-member manifest SHA256 is `99a820517425f030a145a61d61d84f43245c885c0a95f79f9e5b173438594d52`. Combined verdict is **HOLD — integration unbuilt**.

`memory_author` owns remaining-read discovery at `/workspace/meri-remaining-source-discovery-20261012`, branch `review/meri-remaining-source-discovery-20261012`: only its discovery report and evidence. It is tracing the remaining 30 unallocated selected reads after the ten above and eleven command/artifact/analysis boundaries, preparing an 8–12 capability slate. Preliminary findings include state legislation with possible live LegiScan fallback/ingestion, tenant-scoped contact discovery, regulatory docket reads and concrete downstream LegiWatch read owners. These observations are not execution or source acceptance.

`gateway_author` owns command discovery at `/workspace/meri-command-contract-discovery-20261012`, branch `review/meri-command-contract-discovery-20261012`: only its discovery report and evidence. All eleven selected command/artifact/analysis boundaries are being traced to canonical Command/ApprovalProposal/Decision/Receipt and ArtifactVersion/ScheduleProjection responsibilities. Existing public command actions do not automatically authorize inventing task.update or Temporal schedule aliases. Consequential policy/surface decisions must be returned with exact consequences.

Directory, PE, rule, certification, stored-reference and facility author/reviewer paths remain preserved. Completed agents may be reused with new exclusive paths. Do not recursively delegate or edit another owner's active worktree. No owner was stopped because of the disconnect notification.

## Unchanged runtime and policy gates

G0 accepted; G1 OPEN; G2–G7 unentered. Source acceptance is not runtime activation. A separate native owner has RC1 native33 and nine budget cases; do not duplicate that work. Executable runner review, supported patched image, task identity/auth/expiry/revocation, durable budgets, checkpoint task-A/B recovery and stale rejection, sandboxed browser/renderer, egress/watchdog/teardown and artifact inspection still require exact qualified runtime evidence.

The vulnerable image `sha256:8d1ec09aa78f47a11019089dacde93289fc66a39f55bd4357e59eeb25d9b52ac` must never run. Do not build/push/deploy images, allocate infrastructure or credentials, alter networks/database/security state, access customer data, run SQL/providers/models or incur spend. Existing Aurora selection remains. Paid-model aggregate budget is unreconciled. Private host/Hermes policy availability only blocks affected operations, not independent source work. No frontend, proxy, worker, native qualification or infrastructure edits are authorized for these capability lanes.

Administrator memory self-approval is the already approved exception and must not be reopened; parent records Capiro PR2397 wording alignment. Clio versus portfolio `get_research_evidence` remains a separate unresolved decision. Preserve Claude Agent SDK model-loop ownership, Temporal durability and AI SDK/Elements transport. No legacy agent/retrieval/planner/UI/infrastructure implementation or host artifact skills may be imported.

No new approval is needed for the independent source continuation above. Infrastructure and runtime actions remain outside this delegation.
