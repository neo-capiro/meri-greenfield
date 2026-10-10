# Codex G1 proxy transport spike

Codex implementation, 10 October 2026. **Offline transport seam demonstrated; independent review and G1 remain open.** No Hermes, AWS invocation, genuine provider credentials, model, HTTP server, build, deployment or database was used. This report does not accept the proxy configuration or a production security posture.

## Result and ownership

The pinned public LiteLLM Messages API accepts a real `AsyncHTTPHandler` client. Its supported HTTPX request event hook sees the final Bedrock body **after upstream translation and signing, before the supplied transport sends it**. The same hook is retained by the handler's connection-retry client. A per-request guard can therefore validate and count those exact bytes, obtain a pessimistic send receipt, and reject a second handler attempt without copying or patching an upstream handler.

Exactly five new owned paths: `runtime/__init__.py`, `runtime/bedrock_body.py`, `runtime/bedrock_transport.py`, `test/test_bedrock_transport.py` beneath `apps/proxy/qualification/`, and this report. No old runtime/configuration, Dockerfile, lockfile, component pins, product contracts or SDK oracle changed.

`bedrock_body.py` owns the small native request envelope and CountTokens Blob input. `bedrock_transport.py` owns trusted interfaces, the one-request guard and supported client construction. There is no server, model loop, auth implementation, durable ledger, CountTokens client, settlement or automatic refund in this spike.

## Real upstream seam

Observed call chain:

1. `litellm.anthropic_interface.messages.acreate` through `litellm.messages.dispatch` (the installed dispatch used its Python fallback).
2. The real decorated `anthropic_messages` implementation passes the supplied `client` through `anthropic_messages_handler` into `BaseLLMHTTPHandler.async_anthropic_messages_handler`.
3. `AmazonAnthropicClaudeMessagesConfig` transforms and signs the selected `bedrock/invoke/us.anthropic.claude-sonnet-4-6` request. The HTTP handler passes the signed bytes to `AsyncHTTPHandler.post`.
4. `AsyncHTTPHandler(event_hooks={"request":[guard.before_send]}, transport=recording_fake, follow_redirects=False)` invokes the guard, then the fake HTTPX transport. No mock replaced a LiteLLM route, handler, transformation or signature function.

The actual `CustomLogger.async_pre_call_deployment_hook` also successfully injected this client into the real public route. That establishes an offline callback-to-client path; it does not establish configured proxy-server loading or native auth integration. [Public Messages entry](https://github.com/BerriAI/litellm/blob/fc3920bf403124ad075bc04990f999f7e0612e12/litellm/anthropic_interface/messages/__init__.py), [Messages handler](https://github.com/BerriAI/litellm/blob/fc3920bf403124ad075bc04990f999f7e0612e12/litellm/llms/anthropic/experimental_pass_through/messages/handler.py), [HTTP translation/dispatch](https://github.com/BerriAI/litellm/blob/fc3920bf403124ad075bc04990f999f7e0612e12/litellm/llms/custom_httpx/llm_http_handler.py), [client constructor and connection retry](https://github.com/BerriAI/litellm/blob/fc3920bf403124ad075bc04990f999f7e0612e12/litellm/llms/custom_httpx/http_handler.py), [Bedrock native transformation](https://github.com/BerriAI/litellm/blob/fc3920bf403124ad075bc04990f999f7e0612e12/litellm/llms/bedrock/messages/invoke_transformations/anthropic_claude3_transformation.py).

For the real nonstream route with a synthetic system message, all three observed SHA256 values were `5c310926328b0dd5a83d897633847e5c7cd07955391e9501a055df4245e3a865`:

| Object | Bytes/evidence |
| --- | --- |
| Final signed InvokeModel request body at fake transport | 175 bytes |
| `input.invokeModel.body` supplied to the injected counter | Same exact 175 bytes |
| Base64-decoded Blob from the real botocore CountTokens serializer | Same exact 175 bytes |

The count value is explicitly **fixture 123**, not a genuine AWS observation. `NativeBody.count_parameters()` uses foundation-model ID `anthropic.claude-sonnet-4-6` and the immutable original byte string, with no parse/re-serialize step. Streaming and tool-history cases independently assert byte equality. [AWS CountTokens shape and same-input semantics](https://docs.aws.amazon.com/bedrock/latest/APIReference/API_runtime_CountTokens.html).

## Guard and injected authority

The guard accepts only POST to the two literal `bedrock-runtime.us-east-1.amazonaws.com` selected-profile InvokeModel endpoints. It rejects foreign/global profiles, region/host/query/method changes, altered Host, content encoding, unsupported content type and Bedrock feature/beta headers. Its current envelope is at most 4 MiB raw body, 8,192 trusted counted input tokens, 256 output tokens, 64 messages/blocks, eight explicitly allowlisted local tools, JSON depth 32 and 100,000 bounded nodes. Duplicate keys, malformed/non-finite JSON, unsupported body fields, thinking, cache controls, server tools, non-text media and sampling beyond zero are denied. Tool input/schema JSON remains data; a property named `thinking` inside that data is not a semantic thinking block.

Each guard has one logical request slot and an original monotonic deadline. A sticky marker is set before its first await; concurrent or later entries deny. The trusted counter must return an integer count bound to the exact native SHA, foundation model and explicitly selected observation origin. There is no local-tokenizer fallback. Counter and ledger awaits are clipped to the original remaining time and at most 30 seconds each.

`SendLedger.reserve_and_arm_once(request_id, body, count)` is an **interface requirement**, not an implemented transaction: atomically revalidate current grant/fence and aggregate budget, consume a unique send slot and persist an UNKNOWN liability before acknowledging permission to send. The receipt must match slot/body and UNKNOWN. A database adapter must enforce this across processes/restarts, including lost acknowledgements and duplicates. The guard does not authenticate an origin string supplied by an untrusted caller; counter/ledger/limits/clock/client construction are trusted dependencies, never worker JSON authority.

The in-memory fixture retains UNKNOWN on HTTP error/redirect, transport uncertainty, lost commit acknowledgement, invalid receipt, cancellation after commit, stream error/truncation and expiry at commit. No success callback releases it, even for a fully returned synthetic response. Real persistence, pricing, $10 aggregate enforcement, fencing, revocation and reconciliation remain unimplemented and unqualified.

Without the guard, the actual handler sends twice after either `RemoteProtocolError` or `ConnectError`, despite `num_retries=0`. With it, the transport records one send, the hook records two entries and counting occurs once. The actual HTTP400 invalid-thinking-signature branch also sends twice without the guard and once with it. **That branch is selected from response text even when the admitted body contains no thinking.** The earlier component-pins mitigation claim that denying thinking alone removes this retry is therefore insufficient; that historical file was not edited in this allocation. [Response-selected HTTP retry](https://github.com/BerriAI/litellm/blob/fc3920bf403124ad075bc04990f999f7e0612e12/litellm/llms/base_llm/anthropic_messages/transformation.py#L150).

The hook bounds attempts at the HTTPX transport interface. An arbitrary trusted injected transport could perform hidden work/retries below that interface; this spike does not prove a future real network transport has none. Its zero-retry construction, connection behavior and lifecycle require separate qualification. A new legitimate tool-loop request needs a new trusted slot/guard; a failed or unknown slot cannot silently become a new request.

## Checks and retained failures

Private retained evidence is `.task-inputs/CODEX-G1-proxy-transport-spike-1/`. Every child run used a replacement environment without provider/AWS credentials, HTTP proxies or Python preload selectors; packaged local cost metadata, offline model flags and AWS metadata discovery disabled. The real Bedrock signer received explicit visibly synthetic fixture strings, never a credential chain. HTTP sends used only the recording fake; DNS resolution was denied during upstream import and test calls. This is an offline fixture arrangement, not an OS network sandbox claim.

| Run | Result | Retained qualification |
| --- | --- | --- |
| Initial public-route smoke | PASS, 5.203 s | Real route, fake transport |
| `tests-1` | 15/16 PASS, one ERROR | Streaming imported missing optional `fastapi`; failure preserved |
| `tests-2` | 19/20 PASS, one ERROR | After exact locked FastAPI/Starlette/orjson dependencies, streaming imported missing `soundfile`; failure preserved |
| `tests-3` | 22/22 PASS, 7.484 s whole child | After exact locked soundfile/cffi/numpy dependencies; added actual HTTP400 retry and semantic-stream controls |
| `tests-4` | 23/23 PASS, 6.781 s whole child; 2.241 s unittest | Added literal frozen SDK echo-name seam and tightened trusted input ceiling to 8,192 |
| `body-proof-1` | 1/1 PASS, 3.891 s | After adding hash-only diagnostic output; exact body/Blob/serialized Blob hashes above. No repeat of the full unchanged suite |

The last source changes after `tests-4` were the body-proof print and a transport docstring clarification. The focused body check covers the former; no post-commit suite was repeated. All clients are closed by test teardown. Upstream creates/closes its internal retry client in `finally`. The external wrapper uses shell=false, stdin DEVNULL, exclusive raw captures and a 120-second direct-child timeout. It is not a descendant-tree supervisor, and output sizes are recorded after completion without an enforced live byte threshold. Retained Pydantic warnings explicitly state that upstream TypedDict `ReadOnly` does not enforce mutation safety; no deep-freeze property is inferred.

`tests-4` stdout: 1,680 bytes, SHA `9f0927f7332fb0898c2b3b8e150eedfe8ef0d110021113117ea5f7d4c004e1ff`; stderr: 6,999 bytes, SHA `509429932f9bc7059ecdd3801ac46d09f71e344f898cc197d70f8d3b1b113650`. `body-proof-1` stdout: 355 bytes, SHA `3494b5536105ff74f77dd1088bfb46e4116a7ba28562e387270a7bfc8846ec7b`; stderr: 280 bytes, SHA `508dbfc76a3483c1f67bb662cf6e41b1120a5c54394ccb57f0de44d345d8d1e6`.

## Source and dependency evidence

Isolated Python **3.11.15**, Windows AMD64, with no modifications to global or Hermes environments. Public wheel `litellm-1.104.2-cp310-abi3-win_amd64.whl`: 37,627,847 bytes, SHA `3aa3390077daf8f9fd39a65ec768d29754f09b2e10a2b2aa369b5c365ed7596c`, checked against retained PyPI metadata before install. Four relevant wheel Python sources matched exact commit `fc3920bf403124ad075bc04990f999f7e0612e12` after CRLF→LF normalization, with equal complete ASTs. Their raw Windows hashes differ from LF repository hashes; this is disclosed, not raw-byte identity. Eleven installed seam/import source files are individually hashed; no assertion compares every wheel file with Git. [Pinned package metadata](https://pypi.org/pypi/litellm/1.104.2/json).

Three wheel-only pip installations retained full download URLs/hashes/version metadata. Core runtime resolved httpx 0.28.1, boto3/botocore 1.43.111, pydantic 2.14.0 and openai 2.54.0. Minimal streaming import dependencies selected from the exact upstream lock were FastAPI 0.136.3, Starlette 1.3.1, orjson 3.11.6, soundfile 0.12.1, cffi 2.0.0 and NumPy 1.26.4; annotated-doc/pycparser dependencies are also recorded. Installing them is not an adopted proxy image lock or security acceptance. The broader import closure includes dormant transcription/logging modules even for text streaming; no transcription/audio operation ran. [Exact upstream lock](https://github.com/BerriAI/litellm/blob/fc3920bf403124ad075bc04990f999f7e0612e12/uv.lock).

`provenance.json`: 9,197 bytes, SHA `4436d3d1031236a61054cda25b6f39c8af6439d72db49944572aec5ed80850c5`, with 68 installed distribution metadata records, eleven source hashes and all installation/source/run evidence hashes. Upstream lock: 1,904,682 bytes, SHA `1ac0d01bfc5e7b8674edf1f97ebe4fdc9e401d204b010ef0adf797e1ea08af18`.

## Next gate

The final-body/client seam is usable for an independently reviewed next implementation. Add the trusted non-fallback native CountTokens adapter and durable Postgres slot/hold transactions first, then peer/capability/current-fence ingress and stream reconciliation. Test two independent guard instances/processes, restart/crash/lost acknowledgement, aggregate saturation, revocation and quiet streams before provider admission. No state implementation is included here.

AWS currently marks Sonnet 4.6 CountTokens supported, with foundation model `anthropic.claude-sonnet-4-6` and US profile `us.anthropic.claude-sonnet-4-6`; its general counting guide warns that some CRIS-only models need a different endpoint. This spike resolves neither account/service support nor all tools/body count semantics. A later owner-approved genuine CountTokens observation must fail closed on unsupported/error responses without switching model, endpoint or counting authority. [Current Sonnet model card](https://docs.aws.amazon.com/bedrock/latest/userguide/model-card-anthropic-claude-sonnet-4-6.html), [counting endpoint caveat](https://docs.aws.amazon.com/bedrock/latest/userguide/count-tokens.html) (read 2026-10-10 UTC).

The SDK loopback oracle remains byte-unmodified: options SHA `964f4f1958dd0707198fcd21611018b9a9337e90e5f434ed24ce47beb3986b0e`, probe SHA `4b71228ed0ce49f4bc39c2abcc497d7b76fea30ffd115ca796a13dff7edd6840`, test SHA `38a3018af9702affe042bb8a2bf8f9078c5353446c2599f16d933f163c751c72`. A test uses its literal `mcp__wire__echo` name through an explicit trusted allowlist; it does not execute the SDK or prove all actual wire fields. Proxy server/native virtual-key integration, TLS/peer binding, private endpoint/IAM policy, Linux wheel/runtime, nonroot/read-only image behavior, scan disposition, actual SDK wire, model budget and deployment/cleanup gates all remain open. Current Meri is untouched; paid model calls: zero.
