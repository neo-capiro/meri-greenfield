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

FROM: Root | TO: fresh visible Codex independent reviewer | TYPE: brief | RE: three Wave 3 continuation lanes

# Independent review of Wave 3 continuations

This is the complete initial reviewer allocation, prepared 2026-10-25 at 15:35 UTC. Root authorized three bounded fresh Hermes authors under Neo's direct request. Root remains sole orchestrator; the reviewer is a separate visible Codex chat requested at **xhigh**. Authors implement and build their source; you review, independently test when useful, and issue exact-head verdicts. Do not implement product fixes, launch Hermes, create more agents, merge, deploy, install dependencies, repair environments, call providers/models, send mail or execute migrations. Existing Release alone operates AWS/migrations/rollout/rollback under Root. Root coordinates gates and decides integration/merge/shipping.

Neo's coordination request authorizes review/status messages to Root and the existing mechanical Hermes launcher allocated by Root. Resolve their actual chat identities from Root's dispatch; never guess them or message unrelated chats. Root supplies author PR heads as available. Do not wait for all three lanes to finish before reviewing a ready exact candidate. Missing candidates are pending, not a failure and not permission to author code.

## Sources and session boundaries

Read this brief, [standing requirements](../../20261022/STANDING-REQUIREMENTS.md), [PROCESS 6.1–6.3](../../20261022/PROCESS.md), [WORKFLOW](../../20261022/WORKFLOW.md), [FINAL-PLAN](../../20261022/plan/FINAL-PLAN-20261021.md), the [supersession register](../../20261022/source-of-truth/SUPERSEDED-BY-ITEM-0.md), both [Meri](../../20261022/source-of-truth/Capiro-Meri-Wiring-Closeout-Plan-20261021.md) and [App](../../20261022/source-of-truth/Capiro-Portfolio-Workspace-Settings-Mail-Wiring-Closeout-Plan-20261021.md) master plans, and the fresh lane briefs below. Use only these canonical sources and referenced accepted evidence, not unrelated chat history. Read host/repository/applicable child AGENTS and implementation standards at the allocated read checkout. Current brief roles, xhigh, no #202 and protected-operation boundaries override historical instructions. No recursive delegation.

The [dispatch manifest](W3-DISPATCH-MANIFEST.md) will hold final preparation UTC and source pins. Read-only historical source checkouts are preserved. Request or use a fresh isolated review worktree at the submitted exact SHA; first check existing worktree status/ownership. Never reset or write into an author's worktree. A worktree does not isolate ports, Docker or databases. Keep WSL Codex-Gates, persistent local services/database data, auth/config, all existing checkouts, evidence and reusable caches. Any heavy PostgreSQL/browser/image gate needs Root's resource allocation; name it NOT RUN/BLOCKED with owner if unavailable. No environment repair/install or service restart is allocated.

## Three author lanes and exact source bases

| Author / brief | Fresh base and retained accepted slice | This continuation only / boundaries |
|---|---|---|
| A3 Domain — [brief](W3-CONTINUE-A3-DOMAIN.md) | Core PR129 `45eaba1b720849e914052fcf3d7003ac73ac27cd`; atomic Workspace receipts/CAS and Onboard claim accepted | WS-06 authorized library search/owner/type/client filters and stable paging through existing HillDayController/HillDayDocumentService. No generation/job redesign, no frontend edits. Sole Core schema/migration/shared manifest writer, with no schema change expected or blanket exception. |
| A3 Workspace UI — [brief](W3-CONTINUE-A3-WORKSPACE-UI.md) | Frontend PR140 `6ea4af20ac539c6da7f31ed657754ca530143f99`; durable navigation and receiver identity accepted | WS-07 read-only exact saved-version detail/compare using existing authorized version-list snapshots. No save, restore, create/delete mutation adoption; no WorkspaceLibrary filtering edits. Sole frontend manifest/lock/registry/export owner; only the named existing workspace operation/schema seam is expected. |
| M3 Data — [brief](W3-CONTINUE-M3-DATA.md) | Meri PR247 `d772a6baff05f98e6f3cc3bbd3c47b5306e00c1b`; Core PR128 `68a7dae3043353ef03e98487bf4451c6080116bb` | MT-09 existing legal/news/Outreach read semantics, truthful unsupported vs empty, and current-access parity. No P2 feature expansion, indexer/schema work, policy layer, or citation source-viewer contract. Core edits only at named data-reader seam if a current counterexample needs them. |

The [citation dependency hold](W3-CONTINUE-M3-CITATIONS-HOLD.md) records why a fourth author is not launched. Frontend PR141 `7b613a8a3f8472e24296a01f7e8c2758e97f774e` / tree `c86ce36a8d264166399f68ef74f97fb84184a7d9` has accepted saved-source presentation and corrected loading-result semantics. Full MF-16 waits on real current-access source resolution/outcome/usage/hearing contracts and final integration. Do not redo its accepted presentation or invent trusted links from model text.

Fresh remote PR metadata on 25 October confirms all five preceding Wave 3 source PRs OPEN DRAFT at these heads. The GitHub reviews endpoint returned no submitted reviews: ACCEPT is Root's supplied independent-review evidence (and the existing dated brief where recorded), not a fabricated GitHub approval. Re-read actual remote head/state before each verdict and preserve the provenance distinction. Older PR body statements that review/browser checks are pending can be stale; reconcile exact-source evidence rather than silently discarding either record.

## Wave 2 remains in progress

Frozen accepted release candidates are Core PR133 `43fdd8928e517b1ce3a7a039f0fabeb8cf5fc5dd`, frontend PR151 `dc53633f0b8c4de6432f3840e4fc79ac2ffeb02a`, Meri PR252 `7eee7f7c358be9ae903169816ef68eb6e64ae1f3`. They are dependencies to inspect, not this continuation's base and not permission to edit. Core includes the research wall backport plus meeting-cancel and mail-refusal fixes; frontend includes current-access and view-lifetime fixes; Meri includes advancing-clock reads, current capability policy and native-history compatibility/custody fixes. Never reimplement those old-base deficiencies. Root's supplied release observation is images built/reviewed, AgentCore version7 READY/DEFAULT7 with preview6 still serving and final service cutover pending; this reviewer has performed no live readback.

Final shared-contract adoption, rebase onto the eventual Wave 2 successor, integration, deploy and authenticated release-dependent acceptance wait for Root's explicit Wave 2 completion notice and fresh exact dependency pins. Do not invent a final base or treat a source ACCEPT as deployed acceptance. Onboard migration `20261025120000_onboard_email_delivery_claim` remains NOT LIVE; historical applied migrations are immutable. MG-06 persisted-index proposal remains pending/unallocated. Workspace approvals remain excluded by decision11/O143; full WS06/07/10, full MF16 and system-mail live acceptance remain open outside each bounded result.

## Review targets and meaningful checks

1. Domain: trace mounted `/hillday/documents` into `listDocuments`, current caller/tenant/client/wall checks and the mixed resource metadata projection. Require page3 search, deterministic ties/cursor progression, empty authorized page with continuation, filter reset semantics, malformed cursor/input, moved/revoked access, duplicate names and prospect-origin exclusion. Do not accept raw table aggregation, private skipped-row details or fabricated common IDs. Preserve the existing client association and resource-kind contract. The author owns backend only; UI adoption remains a later dependency.
2. Workspace UI: confirm the actual existing `GET /drafts/:draftId/versions` producer shape at the pinned Core source. Validate exact parent/version identity, supported immutable snapshot rendering, safe/inert unknown content, consistent comparison labels, no local-unsaved text substituted for history, and clearing on denied/current-scope changes. No restore or other write may result from opening/comparing history. Test the actual mounted consumer with a real producer-shaped fixture; inspect keyboard/loading/error states. Preserve unsupported JSON without lossy mutation; copied-Core-brief drafts must not gain whole-draft restore.
3. Data: trace actual existing adapters/families and Core source reader, not only a pure selector helper. Unsupported legal citation/edition, implicit-year or folder-only news, and any Outreach detail selector including empty must refuse honestly before source. An authorized valid-empty result is distinct. Check client visibility changes across await, source refusal/partial result and correct provenance. No new read capability, arbitrary legacy passthrough, clocks, duplicate authority or provider action. If existing tests/source already satisfy an obligation, reuse that exact evidence and accept a no-product-change disposition rather than require a cosmetic patch.

For each new executable test, inspect a behavior mutant or original counterexample that fails for the intended assertion, then restored pass. Mutation N/A only when no executable tests are added, with explanation. Compare suspected inherited failures against untouched exact base in the same environment once; preserve actual names, errors and limits. Select affected meaningful gates; do not rerun broad inventories or invent a qualification framework. Require deletion searches for replaced identifiers/callers/config, label immutable history, and explain any lost tests. No custom authority/cache/profile-pin framework or disabled dead replacement code.

## PROCESS 6.2 verdict and PROCESS 6.3 handoff

Return one independently scoped verdict per ready candidate:

```text
FROM: independent Codex reviewer | TO: author/Root | TYPE: verdict | RE: PR at exact head, base exact SHA: ACCEPT or CHANGES
Source: repository, branch, exact base/head/tree, compared paths and UTC; remote head rechecked.
Gates: command/tool version/exit, PASS/FAIL/NOT RUN, UTC, counts/limits, base versus head; distinguish reviewer-run, inspected author, and reused evidence.
Numbered findings: file:line, concrete current defect, acceptance impact, failing counterexample and meaningful mutant; no speculative or inherited findings relabeled as new.
Deletion proof: identifiers/files and executable search; immutable history distinguished; test-count changes explained.
Blocked/unrun: exact gate, existing owner and next action. Scope/security choice goes to Neo directly via Root; GitHub comments never approve scope. No #202 post and no merge request.
```

For the later Release/Acceptance handoff, preserve PROCESS6.3 fields: exact source SHAs, image digests and service/AgentCore revisions, UTC, configuration-binding booleans, DB ledger and snapshot names; named private identity/fixture location only; per-scenario PASS/FAIL/NOT RUN with observed outcomes and limits; retained failures, unrun checks, rollback owner and next action. These fields are pending Release/Acceptance evidence, not facts the source reviewer can assert. Implemented, reviewed, built, deployed and accepted remain separate.

Only direct Neo chat approves new scope/security policy. Routine in-plan details proceed and are logged with Root. Never publish secrets, customer-linked IDs, UUIDs, private prompts or content, including PR prose. Public reports use counts/booleans. Review notes may be returned to Root; do not modify the docs author's checkout or author source. This reviewer has no product implementation assignment.

## Verbatim retained tickets and matching scenarios

Full ticket obligations are retained below; this reviewer judges only each continuation slice defined above and leaves the remaining ticket acceptance open. The register was checked individually: WS-06 and WS-07 are UNCHANGED under section E; MT-09 is RE-SCOPED under B1/C to existing typed tools through control to Core. Historical implementation mechanisms named in MT-09 never override the full standing rules.

**Register decision for WS-06:** UNCHANGED — register §E, checked individually. Context means tenant/client/entity context, not a competing authority token. Decision 11 / O143 still excludes Workspace approvals.

#### WS-06 — Complete library semantics and durable navigation (P1)

**Evidence/root cause:** [Library][ws-library] filters the current 50-row response locally; older pages replace current data. [Screen][ws-screen] opens Hill Day/current draft in local state. Rich newsletters and Meri artifacts have separate libraries, and prospect drafts intentionally are not name-matched.

**Bounded work:** Move search/owner/type/client filters to the authorized library query with stable cursor semantics; include canonical clientId from WS-04. Add durable document and Hill Day wizard/job URLs with unambiguous resource kind. Provide explicit links/tabs to rich-newsletter and Meri libraries before attempting any aggregation. If a unified list is desired, aggregate only each owner's safe metadata projection with resource kind and authoritative route, not raw tables or fabricated shared IDs.

**Acceptance:** Search hit on page3, empty authorized page with nextCursor, filter changes resetting cursor, duplicate names, reload/back/forward, direct URLs, malformed/conflicting params, moved client scope and no unauthorized rows. Existing prospect-origin exclusion remains.

---

[ws-screen]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/modules/workspace/WorkspaceScreen.tsx

[ws-library]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/modules/workspace/WorkspaceLibrary.tsx

**Register decision for WS-07:** UNCHANGED — register §E, checked individually. Context means tenant/client/entity context, not a competing authority token. Decision 11 / O143 still excludes Workspace approvals.

#### WS-07 — Ordinary document lifecycle, content editing and version use (P1)

**Evidence/root cause:** [Draft editor][ws-draft] exposes title, known sectionContent, save and metadata-only history; arbitrary WsDocument blocks without section names render read-only. Rich formatting/preview/export exists only on prospect branch. [Documents][ws-document-service], [Versions][ws-version-service] and [ExportController][ws-exports] already own much of the missing capability. Backend restore skips removed documents and leaves extra current documents, so it is not an exact whole-draft restore despite earlier “lossless” wording.

**Bounded work:** Add ordinary manual create, safe section/tab create/rename/reorder/remove, section formatting/preview reuse, saved PDF/DOCX export with explicit all/main/tab choice, document status and recoverable delete where product semantics allow. Add version detail and compare using exact saved snapshots, then a clearly defined restore-as-new-version transaction with CAS. Preserve unsupported block JSON without lossy round-trip; show read-only reason until a typed editor exists. Do not enable whole-draft restore on a copied-Core-brief draft.

**Acceptance:** Imported source draft with block bodies, unknown rich fields, formatted/plain content, tab add/delete/reorder, malformed/oversized content, version detail authorization, restore with deleted/new tabs and ordinal changes, export saved vs unsaved warning. No data deletion hidden inside editor hydration.

---

[ws-draft]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/modules/workspace/WorkspaceDraft.tsx

[ws-document-service]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/workspace/src/documents/documents.service.ts

[ws-version-service]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/workspace/src/versions/versions.service.ts

[ws-exports]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/workspace/src/export/export.controller.ts

**Register decision for MT-09:** RE-SCOPED — register §B1 (MT-01 / MT-03–09, MT-16), §C M3; ordinary typed tools through control → Core. Retain family behavior, current Core authorization, paging and evidence; exclude per-hop authority/relay/measurement mechanisms.

#### MT-09 · Keep legal, news and Outreach claims inside reviewed slices (P1 parity; P2 expansion decision)
> **[RE-SCOPED 2026-10-23]** Behaviour and acceptance stay; implement it as tools on the control tool gateway that call the same Core endpoints, reusing the handlers under `apps/gateway/sources/*`. Do not extend native-authority, the relays or the measured-installation layer. Ignore any instruction below that names the owner/proxy pair, budget reservation, per-operation authority, the task verifier, ECS task proofs, revision pins or the temporal-issuer. See `SUPERSEDED-BY-ITEM-0.md`.

**Root cause / current state.** #197 discovers three adapters that intentionally implement narrower semantics than all historical Core inputs: parser-independent/exact legal references, explicit-source or explicit-year personnel news, and explicit-client campaign lists. Core104 improves Outreach current-client validation but does not expand these Meri adapters.

**Bounded change and owner.** Receive reviewed discovery through MT-02. In existing request-context modules, tool descriptions, selected manifest requirements and result status, make unsupported branches explicit. Only if a launch promise requires citation parsing, implicit-year/window news or outreach detail, add one narrowly versioned producer/context slice and its qualification, not an arbitrary legacy passthrough. Reconcile current Core104 owner corrections without undoing conservative Meri restrictions.

**Dependencies.** PF-24 canonical Outreach runtime cohort; current Core104 adoption decision; legal/news source owner, MT-01/02. No legal advice/product promise inferred from a source-read tool.

**Acceptance / tests.** Every admitted enum and exact ID, legal edition/reference mismatch, ambiguous citation, news folder without client, missing year, partial source cutoff, Outreach explicit client plus any outreachId field including empty. Assert unsupported semantics are UNAVAILABLE before source, not empty result. Test changed client visibility before/after canonical Outreach source.

**Pinned evidence.** [apps/gateway/sources/research-legal-legislation/request-context.mjs:45-55](https://github.com/neo-capiro/meri-greenfield/blob/bce707763f2cbabe1a73a99aee7b7ec206fa6996/apps/gateway/sources/research-legal-legislation/request-context.mjs#L45-L55), [apps/gateway/sources/research-legal-news/request-context.mjs:15-34](https://github.com/neo-capiro/meri-greenfield/blob/bce707763f2cbabe1a73a99aee7b7ec206fa6996/apps/gateway/sources/research-legal-news/request-context.mjs#L15-L34), [apps/gateway/sources/outreach-query/request-context.mjs:6-19](https://github.com/neo-capiro/meri-greenfield/blob/bce707763f2cbabe1a73a99aee7b7ec206fa6996/apps/gateway/sources/outreach-query/request-context.mjs#L6-L19), [apps/api/src/meri/meri-tools.service.ts:8636-8661](https://github.com/neo-capiro/capiro-backend/blob/5bf901173e839c0145069ec42e16dcb40c373ba6/apps/api/src/meri/meri-tools.service.ts#L8636-L8661).

---

### Matching E-scenarios copied from the earlier lane briefs

E18 is RE-SCOPED by register B2 to tools Core currently permits; E19/E31/E44 and E45 are KEEP. E18/E19/E31/E44 apply to the bounded MT-09 read slice, without allocating other families or M5. E45 is retained as a cross-module identity guard where the Workspace flow crosses modules; no Meri E-row directly replaces WS-06/07 ticket acceptance, and no stage/send work is allocated here.

| ID | Scenario | Expected result |
|---|---|---|
| E18 | **[RE-SCOPED]** Read active-set and revoked operation | Only <del>measured admitted operations</del> are discoverable/executable; revoked/missing owner refuses |
| E19 | Research/Florida/Monday/task sources | Actual delegated Core endpoint, correct selected client/pagination/time semantics and cited evidence |
| E31 | Research citation contradiction/injection | Current cited evidence supports claim; source text cannot authorize tools/effects or fabricate citations |
| E44 | Inaccessible/empty/stale provider data | Truthful unavailable/no-results distinction, no fabricated success/evidence |
| E45 | Canonical cross-module handoff | Portfolio/Workspace/Settings context preserved with entity IDs; effect appears in receiving module after reload |
