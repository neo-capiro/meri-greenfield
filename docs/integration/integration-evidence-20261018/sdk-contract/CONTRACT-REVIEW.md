# Pinned SDK → LiteLLM → Bedrock contract review

Read-only, 2026-10-18. No production edits, provider calls, installs or new framework.
Source: **`1fe6baaedbd410089907bed2e52b804ec28482ce`**, `meri-integration-sdk`.
Installed: SDK **0.3.295**, CLI **2.1.295**, LiteLLM **1.104.2**, Node **24.19.0**, Python **3.13.5**.
Exact paths, hashes and four content-free captured receipts: `installed-source-evidence.json`.
CLI SHA-256: `4503bfe11a6c7fcc1e0b39b5e0d347c04248f750b03b0977b3ad6b531fe6f358`.

## Decision and primary evidence

The strict synthetic envelope is narrower than the accepted SDK/product contract. Fixing no-tool text admission does not qualify selected schemas or MCP tools. No blanket field/tool/beta allowance is recommended.

| Field | Evidence and exact primary URL | Narrow boundary |
|---|---|---|
| `metadata.user_id` | [Anthropic Messages](https://platform.claude.com/docs/en/api/messages/create): opaque string/null, **“maxLength 512”**. [Official Anthropic Bedrock adapter](https://github.com/anthropics/anthropic-sdk-python/blob/main/src/anthropic/lib/bedrock/_client.py) passes common body fields, removes model/stream, and maps beta headers. Installed LiteLLM Bedrock TypedDict explicitly includes metadata. AWS generic Messages page omits metadata; omission does not prove rejection. | Admit SDK-needed `{user_id:string}` bounded to 512 characters. Treat the observed 150-byte JSON string as opaque; never derive authorization or print its values. AWS acceptance remains unverified offline. |
| `tools:[]` | [AWS Messages](https://docs.aws.amazon.com/bedrock/latest/userguide/model-parameters-anthropic-claude-messages-request-response.html) and Anthropic Messages document optional tool-definition arrays without a stated minimum. Actual SDK emits an empty list. | Allow zero definitions, preserving name/schema/duplicate/bounds checks for nonempty lists. Zero tools granting no callable authority is an inference from the documented array contract, not a provider test. |
| `output_config.format` | [AWS structured outputs](https://docs.aws.amazon.com/bedrock/latest/userguide/structured-output.html): **“For InvokeModel API with Anthropic Claude models, use the `output_config.format` request field.”** [Model-specific page](https://docs.aws.amazon.com/bedrock/latest/userguide/claude-messages-structured-outputs.html) explicitly includes Sonnet 4.6 on bedrock-runtime Invoke/stream. Mantle rejects it. | Allow exact format-only `{format:{type:"json_schema",schema:{...}}}`, within existing JSON/body bounds. Preserve original schema data. Admission is not proof that every schema feature is supported; AWS documents a restricted subset. |
| Effort/thinking | [AWS adaptive thinking](https://docs.aws.amazon.com/bedrock/latest/userguide/claude-messages-adaptive-thinking.html) lists Sonnet 4.6 and top-level output_config.effort: **“No beta header is required.”** Generic AWS Messages describes the older Opus 4.5 effort beta. | AWS-supported does not mean already qualified by this text/local-tool envelope. Keep effort/thinking/task-budget outside the narrow change unless separately tested. Preserve MAX_THINKING_TOKENS=0 and unset effort behavior. |
| `anthropic_beta` | AWS Messages documents feature/model-specific beta values. Captured configured and constrained requests still contain exactly `effort-2025-11-24`, even without payload effort. | No arbitrary beta/prefix allowance. Resolve that exact residual enum explicitly. Its acceptance on the selected Sonnet profile cannot be inferred solely from the older Opus 4.5 table or an offline stub. |
| Cache | [AWS caching](https://docs.aws.amazon.com/bedrock/latest/userguide/prompt-caching.html) lists Sonnet 4.6 system/messages/tools checkpoints and TTLs. [Anthropic pricing](https://platform.claude.com/docs/en/build-with-claude/prompt-caching) distinguishes cache writes/reads from ordinary input. Current native_usage.py requires zero cache usage. | Keep all semantic cache controls denied and set official DISABLE_PROMPT_CACHING=1. Never ignore extra liability or strip fields after hash/count/signing. Keys inside tool input/schema remain data, even if named cache_control. |

Current primary docs are not immutable installed pins. The v1.104.2 GitHub source-page fetch failed; exact installed LiteLLM source is hashed in the evidence JSON instead.

## Configuration findings

[Official environment variables](https://code.claude.com/docs/en/env-vars) documents DISABLE_PROMPT_CACHING. Installed sdk.d.ts:6009 explicitly describes `CLAUDE_CODE_EFFORT_LEVEL=unset`; the current online table lists auto instead. Keep that version distinction.

[Official gateway guide](https://code.claude.com/docs/en/llm-gateway-protocol), “Disable pre-release capabilities,” says beta-disable removes **“The structured-output `output_config.format` field”** on CLI >=2.1.287, while leaving effort and certain other beta headers. Captured requests confirm cache/output_config disappear but effort beta remains.

[Model configuration](https://code.claude.com/docs/en/model-config) documents supported-capability overrides. The gateway guide says DEFAULT_* overrides have no effect behind ANTHROPIC_BASE_URL. Installed NF/GCe has a provider-mode early return; the actual custom-model empty-capability experiment also failed to remove the effort beta. It is not a valid suppression proof.

With accepted outputFormat passed through canonical buildConversationOptions argument nine under beta-disable, actual SDK emitted a synthetic tool carrying the requested input_schema instead of native format. That may preserve SDK structured-output semantics, but only an actual tool roundtrip producing schema-valid structured_result can establish it. Shape capture or plain-text success cannot.

## Minimal correct production proposal

1. Extend the existing inspector narrowly for opaque bounded metadata.user_id, tools:[], and format-only output_config. Preserve fixed US Sonnet profile/endpoints, 4-MiB body bound, **65,536 input / 8,192 output**, exact CountTokens/reservation bytes, pricing revision and non-cache settlement. Preserve existing text/tool semantic validation, not recursive scans of data keys.
2. Resolve the exact residual effort beta through a reviewed bounded policy or a supported configuration actually proven at this pin. No arbitrary beta list or blanket allowlist expansion. Do not call this an AWS acceptance proof.
3. Preserve both native format and SDK fallback tool paths as applicable; do not disable outputFormat to make text green. Existing trusted run policy must bind model-facing tool names/schemas. Never trust a worker-supplied list. Current selected-skill options allow up to 11 tools and compose further sets; native BodyLimits caps names/tools at 8 and defaults to local_echo. This is a named integration dependency requiring explicit ownership, not authority to widen every name.

## Exact acceptance criteria

Use the existing offline harness: actual installed SDK/CLI → actual LiteLLM → native admission → exact-byte CountTokens Stubber → canonical JS owner → framed native stub → SDK result.

- No-tool request: metadata and empty tools admitted; exactly one count/reservation; correct final settlement; no semantic cache fields; output bound remains 8,192.
- Selected schema: canonical option survives as native format or exact disclosed SDK fallback tool; real SDK emits structured_result matching that schema. Stubbed plain text is insufficient.
- Trusted MCP tool: exact allowed name/schema, model tool_use, existing permission/gateway owner execution, bounded tool_result and subsequent SDK result. Wrong name/schema/authority denied before provider execution. Do not replace SDK orchestration.
- Negative regression: unknown beta, effort/task-budget/context/cache fields, cache in every semantic location, oversized output, unauthorized tools and duplicate keys denied. Schema/input data with such property names remains accepted.
- Preserve reservation/settlement unknown-stream holds and retry identity tests. All receipts must bind the same final raw-body SHA-256 through count and ownership.

Evidence sources: `/tmp/meri-integration-sdk-review/{sdk-shape-corrected,sdk-configured-shape-corrected,sdk-constrained-none-final,sdk-constrained-json-schema-final}.json`. All four rejected before CountTokens/provider execution (both zero); sdkResults empty. Review used only focused source reads, stdlib SHA/JSON/mmap inspection and primary documentation.

**Remaining gates:** residual-beta policy; actual schema/MCP roundtrip; real owner HTTPS/RFC1918; real PostgreSQL; product image; actual AWS acceptance. Provider calls remain zero. Minimal synthetic-client passes are partial evidence and do not close these gates.
