# Wave 2 item 0 (first): Claude-native harness

**Read `../../STANDING-REQUIREMENTS.md` first.** This item comes before every other Wave 2 item that touches the runner, proxy, owner, budget, authority or Temporal auth code.

**Current decision (Neo, 2026-10-24):** implement the actual Claude SDK on standard AgentCore Runtime V1, in isolated conversation sessions with idle stop and durable SDK/artifact restore. Follow [the current migration/completion plan](../../plan/AGENTCORE-RUNTIME-MIGRATION-20261024.md); per-run Fargate and custom warm-pool instructions are superseded. The SDK full harness, direct Bedrock and Capiro tools remain Wave 2 item 0. Neo's reasons, in his words: "i want claude to handle tha harness as much as possible because i want responses to be as good as claudes quality" and "we dont need all this extra security layers". Detail marked *proposal* is Fable's design; the orchestrator may change it with evidence from the spike, but may not drop the requirement behind it.

## 1. Why

Answer quality comes from the whole harness, not only the model: the system prompt, built-in tools, context management and compaction, skills and subagents. Meri runs `@anthropic-ai/claude-agent-sdk` (0.3.295, `apps/worker/conversation/`), but the code around it replaces or re-checks what the SDK and AWS already do. Non-test code on `main` at `05d588c7`:

| Our layer | Lines | What replaces it |
|---|---|---|
| `apps/proxy/product` + `apps/proxy/qualification` (owner/proxy pair: model credentials, per-call admission, reservations, CountTokens, retries) | ~15,100 | The SDK calls Bedrock directly (`CLAUDE_CODE_USE_BEDROCK=1`) with the runtime's IAM role; retries and streaming are the SDK's |
| `apps/gateway/budget` (reserve/settle per model call) | ~2,000 | SDK `maxBudgetUsd` / `maxTurns` per run, plus one tenant ledger row per run |
| `apps/runtime/native-authority` (per-operation verifier, origin authority, ECS task proofs, relays) | ~9,500 | One Core access check per turn in control; SDK `allowedTools` / `canUseTool` / hooks; Core enforcement on each tool call |
| `apps/runtime/temporal-issuer` (short-lived Temporal API keys) | ~2,800 | Standard Temporal auth (mTLS client certificate or a namespace API key from Secrets Manager) |
| Custom session continuity (first/continuation sessions, checkpoints, run journal pins) | several files | SDK `resume` / `forkSession` with the session id stored on the conversation |
| Custom read tools, with most of Claude's own tools off | — | Claude's built-in tools, plus Capiro data as tools (§4) |

Live evidence of the cost, from one simple first-chat turn on release `05d588c7` (2026-10-23): control made 372 Core `/current` calls, about 800 ECS describes and about 73,000 database statements; the model stream took 4.7 s but the turn ended at 217 s; and the answer said "I don't have access to any institutional source tools". Nearly every Wave 1 failure (proxy 403s, lease cuts, carrier drops, a budget locked by a CountTokens/billing mismatch, pair re-proofs, authority receipts) came from these layers, not from the SDK.

The old plans for these layers are superseded: `../../source-of-truth/SUPERSEDED-BY-ITEM-0.md`.

## 2. Target architecture

```text
browser -> control: current Core access, conversation/run ownership, events
            -> AgentCore Runtime V1: isolated immutable conversation session
                 -> Claude Agent SDK full harness -> Bedrock (runtime IAM)
                 -> Capiro tools -> existing control gateway -> Core
            -> durable native SDK SessionStore and artifact owners
            -> Temporal for required durable runs, schedules and background work
```

**Keep:** Clerk/current Core access, all conversation/data/memory/artifact storage, the 14 skills and full harness, distinct run outcomes/idempotency/usage, the migrator and one tenant cap. Core rechecks permissions at actual access; revoked context cannot remain usable merely because a session is warm. General/client scope and all M2 outcomes remain required.

**Replace:** per-turn Fargate launch/readiness/task proofs and the warm pool with standard V1 session lifecycle. Bind sessions to tenant, actor and conversation; serialize turns, stop idle compute, and restore native SDK state/artifacts without reviving expired authority. Do not replace required Temporal durability with a process lifetime.

**Remove:** the register's obsolete components and every replaced source/configuration/resource/test/kit caller. Keep the prior qualified release solely for the bounded cutover rollback; historical receipts/applied migrations stay immutable. This target is approved, not yet shipped by this specification.

## 3. Runner configuration

- **Model access:** `CLAUDE_CODE_USE_BEDROCK=1`, `AWS_REGION=us-east-1`. The AgentCore runtime role allows `bedrock:InvokeModel*` on the approved model or inference-profile ARNs only (MO-13 decides the default). No proxy and no `ANTHROPIC_BASE_URL`.
- **System prompt:** the Claude Code preset with a short Meri/Capiro append (`systemPrompt: {type:'preset', preset:'claude_code', append:<persona + selected-client context>}`). Don't replace the preset.
- **Tools:** Claude's built-ins on by default, listed through `allowedTools`: file tools inside the isolated conversation workspace, TodoWrite, subagents, and the web tools if the spike confirms they work on Bedrock (§8). Bash and browser capability remain in scope with their required sandbox/native qualification; do not drop them to pass the hosting gate. Plus the Capiro MCP server (§4). `canUseTool` and hooks are used only for writes that need user approval.
- **Skills and subagents:** load the existing Meri skills through the SDK's skills/plugin mechanism (`skill-plugin.mjs` and `subagents.mjs` exist). No custom gating.
- **Limits:** `maxTurns` and `maxBudgetUsd` per run, from tenant settings. Extended thinking stays at the SDK default for the model.
- **Continuity:** store the SDK `session_id` on the conversation; the next turn passes `resume`; fork uses `forkSession`. Use the existing native SDK SessionStore and opaque transcript/substream lineage, plus the separate artifact/workspace owners. Preserve second/third turns, fork, idle/crash restore and cumulative usage. Do not reintroduce custom legacy checkpoints or assume runtime disk is durable.
- **Streaming:** `includePartialMessages: true`. The runner forwards SDK messages to control over one stream; control coalesces writes (about 250 ms or a size threshold) and fans out over SSE.
- **Cost:** record token usage from the SDK result and compute cost from a price table we own. The SDK's `total_cost_usd` is a client-side estimate. Tenant cap check: at admission.

## 4. Capiro data access (a hard requirement)

Capiro data must reach Claude with the same results and the same permissions as today. Core stays the source and the gatekeeper.

**Historical baseline (05d588c7):** the read families under `apps/gateway/sources/*` call Core at `/api/clio/tools/<operation>` with an internal service secret, a bearer token and a deadline header (`apps/gateway/sources/retained-reads/http-transport.mjs`). The master plan counts 86 read descriptors and 11 governed non-read descriptors across the families below. Preview has these reads off (T3 said "no source tools").

**New:**
- Expose each read operation as an MCP tool on a **tool gateway hosted by control**, calling the same Core endpoints and reusing the family handlers and their typed schemas. Delete the authority, relay and measured-installation wrappers around them.
- *Proposal:* hosting the tools in control means the runner never holds the Core service secret. The runner connects to the gateway as an MCP server over HTTP, authenticated by a short-lived per-run token that control mints at run start (scoped to tenant, user, client or General, conversation and run) and verifies locally. If the existing runner↔control channel is simple enough to carry the same calls, reuse it; decide in the spike and delete whatever ends up unused.
- The tool list for a run is what Core allows that user and client. A revoked tool or client refuses at call time (E18).
- **Scope:** a client chat is bound to one client; a General chat reads across the clients the user can already see, with each client's wall enforced per result (FINAL-PLAN decision 2).
- **Writes** are out of the first cut. When added, they go through the SDK permission callback plus Core intents, with the same receipts as today (MT-10 to MT-12).
- **Unattended routines** keep consent-bound reads (MR-04): the routine's consent travels with the run token.
- **Web:** compare the custom `public-web` family against the built-in WebFetch / WebSearch in the spike and delete whichever the built-ins make redundant.

**Parity checklist.** Every family must be reachable as tools with unchanged results and permission outcomes, proven by its existing positive, negative and paging cases (the MT tickets' acceptance): acquisition-personnel, action-items, bill-text, business-development, client-evidence, client-knowledge, client-knowledge-search, client-registry, data-search, dataset-metadata, disclosures, district-nexus, facility-representation, federal-legislation, federal-market, florida-budget, funding-opportunities, identity-contacts, intelligence-summary, legislative-directory, mail, meetings, memory-proposals, original-tracking, outreach-query, pe-references, program-elements, public-data, public-domain-hearings, public-domain-query, public-reports, public-web, regulatory-dockets, research-legal-candidates, research-legal-legislation, research-legal-news, research-portfolio, research-portfolio-evidence, state-legislation, state-status-votes, stored-intelligence, tracked-bills.

**Negative tests (mandatory, through chat and through the tool gateway directly):** another tenant's data, another client's data, walled data, a revoked client, a revoked member, an expired run token, a token for another conversation. Each returns nothing and is logged.

## 5. Security that stays (simple and standard)

- **User auth:** Clerk JWT verified by control, plus one Core access check per turn (identity, tenant, selected client or General).
- **Runtime:** authenticated standard Runtime invocation and the existing scoped tool gateway; no Core service secret or database credentials in the agent environment. Root/A own the minimal public/control contract, with no parallel grant framework.
- **IAM:** runtime role limited to the approved model and actual required storage/log operations. Source/user ownership and canonical Core checks protect durable data; session labels alone grant nothing.
- **Cost:** SDK per-run limits plus the tenant monthly cap at admission.
- **Audit:** one row per run: tools used (SDK `PostToolUse` hook, append-only), token usage, cost, outcome.
- **Before deleting any check**, inventory each check the old layer performs (identity, membership, selected client, walls, run currentness, consent) and confirm Core or the tool gateway enforces it server-side, with a negative test. Delete only what is already enforced below. Record the inventory in the step 4 PR.

## 6. Plan

Each step is its own PR and release, verified on preview before the next. **Each step deletes what it replaces in the same PR** (rule 3 of the standing requirements), with `git grep` proof in the PR description.

1. **SDK spike (historical completed experiment; do not restart).** One-off Fargate task or script using the runner image, calling Bedrock directly with the preset prompt and built-in tools. Answers: quality against claude.ai on five Capiro-style questions; time to first token; which built-ins work on Bedrock; which SDK options and session storage exist in 0.3.295; egress needs. Output: a short report in `docs/handover/` and a go/adjust decision. Retain the original results in `../../ITEM0-SDK-SPIKE-RESULTS.md`; unresolved quality/tool questions remain acceptance work. Do not merge experimental launch machinery.
2. **Model path and approved hosting migration.** Direct SDK/Bedrock exists in the Fargate baseline. Port that actual harness to AgentCore Runtime V1 per the current migration plan; preserve per-run limits; usage → ledger; tenant cap at admission. **Delete:** `apps/proxy`, the owner and proxy services with their task definitions, ALB and SG rules and PKI secret, `apps/gateway/budget` and `model-proxy`, model-grant issuance and the pinned native transport, and the kit steps for the pair. *Acceptance:* T3 completes, cost recorded once, no proxy or owner running.
3. **Tool gateway and read tools,** family by family in order of use, starting with client knowledge, activity (meetings, mail), tracked bills, strategies. Each family PR deletes that family's old composition. When the last family is ported, **delete** the credential relays, the measured-installation and catalog wrappers, and the retained-reads transport. *Acceptance:* the family's MT acceptance plus the negative tests above; a General and a client chat each answer a Capiro question from real data.
4. **Authority removal.** Do the security inventory (§5) first. **Delete:** `apps/runtime/native-authority`, the task verifier, revision pins and run-current authority; review `apps/control/admitted-runs` and `apps/control/action-host` as the register says. *Acceptance:* per simple turn, Core calls and database statements within the limits in `../../STANDING-REQUIREMENTS.md` §6.
5. **Continuity and streaming.** SDK `resume` / `forkSession`, the existing durable native SessionStore/artifact lineage, batched event saves and SSE. **Delete:** replaced legacy checkpoint/task authority branches; do not delete native persistence merely because it is continuation code. *Acceptance:* T4 (a follow-up in the same conversation), T5 (a reload while streaming reconnects, with no duplicate run) and T6 (Stop mid-stream ends cleanly) pass; a conversation continues after a deploy (E09); Stop works for a run that began before a deploy (E10).
6. **Temporal auth.** Move to mTLS or a namespace key. **Delete:** the temporal-issuer service, its code, token writer and bootstrap, and its infra.
7. **Cleanup.** Complete the migration plan's deletion inventory across source, infra, flags, active docs and operator callers; explain retained immutable history. Remove replaced resources after staged replacement acceptance, close the bounded rollback window, and measure actual Runtime cold/warm/restore latency and cost. S3 custom warm-pool implementation is superseded.

## 7. Acceptance for the item

- T3 to T6, H1 and H2 pass on preview. Their definitions are in the S2 packet on #202 (comment 6355731525): T3 first turn completes; T4 follow-up in the same conversation; T5 reload while streaming reconnects; T6 Stop mid-stream ends cleanly; H1 conversation history loads; H2 the history filter menus.
- Within the agreed limits per simple turn (Core calls ≤ 30, Core time ≤ 3 s) at minimum. *Proposed targets:* Core calls ≤ 5 (control, excluding tools the model chooses to call), AWS calls ≤ 10 excluding standard Runtime invocation, DB statements ≤ 300, first delta within about 3 s of `run.running`, the full answer within about 2 s of the model stream ending.
- Side by side with claude.ai on five Capiro questions, answers are comparable in depth and accuracy, and use Capiro tools where relevant.
- The parity checklist (§4) and the negative tests pass.
- `apps/proxy`, `apps/runtime/temporal-issuer`, `apps/runtime/native-authority` and `apps/gateway/budget` are gone from `main`, and their services are gone from the stack.

## 8. Remaining native-platform acceptance (verify, do not assume)

- Which built-in tools work through Bedrock: web search and fetch, prompt caching, extended thinking, long context? Anything that needs the Anthropic API path decides how MP (the Claude API alongside Bedrock) is built.
- What does the pinned SDK (0.3.295) offer for session storage, and what are the `resume` / `forkSession` semantics when the session file is restored on a fresh container?
- Runner egress: Bedrock (VPC endpoint or NAT), public web for the web tools, and control's tool gateway. What do the current security groups and the egress policy allow?
- Token design for the tool gateway: lifetime, scope claims, revocation within 30 s (MF-02), and how routines get consent-bound reads.
- Where does Temporal heartbeat while the SDK streams, and what is the run's deadline and Stop path?
- Bedrock model IDs and inference profiles for the approved models, and how the SDK reports usage for them.

## 9. Traps carried over from Wave 1

- One shipper at a time to preview (`../../WAVE-2-HANDOVER.md` §0). The clone database is never deleted or re-cloned; snapshot, then migrate forward in place.
- The public repo must contain no customer IDs or UUIDs.
- ARM64 images only. Preview ALB rules are host-scoped and go before the preview catch-all; never modify live rules.
- The first control task after a release exited once about 5 minutes after start (cause not proven; the replacement stayed up). Watch for a repeat on the next release.
