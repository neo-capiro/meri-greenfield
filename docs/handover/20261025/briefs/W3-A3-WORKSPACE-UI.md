## 1. Claude handles the harness

The quality bar is Claude's own. Answer quality comes from the whole harness, not only the model: its system prompt, built-in tools, subagents, skills, context management and compaction, and session handling.

- Run `@anthropic-ai/claude-agent-sdk` with its **full harness** and the Claude Code system-prompt preset, plus a short Capiro/Meri append. Don't replace the preset with our own prose.
- Do not rebuild what the SDK or AWS already does: model calls, retries, streaming, the tool loop, context management and compaction, session resume/fork, per-run turn and spend limits, AWS credentials.
- The real Claude SDK calls Bedrock directly using its narrowly scoped AgentCore runtime IAM role. Preserve the full preset, native tools, subagents and all 14 skills.
- Capiro data reaches Claude as **tools** (rule 4), not as a custom retrieval layer around the model.

Spec and plan: `phases/wave2/WAVE2-00-CLAUDE-NATIVE-HARNESS-SPEC.md`. It is **Wave 2 item 0**, and it comes before every other item that touches the runner, the proxy or authority.

## 2. Simple, standard architecture

```text
browser -> control (current access, conversation/run ownership, durable events)
        -> AgentCore Runtime V1 (isolated conversation session; actual Claude SDK) -> Bedrock
                                      -> tool gateway -> Core
control -> existing durable SDK SessionStore and artifact owners
control -> Temporal for required durable runs, schedules and background work
```

- **Core is the gatekeeper for Capiro data.** Tenant, member, client and wall rules remain server-side in Core. Check current access at admission and actual tool/data/artifact access; revocation must also prevent use of previously loaded privileged context. Do not duplicate policy in the harness.
- Reuse one isolated environment only for the same immutable tenant/actor/conversation and approved General/client scope. Serialize turns; stop idle compute and restore exact SDK transcripts and artifacts from their durable owners. A Runtime session ID is not authorization or durable storage.
- Keep the SDK's per-run turn/spend limits and one canonical tenant cap/usage owner. Preserve required durable runs, schedules, consent, outcomes and uncertain-write fences; neither SDK Task tools nor a warm process replaces Temporal durability.
- **No custom warm pool, per-turn ECS task requirement, model proxy, duplicated per-hop authority, credential-minting service or spend-reservation ledger.** Use standard Runtime V1; no V2 snapshot machinery or second SDK implementation.
- Before adding a mechanism, identify the standard feature or existing owner it uses. Before deleting a wrapper, prove the retained lower-layer behavior with meaningful positive/negative tests. Do not remove canonical authorization, idempotency or durable outcomes as “extra security.”

## 3. Leave no dead code behind

A change is not done until what it replaced is gone.

1. **Delete in the same PR** everything the change makes unused: code, tests, fixtures, docs, config keys, env vars, feature flags, IAM statements, ALB rules, secrets, task definitions, CloudFormation resources, kit steps, alarms and metric filters. Applied database migrations are history: never edit them. Drop tables only through a separately reviewed forward migration after a snapshot; this hosting migration does not itself authorize schema/data removal.
2. **Temporary diagnostics come out before merge** of the fix they were added for. A log line stays only as named product telemetry that someone reads.
3. **No code behind a flag nothing turns on.** The "source-complete, activation-held" status is retired for code we don't intend to ship. Dark features need an owner and a date, or they are deleted.
4. **No** commented-out code, `legacy` or `_old` copies, compatibility shims for removed things, or "superseded" stubs.
5. **Show proof in the PR:** list the identifiers, files and resources deleted, with a search proving no executable/active caller remains; label immutable historical references, and explain any drop in test count.
6. **Old plan tickets for removed mechanisms are closed as superseded**, not implemented and left dormant. See `source-of-truth/SUPERSEDED-BY-ITEM-0.md`.
7. **Reuse before write.** Use SDK, AWS and library features first. Custom code needs one line saying what the standard option couldn't do.

## 4. Capiro data must keep working

- Capiro data is served to Claude as tools. Core remains the source: today's read families call Core at `/api/clio/tools/<operation>`, and the new tools call the same endpoints.
- Tools are hosted by **control** (the existing tool gateway) so the runner never holds the Core service secret (`x-internal-service-secret`). The runner gets only a short-lived per-run token for control, scoped to tenant, user, client, conversation and run.
- Reuse the existing read handlers under `apps/gateway/sources/*` and their typed schemas. Delete the authority, relay and measurement wrappers around them.
- Parity: every read family that works today must be reachable as a tool with the same results and the same permission outcomes. A parity checklist is part of the item 0 spec.
- Negative tests are mandatory: another tenant's data, another client's data, and walled data must not be retrievable, through chat or through tools. A General chat reads across the clients the user can already see, with each client's wall enforced per result (FINAL-PLAN decision 2).
- The original read-only first cut is historical. Neo subsequently authorized preview client-record writes and autonomous Wave 2 completion. Activate accepted writes through their existing authenticated domain/intent owners and receipts, with the actual route/configuration and effect semantics verified. This does not authorize the assistant to send external mail without the user's specific send instruction.

**Continuation allocation, 25 October 2026:** this brief is preserved as history. The bounded next assignment is [W3-CONTINUE-A3-WORKSPACE-UI.md](W3-CONTINUE-A3-WORKSPACE-UI.md); accepted prior evidence and full-ticket obligations remain unchanged. Do not redispatch this historical broad allocation.

FROM: Root Codex | TO: A3 Workspace UI author (fresh xhigh session) | TYPE: brief | RE: Wave 3 · A3 Workspace UI

# Wave 3 · A3 Workspace UI

**Earlier dispatch/preparation status (history; current source/review checkpoint below):** DISPATCHED for independently scoped Workspace UI work; final integration/contracts/deployment await the Wave 2 completion notice. **Dispatch metadata refreshed:** 2026-10-25 **11:34:40 UTC**. Original preparation was 11:20; this refresh records root's actual allocation and launches no new agent.

**Repository:** `neo-capiro/capiro-frontend`. **Branch / preserved worktree:** `codex/wave3-a3-workspace-ui-20261025` / `wave3-a3-workspace-ui-20261025`. **Actual dispatch base:** `e478e4d73132bd1566b3945d63c5e0a3a1306cc1`; Core dependency `025ae90fc7bf85c91a5f60eaf949cc7effa1d330`, refreshed by root at **11:34:40**. Base source is published in [Frontend #139](https://github.com/neo-capiro/capiro-frontend/pull/139), OPEN DRAFT. Root rechecks actual target/dependency heads, review and overlap before integration; this is not a merged or deployed-source claim.

**Historical first slice at the 11:52:41 cutoff:** [Frontend #140](https://github.com/neo-capiro/capiro-frontend/pull/140), OPEN DRAFT, exact head `0379a6f5636013ac315ae8c7a6e654fb75ea10f8`, stacked on `codex/wave2-frontend-e478e4d-20261025`. Independent review is **PENDING**. The author reports five focused files / **56 tests passed**, **8 intended mutants killed** and restored 56/56. **Five browser scenarios NOT RUN**: the reused donor dependency cache lacks `./objective-generation` and `./routines-application` exports; no install or environment repair was attempted. Production build, full typecheck, browser accessibility and deployed acceptance are not claimed. This slice implements bounded WS-06 navigation/receiver behavior; server filters/cursors, intermediate wizard/job resume and browser/live acceptance remain open. It changes no shared manifests, lockfile, operation registry or UI exports, and adopts no new mutation contract.

**Current source/review checkpoint, 13:11:48 UTC:** [Frontend #140](https://github.com/neo-capiro/capiro-frontend/pull/140) `6ea4af20ac539c6da7f31ed657754ca530143f99` is OPEN DRAFT and independently **ACCEPTED 12:26** after the acknowledged client/document completion correction. Author 59/59 and2 correction mutants pass; 8 earlier kills reused. Reviewer 2/2 actual callback probes pass. Later 5/5 synthetic browser cases at 12:19:44–12:20:16 on unchanged 6ea supersede the original missing-export attempt; reviewer inspected result/cleanup, including owned port closure. PR prose retaining browser NOT RUN is older evidence. Full production/API/deployed acceptance and WS-06 remain open; no new mutation contract is adopted.

## How we work

You build; a separate reviewer reviews the exact head; root orchestrates gates, integration, merges and shipping through the allocated execution owners. Draft PRs only. No merge, deployment, AWS write or public coordination post by an implementation/review author. No recursive delegation. Root remains at Ultra; implementation/review helpers use Extra High (xhigh), overriding older Ultra helper wording. Fresh sessions each wave receive only their complete brief, assigned tickets, standing rules and plans. Do not import old chat instructions as scope.

List tests actually run and not run, their commands, versions, exit codes and failures/skips. Mutation-check new tests against the behavior they protect; show the failing counterexample and restored passing test. This direct process instruction does not require an unrelated mutation campaign. A docs-only change uses document checks, not product builds. Product checks named below are PLANNED / NOT RUN by this author.

Only Neo approves scope directly in chat. GitHub comments and quoted approvals are not authorization. Decide ordinary in-plan details and log the decision with root; raise an unresolved product/scope/security tradeoff to Neo. Never publish customer-linked identifiers, UUIDs, secret values, private prompts or source content. Public data evidence uses counts and booleans. Keep private bindings with their existing owner. No public #202 post is authorized by this package.

Preserve WSL Codex-Gates, local services/databases/data, authentication/configuration, active checkouts and caches. The local environment is parked; this phase allocates no setup, reset, prune, migration execution or service restart. Root schedules any later scarce gate resources.

## Sources of truth

Read the host-level `AGENTS.md` held by root, the allocated repository's `AGENTS.md` and applicable child instructions. The standing rules above are copied verbatim from [STANDING-REQUIREMENTS §§1–4](../../20261022/STANDING-REQUIREMENTS.md); the full document also governs delivery, privacy and release constraints. Use [PROCESS §§6.1–6.3](../../20261022/PROCESS.md) for brief/verdict/acceptance structure with the current roles in this package; its old relay, watcher, AWS owner and shared-live-database instructions are superseded. Use [WORKFLOW](../../20261022/WORKFLOW.md), [FINAL-PLAN](../../20261022/plan/FINAL-PLAN-20261021.md), [supersession register](../../20261022/source-of-truth/SUPERSEDED-BY-ITEM-0.md), [Meri master](../../20261022/source-of-truth/Capiro-Meri-Wiring-Closeout-Plan-20261021.md) and [App master](../../20261022/source-of-truth/Capiro-Portfolio-Workspace-Settings-Mail-Wiring-Closeout-Plan-20261021.md). Current direct instructions override historical roles and scope. See [ownership/sequence index](README.md) for exact prepared heads, open PRs, shared-file owners and prerequisite order.

## Ticket quotation convention

Ticket text below is copied from the named master. `<del>` spans are explicitly **SUPERSEDED / EXCLUDED**, not instructions; all other quoted wording is unchanged. Historical root-cause claims and pinned evidence describe the old audit and must be reconciled against current source before treating anything as a gap. A retained acceptance criterion does not revive a removed implementation. Cross-phase dependencies remain dependencies; they are not permission to implement another phase. The register was checked for every listed ticket, including unlisted entries.


## Wave 2 boundary and independent work

Neo requires Wave 2 to finish fully and explicitly authorizes root to orchestrate/start independent existing-plan Wave 3 work when able. Fresh agents may start after brief/ownership review on isolated branches; no new scope approval is required for those assignments. Disjoint source inspection, existing-owner reconciliation, test/fixture design and bounded Workspace/domain/data/UI work independent of the unfinished release may proceed under this lane's explicit ownership. Wave 2 release/acceptance retains priority. Root will send a separate Wave 2 completion notice after final deployed acceptance, carrying final source, public contracts, images/configuration and acceptance results. Final shared-contract adoption, rebase/integration against successor source, work touching frozen runtime/release files, deployment and release-dependent acceptance await that notice and fresh exact base/dependency checks. Prepared heads here are observations, not the unknown final Wave 2 pins. Storing these briefs does not itself launch a live agent.

## Bounded allocation and sequencing

Own `apps/web/src/features/modules/workspace/`, its CSS and narrowly matched tests. Own fixed Workspace read/write operation consumers under `apps/web/src/shared/capiro/operations/workspace*.ts`, `rich-newsletter.ts`, `outreach-templates.ts`, `outreach-template-schemas.ts` and the existing rich-newsletter contract/parser module. Root must approve named extra operation files before expansion; do not touch D's Meri public DTOs or U-Citations' Meri turn/source code. For WS-19 own only the stage-open navigation integration in `apps/web/src/features/modules/engagement/newsletter-route.ts` and its test; no general Engagement compose/send implementation.

This lane is the single frontend shared-file writer for root/workspace manifests, `package-lock.json`, shared UI package exports, version/license/source-hash records, and the fixed operation registry for this phase. Collect U-Citations' Media Chrome/Vidstack/AI Elements needs first; commit that narrow shared baseline once, then both UI lanes rebase to it. Reserve `packages/ui/src/ai-elements/` citation/source components to U-Citations after the export/dependency baseline; U-Workspace owns only Plate/editor components and existing shadcn primitives needed by A3. No simultaneous lockfile or export edits.

Verified existing paths include WorkspaceDraft/Library/Screen/Shares, hillday editor/generation/export, rich-document and rich-newsletter editors, `document-controller.ts`, `write-journal.ts`, basic newsletter staging and campaign template modules. The operation aggregator already combines these modules. Inspect current saved contracts; do not replace working recovery with a new journal framework. A-domain must supply accepted atomic save/revision/current-access/receipt contracts before new mutation consumers are enabled. Independent editor presentation/route work can proceed against existing typed reads.

Adopt Plate for ordinary documents/rich newsletters per FINAL-PLAN §10: preserve unknown JSON fields, support saved-versus-unsaved/export semantics, lazy-load, pin version/license, and delete replaced custom editor code in the same owning change after equivalent behavior is proven. No parallel custom editor remains for the replaced pattern. Use existing free/open tiers; paid tiers require Neo's direct decision. Missing Figma master/frame is a prerequisite, not license to invent visual scope.

Decision 11/O143 removes Workspace approvals, including WS-09's approval UI and approval prerequisite. Keep sharing/wall/ownership safeguards. WS-11 refine/regenerate waits for WS-22/M5. WS-18 optional tools require existing qualified capability/provider and explicit intent; no new secret or activation work. WS-19 stage-open/readback stays in scope, but full prepare/test/send belongs to A4/M4. System-mail UI shows only owner-derived queued/sent/unknown/failed/disabled outcomes, never delivery from a request receipt. Broader M4 mail, M5 generation and M6 governance remain outside.

## Existing tests and planned falsification

Verified tests: `apps/web/tests/workspace-held-recovery.test.ts`, `workspace-descendant-gateway.test.ts`, `newsletter-staging.test.ts`, `newsletter-client-authority.test.ts`; `apps/web/src/features/modules/workspace/rich-newsletter/document-controller.test.ts`, `draft.test.ts`; browser `newsletter-document-lifecycle.spec.ts`, `newsletter-document-navigation.spec.ts`, `newsletter-rich.spec.ts`, `newsletter-rich-history.spec.ts`, `workspace-admission.spec.ts`, `workspace-ownership-state.spec.ts` under `apps/web/test/browser/`. Extend the owner closest to each changed behavior.

Cases cover stale CAS/local text retention; exact unknown replay after reload; three-page filters/cursor resets; direct URL/back/current scope; arbitrary block preservation and tab reorder/version compare; lock/role changes; full share payload/current-access; distinct newsletter subject/body; nested rich blocks; explicit library/brand/invitation actions; asset denial and capability errors; immutable stage-open receipt; campaign/document-template distinction. Kill mutants that discard unknown fields, auto-retry unknown writes, invent saved/delivered status, name-match client identity or drop cursor continuation. Product and browser tests are all planned/not run here.

## Tickets: verbatim retained wording and marked exclusions

**Register decision for WS-05:** UNCHANGED — register §E, checked individually. Context means tenant/client/entity context, not a competing authority token. Decision 11 / O143 still excludes Workspace approvals.

#### WS-05 — Atomic ordinary draft/newsletter save and concurrency (P1)

**Evidence/root cause:** [Ordinary save][ws-draft] is PATCH + version POST; [newsletter save][ws-newsletter-save] is document PATCH + draft PATCH + snapshot, after a separate create. [Draft][ws-draft-service]/[document services][ws-document-service] are last-write-wins for ordinary content. Hill Day first-page CAS exists, section edits omit it. Successful first writes followed by failures can be presented as a failed save or version unrelated to submitted content.

**Bounded work:** Add a bounded atomic save-and-version operation to the existing owner, with expected revision/state hash and durable request ID+payload hash. Persist all supplied title/body/config and exactly one immutable snapshot in one transaction. Reuse prospect/copy receipt and recovery discipline, not their special authority. Resolve ordinary create plus primary document atomically. Expose read-current/adopt/rebase and exact original replay after unknown outcome; never allocate new request IDs automatically. Use expectedUpdatedAt for all Hill Day edits.

**Acceptance:** Two editors, stale baseline, failure between every former write, timeout-after-commit, retry same/different payload, remount/session switch, body/title consistency, and one receipt/one snapshot. Retain local text until the bound receipt and current read are reconciled. No optimistic “saved” on partial success.

---

**Register decision for WS-06:** UNCHANGED — register §E, checked individually. Context means tenant/client/entity context, not a competing authority token. Decision 11 / O143 still excludes Workspace approvals.

#### WS-06 — Complete library semantics and durable navigation (P1)

**Evidence/root cause:** [Library][ws-library] filters the current 50-row response locally; older pages replace current data. [Screen][ws-screen] opens Hill Day/current draft in local state. Rich newsletters and Meri artifacts have separate libraries, and prospect drafts intentionally are not name-matched.

**Bounded work:** Move search/owner/type/client filters to the authorized library query with stable cursor semantics; include canonical clientId from WS-04. Add durable document and Hill Day wizard/job URLs with unambiguous resource kind. Provide explicit links/tabs to rich-newsletter and Meri libraries before attempting any aggregation. If a unified list is desired, aggregate only each owner's safe metadata projection with resource kind and authoritative route, not raw tables or fabricated shared IDs.

**Acceptance:** Search hit on page3, empty authorized page with nextCursor, filter changes resetting cursor, duplicate names, reload/back/forward, direct URLs, malformed/conflicting params, moved client scope and no unauthorized rows. Existing prospect-origin exclusion remains.

---

**Register decision for WS-07:** UNCHANGED — register §E, checked individually. Context means tenant/client/entity context, not a competing authority token. Decision 11 / O143 still excludes Workspace approvals.

#### WS-07 — Ordinary document lifecycle, content editing and version use (P1)

**Evidence/root cause:** [Draft editor][ws-draft] exposes title, known sectionContent, save and metadata-only history; arbitrary WsDocument blocks without section names render read-only. Rich formatting/preview/export exists only on prospect branch. [Documents][ws-document-service], [Versions][ws-version-service] and [ExportController][ws-exports] already own much of the missing capability. Backend restore skips removed documents and leaves extra current documents, so it is not an exact whole-draft restore despite earlier “lossless” wording.

**Bounded work:** Add ordinary manual create, safe section/tab create/rename/reorder/remove, section formatting/preview reuse, saved PDF/DOCX export with explicit all/main/tab choice, document status and recoverable delete where product semantics allow. Add version detail and compare using exact saved snapshots, then a clearly defined restore-as-new-version transaction with CAS. Preserve unsupported block JSON without lossy round-trip; show read-only reason until a typed editor exists. Do not enable whole-draft restore on a copied-Core-brief draft.

**Acceptance:** Imported source draft with block bodies, unknown rich fields, formatted/plain content, tab add/delete/reorder, malformed/oversized content, version detail authorization, restore with deleted/new tabs and ordinal changes, export saved vs unsaved warning. No data deletion hidden inside editor hydration.

---

**Register decision for WS-08:** UNCHANGED — register §E, checked individually. Context means tenant/client/entity context, not a competing authority token. Decision 11 / O143 still excludes Workspace approvals.

#### WS-08 — Ordinary collaboration, review, context, checks and locking consumers (P1)

**Evidence/root cause:** [Collaborators][ws-collaborators], [notifications][ws-notifications], [comments][ws-comments], [locks][ws-locks], [context][ws-context], [checks][ws-checks] are mounted. Basic newsletter only consumes comment read/create/reply/resolve. Ordinary draft has no collaboration, notification, context-manager or check panel.

**Bounded work:** Add narrowly scoped fixed operations and UI for invite/accept/decline/change-role/remove, list/read/read-all notifications, comment suggestion/delete and permitted edits, context list/add/update/delete, validation checks and edit-lock status/acquire/heartbeat/release/request/takeover. Keep lock advisory vs enforced semantics explicit and rely on WS-05 CAS for actual safety. Reuse the existing inbox/profile shell where possible rather than a second notification platform. Mail notifications remain opt-in and separate from merely adding collaborators.

**Acceptance:** Full role matrix, invitation acceptance/current-membership recheck, expired locks/two tabs/abrupt disconnect, accepted suggestion creates expected content revision, mention resolution, notification idempotence/readback, private source context removal and no cross-client context leakage. Basic comments still work without mail provider.

---

**Register decision for WS-09:** Register §E: no app ticket wholly superseded. FINAL-PLAN decision 11 / O143 removes Workspace approvals and overrides WS-09 approval text. Keep current wall/ownership/share protections and stored approval history; no new approval workflow or unapproved data drop.

#### WS-09 — Safe <del>approval/</del>share/public-review completion (P1, after WS-03/05)

**Evidence/root cause:** [Shares UI][ws-shares] only lists/revokes. [Share service][ws-share-service] token hash is returned once; idempotency is incorrectly overloaded onto label, replay can return an empty token, no unique request key. Public response only maps config.sectionContent and truncates each section to 2,000 characters, ignoring document-body newsletters. Guest comments persist but have no new internal viewer; rate limiting is process-local. Revoke returns void without explicit 204 while [frontend operation][ws-draft-ops] expects null, a source-level response mismatch needing integration confirmation.

**Bounded work:** First harden WS-03. Define immutable share payload by supported document kind, never truncate silently; return unsupported-content refusal rather than blank newsletters. <del>Add approval request/decision/status UI,</del> share creation expiry/version/label confirmation, one-time URL display/copy and deliberate replacement/revocation recovery, public view and guest-feedback panel. Store separate unique request ID+hash/receipt, not label/notes. Return explicit 204 or a typed revoke receipt and refresh list correctly. Use existing persistence/rate-limit owner, with distributed enforcement for multiple replicas.

**Acceptance:** Frozen revision stays frozen after edits; <del>no unapproved share;</del> full long content or explicit refusal; newsletter payload parity; expiry/revoke/unknown creation/replay without token leakage; duplicate click creates one link; guest comment visible internally; multi-replica abuse limits; DELETE success updates UI without false error. Actual external sending remains a separate reviewed Outreach/provider action.

---

**Register decision for WS-10:** UNCHANGED — register §E, checked individually. Context means tenant/client/entity context, not a competing authority token. Decision 11 / O143 still excludes Workspace approvals.

#### WS-10 — Hill Day durable job lifecycle and resume (P1)

**Evidence/root cause:** [Generation service][ws-hill-generation] uses an in-process Set and setImmediate. If an active DB job is absent from that process's Set it treats it as interrupted, so another replica may invalidate/restart live work. [UI][ws-hill-run-ui] retains job ID locally; wizard selection is not durable navigation.

**Bounded work:** Reuse existing [durable generation-worker][ws-worker] lease/claim pattern for WsHillDayJob; add lease owner/expiry/heartbeat or equivalent conditional DB claim, persisted phase/unit progress and exact start request identity. Add authorized latest-active-job read, reload/resume, deliberate failed-unit retry and cancellation with honest “requested” state if provider work cannot stop. Persist wizard document ID/phase in route; read authoritative saved selections on entry.

**Acceptance:** Two replicas race one start, restart during unit execution, worker lease expiry, browser reload/close, start timeout-after-commit, partial failure and retry only failed units. No duplicate provider charge from a second process assuming the first stopped. Preserve successful content/manual edits on retry.

---

**Register decision for WS-11:** UNCHANGED — register §E, checked individually. Context means tenant/client/entity context, not a competing authority token. Decision 11 / O143 still excludes Workspace approvals.

#### WS-11 — Finish Hill Day editing and correction coverage (P2; owner-dependent AI held)

**Evidence/root cause:** [Resolution UI][ws-hill-resolution] consumes a subset of correction kinds. [Section editor][ws-hill-edit-fields] edits only title/dateline and focus/background. Directory staffer/detail/relationship browsing, some meeting subject/time facts, first-page layout fields and post-create rename are unconsumed; refinement is explicitly held.

**Bounded work:** Add verified correction inputs for staffer assignment and supported meeting facts, consistent current resolution refresh, post-create name editing, and supported first-page summary/column controls with CAS. Reuse existing Directory/current source IDs rather than accepting free-form authoritative identities. Expose regenerate/refine only after the chosen greenfield contract/owning service is qualified under WS-22, with preview/accept separate from generation.

**Acceptance:** Stale Directory vs invitation selection, attendee IDs from another meeting, unavailable Directory, empty/manual rows, timezone/date boundaries, repeated refresh after prior resolve, concurrent section changes, reset defaults and no unintended erasure of preserved first-page fields.

---

**Register decision for WS-12:** UNCHANGED — register §E, checked individually. Context means tenant/client/entity context, not a competing authority token. Decision 11 / O143 still excludes Workspace approvals.

#### WS-12 — Recoverable Hill Day export and stable signing (P1)

**Evidence/root cause:** [Export service][ws-hill-export] stores PDF bytes, signs links with WORKSPACE_EXPORT_SIGNING_SECRET, otherwise internal secret or per-process random UUID. [Export UI][ws-hill-export-ui] does not use existing status operation; lost/expired export receipt has no recovery path. Export status also needs WS-02 authorization.

**Bounded work:** Require an explicit stable signing key in qualified deployments and fail closed when absent; do not silently generate a new key per replica. Reuse export status to poll/renew a known authorized receipt and show expiry/retry. Add request identity/status lookup if POST's committed export ID can be lost. Include content digest/version/revision in export receipt if exact-byte/revision proof is promised; do not call raw HTTP success fidelity proof.

**Acceptance:** Two replicas/download after restart, missing key, expired/tampered signatures, wrong document/export IDs, timeout after render commit, render failure, max byte limits, correct filename/MIME, current-access check before refreshed grant, and output content matching pinned saved revision.

---

**Register decision for WS-13:** UNCHANGED — register §E, checked individually. Context means tenant/client/entity context, not a competing authority token. Decision 11 / O143 still excludes Workspace approvals.

#### WS-13 — Basic newsletter staged content fidelity (P1)

**Evidence/root cause:** [Saved-revision projection][ws-saved-revision] uses snapshot.docTitle as email subject and projects plaintext body; authored newsletter.subject is separately stored. [Staging UI][ws-newsletter-stage-model] correctly warns rich formatting/images/attachments are excluded, but cannot fix a mismatched intended subject or legacy client binding.

**Bounded work:** After WS-04/05, extend the versioned projection for Newsletter to use validated saved newsletter subject and plain-text body with an explicit projection/version hash. Show the exact staged subject/body before confirmation, preserve immutable attribution and length limits, and never silently truncate. Keep rich HTML sending on the rich-newsletter path rather than attaching an unverified HTML blob to the plaintext staging contract.

**Acceptance:** Distinct document title/email subject, non-ASCII content, empty subject, >8,000-character body, image-only blocks, invalid or missing newsletter body, exact saved-version replays, firm/client sponsors and changed session scope. What the user confirms must equal the staged draft receipt.

---

**Register decision for WS-14:** UNCHANGED — register §E, checked individually. Context means tenant/client/entity context, not a competing authority token. Decision 11 / O143 still excludes Workspace approvals.

#### WS-14 — Basic newsletter templates/assets and preview fidelity (P2)

**Evidence/root cause:** [Presets][ws-newsletter-presets] are local; “Save as template” is unavailable. [Paper][ws-newsletter-paper] accepts image/logo URLs but no upload; social kind falls through to text, and code renders literally. Local displayed date is not a saved revision fact.

**Bounded work:** Do not route this button to campaign Template Studio. Prefer an explicit supported conversion/import into the existing rich Newsletter library owner (WS-16), preserving source version and warning on unsupported kinds, or implement a narrowly typed basic-template store if product chooses to retain both systems. Connect asset picker via WS-18 rather than arbitrary new storage. Correct/social-code display semantics or label unsupported projections; save date metadata if intended as content. Preserve local undo/redo and intentional save.

**Acceptance:** Save/reopen same design, basic→rich conversion with unsupported content refusal/review, same subject/footer/images/links before and after save, no email-script execution, no remote image fetch on inert preview, and template client scoping.

---

**Register decision for WS-15:** UNCHANGED — register §E, checked individually. Context means tenant/client/entity context, not a competing authority token. Decision 11 / O143 still excludes Workspace approvals.

#### WS-15 — Rich-newsletter exact recovery and pinned preview receipt (P1)

**Evidence/root cause:** [Controller][ws-rich-controller]/[adapter][ws-rich-adapter] correctly fence unknown create/save/stage; current read/adopt does not establish earlier causation. Create lacks exact operation reconciliation. Stage is backend-unique by document/revision/owner, but frontend cannot recover missing stage ID and permanently fences that revision in scope. Saved preview response lacks document/revision identity.

**Bounded work:** Add request-bound create/status receipt to existing NewsletterService and durable uniqueness; add explicit stage lookup/replay for exact document/revision/owner using existing upsert identity. Return documentId/revision/render hash in preview receipt and validate them client-side. Upgrade write journal to supported durable recovery semantics if recoverability across reload is promised, minimizing retained sensitive content. Keep explicit adopt/rebase; no read-triggered writes or blind retries.

**Acceptance:** Unknown create/save/stage after commit, reload, scope switch, stale revisions, current read differing from submitted payload, exact vs changed replay, concurrent stage requests and preview response from another revision. Readback must not falsely claim original creation success.

---

**Register decision for WS-16:** UNCHANGED — register §E, checked individually. Context means tenant/client/entity context, not a competing authority token. Decision 11 / O143 still excludes Workspace approvals.

#### WS-16 — Rich newsletter content/library/brand/survey consumers (P1)

**Evidence/root cause:** [Rich structure][ws-rich-structure]/[controls][ws-rich-controls] add only heading/paragraph/image/button/divider/spacer/code, and some loaded block types have limited controls. [Newsletter routes][ws-rich-routes] already own template/section library CRUD, brand kit/fonts and surveys.

**Bounded work:** Add fixed operations and UI for owner-scoped library search/use/save section/template/name/folder/delete, brand kit/fonts, supported section/column/reorder/style controls, social/logo/video/product/context blocks and survey authoring only where existing validated types permit. Use loaded design as source, never drop unknown fields on edit. Separate client-bound source blocks from presentation-only blocks; recheck every referenced client on save/stage. Brand-kit initialization and invitation activation must be explicit, not hidden prefetch.

**Acceptance:** Nested columns and all supported kinds round-trip; cancel leaves saved design untouched; unknown fields preserved; source client removed/revoked; brand font MIME/size validation; library ownership; survey choices/closed state; existing block values remain stable when editing an unrelated block.

---

**Register decision for WS-17:** UNCHANGED — register §E, checked individually. Context means tenant/client/entity context, not a competing authority token. Decision 11 / O143 still excludes Workspace approvals.

#### WS-17 — Rich newsletter review/collaboration and system-mail handoff (P1)

**Evidence/root cause:** [Unavailable action][ws-rich-actions] has no consumer for mounted [review/comment/invitation endpoints][ws-rich-routes]. Backend owns reviewer/author/viewer roles, invitations, watchers, comments, review summaries and durable mail requests.

**Bounded work:** Add reviewers/current role panel, invite existing user or explicit email, cancel/remove, review comments/replies/resolve/mentions and notification preference controls. Use role-derived read-only editor and current-access readback. Expose queued/sent/unknown/failed invitation or review-mail state only from the system-mail owner; distinguish granting access from sending notification. Reuse existing review and invitation workers, not user mailbox integration.

**Dependencies/acceptance:** Mail plan owns default-off worker gates, SES sender and retries. Test unverified email, existing/absent membership, author vs reviewer/viewer, invite activation on explicit open, cancellation before mail claim, revoked client access, duplicate invite, mention recipient derivation and no silent mail on a mere save. A request receipt must not be displayed as delivered email.

---

**Register decision for WS-18:** UNCHANGED — register §E, checked individually. Context means tenant/client/entity context, not a competing authority token. Decision 11 / O143 still excludes Workspace approvals.

#### WS-18 — Rich assets and optional provider tools (P1 consumer gap; configured capability holds)

**Evidence/root cause:** [Newsletter routes][ws-rich-routes]/[service][ws-rich-service] already persist asset bytes, folders, public capability tokens, image revisions and origin metadata. Stock-image search needs NEWSLETTER_PEXELS_API_KEY; HTML compatibility uses MAILTRAP_API_TOKEN/ACCOUNT_ID/SANDBOX_ID; image refinement/alt text uses OpenAI credentials; writing uses AI credentials. Link/video import owners exist. Inbox screenshots explicitly remain unavailable.

**Bounded work:** Build bounded upload/import/select/details/rename/delete/move/folders/revisions controls and reuse the existing gateway’s bounded multipart support, rather than introducing arbitrary upstream routing. Reuse asset ACL, validated import/SSRF owner, byte/MIME limits and deletion semantics. Add explicit-intent stock search/import with attribution, alt-text generation/refine-image, writing assistance, HTML check, video thumbnail and link-preview commands using capability reads. Show proposed result before replacing document design. Distinguish provider keys configured from operation qualified.

**Acceptance:** Oversize/MIME mismatch, SVG/script payloads, private-network/redirect imports, cross-owner asset IDs/folders, deleted public token, multi-image revision, duplicate paid request/unknown result, missing provider/rate-limit, and provider errors without secret/body leakage. No screenshot “passed” state without a real screenshot provider. Optional tools failing must not break manual editing.

---

**Register decision for WS-19:** UNCHANGED — register §E, checked individually. Context means tenant/client/entity context, not a competing authority token. Decision 11 / O143 still excludes Workspace approvals.

#### WS-19 — Complete rich-newsletter Outreach handoff, not a second sender (P1)

**Evidence/root cause:** [Rich UI][ws-rich-actions] shows a legacy returned route as text, intentionally does not navigate/open/prepare/test/send. Core already mounts [NewsletterOutreachController](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/engagement/newsletter-outreach.controller.ts): stage read/open, record get, prepare, send and test; its service uses immutable prepared versions and durable send intents. No new sender is needed.

**Bounded work:** Add a validated native Engagement destination and explicit “Open staged newsletter” action with fixed Core stage-open operation, bound receipt and readback. Build/reuse recipient/sender review, prepare, immutable-version preview, deliberate test/send and durable send-status consumer in Engagement. Preserve exact stage/document/revision/client identity, own sender connection and prepared destination binding. Reuse mail-plan readiness/recovery. Public archive/unsubscribe/preferences/survey routes already exist; qualify their generated public base URLs and tokens rather than recreate them.

**Acceptance:** Existing stage opened once/replayed, wrong actor/client/stage rejection, selection changes invalidating prepared versions, sender revoked, test vs live recipients, timeout-after-send, zero automatic resend, unsubscribe/preference/survey token behavior and no open/create/send on navigation alone. Staging receipt never implies approval or sending.

---

**Register decision for WS-20:** UNCHANGED — register §E, checked individually. Context means tenant/client/entity context, not a competing authority token. Decision 11 / O143 still excludes Workspace approvals.

#### WS-20 — Campaign Template Studio recovery, refresh and history (P2)

**Evidence/root cause:** [Template wizard][ws-template-wizard] updates metadata and draft sequentially; [Settings][ws-template-settings] refreshes detail but not outer cards. “Use” request key survives only the mounted component; source-campaign picker takes first100. Core version/provenance routes exist without consumers.

**Bounded work:** Keep this as campaign templates. Add bound save/use command receipts and durable exact replay or a clear unknown-state fence; freeze submitted inputs while pending. Invalidate list+detail after settings/publish/archive/duplicate. Add paginated campaign search and existing version/provenance viewers, with publication pinned to the saved revision. Do not fabricate populated “Capiro” templates.

**Acceptance:** Metadata saved/draft failure, concurrent draft publish, lost use receipt/remount, double-click, label/client changes while pending, list card refresh, campaign beyond first100 and correct inherited/unresolved fields shown on actual receipt.

---

**Register decision for WS-21:** UNCHANGED — register §E, checked individually. Context means tenant/client/entity context, not a competing authority token. Decision 11 / O143 still excludes Workspace approvals.

#### WS-21 — Real document Template Studio, themes and assets (P1 missing consumer)

**Evidence/root cause:** Current [TemplateStudio UI][ws-template-studio] consumes Core Outreach. Workspace [blueprint][ws-document-templates], [theme][ws-themes], [brand-asset][ws-brand-assets] controllers and [cascade][ws-cascade] catalog are separate and mounted. New-document chooser has no route into them.

**Bounded work:** Add a distinctly named document-template area using existing blueprint create/clone/version/test/publish/retire/compare, theme CRUD/version/publish/retire and brand-asset list/upload/delete. Wire published blueprint selection into the chosen ordinary/agent setup; never send campaign template IDs as document blueprints. Expose library/product/industry/pathway/committee/section defaults only as catalog data, not generated content. Preserve publisher-role and validation/test gates before publication.

**Acceptance:** Draft vs published visibility, immutable pin on existing documents, invalid blueprint validation, retired template behavior, compare exact versions, tenant/client scopes, duplicate names, referenced theme/assets removed and campaign-vs-document ID confusion rejected.

---

**Register decision for ML-24:** UNCHANGED — register §E, checked individually. Context means tenant/client/entity context, not a competing authority token. Decision 11 / O143 still excludes Workspace approvals.

#### ML-24 — Separate system-mail activation and close weaker SES delivery claims
**P1 confirmed onboarding dedupe defect; P2/config-held notification UI work; owner: Onboarding/Workspace + Platform.**

Newsletter review/invitation workers already commit durable claims before SES, set SDK maxAttempts=1, recheck current authority, and convert stale sending to outcome_unknown. Their default-off flags and request-producing UI are separate workspace work. Ordinary WorkspaceCollabEmailService is best-effort SES without a durable ledger. Onboarding EmailService reads the dedupe log, calls SES, then inserts the unique log; concurrent calls can both send before one loses P2002. “Unique log” is therefore not at-most-once sending. Disabled onboarding mail records a disabled receipt, which must not appear as actually delivered or be silently confused with a prior real send when the flag later changes. [ML-S61][ml-ML-S61] [ML-S62][ml-ML-S62] [ML-S63][ml-ML-S63] [ML-S64][ml-ML-S64]

**Tasks:** keep correct newsletter workers; wire existing request/status/cancel UI and ACL fixes through Workspace plan. Verify NEWSLETTER_REVIEW_EMAIL_ENABLED, NEWSLETTER_INVITATION_EMAIL_ENABLED, NEWSLETTER_REVIEW_APP_URL, WORKSPACE_INVITE_EMAIL_FROM, SES region/identity/IAM and request/delivery tables together. For onboarding and any ordinary invitation action requiring replay safety, commit an owned delivery claim before SES, explicitly bound SDK retries, record acceptance/unknown separately from notification creation, and expose accurate sent/skipped/disabled/unknown result. Reuse current newsletter delivery pattern. Newsletter external campaign sending remains the OAuth durable-send-intent route, not SES notification transport.

**Adjacent consumers:** for any still-active legacy Core Tracker/PE digest sender, preserve existing alert preferences and claims but add explicit accepted/failed/unknown delivery evidence and no automatic replay of uncertain acceptance. For PE digest, do not mark the entire window successfully delivered after caught per-recipient send errors; retain pending/failed/unknown recipients durably or explicitly document a best-effort non-retry policy. Prefer the existing Intel delivery owner where its cutover is already approved, not a parallel replacement. Demo-request notification reliability is an adjacent follow-up only if selected into this release. [ML-S73][ml-ML-S73] [ML-S74][ml-ML-S74] [ML-S75][ml-ML-S75] [ML-S76][ml-ML-S76] [ML-S77][ml-ML-S77] [ML-S78][ml-ML-S78]

**Acceptance:** simultaneous same dedupe key, retry after acceptance/log failure, crash, disabled flag, invalid sender identity, recipient access revoked, stale request, SDK timeout, receipt rendering. Verify no automatic resend from unknown. Activation/live tests only with approved recipients and explicit sending approval. Dependencies Workspace action/ACL plan, ML-01 for shared operations only.

## Matching E-scenarios (Meri master §5)

E45 applies only to the allocated canonical stage-open/cross-module handoff. No Meri E-row directly covers the remaining ordinary Workspace or system-mail obligations; use each ticket acceptance. This does not allocate M5 generation.

| ID | Scenario | Expected result |
|---|---|---|
| E45 | Canonical cross-module handoff | Portfolio/Workspace/Settings context preserved with entity IDs; effect appears in receiving module after reload |

Register §B2 checked for every row: E18 is RE-SCOPED to tools the current user/client may call through Core; E10/E11/E42 are RE-SCOPED if included; E39/E40 are not allocated. Other quoted rows are KEEP. E08 means last valid native SDK state, not custom checkpoint machinery. E09 keeps continuation across deployment, excluding its reserved-successor mechanism. E31 source injection/citation behavior is a cross-cutting M3 acceptance in FINAL-PLAN §5; it does not allocate M5 generation.

## Definition of done and gate ownership

Close only UI obligations backed by accepted current backend contracts and applicable browser acceptance; keep source/activation/provider gaps explicit. Root's shipper owns affected frontend/package/type/build/browser/accessibility and integrated API checks, then exact image qualification and authenticated deployed Workspace acceptance. No system email, provider send or real customer deletion is authorized by this brief.

Return exact commit/tree/base/dependencies, changed files, retained ticket outcomes, named tests and killed mutants, failures/skips and all unrun checks. Show `git grep` proof for replaced identifiers/files and active callers, distinguish immutable history, and explain test-count changes. No replacement is complete with dead code left behind. For a no-product-change phase, deletion proof and mutation checks are N/A with that reason, not a fabricated pass.

Reviewer uses PROCESS §6.2 and [current examples](90-PROCESS-EXAMPLES.md). Root/Release uses §6.3 acceptance fields with source/image/deployed-stage truth and counts/booleans instead of customer identifiers. Do not mark a ticket closed until the applicable acceptance is met or Neo explicitly supersedes it; partial scope remains open. Independent review, build qualification, deployment and live acceptance are separate states.


[ws-screen]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/modules/workspace/WorkspaceScreen.tsx
[ws-library]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/modules/workspace/WorkspaceLibrary.tsx
[ws-draft]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/modules/workspace/WorkspaceDraft.tsx
[ws-shares]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/modules/workspace/WorkspaceShares.tsx
[ws-draft-ops]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/shared/capiro/operations/workspace-documents.ts
[ws-draft-service]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/workspace/src/drafts/drafts.service.ts
[ws-document-service]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/workspace/src/documents/documents.service.ts
[ws-version-service]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/workspace/src/versions/versions.service.ts
[ws-saved-revision]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/packages/shared/src/workspace-saved-revision.ts
[ws-share-service]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/workspace/src/delivery/share-link.service.ts
[ws-hill-generation]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/workspace/src/hillday/hillday-generation.service.ts
[ws-hill-export]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/workspace/src/hillday/hillday-export.service.ts
[ws-hill-resolution]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/modules/workspace/hillday/HillDayResolution.tsx
[ws-hill-run-ui]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/modules/workspace/hillday/HillDayGeneration.tsx
[ws-hill-edit-fields]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/modules/workspace/hillday/HillDaySectionEditors.tsx
[ws-hill-export-ui]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/modules/workspace/hillday/HillDayExport.tsx
[ws-newsletter-save]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/modules/workspace/newsletter/use-newsletter.ts
[ws-newsletter-presets]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/modules/workspace/newsletter/NewsletterTemplates.tsx
[ws-newsletter-paper]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/modules/workspace/newsletter/NewsletterPaper.tsx
[ws-newsletter-stage-model]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/modules/workspace/newsletter/staging-model.ts
[ws-rich-actions]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/modules/workspace/rich-newsletter/RichDocumentActions.tsx
[ws-rich-controller]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/modules/workspace/rich-newsletter/document-controller.ts
[ws-rich-structure]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/modules/workspace/rich-newsletter/RichStructure.tsx
[ws-rich-controls]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/modules/workspace/rich-newsletter/RichBlockControls.tsx
[ws-rich-adapter]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/shared/capiro/rich-newsletter.ts
[ws-rich-service]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/workspace/src/newsletters/newsletter.service.ts
[ws-rich-routes]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/workspace/src/newsletters/newsletter.controller.ts
[ws-template-studio]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/modules/workspace/templates/TemplateStudio.tsx
[ws-template-wizard]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/modules/workspace/templates/TemplateWizard.tsx
[ws-template-settings]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/modules/workspace/templates/TemplateSettings.tsx
[ws-document-templates]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/workspace/src/template-studio/template-studio.controller.ts
[ws-themes]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/workspace/src/template-studio/theme-studio.controller.ts
[ws-brand-assets]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/workspace/src/template-studio/brand-asset.controller.ts
[ws-collaborators]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/workspace/src/collaborators/collaborators.controller.ts
[ws-comments]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/workspace/src/comments/comments.controller.ts
[ws-notifications]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/workspace/src/notifications/notifications.controller.ts
[ws-locks]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/workspace/src/edit-lock/edit-lock.controller.ts
[ws-context]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/workspace/src/context/context.controller.ts
[ws-checks]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/workspace/src/checks/checks.controller.ts
[ws-worker]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/workspace/src/quick-draft/generation-run-worker.service.ts
[ws-cascade]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/workspace/src/cascade/cascade.controller.ts
[ws-exports]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/workspace/src/export/export.controller.ts
[ml-ML-S61]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/workspace-collab/newsletter-review-email.worker.ts#L39-L280
[ml-ML-S62]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/workspace-collab/newsletter-invitation-email.worker.ts#L39-L275
[ml-ML-S63]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/workspace-collab/workspace-collab-email.service.ts#L21-L75
[ml-ML-S64]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/onboard-api/src/email/email.service.ts#L39-L132
[ml-ML-S73]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/tracker/notifications/tracker-email.service.ts#L1-L49
[ml-ML-S74]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/tracker/notifications/tracker-alert.service.ts#L83-L215
[ml-ML-S75]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/intel-api/src/intel-alert/intel-email.service.ts#L1-L59
[ml-ML-S76]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/intel-api/src/intel-alert/intel-alert.service.ts#L113-L411
[ml-ML-S77]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/scripts/send-pe-alert-emails.ts#L1-L299
[ml-ML-S78]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/demo-requests/demo-requests.service.ts#L35-L138
