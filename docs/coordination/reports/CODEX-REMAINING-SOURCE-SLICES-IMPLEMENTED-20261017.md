# Remaining read source slices implemented - 17 October 2026

This source-only successor is based on PR105, remote `f33ea1a8945444b5ad8d15d5d048377abf201959`, local `08f65a79b99e5b269a8c7f7e82b6b8de225caae8`, identical tree `f573e12b9d682e63e9c0a00082510cbf090963d7`. The task-owned sparse branch is `codex/meri-general-reads-remaining-next-20261017`. The release remains pinned to PR98 `caa7810ff19c09c8f7ea1c2524c025f36f99ccd6`; no release checkout or candidate was changed.

## Result and coverage

Eight organized native gateway families add ten operation paths. Two operations have complete frozen-request coverage and selective SDK exposure. Eight operations have useful, explicitly restricted request coverage and remain absent from the SDK. Source presence never grants installation, task policy, discovery, current tenant/user authority or live qualification.

| Family | Operation paths | Implemented request coverage | SDK |
| --- | --- | --- | --- |
| public-data | `query_economic_data` | Complete stored economic query | Selectively exposed; grants/awards excluded |
| client-knowledge-search | `query_knowledge_graph` | Complete native graph request and output branches, current selected-client/seed admission | Selectively exposed; semantic search excluded |
| state-status-votes | `get_state_bill_status`, `search_state_floor_votes` | Canonical stored bill keys only; designation/provider fallback refused | Withheld |
| tracked-bills | `search_tracked_bills` | Explicit client UUID matching current one-client subject, scope and visible membership | Withheld |
| public-domain-hearings | `search_committee_hearings` | Absent client or current authorized explicit UUID; named resolution refused | Withheld |
| research-legal-legislation | `search_legislative_research`, `get_legal_reference` | No client/folder and no citation requiring parser observation; native rules/versions/reference/search branches retained | Withheld |
| research-legal-news | `search_legiwatch_news` | Exact typed source or explicit-year personnel, no client/folder | Withheld |
| outreach-query | `query_outreach` | Explicit authorized client UUID campaign list; every own `outreachId` key refused | Withheld |

The 82 selected source reads reconcile as **56 complete + 8 partial-input + 18 absent**. Therefore **26 reads in 15 families still lack complete coverage**. All 56 complete reads are SDK-exposed. The SDK contains 58 total general operation references across 35 families; gateway construction contains 40 family modules. The two extra general references are outside the selected-82 source inventory. No partial-input operation is counted complete, advertised by the SDK or qualified live. Qualified/live remains **zero**.

`get_research_portfolio`, `get_research_portfolio_changes` and `get_florida_budget_project` retain their existing implemented source paths and accepted scope. News budget-source detail does not replace Florida budget-project retrieval.

## Authority and receiving behavior

All new adapters use actual finite `/api/clio/tools/<operation>` routes on the pinned Core producer, with the existing native credential/service-secret mechanism. They preserve original requests and native output shapes, except the already-frozen tracked-bill result explicitly wraps the raw DTO with current Meri binding/subject lineage. No model-provided tenant, actor, mode, clock, locale or Clerk identity becomes authority.

CONTROL rejects unsupported state, tracked, hearing, legal, news and outreach request branches before any native tool request. Current native client visibility is checked for selected graph clients/seeds and client-scoped hearing requests. Tracked and outreach list require an exact single-client subject and matching client scope resource as well as current native membership. Current authority is reobserved before use and before result release; drift withholds the whole result. Graph authored mentions are not misrepresented as grants or silently redacted into fabricated absence.

Tracked contexts carry three exact keys (`binding`, `subject`, `clientReference`). Refresh preserves all context fields while allowing only the existing authorization decision receipt to rotate. News derives its five contexts from demonstrably request-determined native branches, then invokes the canonical normalizer for typed identity/scalar admission without copying its parser. SDK per-family operation subsets are validated against canonical references; unfinished siblings cannot inherit exposure or curated source coverage.

## Remaining dependencies

[All 28 previously missing reads have actual native routes and finite dispatch branches](CODEX-REMAINING-CORE-ROUTES-20261017.md). Remaining blockers concern trustworthy observations and pre-read authority rather than invented missing routes. Core reference is `neo-capiro/capiro-backend@b525032222515d636b0dae2d46e40c7c3d8b5528`.

- Program elements, grants/awards and SAM need actual tenant evidence-mode observations. Funding/SAM and rule status also need their producer-owned clocks; certification needs the producer's comparison locale. Semantic knowledge search needs its actual generated/as-of observation. Gateway clocks, output guesses and host locale cannot substitute.
- Full tracked/hearing coverage needs current named-client resolution; legal coverage additionally needs citation, selected-client and folder observations. Full news needs actual windows, implicit calendar, inherited scope and monitor ownership. Restricted requests do not close those gaps.
- Outreach's owned detail still includes linked client/meeting/prep data without the required fresh nested checks; [detail audit](CODEX-OUTREACH-SLICE-20261017.md). The implemented client-filtered campaign list is a separate closed projection; [list proof](CODEX-OUTREACH-LIST-SLICE-20261017.md).
- Research candidates always start six branches including tenant directory notes and provide no source selector. Business-development requests cannot explicitly select an unlinked prospect before linked-client/evidence reads. [Exact candidate/business-development blockers](CODEX-CANDIDATE-SLICE-AUDIT-20261017.md) describe the smallest native seams and an existing meeting ownership predicate overwrite. No adapter or post-read filter invents the missing boundary.

## Verification and review

Final integrated checks and independent source acceptance are recorded below before publication. Author initial failed assumptions and intermediate runs are retained beside final evidence. All checks use exact Node24 and borrowed dependency junctions with the lock-matching Zod 4.6.7; no dependency install or heavy archive was made. Disk was checked throughout (approximately 2.6 GiB free before final source integration).

- Final coordinator run: **285/285** across all eight new adapter suites, the shared native helper, existing credential owner, source contexts and result authorization. [Text evidence](remaining-next-20261017/root-native-sources-final.txt), [exact invocation](remaining-next-20261017/root-native-sources-final.json).
- Final accounting author and independent reviewer each passed **24/24** source-exposure checks. The independent reviewer also passed **75/75** SDK family/source-slice checks and accepted exact frozen accounting source: 56/8/18, 26 incomplete in 15 families, SDK58/35, constructors40, live0. All eight historical fields and 43 exclusions match the exact PR105 local base; Markdown outside current exposure is byte-identical.
- Adapter author checks include economic 21 plus 29 contracts, graph 13, state 27 plus 53 contracts, tracked 16 plus 27 contracts, hearings 27 plus 10 receiving probes, legal 31 plus 34 contracts, news 31 plus 34 contracts, and outreach 13. These overlap the coordinator's final pass; they are not additive unique-test claims.
- The unchanged historical `ledger.test.mjs` still fails its excluded-tool reference classifier on the byte-identical registry fixture (Git blob `20e6e1c8934e6c9623360fb9dad4a3e4131569f4`). The old inventory parser also retains its previously documented dispatch-profile parsing limitation. Neither check was weakened or rewritten. Targeted current exposure regeneration and drift checks pass.

- Final author integration: **704/704** across six gateway/native-owner/worker/SDK suites. [Text evidence](remaining-next-20261017/source-slices-integration-ten-final.txt), [exact invocation](remaining-next-20261017/source-slices-integration-ten-final.json). The initial ten-operation run passed 703/704; its sole failed assertion expected CONTROL's `UNAVAILABLE` even though the synthetic business-authority fixture had already denied a blank selected client with `ACCESS_DENIED`. The corrected assertion preserves the direct native-owner early-refusal check. Earlier 18/34, 666/666 and 684/684 snapshots remain historical intermediate evidence.
- Final independent production-source disposition: **ACCEPT_SOURCE**, no blocking findings, for all ten operations/eight families and shared eligibility/context/measurement/SDK seams. The independent six-suite run passed **689/689**; separate news **65/65**, outreach **50/50**, and actual CONTROL news probes **37/37** passed. Its suite selection differs from the author's 704-test selection; no combined unique-test total is claimed. Only economic and graph are exposed; eight partial operations remain withheld. The independent ledger/SDK reviewer separately accepted the accounting source.

Final staged source, documentation, whitespace and publication tree are checked before the reviewed draft is opened. Two retained initial-failure text captures had whitespace-only diagnostic lines; trailing spaces were normalized for the Git whitespace check without changing failures, assertions or outcomes. These source checks do not qualify a live installation.

No live Core/provider/database query, credential issuance, AWS operation, migration, infrastructure/startup/lockfile change, merge or deployment occurred. Reviewed draft publication is authorized under the standing source-publication instruction; publication is not live acceptance.
