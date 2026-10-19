# SDK/proxy canonical-owner qualification, 19 October 2026

17/17 offline cases and 5/5 focused tests pass at `90f82dc692fd017f4f8957cfaf8402000bb2f92f` on `qual/sdk-proxy-interop-20261018`. No real provider or AWS call ran. Owner HTTPS, shipping image, PostgreSQL, genuine Core/ECS currentness and production per-run schema/MCP custody remain OPEN/UNRUN.

Actual installed SDK 0.3.295/CLI 2.1.295 → real LiteLLM 1.104.2 → canonical native guard/CountTokens → actual Python ProductOwnerBridge and JS createProductOwnerChannel → canonical JS accounting over scripted SQL → provider stub → actual SDK result. Owner transport/TLS evidence and trusted admission facts remain explicitly synthetic.

Plain and schema successes each use one count, reservation, provider attempt and settlement. The SDK returns validated `result.structured_output`; StructuredOutput does not cause a second model request. The unchanged alias maps to us.anthropic.claude-sonnet-4-6. Disabled thinking, temperature 1 and exactly matching context-management/effort beta enums are observed. Cache and semantic context-edit liability are not accepted.

| Client/case | SDK success | Count/reserve | Inserts | Stub attempts | Settlements/readback | Durable state | Host gate / carrier |
| --- | --- | --- | ---: | ---: | --- | --- | --- |
| minimal-messages/cached | None | 1/1 | 1 | 1 | 0/0 | UNKNOWN | available/open |
| minimal-messages/complete | None | 1/1 | 1 | 1 | 1/0 | SETTLED | available/open |
| minimal-messages/missing-usage | None | 1/1 | 1 | 1 | 0/0 | UNKNOWN | available/open |
| minimal-messages/reservation-ack-lost | None | 1/1 | 1 | 0 | 0/0 | UNKNOWN | unavailable/aborted |
| minimal-messages/settlement-ack-committed | None | 1/1 | 1 | 1 | 1/1 | SETTLED | available/open |
| minimal-messages/settlement-ack-unresolved | None | 1/1 | 1 | 1 | 1/1 | SETTLED | unavailable/aborted |
| minimal-messages/truncated | None | 1/1 | 1 | 1 | 0/0 | UNKNOWN | available/open |
| sdk/cached | False | 2/2 | 1 | 1 | 0/0 | UNKNOWN | unavailable/aborted |
| sdk/complete | True | 1/1 | 1 | 1 | 1/0 | SETTLED | available/open |
| sdk/complete/schema | True | 1/1 | 1 | 1 | 1/0 | SETTLED | available/open |
| sdk/missing-usage | False | 2/2 | 1 | 1 | 0/0 | UNKNOWN | unavailable/aborted |
| sdk/reservation-ack-lost | False | 1/1 | 1 | 0 | 0/0 | UNKNOWN | unavailable/aborted |
| sdk/settlement-ack-committed | True | 1/1 | 1 | 1 | 1/1 | SETTLED | available/open |
| sdk/settlement-ack-unresolved | False | 1/1 | 1 | 1 | 1/1 | SETTLED | unavailable/aborted |
| sdk/settlement-ack-unresolved/schema | False | 1/1 | 1 | 1 | 1/1 | SETTLED | unavailable/aborted |
| sdk/truncated | False | 2/2 | 1 | 1 | 0/0 | UNKNOWN | unavailable/aborted |
| sdk/truncated/schema | False | 2/2 | 1 | 1 | 0/0 | UNKNOWN | unavailable/aborted |

The 15/17 predecessor at source 216072a76 omitted the production uncertainty gate in its direct AccountingBridge. Its two second-send failures are preserved in `before-canonical-owner/`; this was a qualification fidelity gap, not grounds to change canonical SQL slot reuse. The corrected carrier invokes actual bridge/channel state machines; unavailable settlement readback retires the real shared host gate and prevents later count/reservation/provider attempts. No duplicate poison rule or private bridge state mutation was added.

The separate premature SDK success on truncated/unsettled terminal data was a product defect, fixed in production terminal-release commit 8c65bdc3 (local 216072a76). Pre-repair red receipts remain available.

Exact commands, source hashes, package versions and scrubbed errors are in CANONICAL-FINAL-COMMANDS.json, CANONICAL-FINAL-SUMMARY.json, the 17 canonical-final receipts and canonical-final-focused-tests.log. SDK negative calls use the explicit 30-second AbortController; no75-second supervisor timeout occurred. No natural unbounded-retry termination claim is made.

Environment: Node v24.19.0, CPython 3.13.5, SDK 0.3.295, CLI 2.1.295, LiteLLM 1.104.2, boto3/botocore 1.43.111, HTTPX 0.28.1, FastAPI 0.136.3, uvicorn 0.51.0. Existing task-local pinned environment (109 distributions) and all setup failures are retained. No new package/lockfile changes were made in this follow-up.
