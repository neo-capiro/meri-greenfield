# Meri data, artifacts, memory, and retention audit

Read-only review, 15 October 2026, 18:46 UTC. No repository edits, commits, source activation, credentials, AWS, live databases, deployment, or user-computer work. Isolated synthetic probes and fetched source copies are in this directory. Implementation remains with the designated implementation owner.

## Pins and disposition

- Main: `8b123bea4c90794dc2d766814b6ddbdbfe0928bc`.
- Shared reviewed source: `ba40647c5b6f1f81773869e41ce82c099d64d505`.
- `fable/meri-complete-20261015`: `f0befe1e486cfda644f1f6170cf3d9d671e5158f`.
- `fable/meri-resume-20261015`: `b5be44d5141ae5fd3830aed789cb7ad525506c4e`.
- P1a: `6d9bb391005f73c8be6ec636c346a05381b5bd98`, 5 commits ahead of ba40647.
- P1b: `06b2f4991cfd9d85ea20fee1b7b9cb3bd721dc40`, 4 commits ahead of ba40647.
- P1c: `e0f94fe00a65ddd7f3f663bc2eafd25def7dfda4`, 5 commits ahead of ba40647.
- Master crosswalk: `9a41cfe54174cdd11cdfbd84e90cc8087bdfc0d6`.

GitHub compare says main is an ancestor 2,496 commits behind ba40647. The three P1 branches share ba40647, and none changes the retention inventory/purge/SQL adapter or artifact executor/presentation defects below. Their existence does not integrate them into main or establish release acceptance. All findings below use ba40647 unless another pin is explicitly named.

Disposition: HOLD full data/artifact/retention acceptance. The code contains meaningful, generally fail-closed source foundations. It does not implement or qualify the whole original v1 outcome. This audit found four additional source defects and confirms existing shipping/integration gaps. The separately reviewed P1b signed-download final-authority race and budget issue are not repeated here.

## New source defects

### DA-1 — P1 before purge activation: a planner-accepted mixed subject can delete bytes before discovering its database target is invalid

`enumerateReferences` unconditionally adds artifact-version targets, including when the snapshot subject is a conversation. `planPurge` permits that class. The SQL row owner only permits artifact-version rows for an artifact subject. `execute` performs object deletions before calling this row owner, and does not persist an UNKNOWN/per-step result on the thrown failure.

Sources:
- [inventory.mjs L16–36](https://github.com/neo-capiro/meri-greenfield/blob/ba40647c5b6f1f81773869e41ce82c099d64d505/apps/control/retention/inventory.mjs#L16-L36), especially L30
- [purge.mjs L71–93](https://github.com/neo-capiro/meri-greenfield/blob/ba40647c5b6f1f81773869e41ce82c099d64d505/apps/control/retention/purge.mjs#L71-L93)
- [postgres-journal.mjs L65–79](https://github.com/neo-capiro/meri-greenfield/blob/ba40647c5b6f1f81773869e41ce82c099d64d505/apps/control/retention/postgres-journal.mjs#L65-L79)

Reproduction: `node probe-retention.mjs`. An otherwise accepted conversation snapshot containing one artifact version produces PLANNED with one `artifactVersions` row target. The executor deletes all three synthetic storage targets, then the actual SQL adapter's row-kind check throws `RETENTION_INVALID_REQUEST`. The journal remains PLANNED with empty step receipts; the ledger contains only SUPPRESSED and PURGE_PLANNED. Results: `probe-retention-result.json`.

Evidence boundary: actual fetched inventory/planner/executor/row-routing source; in-memory S3/ledger/journal fixtures, injected SQL replies, and inert contract JSON/hash surrogates. This is not real PostgreSQL or live deletion evidence. The existing real-PG test explicitly rejects this row-class mismatch when calling rows.purge directly, but does not test the entire accepted-inventory -> storage-delete -> row-purge path (`postgres-journal-pg.test.mjs` L113).

Repair: make inventory/plans subject-aware or split child artifact purges into their own authorized subjects; preflight every row target before any physical effect; persist per-step started/outcome/UNKNOWN state for exceptions and process loss. Add end-to-end mixed-subject and row-port-failure controls. Do not merely remove the failing row target while silently leaving required data behind.

### DA-2 — P2: PDF revision feeds a PDF into the DOCX parser

[local-executor.mjs L17–18](https://github.com/neo-capiro/meri-greenfield/blob/ba40647c5b6f1f81773869e41ce82c099d64d505/apps/artifacts/local-executor.mjs#L17-L18) changes a PDF request's format to DOCX but forwards the retained PDF base bytes unchanged. [entry.py L31–34](https://github.com/neo-capiro/meri-greenfield/blob/ba40647c5b6f1f81773869e41ce82c099d64d505/apps/artifacts/python/entry.py#L31-L34) passes them to [office.py L27](https://github.com/neo-capiro/meri-greenfield/blob/ba40647c5b6f1f81773869e41ce82c099d64d505/apps/artifacts/python/office.py#L27), which opens the base using python-docx.

Actual fixed generator probe: create produced a 1,367-byte valid synthetic PDF through a synthetic converter port. Revising those exact bytes failed `ARTIFACT_PROCESS_FAILED`, inner `BadZipFile`, exit 2; converter was never called again. Owned process group was absent. An initial local attempt used a nonexistent Python path and failed ENOENT; rerun used the environment's actual Python executable. That setup failure is separate from the reproduced PDF defect.

Repair: retain and bind the editable DOCX intermediate/spec required for a PDF revision, or implement an explicit PDF revision path with exact-parent lineage. Add create -> inspect/download -> revise -> replay tests. The canonical WordRequest permits PDF, but product HTTP currently rejects PDF, so this defect blocks completing the promised surface rather than proving a live user regression.

### DA-3 — P2: valid multi-element slides deterministically overlap

[presentation.mjs L17–19](https://github.com/neo-capiro/meri-greenfield/blob/ba40647c5b6f1f81773869e41ce82c099d64d505/apps/artifacts/presentation.mjs#L17-L19) independently places table, chart, and image at x=6.8, y=1.2, width=5.8. [Slide schema L309–355](https://github.com/neo-capiro/meri-greenfield/blob/ba40647c5b6f1f81773869e41ce82c099d64d505/packages/contracts/artifacts-0.2/artifact.schema.json#L309-L355) permits them together; [artifact-validation.mjs L30](https://github.com/neo-capiro/meri-greenfield/blob/ba40647c5b6f1f81773869e41ce82c099d64d505/packages/contracts/artifacts-0.2/artifact-validation.mjs#L30) checks only chart lengths and rectangular tables.

Actual PptxGenJS 4.0.1 produced a 74,039-byte PPTX from a valid one-slide table-plus-chart request. OOXML confirmed both frames begin at (6217920,1097280) EMUs with width 5303520; table height 2743200, chart height 3657600. The chart fully overlaps the table. Native Office/visual rendering was not run. `overlap.pptx` retains the generated file.

Repair: define non-overlapping typed layouts or reject incompatible content combinations explicitly, then render and inspect every slide with dense/long/combined-content fixtures. This is independent of the currently missing product PPTX route.

### DA-4 — P2: uncertain retention database leases return to the pool as reusable

[postgres-journal.mjs L17–19](https://github.com/neo-capiro/meri-greenfield/blob/ba40647c5b6f1f81773869e41ce82c099d64d505/apps/control/retention/postgres-journal.mjs#L17-L19) swallows a failed ROLLBACK and always calls `c.release()` without an error. [L53](https://github.com/neo-capiro/meri-greenfield/blob/ba40647c5b6f1f81773869e41ce82c099d64d505/apps/control/retention/postgres-journal.mjs#L53) likewise returns its exclusive-lock lease after unlock failure.

Injected-lease probe `node probe-retention-lease.mjs` makes COMMIT and ROLLBACK fail. Actual adapter returns `RETENTION_STORE_UNAVAILABLE` and calls release with zero arguments, making no attempt to retire the uncertain lease. Results: `probe-retention-lease-result.json`. Not a real-driver/network fault test.

Repair: reuse the existing canonical bounded lease pattern in [artifact storage L15–26](https://github.com/neo-capiro/meri-greenfield/blob/ba40647c5b6f1f81773869e41ce82c099d64d505/apps/artifacts/storage/postgres-versions.mjs#L15-L26): distinguish commit uncertainty, bounded rollback, late connection cleanup, and discard on unknown transaction/lock state. Add lost-ACK, rollback-failure, unlock-failure, and later-borrower controls. Server statement/lock timeouts are not the whole client-lifetime or cleanup contract.

## Confirmed integration and full-scope gaps

### Retention/restore (existing P1 release blocker)

[control.mjs L39–41](https://github.com/neo-capiro/meri-greenfield/blob/ba40647c5b6f1f81773869e41ce82c099d64d505/apps/runtime/control.mjs#L39-L41) composes a read gate and SQL projection, not the authoritative ledger/reconciler/purge owner. [createServingGate L10](https://github.com/neo-capiro/meri-greenfield/blob/ba40647c5b6f1f81773869e41ce82c099d64d505/apps/control/retention/reconciliation.mjs#L10) starts open; [readiness L93–96](https://github.com/neo-capiro/meri-greenfield/blob/ba40647c5b6f1f81773869e41ce82c099d64d505/apps/runtime/control.mjs#L93-L96) checks table presence and that open local flag, not a recovered ledger watermark. A restored pre-suppression projection can therefore be considered servable unless an external owner fences and reconciles it first. The ba40647 return already discloses the missing production recovery owner; this audit confirms the gap rather than claiming a newly observed live disclosure.

Only SDK-session entries and artifact-version rows have row deletion targets (`inventory.mjs` L9–10; SQL rowWhere L65–66). Conversation/event/next-run/native-journal metadata are enumerated with no row deletion targets. Browser state, previews, telemetry/backups, source-retained material, and orphaned object effects still require explicit inventory and end-to-end retirement/restore policy. Source-only migration allocation does not apply SQL or configure a write-once ledger sink, holds, bucket/version policy, or per-class retention durations.

### Artifacts (W07/G4/G6 incomplete)

The governed application only accepts `create_word`/`create_excel` and DOCX/TXT/XLSX: [format-admission.mjs L8–18](https://github.com/neo-capiro/meri-greenfield/blob/ba40647c5b6f1f81773869e41ce82c099d64d505/apps/control/document-application/format-admission.mjs#L8-L18). PDF/PPTX/general analysis lower-level code exists but is not admitted here. `product-applications.mjs` mounts this document application; absent an artifact options owner it returns unavailable.

Byte identity, scope equality, immutable version/head CAS, original parent retention, current authority before/after effects, and exact replay are substantial implemented controls. `service.mjs` intentionally requires false nativeOpened/rendered/recalculated flags and returns `nativeQualified:false`; it cannot promote generator output into qualified native evidence. Formula caches are zero placeholders on initial XlsxWriter creation, removed/unverified on openpyxl revision. LibreOffice transformation explicitly reports formula equivalence unqualified. Local rendered fixture artifacts do not establish the full benchmark's 100% openability/formulas, >=95% human quality, zero critical clipping, real-bucket/KMS identity, or admitted-image renderer sandbox.

### Institutional memory (W04/W08/G3/G5 incomplete, deferred scope respected)

Read and pending-proposal source owners exist. `memory-eligibility.mjs` L6–27 binds every recalled record hash and result to current eligibility receipts, selection/policy/source pins and expiry. `memory-read-context.mjs` binds paging history to current run/subject/policy and exact previous-page hashes. These are source controls over injected native eligibility/context/credential owners, not proof that live canonical memory policy is wired and qualified.

`source-projection.mjs` L10–22 restricts memory.propose to a pending candidate, rejects personal auto-commit, and requires source `saved:false`; the command result retains candidateId + exact command hash. Direct confirm/correct/forget are explicitly deferred by the accepted crosswalk. Do not label those intentional deferrals implementation defects or silently grant them while completing application retention. Required remaining evidence is real current owner/client wall/lifecycle/grant enforcement, approval expiry, exact pending-candidate lineage, replay, revoke, and lost-ACK behavior through the selected producer.

### Connectors/catalog/skills (W04/REL-02/03/05/RG-02–08/12 incomplete)

Independently counted catalog 0.2.15: 97 descriptors, 97 availability=unimplemented, 97 handler=null. The crosswalk preserves 96 selected and 43 deferred native IDs, all 139 runtimeParity=NOT_QUALIFIED. Null descriptors do not mean handler source is absent: source modules, installed-catalog receipts, selected-skill installation measurement, and explicit gateway mount paths exist. The production gateway exports source-disabled compositions (`apps/gateway/index.mjs` L16–40); runtime config fixes sourceEnabled=false. Source inventory establishes 22 accepted domains, not actual restricted roles, current grants, all exact/search/full-read/history/page coverage, or provider connectivity.

Fourteen immutable original skill assets exist. P1a adds a plugin projection of 13; Bill Watch is excluded because its unchanged prose lacks SDK frontmatter. The original explicit selected-skill path is separate. P1a report explicitly says no real SDK/CLI/plugin/subagent/model run was exercised, and the control service does not currently return an enabling capability policy. Policy/contract acceptance, immutable image materialization, and actual CLI qualification remain required.

## Requirement matrix and completion evidence

| Scope | Implemented/source evidence | Still required |
|---|---|---|
| W04, G3, R-04/05, RG-02–05/07/12 | Typed source adapters, exact contexts, eligibility and continuation receipt controls, 22-domain inventory | Current native role/wall/owner policy, complete agreed source coverage, exact/history/decisive reads, measured revoke and held-out quality |
| W07, G4/G6, original file gates | DOCX/TXT/XLSX application; PDF/PPTX/analysis lower generators; immutable versions; S3/PG adapters | DA-2/3, missing routes/previews, whole native rendering/formula/revision benchmark, real bucket and qualified renderer image |
| W08, G5 | Immutable command preparation and pending memory/task/file source projections | Live exact approval/expiry/current authorization/idempotency/receipt qualification; deferred memory mutations stay deferred |
| W05/W09, G4/G6, RG-07/12 | Suppression gate, ledger API, generation-bound plans, SQL CAS/target triggers, reconciliation source | DA-1/4, startup fencing + authoritative ledger owner, all data classes, restore/rollback/unknown-effects and real storage tests |
| R-07/08, REL-05, RG-06 | 14 exact skill manifests/prose; selected execution path; P1a 13-skill plugin projection | All 14 promised workflows, required evidence/completion across reconnect/resume/fork, native plugin and held-out semantics |

Original gates are not changed: 100% benchmark native files open and supported formulas/reference totals correct; >=95% human quality; no critical clipping/corruption; zero unauthorized disclosure; full retention/deletion/restore; exact immutable candidate. Crosswalk and PR86 coverage maps are documentation/source evidence, never fresh runtime qualification.

## Checks actually run in this audit

- GitHub immutable source reads and branch/compare checks; 76 text source/doc files materialized. No complete checkout or dependency installation.
- `python3 apps/artifacts/test/test_word_revision.py`: 2/2 pass using the environment's installed Python dependencies. These are focused Word revision checks, not the full artifact suite or product image.
- Actual fixed DOCX generator + synthetic PDF converter: create succeeds; revision deterministically fails BadZipFile.
- Actual fixed PptxGenJS 4.0.1: generated real PPTX; inspected OOXML frame geometry; confirmed table/chart overlap. No Office rendering/visual acceptance claimed.
- Retention planner/executor/SQL routing and poisoned-lease probes with explicitly synthetic ports/contract surrogates: counterexamples above.
- Owned generator process groups reported absent; no remaining `/tmp/meri-artifact-*` workspace or owned running generator found. Source copies and audit artifacts are intentionally retained. No other worktrees/processes were changed.

Not run: full Node suites, fresh package installation, real PostgreSQL/S3, model calls, native SDK, source identity/policy readbacks, PDF/Office renderer sandbox, cloud runtime, frontend E2E, held-out benchmark, deployment or release gates. Historical lane5 298/304 artifacts and 260/261 document results remain reported evidence with failures, not fresh passes from this review.

## Organization and repair order

1. Keep production purge disabled. Repair target preflight and durable per-step uncertainty; then poison/timeout/lock cleanup and startup recovery fencing. Reuse canonical storage lifetime/lease patterns.
2. Finish full class inventory and authoritative ledger/fact bindings, with restore tests covering conversation plus child artifact and shared/fork ownership.
3. Repair PDF lineage and PPTX layout before admitting missing routes. Keep generation, qualified inspection, preview publication and filing separate cohesive owners, retaining exact original bytes and independent inspection evidence.
4. Bind actual current source/eligibility/installations and qualify all accepted domains/workflows. Keep the finite canonical catalog; no broad generic query replacement or silent source widening.
5. Freeze one integrated candidate and rerun checks/benchmarks against that identity. Keep historical PR86/local receipts immutable and clearly labelled. Condensed one-line source should not hide separate transaction/cleanup responsibilities; extraction should follow real ownership, not arbitrary line counts.
# Addendum: selected-tool exposure reconciliation

Read-only targeted extension, 15 October 2026, 18:55 UTC. Source pins are ba40647 and P1a 6d9bb391 above. P1a's complete GitHub compare contains no changes to the retrieval catalog, original manifests, selected-runtime, or selected-skill MCP server; those counts and restrictions therefore apply to both pins. This extension changes no implementation or source activation.

## Result: 47/49 mixes legacy names with contract names and overstates execution

Independent parsing of all 14 manifest files and catalog.originals[].replacement yields:

| Measurement | Count | Meaning |
| --- | ---: | --- |
| Selected legacy operations | 96 | Accepted inventory scope |
| Contract descriptors | 97 | Includes retained historical query_action_items |
| Unique contract IDs declared by 14 manifests | 54 | Asset declarations only |
| Selected legacy operations whose current replacement is declared | 53 | 52 read contracts plus create_word |
| Selected legacy operations whose current replacement is undeclared | 43 | 33 read contracts plus 10 non-read contracts |
| Selected read operations (sideEffect=none) | 85 | Candidate universe, subject to authority and installation |
| Selected non-read operations | 11 | Artifact, command, schedule, proposal owners |
| Selected-skill MCP source restrictions | 2 skills, 11 unique IDs | relationship_brief and commitments_audit only |
| Ordinary no-skill institutional MCP binding | 0 | At both reviewed pins with absent capability policy |
| Runtime-qualified original workflows | 0 | No acceptance promotion from these counts |

The literal legacy-name intersection contains 48 IDs including create_word. Removing create_word as a non-read gives the quoted 47, but this is not a canonical-ID coverage count. Six renamed reads were then incorrectly left in the apparent 49 remaining operations:

| Legacy ID | Declared current ID | Catalog mapping |
| --- | --- | --- |
| list_emails | mail.list_messages | [L718–726](https://github.com/neo-capiro/meri-greenfield/blob/ba40647c5b6f1f81773869e41ce82c099d64d505/packages/contracts/retrieval-0.2/catalog.json#L718-L726) |
| search_emails | mail.search_messages | [L728–736](https://github.com/neo-capiro/meri-greenfield/blob/ba40647c5b6f1f81773869e41ce82c099d64d505/packages/contracts/retrieval-0.2/catalog.json#L728-L736) |
| get_email_thread | mail.read_thread | [L738–746](https://github.com/neo-capiro/meri-greenfield/blob/ba40647c5b6f1f81773869e41ce82c099d64d505/packages/contracts/retrieval-0.2/catalog.json#L738-L746) |
| list_upcoming_meetings | meeting.list_upcoming_meetings | [L748–756](https://github.com/neo-capiro/meri-greenfield/blob/ba40647c5b6f1f81773869e41ce82c099d64d505/packages/contracts/retrieval-0.2/catalog.json#L748-L756) |
| query_debriefs | meeting.query_debriefs | [L1003–1011](https://github.com/neo-capiro/meri-greenfield/blob/ba40647c5b6f1f81773869e41ce82c099d64d505/packages/contracts/retrieval-0.2/catalog.json#L1003-L1011) |
| read_client_meetings | meeting.read_client_meetings | [L1013–1021](https://github.com/neo-capiro/meri-greenfield/blob/ba40647c5b6f1f81773869e41ce82c099d64d505/packages/contracts/retrieval-0.2/catalog.json#L1013-L1021) |

These are the six absent from the pasted 14-product + 29-read enumeration. They are declared under the new names; their omission is accounting drift, not six newly discovered missing source handlers.

There are two further corrections to that 43-item enumeration:

1. create_word is already declared by [Bill Watch manifest L45](https://github.com/neo-capiro/meri-greenfield/blob/ba40647c5b6f1f81773869e41ce82c099d64d505/apps/control/document-application/research-brief/manifest.json#L45), although this does not make it a general conversational tool or admit Bill Watch through the two-skill MCP constructor.
2. The accepted selected legacy query_action_items maps to actions.query at [catalog L963–970](https://github.com/neo-capiro/meri-greenfield/blob/ba40647c5b6f1f81773869e41ce82c099d64d505/packages/contracts/retrieval-0.2/catalog.json#L963-L970). All relevant original manifests still declare historical query_action_items. That old descriptor explicitly calls itself scoped-only and points to the reviewed full-transport successor at [L2297–2351](https://github.com/neo-capiro/meri-greenfield/blob/ba40647c5b6f1f81773869e41ce82c099d64d505/packages/contracts/retrieval-0.2/catalog.json#L2297-L2351). actions.query is absent from the manifests. The retained old descriptor is exactly why 96 selected legacy references coexist with 97 descriptors. Do not silently alias away the different scoped/unscoped semantics.

Thus the corrected 43 undeclared selected operations are the pasted 43 with create_word replaced by query_action_items → actions.query:

- 13 product IDs: create_excel, create_powerpoint, run_analysis, schedule_task, list_scheduled_tasks, update_scheduled_task, cancel_scheduled_task, create_task, update_task, save_memory, list_memory_proposals → memory.list_own_proposals, read_chat_attachments, save_chat_attachments.
- 29 domain-read IDs: search_congress_bills, search_state_bills, get_state_bill_status, search_floor_votes, search_state_floor_votes, search_legislative_research, search_legiwatch_news, search_lda_filings, search_fara_registrations, search_sec_filings, query_intelligence, search_intel_articles, query_knowledge_graph, query_global_data, list_global_datasets, query_economic_data, search_research_sources, get_research_evidence, get_research_portfolio, get_research_portfolio_changes, lookup_client_registry, search_client_knowledge, query_outreach, get_business_development_context, get_business_development_evidence, search_acquisition_personnel, get_acquisition_person, get_district_federal_market, get_florida_budget_project.
- 1 current successor: query_action_items → actions.query.

## Source binding is substantially narrower than manifest declarations

At ba40647, [activity.mjs L26–30](https://github.com/neo-capiro/meri-greenfield/blob/ba40647c5b6f1f81773869e41ce82c099d64d505/apps/worker/conversation/activity.mjs#L26-L30) prepares selectedSkills only when request.skill is present. [options.mjs L24–28](https://github.com/neo-capiro/meri-greenfield/blob/ba40647c5b6f1f81773869e41ce82c099d64d505/apps/worker/conversation/options.mjs#L24-L28) otherwise returns tools=[], allowedTools=[], skills=[], no mcpServers, deny-all canUseTool, and an explicit no-institutional-source prompt. The optional MCP mount only admits meri_original_reads and at most 11 tool names.

[selected-runtime.mjs L16–19](https://github.com/neo-capiro/meri-greenfield/blob/ba40647c5b6f1f81773869e41ce82c099d64d505/apps/worker/conversation/skills/selected-runtime.mjs#L16-L19) and [mcp.mjs L11–14](https://github.com/neo-capiro/meri-greenfield/blob/ba40647c5b6f1f81773869e41ce82c099d64d505/apps/worker/conversation/skills/mcp.mjs#L11-L14) both hard-restrict execution to relationship_brief and commitments_audit. Their union is 11 read IDs: find_contacts, mail.read_thread, mail.search_messages, meeting.query_debriefs, meeting.read_client_meetings, query_action_items, query_tasks, read_client_documents, read_monday_client_boards, resolve_entity, search_memory. One is the historical narrower action-items contract. This is conditional source wiring, not 11 live-qualified reads.

The existing gateway mount is useful reusable ownership: [mount.mjs L24–35](https://github.com/neo-capiro/meri-greenfield/blob/ba40647c5b6f1f81773869e41ce82c099d64d505/apps/gateway/selected-skills/mount.mjs#L24-L35) checks sourceEnabled, manifest inclusion, current installation, installed catalog and durable gateway dispatch, then rechecks installation before release. It is currently selected-skill-bound, so a general reader needs an explicitly reviewed run-level admission shape rather than fabricating a skill or bypassing those controls.

P1a preserves the same absence default at [options.mjs L28–34](https://github.com/neo-capiro/meri-greenfield/blob/6d9bb391005f73c8be6ec636c346a05381b5bd98/apps/worker/conversation/options.mjs#L28-L34). Its [activity L25–36](https://github.com/neo-capiro/meri-greenfield/blob/6d9bb391005f73c8be6ec636c346a05381b5bd98/apps/worker/conversation/activity.mjs#L25-L36) adds an optional default-off capability fragment. That fragment has no mcpServers field ([fragment.mjs L9](https://github.com/neo-capiro/meri-greenfield/blob/6d9bb391005f73c8be6ec636c346a05381b5bd98/apps/worker/conversation/capabilities/fragment.mjs#L9)); the plugin explicitly sets skipMcpDiscovery:true and adds Skill only ([skill-plugin.mjs L17–25](https://github.com/neo-capiro/meri-greenfield/blob/6d9bb391005f73c8be6ec636c346a05381b5bd98/apps/worker/conversation/capabilities/skill-plugin.mjs#L17-L25)). Thirteen plugin prose assets do not mount their 54 declared operations. The current producer does not supply this capabilities policy; the P1a report explicitly discloses that and the absence of real SDK/plugin/hook/model execution.

## Required design/acceptance correction

Severity: P1 full-scope acceptance/exposure gap; P2 accounting and successor-coverage drift. These are not new live-data disclosure findings. Keep the earlier security/retention HOLD gates independent.

- A general in-process SDK read server over the canonical gateway is directionally consistent with existing ownership. Derive the selected current read universe from the registry (85 sideEffect=none contracts), then expose only installed, qualified, capability-admitted operations under fresh current grants. The label read is not authority, and some reads are product lifecycle reads owned by command/schedule/attachment services.
- Preserve one SDK loop, canonical schemas, operation-specific adapters and provenance, current actor/client walls, budget/deadline/cancellation, invocation correlation, paging/replay identity, before/after authority, and fail-closed installation/source checks. No generic SQL or unrestricted query entry point.
- All 11 selected non-read operations need a governed conversational path to the existing artifact/command/schedule/proposal owners, including explicit proposal/approval boundaries and UNKNOWN/replay handling. A separate button or HTTP route alone does not establish conversational parity; broadening a read server must not expose a write under readOnlyHint.
- Keep skill selection separate from tool availability. Recipe prose may constrain an admitted workflow, but general conversation source access must not require choosing one of the 14 recipes. Resolve the historical action-items successor with a reviewed manifest version/contract decision rather than modifying immutable 1.0.0 semantics in place.
- Acceptance needs machine-checked 96→current-contract mapping, reachability tests for every admitted operation with and without a skill, no-grant/revoke/restore/cross-client/expiry controls, real SDK MCP invocation and negative controls, then approved source/runtime qualification. Candidate source wiring and mocked dispatch cannot satisfy that final gate.

Evidence files: TOOL-COVERAGE-96.csv and TOOL-COVERAGE-96.json include all 96 legacy IDs, mapped contract/version, side-effect class, declaring skill IDs, pasted-list group and pinned source link. Independent Python assertions verify all counts and the exact corrected missing set. No new runtime or provider test was run in this extension. A temporary execution transport disconnect prevented one inventory command from starting; retry succeeded without repository effects.
