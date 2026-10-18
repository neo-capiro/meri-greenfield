# Lane 2 — read-tool families and skills

| Field | Value |
|---|---|
| Owner | lane-2 session (Fable) |
| Branch | `fable/meri-lane2-read-tools-20261017` |
| Receives into | `fable/meri-first-chat-receiving-20261017` (PR #133), merged at its tip `3fa0325a` |
| Source pins received | PR125 `69688364` (accepted), PR132 `bba4ef68` (was HOLD_TESTS) |
| Core pins read (read-only) | PR52 `51c15744`, PR59 `59efe08f`, PR68 `8d6733c3`; default branch `backend-import` `c76f5fc0` |
| Exact lane code commit | `96f484259e5238bb7437a9fc512a2784ebcea483` (all source and tests; later commits change only this file) |
| PR | [neo-capiro/meri-greenfield#135](https://github.com/neo-capiro/meri-greenfield/pull/135) (draft) |

Status vocabulary is BACKLOG.md's: `source` → `integrated` → `qualified` → `deployed` → `live-verified`. Nothing in this lane is past `source`. No read is integrated (PR #133 has not received this branch), qualified, deployed or live-verified.

## Overall accounting (82 selected source reads)

| Accounting | Complete | Partial | Absent | Basis |
|---|---|---|---|---|
| Accepted ledger (PR125 `scope-ledger.json`) | 69 | 3 | 10 | Superseded on 18 Oct by the fresh exposure regeneration below |
| Regenerated ledger (`--refresh-exposure`, D015 #5, 18 Oct) | 74 | 3 | 5 | This lane's honest source counts; the +5 mode operations' Core producer (PR68) has never run Jest/TypeScript |
| Qualified / deployed / live | 0 / 0 / 0 | | | No real Core, Linux image, PG, SDK install or live user |

"Complete source" means the Meri adapter, trusted dispatch context and focused tests exist and pass. It does **not** mean the Core endpoint is merged or running: every family calls Core's retained-authority read stack (`feat/core-retained-authority` PR35 → PR52 → PR59 → PR68), and none of it is on Core's default branch `backend-import`. `read-mode-observation` and the `x-meri-read-observation` decoder are absent there. Core in capiro-dev is `0/0/0`.

## Per-family status

All rows: status `source`, integrated/qualified/deployed/live = no. "Core" names the Core dependency.

| Family | Operations | Meri source | Core dependency / blocker (owner) |
|---|---|---|---|
| acquisition-personnel, action-items-complete, bill-text, client-documents, client-knowledge-memory/-monday/-profile, client-registry, data-search, dataset-metadata, disclosures, district-nexus, entity-candidates, facility-representation, federal-legislation, federal-market, florida-budget, intelligence-summary, legislative-directory, mail, meeting-source, memory-proposals, operational-reads, pe-references, public-domain-query, public-reports, public-web, regulatory-dockets, research-portfolio, research-portfolio-evidence, state-legislation, state-status-votes, stored-intelligence, tenant-contacts, tracked-bills, public-domain-hearings | 58 source operations (plus `list_memory_proposals`, the one product-state read) | complete | Retained-authority stack unmerged; not deployed (dot) |
| funding-opportunities | 5 | complete | Core PR52 (`{asOf}` observation), unmerged (dot) |
| client-knowledge-search | `search_client_knowledge`, `query_knowledge_graph` | complete | Core PR59, unmerged (dot) |
| business-development | context, recent_changes | complete | as above |
| business-development | `get_business_development_evidence` | **absent** | Core change: live SAM lookup despite `suppressJev`; footprint client lookup ignores the client wall (dot) |
| public-data | `query_economic_data` | complete | as above |
| public-data | `search_federal_grants`, `search_federal_awards` | complete (candidate) | Core PR68 mode observation; Jest/TS **unrun** (dot) |
| program-elements | `search_program_elements`, `get_program_element`, `get_pe_budget_timeline` | complete (candidate) | Core PR68 as above (dot) |
| research-legal-legislation | `search_legislative_research` | complete | as above |
| research-legal-legislation | `get_legal_reference` | **partial**: names (check-ref) and folders now admitted; rules/versions/explicit-ID branches admitted | Parser-dependent citations need a Core citation observation (dot); SDK-withheld |
| research-legal-news | `search_legiwatch_news` | **partial**: names (check-ref) and folder-with-explicit-client now admitted for exact-source and explicit-year personnel | News window `asOf`, folder-only client observation, Clerk ID for monitors (Core, dot); implicit personnel year (design, dot/Neo); SDK-withheld |
| outreach-query | `query_outreach` | **partial**: explicit-client campaign list only | Unscoped list and exact record need Core walls (dot), plus a product decision on unscoped-list scope (Neo/dot) |
| research-legal-candidates | `search_research_sources` | **absent** | Core change: meetings branch leaks other users' meetings (below); client walls before content (dot) |
| rule-status | `get_state_rule_status` | **absent** | New observation arm `{stageAsOf,commentAsOf}` in Core decoder and Meri codec (dot) |
| sam-opportunities | `search_sam_opportunities` | **absent** | New arm `{asOf,sourceStatusAsOf,sourceHealthAsOf,evidenceAccuracyMode}` (dot) |
| certification-status | `get_certification_status` | **absent** | New arm `{comparisonLocale}` plus a Core report of its actual locale (dot) |

The five absent operations already have Meri contracts, validators and contract tests (`packages/contracts/retrieval-0.2/*`). Building their adapters now would pass only against a stubbed Core, because the validators need values that Core samples itself and does not return. The adapters follow once the arms are agreed. The Meri codec `packages/contracts/native-read-observation-0.2` is a shared contract file, so its arms are proposed on PR #121 before any edit.

## Installation / discovery producer

**Blocked on design (dot plus the native qualification owner).** The consumer side is complete in source: `apps/gateway/general-reads/installation.mjs`, `mount.mjs`, `apps/runtime/general-read-runtime.mjs` and `general-read-installation/runtime.mjs`. No production producer exists for general reads or selected skills. Discovery is hard-wired empty (`tool-dispatch.mjs:110`). No storage, migration, contract or issuer is decided.

The open decisions are:
- P2: installation receipt contract and issuer (signing, deployed build/origin/config attestation, revocation on drift).
- P1: discovery-grant contract and issuer.
- P3: base general-read allocation.

After those are decided, the startup mount patch is lane 1's. Writing a producer now would invent authority, so none was written.

## Skills (14 original assets)

| Skill set | State |
|---|---|
| `relationship_brief`, `commitments_audit` | Admitted for selected execution (source). Reads complete in source. |
| `client_changes`, `hearing_watch`, `mail_history`, `meeting_prep`, `portfolio_changes`, `representation_lookup` | All declared reads complete in source. Not admitted: admission is limited to the two above in `control/conversations/skills/*`, and each needs its own reviewed output compiler (documents lane 6 / Fable). |
| `pe_deep_dive`, `portfolio_overlap` | Reads now complete only as PR68-dependent candidates. |
| `funding_opportunity_match`, `research_company` | Blocked by `search_sam_opportunities` (and `get_certification_status` for research_company). |
| `regulatory_docket_brief` | Blocked by `get_state_rule_status` and parser-dependent `get_legal_reference`. |
| `bill_watch` | `get_pe_budget_timeline` is a PR68 candidate; `create_word` is the separate document path. |

Skill assets load and validate. No skill workflow is runtime-qualified.

## Core findings sent to dot (PR #121)

1. **Security, on `backend-import` too.** `search_research_sources` meetings query, `meri-tools.service.ts:6730` (`8d6733c3`: 6753). `...ownMeetingWhere(ctx.userId)` is followed by a second `OR:` key, which replaces the ownership `OR`. Any same-tenant meeting whose text matches is returned (subject, description, organizer) to any member who reaches this tool.
2. `ensureClientVisible` (`:9737-9775` at `8d6733c3`) checks tenant and archived status only, never the memory wall. Meri compensates with the native roster check, but direct Core callers do not.
3. `query_outreach`: `listCampaigns` is tenant-wide with no client wall. `getOutreachRecord` returns nested meeting/prep/client without wall or ownership rechecks.
4. `get_business_development_evidence`: `suppressJev` leaves `samEnabled` on (live SAM by UEI/CAGE). The footprint client lookup ignores the wall and archived status.
5. Lower severity: `list_upcoming_meetings` (`backend-import :7398-7400`) overrides `ownMeetingWhere`'s `status ≠ deleted` with `status ≠ cancelled`, so the user's own soft-deleted meetings can appear.

## Work done in this lane

- `b7f5da04`: PR132's long-source mode-lifetime cases failed DEADLINE because the shared fixtures cap the source at 1 s and the gateway at 3 s. Those cases now use the approved 10 s lifetime. With the old 3 s fact lease reinstated they fail 0/5; with the current reader they pass 5/5.
- PR132's other "17 failures" do not reproduce on the received tree. All 20 PR132 test files pass. The file-level failures seen once were host spawn/commit-memory exhaustion, not test outcomes.
- `c0d6e507`:
  - `get_legal_reference` gains check-ref names and folder delegation (verified against Intel `ResearchService.run → context` at `8d6733c3`).
  - Three stale tests corrected: registration coverage now includes the mail and program-elements constructors; tracked-bills and outreach named-selector cases now test the missing-reader refusal.
- `95fd80f2`: merged integration tip `3fa0325a`. No conflicts, and no overlap with read paths or lane-1-owned files.
- `1fc1b0cf`: `search_legiwatch_news` gains check-ref names and folder-with-explicit-client scope (verified against Intel `Phase8EvidenceService.context`).

## Tests

Focused only (host commit memory is about 2 GB): Node 24.19, serial, one file per process, `--max-old-space-size=256`. No dependency installs.

The selection is 59 files: every PR132 test file; the legislation, news, tracked-bills, hearings and outreach source tests; registration; and all of `native-read-credentials/test`, `general-read-installation/test` and `apps/worker/conversation/reads/test`.

First run at `1fc1b0cf`: **1,996 passed / 3 failed**.
- Two failures were stale assertions, fixed and re-run file by file:
  - BD SDK total 60 → 76 (`9fc229ef`): 15/15.
  - public-data complete family (`96f48425`): 21/21.
- One file, `reads/test/options.test.mjs`, cannot load here: `packages/window-resolution`'s own dependency (`@js-temporal/polyfill`) is not installed, and installs are not allowed on this host. It is not counted as passing.

At `96f48425` that is 1,998 passed and 0 failed across 58 loadable files. There is no single combined run; files were run one at a time.

Known host-only failures, unrelated to this lane:
- `public-domain-query` "explicit supported as-of" depends on the host time zone; it passes with `TZ=UTC`.
- `apps/gateway/test/mail-history-gateway-flow.test.mjs` also fails at the pre-receiving base `0e38ef49` (`ARTIFACT_BUDGET_SETTLEMENT_UNKNOWN`).

## Remaining read families (ledger: 3 partial + 10 absent)

| Operation | Lane-2 source now | Exact remaining dependency |
|---|---|---|
| `search_federal_grants`, `search_federal_awards` | complete (candidate) | Core PR68 mode observation: Jest/TS, merge, deploy (dot) |
| `search_program_elements`, `get_program_element`, `get_pe_budget_timeline` | complete (candidate) | Core PR68 as above (dot) |
| `get_legal_reference` | partial | Core citation observation endpoint for parser-dependent branches (dot) |
| `search_legiwatch_news` | partial | Core: news-window `asOf`, folder→client observation, `clerkUserId` in identity receipt; implicit-year decision (dot/Neo) |
| `query_outreach` | partial | Core walls for the unscoped list and exact record; unscoped-scope product decision (dot/Neo) |
| `search_research_sources` | absent | Core: fix the meetings `OR` override, add client walls before content (dot) |
| `get_business_development_evidence` | absent | Core: `samEnabled:false` option, wall the footprint client (dot) |
| `get_state_rule_status` | absent | Arm `{stageAsOf,commentAsOf}` in Core decoder + Meri codec (dot ack, then lane 2) |
| `search_sam_opportunities` | absent | Arm `{asOf,sourceStatusAsOf,sourceHealthAsOf,evidenceAccuracyMode}` (dot ack, then lane 2) |
| `get_certification_status` | absent | Arm `{comparisonLocale}` plus a Core locale report (dot ack, then lane 2) |

## Remaining tasks and acceptance

| Task | Owner | Acceptance |
|---|---|---|
| Core fixes and observation arms above; merge the retained-authority stack; run PR68 Jest/TS | dot | Published Core commit with passing Jest/TS |
| Meri codec arms + 5 absent adapters + partial completions | lane 2, after dot acks the arms | Focused tests over real Meri owners against the agreed Core contract |
| P1/P2/P3 contracts + installation/discovery issuer | dot + qualification owner | Decided contract, storage and issuer |
| Startup mount of general reads | lane 1 | Reviewed mount patch |
| Receive this branch into PR #133 | integration owner | Combined focused set passes → `integrated` |
| Qualification in the real image against deployed Core | lane 1 | Evidence → `qualified` |
| Live authenticated read | dot E2E | Evidence → `live-verified` |
| Admit the six read-complete skills | lane 6 / Fable | Reviewed per-skill compiler and admission |
| Ledger regeneration to the honest counts | Fable | **Done 18 Oct** as a fresh regeneration (D015 #5); see "Runtime integration" below. The denied blob `28865e43…` was not used or retried |

## Runtime integration (18 Oct, session `rt-reads`)

Branch `fable/rt-reads-20261018` from the integration tip `ac2d2a7a`, draft PR into `fable/meri-integration-20261018`. Source and tests only; nothing built, deployed or run against AWS.

### The 17 reported failures

- **Cause: the Windows POSIX-path test shim, not the availability gate.** Under the shim, `registerMeasuredHandlers` (`apps/gateway/catalog/measured-handlers.mjs`) resolves the repository root (`fileURLToPath`, a `C:\…` path) with POSIX `resolve`, giving `C:\dev\…\C:\dev\…\apps\…`. Reading it fails with ENOENT, so the installation owner refuses (`GENERAL_READ_INSTALLATION_REFUSED`), `mount.mjs` `readAvailability` returns `UNAVAILABLE`, and `reads-owner.mjs` reports `UNAVAILABLE`. All 16 `read-family-subsets` cases failed this way. The Linux runtime is not affected, and no gate was loosened. The same artifact causes about 1,000 shim-only failures across lane 2 suites; all of them pass without the shim. **Run lane 2 tests on Windows without the shim.**
- **Without the shim, 4 cases failed, all stale assertions.** PR132 (`bba4ef68`) opened the whole `public-data` and `program-elements` families, so the five Core PR68 mode candidates (`search_federal_grants`, `search_federal_awards`, `search_program_elements`, `get_program_element`, `get_pe_budget_timeline`) are now eligible. PR132 updated the gateway and worker tests but not this runtime test. The test now treats the five as complete, and still checks that the five truly absent reads never reach availability or execution, including the finite business-development subset. Result: 16/16.

### Other stale lane 2 tests on the integrated tree (pass at base or new with lane 2)

| File | Cause | Fix |
|---|---|---|
| `scripts/scope-ledger/source-exposure.test.mjs` (whole file failed to load) | `scripts/general-reads/adapters.json` still declared `public-data` as economic-only: "Registered read lacks a canonical adapter: search_federal_grants" | Curated entries for the real `public-data` grants/awards and `program-elements` adapters, with their PR68 dependency stated; assertions moved to the PR132 state (76/42 registered, 74/3/5). Synthetic "no adapter" and "partial" cases now use reads that are still absent |
| `apps/runtime/test/funding-source-integration.test.mjs` | SDK 71/41 asserted (PR125); PR132 makes it 76/42 | 76/42, matching every worker reads test |
| `packages/contracts/test/retrieval-action-item-binding`, `-action-item-independent`, `-memory-binding` | Historical descriptor hashes changed only by `f33ea1a8` (`search_capiro_data` input `DataSearchInput` → `DataSearchRequest`) | Assert that exact reviewed descriptor change, then undo only it. The historical pins (including the 12 Oct baseline evidence) are unchanged and still match |
| `packages/contracts/test/vertical-execution-integration-independent`, `vertical-final-integration-independent` | Same `f33ea1a8` change, compared with the 12 Oct identity files (descriptor, and in the final check the binding `input`) | Same treatment, next to the tests' existing Portfolio-footnote and dispatch-profile undos: 26/26 and 40/40, as at base |
| `apps/runtime/native-authority/retained-reads/test/control.test.mjs` | Passed an empty call context; PR132's transport reads `c.operation.id` to keep mode reads off the delegated path | Minimal real call context (`get_florida_budget_project`); same assertions |

Every row above also fails identically at the lane 2 tip `e8def62b`. They are lane 2's own stale tests (PR132 was received while on HOLD_TESTS), not merge drift.

### Catalog, skills, SDK registration and ledger agreement

| Surface | Value |
|---|---|
| `packages/contracts/retrieval-0.2/catalog.json` canonical sha256 | `f351ebad656225b15e6b4433bdad5d3e9e2ef270c64940d29811ef2f130b71ae` (base `af430a94`: `27db172a…`; the only descriptor change is `search_capiro_data`, `f33ea1a8`) |
| `packages/skills/assets.json` and selected skill pins | `f351ebad…` (agree) |
| Worker `familyReads()` / `READ_FAMILY_IDS` | 76 / 42 (base: 31 / 19) |
| Installation-eligible reads (`installationReadOperations`) / adapter constructors | 76 / 44 |
| Scope ledger `sourceExposure` | 76 operations / 42 families; 74 complete + 3 partial + 5 absent = 82 |

**Coordinator re-pin (P1, files outside this lane):** done at `291ff5d7`. `infra/product-preview/first-chat/allocation.json:61` and `runtime-values.json:108` now pin `f351ebad…`. With this branch merged over that tip, `runtime-values.test.mjs` passes 5/5. `sdkOptionsSha256` stays `af7f07b8…`, which is consistent: lane 2 does not change the SDK options while `generalReads` is off (G2), because `meri_reads` is not registered.

### Scope ledger regeneration (D015 #5)

Fresh regeneration with the repository's own tool, `node scripts/scope-ledger/cli.mjs --refresh-exposure`, then `--check-exposure` exit 0. Only `sourceExposure` changed (provenance, counts, registration, missing families, rows). Every historical field (`capabilities`, `ownerDirection`, `coverageOrigin`, `provenance`, `counts`, `gates`, `excludedReferences`, `ownershipGraph`), `TOOL-COVERAGE-96.csv` and the general-reads proposal inventory are byte-identical. The new `scope-ledger.json` is git blob `76fdc689780b74c86f8494421ac19c4f43205aad`, sha256 `48b2c65d5a1375c7740ef58ed206858108710b4394442f54b7e896d61e3526a6`. It is not the denied blob `28865e43…` (sha256 `0a97c45b…`), which was never read, used or retried.

The full regeneration (`--check`/`--write`) remains blocked, as it was at base: the exclusion scan finds unclassified references (`apps/proxy/product/main.py` at base, and also lane 2's `apps/gateway/sources/client-registry/test/fixture.mjs`). Classifying them rewrites historical `capabilities[].references`, so that is a separate decision. `scripts/scope-ledger/ledger.test.mjs` fails for the same reason at base and here.

### Remaining failures (with evidence)

Run: 269 lane 2 test files (gateway, native-authority read paths, native-read-credentials, general-read-installation, retained-reads, worker reads, skills, scope ledger, general-reads inventory, retrieval contracts, the runtime funding/KB source integrations). Node 24.19, serial, one file per process, **without** the POSIX shim, `MERI_REVIEW_SOURCE_ROOT` set. Result: **7,273 passed / 16 failed**. The two vertical contract identity tests, run separately, pass 26/26 and 40/40. Every remaining failure also fails at base `af430a94`, or is host-only:

| File | Failed | Cause | Owner |
|---|---|---|---|
| `apps/gateway/sources/public-domain-query/test/handler.test.mjs` | 1 | Host time zone; 17/17 with `TZ=UTC` | none (host) |
| `apps/gateway/test/mail-history-gateway-flow.test.mjs` | 1 | Same at base (`ARTIFACT_BUDGET_SETTLEMENT_UNKNOWN`) | pre-existing |
| `apps/worker/conversation/reads/test/options.test.mjs` | 4 | Same at base: `options.mjs` `RUNTIME_CONFIGURATION` | worker options owner |
| `packages/skills/test/assets.test.mjs`, `plugin.test.mjs` | 1 + 1 | Windows: symlink EPERM; file mode 0o666 vs 0o600. Same at base | none (host) |
| `packages/contracts/test/retrieval-{mail,meeting-source,memory-proposals,operational-reads,public-domain-query}.test.mjs` | 5 | Pin contracts package version `0.1.5`; it is `0.1.10` (lane 1). Same at base | contracts version owner |
| `scripts/scope-ledger/ledger.test.mjs` | 1 | Full exclusion scan (above). Same at base | decision |
| `scripts/scope-ledger/source-exposure.test.mjs` | 1 of 36 | "targeted refresh preserves…" needs historical trees `a945196e`, `615a5467`, `e1845c3b`, `08f65a79`, which no GitHub ref contains (`not our ref`). The same assertions pass against the three published trees | environment |
| `scripts/general-reads/inventory.test.mjs` | 1 | Same at base: `sources.mjs` dispatch-profile regex is obsolete. The repair is in the held codex recovery patch, not received | held (dot) |

Separate findings on the integration tip (not lane 2, not changed here). Both were resolved by R0 on #145: `9ca7fff4` regenerated the metadata, and `7531295c` updated the schedule expectation to lane 5's deliberate single attempt. From a comparison of the other 31 `packages/contracts/test` files against base:
- `packages/contracts` `generate-conversations.mjs`, `generate-input.mjs` and `generate-initial-input.mjs` `--check` exit 1. `00076b0a` (H1) changed `apps/control/conversations/service.mjs` without regenerating the `dist/*metadata.json` source hashes. `conversation-input-public` and `conversation-initial-input-public` each fail 1 case for the same reason. The other generator checks pass.
- `schedule-tool-independent.test.mjs`: 2 cases expect the schedule action's `retry.maximumAttempts` to be 2, but it is 1. This passes at base, so it is lane 5's schedule composition.

### Production mount: the control composer and what is still needed

**Composer (in this lane): `apps/runtime/native-authority/reads-composer.mjs`.** It is async because it prepares and measures the family handlers. Control startup awaits it once, before `startControl`; it is separate from R0's synchronous `productPortsFactory`:

```js
const reads=await createControlReadsComposer({configuration,now,secretFiles,defaultCongress:119,gateway});
await startControl(configuration,{signal,createReadsRuntime:reads.createReadsRuntime});
```

- It composes Core's native tool authority at `nativeCandidate.identity.origin`, the native read credential broker, and the 27 native read families. `reads.missing` lists every absent input by key name, never by value.
- No pool is needed at startup; each run tuple carries its own pool.
- The 15 non-native families stay uninstalled: mail, meeting-source, the retained-signed research-portfolio/Florida reads, and others. They need their own transports; Florida also needs Core W1 plus signing ports.
- **Credential invariant (Core #83), pinned by `apps/runtime/native-authority/test/read-composer.test.mjs`, 35/35:**
  - The marked control credential reaches only `application-authority/{identity,context,membership}`.
  - Read secret files must differ from all four candidate credential files (identity, task, control, proxy) by path and by bytes, checked at startup. The native read bearer must also differ from the service secret.
  - Each call re-reads its file and fails closed (`UNAVAILABLE`) if the file now holds a candidate credential.
  - A composed native read sends `Bearer <native read credential>` plus `x-internal-service-secret` on `tools/*`, and no request carries a candidate credential.
  - A mutation test (dropping the per-call check) fails 2 cases.

**Render keys (R0 adds them to `render-material.mjs` and the material inventory; this lane does not edit either):**

| Key | File | Content |
|---|---|---|
| `secretFiles.nativeReadCredential` | `/run/meri/native-read-credential` | Unmarked Core native bearer for the run actor. The owner refuses unless its Core principal equals the run's tenant and actor. Never the marked identity credential |
| `secretFiles.serviceSecret` | `/run/meri/core-tool-service-secret` | Core `INTERNAL_SERVICE_SECRET` for `POST /api/clio/tools/:name` |
| `secretFiles.readModeServiceSecret` | `/run/meri/core-read-mode-service-secret` | Service secret for `read-mode-observation`. May hold the same value as the tool secret; required only by the five mode reads |
| `defaultCongress` | config value | `119`. Needed for the bill-text and federal-legislation families |

The files are read with `config.mjs` `readSecret`, so each must be owner-only (0600), owned by the runtime user, no symlink, and at most 32 KiB.

**Still needed (outside this lane), with the composer reporting each one in `missing` until supplied:**
1. `gateway.authority`: the `tool.read` current authority (`createReadAuthority`) over Core-backed `verifyCapability`, `currentRun`, `authorizeBusiness` and `authorizeSources` ports. No production producer exists.
2. `gateway.readCurrentInstallation` (P2 installation receipt issuer) and `gateway.discoveryOwner.readDiscoveryGrant` (P1). Writing either would invent authority; they need dot's and the qualification owner's contract first.
3. `gateway.limits`: gateway request/response/cleanup bounds (R0 render).
4. Render: `approvedReads` and `sourceEnabled:true` (G1, treated as decided), the run capability policy `generalReads:true` and `readFamilies` (G2), and an SDK-options template that admits `meri_reads` (G3).
5. Worker side: the runner's `meri_reads` server port (G4, apps/worker).
6. Core: the retained-authority read stack (PR35 → PR52 → PR59 → PR68) and the listener routes for `tools/*`, `read-mode-observation` and `clients/check-ref`, in the coordinated packet.
