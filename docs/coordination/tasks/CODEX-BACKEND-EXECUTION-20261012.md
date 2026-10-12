# Backend execution continuation — 12 October 2026

Base: PR35 `1f7bf122f6180534c8bd43ff93a4f102f1a4eaf8`. Requirements receipt reference: PR36 `cbbd8c5a7fe94d977b7da896ff7d01c959815fac`. Owner: Codex root; dedicated branch `task/meri-backend-execution-20261012`. Source/local tests and draft publication only. No cloud, paid model, database service, customer data, security, frontend or native worker qualification changes.

## Implementation outline and exclusive ownership

- `gateway_author` implements the concrete fixed-route HTTP memory-proposal source adapter and handler in `apps/gateway/sources/memory-proposals/`; `gateway_reviewer` independently tests the exact freeze. They reuse canonical dispatch, current authority, budget settlement, result validation and retained paging context. Trusted host credential brokerage is an external dependency. The producer test is a synthetic local HTTP endpoint; production stays unavailable.
- `memory_author` implements private client/knowledge families for six selected operations; `memory_reviewer` independently traces and reviews them. They own `client-knowledge*` schemas/modules/tests only. The canonical loader/catalog remains root-owned. Private source bodies must not enter evidence.
- `readiness_author` implements private public/legal/research families for six selected operations; `native_supervisor_author` independently reviews them. They own `research-legal*` and `public-domain*` schemas/modules/tests only. Scoped legal/LegiWatch views and complete context-plane hearing responses must be preserved.
- Root owns integration, canonical registry/loader, the remaining fourteen selected IDs, and current source execution work. Root starts with schedule-read boundaries and command/artifact dependencies; implementation is limited to semantics established by the adopted plan and pinned source metadata. Source-closed work proceeds while consequential policy questions remain explicit. No second scheduler, authorization engine or model loop is permitted.

All delegated branches start at the same PR35 base. Each author records its own bounded module/API outline before coding, preserves raw failed checks, freezes a commit, and receives independent ACCEPT_SOURCE or HOLD. Root integrates only accepted source and separately reviews combined behavior. Existing tests, public0.1 and all original branches/evidence remain preserved. Local check groups must exit physically; no background services remain. Each implementation turn is bounded by its concrete slice and handoff, not an unattended scheduler.

## Scope ledger at start

The original inventory remains 139 = 96 selected + 43 deferred. The canonical catalog at this base has 70 mapped selected IDs, 26 pending IDs and 71 typed descriptors, all unavailable. A mapping is not an executable handler or runtime acceptance.

| Owner pair | Pending selected IDs |
| --- | --- |
| Client/knowledge | read_chat_attachments; read_monday_client_boards; get_client_context; search_client_knowledge; query_knowledge_graph; search_memory |
| Public/legal/research | search_research_sources; search_legislative_research; get_legal_reference; query_global_data; search_committee_hearings; search_legiwatch_news |
| Root | get_research_evidence; query_action_items; schedule_task; list_scheduled_tasks; cancel_scheduled_task; update_scheduled_task; save_memory; create_task; update_task; save_chat_attachments; create_word; create_excel; create_powerpoint; run_analysis |

The memory-proposal execution slice connects an already mapped operation and does not decrement this list. Private task-create/artifact-file contracts already exist, but do not by themselves close the native selected mappings or execution paths. No fixture is a reduced release scope.

## Decisions and dependencies

Administrator memory self-approval is already approved; do not reopen it. Proposal-only memory creation must not accidentally call an auto-commit producer branch. Ordinary task update rights and `get_research_evidence` Clio/portfolio meaning require explicit owner decisions; no stricter rights are inferred. New Temporal mutation actions need explicit immutable intent and lifecycle semantics, preserving the approved platform and public0.1 separation. Native worker owner retains SDK/image/runtime qualification. Source receipts consume immutable native dependencies without duplicating that lane.

## Current evidence boundary

The 53-requirement join remains two completed source/discovery requirements, 51 whole requirements pending, zero whole requirements qualified at runtime. G0 accepted, G1 OPEN, G2–G7 unentered. PR36 is an immutable historical receipt join.

Latest parent correction: frozen frontend d5 second build `18b3316a-9403-40f9-807b-3ddf24c40d7b` FAILED at **20:06:43 UTC on 12 October 2026**, Docker exit1; no image and no scan. Failure investigation belongs to the shipping owner. This supersedes the earlier running observation without editing frozen prior evidence. Native 33+9+12 checks remain parent-reported until immutable packets are received here.

## Acceptance checks

Meaningful adapter/handler behavior, current identity/expiry/revocation and late settlement controls; strict scalar/variant/paging/correlation checks for every accepted family; canonical source/hash/registry consistency; public distribution preservation; unchanged original tests or explicitly reviewed reversible expectation repairs; raw failure/preimage preservation; exact commit and process-exit receipts. Live policy, JWT broker attestation, native persistence, deployment, renderer/browser, recovery, budgets and full release gates remain separately unqualified.
