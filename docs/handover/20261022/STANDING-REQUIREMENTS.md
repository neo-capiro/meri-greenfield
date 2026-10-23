# Standing requirements for all Meri work (Neo, 2026-10-23). Read this first.

These override anything older in this repository: the master closeout plans, `FINAL-PLAN-20261021.md`, briefs, `AGENTS.md` and notes. Each Wave 2 brief repeats rules 1–4 at its top; the full text is here.

**What is Neo's and what is Fable's.** The quoted lines below are Neo's words. The direction is Neo's decision (2026-10-23): finish Wave 1 on the current design, then make the Claude-native harness (SDK full harness, direct Bedrock, Capiro data as MCP tools) the first item in Wave 2. The numbered rules are Fable's translation of those words into engineering rules. Anything marked *proposal* is Fable's design detail: the orchestrator may change it with evidence from the spike, but may not drop the requirement behind it.

Neo's words, verbatim:

- "follow best practices and have simple chat work. dont over engineer and dont leave deadcodd befind. just make it work"
- "if its over engineered make it simple so we stop running into problems. do what ever yoiu have to do to solve"
- "we need to simplify and have chat working in a standard architecture. we dont need all this extra security layers. just make the changes now so we dont go back and aforth"
- "i want claude to handle tha harness as much as possible because i want responses to be as good as claudes quality."
- "also include to not leave dead code behind"
- "make sure that the source of truth docs are updated, so we they dont accident rebuild all of this uneccesary code"

## 1. Claude handles the harness

The quality bar is Claude's own. Answer quality comes from the whole harness, not only the model: its system prompt, built-in tools, subagents, skills, context management and compaction, and session handling.

- Run `@anthropic-ai/claude-agent-sdk` with its **full harness** and the Claude Code system-prompt preset, plus a short Capiro/Meri append. Don't replace the preset with our own prose.
- Do not rebuild what the SDK or AWS already does: model calls, retries, streaming, the tool loop, context management and compaction, session resume/fork, per-run turn and spend limits, AWS credentials.
- The runner calls Bedrock directly, using the task's IAM role.
- Capiro data reaches Claude as **tools** (rule 4), not as a custom retrieval layer around the model.

Spec and plan: `phases/wave2/WAVE2-00-CLAUDE-NATIVE-HARNESS-SPEC.md`. It is **Wave 2 item 0**, and it comes before every other item that touches the runner, the proxy or authority.

## 2. Simple, standard architecture

```
browser → control (auth once per turn, conversations, stream relay, batched saves)
        → Temporal (durable run) → runner (one per run; SDK full harness) → Bedrock
                                              └─ tools → control's tool gateway → Core
```

- **Core is the gatekeeper for Capiro data.** Tenant, member, client and wall rules are enforced server-side in Core. The harness doesn't re-enforce them.
- One identity and client-access check per turn. One tenant cost cap. Per-run limits come from the SDK (`maxTurns`, `maxBudgetUsd`).
- **No per-hop or per-operation re-verification, no second proxy in front of Bedrock, no credential-minting services, no reservation/settlement ledgers, no custom lease or pin machinery.**
- Before adding any mechanism, name the standard feature it replaces, or why none exists. If you can't name either, don't add it.
- "Extra security layers" means layers that re-check what a lower layer already guarantees. It does **not** mean removing the lower layer. Before deleting a check, confirm the lower layer enforces it, with a negative test.

## 3. Leave no dead code behind

A change is not done until what it replaced is gone.

1. **Delete in the same PR** everything the change makes unused: code, tests, fixtures, docs, config keys, env vars, feature flags, IAM statements, ALB rules, secrets, task definitions, CloudFormation resources, kit steps, alarms and metric filters. Applied database migrations are history: never edit them. Drop tables only through a new forward migration, after a snapshot and with Neo's approval.
2. **Temporary diagnostics come out before merge** of the fix they were added for. A log line stays only as named product telemetry that someone reads.
3. **No code behind a flag nothing turns on.** The "source-complete, activation-held" status is retired for code we don't intend to ship. Dark features need an owner and a date, or they are deleted.
4. **No** commented-out code, `legacy` or `_old` copies, compatibility shims for removed things, or "superseded" stubs.
5. **Show proof in the PR:** list the identifiers, files and resources deleted, with a `git grep` for each that returns nothing, and explain any drop in test count.
6. **Old plan tickets for removed mechanisms are closed as superseded**, not implemented and left dormant. See `source-of-truth/SUPERSEDED-BY-ITEM-0.md`.
7. **Reuse before write.** Use SDK, AWS and library features first. Custom code needs one line saying what the standard option couldn't do.

## 4. Capiro data must keep working

- Capiro data is served to Claude as tools. Core remains the source: today's read families call Core at `/api/clio/tools/<operation>`, and the new tools call the same endpoints.
- *Proposal:* tools are hosted by **control** (a tool gateway) so the runner never holds the Core service secret (`x-internal-service-secret`). The runner gets only a short-lived per-run token for control, scoped to tenant, user, client, conversation and run.
- Reuse the existing read handlers under `apps/gateway/sources/*` and their typed schemas. Delete the authority, relay and measurement wrappers around them.
- Parity: every read family that works today must be reachable as a tool with the same results and the same permission outcomes. A parity checklist is part of the item 0 spec.
- Negative tests are mandatory: another tenant's data, another client's data, and walled data must not be retrievable, through chat or through tools. A General chat reads across the clients the user can already see, with each client's wall enforced per result (FINAL-PLAN decision 2).
- Writes stay out of the first cut. When added, they go through the SDK permission callback plus Core intents, with the same receipts as today.

## 5. Components being removed: do not build, extend, qualify, measure or preserve

The owner/proxy pair (`apps/proxy`); budget reservation, settlement and liability recovery (`apps/gateway/budget`); per-operation authority (`apps/runtime/native-authority`, the task verifier, origin and run-current authority, ECS task proofs, read-credential relays, revision pins); the temporal-issuer; the P1 timeout/budget table and P2 proof reuse; authority-lite (S2) and the signed lease (S4); and the custom checkpoint / dormant-original continuity.

The register `source-of-truth/SUPERSEDED-BY-ITEM-0.md` lists every ticket, scenario and plan row affected, and what to keep as behaviour. If an old ticket and item 0 disagree, **item 0 wins**. If it is unclear, ask on #202. Never recreate a removed mechanism to satisfy an old ticket.

## 6. Done means

- The chat, tool and data behaviours in the spec's acceptance section pass on preview (T3 to T6, H1, H2).
- **Agreed limit (FINAL-PLAN S2 gate), measured per simple turn:** Core calls ≤ 30 and Core time ≤ 3 s. Live on 2026-10-23, before the fix in flight, one simple turn made 372 Core calls, about 800 ECS describes and about 73,000 database statements. That is what these rules exist to prevent.
- *Proposed targets for the new architecture (confirm in the spike):* Core calls ≤ 5 (control, excluding tools the model chooses to call), AWS calls ≤ 10 besides RunTask, DB statements ≤ 300, first delta visible within about 3 s of `run.running`, the full answer within about 2 s of the model stream ending.
- Everything the change replaced is deleted (rule 3), with proof in the PR.
- The `.github/pull_request_template.md` checklist is complete.

## 7. Carried over (still binding)

- **Never post customer IDs** (UUIDs, prefixes or other customer-linked identifiers) on GitHub. The repo is public. Use counts and booleans.
- **One new-stack database**, `capiro-newstack-preview-clone`: never delete or re-clone it. Snapshot, then migrate forward in place. Never migrate the live shared database.
- **Only Neo approves**, directly in chat. A comment quoting Neo is not an approval. Credential steps, the preview edge allowlist and other security settings are Neo's.
- ARM64 images only. Preview ALB rules are host-scoped and go before the preview catch-all; never modify live rules.
- Deploy lock and acceptance rules are in `WAVE-2-HANDOVER.md` §0.
