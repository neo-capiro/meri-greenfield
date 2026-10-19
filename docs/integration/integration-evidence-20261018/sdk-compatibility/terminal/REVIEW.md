# Native terminal authorization gate

Commit `8c65bdc33b51b5d83bce48050b1d8791ad2c31d5`, parent `87b6e8beac3af3ed72d22247c59ac461b7edd3d5`, branch `fix/sdk-proxy-body-contract-20261019`. Only production `apps/proxy/product/response_settlement.py`, the new dedicated gate regression, and the two explicitly allocated existing host tests changed. No upstream callback, accounting, pricing, worker, Core or harness implementation changed.

The actual SDK red observations at combined `781047bc0e90b53b737d408a4faa5d1467089251` showed `success/is_error=false` despite later host refusal. A truncated final AWS frame retained UNKNOWN135248 with no settlement; lost settlement ACK plus unavailable readback had durable SETTLED90 but no host completion proof. The existing ASGI guard blocked only `more_body=false`, after native terminal bytes had already reached the SDK.

The existing response owner now gates release in the mandatory outer `NativeSettlementTransport`. Its canonical CRC/frame/usage parser still owns validity. It retains exact raw bytes starting with the chunk that completes any tool-use start or terminal message_delta/stop. Holding all tool-use starts prevents the SDK's internal StructuredOutput tool from completing before accounting proof. Earlier text chunks stream. Nonstream JSON holds its entire body. No payload is rewritten and no second SSE parser, settlement owner, refund or retry is introduced.

The gate rejects invalid/oversize observations immediately, and rejects incomplete EOF before release. Canonical settlement acknowledgement, or the existing exact same-request SETTLED readOutcome proof after typed lost-COMMIT acknowledgement, must complete before held bytes are released. Generic errors never invoke reconciliation. The original8MiB wire/4MiB JSON bounds apply before append. Finally/aclose clear held bytes; cancellation and concurrent close cannot flush them; the owned source closes once before success release. The inner independent host observer remains observational and must finish before authenticated completion capture.

| Verification | Result |
| --- | --- |
| Final gate regressions against exact original response owner87b6e8be |5 tests,21 failed subassertions, retained |
| Gate regressions after repair |5/5 pass |
| Existing host observation/composition/upstream callback plus new gate regressions |42/42 pass |
| Initial affected run before expectation alignment |3 failed subassertions +1 error, all old later-refusal expectations in2 tests; retained |

The five regressions include coalesced/event-split/11-byte split frames, early text streaming, StructuredOutput arguments, JSON body pre-ACK suspension, truncated/corrupt final frames, trailing garbage or valid trailing event after stop, strict SETTLED versus UNKNOWN/mismatched/unavailable readback, cancellation, concurrent close, source close count, exact output bytes/hash and original size bounds. Existing test changes require the stronger earlier `INCOMPLETE_NATIVE_RESPONSE` refusal and no ASGI bytes; existing count/provider/reservation/settlement/capture assertions remain intact.

These21 new failed-control subassertions are separate from the original Meri32 audit failures. They are newly exposed real product terminal-release defects, not inherited fixture counts or skipped tests.

Focused command:

```sh
env -i PATH=/usr/bin:/bin TZ=America/Toronto PYTHONDONTWRITEBYTECODE=1 LITELLM_LOCAL_MODEL_COST_MAP=True AWS_EC2_METADATA_DISABLED=true /tmp/meri-integration-sdk-env/bin/python -m unittest apps.proxy.product.test.test_response_terminal_gate apps.proxy.product.test.test_host_observation apps.proxy.product.test.test_host_composition apps.proxy.product.test.test_upstream_callback -v
```

Python3.13.5, LiteLLM1.104.2, HTTPX0.28.1, botocore1.43.111. The pinned red control loads only the unmodified response_settlement.py source obtained by `git show 87b6e8beac3af3ed72d22247c59ac461b7edd3d5:apps/proxy/product/response_settlement.py` under its real package module name, then runs the final new gate regression file. The source snapshot and its hash are retained. Earlier red log predates the extra concurrent-close assertion; the fresh pinned red uses final committed test contents and reproduces21 failures.

Exact source hashes, scrubbed logs and commands are in manifest.json. Independent actual SDK after-results belong to the egress lane and are pending this source receipt; no harness-only result suppression was used. All I/O here is synthetic source/transport/settlement. No provider, DB, AWS, build, deployment or live-chat operation occurred. Shipping/chat HOLD remains active.

Additional qualification expectation follow-up: `8e91befe122b4b4e37b4954ba1544ba02f4c3c8c` changes only `apps/proxy/qualification/test/test_product_response_settlement.py`. Root's full affected98-case run found15 suberrors plus1 failed assertion across4 names expecting the old silent/late refusal or JSON3-byte-prefix streaming. The file now requires typed exact early refusal and exercises early-close on real native text frames, preserving every original zero-settlement/provider counter assertion and the JSON stream-exception case. Focused qualification+new gate18/18 passed. No production source changed. The root failed log remains visible; this is separate from the original Meri32 and from the new real-product21-subassertion red control.

Independent source review of8c65bdc3 approved with no blocking findings and separately reproduced42/42 terminal/host/upstream plus49/49 body/native-usage/envelope. Receipt `/tmp/meri-terminal-gate-independent-review-20261019/REVIEW.md`. Actual SDK matrix remains the egress lane's separate qualification.
