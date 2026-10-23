# Item 0 step 1: pinned SDK discovery and synthetic experiment

Source base `05d588c7c5d6da8b8e8a12ea4d47e16526af1aaf`; requirements PR206 `39decf1ff6c382c1a2d5172a13c1da6f1074520d`. Experiment only, **do not merge**. This replaces no production code and qualifies none of the superseded runtime layers.

**Decision before live execution: go to the bounded direct-Bedrock experiment; product go/adjust remains pending.** The pinned SDK already supplies the loop, prompt preset, tool transports and session mechanism. No replacement harness or custom continuity state machine is needed. Six offline tests and JavaScript/SDK type checking pass. AWS, container execution, quality comparison, TTFT and fresh-container model continuity remain root-run checks.

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

Root's live inspection found runner:45 is X86_64 with no task role. A new bounded ARM64 experiment image/task role is required. Root owns all AWS operations and must supply the approved model/profile ID, image digest, task-role/network/output-collection facts. Bedrock endpoint and native web egress must be observed, not inferred from direct SDK support. Do not replace failed WebSearch with a custom engine without an explicit adjust decision.

## Primary references checked 2026-10-23

- [Anthropic external session storage](https://code.claude.com/docs/en/agent-sdk/session-storage): native interface, mirror failures, temporary restoration, subagents and reference adapters.
- [Anthropic MCP](https://code.claude.com/docs/en/agent-sdk/mcp) and [subagents](https://code.claude.com/docs/en/agent-sdk/subagents): native integration; current docs can include options newer than0.3.295, so the installed package is the compatibility authority.
- [Claude Code on Bedrock](https://code.claude.com/docs/en/amazon-bedrock): standard task-role credential chain and provider configuration.
- [Environment variables](https://code.claude.com/docs/en/env-vars): output-token bound. [Hosting](https://code.claude.com/docs/en/agent-sdk/hosting): bundled binary, storage and filesystem isolation.
- [Permission behavior](https://code.claude.com/docs/en/agent-sdk/permissions): allowedTools preapproves; it is not a deny-all tool inventory. Bare disallowedTools removes Bash; the spike makes no production sandbox claim.
- Amazon-bedrock skill's model-invocation and TypeScript references: explicit output bound, least-privilege role and model/profile verification. The requested Agent SDK owns provider invocation; this experiment does not add a Converse loop.

## Remaining acceptance

Root runs five questions in five fresh containers, preserving seed output for native store resume/fork; optional sixth Stop probe. Review actual native tool results, correct remembered phrase, original fork preservation, no mirror errors, ARM64 process exit, measured timing and usage. Separately compare against claude.ai. Public-web behavior, prompt caching, long-context/compaction and durable backend outage recovery remain unmeasured; do not report them passed from type presence. Then record a concrete go/adjust decision before any product path replacement.
