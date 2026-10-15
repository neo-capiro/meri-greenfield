# Meri comprehensive audit and implementation handoff

**Disposition: HOLD for the complete product and release.** This publication consolidates four bounded audits from 15 October 2026. It preserves their exact source pins, counterexamples, partial successes, failed checks and unrun gates. Fable retains implementation ownership. This is a documentation handoff; it neither integrates the candidate branches nor accepts their contracts, deployment or runtime behavior.

The source has substantial reusable controls: one Claude Agent SDK execution loop, deterministic Temporal orchestration, canonical run/checkpoint/issuance fences, immutable artifact versions, current-authority checks and deliberately unavailable disconnected surfaces. The remaining work includes concrete defects, missing composition and missing qualification. Those categories need different evidence to close.

## Reports and evidence boundaries

| Delivered report | Coverage and reading guidance |
|---|---|
| [Lifecycle and architecture](lifecycle-report.md) | L1–L6: pause/checkpoint publication, concrete startup ownership, conversation history, crash recovery, conditional legacy cleanup and schedules. |
| [Security and release](security-release-report.md) | SEC-REL-01–06: proxy wire compatibility, canonical budget/model-grant composition, task security profile, sealed image, deployment closure and release controls. |
| [Product integration](meri-audit-product-integration.md) | Four cross-repository gaps: startup, continuing conversation, real desktop surfaces and durable Objective → Strategy → Planner completion. |
| [Data, artifacts, memory and retention](data-artifacts-report.md) | DA-1–4, retention/restore, native artifacts, memory/source ownership, and the final selected-tool exposure addendum. This is the final supplied `AUDIT-REPORT.md`, renamed for this directory. |
| [96-operation coverage CSV](TOOL-COVERAGE-96.csv) | One row per selected legacy capability, its current replacement, declaration status and pinned evidence. Read with the data report's final addendum. |

The original reviewers used selected exact-pinned source and narrow synthetic probes. Their overlapping collections of 209, 79 and 76 materialized files are not an exhaustive repository census and must not be summed. The product lane traced source without executing the product. The other reports identify exactly which source-extracted control flows, synthetic adapters, generator checks or OOXML inspections they ran. They did not establish real PostgreSQL/Temporal/S3/SDK/provider/AWS/browser/native-Office behavior. Historical receipts remain historical; publishing this directory does not rerun them.

The five supplied files were assembled from the complete numbered delivery and independently verified against every supplied byte count and SHA-256. No report prose or source CSV bytes were revised. Mentions of `TOOL-COVERAGE-96.json`, `proxy-route-probe.py` and `proxy-route-probe-result.json` refer to the original reviewers' companion artifacts; those files are not included in this approved delivery. Their absence must not be mistaken for a public reproducibility bundle. The directory-local `.gitattributes` preserves the supplied CSV's CRLF bytes without changing repository-wide behavior.

## Immutable snapshot and prior decisions

The audit snapshot spans approximately 18:37–18:55 UTC on 15 October 2026; each report gives its own observation time. Later branch changes require a new exact-pin review. In the security report, “Main source reviewed here” describes its primary reviewed candidate, **not the repository's `main` branch**.

| Boundary | Exact reviewed identity |
|---|---|
| Meri shared candidate | `ba40647c5b6f1f81773869e41ce82c099d64d505` |
| Meri default `main` | `8b123bea4c90794dc2d766814b6ddbdbfe0928bc`; does not contain the reviewed candidate product startup |
| Separate P1a candidate | `6d9bb391005f73c8be6ec636c346a05381b5bd98` |
| Separate P1b candidate | `06b2f4991cfd9d85ea20fee1b7b9cb3bd721dc40` |
| Separate P1c candidate | `e0f94fe00a65ddd7f3f663bc2eafd25def7dfda4` |
| Frontend candidate | `9b4de0583d5300183a2582fcc70350b3114200cd`; earlier reviewed candidate `a0b58a2b9d26fb13bc5c38c21e6eafd68245a93b` |
| Frontend default `main` | `02c02d95bdf3949662b9123f425271c6491ffdab` |
| Backend application baseline / separate runtime candidate | `4945791dfc8e755a2abaddfa60cdcf670ee20712` / `f4f9e1361d92ac0afadd67c1cae3f5faefa829ec` |
| Backend default | `backend-import`, `c76f5fc0df6688743afeec274211afd2e67fe8f1`; not a branch named `main` |

The sibling P1 branches are not one integrated candidate. Their existence does not establish merged-main behavior. The [master crosswalk at 9a41cfe](https://github.com/neo-capiro/meri-greenfield/blob/9a41cfe54174cdd11cdfbd84e90cc8087bdfc0d6/docs/coordination/master-crosswalk-20261015/README.md) and [deployment plan at the shared candidate](https://github.com/neo-capiro/meri-greenfield/blob/ba40647c5b6f1f81773869e41ce82c099d64d505/docs/plans/MERI-DEPLOYMENT.md) remain reference inputs. Historical G0 acceptance does not pass G1–G7.

The four existing HOLD records remain in force at their stated pins:

| Prior review | Carried-forward issues and limits |
|---|---|
| [P1a HOLD](https://github.com/neo-capiro/meri-greenfield/blob/7606375dd30bafcde2a6a002efffbcf1c311bc66/docs/coordination/reports/DOT-REVIEW-FABLE-P1A-6d9bb391-20261015.md) | Hook-failure latching, plugin alias/trusted-path boundaries, implicit Bash eligibility and telemetry compatibility. Source and contract freeze remain HOLD. |
| [P1b HOLD](https://github.com/neo-capiro/meri-greenfield/blob/7606375dd30bafcde2a6a002efffbcf1c311bc66/docs/coordination/reports/DOT-REVIEW-FABLE-P1B-06b2f499-20261015.md) | Uncertain usage liability released too early; final awaited download-read authority race in `apps/runtime/artifacts/download-links.mjs`; stale manifest hashes. Source remains HOLD. |
| [P1c HOLD and browser direction](https://github.com/neo-capiro/meri-greenfield/blob/7606375dd30bafcde2a6a002efffbcf1c311bc66/docs/coordination/reports/DOT-REVIEW-FABLE-P1C-e0f94fe0-20261015.md) | Consequential-action controls before effects, download limits/filename races, DOCX qualification, actual egress/redirect/private-address enforcement and profile persistence evidence. Source/live qualification remain HOLD. |
| [Frontend HOLD](https://github.com/neo-capiro/meri-greenfield/blob/7606375dd30bafcde2a6a002efffbcf1c311bc66/docs/coordination/reports/DOT-REVIEW-FRONTEND-a0b58a2b-20261015.md) | File-tree keyboard/ARIA, adoption provenance and genuine SSR evidence at `a0b58a2b…`. Do not automatically transfer that verdict or its reported checks to successor bytes. The `9b4de058…` delta changes mobile CSS/navigation tests, not those desktop requirements. |

The [tenant-budget allocation](https://github.com/neo-capiro/meri-greenfield/blob/1b61483d2a9e554fa4818533c5cb09eb952af3de/docs/coordination/tasks/CODEX-TENANT-BUDGET-0002-ALLOCATION-20261015.md) reserves `apps/gateway/budget/migrations/0002_tenant_budgets.sql` exclusively for Fable's source authoring in `meri_product_budget`. It preserves product-budget `0001`; it is not SQL execution authority or P1b acceptance. Conversation `0011` and the conditional custody `0012` allocation/authoring hold remain separate and unchanged by this publication.

## Reconciled outcome matrix

This matrix groups repeated mechanisms. Product §1 is the umbrella startup gap; its lifecycle, artifact, action, schedule, source, retention and proxy requirements are not extra independent defects every time another report mentions them. Product §2 overlaps lifecycle history/recovery while adding distinct frontend limitations. No aggregate defect count is asserted.

| Required outcome / references | Concrete source defect or restriction | Missing integration | Missing qualification / closure evidence |
|---|---|---|---|
| Safe pause and approval checkpoint; L1 | A committed hold can reject a normal stream append, abort the SDK before capture, then reject failure publication, leaving a running/held run. Reproduced with a modeled SQL gate and synthetic ports. | Coordinate control claim, publication fencing and checkpoint capture without weakening the durable fence. | Real interleaving and recovery evidence against the integrated database/SDK/worker. |
| Trusted product startup; L2, Product §1, SEC-REL-02/05, data integration sections | Missing ports can persist a successor then report unknown effect without dispatch. Fail-closed unavailable defaults are intentional. | Actual startup must compose current authority, continuation/admission/retirement/approval, artifacts/actions/tasks/sessions, schedules, sources, retention and proxy/budget owners. Factory tests alone do not do this. | Authenticated end-to-end startup and denial/revocation tests with real owners. |
| Conversation-wide history and usable next turn; L3, Product §2 | Conversation-wide sequence bases meet run-local history/cursors and latest-binding admission. Frontend remains a one-run composer with a QueryClient-only journal. | Canonical authorized discovery/history, explicit new-turn admission and durable reload/ACK recovery; preserve immutable command/input identity. Historical read admission must not imply old writer eligibility. | Multi-turn, paging, reload, reconnect, old-history selection and lost-ACK cases without duplicate effects or identity substitution. |
| Crash recovery and Stop → next prompt; L4 | One-attempt workflows lack production crash reconciliation; failed/cancelled latest runs cannot use the completed-source next-run path. | Original-attempt reconciliation and current-authority recovery/retirement, followed by an explicitly admitted valid next run. | Healthy-infrastructure recovery within two minutes, physical cleanup and no duplicate effects; no blind retry or stale checkpoint reuse. |
| Physical task cleanup; L5 and prior P1c | L5's abort/stop defect applies to default/non-prepared mode. Prepared mode already uses an independent stop signal and refuses terminal success if cleanup is unknown. | Carry the qualified cleanup contract through actual admitted modes. | Real cancellation, heartbeat failure, stop uncertainty and task/grant retirement. Do not generalize the legacy counterexample to prepared cleanup. |
| Durable schedules; L6 | UNKNOWN intentionally blocks replacement; it is not safe evidence that an effect never occurred. | Product dispatch/run issuance and exact UNKNOWN reconciliation are absent. | Real claim/generation/expiry/cancel/recovery and duplicate-effect controls. No second scheduler or blind redispatch. |
| Retention, deletion and restore; DA-1/4, data retention, SEC-REL-05 | DA-1 deletes synthetic objects before rejecting a mismatched SQL subject, leaving no per-step UNKNOWN; DA-4 releases uncertain rollback/unlock leases as reusable. | Preflight all targets; authoritative ledger/reconciler/purge startup; restore serving fence and recovered watermark; complete data-class inventory. | Real transactional/lease fault tests, suppression-before-serving, deletion across all retained classes and restored backups. No live disclosure or live purge was observed. Keep purge inactive until safe. |
| Editable native artifacts; DA-2/3, data artifacts, Product §3 | PDF revision sends PDF bytes to the DOCX parser; permitted multi-element PPTX slides overlap. PDF is currently rejected by the application surface, so its defect is not a demonstrated deployed regression. | Governed PDF/PPTX/analysis routes, revisions, previews and filing alongside existing DOCX/TXT/XLSX owners. | Native open/render/recalculate, formulas/reference totals, layout, byte identity, authority/CAS/replay, real storage/KMS and admitted renderer sandbox. OOXML/generator results alone do not qualify native output. |
| Institutional sources, memory and skills; data addendum, Product §3 | Declarations and conditional source bindings are much narrower than the selected inventory; details below. No claim that every lower-level module is absent. | Ordinary conversational access through the canonical typed gateway, current installations/grants and explicit capability admission; all governed non-read paths; real memory proposal/review/correction behavior. | Real SDK invocation, tenant/client/source boundaries, revoke/expiry/restore negatives and held-out workflow quality. Historical deferrals need scope reconciliation. |
| Complete desktop and default-on browser; Product §3, prior P1c/frontend | Many Runs/Approvals/Memory/Routines/Data-access surfaces are fixtures; Preferences is disabled/unpersisted and has inherited route issues. Prior keyboard/SSR and browser findings remain separate. | Real hosts/settings and qualified browser composition. Browser **ON by default** is desired final product behavior. | Genuine exact-pin SSR, keyboard/stream/history/terminal behavior, real browser/renderer sandbox, destination deny-by-default, redirect/private-address controls and pre-execution consequential-action policy. Mobile remains deferred. |
| Durable Objective → Strategy → Planner; Product §4 | Follow-through is browser-owned; suspension/closure can stop automatic Planner continuation. Existing Strategy/version/job completion is already atomic. | Server-owned continuation with canonical association, authority, result custody and application receipts; inert intent/source candidates are not a dispatcher. | Close/reopen/crash/ACK-loss, concurrent revision and current-authority cases; exact output identity and no duplicate model query or product effect. |
| Actual model-proxy compatibility; SEC-REL-01 | Retained ingress rejects observed CLI `POST /v1/messages?beta=true`; empty-query acceptance was reproduced using the exact ingress scope validator. | Correct the actual retained proxy path, rather than only a stand-in. | Pinned CLI/SDK through the real approved proxy/provider composition; no new provider success was established. |
| Canonical budget and model grants; SEC-REL-02, prior P1b | Product and qualification namespaces are split; retargeted runs reuse configured proxy material rather than demonstrating fresh per-run model authority. Prior uncertain-liability defect remains. | One canonical product budget/ledger, current peer-bound model grants, revocation and settlement. | Real admission/late settlement/concurrency/expiry/cancel tests. This audit demonstrated neither deployed overspend nor an authorization bypass. |
| Task isolation and release identity; SEC-REL-03/04 | Task identity/shape checks do not attest the complete security profile. The unsealed-image producer correctly refuses incomplete input. | Complete task role/non-root/read-only filesystem/capability/mount/env/egress profile and immutable integrated source/image closure. | Native readback and negative controls, provenance/SBOM and zero HIGH/CRITICAL findings on the exact admitted immutable digest. Old scans cannot qualify a new image. |
| Deployment and operations; SEC-REL-05/06 | Historical first-prompt migration/runbook coverage is incomplete for the newer product. No observed GitHub workflows/statuses is not proof that external CI or branch protection is absent. | Current migration/dependency/startup/recovery/TLS/authority/proxy/Temporal/network manifest; integrated suites, CI and operational ownership. | Exact-candidate migration/privilege/runtime checks, observable failures/recovery and cleanup receipts. No shared database migration or deployment is authorized here. |

## Corrected tool and scope accounting

At the reviewed shared candidate and unchanged relevant P1a paths:

| Measure | Source-accounted result | What it does not establish |
|---|---|---|
| Historical registry scope | 139 original capabilities = 96 selected + 43 historically deferred | Today's final exclusions or fresh write authority |
| Contract catalog | 97 descriptors | 97 implemented/reachable handlers |
| Manifest inventory | 14 indexed manifests, 54 unique declared IDs | All promised workflows being executable |
| Current selected replacements declared | **53/96 = 52 reads + `create_word`** | General conversational or live-qualified access |
| Current selected replacements undeclared | **43/96 = 33 reads + 10 non-reads** | The separate 43 historical deferrals |
| Selected capability mix | 85 reads + 11 non-reads | Permission to expose non-reads under read-only hints |
| Actual selected-skill MCP source constructor | Two skills (`relationship_brief`, `commitments_audit`), union 11 IDs | 11 live-qualified reads, or all 14 workflows |
| Ordinary no-skill institutional MCP binding | Zero at these pins absent capability policy | Absence of reusable gateway/source implementations |

The corrected read arithmetic is **47 literal legacy-name read matches + 6 renamed read IDs − 1 historical `query_action_items` match = 52 declared current reads**, then `create_word` gives 53. The six renamed IDs are the mail and meeting mappings enumerated in the data addendum and CSV. The selected current `actions.query` contract is not the historical narrower `query_action_items` descriptor; silently aliasing their scopes would hide a real difference. `create_word` is declared in Bill Watch, which the two-skill MCP constructor does not admit. P1a's plugin projection and prose do not mount all declared operations.

Use the existing typed gateway, installed source catalog, current grants and canonical product owners. General institutional access should not require a recipe selection, fabricated skill, generic SQL tool, unrestricted query path, second authorization system or second model loop. Every admitted non-read needs a governed conversational path through its artifact/command/schedule/proposal owner; a separate HTTP button alone does not establish conversational parity. Source admission and runtime qualification remain gates. The historical workflow registry's NOT_QUALIFIED dispositions are not cleared by this accounting.

The two sets of 43 have different meanings. The data report's wording that historically deferred mutations “stay deferred” records the old disposition; it does **not** settle the latest “complete it all” direction. Fable needs a reconciled final scope ledger that names every inclusion, continued exclusion, owner and acceptance gate. Do not silently perpetuate those exclusions or infer permission to expand writes. Application retention/deletion, memory proposals and sourced corrections remain independently required. Mobile is explicitly deferred relative to desktop. Browser-off is not the final completion state.

## Prioritized repair and integration sequence

1. **Make effect boundaries safe before activation.** Repair L1 and applicable L5 cleanup, DA-1/4, the real proxy route and carried-forward P1a/P1b/P1c findings. Retain uncertainty barriers, financial liability, current read authority and publication fences. Keep purge and unqualified consequential surfaces inactive until their defects and gates are closed.
2. **Reconcile scope and one ownership graph.** Select reviewed contracts and an integrated source candidate; name canonical startup, authority, persistence, budget/proxy, per-run issuance/revocation and cleanup owners. Resolve shared-file/migration allocations before implementation. This publication supplies no new wire freeze or migration authority.
3. **Complete durable continuation and recovery.** Compose history, pause/approval/resume/fork, explicit next turn, crash/ACK-loss recovery, schedules and retention/restore fences. Complete server-owned Objective → Strategy → Planner using canonical output identities and receipts. Preserve original authority/expiry and immutable same-command mapping; UNKNOWN never licenses redispatch.
4. **Complete real product surfaces.** Bind approved institutional reads and governed non-reads; complete memory, tasks, settings and desktop hosts. Repair PDF/PPTX internals before admitting their formats, then qualify revisions/previews/filing. Compose browser-on behavior with separately qualified network and action controls. Preserve the single SDK loop and canonical domain owners.
5. **Seal one release candidate.** Close dependency/migration/deployment manifests, current suites, CI, task security profile, image provenance/SBOM and exact-digest security admission. Retain failed/blocked checks and explain changed reasons for reruns; do not promote partial receipts into a clean release.
6. **Qualify the actual approved composition.** Run the end-to-end and negative cases below against the same source/image/policy identities. Independently record acceptance per gate. Source acceptance and synthetic tests remain useful evidence, not substitutes for runtime acceptance.

## End-to-end completion criteria

Completion requires a traceable scope/owner ledger and evidence for the complete admitted path:

- Current authenticated tenant/actor/client authority, real source installations and capability policy; ordinary and selected-skill institutional reads plus governed commands, memory, tasks, schedules and artifacts. Prove denial, cross-client/tenant isolation, expiry, revocation and suppression without leaking withheld data.
- A conversation that survives multiple turns, history paging, reload/reconnect, pause/approval/resume/fork, Stop/new prompt and lost acknowledgments. Recover the same identities and retained input, preserve immutable mappings, retire physical tasks/revoke grants, and demonstrate healthy-infrastructure recovery within two minutes with zero duplicate effects.
- Browser-independent Objective → Strategy → Planner completion with exact requested/applied source identities, canonical outputs, immutable result custody and current authority. A completed model run alone is not a Core application receipt.
- Authoritative retention/deletion across the complete inventory and restored backups; serving remains fenced until suppression/recovery is reconciled. Demonstrate per-step uncertainty, safe database lease disposal and no unauthorized disclosure.
- Browser ON by default on the approved host, with measured non-root browser/renderer sandbox and actual egress/redirect/private-address enforcement. Destination deny-by-default and consequential-action controls operate before effects; safe downloads and profile isolation/persistence are proven.
- All admitted native artifact families and promised workflows, including revisions and filing, against held-out cases: **100% native openability and supported formulas/reference totals correct; at least 95% human quality; no critical clipping/corruption; zero unauthorized disclosure.** Generator success, magic bytes, XML inspection and fixture rendering do not replace native qualification.
- Real desktop hosts/settings and exact-pin interaction/SSR evidence, without promoting the 337 open native acceptance rows or previously reported tests into fresh passes. Mobile remains deferred.
- One immutable integrated source/image with complete deployment, migrations/privileges, task isolation, TLS/proxy/budget/Temporal bindings, provenance/SBOM, zero HIGH/CRITICAL image admission, operational failure/recovery evidence and owned cleanup. All original G1–G7 and product acceptance gates remain in force.

Fable's handoff should name the exact source/image/policy, paths changed, checks actually executed, retained failures, current gate decisions and unresolved owners for each increment. No implementation, model/provider call, database migration, AWS/trust/credential change, merge or deployment was performed by this publication lane.

## Supplied-file integrity

| File | Bytes | SHA-256 |
|---|---:|---|
| `lifecycle-report.md` | 29,453 | `2853e7ed5bd2ecc67e8a366271fb956bca2ee976a0f4eec6387ceaf0814b27c0` |
| `security-release-report.md` | 18,819 | `d1009c57c690e077fcc171b9f70983d7b83a26e2bd0c68bcd7e0e3bc91aaffd2` |
| `meri-audit-product-integration.md` | 15,889 | `71c72122b0dc5c1f13cbec5eb8a39f4b95f3edf17054f470e0bea8108ad5aa32` |
| `data-artifacts-report.md` | 29,540 | `b1f6f5b5825127d2dff61cdc103c7b88858333c8e78f5774a15cb8a95385385d` |
| `TOOL-COVERAGE-96.csv` | 25,248 | `42dc47fb19a326bb2ed0b45c03f293ea27478a004e29916741aabeecb38977a1` |

The CSV has a header plus 96 unique mapping rows and retains its original 97 CRLF sequences. Original report whitespace is preserved to keep these hashes exact.
