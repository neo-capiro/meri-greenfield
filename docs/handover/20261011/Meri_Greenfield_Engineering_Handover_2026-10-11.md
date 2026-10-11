# Meri Greenfield Engineering Handover — 11 October 2026

[Word document](Meri_Greenfield_Engineering_Handover_2026-10-11.docx) · [PDF](Meri_Greenfield_Engineering_Handover_2026-10-11.pdf) · [Remote pickup](REMOTE-PICKUP.md) · [Reference index](REFERENCE-INDEX.md)

Current status and remaining work against deployment plan R2

Prepared by Codex integration owner for Neo Martinez and the next engineering owner.

Evidence snapshot: 11 October 2026 at 12:10 UTC / 08:10 EDT. Sources were read locally; this handover did not run new cloud qualification, model inference or customer-data access.

The owner’s subsequent handover directions are incorporated: resume on a remote server from published code checkpoints, use multiple bounded Hermes workers, coordinate with the active cleanup execution on another remote server, validate all worker work through Codex and close every finished session. GitHub publication preserves source; it does not advance deployment gates.

G0 is accepted. G1 remains OPEN. G2 through G7 have not been entered. The new application is not ready for cutover. There is substantial qualification and product implementation left, despite many independently reviewed source changes and bounded successful experiments.

This document inventories completed work, exact repository state, pending candidates, failure history and every remaining deployment work package. It separates accepted source/local behavior from observed runtime results and full deployment-gate acceptance. Use the plan and evidence index to resume without treating a narrow experiment as an integrated application pass.

### How to use this handover

- Read sections 1–4 for authority, gate status, repository state and what is implemented.

- Use sections 5–9 for G1 closure, W00–W11, all R/REL/RG requirements and numerical acceptance targets.

- Use sections 10–12 for open decisions, the recommended resume sequence and operating safeguards.

- Appendices contain the full capability disposition list, selected skill intents, all data domains, component pins and evidence locations.

Status labels: ACCEPTED GATE means an explicit integration-owner deployment decision. SOURCE ACCEPTED means reviewed code only. LOCAL/OFFLINE PASS means the named bounded checks ran. ACTUAL BOUNDED PASS means a real isolated observation within its stated scope. PENDING/UNRUN means no acceptance exists. A selected capability is an implementation obligation, not qualified parity.

## 1 Controlling plan and user decisions

The controlling design input is the supplied Meri_Codex_Hermes_Deployment_Plan (3).md, adopted as docs/plans/MERI-DEPLOYMENT.md and archived under revisions/20261010-R2. Its SHA256 is 43f9be7c385a1e321dbc9721bd7ff97752031a62e661f7691b78e0a20fd7c388 (86,848 bytes). The adopted copy is byte-identical to the attachment. The pinned inventory workbook is 127,877 bytes, SHA256 3d281d7a1a9a1eaf4fe520dde8e46e2abedac82f6b771041a613c1cfb0df25ec. [S01–S02]

Attached documents supply requirements, examples and proposed methods. They do not themselves authorize deployments, customer access, messages, architecture changes or release. The explicit human decisions below override embedded Hermes kickoff examples and older plan assumptions. The original Greenfield plan remains background for unaffected requirements; dated earlier deployment plans are preserved in docs/plans/archive/. [S03, S10]

| Decision | Controlling instruction |
| --- | --- |
| Execution ownership | Earlier G0/G1 work followed the Codex-only instruction. The latest handover direction permits multiple bounded Hermes implementation workers for future continuation. Codex owns allocation, integration and independent validation of all Hermes work at every phase/workstream end; advance only after acceptance. |
| Remote pickup and cleanup | Continue from GitHub on a remote server. Discover the active cleanup execution on the other remote server; do not reuse a local PC chat ID. Refresh exact source/interface/fixture ownership and merge/release windows before overlaps and at affected phase/workstream ends. Close every finished Hermes session; no dormant workers. |
| Isolation and cutover | Build independently from current Meri/Capiro. Application, control and trusted services stay in the new Fargate environment with separate network, roles, storage, secrets and deployment. Existing application remains untouched; source connections start disabled; cutover is not authorized. |
| Browser exception | The user approved a NEW isolated browser host after measured Fargate sandbox failure. This exception applies to browser execution only. Genuine nonroot browser AND renderer sandbox, egress, cancellation, watchdog and teardown must pass. |
| Model and cost | Use Bedrock US Claude Sonnet 4.6 profile us.anthropic.claude-sonnet-4-6. US cross-region processing was approved. Application resources stay in us-east-1. Synthetic model tests only; $10 aggregate model-test ceiling; observed inference spend remains $0. |
| Architecture | Full Claude Agent SDK is the sole model loop; AI SDK supplies UI transport; use one qualified Playwright integration and Temporal. No minimal SDK substitution. Obtain approval before changing the deployment plan architecture, component choices, scope or placement. |
| Accepted scope and pilot | 96 selected and 43 deferred native capabilities across 22 data domains. Pilot tenant Capiro-internal; first user and technical access owner Neo Martinez; tenant-wide internal context. Canonical IDs, current entitlements and a specific client are not enrolled. |
| Frontend ownership | Private neo-capiro/capiro-frontend owns product UI, shared shell and future Portfolio, Modules and Settings. neo-capiro/meri-greenfield owns trusted backend contracts and services. Dead-code cleanup applies to the NEW backend only. |
| Design and baseline | The user confirmed Figma is finalized. Full visual acceptance remains a separate check. The user will provide the approved location and owner for 75 real requests and redacted traces; this has already been requested. |
| Implementation standards | Use focused modules, thin entry points, canonical schemas and registries, dedicated worktrees and exclusive path ownership. Preserve failures, safe imports, cleanup of owned resources, borrowed-resource boundaries and independent verification. |
| Release authority | No G7 release/cutover approval exists. Do not infer authority from embedded prompts, example commands, a successful build, a model report or a historical reservation. |

The latest plan defines 12 work packages W00–W11 and eight deployment gates G0–G7. It has no W12. This handover preserves the distinction between a work package, a reliability ticket and an environment gate. The plan’s rough demo/pilot/production estimates assumed a larger staffed team and are not a current delivery commitment. No credible current G1 or full-project ETA has been established.

## 2 Current gate and release status

| Gate | Status | Meaning and remaining boundary |
| --- | --- | --- |
| G0 | ACCEPTED | Discovery and scope accepted under D012; R2 reconciled. This is planning acceptance, not live-source enrollment or completion of REL-01. |
| G1 | OPEN | Runtime, contracts, proxy/model discovery, browser, partial SDK recovery, measured cohorts and security/license qualification remain incomplete. |
| G2 | NOT ENTERED | Deploy the isolated development foundation after G1; qualify identity, storage, policies, persistence, network and real durable orchestration. |
| G3 | NOT ENTERED | Read-only pilot and evidence/retrieval accuracy, current authorization and revocation across agreed sources. |
| G4 | NOT ENTERED | Complete workspace UI and artifacts/browser integration with behavior, visual, responsive and accessibility acceptance. |
| G5 | NOT ENTERED | Qualify selected commands, governed proposals, approval, idempotency, receipts and recovery. |
| G6 | NOT ENTERED | Qualify immutable staging candidate, full regressions, performance, restore/rollback and operational readiness. |
| G7 | NOT ENTERED | Exact-candidate approval, internal allowlist/canary, controlled rollout and verified rollback. No cutover yet. |

The independent qualification VPC, builders and bounded test resources exist. A complete isolated application/control/source-gateway/Temporal deployment has not passed G2. No live Capiro source principal or customer connection is admitted, no production mutation has been made, and no tested greenfield candidate has been cut over. Actual model inference is $0 against the approved $10 ceiling; separate AWS infrastructure/build/storage costs are not included in that model cap. [S12–S19, S24]

G0 acceptance includes discovery decisions and the REL-01 audit/baseline plan. It does not mean the 75 real requests have been received or measured. R2 expanded the tooling/contracts/discovery acceptance work; these additions remain in scope and do not revoke G0’s planning acceptance. [S04, S10–S11]

## 3 Repository state and unfinished sessions

These are exact locally observed Git checkpoints. A fresh clone of main will not contain the local collector commit, pending branch candidates or ignored evidence. Verify clean status and exact parent before integrating anything. There are no task-created PRs to merge.

| Checkout | Branch and exact head | Integration state |
| --- | --- | --- |
| Backend primaryC:/dev/main/meri-greenfield-kickoff-20261009 | mainf2d6c0b8bdb728bcccc8628538e678711b679c1c | Clean; origin/main same. Latest published checkpoint. |
| Backend integrationC:/dev/main/meri-greenfield-worktrees/g1-parallel-integration | task/g1-parallel-integration2f0e03ac656e393165ebc539bf6bfe9209623e2d | Clean; one commit ahead of published main. Collector source is accepted locally, not pushed. |
| FrontendC:/dev/main/capiro-frontend | main28c300093c0886018c49df8764a8e6fac44819eb | Clean; origin/main same. Home offline acceptance only. |

Repository URLs: https://github.com/neo-capiro/meri-greenfield and https://github.com/neo-capiro/capiro-frontend. Source reference only: existing Capiro pinned fd8765ec01d292013758606204f2c9d886cd31c1. Its implementation was not imported into the new application. [S03–S04, S25]

Publication delta after the engineering snapshot: accepted integration 2f0e03a and pending dd98d62/086263a are now pushed to GitHub. The seven interrupted SDK paths are preserved exactly in unfinished WIP 4d33640, also pushed. The handover branch includes accepted integration source and updated human continuation rules. The historical tables below retain the snapshot state; use the remote manifest for pickup. Pending/WIP publication creates no acceptance. Browser SOURCE5 has no implementation diff to recover. [S35]

### Recent integrated work

| Integrated commit | Change and accepted scope |
| --- | --- |
| 867a9e1 | mail.read_thread typed transport contract; 55 owner checks; no handler/source connection. |
| 25a1558 / 6f669a7 | Canonical revoked-owner native cause classification and isolated diagnostic packaging, source-only acceptance. |
| 9998ade | Combined native proxy source preparation; actual schema/views/lifespan/auth/revocation unrun. |
| eef3d6f / 88c8eec | Browser source preparation and reachable diagnostic graph repair. Later SOURCE4 actual diagnostics reviewed separately. |
| a35b2cb | Mail list/search outline and behavioral metadata acceptance. |
| accf7ca / 878ee87 | Private SDK fixture contract and replacement-admission timing repair; 17 affected controls pass; original hold retained. |
| 13036c0 | Expected runtime schema/Prisma/engine/views artifact provenance; not actual final-image measurement. |
| f2d6c0b | Published status checkpoint at 11:30 UTC. |
| 2f0e03a | Local fixed runtime-body collector integration after root 23/23 checks; source only, actual collection unrun. |

### Pending candidates and session ownership

| Owner and worktree | Returned or working state | Required next action |
| --- | --- | --- |
| Codex mail implementationg1-rel02-mail-list-search-contract | dd98d6268d2e7057b4ef236bb2fd352f0fb0cec6Clean, 8 files. Distinct ACCEPT_SOURCE_ONLY review closed. | Root verify exact review/candidate closure and compatibility; accept or fix; then integrate. Not yet counted in current catalog. |
| Codex metadatag1-rel02-remaining-capability-metadata | 086263abdf1b5c34b502a44d957b5568e837f992Clean. 93-operation metadata report only. | Root independently verify/read it; allocate missing literal/enum metadata and family contract tasks. No handlers/contracts implemented by this report. |
| /root/contract_reviewg1-sdk-fixture-worker-adapter | Registry shows INTERRUPTED. Seven owned paths include uncommitted new wire/adapter code, tests and report. | Preserve working tree and .task-inputs. Finish bounded checks/report/seal and commit, then separate review and root acceptance. Do not treat it as returned or integrated. |
| /root/hermes_discoveryg1-browser-exact-volume-wire-source | Registry shows INTERRUPTED; base 2f0e03a, clean at snapshot. Assigned source-only exact-VolumeIds diagnostic follow-up. | Resume only the allocated bounded SOURCE5 preparation; return source closure and distinct review. No operational calls or host launch were admitted. |
| /root/source_discoveryg1-proxy-runtime4-collector | Read-only handover audit CLOSED. Historical name has no Hermes execution meaning. | Audit is DATA, with 48 evidence pins. Root collector acceptance supersedes its older collector-pending phrase. No further implementation session allocated here. |

The active SDK wire work reported an initial 37/37 local controls (17 existing fixture, 7 wire and 13 adapter), followed by focused hardening checks. There is no sealed final commit or independent acceptance. It is a thin client/wire boundary only, with no service, storage or peer authority. Session status above is a snapshot, not an instruction to terminate or reset a task.

## 4 Completed work and its practical limits

### Discovery and authorization design

G0 recorded the account/region/repository, 22 source domains, full native intent inventory, selected/deferred boundary, pilot owner and initial shared-shell/Figma decisions. The current Capiro DB path was observed as Aurora PostgreSQL 16.11 with IAM authentication; current API/analytics/strategy metadata was read for integration planning. Existing RLS-bypass application credentials are unsuitable for the new tenant-aware gateway; the global analytics read role is not a tenant isolation solution. No existing provider/source secrets were copied or used. [S04, S07]

The identity issuer reference is https://clerk.app.capiro.ai. The new trusted gateway must resolve canonical actor/tenant IDs and current memberships server-side. Provisioning middleware must not be used for passive source reads. Model arguments and UI scope hints do not establish authority. Client-specific actions remain disabled until an authorized client is selected. Live canonical pilot identifiers and entitlement checks are still unqualified. [S03–S04]

### Contracts and R2 reconciliation

A reviewed strict 0.1 contract foundation and public browser wire/types/node validation distribution exist. The contracts/v0.1.0 tag peels to 7a44d5750a68d4c2873d4d3b5b7c3e7f5e1a87b3. Canonical run/fence/idempotency, proposal, artifact, event and checkpoint boundaries were repaired and reviewed. Private additive retrieval 0.2 contracts preserve domain distinctions, scope, evidence/coverage and skill identity without silently modifying public 0.1. [S08–S10, S32]

All ten workbook sheets were reconciled read-only: 322 new capability/requirement records, 48 SDK rows, 139 native IDs, 93 workflow/assurance/UI rows, 60 UI states, 10 audit findings, 12 requirements, 12 qualification gates and 9 reliability tickets, plus Overview. Eighteen stored Overview formulas were preserved, not recalculated. Six exported JSON ledgers preserve original coordinates and accepted 96/43 dispositions. Their inherited pending fields are inventory metadata, not the latest acceptance ledger. [S02, S10]

Historical kickoff also qualified installed Hermes 0.20.0 for one H00 edit/resume/commit session at a398b9ea, with independent review and a Codex 15-test rerun. G0/G1 work subsequently followed the explicit Codex-only direction. The latest human handover instruction now permits future multiple bounded Hermes workers, with Codex independently validating all deliveries and phase/workstream results. Requalify the installed remote CLI before use. [S03, S06, S33–S35]

Currently integrated mail.read_thread is one typed full-read transport contract, with no enabled handler. The pending list/search pair would bring reviewed mapping to three selected intents and leave 93. Current integrated mapping remains one/95; do not count a distinct reviewer’s acceptance as root integration. The list/search candidate keeps preview coverage incomplete, snapshot/version unknown when unavailable and absence claims prohibited. [S20–S22]

Remaining-93 metadata preserves 86 literal schemas, two partial enum imports and five missing federal_market schemas. Four frozen source files (three enum owners and one federal adapter) can resolve the seven structural gaps. Fifteen cohesive family proposals and 18 bounded metadata follow-ups are recorded. Descriptions often carry prose-only bounds/defaults and legacy helpers omit additionalProperties; new strict DTO semantics require reviewed decisions, not an opaque fallback tool. [S22]

### Isolated qualification infrastructure and image work

A separate us-east-1 qualification VPC and restricted build/artifact resources were established. Linux builds, immutable artifact/source hashes, exact runtime manifests, resource admission, fixed-clock supervision and managed cleanup have been exercised to bounded scopes. Docker is used in isolated Linux image/build/qualification paths and the proposed browser container; Playwright drives Chromium. Local Docker Desktop is not required to resume the accepted cloud artifact path. [S06, S12–S19]

Earlier Bookworm baseline mechanical checks passed but Chromium namespace sandbox failed with EPERM. Trixie packaging/refinement exposed additional auth-directory/cleanup and native dependency issues, retained as failed evidence. The current broad-image security record is 49 findings: 4 critical, 18 high, 18 medium, 7 low and 2 undefined, plus five older vendor findings. All remain open. A smaller SDK-only image has static source/packaging acceptance but no accepted scan, publication or runtime admission. Office qualification remains deferred. [S06, S12, S16]

### Historical canary and native SDK observations

Managed canary3 established a bounded one-RunTask/one-StopTask cleanup path with physical STOPPED observation inside the original dispatch/cleanup deadlines. Its workload still FAILED with exit137; canary2 cleanup UNKNOWN and earlier consumed failures remain immutable. This proves a narrow enforcement observation, not SDK/browser success. [S29]

One actual native synthetic SDK loopback fixture produced the two request bodies carrying tool_use/tool_result/end_turn, and the task was physically STOPPED with exit0 before its deadlines. It had no actual Bedrock inference, native tool-search discovery, proxy end-to-end protocol or interrupt/resume. Runtime headers alone do not prove executable provenance. Complete body/result/export limits remain part of the retained record. [S30]

### Proxy native TLS and combined authorization preparation

Community LiteLLM application import and offline Prisma generation ran in isolated Linux. Successive failures in TLS native-cause decoding, peer environment, layout and cleanup were fixed in focused modules with independent reviews; failed runs and consumed slots were retained. The accepted TLS7 build 6baed94e-1d9f-4e5e-bf56-dce4f9b0e660 used image a748fe7184c8879b12c0f1cd0aa924b14408c7e14583cf55ad3e8dabc33b9611. Genuine TLS1.3/nonowner query and exact wrong-CA, wrong-SAN, plaintext and wrong-password controls all passed. Nine owned containers and one network were removed and positively observed absent at approximately T0+41.996s. Private file destruction/classifications are trusted source-bound observations, not independent physical host proof. [S13]

Combined schema/views/lifespan/nonowner key creation/auth/delete and revoked-owner classification source is accepted. The 21-member source preparation closes over 353 context files and 331 frozen artifacts. Four expected runtime bodies have frozen provenance: schema 74,271 bytes, Prisma CLI 5,313,425, engine 20,263,736 and views 10,443. Expected body hashes do not establish actual final-image bytes. [S14–S15]

The fixed four-body collector is now root accepted and integrated locally as 2f0e03a after 23/23 guarded controls, zero denied effects and stable source/runtime dependencies. It selects one exact image ID and never starts the collection container; it records attempted create before dispatch, forbids preexisting names, bounds body/export/cleanup and fails closed after a lost acknowledgement. These were fake/local controls; actual Docker collection has not run. Next is a separately closed combined source package with collector composition before any new T0. The original 60-second authorization-start feasibility is unmeasured and has not been extended. [S15]

### Durable budget ledger and ambiguity

A real isolated local PostgreSQL 17.11 fixture exercised integer-microUSD pricing, bounded transactions, database-time grants/fences, shared budget-row locking, reservation across attempts/runs, duplicate denial and durable UNKNOWN before fake upstream transport. The fixed aggregate ceiling is 10,000,000 microUSD. Reconciliation permits only trusted complete usage or positive no-dispatch proof; unknown liability is not automatically refunded, and overage quarantines further work. [S17, S28]

The owner independently accepted candidate 38fb296 after review 72340be for bounded local behavior only. The reviewer verified 23 distinct methods as 21 initial passes plus two focused passes after fixing a Windows test-environment restriction; there was no single final all-green 23-method run. Separate WAL/immediate-stop recovery retained a 354-microUSD UNKNOWN and blocked a second slot. Four owned clusters were stopped with absent pidfiles/processes/listeners. This is process-crash recovery, not RDS power-loss/failover, live peer identity, real provider usage or immutable administrative budget protection. Runtime DDL/reset/replacement DB can bypass a cap unless identity/admin controls are enforced. [S28]

### SDK interruption and partial checkpoint boundary

The full SDK interruption driver, native child process cleanup and checkpoint packaging exist. Four private fixture operations—authorize, commit, load and verify—reuse canonical run binding/object reference/hash/path/validator ownership. The replacement-admission timing defect was repaired: a stale-denial decision cannot precede the named replacement’s admission. The affected 17 controls pass; the original 16 bodies and historical hold were preserved. Root verified distinct-review payloads and integrated accf7ca/878ee87. [S16]

The intended actual proof uses task A and a separate task B with a new fence, verified immutable readback/restoration and current authorization. A stale context check is not itself proof that old physical credentials are denied. completeRecoveryCheckpoint:false and sessionStoreQualified:false are mandatory. The trusted fixture service, current registry/peer checks, durable version readback, atomic publication and live two-task exercise remain unfinished. Full production SessionStore/workspace durability belongs to W05/W09; G1 requires only the honestly bounded durable partial fixture. [S16]

### Browser diagnostics and dedicated host path

The approved path is a new isolated browser host while application/control remain Fargate. Browser assets, loader, supervision and hash-bound export source were reviewed. An inert managed workflow/role and bootstrap/parent process-tree controls exist. The original bootstrap clock expired with cleanup UNKNOWN. Later read-only observations cannot retroactively qualify that cleanup. No browser host has been launched. [S18–S19]

SOURCE4 repaired the diagnostic graph’s structural reachability without enabling ordinary execution: constant-false branches, default refusal, fixed Task Timeout 15s, no Retry/fallback and no secret reveal. Fresh read-only OWNER3 proof 76ecc118-e818-4814-9ef7-d48e161a41c0 consumed exactly 11 CLI calls: current seven-call role chain, fresh STS before each of two TestState calls, fixed instance filter and filtered volume query. Both returned empty arrays without continuation; raw/inspected/variable outputs agreed. Parent exit0 after 17.36s, readers/tree empty and source input stable were independently reconciled. [S18–S19]

That proof was approved 11:25:40.833 UTC and expired 11:35:40.833 UTC. Its source input, action list and clock cannot be reused. The volume query used Filters plus MaxResults5, so it has not established exact VolumeIds missing-ID error shape. SOURCE5 is an unfinished source-only follow-up to DescribeVolumes with only VolumeIds:[vol-0fd44f9ef252181aa]. No fresh action proof or host admission exists. All absence-wire, physical-absence, original-deadline-cleanup, runtime and G1 qualification flags remain false. [S18–S19]

### Temporal design

Accepted offline design d96168bd defines five private roles—external frontend, internal frontend, history, matching and internal worker—with required mTLS, default claim mapper/authorizer and trusted application workers/namespaces. Separate encrypted Multi-AZ PostgreSQL persistence/default visibility, schema/plugin pins, backup/upgrade design, finite Continue-as-New and worker deployment version routing are recorded. Twenty-two offline controls, 43 prohibited cases and typechecking supported design acceptance. Real servers, databases, TLS/JWT admission, HA/load, replay, PITR/restore and upgrades have not run. [S17, S31]

### Frontend and modular ownership

The new private frontend owns apps/web as a thin Next shell, feature components, packages/ui presentation and packages/meri-client browser projection. Backend public contracts and the trusted UI-stream producer remain canonical; no copied private DTOs or agent/provider authority belong in the browser. Portfolio, Modules and Settings have disabled future descriptors instead of speculative services. Forty-four obsolete UI files/references were removed from the new backend after migration verification, retaining 19 transport, two boundary and 15 Elements checks. [S25–S27]

Home offline acceptance at frontend 28c300 includes a successful Next build, eight fresh isolated browser groups, all 19 intrinsic assets/25 slots, six editable suggestion drafts and accessible disabled browse controls without handlers. Narrow widths 320/375/768 and desktop 1440×1040 were checked; no observed external requests or page errors; owned server and context cleanup were confirmed. This is Home-only presentation acceptance, not authenticated streaming, all workspace screens, full visual parity or complete accessibility. [S26]

Original Figma scope had 85 main frames, 29 overlays, 60 states and 15 component families, with 70 variants and 11 walkthrough starts: 189 classified IDs. Final Meri section now has 78 main +29 overlays+60 states+15 families =182; seven Settings frames moved outside Meri but remain in the original scope. Structural discovery is complete enough to preserve scope, but no immutable atomic Figma revision was captured and most semantic control/API/walkthrough acceptance remains. [S05]

## 5 Exact G1 closure checklist

Plan reference: §6 G1, lines 377–379; work packages W01/W02; §4.1 REL-02/05 and RG-08. G1 requires a coherent accepted set of the following evidence. Independent business/UI package work may proceed while the environment gate is open, but no environment advancement may be inferred.

### Component and security register

Current evidence: Versions, licenses and qualification candidates recorded. Earlier image scans exposed open findings.

To close: Scan and independently disposition the exact new images; complete notices, license review, Office qualification and candidate admission. 49 recorded image findings and 5 older vendor findings remain open; do not double-count different image scans.

### REL 02 shared contracts

Current evidence: Strict public 0.1 contracts frozen. Private 0.2 retrieval foundation and one mail full-read contract integrated; list/search candidate reviewed separately.

To close: Root-accept list/search, implement and freeze operation-specific coverage/catalog/skill mapping for all 96 selected intents, preserve all 43 deferrals, prove compatibility and public bridge. Three mail operations would cover only 3 selected IDs.

### Actual proxy authorization

Current evidence: Community LiteLLM import and native TLS prerequisites accepted for bounded scope. Combined schema/auth source is prepared.

To close: Compose the fixed runtime-body collector into a new closed source package; measure final image; run genuine schema/views/lifespan, key creation/use/revocation and nonowner controls under fresh admission and the unchanged start clock.

### Durable cost and usage

Current evidence: Local isolated PostgreSQL integer-money, fencing, reservation, ambiguity and crash behavior exercised.

To close: Deploy trusted budget state with authenticated peer/current grants; qualify actual CountTokens, usage, unknown-outcome reconciliation and aggregate $10 enforcement across attempts, cancellations and concurrency before model inference.

### Fargate worker and SDK fixture

Current evidence: Full SDK driver, checkpoint packaging and four-operation private fixture contract source accepted. Wire/adapter session remains unfinished.

To close: Implement trusted service and channel, immutable version readback and atomic current-fence publication. Prove two separate Fargate tasks interrupt, replace, restore, reauthorize and deny old credentials; verify egress and physical cleanup. Keep partial-fixture flags false.

### Browser sandbox and lifecycle

Current evidence: Fargate browser sandbox failed with EPERM. New-host exception approved. Assets, supervision and bounded read-only diagnostic source exist.

To close: Obtain exact-ID native absence/error shape, review decoder and managed watchdog, arm and verify teardown before any new host creation. Then qualify real nonroot browser and renderer, egress, cancellation, transfer, isolation and teardown within original clocks.

### RG 08 native discovery

Current evidence: Typed discovery design and source inspection only; transport spikes do not pass this gate.

To close: Exercise the real SDK + actual proxy + chosen model with deferred tool discovery, tool-reference/header/schema loading, streaming, cancellation, compaction, resume, authorization and adversarial catalog recall.

### Temporal design

Current evidence: Production topology, persistence, mTLS/auth, versioning, backup and upgrade design accepted offline.

To close: Reconcile all source pins into the G1 record. Production server, persistence, HA, replay, restore and upgrade execution belong to W03/G2 and later staging; do not pretend they already ran or impose full deployment as a G1 design prerequisite.

### Measured cohorts and decision

Current evidence: Audit protocol, cohort definitions and required thresholds recorded; no accepted measured application cohort.

To close: Freeze representative cohorts, collect complete latency/cost including failures/retries, set numeric run/tenant budgets, pass required G1 controls and issue an explicit independent gate decision. Real baseline remains awaiting approved location/owner.

Closure decision: bind exact source/image/task definitions, contract/skill/config versions, operational admissions and independently verified results. Preserve original failures and UNKNOWN cleanup. Review security/license exposure for the exact candidate, confirm all required clauses pass, then record an explicit G1 decision. Do not replace this decision with a percentage complete or a collection of author PASS statements.

## 6 Remaining work by deployment work package

Plan reference: §4 Work queue, lines 173–186. The following includes completed foundations and all outstanding deliverables. Acceptance of an early foundation does not complete the named package. Dependencies determine integration order; allocate bounded, exclusive-path sessions from the final reviewed contracts.

### W00 Discovery and scope freeze

State: Planning accepted with R2 follow-ups

Completed: Inventory, account/repository discovery, accepted 96/43 scope, pilot owner, independent UI ownership, source-policy observations and Figma structural inventory are recorded. REL-01 benchmark protocol is prepared; real-request collection is incomplete.

Remaining: Receive approved location/owner for 75 real examples, resolve canonical pilot identities/client when needed, retain source restrictions and freeze remaining business definitions. Do not treat accepted scope as implemented parity.

References: Plan §3; §4 W00; §4.1 REL-01; G0. Evidence S03–S07, S11.

### W01 Shared contracts and schemas

State: Partly implemented and reviewed

Completed: Public strict 0.1 contracts cover the early lifecycle/event/proposal/artifact/checkpoint boundaries. Private R2 catalog, typed scope/evidence and mail full-read work are incremental. Partial SDK fixture contract and corrected stale-admission timing are accepted.

Remaining: Complete all 96 operation-specific mappings, typed inputs/outputs/errors, one catalog and versioned original skill manifests; root-accept pending mail and remaining metadata; resolve strict enums and federal-market gaps. Map fixtures and UI controls, freeze exact commit and qualified compatibility bridge before dependent business work.

References: Plan §4 W01; §4.1 R-01–R-08, REL-02; G1. Evidence S08–S10, S20–S22.

### W02 Runtime qualification

State: In progress and gating

Completed: Isolated qualification infrastructure, bounded Linux/Prisma/native TLS observations, SDK/worker source, browser assets/supervision/diagnostics, proxy durable-state local exercises and Temporal design exist. Home UI is separately accepted offline.

Remaining: Finish every G1 exit item in this handover. Actual combined proxy auth/revocation, durable budget/model path, two-task SDK recovery, real browser host, RG-08, measured cohorts and exact-image security/license acceptance remain. REL-05 at W02 is runtime-only; later end-to-end integration is W09.

References: Plan §4 W02; §6 G1; §4.1 REL-05 and RG-08. Evidence S12–S20, S23.

### W03 Isolated foundation and deployment

State: Scaffolding and qualification resources only

Completed: New infrastructure definitions, disabled-source boundaries and qualification stack resources exist. This is not an accepted complete development application deployment.

Remaining: After W02, deploy independent CDK/OIDC/ECR pipeline, application/control Fargate services and per-conversation task broker, private networking/egress, IAM, dedicated encrypted application/Temporal persistence, storage, keys/secrets, logs/metrics and runbooks. Prove migrations, identity boundaries, backups, restore and deployment recovery. Product/Temporal migration IDs are not allocated.

References: Plan §4 W03; §6 G2 and concrete deployment sequence; §8. Evidence S12, S17, S24.

### W04 Authorization and source reads

State: Contract and metadata preparation only

Completed: Read-only source inventory and policy review found the current bypass role unsuitable. Two-tenant and within-tenant fixture designs exist. No approved source connection is enabled.

Remaining: Create dedicated nonowner, restricted Capiro identity/read connections through approved connectors. Resolve canonical server-side identities and current memberships. Implement selected source adapters with exact query vs candidate search vs full read, stable paging, provenance, source coverage/freshness and truthful partial/unavailable outcomes. Qualify cross-tenant, within-tenant, stale/revoked grants and full evidence before G3.

References: Plan §4 W04; REL-03/06; R-02–R-06; G3. Evidence S04, S07–S11.

### W05 Durable runs and recovery

State: Source foundations and partial fixture only

Completed: Run/event/checkpoint contracts, fencing concepts, interruption driver and partial fixture metadata are implemented to varying source/offline scopes. Production durability is unqualified.

Remaining: Implement broker/current-fence registry, real SessionStore and independent immutable workspace checkpoints, event replay/reconnect, approvals, schedules, stop/steer/resume/fork and current-policy reauthorization. Prove task loss, retry, cancellation, duplicate prevention, late events and ambiguous writes. SDK mirror success alone cannot establish durable recovery.

References: Plan §4 W05; REL-04/05; §7 recovery targets; G2/G4/G5. Evidence S08, S16–S17.

### W06 Workspace UI

State: Independent repository and offline Home accepted

Completed: Modular frontend owns a thin Next shell, feature UI, shared presentation and browser transport projection. Home assets, disabled browse behavior, responsive checks and an isolated browser acceptance are recorded. Portfolio/Modules/Settings remain future disabled descriptors.

Remaining: Implement and connect remaining Figma workspace screens, overlays and states; identity/session/scoped context, real AI SDK stream/history, stop/steer/resume/fork, evidence, approvals, files/previews/versions, schedules and versioned skill selections. Map every visible control. Complete full desktop/tablet/phone, light/dark, keyboard, focus, dialog, contrast, reduced-motion and long-content acceptance.

References: Plan §4 W06; REL-04; §7 UI criteria; G4. Evidence S05, S25–S27.

### W07 Artifacts and browser

State: Qualification candidates and source only

Completed: Office/PDF package candidates and original artifact boundaries are registered. Browser isolated-host path is approved but no browser host has been launched.

Remaining: Implement original generation/revision skills for DOCX/XLSX/PPTX/PDF; native editability, render/inspect, citations/formulas, immutable versions, preview/download, safe uploads/exports and scoped filing. Qualify public browser workflows first, then approved authenticated sites with isolated credentials, cancellation, revocation and reconstruction after restart.

References: Plan §4 W07; §7 artifact/browser criteria; G4/G6. Evidence S06, S14, S19, S26.

### W08 Selected mutations and governed commands

State: Contracts and intent only

Completed: Approval/proposal/idempotency boundaries are represented; no accepted live selected-command service or production mutation exists.

Remaining: Implement only selected memory proposals/review, task creation and artifact filing plus explicitly selected commands. Bind approval to exact content, scope, source revision and idempotency key; reauthorize at commit; return actual receipts; reconcile uncertain outcomes. Memory confirmation/correction/deletion and other 43 deferred native actions stay deferred unless separately approved.

References: Plan §4 W08; §7 selected mutations; §8 rollback; G5. Evidence S07–S09.

### W09 Independent integrated verification

State: Protocols prepared and narrow reviews complete

Completed: Numerous exact-commit source checks and bounded actual-capture reviews exist. They do not constitute the held-out integrated acceptance suite.

Remaining: Run frozen 75→200 retrieval baseline and held-out oracle evaluations, all applicable RG gates, full REL-05 integration after reads/skills/W03/W05, ≥60 representative E2E tasks, ≥100 adversarial isolation cases, within-tenant policy, recovery/load, artifact and UI visual/accessibility checks. Complete security, license, restore and rollback evidence; REL-09 pre-staging checkpoint precedes W10.

References: Plan §4 W09; §4.1 REL-06/09 and RG table; §7; G3–G6. Evidence S11, S23–S24, S27.

### W10 Immutable staging candidate

State: Not entered

Completed: No full application candidate has been promoted to staging.

Remaining: Publish exact image/source/contract/skill/config/authorization-policy manifest, SBOM/notices, migration compatibility, complete gate evidence and monitored staging deployment. Verify alerting, retention/deletion, restoration, replay, rollback and old-worker compatibility. No mutable tags or unreviewed candidate substitution.

References: Plan §4 W10; §6 G6; §8; REL-09 pre-staging.

### W11 Controlled release and cutover

State: Not entered and not approved

Completed: Current Meri/Capiro still serves independently; no greenfield cutover has occurred.

Remaining: Obtain explicit approval for the exact tested candidate, enroll the authorized internal allowlist, run a separately authorized canary after W10, monitor defined thresholds and exercise rollback. Expand only after results pass. Record release evidence and ownership; preserve old workers and data until the retention/rollback obligations are satisfied.

References: Plan §4 W11; §6 G7; §8; REL-09 release canary.

## 7 Reliability requirements and ticket status

Plan reference: §4.1, lines 193–326. R-01 through R-10 are core. R-11 and R-12 are optional experiments and stay disabled unless separately qualified. All inherited workbook implementation states are proposals, not measured completion. [S09–S11, S23]

### R 01 Canonical catalog and typed operations

One authoritative catalog. Precise names, when-to-use, enums, inputs/outputs and failure semantics. Preserve domain distinctions. Tool count follows evidence.

Current and remaining: Private canonical foundation and one mail mapping integrated; complete all 96 + reviewed freeze and descriptions.

Plan gate mapping: RG-01, RG-04, RG-08. Scope: Core.

### R 02 Server bound scope and entity

Bind tenant, actor, canonical client/entity IDs and grants in trusted code. Recheck at discovery, load, use, resume and destination. Clarify unresolved identity.

Current and remaining: Server-owned authority contracts/design; canonical identities/current entity grants/source bridge unqualified.

Plan gate mapping: RG-02, RG-07, RG-12. Scope: Core.

### R 03 Calendar fiscal year and version

Resolve actor timezone, this week, inclusive/exclusive bounds, fiscal year, bill session, budget stage and exact revision. Validate comparable units.

Current and remaining: Typed time/scope boundaries partial; full calendar/FY/stage/session/version fixtures and live adapters pending.

Plan gate mapping: RG-02, RG-04. Scope: Core.

### R 04 Search exact query and source read

Separate candidate search, typed exact operations and evidence reading. Use qualified lexical/semantic discovery. No raw SQL or giant free-text query contract.

Current and remaining: Search/exact/full-read distinctions represented; no full live adapters or oracle retrieval qualification.

Plan gate mapping: RG-03, RG-04, RG-12. Scope: Core.

### R 05 Evidence coverage and freshness

Uniform success/empty/partial/unavailable status, IDs/revisions, timestamps, checked sources, applied scope, returned/total, cursor and truncation. Read material evidence.

Current and remaining: Envelope/coverage semantics partial; real paging/freshness/provenance and false-absence acceptance pending.

Plan gate mapping: RG-03, RG-05, RG-12. Scope: Core.

### R 06 Native discovery through proxy

Claude SDK owns the loop and native deferred search. Validate actual proxy tool_reference and schema loading. Small catalogs may load upfront.

Current and remaining: Native discovery design/source inspection only; actual SDK/proxy/model deferred search, tool_reference and schema-loading RG-08 remains unrun.

Plan gate mapping: RG-01, RG-08, RG-09. Scope: Core.

### R 07 Skill identity and manifest

UI sends selected ID/version and typed subject/date inputs. Server binds immutable evidence/completion manifest. Natural-language invocation reaches the same resolver.

Current and remaining: 14 selected skill intents preserved; original versioned executable manifests and source grants pending.

Plan gate mapping: RG-02, RG-06, RG-12. Scope: Core.

### R 08 Original scoped skills and Commitments

Retain 14 current quick-action intents as original SDK skills. Qualify required sources. Commitments preserves promises, unknown fields and evidence-backed completion.

Current and remaining: Evidence/completion intent preserved; per-skill rubrics, UI selections and held-out execution pending.

Plan gate mapping: RG-05, RG-06. Scope: Core.

### R 09 Complexity and bounded recovery

Simple questions use main SDK loop. Delegate valuable parallel work. Retry with purposeful bounded source fallback. Preserve verified partial output and budgets.

Current and remaining: Qualification clocks/limits are bounded; integrated cohort latency/cost/run/tenant budgets unmeasured.

Plan gate mapping: RG-09, RG-12. Scope: Core.

### R 10 Traces benchmark and oracle

Trace subject/window, invocation, candidates, arguments, source statuses, evidence, calls and p50/p95 latency. Start 75 real queries and expand to 200 versioned cases with a held-out split.

Current and remaining: Protocol and source-coordinate ledgers prepared; approved real requests/traces and held-out oracle runs absent.

Plan gate mapping: RG-01 through RG-12. Scope: Core.

### R 11 Optional Decisions routing evaluation

Public-beta choice/predicate/score service advises ambiguous family or complexity among authorized supplied options. SDK forms tool arguments. Bypass on error.

Current and remaining: Optional Decisions disabled; no availability/adoption qualification.

Plan gate mapping: RG-09, RG-10. Scope: Optional experiment.

### R 12 Optional calibrated JEV evidence

Evaluate passage/claim/client-fit tasks after retrieval against human labels. No existing JEV router. Calibrate abstention and retain all required evidence.

Current and remaining: Optional JEV disabled; no calibrated task adoption qualification.

Plan gate mapping: RG-11. Scope: Optional experiment.

### Reliability ticket sequence

| Ticket | State | Outstanding dependency or result |
| --- | --- | --- |
| REL-01 | OPEN | Audit protocol and exports prepared; approved 75-real-request location/owner awaited. Collect/redact and establish baseline before expansion. Synthetic data cannot replace the baseline. |
| REL-02 | OPEN | One canonical catalog and typed contracts for all 96 selected native intents, versioned original skill maps and compatibility freeze. First mail full read integrated; list/search root acceptance pending; remaining 93 metadata candidate available. |
| REL-03 | NOT QUALIFIED | Implement and qualify source adapters after accepted REL-02 and W03 live foundation. Current source connections disabled. |
| REL-04 | NOT QUALIFIED | Original versioned skills plus UI identity/scope/window/completion behavior depend on REL-02 and W05 integration. Home offline acceptance is narrower. |
| REL-05 | OPEN | W02/G1 runtime-only checkpoint is incomplete. Full end-to-end recovery/stream/evidence integration runs in W09 after REL-03/04 and W03/W05; do not create a circular prerequisite. |
| REL-06 | NOT RUN | Expand to ≥200 labelled requests and held-out groups with frozen snapshots, exact scopes/args and gold decisive reads after qualified baseline and source/skill/runtime integration. |
| REL-07 | DISABLED OPTIONAL | Decisions shadow experiment only after baseline and actual availability; adopt only if RG-10 passes. No extra model loop or credential authority is implied. |
| REL-08 | DISABLED OPTIONAL | JEV shadow experiment only after task baseline/actual availability; adopt only with task-specific calibrated RG-11 pass. It is not a mandatory selector. |
| REL-09 | NOT RUN | W09 pre-staging checkpoint, then W10 immutable candidate; W11 separately approved release canary. Canary is not a prerequisite that blocks W09. |

Evaluation dataset: collect the approved 75 real requests/redacted traces, adjudicate routing/failure taxonomy, expand to at least 200 versioned labelled examples and freeze authorized snapshots. Preserve expected scopes/arguments, decisive full reads and gold evidence; split related request groups to avoid held-out leakage. Run original/correct-tool/correct-evidence oracle variants with all attempted model/tool costs, errors and latency included. Recall@10 measures discovery units with at most ten gold items; comprehensive paging and full coverage are separate RG-05/RG-12 obligations. [S11]

## 8 Retrieval qualification gates

No full RG gate is currently qualified. Narrow contract/unit/runtime observations support later gate evidence; they are not a measured application benchmark. RG-10 and RG-11 apply only if the corresponding optional service is promoted. Plan reference: §7 reliability table, lines 432–443.

| Gate | Subject | Required pass condition |
| --- | --- | --- |
| RG-01 | Routing correctness | ≥95% accepted route on held-out labelled requests. |
| RG-02 | Scope and time correctness | 100% correct subject, calendar window, fiscal year, stage/session and exact version. |
| RG-03 | Discovery recall | Recall@10 ≥95% on frozen discovery units containing at most 10 gold items; do not discard gold evidence to fit the metric. |
| RG-04 | Exact operations | 100% correct count/status/comparison operations and argument semantics. |
| RG-05 | Coverage and absence | Zero false absence from partial, stale, unavailable or unsearched sources. |
| RG-06 | Skill intent and completion | 100% correct selected skill identity/version, required evidence and completion rubric. |
| RG-07 | Authorization | Zero unauthorized disclosure or mutation; current grants on execution/resume. |
| RG-08 | Native SDK discovery | Real chosen SDK/proxy/model reference/header/schema/stream/cancel/compaction/resume and adversarial catalog recall. |
| RG-09 | Latency and incremental cost | Warm lookup-answer p95 ≤15s. Optional router increment ≤500ms and total regression ≤10%. Retain the separate original ordinary-answer p95 ≤8s cohort; do not substitute one cohort for the other. |
| RG-10 | Optional Decisions | ≥25% relative routing-error reduction with adequate labels/confidence intervals and no scope/argument regression before adoption. |
| RG-11 | Optional JEV | Calibrated task-specific threshold defined before adoption, with no decisive-evidence loss. No invented universal score. |
| RG-12 | Evidence lifecycle | Replay, reconnect, revocation, full source reads, paging/coverage and evidence continuity pass. |

## 9 Full project acceptance targets

Plan reference: §7 Acceptance criteria, lines 407–424, plus the stricter original cohort requirements preserved by R2. These are required future measurements, not current achieved results. Release requires the exact immutable staging candidate and original full suite; optional gates are additional only for optional services actually enabled.

| Area | Target or required evidence |
| --- | --- |
| Representative work | ≥60 representative end-to-end tasks; ≥90% completion; ≥95% checked factual correctness. |
| Isolation and policy | ≥100 adversarial cross-tenant cases; zero leaks; 100% within-tenant policy cases. Agree and measure numeric revocation bound before G3; proposed ≤30s is not yet an accepted measured result. |
| Coverage and parity | 100% of agreed source authorized-read coverage and selected-capability fixture coverage; every selected intent has reviewed typed operation mapping. |
| Native artifacts | 100% benchmark files open and remain natively editable; references/formulas correct; ≥95% human quality; zero critical clipping/corruption. |
| Recovery | 100% agreed restart/retry cases; recovery ≤2 minutes after healthy infrastructure; zero duplicate side effects. |
| UI | 100% visible controls mapped and behavior checked; 100% Figma frames/overlays/states classified; desktop/tablet/phone, light/dark and accessibility coverage. Meri active; future modes honestly disabled. |
| Browser | Every selected browser workflow passes auth/cancel/upload/download/restart/isolation/revocation and qualified sandbox/egress/teardown. |
| Performance and accounting | 10 concurrent runs; UI acknowledgement p95 ≤2s; fresh-task start ≤90s; usage records for 100% of runs and attempts including failed/cancelled/retried work. Set numeric per-run/per-tenant cost budgets after qualification. |
| Operations and release | Retention/deletion and backup/restore pass; exact staging candidate; alerting and rollback; compatible inflight workers/checkpoints and migration plan; licenses/notices complete. |

Budget and deadline distinction: $10 is the approved aggregate synthetic model-test cap; no live enforcement pass yet exists. The SDK/browser operational fixture’s original dispatch deadline is 720 seconds and cleanup ceiling 900 seconds where allocated; the combined proxy auth-start budget is 60 seconds with its separately defined work/cleanup phases. These qualification clocks are not the product’s normal conversation duration or a substitute for measured production budgets. Never extend or restart a consumed T0 to turn a failure into a pass.

## 10 Decisions and inputs still needed

| Input or decision | Known answer | Needed before |
| --- | --- | --- |
| Approved real-request dataset | Human will provide approved location and owner; already requested. Need 75 real requests and redacted traces, consent/access/redaction provenance. | REL-01 measurement and REL-06 expansion. Synthetic fixtures continue independently. |
| Pilot canonical identity and entitlements | Capiro-internal and Neo Martinez accepted; Neo is technical access owner. Canonical tenant/user IDs and current grants not yet enrolled. | Live identity/source integration and G3; no need to re-ask accepted names. |
| Specific client and source grants | Tenant-wide internal pilot first; client-specific access disabled. Dedicated nonowner source identity required. | Client-bound reads/actions; select approved client, mailbox/Monday/source lanes and current grants. |
| Source coverage semantics | 22 inventoried domains and 96 selected intents accepted. Research Portfolio/BizDev basic reads selected; specialized analytics/broad writes deferred. | REL-02/03 typed contracts and per-domain coverage/freshness/completion definition. |
| Numeric operating policies | Proposed revocation ≤30s is not yet accepted/measured. RPO/RTO, retention/legal hold and tenant/run budget values remain pending. | Revocation bound before G3; restore/retention/release policies before G6 or real-data retention. |
| Security and licenses | 49 image +5 older findings open; Office deferred; new SDK image unscanned. Frontend has separate low-advisory/notice follow-up. | Exact-image runtime admission and staging/release; scoped fixture admissions are not global waivers. |
| Architecture departure | No departure from full SDK, Fargate app/control, one Playwright or Temporal approved beyond the browser-host exception. | Any proposed component/placement/scope change; routine compatible fixes may proceed. |
| Exact candidate and release owner approval | No G7 approval or cutover authorized. | After G6 and separately reviewed canary plan; explicit tested candidate approval required. |

Do not ask for passwords/API keys in chat. Use the approved trusted secret-management path and least-privilege workload identities. Approved source access ownership does not itself create a live principal or grant broad data visibility. Decisions and JEV remain disabled; no additional provider key or model call is selected. [S03, S10]

## 11 Recommended resume order

This sequence is an integration recommendation within the approved plan, not a new execution admission. Independent contract, UI and source preparation can proceed in parallel with explicit path ownership. Actual cloud effects remain sequential at each reviewed admission/cleanup boundary.

- On the remote server, start from the published handover branch containing accepted source 2f0e03a. Fetch pending dd98/086263 and SDK WIP 4d33640; pin frontend 28c300. Preserve existing worktrees/evidence and securely recover required private captures. Read current AGENTS, standards, decisions and exact task briefs.

- Finish root review of dd98 mail list/search and 086263 metadata; integrate accepted source with compatibility checks. The accepted collector is already published in the integration/handover branches. Do not enable handlers or public 0.2 exports as an integration shortcut.

- Allocate a new combined proxy SOURCE2 that composes the fixed collector, expected provenance, source/context/archive/recipe and runtime auth source. Root review full closure, define bounded public/private export and fresh policy, then consume one genuine build/run reservation. No retry of previous actual slots.

- Complete SDK wire/adapter source and separate review; implement the trusted fixture endpoint/current-fence registry, authenticated peer, immutable version upload/readback and atomic publication. Scan/publish/admit the exact SDK image. Run the two-Fargate-task interruption/replacement/resume/old-credential/cleanup fixture.

- Complete browser exact-VolumeIds SOURCE5, obtain distinct source review and a fresh root-only read-only action proof. Preserve native error shape. Review absence decoder and complete exact watchdog deployment/role/version/input restrictions; arm and independently verify teardown before any new host launch.

- Qualify the NEW browser host with genuine nonroot browser AND renderer sandbox, no sandbox bypasses, fixed egress and resource controls, cancellation/transfer and positive instance/root-volume teardown by the original ceiling.

- Allocate focused REL-02 domain groups using reviewed metadata, no overlapping catalog/shared-schema writers. Complete all 96 typed mappings and 14 original manifests, strict errors/coverage semantics and compatibility freeze.

- Deploy/authenticate durable budget state and qualify actual SDK/proxy/model deferred discovery RG-08 with the approved Bedrock profile. Enforce $10 across all attempts before paid inference; retain UNKNOWN reservations and complete usage.

- Collect frozen measured cohorts, complete exact-image security/license/component acceptance and independently evaluate every G1 exit item. Issue explicit G1 acceptance only when all pass.

- Proceed W03/G2 isolated foundation, then progressive W04/G3 source reads; implement W05 durable lifecycle, W06 UI and W07 artifacts/browser integration; qualify W08/G5 commands.

- Run W09 integrated held-out/recovery/load/UI/artifact/security/restore verification, publish W10/G6 exact staging candidate and only then seek G7 exact-candidate authorization, internal canary and controlled cutover.

### Multiple bounded Hermes workstreams

Use multiple Hermes implementation sessions for future continuation, as the owner now directs. Codex remains the integration owner and independent validator. Each worker gets a dedicated worktree, exact reviewed base, named writable paths, dependencies, bounded deadline/resources, acceptance checks and explicit external-action limits. Requalify remote CLI options; do not assume plan example flags. Serialize every catalog/shared-schema/lockfile/migration writer. [S33–S35]

| Lane | First bounded delivery |
| --- | --- |
| H1 Proxy/runtime | Compose accepted collector/provenance and combined proxy source; return source-only candidate before separately admitted actual auth/revocation/budget tests. |
| H2 SDK recovery | Finish preserved WIP wire/worker adapter and trusted checkpoint/fence/publication source; independent review precedes two-task actual recovery. |
| H3 Browser | Implement exact-VolumeIds SOURCE5/error handling and qualified watchdog/host preparation; no worker launch/deletion authority. |
| H4 Contracts | Propose cohesive remaining operation families after pending mail/metadata review; preserve all 96 selected intents and 14 original skill maps. |
| H5 Frontend | Implement one assigned remaining Figma feature group in the separate frontend; preserve focused feature ownership and frozen API transport. |
| H6 Verification | Prepare source-bound cohorts, refusal controls and gate matrices independently of the relevant implementer; 75 real requests baseline remains awaited. |

### Codex validates every phase and workstream

At the end of every task, workstream and phase, Codex collects every Hermes commit/handoff and checks the actual diff, affected callers, module ownership, contracts, authorization, cancellation, evidence and cleanup. Codex independently runs meaningful checks on the exact returned commit, preserves failures and returns bounded repair tasks as needed. Integrate only accepted work in dependency order and verify required combined regressions on the intended integrated candidate. Publish exact pins and a GitHub ACCEPT/HOLD decision. Validate all Hermes output, including docs, infrastructure, tests and refactors. Never advance a phase or deployment gate on an author report alone. [S33]

### Remote code pickup and cleanup coordination

The next execution is on a remote server. Published source checkpoints are accepted integration 2f0e03a, pending mail dd98d62, metadata 086263a and unfinished SDK WIP 4d33640. The WIP snapshot byte-preserves all seven interrupted paths without acceptance or new test claims. The publication branch includes accepted integration source plus handover docs; do not resume from old default main alone. Browser SOURCE5 has no implementation diff at publication and needs a new bounded task. Restore pinned dependencies; qualify Windows-specific wrappers before using them remotely. [S35]

[GitHub remote pickup commands and exact source manifest](https://github.com/neo-capiro/meri-greenfield/blob/fb0c25cd690080e36fba992c3443f88be8d65afc/docs/handover/20261011/REMOTE-PICKUP.md)

The active cleanup execution is on another remote server, not this PC. Discover its live server/session/owner through available registries and current repository coordination/branch/PR records, then confirm a fresh handoff/response. Do not treat a local chat ID or stale contributor/PR as its endpoint. Exchange current SHAs, scope, interface/auth/CORS/schema/migration assumptions, fixture/resource ownership and integration/release windows. Publish the agreed boundary record. Repeat coordination before overlaps and at affected workstream/phase ends. Continue independent work while the locator is found; hold only affected shared actions. [S34–S35]

### Close every Hermes session

Codex records session/PID/process-group identity, creation time, checkout, children/resources and deadline before launch. On completion, failure, cancellation or timeout, collect the commit and scrubbed handoff, close the owned session and verify process/children exit. Use a supervisor finally cleanup path; force termination only after exact owned identity checks. Never kill processes by broad name or touch the cleanup execution/shared resources. Revoke scoped temporary credentials and retain source/evidence. Record task and teardown outcomes separately; UNKNOWN physical exit remains unresolved. Reconcile the worker registry before every new wave and phase/workstream end. Leave no dormant Hermes sessions; preserve context in committed handoffs and start a fresh bounded worker for new work. [S33–S35]

[GitHub delegation validation and worker closure instructions](https://github.com/neo-capiro/meri-greenfield/blob/fb0c25cd690080e36fba992c3443f88be8d65afc/docs/handover/20261011/CONTINUATION-INSTRUCTIONS.md)

## 12 Operational continuity and known failure boundaries

### Environment references

| Resource | Recorded identity |
| --- | --- |
| AWS account / profile / region | 967807252336 / capiro-dev / us-east-1; recorded caller arn:aws:iam::967807252336:user/capirocli |
| Qualification VPC / subnet | vpc-06e1941747e798f0a / subnet-0864c000b771df32c |
| CodeBuild | meri-greenfield-qualification-build; standard7 SMALL, privileged, concurrency1, timeout30min/queue5min; no VPC |
| Build role | MeriGreenfield-QualificationBui-BuilderRoleBBEBFA71-8G97EeNmFM0H |
| Artifact bucket / KMS | meri-greenfield-qual-build-967807252336-us-east-1 / 1cca74fc-d9ae-43a6-8bfd-b93107e90042 |
| Browser read-only role | MeriGreenfield-BrowserWireReadOnly-20261010; DescribeInstances/DescribeVolumes read path with SourceAccount trust, no SourceArn condition |
| Historical retained volume / run | vol-0fd44f9ef252181aa / b247b9a1-bfde-414a-a76b-9ff4fdd83110; original cleanup remains UNKNOWN, not admitted for deletion here |
| Bundled runtime root | C:/Users/neoma/.cache/codex-runtimes/codex-primary-runtime/dependencies/; Node/Python and package binaries are pinned in task evidence |

These identities are recorded qualification references, not a fresh AWS inventory or assertion that every resource still exists or has no cost. No new cloud reads were performed for the handover. Describe-role fixed request/VPC filters are narrower than its IAM Resource:* permission; do not call request filters an IAM boundary. The trusted host can pull/export outside the browser container, but the browser worker must remain isolated from those credentials. [S12–S19]

### Preserve before cleanup

Operational captures, dependency pins, source packs, original clocks, receipts and review manifests are often under ignored .task-inputs in multiple worktrees. Git clones and commits do not preserve them. Keep these directories and unfinished SDK files until evidence is safely copied and verified. Separate private key/password/native output areas from scrubbed public evidence; do not blindly archive secrets into the handover, Git or public storage. Local Docker cache can be reconstructed from immutable approved registry/artifact pins, but deleting the only retained raw evidence cannot be repaired by rebuilding an image. [S13–S22, S28–S32]

### Do not replay consumed experiments

- Keep TLS/auth build failures, canary2 UNKNOWN, browser OWNER1 local startup failure and OWNER2 InvalidDefinition, SDK timing hold and Unicode test-preservation correction as immutable history.

- OWNER3 browser proof is consumed/expired. SOURCE4 empty filtered observations cannot prove exact-ID absence, old-clock cleanup or browser admission. Never refresh its expiry or substitute a new T0 into the old record.

- Do not rerun old mint-proof helpers, StartExecution, image/native builds, RunTask, volume deletion or reset/reconcile budget state merely to obtain a green report. Use a separately reviewed source version and fresh explicit admission.

- Migration 0001 is qualification-only durable proxy state. Product/Temporal migration 0002 or any further ID is not allocated. Allocate centrally before authoring.

- Do not silently downgrade the SDK, bypass Chromium sandbox, widen egress/credentials, copy current Capiro internals or change scope to satisfy a failing test.

- Qualified partial fixture flags stay false for full recovery/session-store claims. Private source-bound observations and typed exceptions are not automatically trustworthy remote identity or physical cleanup proof.

### Rollback and compatibility work still required

Plan §8 requires independent kill switches for new runs, writes, schedules, browser and optional services; retained immutable image/contract/skill/config/policy pins; expand/contract migrations and old-worker compatibility; and verified session/workspace preservation, current authorization and terminal outcomes. Do not terminate an active worker before a verified checkpoint unless explicit cancellation or containment requires it. Staging must exercise restore/rollback and inflight workflow version compatibility before cutover. [S24, S31]

## Appendix A Full native capability disposition

Authoritative accepted scope is D012: 96 selected and 43 deferred. The list below reproduces all 139 exact IDs from the reconciled R2 ledger. A selected row is not a handler or parity pass. Current integrated mapping is mail.read_thread only; pending dd98 adds list/search after root acceptance. Every other selected row still needs a reviewed typed replacement mapping and later handler/adaptor/fixture qualification. [S07, S09, S20–S22]

### 96 Selected capabilities

| Exact native ID | Inventory category | Current obligation |
| --- | --- | --- |
| get_research_portfolio | Research Portfolio workflows | Typed mapping outstanding |
| get_research_portfolio_changes | Research Portfolio workflows | Typed mapping outstanding |
| get_research_evidence | Artifacts, files and computation | Typed mapping outstanding |
| read_chat_attachments | Artifacts, files and computation | Typed mapping outstanding |
| read_monday_client_boards | Operational client context and tasks | Typed mapping outstanding |
| search_capiro_data | Unified and public source retrieval | Typed mapping outstanding |
| get_client_context | Operational client context and tasks | Typed mapping outstanding |
| search_research_sources | Unified and public source retrieval | Typed mapping outstanding |
| run_analysis | Artifacts, files and computation | Typed mapping outstanding |
| search_client_knowledge | Operational client context and tasks | Typed mapping outstanding |
| query_intelligence | Government intelligence and public aggregates | Typed mapping outstanding |
| query_knowledge_graph | Relationship graph | Typed mapping outstanding |
| search_memory | Memory lifecycle | Typed mapping outstanding |
| list_memory_proposals | Memory lifecycle | Typed mapping outstanding |
| search_congress_bills | Legislation, status and representation truth | Typed mapping outstanding |
| get_bill_status | Legislation, status and representation truth | Typed mapping outstanding |
| read_bill_text | Legislation, status and representation truth | Typed mapping outstanding |
| get_certification_status | Legislation, status and representation truth | Typed mapping outstanding |
| search_floor_votes | Legislation, status and representation truth | Typed mapping outstanding |
| search_cbo_cost_estimates | Legislation, status and representation truth | Typed mapping outstanding |
| resolve_entity | Legislation, status and representation truth | Typed mapping outstanding |
| search_lda_filings | Government intelligence and public aggregates | Typed mapping outstanding |
| list_global_datasets | Government intelligence and public aggregates | Typed mapping outstanding |
| query_global_data | Government intelligence and public aggregates | Typed mapping outstanding |
| search_sec_filings | Government intelligence and public aggregates | Typed mapping outstanding |
| search_fara_registrations | Government intelligence and public aggregates | Typed mapping outstanding |
| search_federal_grants | Federal market awarded and future rails | Typed mapping outstanding |
| search_federal_awards | Federal market awarded and future rails | Typed mapping outstanding |
| search_gao_reports | Government intelligence and public aggregates | Typed mapping outstanding |
| search_state_bills | Legislation, status and representation truth | Typed mapping outstanding |
| get_state_bill_status | Legislation, status and representation truth | Typed mapping outstanding |
| search_state_floor_votes | Legislation, status and representation truth | Typed mapping outstanding |
| get_state_legislator | Legislation, status and representation truth | Typed mapping outstanding |
| get_committee_roster | Legislation, status and representation truth | Typed mapping outstanding |
| get_representation | Legislation, status and representation truth | Typed mapping outstanding |
| list_members | Legislation, status and representation truth | Typed mapping outstanding |
| get_state_rule_status | Legislation, status and representation truth | Typed mapping outstanding |
| search_intel_articles | Government intelligence and public aggregates | Typed mapping outstanding |
| search_committee_hearings | Government intelligence and public aggregates | Typed mapping outstanding |
| search_legiwatch_news | LegiWatch and exact legislative research | Typed mapping outstanding |
| get_florida_budget_project | LegiWatch and exact legislative research | Typed mapping outstanding |
| search_legislative_research | LegiWatch and exact legislative research | Typed mapping outstanding |
| get_legal_reference | LegiWatch and exact legislative research | Typed mapping outstanding |
| search_crs_reports | Government intelligence and public aggregates | Typed mapping outstanding |
| query_economic_data | Government intelligence and public aggregates | Typed mapping outstanding |
| get_district_nexus_context | Government intelligence and public aggregates | Typed mapping outstanding |
| get_district_nexus_changes | Government intelligence and public aggregates | Typed mapping outstanding |
| search_public_web | Unified and public source retrieval | Typed mapping outstanding |
| scrape_web_page | Unified and public source retrieval | Typed mapping outstanding |
| save_chat_attachments | Artifacts, files and computation | Typed mapping outstanding |
| list_emails | Mail, calendars and meetings | List mapping pending dd98 |
| search_emails | Mail, calendars and meetings | Search mapping pending dd98 |
| get_email_thread | Mail, calendars and meetings | Full-read mapping integrated |
| list_upcoming_meetings | Mail, calendars and meetings | Typed mapping outstanding |
| save_memory | Memory lifecycle | Typed mapping outstanding |
| search_program_elements | Defense budget and acquisition | Typed mapping outstanding |
| get_program_element | Defense budget and acquisition | Typed mapping outstanding |
| get_pe_budget_timeline | Defense budget and acquisition | Typed mapping outstanding |
| get_pe_contractors | Defense budget and acquisition | Typed mapping outstanding |
| get_pe_bills | Defense budget and acquisition | Typed mapping outstanding |
| get_pe_report_language | Defense budget and acquisition | Typed mapping outstanding |
| search_acquisition_personnel | Defense budget and acquisition | Typed mapping outstanding |
| get_acquisition_person | Defense budget and acquisition | Typed mapping outstanding |
| create_word | Artifacts, files and computation | Typed mapping outstanding |
| create_excel | Artifacts, files and computation | Typed mapping outstanding |
| create_powerpoint | Artifacts, files and computation | Typed mapping outstanding |
| schedule_task | Schedules | Typed mapping outstanding |
| list_scheduled_tasks | Schedules | Typed mapping outstanding |
| cancel_scheduled_task | Schedules | Typed mapping outstanding |
| update_scheduled_task | Schedules | Typed mapping outstanding |
| query_tasks | Operational client context and tasks | Typed mapping outstanding |
| query_action_items | Operational client context and tasks | Typed mapping outstanding |
| search_tracked_bills | Legislation, status and representation truth | Typed mapping outstanding |
| query_regulatory_dockets | Legislation, status and representation truth | Typed mapping outstanding |
| search_sam_opportunities | Federal market awarded and future rails | Typed mapping outstanding |
| query_debriefs | Mail, calendars and meetings | Typed mapping outstanding |
| read_client_meetings | Mail, calendars and meetings | Typed mapping outstanding |
| query_outreach | Operational client context and tasks | Typed mapping outstanding |
| read_client_documents | Artifacts, files and computation | Typed mapping outstanding |
| lookup_client_registry | Operational client context and tasks | Typed mapping outstanding |
| create_task | Operational client context and tasks | Typed mapping outstanding |
| update_task | Operational client context and tasks | Typed mapping outstanding |
| find_contacts | Operational client context and tasks | Typed mapping outstanding |
| search_funding_opportunities | Funding opportunity decision workflows | Typed mapping outstanding |
| get_funding_opportunity_requirements | Funding opportunity decision workflows | Typed mapping outstanding |
| get_funding_opportunity | Funding opportunity decision workflows | Typed mapping outstanding |
| get_opportunity_client_context | Funding opportunity decision workflows | Typed mapping outstanding |
| get_opportunity_government_landscape | Funding opportunity decision workflows | Typed mapping outstanding |
| search_federal_contract_awards | Federal market awarded and future rails | Typed mapping outstanding |
| search_federal_subawards | Federal market awarded and future rails | Typed mapping outstanding |
| search_contract_vehicles | Federal market awarded and future rails | Typed mapping outstanding |
| search_procurement_forecasts | Federal market awarded and future rails | Typed mapping outstanding |
| get_business_development_context | Prospect business development | Typed mapping outstanding |
| get_business_development_evidence | Prospect business development | Typed mapping outstanding |
| get_business_development_recent_changes | Prospect business development | Typed mapping outstanding |
| get_district_federal_market | Federal market awarded and future rails | Typed mapping outstanding |

### 43 Deferred capabilities

| Exact native ID | Inventory category | Current obligation |
| --- | --- | --- |
| manage_research_portfolio | Research Portfolio workflows | Deferred by accepted scope |
| get_research_portfolio_analytics | Research Portfolio workflows | Deferred by accepted scope |
| create_research_portfolio_snapshot | Research Portfolio workflows | Deferred by accepted scope |
| request_research_portfolio_output | Research Portfolio workflows | Deferred by accepted scope |
| save_research_portfolio_output_to_client | Research Portfolio workflows | Deferred by accepted scope |
| watch_research_portfolio | Research Portfolio workflows | Deferred by accepted scope |
| update_research_portfolio_change_state | Research Portfolio workflows | Deferred by accepted scope |
| get_research_portfolio_bookmarks | Research Portfolio workflows | Deferred by accepted scope |
| create_research_portfolio_bookmark | Research Portfolio workflows | Deferred by accepted scope |
| get_research_portfolio_fit | Research Portfolio workflows | Deferred by accepted scope |
| get_research_portfolio_reviews | Research Portfolio workflows | Deferred by accepted scope |
| add_research_portfolio_review_note | Research Portfolio workflows | Deferred by accepted scope |
| get_research_portfolio_rules | Research Portfolio workflows | Deferred by accepted scope |
| get_research_portfolio_imports | Research Portfolio workflows | Deferred by accepted scope |
| get_research_portfolio_operations | Research Portfolio workflows | Deferred by accepted scope |
| prepare_research_portfolio_brief | Research Portfolio workflows | Deferred by accepted scope |
| prepare_research_portfolio_meeting | Research Portfolio workflows | Deferred by accepted scope |
| find_path_to | Relationship graph | Deferred by accepted scope |
| get_legiwatch_review | LegiWatch and exact legislative research | Deferred by accepted scope |
| compare_florida_budget_amounts | LegiWatch and exact legislative research | Deferred by accepted scope |
| prepare_legiwatch_briefing | LegiWatch and exact legislative research | Deferred by accepted scope |
| compare_legislative_versions | LegiWatch and exact legislative research | Deferred by accepted scope |
| save_legislative_research | LegiWatch and exact legislative research | Deferred by accepted scope |
| preview_legiwatch_relevance | LegiWatch and exact legislative research | Deferred by accepted scope |
| save_legiwatch_relevance | LegiWatch and exact legislative research | Deferred by accepted scope |
| apply_legiwatch_suggestion | LegiWatch and exact legislative research | Deferred by accepted scope |
| create_meeting_brief | Mail, calendars and meetings | Deferred by accepted scope |
| draft_policy_memo | Artifacts, files and computation | Deferred by accepted scope |
| save_note | Artifacts, files and computation | Deferred by accepted scope |
| send_email | Mail, calendars and meetings | Deferred by accepted scope |
| reply_email | Mail, calendars and meetings | Deferred by accepted scope |
| confirm_memory | Memory lifecycle | Deferred by accepted scope |
| correct_memory | Memory lifecycle | Deferred by accepted scope |
| forget_memory | Memory lifecycle | Deferred by accepted scope |
| get_pe_buyer_workspace | Defense budget and acquisition | Deferred by accepted scope |
| create_client | Operational client context and tasks | Deferred by accepted scope |
| update_client_profile | Operational client context and tasks | Deferred by accepted scope |
| explain_opportunity_match | Funding opportunity decision workflows | Deferred by accepted scope |
| compare_funding_opportunities | Funding opportunity decision workflows | Deferred by accepted scope |
| build_opportunity_action_plan | Funding opportunity decision workflows | Deferred by accepted scope |
| get_business_development_brief | Prospect business development | Deferred by accepted scope |
| resolve_business_development_source | Prospect business development | Deferred by accepted scope |
| save_business_development_brief | Prospect business development | Deferred by accepted scope |

Special scope notes: basic Research Portfolio and BizDev record/evidence reads remain selected. Specialized research analytics, watch/publication/scoring and broad writes remain deferred. Canonical memory confirmation/correction/deletion are deferred; governed new memory proposals/review remain a selected product responsibility. Mapping may consolidate genuinely equivalent operations, but every accepted intent and its distinct authority/evidence semantics must remain covered.

## Appendix B Selected original skill intents

Fourteen R2 quick-action intents are preserved. All still need original executable manifests with version, subject/date/allowed-source inputs, required evidence, completion rubric and per-skill qualification. Do not copy current recipes or this host’s restrictive skill implementations. Ordinary questions must not silently inherit an unrelated workflow. [S09–S11]

| Skill ID | User-visible intent |
| --- | --- |
| quick_skill.research_company | Research a Company |
| quick_skill.relationship_brief | Relationship Brief |
| quick_skill.client_changes | Client Changes |
| quick_skill.portfolio_changes | Portfolio Changes |
| quick_skill.portfolio_overlap | Portfolio Overlap |
| quick_skill.mail_history | Mail History |
| quick_skill.meeting_prep | Meeting Prep Brief |
| quick_skill.commitments_audit | Commitments & Deliverables |
| quick_skill.funding_opportunity_match | Funding Opportunity Match |
| quick_skill.pe_deep_dive | PE Deep Dive |
| quick_skill.bill_watch | Bill Watch |
| quick_skill.hearing_watch | Hearing Watch |
| quick_skill.representation_lookup | Representation Lookup |
| quick_skill.regulatory_docket_brief | Regulatory Docket Brief |

Commitments & Deliverables is required. Preserve promises versus suggestions; unknown owner/date; conflicting evidence; deduplication; evidence-backed completion; and explicit Monday coverage. Extraction is not authorization to create tasks. Missing granted lanes must produce truthful partial/clarify/block outcomes instead of a comprehensive promise. Broader research must stay within agreed source grants. [S10]

## Appendix C Data domains and remaining connector work

All 22 source domains were inventoried; no accepted live greenfield source connection is enabled. Every selected domain needs server-owned current authorization, exact/search/full-read semantics where relevant, bounded paging, stable IDs/revisions, provenance, coverage/freshness, truthful errors/absence and held-out fixtures. [S04, S07, S11]

| Domain ID | Required source family |
| --- | --- |
| client_portfolio | Client and portfolio context |
| client_documents | Client and source documents |
| mail_messages | Authorized mailbox/message/thread evidence |
| contacts | Contacts and relationship context |
| meetings_and_debriefs | Meeting/debrief evidence and consent-bound transcripts |
| engagement_tasks | Engagement tasks and explicitly mapped Monday coverage |
| action_items | Action-item and commitment records |
| outreach | Outreach evidence and status |
| institutional_memory | Governed memory reads and proposals |
| tracked_legislation | Tracked bills and legislative status |
| committee_hearings | Committee/hearing records |
| government_directory | Government and congressional entities |
| regulatory_dockets | Rules, notices and docket evidence |
| federal_intelligence_sources | Federal source/news intelligence |
| economic_data | Economic series and exact units/time windows |
| defense_budget | Distinct chamber/family/fiscal-year/stage/version pipelines |
| federal_opportunities | Procurement/solicitation opportunities |
| client_funding_pipeline | Client-specific funding pipeline |
| federal_awards | Federal award records |
| federal_grants | Grant opportunities and awards |
| public_registries | Public registry evidence |
| public_web | Qualified public-web discovery and full reads |

Cross-cutting gaps include independently uploaded/chat files, strategies and separate service schemas, graph/history/embeddings, consent-bound Krisp records, Research Portfolio/BizDev subsets, federal_market district schemas, new schedules and authenticated browser workflows. Source adapters must not impersonate tenant authorization by relying on the current broad application role. No unrestricted SQL/free-text supertool is permitted.

## Appendix D Component pins and qualification state

These are recorded candidate/adopted versions at the snapshot, not claims about the latest upstream release. A pin does not mean security, license, runtime or integrated behavior is qualified. See COMPONENTS.md and exact source/image manifests before running a fixture. [S06]

| Component | Recorded pin | Acceptance limit |
| --- | --- | --- |
| Claude Agent SDK / bundled CLI | 0.3.295 / 2.1.295 | Sole model loop; source/static qualification partial; actual task recovery and discovery open. |
| AI SDK transport | @ai-sdk/react 4.0.140; ai 7.0.137 | UI transport only; not a second agent loop. |
| AI Elements / frontend | 1.9 source pin; Next 16.4; React 19.3 | Home offline accepted; all workspace integration and remaining licenses pending. |
| Playwright MCP / engine | 0.0.83; playwright/core 1.64.0-alpha-1790635538000 | One browser integration candidate; actual approved host qualification open. |
| Chromium browser | 1247 / 155.0.8059.12 | Playwright controls Chromium; they are complementary. Fargate namespace sandbox failed; dedicated host approved. |
| Temporal server / TS SDK | 1.32.1 / 1.24.0 | Production design accepted; live deployment, auth/TLS/HA/restore/replay unrun. |
| LiteLLM community proxy | 1.104.2 | OSS path; no Enterprise assumption. Import/TLS prerequisite accepted, actual full auth/discovery/budget path open. |
| Contracts | Ajv 8.20; ajv-formats 3.0.1; canonicalize 5.1 | Canonical strict validators/hashes reused; public 0.1 and private 0.2 boundaries preserved. |
| Identity / AWS SDK | Clerk backend 3.23.1; S3 client 3.1148 | Current grants and workload authentication not live-qualified. |
| Infrastructure | CDK lib 2.273; CLI 2.1145; constructs 10.8 | Qualification resources exist; full application foundation gate pending. |
| DOCX / spreadsheet | python-docx 1.2; XlsxWriter 3.2.9; openpyxl 3.1.5 | Product artifact candidates; Office runtime/security/native artifact qualification deferred. |
| Slides / PDF | PptxGenJS 4.0.1; PDF.js 6.4.299; pypdf 6.20 | Original product skills only; candidates are not qualified services. |
| Evaluation / telemetry | Promptfoo 0.124.1; OpenTelemetry API 1.9.1 | Integrated held-out and live telemetry gates unrun. |

Separate frontend follow-ups include seven low advisories and the full react-remove-scroll-bar 2.3.8 notice; these are separate from the 49 image and five older vendor findings. Historical dependency risks include embedded libpq16.9, tokenizer/NumPy exceptions, archive contributor provenance and bundled/native consumers. Reconcile each exact final image and all copies rather than accepting an earlier digest’s scan for a new one. [S06, S28]

## Appendix E Evidence index and reference rules

Every source entry below links to published GitHub documents and exact revisions through the reference index. This includes the adopted and earlier plans, workbook, canonical reports, pending candidate reports, remote code checkpoints and continuation instructions. Private raw .task-inputs are operational captures, retained outside Git; the published evidence-status report states their safe hashes, locations and verification limits. Remote code pickup is possible from GitHub; any required private capture needs separate secure recovery. No credential or raw private archive is included.

### S01 Adopted deployment plan R2

[GitHub S01 documents and exact revisions](https://github.com/neo-capiro/meri-greenfield/blob/fb0c25cd690080e36fba992c3443f88be8d65afc/docs/handover/20261011/REFERENCE-INDEX.md#s01)

SHA256 43f9be7c385a1e321dbc9721bd7ff97752031a62e661f7691b78e0a20fd7c388; 86,848 bytes.

[Open the exact adopted deployment plan on GitHub](https://github.com/neo-capiro/meri-greenfield/blob/f2d6c0b8bdb728bcccc8628538e678711b679c1c/docs/plans/MERI-DEPLOYMENT.md)

### S02 Pinned workbook and input manifest

[GitHub S02 documents and exact revisions](https://github.com/neo-capiro/meri-greenfield/blob/fb0c25cd690080e36fba992c3443f88be8d65afc/docs/handover/20261011/REFERENCE-INDEX.md#s02)

SHA256 3d281d7a1a9a1eaf4fe520dde8e46e2abedac82f6b771041a613c1cfb0df25ec; 127,877 bytes. Downloads copy is locked; pinned copy hash reverified.

### S03 Human authority and engineering rules

[GitHub S03 documents and exact revisions](https://github.com/neo-capiro/meri-greenfield/blob/fb0c25cd690080e36fba992c3443f88be8d65afc/docs/handover/20261011/REFERENCE-INDEX.md#s03)

D010 Codex-only; D012 scope/pilot; D014 frontend. Two historical D013 headings exist: cite heading/date, not number alone.

### S04 G0 accepted discovery

[GitHub S04 documents and exact revisions](https://github.com/neo-capiro/meri-greenfield/blob/fb0c25cd690080e36fba992c3443f88be8d65afc/docs/handover/20261011/REFERENCE-INDEX.md#s04)

Discovery/policy observations and pending live enrollment; planning acceptance retained.

### S05 Figma final inventory

[GitHub S05 documents and exact revisions](https://github.com/neo-capiro/meri-greenfield/blob/fb0c25cd690080e36fba992c3443f88be8d65afc/docs/handover/20261011/REFERENCE-INDEX.md#s05)

189 original classified IDs across Meri/Settings split; structural classification does not establish behavior acceptance.

Figma file Zc2dEN5aLU47dVdsewDmiJ; page411:40601; Meri section439:81406; Home442:81437. Separate Capiro sections are outside the Meri implementation scope; relocated Settings frames stay accounted for.

[Open the standalone Meri Figma section](https://www.figma.com/design/Zc2dEN5aLU47dVdsewDmiJ/Capiro-3.0-%E2%80%94-UI-Redesign?node-id=439-81406)

[Open the Meri Home Figma reference](https://www.figma.com/design/Zc2dEN5aLU47dVdsewDmiJ/Capiro-3.0-%E2%80%94-UI-Redesign?node-id=442-81437)

### S06 Component and security register

[GitHub S06 documents and exact revisions](https://github.com/neo-capiro/meri-greenfield/blob/fb0c25cd690080e36fba992c3443f88be8d65afc/docs/handover/20261011/REFERENCE-INDEX.md#s06)

Pinned versions, image history, Office and license/security qualification holds.

### S07 Source and capability scope

[GitHub S07 documents and exact revisions](https://github.com/neo-capiro/meri-greenfield/blob/fb0c25cd690080e36fba992c3443f88be8d65afc/docs/handover/20261011/REFERENCE-INDEX.md#s07)

22 domains, 139 native IDs, accepted 96/43 disposition; replacement nulls in inherited ledger are historical coordination data.

### S08 Canonical public contracts

[GitHub S08 documents and exact revisions](https://github.com/neo-capiro/meri-greenfield/blob/fb0c25cd690080e36fba992c3443f88be8d65afc/docs/handover/20261011/REFERENCE-INDEX.md#s08)

Strict 0.1 public contracts; regenerate generated artifacts through generator.

### S09 R2 typed retrieval foundation

[GitHub S09 documents and exact revisions](https://github.com/neo-capiro/meri-greenfield/blob/fb0c25cd690080e36fba992c3443f88be8d65afc/docs/handover/20261011/REFERENCE-INDEX.md#s09)

Private additive 0.2 namespace, selected intents and source references. No complete runtime parity.

### S10 R2 reconciliation

[GitHub S10 documents and exact revisions](https://github.com/neo-capiro/meri-greenfield/blob/fb0c25cd690080e36fba992c3443f88be8d65afc/docs/handover/20261011/REFERENCE-INDEX.md#s10)

Ten sheets reconciled; six ledgers; original formulas not recalculated; optional providers disabled.

### S11 Retrieval baseline protocol

[GitHub S11 documents and exact revisions](https://github.com/neo-capiro/meri-greenfield/blob/fb0c25cd690080e36fba992c3443f88be8d65afc/docs/handover/20261011/REFERENCE-INDEX.md#s11)

75→200 labelled baseline, snapshots/oracles/diagnostics and pending real data.

### S12 Qualification infrastructure and active owner notes

[GitHub S12 documents and exact revisions](https://github.com/neo-capiro/meri-greenfield/blob/fb0c25cd690080e36fba992c3443f88be8d65afc/docs/handover/20261011/REFERENCE-INDEX.md#s12)

Published STATUS at 11:30 UTC is older than local collector and subsequent actual browser review; see this handover deltas.

### S13 Native TLS bounded actual result

[GitHub S13 documents and exact revisions](https://github.com/neo-capiro/meri-greenfield/blob/fb0c25cd690080e36fba992c3443f88be8d65afc/docs/handover/20261011/REFERENCE-INDEX.md#s13)

CodeBuild 6baed94e-1d9f-4e5e-bf56-dce4f9b0e660; image a748fe7184c8879b12c0f1cd0aa924b14408c7e14583cf55ad3e8dabc33b9611. Five controls pass; bounded scope only.

### S14 Combined native proxy source

[GitHub S14 documents and exact revisions](https://github.com/neo-capiro/meri-greenfield/blob/fb0c25cd690080e36fba992c3443f88be8d65afc/docs/handover/20261011/REFERENCE-INDEX.md#s14)

Integrated 9998ade; 21-member preparation and 353-file context; actual combined application auth not run.

### S15 Runtime body provenance and collector

[GitHub S15 documents and exact revisions](https://github.com/neo-capiro/meri-greenfield/blob/fb0c25cd690080e36fba992c3443f88be8d65afc/docs/handover/20261011/REFERENCE-INDEX.md#s15)

13036c0 provenance; collector 1f68d7d → local 2f0e03a. Root 23/23 controls, source only; actual image collection unrun.

### S16 SDK fixture and interruption

[GitHub S16 documents and exact revisions](https://github.com/neo-capiro/meri-greenfield/blob/fb0c25cd690080e36fba992c3443f88be8d65afc/docs/handover/20261011/REFERENCE-INDEX.md#s16)

accf7ca/878ee87 corrected fixture contract; mandatory partial flags remain false. Worker wire/adapter unfinished separately.

### S17 Proxy durable state and Temporal

[GitHub S17 documents and exact revisions](https://github.com/neo-capiro/meri-greenfield/blob/fb0c25cd690080e36fba992c3443f88be8d65afc/docs/handover/20261011/REFERENCE-INDEX.md#s17)

Local PostgreSQL crash/race evidence; accepted Temporal design. No production database/HA/restore acceptance.

### S18 Browser SOURCE4 actual diagnostic

[GitHub S18 documents and exact revisions](https://github.com/neo-capiro/meri-greenfield/blob/fb0c25cd690080e36fba992c3443f88be8d65afc/docs/handover/20261011/REFERENCE-INDEX.md#s18)

Proof 76ecc118-e818-4814-9ef7-d48e161a41c0 consumed and expired. 11 calls, two empty filtered replies; no host/cleanup/absence admission.

### S19 Browser actual independent review and enforcement

[GitHub S19 documents and exact revisions](https://github.com/neo-capiro/meri-greenfield/blob/fb0c25cd690080e36fba992c3443f88be8d65afc/docs/handover/20261011/REFERENCE-INDEX.md#s19)

79 review payloads and 1,176 refs. Genuine sandbox/host qualification remains open; exact-volume source follow-up unfinished.

### S20 Mail first full read contract

[GitHub S20 documents and exact revisions](https://github.com/neo-capiro/meri-greenfield/blob/fb0c25cd690080e36fba992c3443f88be8d65afc/docs/handover/20261011/REFERENCE-INDEX.md#s20)

867a9e1 integrated; root 55 checks; no handler or live source.

### S21 Mail list search pending candidate

[GitHub S21 documents and exact revisions](https://github.com/neo-capiro/meri-greenfield/blob/fb0c25cd690080e36fba992c3443f88be8d65afc/docs/handover/20261011/REFERENCE-INDEX.md#s21)

dd98d6268d2e7057b4ef236bb2fd352f0fb0cec6; distinct ACCEPT_SOURCE_ONLY; root acceptance/integration pending. 68 distinct author test names, not one final whole-suite replay.

### S22 Remaining capability metadata

[GitHub S22 documents and exact revisions](https://github.com/neo-capiro/meri-greenfield/blob/fb0c25cd690080e36fba992c3443f88be8d65afc/docs/handover/20261011/REFERENCE-INDEX.md#s22)

086263abdf1b5c34b502a44d957b5568e837f992; 93 intents, 86 literal/2 partial enum/5 missing schemas; metadata only, root review pending.

### S23 R2 qualification records

[GitHub S23 documents and exact revisions](https://github.com/neo-capiro/meri-greenfield/blob/fb0c25cd690080e36fba992c3443f88be8d65afc/docs/handover/20261011/REFERENCE-INDEX.md#s23)

Exported PENDING fields are source inventory state, not live gate results.

### S24 Rollback and deployment obligations

[GitHub S24 documents and exact revisions](https://github.com/neo-capiro/meri-greenfield/blob/fb0c25cd690080e36fba992c3443f88be8d65afc/docs/handover/20261011/REFERENCE-INDEX.md#s24)

No staging/release/cutover accepted; production restore/rollback remains future work.

### S25 Frontend architecture

[GitHub S25 documents and exact revisions](https://github.com/neo-capiro/meri-greenfield/blob/fb0c25cd690080e36fba992c3443f88be8d65afc/docs/handover/20261011/REFERENCE-INDEX.md#s25)

Private neo-capiro/capiro-frontend; clean main 28c300093c0886018c49df8764a8e6fac44819eb.

### S26 Home acceptance

[GitHub S26 documents and exact revisions](https://github.com/neo-capiro/meri-greenfield/blob/fb0c25cd690080e36fba992c3443f88be8d65afc/docs/handover/20261011/REFERENCE-INDEX.md#s26)

Offline Next build and 8 browser groups pass; 19 assets/25 slots; no live backend acceptance.

### S27 UI transport and Elements fixture separation

[GitHub S27 documents and exact revisions](https://github.com/neo-capiro/meri-greenfield/blob/fb0c25cd690080e36fba992c3443f88be8d65afc/docs/handover/20261011/REFERENCE-INDEX.md#s27)

Backend removed 44 obsolete UI files after verification; preserved transport/Elements checks; full workspace remains pending.

### S28 Durable state independent and owner acceptance

[GitHub S28 documents and exact revisions](https://github.com/neo-capiro/meri-greenfield/blob/fb0c25cd690080e36fba992c3443f88be8d65afc/docs/handover/20261011/REFERENCE-INDEX.md#s28)

38fb296 candidate / 72340be distinct review. Owner accepted bounded local PostgreSQL source/persistence behavior; not live runtime durability.

### S29 Managed canary historical acceptance

[GitHub S29 documents and exact revisions](https://github.com/neo-capiro/meri-greenfield/blob/fb0c25cd690080e36fba992c3443f88be8d65afc/docs/handover/20261011/REFERENCE-INDEX.md#s29)

One task start/stop; STOPPED confirmed within original deadlines. Workload FAILED exit137. Canary2 cleanup UNKNOWN retained.

### S30 Native SDK loopback owner and distinct review

[GitHub S30 documents and exact revisions](https://github.com/neo-capiro/meri-greenfield/blob/fb0c25cd690080e36fba992c3443f88be8d65afc/docs/handover/20261011/REFERENCE-INDEX.md#s30)

Synthetic native tool_use/tool_result/end_turn fixture; physical STOPPED exit0. No real provider/discovery/resume proof.

### S31 Accepted offline Temporal design

[GitHub S31 documents and exact revisions](https://github.com/neo-capiro/meri-greenfield/blob/fb0c25cd690080e36fba992c3443f88be8d65afc/docs/handover/20261011/REFERENCE-INDEX.md#s31)

d96168bd1a05511533dc0b63e622d0dd56f30526; design/offline only.

### S32 Handover data audit

[GitHub S32 documents and exact revisions](https://github.com/neo-capiro/meri-greenfield/blob/fb0c25cd690080e36fba992c3443f88be8d65afc/docs/handover/20261011/REFERENCE-INDEX.md#s32)

78,821 bytes; SHA256 b89ae6b1a161ba39a352fd9d4d5395e1126bdee10dba4112f4725ad7b2af6d57. 48 evidence pins. Collector pending wording in this audit is superseded by root 2f0e03a acceptance.

### S33 Latest continuation and validation direction

[GitHub S33 documents and exact revisions](https://github.com/neo-capiro/meri-greenfield/blob/fb0c25cd690080e36fba992c3443f88be8d65afc/docs/handover/20261011/REFERENCE-INDEX.md#s33)

Latest human direction: multiple bounded Hermes workers, cleanup-session coordination and Codex validation of every delivery and integrated candidate at each phase/workstream end. No Hermes worker was launched by handover publication.

### S34 Cleanup coordination inputs

[GitHub S34 documents and exact revisions](https://github.com/neo-capiro/meri-greenfield/blob/fb0c25cd690080e36fba992c3443f88be8d65afc/docs/handover/20261011/REFERENCE-INDEX.md#s34)

Verified GitHub plan paths at d5a4e0ac82f8a313ae44c6b8f6b199adc71f1ed7. Current cleanup execution is on another remote server; locator/owner not verified here. Discover and confirm that live execution before overlaps or release; cleanup is not greenfield acceptance.

### S35 Remote code pickup and published checkpoints

[GitHub S35 documents and exact revisions](https://github.com/neo-capiro/meri-greenfield/blob/fb0c25cd690080e36fba992c3443f88be8d65afc/docs/handover/20261011/REFERENCE-INDEX.md#s35)

Accepted source 2f0e03a, pending dd98d62 and 086263a, unfinished SDK WIP 4d33640 were pushed and remote refs verified. Seven original SDK paths are byte-preserved. Browser SOURCE5 has no implementation diff. Raw private evidence needs secure recovery; no dormant Hermes sessions.

### Deployment plan locator

| Plan location | What to consult |
| --- | --- |
| §1, lines27–126 | Architecture, responsibility boundaries, model loop, identity, artifacts and lifecycle. |
| §3, lines133–169 | Discovery and repository layout. |
| §4, lines170–187 | W00–W11 work queue and dependencies; no W12. |
| §4.1, lines193–326 | R-01–R-12, 14 skill intents, evidence envelope, 75→200 audit and REL-01–REL-09. |
| §6, lines371–399 | G0–G7 and concrete deployment sequence. |
| §7, lines401–443 | Project acceptance metrics and RG-01–RG-12. |
| §8, lines457–475 | Rollback, old-worker/session compatibility and immutable release pins. |
| §9–§11, lines477–655 | Bounded brief template, embedded kickoff example and required documentation. Latest human continuation direction governs delegation and independent Codex validation. |

Use cited decisions and sealed captures to reproduce each acceptance boundary. Source/local passes do not advance a deployment gate; this handover grants no new release authority.
