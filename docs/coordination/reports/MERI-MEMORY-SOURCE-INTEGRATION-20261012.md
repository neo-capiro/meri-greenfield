# Memory read binding and approved policy description

**ACCEPT_SOURCE only. G0 accepted; G1 OPEN; G2–G7 unentered.** Both candidates received separate independent acceptance before integration. All source connectivity, handlers and consequential memory actions remain unavailable. This is a new continuation stacked on preserved PR10, not main-merge or runtime approval.

Combined tested source: `d0f4ca2ca0bbeda0b336130cfd4fb36f4ab60d59`, tree `d12b28a50e91709ee8cc888ea24f4d96c5361f0a`. Base PR10 remains `7ba0e9d10ebf684e162dcc7c143915afdbf00f32`, tree `26527e06900f4c63dc81c7d394dd50e45c4febaf`. Later commits contain evidence/report/publication metadata only. The [integration task](../tasks/MERI-MEMORY-READ-SOURCE-INTEGRATION-20261012.md) records the chosen prerequisite, accepted scope and exclusive ownership before implementation.

| Candidate | Author freeze | Independent acceptance |
| --- | --- | --- |
| Canonical own-pending proposal read binding | `a210db8445537ccfad301d1266e9c53ea71201ac` | `33a22f6a1122d14c6c3b9fb41950aa21cf8940b0` |
| Administrator exception description and wording | `81be4ebf1a7483e80ae96fe787404c770958622e` | `24ff12ba8f966fefb7f107f050315f1e47f9c35a` |

Both exact author commits and their independent review/failure history are ancestors of the combined source. Root verified all ten changed source/test paths byte-for-byte against their respective accepted authors. Of 1,965 PR10 tracked files, 1,956 remain byte-identical; the only existing changes are four private composition/catalog files, three intentional test expectations and two current status documents. All public 0.1 files, schema and family validators, locks, gateway code, original R2 classifications and historical failure packets remain unchanged.

## Canonical read binding

Private `memory.list_own_proposals@0.2.0` now resolves the existing proposal input/result family through the single canonical binding table. Catalog version advances from 0.2.1 to 0.2.2; the family schema and operation version remain 0.2.0. Memory context admits only a trusted subject and retained prior request/page; original request is additionally required for output validation. Existing thirteen operations retain their original context grammar, callbacks and exact descriptors. No parallel catalog or authorization implementation was added.

The original inventory remains **139 capabilities: 96 selected / 43 deferred; 14 bound unavailable / 82 selected unmapped**. Every descriptor has a null handler, pending qualification, unimplemented availability and zero retries. All fourteen skill intents remain unqualified. [Derived accounting](../../qualification/candidates/memory-read-binding-20261012/integration/capability-accounting.json) and the [capability table](../../CAPABILITY-CATALOG.md) come from the unchanged inventory plus the canonical catalog; neither is a runtime registry.

The read exposes only the actor's pending proposal queue. Text stays unapproved; complete queue metadata does not become approved facts, evidence readiness or a general absence assertion. Model selectors cannot substitute a trusted client or actor. Normalization preserves immutable original arguments and hashes the effective selection. Existing continuation, redaction, bounded content and finite timestamp checks are reused.

The [independent read review](MERI-MEMORY-READ-BINDING-REVIEW-20261012.md) passed twelve new controls, 45 focused checks, 232 root tests, 34 gateway tests and public generation/types/seven tests. It identified an R-02 traceability omission before final freeze; the author added that descriptor reference and reran checks. Original mapping/count assertions were updated only for the intentional registration; their baseline bytes and three expected pre-update failures remain preserved. Historical family comments saying unregistered are retained in unchanged source; the new canonical binding and current documentation supersede that historical mapping state.

## Approved administrator exception

Neo approved retaining the existing Institutional Memory administrator self-approval exception. The [decision](../../decisions/MEMORY-ADMIN-SELF-APPROVAL-20261012.md) supersedes the former unresolved choice while preserving its historical evidence. Exact roles `user_admin` and `capiro_admin` may follow the existing authorized shared approval path, including their own pending proposal, without being assigned reviewer. Current tenant, actor, membership, client/wall and canonical transaction checks remain required. Ordinary firm approval is not granted by a generic review grant; eligible ordinary client reviewers retain current grant, assignment and different-proposer requirements.

Shared self-rejection stays distinct and refused for proposers including administrators; withdrawal is the separate proposer action. Private-owner review and the recognized automated proposal flows retain their existing boundaries. No new roles, privileges, live grant changes or approval operations were introduced.

The private `memoryReviewPolicy` descriptor owns this explanation and `memoryReviewPolicyText({scope, action})` derives wording from it. The selector takes no actor, role, grant or candidate facts, returns no authorization decision, and rejects effectful/unknown input before access. The [independent policy review](MERI-MEMORY-POLICY-REVIEW-20261012.md) passed 25 checks and verified nineteen private source references without publishing bodies. Bounded pure-helper and isolated action-guard characterizations remain explicitly synthetic; static service/database prerequisites were not executed.

An independent prefreeze wording failure (8 pass / 1 fail) proved the administrator assignment exception was not explicit enough; unchanged controls pass after the correction. Initial source-characterization harness diagnostics and the author's import-inventory failure are preserved with their corrected interpretations. Node's internal PipeWrap initialization did not prove a launched service; the corrected safe-import check requires bounded natural child exit. Root's earlier selector finding was source inspection; its two runtime controls sampled the repaired prefreeze source and passed. No failing runtime reproduction is invented.

This repository has no live governed save/review wrapper to consume the new description. The decision names exact pinned capirov2 rule/wrapper spans and proposed wording for its source owner; those files and the shared frontend were not edited. Existing source consumer integration and actual policy enforcement therefore remain open dependencies, rather than completed runtime behavior.

## Combined verification

All checks below ran against exact combined source `d0f4ca2...` with zero source diff. Exact commands, outputs, hashes, process IDs and cleanup observations are under [integration evidence](../../qualification/candidates/memory-read-binding-20261012/integration/verification.json).

| Check | Result |
| --- | --- |
| `npm run check` | **244/244 PASS** |
| Existing gateway source/authority/budget/cancellation controls | **79/79 PASS** |
| Independent read, original memory negatives, policy/recorded-outcome and selector controls | **35/35 PASS** |
| Public generated output, strict TypeScript, package tests | **PASS; 7/7** |
| Original freshly shortened release deadline with parked budget settlement | **PASS**, finishes within the original 100 ms observation; one uncertainty receipt |
| Derived 139-row inventory, exact older thirteen descriptors, current documentation mappings | **PASS** |
| Ten accepted source paths, preserved base files, full-diff whitespace | **PASS** |
| Five owned check process groups | **Absent**, no group kill required; reparented npm descendants reaped with successful status |

The historical thirteen-operation gateway composition test stays immutable at PR10. Its catalog cardinality belongs to that snapshot; the current fourteen-operation composition is exercised by the independently written binding controls. All original gateway behavior controls and the original deadline probe were rerun on the combined source. The session-source test filename containing “Hermes” denotes local source tests, not a Hermes/model launch. Recorded policy-outcome assertions do not constitute fresh native authorization evidence.

## Remaining dependencies and handoff

1. A future memory adapter must construct authenticated current subject context, retain prior request/page ownership, prove proposer/client/wall scope and cursor/source lineage, and reauthorize after resume. Current gateway dispatch supplies legacy clock/actor context and is not a qualified memory caller. All handlers stay disabled until this is implemented and qualified.
2. The capirov2 source owner must correct its contradictory wrapper/rule promises; a qualified Meri save/review wrapper must consume the approved description while invoking the actual authority and transaction boundaries. No new policy choice is requested from Neo; that choice is resolved.
3. Continue source contracts for the remaining 82 selected unmapped capabilities and fourteen skills without reducing the original scope. Preserve Claude Agent SDK model orchestration, Temporal durability, AI SDK/Elements transport and governed trusted proxies. No legacy implementation or host artifact skills were copied.
4. Native runner/artifact intake, supported patched image/dependency/license closure, task identity/authentication/expiry/revocation, durable budgets, native task-A/B recovery/stale rejection, browser/renderer sandboxes, egress/watchdog/teardown and artifact inspection remain runtime gates. The parent reports separately approved local capture/upload resumed; no native artifacts have been returned to this source owner. Local source checks close none of those gates.

The old image `sha256:8d1ec09aa78f47a11019089dacde93289fc66a39f55bd4357e59eeb25d9b52ac` remains prohibited (47 findings, including five critical and seventeen high). Existing Aurora remains selected. Aggregate paid-model allowance is unreconciled and exact infrastructure/security/action authority is not established here. No paid model/provider call, image build/push/launch, resource/credential creation, customer-data action, security/network/database change, main merge or deployment occurred. Root leaves all original branches and other owners' processes intact.
