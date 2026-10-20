# Meri read-tool receiving handoff

Review PR: https://github.com/neo-capiro/meri-greenfield/pull/189
Branch: `codex/meri-read-tools-20261019`.
Base: `98d3c96a2c944a8211856e98b5bd62e824b4b5f7`, verified descendant of frozen image source `34851020aa0d73fead4db59ba6e26a098e2d0313`.
Core reference: `138c04373b18bb730b1ad0f8f9338342f628b8c6`, inspected read-only.
Coherent tested source: local `3751b35326aef3169cef98a16d2c1d7ba502c043`; later receiving commits add review/evidence only. The final immutable publication receipt is `MERI-READ-TOOLS-PUBLICATION-20261019.md`, and the PR head gives the current published commit. Original authored pins in lane reports are local provenance; use the published consolidated branch for continuation rather than assuming those local commit objects exist remotely.

This assignment has completed the independent Meri work and reached explicit Core/qualification dependencies. It does not establish live capabilities or completion of Meri as a product. No merges, image builds, AWS operations, live databases, migrations, credentials, provider calls or frontend/Core source edits occurred. PR175 was re-read and remains `993f52a97e5d9edcf65c9f89423c097aa52831c7`; the PR188 branch remains at the supplied evidence head. No frozen input or deployment material was advanced.

## Operation status and routes

The source-verified before/after gap list is [MERI-READ-GAPS-20261019.md](MERI-READ-GAPS-20261019.md). It traces catalog, policy, ordinary SDK registration, startup, handler, Core producer and canonical result validation. Every completed row below is **source-integrated and synthetically exercised**. None is exact-image qualified, deployed or live-verified by this lane.

| Operations | Canonical Meri implementation / startup | Existing producer and remaining gate |
| --- | --- | --- |
| `get_research_portfolio`, `get_research_portfolio_changes` | `retained-reads/research-florida-task-ports.mjs` → existing `task-ports.mjs`, retained context/control/principal owners and `gateway/sources/research-portfolio` | Signed POST `/api/clio/retained-reads/research-portfolio[-changes]`; current Core authority/principal issuer siblings. Needs public trust pins, enabled receiver and actual current portfolio grant qualification. |
| `get_research_evidence` | Same selected composer → existing `research-evidence-task-port.mjs` and canonical GET adapter | `/api/research-portfolios/:id/reviews`, `/snapshots/:recordId`, `/annual-review`. Uses current attended user Bearer and current viewer grant, never an opaque delegated handle. |
| `get_florida_budget_project` | Same selected composer → existing retained FL context/principal/transport and Florida projection | Core retained authority/issuer, signed Intel POST `/intel-api/internal/legiwatch/retained-florida-budget`. Needs actual Core/Intel trust and current session/folder/client scope. |
| `read_monday_client_boards` | `retained-reads/mail-monday-task-ports.mjs`, signed Monday adapter, current signed credential relay | POST `/api/clio/tools/read_monday_client_boards`. Exact Core `readWithCurrentMondayMapping` checks actor/client/mapped boards before and after the read; no mapping receipt is exported. Adapter now consumes that actual producer contract, preserving source actor/client validation. |
| `query_tasks` (and retained `query_action_items`) | Existing original tracking handler; dispatcher threads trusted invocation; operational task port requests exact original flat-body one-use token | POST `/api/clio/tools/query_tasks` (or `/query_action_items`). Selected-client discovery only. Existing current Core task owner checks membership, client and Portfolio task grants. No ordinary Bearer fallback for these composed task calls. |
| `search_research_sources` | New `research-legal-candidates` family/context/handler; existing native current-reference owner; general SDK registration | POST `/api/clio/tools/search_research_sources`. Needs exact Core Option B allowlist admission and actual client/directory-note source qualification. Six capped candidate branches are preserved; no invented cursor, complete corpus or freshness proof. |
| `search_legiwatch_news` | Existing `research-legal-news` native adapter, now in general read policy | Existing tool POST and Intel owner. Only supported exact-source/personnel-with-explicit-year slice is admitted; implicit monitor/window context stays unavailable. |
| `get_legal_reference` | Existing `research-legal-legislation` handler, now in policy operation subset | Existing tool POST and Intel owner. Parser-independent rules/versions/explicit-ID slice only; unavailable citation parsing remains unavailable. |
| `query_outreach` | Existing `outreach-query` native adapter, now registered with required client scope | Existing tool POST. Explicit selected-client campaign-list slice only; detail/linked-resource expansion is not added. |
| `get_business_development_evidence` | Existing BD family extended with canonical stored evidence handler; selected-client signed-only boundary and current native conversation receipt | Existing tool POST → `getEvidence` → local dossier `suppressJev=true`. Needs exact Core allowlist admission and an actual owned native conversation/prospect/linked-client relationship; a model UUID cannot bridge greenfield/native custody. Personal and ordinary Bearer paths refuse. |
| `mail.list_messages`, `mail.search_messages`, `mail.read_thread` | Conditional canonical task-port composition implemented and tested; **excluded from production selected composer** | Existing signed dotted tool POSTs and canonical Core 0.2 pages exist. Needs authoritative mailbox source-scope admission across task/claims/delegation plus durable mailbox/folder/continuation owner. No memory-only substitute or invented mailbox inference. |
| `read_chat_attachments` | **Producer/custody blocked**, existing Meri contract preserved | Native owned conversation/current-turn/attachment-byte mapping and generation-clock contract, then exact delegated admission. |
| `get_certification_status` | **Producer-contract blocked**, no unusable handler added | Producer-consumed canonical comparison locale and delegated admission. |
| `get_state_rule_status` | **Producer-contract blocked**, no unusable handler added | Producer-consumed stage/comment clocks and delegated admission. |
| `search_sam_opportunities` | **Producer-contract blocked**, no unusable handler added | Producer-consumed generation, stale-source and freshness-health clocks plus actual Core policy mode and delegated admission. |

Exact producer files, current auth guards and closed proposed request/response changes are in [CORE-READ-PRODUCER-MAP-20261019.md](CORE-READ-PRODUCER-MAP-20261019.md), [SECOND-PACKAGE-PRODUCER-CONTRACTS-20261019.md](SECOND-PACKAGE-PRODUCER-CONTRACTS-20261019.md), and the lane handoffs below. No new endpoint, grant or source provider was invented.

## Composition and contract decisions

One general `meri_reads` server and gateway remain canonical. Ordinary conversations use explicit active profile pins, current P2 installation and P1 discovery; a workflow skill is not required. A missing active pin, revoked installation/discovery, wrong tenant/client, expired current grant or unsupported source context stays unavailable/denied. Registration never activates unqualified installations.

`selected-task-ports.mjs` merges the existing memory ports with Research/Florida, Monday, task/action and dataset ports. `cli.mjs` uses only exact measured families. It requires Option B for signed tool families and explicit `reads.retainedAuthority` for detail/changes/Florida. Evidence and retained authority requests get the separate `getAttendedCredentialWithExpiry` callback backed by the current session broker. Opaque Option B handles remain private to the delegated per-call tool exchange.

The new runtime-only `reads.retainedAuthority` block contains exactly `issuerId`, `keyId`, public Ed25519 `publicKeyJwk`, and existing three operation recipient origins. It validates closed keys and exact HTTPS origins; research detail/changes origins must agree. It supplies no private key or generated credential. No renderer, environment, deployment JSON or infrastructure file was edited. Dot must supply actual approved public pins/material in a later owned integration.

The inherited Option B composition defect was independently reproduced at the original base: the generic native source DTO rejected a helper-only memory credential that the composer forwarded. Local `26c748dcf03dcf469baa178140e4c53a11660e3e` fixes only that projection. The signed memory eligibility closure still retains its helper; actual memory relay negatives, durable continuation and native read paths remain tested. The canonical memory search/proposal implementations and migrations are unchanged.

All new static task/context/adapter imports are included in source manifests. Desired source inventory is now **81 operations / 45 families**, compared with base 76/42. The unchanged catalog has 97 versioned descriptors; Appendix A's 96 legacy capabilities, Appendix B's 43 exclusions and the unchanged 14 plugin skills are separate inventories. Do not add these counts together or call the source inventory an active installation.

Source-only measurement: `read-tools-evidence-20261019/source-installation.json`, SHA256 `f00cca0c57646b7235b0e90b4ef54e2f776684b494e8c51924c22cc7c04b33df`. It is **not** an image receipt, live installation or permission to replace the frozen shipment's P2/G3 pins.

## Verification and retained failures

The exact test file lists/commands, source commits, exit receipts, compressed logs and hashes are in `read-tools-evidence-20261019/`. Decompress logs with `gzip -dc <name>.tap.gz`. The summary receipt records final counts; log evidence is authoritative.

- First integrated source run: 72 files, **2,051 cases: 2,028 pass / 23 fail**. Failures were retained: eleven inherited memory-helper DTO composition failures; stale mail fixture wire/receipts; obsolete legal eligibility and raw-client fixture expectations; one source import omitted by sparse checkout. The source import was restored, fixtures reconciled without weakening authorization/cancellation assertions, and the DTO projection repaired.
- Focused closeout at `0db7732b7a8cbcd703a787fed5e3e1e4e49ac472`: **138/138**, zero skips. Includes all first integrated failing groups plus signed helper and conditional mail nonregressions.
- Final coherent combined run includes all 72 source files plus all 21 worker read test files, using `node --experimental-test-module-mocks --test --test-concurrency=4` and the exact file list in `final-command.json`. Result: **2,511/2,511 pass, zero failures/skips/cancellations**, exit 0; exact receipt is in `summary.json` and `final.tap.gz`.
- Added 25 ordinary profile-mode tests cover the five newly selected general operations without a skill, explicit active pins, invocation, missing gates and release revocation. Independent review and focused 42/42 plus legal 2/2 receipts are in `MERI-READ-SECURITY-REVIEW-20261019.md`.
- Runtime TypeScript: zero diagnostics. Changed `.mjs` syntax and `git diff --check` pass; exact files/counts are in evidence. The worker package has no standalone TypeScript check script/tsconfig; its actual read suites were run. An initial attempt to call a nonexistent worker compiler path was an environment/check-command error, not a passed worker typecheck.

All source HTTP, SQL, grant, SDK server and provider fixtures are explicitly synthetic. Real Core/provider, native PostgreSQL, exact-image startup, installed source/skill custody, authenticated UI chat, cross-task durability and live revocation remain unrun. No prior SDK/proxy or image qualification is re-labelled by these read-tool checks.

## Changed files and pickup references

`read-tools-evidence-20261019/changed-files.txt` enumerates every file changed from the exact evidence base through the complete receiving code/test tree. `local-commit-provenance.txt` preserves coherent authored/receiving slices; the publication receipt maps them to the exact published tree. All code, reports and evidence are contained by PR189; temporary checkout/dependency links are not required or committed.

Lane reports:

- [RESEARCH-FLORIDA-READS-HANDOFF-20261019.md](RESEARCH-FLORIDA-READS-HANDOFF-20261019.md): authored base/final pins, four changed files, bounds, exact authority/data routes and source failures.
- [MERI-TASK-OMITTED-READS-20261019.md](MERI-TASK-OMITTED-READS-20261019.md): task/BD source slices, thirteen changed files, exact body and native conversation contracts.
- [MAIL-MONDAY-IMPLEMENTATION-20261019.md](../../apps/runtime/native-authority/retained-reads/MAIL-MONDAY-IMPLEMENTATION-20261019.md): current Core Monday mapping contract, conditional mail source composition and precise upstream scope/durable-context dependencies.
- [SECOND-PACKAGE-PRODUCER-CONTRACTS-20261019.md](SECOND-PACKAGE-PRODUCER-CONTRACTS-20261019.md): five requested operation status, proposed cert/rule/SAM private carrier and attachment current-turn/byte custody.
- [MERI-READ-SECURITY-REVIEW-20261019.md](MERI-READ-SECURITY-REVIEW-20261019.md): independent source review and ordinary profile tests.

Read the base's `AGENTS.md`, `docs/IMPLEMENTATION-STANDARDS.md`, `SDK-PROXY-CLOSEOUT-20261018.md`, `MERI-SHIPPING-PACKET-20261018.md`, `CAPABILITY-LEDGER-20261018.md`, `MAIN-RECEIVING-SOURCE-20261018.md` and `PLAN-RECONCILIATION-20261018.md` as historical context. This lane's gap list/producer map and final source supersede their read-composition counts; it does not rewrite their deployment evidence.

## Integration order for dot

1. Preserve the current first-chat builds and frozen source. Review PR189 as a separate successor from the evidence base; do not advance PR175 or substitute new read hashes into frozen build inputs.
2. Receive the canonical adapters, startup/context composition, discovery subsets and source-manifest closure together. Use the published consolidated tree and exact receipt, not isolated local lane SHAs that omit shared composition. Reuse the existing memory/durable owners.
3. Supply existing Core/Intel retained receiver trust/enablement and approved public verifier/recipient configuration for Research/Florida. Qualify actual current portfolio/client/folder/viewer authority. Evidence GETs require a live attended session; the absence of one must remain unavailable.
4. Supply exact Option B eligibility for `search_research_sources` and selected-client `get_business_development_evidence`; qualify source visibility and the actual owned native conversation/prospect/linked-client receipt. Do not substitute a model-provided native conversation into the Meri run binding.
5. Agree mailbox source-scope admission across current task/claims/delegation and a durable mail context owner; then compose mail in selected startup. Resolve attachments' current-turn/byte custody and the cert/rule/SAM private producer-consumed observations through separate narrow Core/Meri slices. The explicit proposals name the required request/response, authority and affected owners.
6. The shipment owner selects a reviewed supported active operation subset and regenerates source/image/configuration/P2/G3 measurements at the new approved successor. Full desired source inventory includes held mail and Core-dependent operations and must not be treated as an approved active set. Source flags alone cannot qualify it.
7. Run native exact-image/Core/database and authenticated ordinary-conversation checks, including cross-tenant/client/source walls, revoked/expired grants, page/replay scope, unavailable/empty distinction, cancellation, budgets and release. Keep all write intents under existing approval/execution owners. No deployment or live shipment is authorized by this source handoff.
