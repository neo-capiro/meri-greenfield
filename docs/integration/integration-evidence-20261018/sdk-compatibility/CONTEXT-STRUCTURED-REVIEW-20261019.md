# Context beta and SDK structured-output compatibility

Bounded follow-up to CONTRACT-REVIEW.md; read-only research plus the separately allocated two-file JS owner repair. Meri code basis `78a5ef00ea16cedcf188602ab6904af1d939d6b8`, local docs head `9f54238c84dc03f0505ccac99be5652dbb2d16db`. SDK0.3.295 / CLI2.1.295 / LiteLLM1.104.2 remain unchanged. No provider calls; Core work stopped under dot's exclusive roster.

## What the primary contracts establish

- [AWS tool use / automatic tool clearing](https://docs.aws.amazon.com/bedrock/latest/userguide/model-parameters-anthropic-claude-messages-tool-use.html) pairs `context-management-2025-06-27` with explicit `clear_tool_uses_20250919` configuration. It states **“Bedrock does not currently support `clear_tool_uses_20250919` context management on the CountTokens API.”** Its response examples add `context_management.applied_edits` to message_delta. The listed model support is older than the exact Sonnet4.6 profile; beta acceptance on that profile remains unverified.
- [Anthropic context editing](https://platform.claude.com/docs/en/build-with-claude/context-editing) applies edits server-side before the model, changes history and may invalidate prompt caching. Its direct-API counting support must not be substituted for the AWS restriction. Thus the beta is not presumed harmless.
- [Official Anthropic BetaMessage type](https://github.com/anthropics/anthropic-sdk-python/blob/main/src/anthropic/types/beta/beta_message.py) permits nullable context metadata. This is an Anthropic common response type, not proof of an exact AWS response.
- [Agent SDK structured output](https://code.claude.com/docs/en/agent-sdk/structured-outputs) guarantees schema-validated `result.structured_output` with SDK retry/error handling after tools. It does not promise a native `output_config.format` wire representation. A result marked success without structured_output is insufficient.
- [AWS structured output](https://docs.aws.amazon.com/bedrock/latest/userguide/structured-output.html) supports native format for Sonnet4.6 InvokeModel, subject to its restricted schema subset. This is a separate API feature from the Agent SDK's terminal tool.

## Closed contract, without new authority

| Boundary | Required rule |
|---|---|
| Native request beta | Optional array containing only the exact two reviewed enums: context-management-2025-06-27 and effort-2025-11-24; at most two unique values. No prefix or arbitrary values. Any semantic context_management request key, including null/empty, remains refused because exact native bytes must be countable. |
| Native HTTP header | If absent, body-level betas may still be valid. If present, nonempty comma-separated exact enums with ASCII space/tab OWS only; unique and same set as body. Duplicates/mismatch/unknown values and all x-amzn-bedrock-* feature headers remain refused. No signed-header rewriting. |
| Response context metadata | Permit only absence, null or exact `{applied_edits:[]}` at explicitly supported message/delta locations. Any unknown key, malformed/nonempty edits—even zero-valued edit records—retains UNKNOWN/held liability. Input/output usage, cache-zero requirements, frame/EOF/completion checks remain unchanged. |
| StructuredOutput | Permit the reserved terminal tool only with a schema supplied by trusted per-run server composition, exactly matching the accepted outputFormat schema. A worker-provided tool name/schema does not grant permission. Native format, if emitted, is likewise format-only with that exact trusted schema. Default unbound composition still refuses. Other MCP/tool allowlists stay unchanged. |
| Cost and outcome | Tool definitions/results add ordinary tokens, so the exact final native bytes still go to CountTokens and remain hash-bound through reservation/send. Preserve 65,536 input / 8,192 output, pricing, single-send identity and unknown-ACK holds. A model's invalid structured payload can have known billable token usage while the SDK/product rejects its outcome; outcome authorization is not a refund. |

`DISABLE_PROMPT_CACHING=1` and the pinned unset-effort setting preserve the non-cache envelope. Do not use the undocumented negative effort override as a production repair. Accurate model metadata must preserve the transmitted alias and actual model capabilities. Global beta-disable is not a complete answer and must not silently remove accepted output/schema behavior.

## Installed-source and capture evidence

LiteLLM1.104.2 filters context edits and retains the reviewed native beta set. The accurate-profile receipt `/tmp/meri-integration-sdk-review/profiled-schema-before-guard.json` independently records native header enums equal to body enums (context-management + effort). The earlier negative-capability receipt `pinned-capability-experiment-receipt.json` removed effort but retained context beta and the `StructuredOutput` terminal tool; no successful SDK structured_output resulted. Therefore the tool choice is not evidence that beta-disable or incorrect model metadata caused a fallback.

Both the Python send guard and canonical JS observation owner previously rejected every anthropic-beta header. Body-only changes would leave both real gates blocked. The allocated JS repair is commit `b3f55c901fe313d4c0be1d477490c19a54a8e6e7`, only product-request-owner.mjs and its test. Python owner confirmed matching optional-header semantics. Owner/boundary/bridge/envelope tests: **21/21**, including 9 positive shapes and 43 no-SQL refusals. Full source hashes, commands and retained setup failure: `/tmp/meri-js-beta-observation-review-20261019/EVIDENCE.json`.

## Remaining evidence required

Actual pinned SDK text and schema paths must cross actual LiteLLM, closed guards, exact-byte CountTokens stand-in, canonical JS reservation and complete framed native-response parsing; the schema path must return schema-valid structured_output through SDK ownership. Negative tests must retain holds for nonempty context edits, cache usage, truncation, lost ACK and usage conflicts. Native format and terminal-tool paths are qualified separately when emitted.

These local checks do not establish actual AWS beta/header/CountTokens acceptance, private owner HTTPS, real PostgreSQL, product image or live chat. Those remain named integration gates; no provider call or deployment is authorized by this report.
