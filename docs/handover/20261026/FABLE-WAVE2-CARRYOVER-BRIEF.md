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

FROM: Root | TO: Fable | TYPE: brief | RE: exclusive Wave 2 carryover repairs under Wave 3

# Fable Wave 2 carryover brief — final transfer, 26 October 2026

Wave2 is administratively **CLOSED WITH CARRYOVERS**; acceptance remains **CHANGES**. Neo assigned the residual repairs to Fable and will post the results in the fresh Wave3 orchestration chat. No new decision is required to begin. The canonical launch prompt below was already delivered to Neo; it is preserved unchanged as `FABLE-WAVE2-REMAINING-FIXES-PROMPT.txt`. Read the adjacent final nine-section `WAVE-2-HANDOFF.md` for full deployed receipts, known outcomes and exclusions, and `WAVE-3-PARALLEL-LANE-PLAN.md` for existing source ownership and actual ticket mapping. These files supply the pickup context without prior chat memory.

Fable is the sole new author of these residual Wave2 fixes. Existing Hermes author processes have finished or stop is confirmed; their candidates remain review inputs. Reserve FE172's `apps/web/src/features/meri/conversation/useConversationConnection.ts`, `conversation-retry-hints.ts` in the same folder, and `apps/web/tests/meri-conversation-retry-recovery.test.ts` for Fable. The PR body's claim that it never selects a broader started successor is contradicted by independent review: actual next-run selection can reserve a successor after an already-started terminal run. Do not merge that head unchanged. Coordinate any shared HTTP/session/Workspace change with the active Ordinary Atomic Save owner before editing; its frozen paths are in the parallel plan.

Core139's final independent verdict is **CHANGES for documentation**, with13/13 focused health checks passing and no identified projection-code defect. Correct claims about `nextSyncAt`, whole-sync/all-worker cause and unproved callback/Send consent. Broader build/type failures remain qualified: the1175 typecheck count matching baseline does not establish identical diagnostics; no independent equivalence of the author's base build is asserted. Author timestamps remain author-reported. Final review: `C:/Users/Administrator/Documents/Codex/2026-10-24/wave2-visible-mail/outputs/outlook-pr139-independent-review-20261026.txt`, SHA256 `4610996331a42d7b6e0cb25fcac767cd4a96f5c8e48d792cf1f9e2d76dd493a4`.

Scope is the five existing symptom groups in the remaining list: General stored-mail denial, safe session recovery, Outlook read-sync/status/renewal, prepared-actions reads, and affected memory/document workflows. The launch prompt combines the last two and identifies bounded follow-up acceptance separately. Stop remains unproved because completion won the observed race, not a newly proven Stop defect. No new broad acceptance campaign follows. Fable returns exact reviewed source and focused evidence; the fresh Wave3 orchestrator owns review/integration, and **Wave 2 — Release Execution Continued** remains sole shipper. Configuration prepared, source accepted, deployed and live-verified are different stages.

## Authoritative copyable launch prompt

Finish the remaining Wave 2 defects for Capiro/Meri. Neo has directed administrative closure of Wave 2 and assigned these unresolved repairs to Fable; results will be handed to the fresh Wave 3 Codex orchestrator. Do not repeat the Figma/parity acceptance work you already completed or rebuild the architecture.

Read the current STANDING-REQUIREMENTS.md rules 1–4, PROCESS.md 6.1–6.3, and source-of-truth/SUPERSEDED-BY-ITEM-0.md under docs/handover/20261022 in neo-capiro/meri-greenfield. Apply the supersession register before using any old ticket. The four standing requirements are: preserve the full Claude Agent SDK harness; use the agreed simple AgentCore Runtime V1/Core architecture; delete replaced code instead of adding parallel mechanisms; keep Capiro data available through existing Core-authorized tools. Keep both user and firm memory. No authentication bypasses, duplicated policy, model proxies, custom retry framework, new connector, or weakened tenant/client/wall boundaries.

Live preview: https://portfolio-preview.app.capiro.ai/meri
Verified deployment completed 2026-10-26 at 00:34:47 UTC:
- Frontend d285e659f2bfbc00bfbd464b8c6f07dfba898d5d, ECS33. Your PRs167–170 are merged and deployed.
- Meri 87dc649e829779d5f47e1a0cc5b0e939e0c729d2, Control72 / Worker68 / Schedule5.
- Core 929acd023c29d9073cbf9d5c5105eba8c3252948, ECS15.
- AgentCore runtime9 / preview9 / DEFAULT9.
Source Core backend-import is newer: 722f094cf60e40b2fb270bb5c1e06bf66d795c42. Refresh source heads before editing. A source commit is not evidence that it is deployed.

Fix these concrete issues:

1. GENERAL EMAIL AUTHORIZATION.
A fresh General request submitted at 00:35:50 UTC completed and saved history loaded. Its response reported mail_list_messages ACCESS_DENIED and returned no records. The raw gateway refusal receipt has not been inspected, so the model's explanation is not a proved cause or policy. General mail reads are intended to work across the current actor's authorized sources with Core's mailbox/client/wall checks. Find and repair the actual denial through the existing owners; do not impose a blanket client-scope requirement or weaken access. Distinguish unavailable, denied, partial coverage and truly empty results. No external sends or mailbox changes.

2. SAFE SESSION RECOVERY.
Continue from draft frontend PR172:
https://github.com/neo-capiro/capiro-frontend/pull/172
Head 71f6343993d60a3595417de1b9212b150e783557, base d285e659f2bfbc00bfbd464b8c6f07dfba898d5d.
DO NOT MERGE AS IS. Independent review is CHANGES: generic access-loss recovery can reserve an unintended successor run for an already-started/stopped conversation. Fifty-five passing focused tests missed this case. Preserve the exact started run and any uncertain/reserved input; use the existing guarded recovery owner, not blanket retries or a new identity after an unknown delivery. The earlier history/admission 5xx cause remains unconfirmed; the new deployment's fresh General admission/history worked. Do not claim this recovery patch proves the historical outage's cause.

3. OUTLOOK SYNC AND TRUTHFUL HEALTH.
Draft Core PR139:
https://github.com/neo-capiro/capiro-backend/pull/139
Head a2b827d75c59362d7595dece8bbcbedfd987180f, base 722f094cf60e40b2fb270bb5c1e06bf66d795c42.
The projection fix has independent 13/13 health tests passing and no identified executable defect. Review is CHANGES for its recovery documentation. Correct the overclaims: failed sync can also set nextSyncAt; the serving task's disabled posture does not prove the exclusive historical cause or absence of other workers. Do not prescribe UI-host callback routing or Mail.Send consent without an established need.
The verified preview Core task is service=api, process mode=shadow, background owner=disabled, external actions=disabled, callbacks=false. Autosync/interval and eight requested Microsoft/OAuth/callback/redirect task bindings were absent; this does not prove credentials are invalid or absent everywhere. Plan the minimal activation through the existing runtime/provider owners, preserving account mapping, token-encryption compatibility, one background owner, registered callback routing and outbound-send denial. Coordinate deployment/configuration through the Wave 3 orchestrator and sole Release owner; do not activate another worker or expand OAuth permissions yourself. The “provider not configured” screenshot warning was on Gmail, not Microsoft.

4. PREPARED ACTIONS / AFFECTED MEMORY AND DOCUMENT FLOWS.
The newly deployed General and client conversations still show “Prepared actions could not be read right now.” Fix the actual read boundary and then check the affected workflows. The accepted memory/document source fixes are already deployed; do not reimplement them. Earlier memory-save and document-create attempts have UNKNOWN outcomes. Do not replay those original requests. Use only safe, fresh, approved fixtures for any needed affected success check; report unexercised flows explicitly.

5. FINISH THE NARROW LIVE CHECKS.
On the new tuple, a selected-client profile read completed and matched the prior Portfolio observation; a same-conversation follow-up recalled the supplied marker and streamed. One Stop click raced with natural completion: terminal state was Completed, so cancellation is NOT PROVEN. Run one meaningful Stop check when the repaired candidate is deployed. Preserve earlier limited passes; do not start a broad qualification campaign or treat unrun memory approval/recall, native document publication/rendering, routine/task execution, lifecycle/retention or missing-fixture cases as passed.

Inherited harness debt is separate: PR167 selected-lifecycle10/10 and PR170 Routines5/5 fail identically on unchanged baseline. Do not let those become a rewrite project.

How to work:
- You author narrowly scoped fixes and draft PRs. Codex reviews the actual changed behavior; the Wave 3 orchestrator gates/merges, and the existing Release session alone deploys.
- Adopt the useful existing candidates and correct their findings instead of duplicating them. The old Hermes author processes have finished or are stopping at their published result. Coordinate any overlap before editing Wave 3 WorkspaceDraft/ordinary-save/workspace-documents/shared session or shared HTTP owners.
- Reuse accepted tests and Fable evidence. Run only affected tests; use the failing original or one relevant counterexample for new assertions. List tests run, reused, failed and NOT RUN, with exact head/base and honest UTC evidence. Do not repair unrelated baseline build errors.
- Keep standing requirements at the top of your phase brief. For in-plan decisions, decide and record reason/rollback; ask Neo only for actual scope/security decisions. A GitHub comment is not scope approval.
- No customer-linked identifiers, mail subjects/bodies, private URLs, secrets or screenshots in the public repos. Public reports use counts/booleans for customer data.
- Return exact PR/head, changes, deleted/replaced-code proof, focused test evidence, unresolved items, and a small deployment/acceptance checklist. Clearly distinguish code fixed, configuration prepared, deployed and live-verified. Do not post on #202.

Existing private evidence on EC2AMAZ-M7CDRPT:
- C:/Users/Administrator/Documents/Codex/2026-10-25/wave2-visible-release/outputs/LIVE-87DC-D285-ROLLOUT-HANDOFF.txt
- C:/Users/Administrator/Documents/Codex/2026-10-25/wave2-visible-release/outputs/OUTLOOK-CORE-RUNTIME-POSTURE.json
- C:/Users/Administrator/Documents/Codex/2026-10-24/wave2-visible-mail/outputs/outlook-pr139-independent-review-20261026.txt
- C:/Users/Administrator/Documents/Codex/2026-10-25/wave2-visible-acceptance/outputs/FABLE-REPORTED-CHECKS-ADDENDUM-20261026.txt
- C:/Users/Administrator/Documents/Codex/2026-10-25/wave2-general-chat-email-repair/outputs/ (PR172 handoff, review and reproduction).

Neo will post your results in the new Wave 3 orchestration chat. Prioritize these concrete defects, keep the agreed architecture, and avoid expanding the work.
