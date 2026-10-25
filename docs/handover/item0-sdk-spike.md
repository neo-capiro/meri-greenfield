# Item 0 step 1: pinned SDK discovery and synthetic experiment

Source base `05d588c7c5d6da8b8e8a12ea4d47e16526af1aaf`; requirements PR206 `39decf1ff6c382c1a2d5172a13c1da6f1074520d`. Experiment only, **do not merge**. This replaces no production code and qualifies none of the superseded runtime layers.

**Decision after five live questions: ADJUST; product go remains pending.** Root ran source `f4aa9d250b7ab00261560a54abd58703251da303` in five separate ARM64 Fargate tasks with direct Bedrock Sonnet 4.6. All five returned successful SDK results and exit 0, with zero mirror errors. Native task tracking was unavailable under the old TodoWrite request; native WebSearch is unavailable on Bedrock. The narrow task-tool correction below still needs its own bounded live replay. Claude.ai quality comparison and production qualification remain open. No replacement harness or custom continuity state machine is needed.

## Observed experiment results

| Original question | First text from SDK start | SDK elapsed | Observed result |
| --- | --- | --- | --- |
| Initial brief | 2.805 s | 25.316 s | Native HTTP MCP, Glob/Read/Write and original skill context; TodoWrite unavailable |
| Resume | 3.382 s | 7.010 s | Same session, remembered phrase, zero new tool calls |
| Fork | 2.646 s | 7.275 s | New session, remembered phrase, original snapshot unchanged, zero new tool calls |
| Compare | 2.653 s | 22.695 s | MCP and successful Agent invocation; subagent transcript persisted |
| Public web | 6.974 s | 15.285 s | WebFetch succeeded; WebSearch unavailable and disclosed |

These are SDK-relative timings; provisioning and browser admission are additional. Last text to final result was 48–86 ms. Root inspected the native store to confirm that resume/fork used restored conversation context without reading earlier answers from disk. This proves the synthetic fresh-container experiment, not the production storage backend or deploy/reload/Stop paths.

The five runs' incremental SDK list-price estimates total **$0.32507460**, excluding infrastructure and invoice reconciliation. Seed was $0.12675345; resume and fork each carried the seed's prior total, so their incremental estimates are respectively $0.01584705 and $0.01490580 after subtracting the same seed baseline. Compare was $0.09595455 and web $0.07161375. Preserve native per-model cumulative counters and pricing basis; never sum cumulative results or charge the seed twice. `sdk.d.ts:5714–5724` explicitly distinguishes cumulative result/model usage from main-loop-only per-turn `usage`, and warns that crash/startup failures may report zeros. A negative/missing delta is unavailable accounting evidence, not zero spend or a reason to fail a completed answer.

Quality is provisional: the compare answer treated an earlier promise and a later completed tracker as a contradiction, when the evidence supports a missing completion artifact; the fork added urgency beyond explicit fixture deadlines. Keep the original five prompts at `f4aa9d25` for the Claude.ai comparison. The corrected seed changes only native task tracking; it must not replace the original quality evidence. Raw answers, thinking and native sessions remain private. The experiment image's scan has **7 HIGH** findings and is not a release candidate.

## Narrow native task-tool correction

The pinned package exports `TaskCreateInput`, `TaskUpdateInput`, `TaskGetInput` and `TaskListInput` in `sdk-tools.d.ts:2793–2859`. Inspection of its bundled Claude Code executable finds those exact tool definitions, with deferred discovery, ordinary native task storage, and provider/model-dependent enablement. `sdk.mjs` passes `Options.allowedTools` directly to `--allowedTools`; it does not translate TodoWrite into the four task tools. The [official tool reference](https://code.claude.com/docs/en/tools-reference#task-tool-availability) documents opting these tools in through `allowedTools`.

The correction names the four tools in `allowedTools` and asks the seed to create one task, mark it in progress, save the brief, complete the task and read it back. Full preset, Agent, limits, thinking defaults, MCP and session-store configuration remain unchanged. Init advertised Task, but the observed compare successfully invoked **Agent** with no permission denial; neither init names alone nor an assumed alias mapping justifies renaming the working configuration. Six focused offline tests plus actual SDK type checking pass, including native task input shapes and rejected missing IDs/invalid status. Root may run one additional seed under the existing 12-turn, estimated $1, 120-second SDK bounds; acceptance requires successful TaskCreate/TaskUpdate/TaskGet/TaskList results, not merely tool-list presence.

## Verified against the installed 0.3.295 package

The npm lock pins SDK integrity `sha512-GaLZbMAqyT4ZCtDQYq2p26bjpqqRfoobVxCK+Ao283I12sGyw2ttMvjdCXclS9VKhs+/IIu8/AtjqyrX73FZ/g==`, bundled Claude Code `2.1.295`. `sdk.d.ts` SHA256 `e4d91d71404ce4ffc918aa590f545c7a67df6a1dfe5de8cd28a05db0a7fe872b`; `sdk.mjs` SHA256 `86ba133f4d52e80d03f04cb47f1022d5c8010a7971c7ed937a45a629c0bf2cf0`. Base-matching peers are Anthropic SDK0.133.0, MCP1.32.1 and zod4.6.5. SDK license is Anthropic's Commercial Terms (package README), not an assumed Apache grant. No upstream source is vendored.

| Need | Pinned evidence and implication |
| --- | --- |
| Full harness | `Options.systemPrompt` line2404 accepts the `claude_code` preset and append; `tools` line1641 has the full preset. Keep thinking defaults. |
| Standard continuity | `sessionStore` line1830, `sessionStoreFlush` line1838, `loadTimeoutMs`, `resume` and `forkSession` are present. `InMemorySessionStore` line1037 and standard list/read/fork/import helpers are exported. |
| External storage | `SessionStore` line6596 has required append/load and optional list/delete/subkey methods. Subagent restoration needs listSubkeys. The SDK handles materialization and cleanup itself. The experiment snapshots native development-store entries; a product backend should implement this interface using an established reference adapter. |
| Failure semantics | Mirroring is best-effort: exhausted append failure emits `mirror_error` and drops a batch while the query continues. Product completion must treat missing durable session data explicitly. `persistSession:false` and file checkpointing conflict with the mirror; the installed SDK rejects them. |
| MCP | `McpHttpServerConfig` line1178 supports URL, headers, timeout and alwaysLoad. The actual MCP client/server offline test passed an HTTP read and refused a missing synthetic header/malformed selector. This is transport evidence, not Core authorization. |
| Tools/subagents | Native `agents`, `skills`, `plugins`, includePartialMessages, allowed/disallowed tools are typed. Existing product subagent definitions are mixed with old hooks; the spike uses one small synthetic native verification agent, with no imported admission layer. |
| Skills adjustment | The 14 native-frontmatter originals all contain `disable-model-invocation:true`. Their bytes are packaged unchanged for explicit slash selection. Automatic model selection is not proven and must be deliberately changed in the later skill-owner work; do not silently remove the restriction in a spike. |
| Stop/deadline | Query.interrupt line2861 and close line3244, plus AbortController. The script offers an optional timed interrupt and a120-second abort. Actual Stop, child exit and Temporal heartbeat integration remain untested. |
| Cost | Result modelUsage is cumulative and broader than main-loop usage; a resumed/forked result may carry previous totals. Use a per-run delta with the owned price table later. maxBudgetUsd is an estimate-based SDK guard, not an AWS hard cap. |

See [experiment commands and evidence rules](../../spikes/item0-sdk/README.md). The existing plugin materializer imports contract validation and old capability composition imports admission hooks, so the standalone experiment only copies original skill bytes from the canonical asset catalog into the standard SDK plugin layout; it does not import or extend those old owners.

## Small implementation direction for later steps

Use native HTTP MCP from the runner to control. The SDK already supports headers and tool lists; a second bespoke runner-tool RPC is unnecessary unless measurements prove HTTP unsuitable. Control checks the existing run and current user data permissions at call time, then reuses the Core source handlers. One per-run token can name tenant/user/conversation/run plus client-or-General and routine consent; it is a selector for server-side checks, never an independent data grant. Exact signing, expiry, active-run lookup and the ≤30-second revocation test belong to the later gateway step. No token issuer or gateway authorization is implemented here.

Use the standard SessionStore interface for session durability. Anthropic publishes S3, Redis and Postgres examples and a conformance suite. Choose the existing storage owner after the fresh-container experiment; retain opaque entries, subkeys and ordered idempotent appends. Do not build a second session format, replay protocol or retention claim chain. Storage adapter retention remains explicit and must join the existing product deletion owner in later work.

Temporal should heartbeat in the activity while SDK messages are consumed, and translate cancellation to SDK interrupt/abort plus task cleanup. The standalone spike has no Temporal service or product control connection and cannot prove this integration. Likewise it cannot establish Core wall enforcement, routine consent, SSE reload or product run latency.

Root used a separate bounded ARM64 experiment image and task role because the older preview runner was X86_64 with no task role. Root owns all AWS operations. Native WebFetch succeeded at the official GAO page, while [Claude Code's tools reference](https://code.claude.com/docs/en/tools-reference#websearch-tool-behavior) confirms Bedrock does not expose native server-side WebSearch. Retain the existing public-web search capability; do not delete it or build a replacement provider based on this experiment. Native fetch can replace existing fetch behavior only after equivalent permission/content cases pass. See also the [provider web-search documentation](https://platform.claude.com/docs/en/agents-and-tools/tool-use/web-search-tool).

## Primary references checked 2026-10-23

- [Anthropic external session storage](https://code.claude.com/docs/en/agent-sdk/session-storage): native interface, mirror failures, temporary restoration, subagents and reference adapters.
- [Anthropic MCP](https://code.claude.com/docs/en/agent-sdk/mcp) and [subagents](https://code.claude.com/docs/en/agent-sdk/subagents): native integration; current docs can include options newer than0.3.295, so the installed package is the compatibility authority.
- [Claude Code on Bedrock](https://code.claude.com/docs/en/amazon-bedrock): standard task-role credential chain and provider configuration.
- [Environment variables](https://code.claude.com/docs/en/env-vars): output-token bound. [Hosting](https://code.claude.com/docs/en/agent-sdk/hosting): bundled binary, storage and filesystem isolation.
- [Permission behavior](https://code.claude.com/docs/en/agent-sdk/permissions): allowedTools preapproves; it is not a deny-all tool inventory. Bare disallowedTools removes Bash; the spike makes no production sandbox claim.
- Amazon-bedrock skill's model-invocation and TypeScript references: explicit output bound, least-privilege role and model/profile verification. The requested Agent SDK owns provider invocation; this experiment does not add a Converse loop.

## Remaining acceptance

Root reviews the narrow task-tool repair and may run one additional seed; no automatic replay or expanded budget is implied. The original five-question execution, fresh-store resume/fork, native subagent and observed fetch are recorded above. Claude.ai comparison is pending user sign-in. Prompt-cache/thinking usage was observed, but long-context/compaction, durable backend outage recovery, Stop, browser SSE and real Core parity remain unqualified. Record the go/adjust decision before product path replacement; image security and all production acceptance requirements remain unchanged.
