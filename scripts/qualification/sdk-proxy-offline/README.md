# Offline SDK/proxy qualification partition

This harness runs the installed SDK/CLI through the real pinned LiteLLM native
app and observes the final native request before the canonical send guard.
It changes no production defaults and makes no real provider or AWS calls.
Exit 0 means the explicitly named partition passed. Exit 2 preserves a failed or
blocked result. Neither exit qualifies the complete product path.

The original harness started at `1fe6baaedbd410089907bed2e52b804ec28482ce`, combining
PR183 `b51687d4dadbb8cbf8ee817490e5f95c01e60d54` and PR185
`67a7bfbc7df47f326e4287de8df7f0f59b110b8c`, which were siblings on
`a1876afaeaa59d9da47729487d490cba8cfc9d9c`. Each receipt includes its actual
checkout commit and SHA256 of all five executable harness modules. The SDK
interoperability follow-up starts at local `9f54238c84dc03f0505ccac99be5652dbb2d16db`
(published PR188 evidence `4f59cb3d7e811ff1409b1161920c1bce6eb5ea48`). Failed
pre-repair receipts remain separate from post-repair qualification results.

## Required local environment

- Node `v24.19.0`; SDK `0.3.295`; native CLI `2.1.295`.
- Native CLI SHA256 `4503bfe11a6c7fcc1e0b39b5e0d347c04248f750b03b0977b3ad6b531fe6f358`.
- CPython `3.13.5`; LiteLLM `1.104.2`; boto3/botocore `1.43.111`.
- HTTPX `0.28.1`, FastAPI `0.136.3`, uvicorn `0.51.0`, and needed proxy extras
  installed at the versions and wheel hashes in the accepted
  `apps/proxy/qualification/linux/requirements.lock`. The harness never installs
  packages or generates Prisma clients/engines.
- OpenSSL, loopback listeners, and the repository's matching Node dependencies.

The executed task used a pure `/tmp/meri-integration-sdk-env` environment and
task-local CPython. No global install, repository dependency or lockfile changed.
There were 109 installed Python distributions; the evidence records every
name/version. The product config SHA256 is
`64860d829d7c022f6640b1a75eb48ad05dc2421d8e5e2bcdfdda50b421754d19`.

## Commands

Run these from the repository root. Output paths must be absolute.

```sh
node scripts/qualification/sdk-proxy-offline/run.mjs --python /tmp/meri-integration-sdk-env/bin/python --out /tmp/sdk-default.json
node scripts/qualification/sdk-proxy-offline/run.mjs --python /tmp/meri-integration-sdk-env/bin/python --out /tmp/sdk-schema.json --output-format json-schema
node scripts/qualification/sdk-proxy-offline/run.mjs --python /tmp/meri-integration-sdk-env/bin/python --out /tmp/minimal-complete.json --client minimal-messages --mode complete
/tmp/meri-integration-sdk-env/bin/python -B -m unittest -v apps.proxy.product.test.test_sdk_proxy_offline
```

Repeat the minimal client command with `--mode truncated`, `cached`,
`missing-usage`, `reservation-ack-lost`, `settlement-ack-committed`, or
`settlement-ack-unresolved`. Each invocation starts independent bounded child
processes and closes its task-owned listener and subprocesses. Synthetic keys
and throwaway TLS files never leave the temporary directory. Exported receipts
contain structure, hashes, fixed error codes, counters and versions; no prompts,
generated text, credential values or raw private captures.

## Actual canonical owners and fixture boundaries

`run.mjs` calls production `buildConversationOptions` and the installed SDK's
`query`; its custom spawn hook verifies and launches the exact installed CLI.
`native_proxy.py` invokes product `_native_bootstrap`, the actual native FastAPI
lifespan and `load_pinned_product_litellm_invoker`. Its handler is the unchanged
`create_guarded_product_handler`: final native bytes, `AwsNativeCounter`, UNKNOWN
reservation before send, raw response observation and settlement all execute.

`owner_peer.mjs` composes the real `createProductProxyOwnerComposition`, model
reservation and model settlement owners. They request independent host capture
callbacks over private inherited pipes. `model_ledger_fixture.mjs` reuses
`occurrenceCostFixture` for row storage and SQL transaction/commit-fault behavior.
It does not implement budget admission, pricing or settlement decisions. It
constructs an explicitly synthetic 250000 microUSD manifest/allocation with
matching hashes, facts and dates, then uses canonical allocation admission
before any reservation. It never modifies persisted fixture rows or claims
the original manifest's source pin. The SDK's production `max_tokens:8192`
requires a 135248 microUSD hold. The minimal client uses `max_tokens:16`,
requiring a 344 microUSD hold. Both settle 12 input and 3 output tokens to
90 microUSD at the unchanged Sonnet pricing revision.

The schema case binds a static trusted JSON schema to `BodyLimits` before
request observation and explicitly admits only `StructuredOutput`. The request
cannot choose its own schema authority. The stub emits a real terminal tool-use
response, and success requires the actual SDK `result.structured_output` to
match the schema and expected synthetic value. Mere schema presence or text
success cannot pass. Production per-run schema/MCP binding custody remains a
separate integration gate; this static fixture does not establish it.

The CountTokens boundary uses an actual pinned boto3 client with botocore
`Stubber`; it does not prove AWS accepts a particular request body. The provider
boundary is an in-process HTTPX transport emitting raw Bedrock EventStream
frames with CRCs, fragmented into 11-byte parts. No network provider executes.

## Executed results

The seven original minimal-client cases below passed the real native route and
canonical JavaScript accounting owners. Five focused fixture/parser tests cover
text and admitted structured tool responses, refusals, truncation and caching.

| Minimal-client case | Stub sends | Reservation inserts | Settlement updates | Durable fixture result | Client success |
| --- | ---: | ---: | ---: | --- | --- |
| Complete stream | 1 | 1 | 1 | SETTLED, 90 microUSD | Yes |
| Truncated final frame | 1 | 1 | 0 | UNKNOWN, 344 microUSD held | No |
| Nonzero cache usage | 1 | 1 | 0 | UNKNOWN, 344 microUSD held | No |
| Missing cumulative usage | 1 | 1 | 0 | UNKNOWN, 344 microUSD held | No |
| Reservation committed, ACK lost | 0 | 1 | 0 | UNKNOWN, 344 microUSD held | No |
| Settlement committed, ACK lost, exact readback | 1 | 1 | 1 | SETTLED, 90 microUSD | Yes |
| Settlement committed, ACK lost, readback unavailable | 1 | 1 | 1 | SETTLED in fixture; host proof unresolved | No |

Every case asserts exactly one count and reservation attempt, expected settlement
and readback counts, no quarantine and native startup/shutdown. No case produced
a duplicate provider execution. This is not a complete cross-request SDK retry
qualification; that requires resolving the SDK request contract first.

Before the interoperability repair, SDK defaults produced nested `cache_control`, `metadata.user_id`,
`output_config.effort`, `tools:[]`, and final native beta values
`context-management-2025-06-27` and `effort-2025-11-24`. The native closed contract
refused before CountTokens, budget reservation or provider execution. A bounded
run observed six SDK ingress requests and three final native attempts, all with
zero counting/reservation/provider execution.

Archived `sdk-configured` was a marked configuration-only candidate: it added
`DISABLE_PROMPT_CACHING=1`, `CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS=1` and
`CLAUDE_CODE_EFFORT_LEVEL=unset` after constructing actual production options.
It removed cache fields, `output_config` and the context-management beta, but
retained `metadata.user_id`, empty tools and the effort beta. It stayed blocked.
Archived `sdk-constrained` additionally declared the fixed custom model alias with an
empty supported-capability set. This gateway run still emits the effort beta;
the installed parser's provider guard can ignore custom capability overrides.
These experiments remain reproducible at historical harness commit
`5fa5545898717e1148a28447bb93254a07fa6459`; they are removed from the current
entry point. Current clients are `sdk` and `minimal-messages` only.
`--output-format json-schema` routes a small schema through the canonical
Objective output-format option so capability experiments cannot silently hide
that behavior in the recorded request shape. With experimental betas disabled,
the pinned SDK uses its `StructuredOutput` terminal tool. The same tool is also
used with accurate Sonnet metadata and experimental betas enabled; it is normal
SDK orchestration, not proof of incorrect model metadata. The SDK structured
output contract promises validated `result.structured_output`, without promising
a particular native `output_config.format` transport.

Archived `sdk-profiled` tested supported
`settings.modelOverrides:{"claude-sonnet-4-6":"meri-sonnet-qualification"}`,
`thinking:{"type":"disabled"}`, `DISABLE_PROMPT_CACHING=1` and
`CLAUDE_CODE_EFFORT_LEVEL=unset`. It preserves the exact transmitted model alias,
all tool/Objective options, and experimental beta capabilities. The actual
translated request emits disabled thinking, temperature `1`, and matching native
header/body beta enums `context-management-2025-06-27` and `effort-2025-11-24`.
The production options now own these controls. The closed guard admits only
these reviewed semantics; cache fields, semantic
context edits and unbound schemas remain refused.

Post-guard plain and schema runs passed both as archived `sdk-profiled` candidates and
with the integrated production options (`--client sdk`): one CountTokens, one
canonical reservation insert, one stub execution and one settlement. The schema
SDK result contains validated `structured_output`, and the terminal tool does
not trigger a second provider execution. Each starts with hold 135248 and
settles to 90 microUSD. Exact source pins and commands are in the run receipts.
Pre-terminal-repair negative receipts also expose a distinct product defect:
the SDK can report success after truncated final provider bytes or unresolved
settlement readback. Those receipts fail; the harness never translates host
refusal into a successful qualification. Final negative results must name the
canonical terminal-release repair commit independently of request admission.

Supported configuration references, checked 2026-10-18:
[environment variables](https://code.claude.com/docs/en/env-vars) and
[model capability overrides](https://code.claude.com/docs/en/model-config).
The installed CLI parser and SDK declarations specifically document/implement
the `unset` effort sentinel. The
[Anthropic Messages reference](https://platform.claude.com/docs/en/api/messages/create)
describes `metadata.user_id` as an opaque trace identifier with a 512-character
bound; the
[AWS InvokeModel request page](https://docs.aws.amazon.com/bedrock/latest/userguide/model-parameters-anthropic-claude-messages-request-response.html)
does not document that field. The offline stub does not prove AWS acceptance.
The service trace never supplies tenant, client or authorization authority.

## Open gates

The outer SDK HTTPS listener is loopback with a throwaway CA. Ingress peer/task
observations are explicitly synthetic. The canonical owner accounting transport
is private subprocess IPC, **not product owner HTTPS**. The product owner
transport requires actual distinct RFC1918 interfaces and endpoint checks.
This host exposes only loopback in its network namespace; attempted binds to
its resolved private addresses return errno 99. Guards and host networking were
not changed to bypass that requirement. Full owner HTTPS remains OPEN.

Genuine ECS/Core currentness, PostgreSQL durability/isolation, shipping image
execution, trusted per-run schema/MCP custody, and provider request acceptance
remain unqualified. Retry evidence is bounded by the explicit synthetic budget:
250000 cannot fund two concurrent 135248 holds, so no duplicate observed at that
budget does not establish general cross-request deduplication at larger budgets.
No deployment, model call, AWS operation or migration is part of this harness.
