# Wave 2 item 0 (first): Claude-native harness

Owner decision (Neo, 2026-10-23): "i want claude to handle the harness as much as possible because i want responses to be as good as claudes quality." Wave 1 finishes on the current design; this is the first Wave 2 item and comes before every other Wave 2 brief that touches the runner, proxy, owner, budget or authority code.

Standing rules:
- "follow best practices and have simple chat work. dont over engineer and dont leave dead code behind."
- "we need to simplify and have chat working in a standard architecture. we dont need all this extra security layers."

## 1. Why

Answer quality comes from Claude's whole harness, not only the model: the system prompt, built-in tools (web search/fetch, file tools), context management and compaction, skills, subagents and extended thinking.

Meri runs `@anthropic-ai/claude-agent-sdk` (0.3.295, `apps/worker/conversation/`). Around it we built roughly 30,000 lines that replace or re-check what the SDK and AWS already do:

| Our layer | Approx. size (non-test, `origin/main` @ `05d588c7`) | What replaces it |
|---|---|---|
| `apps/proxy/product` + `apps/proxy/qualification` (owner/proxy pair: model credentials, per-call admission, reservations, CountTokens, retries) | ~15,100 lines | The SDK calls Bedrock directly (`CLAUDE_CODE_USE_BEDROCK=1`) with the runner task's IAM role; the SDK handles retries and streaming |
| `apps/gateway/budget` (reserve/settle per model call) | ~2,000 lines | SDK `maxBudgetUsd`/`maxTurns` per run, plus the SDK result's reported cost written to one tenant ledger row per run |
| `apps/runtime/native-authority` (per-operation verifier, origin authority, ECS task proofs, relays) | ~9,500 lines | One admission check in control per turn; SDK `allowedTools` / `canUseTool` / hooks for tool policy |
| `apps/runtime/temporal-issuer` (short-lived Temporal API keys) | ~2,800 lines | Standard Temporal auth (mTLS client cert or namespace API key from Secrets Manager) |
| Custom session continuity (first/continuation sessions, checkpoints, run journal pins) | several files | SDK `resume` / `forkSession` with the session id stored on the conversation |
| Our own read tools, with most of Claude's tools disabled | — | Claude's built-in tools plus Capiro data exposed as MCP tools |

Live evidence of the cost, from one simple first-chat turn on release 05d588c7 (2026-10-23):
- control made 372 Core `/current` calls, 808 ECS describes and 72,919 DB statements;
- the model stream took 4.7 s, but terminal came at 217 s;
- the answer said "I don't have access to any institutional source tools".

Almost every Wave 1 failure (proxy 403s, lease cuts, carrier drops, budget quarantine at CountTokens 465 vs billed 448, pair re-proofs, authority receipts) came from these layers, not from the SDK.

## 2. Target architecture

```
browser ──► control (API: auth once, tenant cap check once, conversations, stream relay, batched persistence)
               │ start run
               ▼
            Temporal (durable run) ──► worker ──► runner task (one per run, isolated)
                                                   └─ Claude Agent SDK, full harness
                                                        ├─ Bedrock directly (task IAM role)
                                                        ├─ built-in tools (WebSearch, WebFetch, Read/Write in /run scratch, …)
                                                        ├─ skills + subagents
                                                        └─ MCP: capiro-core (client, activity, strategies, bills, objectives, files, …)
```

### Keep
- control: sign-in (Clerk JWT → Core identity), client access check once per turn, conversation storage, SSE relay to the browser.
- One isolated Fargate runner per run.
- Temporal for runs surviving deploys and restarts.
- The tenant monthly cost cap: one ledger, checked at admission and debited from the SDK result's reported cost.

### Remove (delete, don't leave dark)
- The owner and proxy services and all of `apps/proxy`.
- Reserve/settle budgeting in `apps/gateway/budget` (except the one tenant ledger).
- The temporal-issuer service.
- Per-operation authority: task verifier, origin/run-current authority, ECS task proofs per operation, read-credential relays.
- The custom continuation/checkpoint machinery that `resume` replaces.
- Their CloudFormation resources, task definitions, ALB rules, secrets and kit steps.

## 3. Runner (SDK) configuration

- **Model access:** `CLAUDE_CODE_USE_BEDROCK=1`, `AWS_REGION=us-east-1`. The runner task role allows `bedrock:InvokeModel*` on the approved model ARNs only. No proxy and no `ANTHROPIC_BASE_URL`.
- **System prompt:** the SDK's Claude Code preset (`systemPrompt: {type:'preset', preset:'claude_code', append: <Meri/Capiro persona + selected-client context>}`). Don't replace it with our own prose.
- **Tools:** Claude's built-ins on by default (WebSearch, WebFetch, Read/Write/Edit/Glob/Grep in the run's scratch dir, TodoWrite, Task/subagents), plus the Capiro MCP server. Bash stays off unless sandboxed; the existing `bash-sandbox.mjs` path can be evaluated later. Use `allowedTools` to list what's on; `canUseTool`/hooks only for writes that need user approval.
- **Capiro data as MCP:** one in-process MCP server (`createSdkMcpServer`) exposing typed tools that call Core with the user's delegated token, which is fetched once per run. Start with read tools for the selected client: profile, activity timeline, strategies and steps, bill tracker, objectives, district nexus, files/workspace docs, calendar. Reuse the existing read families' Core clients; drop their authority wrappers.
- **Skills and subagents:** load existing Meri skills through the SDK's skills/plugin mechanism (`skill-plugin.mjs`, `subagents.mjs` already exist), with no custom gating.
- **Limits:** `maxTurns` and `maxBudgetUsd` per run from tenant settings. Extended thinking stays at the SDK default for the model.
- **Continuity:** store the SDK `session_id` on the conversation; the next turn passes `resume`. Fork uses `forkSession`. Session files persist in a per-conversation S3 prefix (download at start, upload at end), or a DB blob if smaller.
- **Streaming:** `includePartialMessages: true`; the runner forwards SDK messages to control over one stream. Control coalesces writes (about 250 ms or a size threshold) and fans out over SSE.

## 4. Security that stays (simple and standard)
- User auth: Clerk JWT verified by control, plus one Core access check per turn (identity, tenant, selected client).
- The runner gets a short-lived delegated Core token scoped to the tenant and client for the run, and nothing else.
- Network: the runner reaches Bedrock, Core and the public web (for WebSearch/WebFetch). No inbound traffic.
- IAM: runner role limited to Bedrock invoke on approved models, S3 on its session prefix, and logs.
- Cost: per-run SDK limits, plus the tenant monthly cap at admission.
- Audit: one row per run with the tools used (from SDK hooks: `PostToolUse` → append-only log), cost and token usage from the SDK result.

## 5. Plan (each step merges, ships and is checked on preview before the next)
1. **Spike (1 day):** the runner calls Bedrock directly with the preset prompt and built-in tools, and the proxy is bypassed. Run T3 to T6 on preview. Compare answer quality and latency with today.
2. **Capiro MCP:** port the read families to MCP tools on the user's delegated token. Re-run T3 with "what's Anduril's latest activity?" and expect real client data in the answer.
3. **Continuity and streaming:** `resume`/`forkSession`, batched persistence, SSE. T4 (two turns), T5 (deploy mid-conversation) and T6 (fresh tab) must pass.
4. **Budget:** collapse to the tenant ledger plus SDK limits. H1/H2 cost checks must pass.
5. **Delete:** proxy, owner, temporal-issuer, gateway budget reserve/settle and native-authority per-op code, with their infra and kit steps. Prove in one PR that nothing references them.
6. **Temporal auth:** move to standard mTLS or a namespace key.

## 6. Acceptance for this item
- T3 to T6, H1 and H2 pass on preview.
- First delta is visible within about 3 s of `run.running`; the full answer lands within about 2 s of the model stream ending.
- Per simple turn: ≤5 Core calls (control, excluding MCP tool reads the model chooses), ≤10 AWS calls besides RunTask, and ≤300 DB statements.
- Side by side with Claude.ai on 5 Capiro questions, answers are comparable in depth and accuracy, with Capiro tools used where relevant.
- `apps/proxy`, `apps/runtime/temporal-issuer` and per-operation authority code are gone from `main`, and the services are removed from the stack.

## 7. Traps carried over from Wave 1
- Deploy lock: one shipper at a time to preview (see `WAVE-2-HANDOVER.md` §0).
- The new-stack DB `capiro-newstack-preview-clone`: never delete or re-clone it. Snapshot, then migrate forward in place.
- The public repo must contain no customer IDs or UUIDs.
- ARM64 images only. Preview ALB rules are host-scoped and go before the catch-all; never modify live rules.
