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

# Wave 2 — user acceptance checklist, 25 October 2026

**Status: deployment in progress; final authenticated acceptance NOT RUN.** This is a preparation checklist, not a readiness announcement. Release must provide exact coherent deployed pins and a no-deploy acceptance window before these checks begin. Start after Release confirms that handoff:
https://portfolio-preview.app.capiro.ai/meri
General: https://portfolio-preview.app.capiro.ai/meri?scope=general

Use the nominated synthetic smoke client and disposable test data. If a prerequisite is missing, record “Not run — prerequisite missing”; an empty list, disabled control or “requested” message does not prove completion.

## Start here — ordinary signed-in user

| Item | What to do | Pass criterion | Prerequisite |
|---|---|---|---|
| General chat | Choose General. Send “Reply with exactly: Preview smoke ready.” | One completed response gives that phrase, without a client being selected. | Updated preview; permitted model/budget. |
| Client chat and authorized read | Choose the synthetic smoke client. Ask for its current display name and whether its description is empty; request no changes. Compare with its Portfolio profile. | Answer matches the current profile and stays in the selected client’s scope. | Access to the nominated client. |
| Follow-up and context | In the General conversation ask “What exact phrase did you reply with earlier?” In both General and client conversations, ask a follow-up that refers to that conversation’s preceding answer. | Correct earlier context is retained; responses are not duplicates or unrelated restarts. | Successful preceding turns. |
| Sources and citations | Ask for a summary of an available hearing or stored intelligence item and its source. Open the returned source/evidence link. | Link reaches the corresponding permitted evidence; claims match it. Missing evidence is stated clearly rather than invented. | An existing accessible source item. |
| Streaming, reload and reconnect | During a longer harmless response, reload the page, then reopen the same conversation from Recent. | Earlier turns return; the current response resumes or shows its saved outcome once, without duplicate messages. | A response long enough to observe. |
| Stop | While a response is active, click Stop run. Reload that conversation after it stops. | A stopped/terminal outcome is visible and output stays stopped after reload. | An actually active run. |
| Idle restoration | After the announced idle interval, reopen the same conversation and ask about its earlier phrase/content. | Saved history and prior context survive the idle period. Record this separately from an immediate reconnect. | Candidate idle interval is 15 minutes (900 seconds); Release must reconfirm after final cutover. A completed earlier conversation and actual idle/restore evidence are required; waiting alone does not prove runtime eviction. |
| Personal settings/navigation | Open /settings/personal → Manage profile and security; view Security, then close. Open /settings/meri-preferences → Help and shortcuts; check empty required-field validation and cancel. | Correct account view opens; closing restores focus; invalid forms do not submit; selected client scope is retained where applicable. | Signed-in user. No credential change or support submission. |

## Admin or special-data tests

| Item | What to do | Pass criterion | Prerequisite |
|---|---|---|---|
| Model limits | /settings/preferences → Usage and limits. Read current limits. If authorized, save one agreed change, then Reload current limits. | Saved values persist after reload; unavailable/denied reads never appear as editable defaults. | Current workspace administrator; agreed change and budget. |
| Objective → Strategy | Client Objectives → open a saved ready Objective → Strategy intake → choose Strategy type → Request Strategy generation. After completion, use Open generated Strategy receipt and reload. | Actual generated Strategy/version opens and remains saved. “Requested” alone is insufficient. Test regeneration through its exposed control once an eligible saved Strategy exists; the new version must persist. | Ready saved Objective, required fields complete, no unsaved edits, current authority. Fixture not yet nominated. |
| Routine execution and pause | /meri/routines → New routine. Set one finite internal-only run and output destination meri-inbox; Prepare routine for review → review → Approve routine change. Open its result through Recent. For a separate future run, use Pause or cancel → Pause future runs and approve the change before it is due. | Due routine produces one visible result. The separately paused future run does not fire. Active work is stopped using Stop run in its conversation. | Routines enabled; agreed timing/limits. No external effects. |
| Native task action | In a conversation, request a harmless change to the owned synthetic task; review and approve the offered action. Check the current task or /meri/task-updates. | The exact approved change is saved once and remains correct after reload. | Owned synthetic task and enabled action. |
| Generated files | Use an enabled native document action. After Document prepared, open Files in this conversation → Preview and Download. Open the downloaded file in its normal app. | Actual published file appears, inspection matches it, and download opens with expected content. | Enabled document capability and permitted client. Manual uploads do not cover this test. |
| Ordinary file lifecycle | Client Files → Upload → Select files → Upload file. Use one small private synthetic text file. Wait for a ready row; preview/download, review a Move to folder action, then review deletion of that disposable file. | File becomes ready; downloaded content matches; move persists; deletion has a completed outcome/receipt after reload. Disappearance alone is insufficient. | Current write permission. Only the newly created disposable file. |
| Prospect file copy | On the eligible converted synthetic prospect, choose Upload to copy → Review private client copy; confirm once. Reopen the outcome and destination. | Private destination becomes ready, matches the reviewed source, and persists with a completed receipt; original remains unchanged. | Ready manual prospect upload and genuine completed conversion to an accessible client. No eligible pair currently nominated. |
| Contact carry-over | On an eligible converted synthetic prospect, review contact carry-over and choose the offered create, exact-link or skip option. Reopen the client relationship. | The selected outcome is recorded accurately, with no unintended duplicate contact or relationship. | Genuine converted prospect and nominated contact/link fixture. |
| Private brief copy | Open a saved synthetic prospect brief → Copy to client; review the destination. Open the resulting private Workspace draft. | Draft is private, belongs to the selected client, matches the reviewed brief version and remains available after reload. | Saved brief, accessible linked client and working Workspace service. |
| Personal memory | Request a harmless personal-memory proposal. /meri/memory → Personal memory review → Refresh. Approve it, or reject a separate proposal with a reason. | Approval persists in the correct personal scope; rejection is recorded without applying the proposal; reload does not duplicate it. | Memory enabled and an actual pending proposal. |
| Calendar import/recovery | /calendar or client Calendar → Sync calendar. Choose an existing owned Microsoft account and narrow displayed range → Import calendar meetings once. Reopen → Check saved outcome; use Continue saved import only if the retained request is pending. | Correct permitted meetings appear; saved outcome/counts persist; reopening does not import again. | Existing owned connection, valid current permissions and known permitted event. Google needs its server-defined window confirmed separately. No reconnect or provider event edits. |
| Settings permission guards | Check Team’s current-user row; open /settings/billing, /settings/hq-support and /settings/hq-broadcasts with the applicable restricted test role. | Self role/removal controls remain protected; billing/HQ pages refuse unauthorized access without exposing restricted content. | Appropriate existing role fixtures. No role changes, invitations or billing actions. |

## Unavailable or excluded from this checklist

- Four legacy Intel generators: new live AI extraction, generated post-hearing recaps, new published-record briefs/model reconciliation, and scheduled editorial generation. Existing hearing/evidence reads remain in scope. Do not use the hearing “brief” endpoint as a read test.
- Legacy Stage-G execution/generation and Context Import generation. A staged placeholder is not generated-output acceptance.
- General-scope Objective generation and rendered PDF/visual previews that are not enabled.
- Provider sends/invites/event edits, reconnecting or widening scopes, billing/identity changes, real-customer deletion, and fabricating hearing/job/conversion records.
- Physical retention/30-day erasure needs separate release evidence; Trash suppression alone does not prove it.

Current fixture position: existing sign-in and the synthetic smoke client are available; that client’s Files list is empty. Objective availability is unconfirmed on the predecessor build. No eligible converted-prospect or reviewed-hearing fixture is nominated. These gaps do not delay deployment; report the affected live tests as unexercised until their prerequisites exist.

