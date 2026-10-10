# Independent counter and native usage review

10 October 2026 UTC. Codex reviewer `hermes_discovery`, different from author `contract_review`. Reviewed exact candidate `cfb9f2084a05698c18a9cc17a0d69deb7e7c0976`. **REJECT pending the counter metadata repair below.** The unchanged canonical suite passed independently, but a new control through the real SDK operation exposed a functional blocker. No Hermes, AWS/model/provider request, install, deployment or G1 admission occurred. This commit adds only this report.

All five candidate files were fully read and matched their raw Git blobs and author final manifest, 5961 bytes / SHA256 `13fa6a2720c7c0ad5b899957d660db1234f8d71606158a7b0c20b39606d097ac`:

| Path under `apps/proxy/qualification/` unless indicated | Bytes | SHA256 |
| --- | ---: | --- |
| `runtime/aws_counter.py` | 6628 | `ff81592aff963c019f7d429d4742930817d2b7c54117735fc9ab38574791e10e` |
| `runtime/native_usage.py` | 10748 | `4898dac2d23ce9d62748d955109557eb4d85d2aed0b9318d9b8b3ac7acea5d48` |
| `test/test_aws_counter.py` | 9337 | `d9439bfc4dce3609ef02a986b2dfb8a6a46ae4b0c236ba3f8275fe4f6ab2945a` |
| `test/test_native_usage.py` | 7026 | `3180bb0cebb593971dc95099c2aaa759d7f7f429258b8f768b95f3a1c5f2cc6f` |
| `docs/coordination/reports/CODEX-G1-BEDROCK-COUNTER-USAGE.md` | 9422 | `b86a592ee7d68febc51baa6014cac3f7e2154cca52d02edb6c5a59f1337a3766` |

## Blocking finding

`aws_counter.py:110` requires exactly four ResponseMetadata keys. The required pinned botocore1.43.111 standard retry policy with `total_max_attempts=1` adds **`MaxAttemptsReached: true` to a successful first response**, alongside `RetryAttempts: 0`. Consequently the real client returns HTTP200/inputTokens7, yet the adapter raises `INVALID_COUNT_RESPONSE`.

The independent witness preserved the actual `client.count_tokens` method, serializer, signer, endpoint, response parser and registered standard retry handler. Only `http_session.send` was replaced with a literal synthetic AWSResponse. Exactly one fake send and one before-send hook occurred; the foundation-model URL, POST method, SigV4 scope and decoded Blob bytes matched. An after-call observer recorded this normal parsed metadata without altering it:

```json
{"RequestId":"independent-synthetic","HTTPStatusCode":200,"HTTPHeaders":{"content-type":"application/json","x-amzn-requestid":"independent-synthetic"},"MaxAttemptsReached":true,"RetryAttempts":0}
```

Pinned upstream `botocore/retries/standard.py:472–482` adds this field whenever the attempt number reaches the configured maximum; its response adapter merges the field into metadata. This is SDK behavior, independent of provider availability. The canonical positive replaces `client.count_tokens` itself and supplies a four-key fake response, so its PASS does not cover this path.

The smallest repair preserves the four required metadata fields, HTTP200, integer zero retries and all existing bounds; allow only the additional known `MaxAttemptsReached` field with literal boolean `true`. Add a successful real-SDK/fake-HTTP regression and malformed/false/nonboolean/unknown-field negatives. No relaxation of endpoint, TLS, signature, timeout or retry policy is needed. The integration owner allocated that repair separately; this review did not edit implementation.

## Independent checks and retained failures

In a new exclusive evidence directory, unchanged canonical **20/20 PASS, zero failures/errors/skips**, once on Python3.11.15 `-I -B`. Test duration6.808s; external envelope14.562s including readback, child deadline120s. Exact source snapshots, seven author upstream pins, all17,350 installed regular files and 10,658 original independently recorded hashed runtime entries matched. The original measured environment's two historical RECORD exceptions remain explicit; this is not a pristine-wheel claim. Boto3/botocore metadata both declare1.43.111.

The first new expected-success witness failed rc1 with the metadata defect; its complete raw streams and source/runtime identity remain. A separate diagnostic v2 then recorded **13/13 facts**, including reproduction of that rejection, real serialization/signature/path, connection-error and HTTP500 each sending once, original remaining-time shrink and pool-timeout drift refusing before send, repeated cumulative usage counted once, exact boolean EOF/cancel checks, late cache cost and semantic errors retaining UNKNOWN, native JSON fragments refused, and terminal nonstream message distinguished from stream completion. That diagnostic PASS confirms the defect; it is not successful counter qualification. No canonical replay followed it.

Author history is preserved: initial19 tests12PASS/6ERROR/1FAIL from the construction-only Config assumption, repaired19PASS, then20PASS after the effective pool-timeout check. Asyncio slow-task notices are retained. An initial reviewer PowerShell discovery command had a parse error before execution; the corrected read followed. No failure was erased.

## Scope and remaining limits

The counter rechecks a trusted injected client's effective endpoint, TLS/proxy state, v4 signature configuration, one-attempt policy and matching session/pool connect/read timeouts. Their sum must fit min30s/original remaining time. It rechecks expiry after counting and permanently consumes its slot on failure/cancellation. These checks assume trusted immutable SDK/client/hooks/credentials. Socket timeouts and async cancellation cannot physically terminate an already-running synchronous SDK thread, bound all credential/DNS work or establish a universal service deadline.

No additional blocker was found in the scoped native usage DATA parser. Terminal nonstream bodies require explicit complete HTTP200 JSON. Streams consume complete decoded AWS `chunk.bytes`, not SSE or outer event frames, and require ordered closed blocks, cumulative bounded usage, message_stop and trusted transport EOF. Errors, unsupported cost/cache fields and incomplete outcomes keep UNKNOWN. A UsageResult, hash, binding or origin string grants no authentication, settlement or refund authority. Future transport/ledger integration must retain ambiguous liability and correctly route outer AWS errors. Actual model spelling, native extensions and provider usage remain unmeasured. R2 deferred tool-reference schemas are intentionally outside this baseline; RG08 integration stays OPEN.

Replacement environments omitted provider/AWS/proxy credentials. A Python audit guard denied network connect/bind/DNS/sendto except the fixed stdlib Windows loopback socketpair used by asyncio; canonical recorded20 socketpair operations and one denied operation, diagnostic v2 two socketpair operations and one denied bind. This is a local test control, not an OS sandbox or proof about arbitrary native extensions. External supervisors bound direct children only; no descendant-tree guarantee or live output byte cap is claimed. Raw streams were retained and checked against2MiB after completion. No real count or inference was sent, and no durable settlement or runtime/security gate was exercised.

Closed evidence: `.task-inputs/CODEX-G1-bedrock-counter-owner-review-1/manifest.json`, 17851 bytes / SHA256 `035abbbefa584e53ebed5ff6c2c46866415a233b404652fd94bcc8af22dbbcd2`, binds101 files. Canonical stderr SHA256 `820ec4b59a93f123eefcf0ed85922b9b4bd3ccbadebedbed15735ea2e1dbff0f`; initial failed witness stderr `9d858b25d5ba56f184686da5742ec7d9835905bbbc20429e46094da8705e0c22`; diagnostic raw stdout1751 bytes / `b21225bbae2817ffcc0a517a220713125de6ae3a9f02916e29179943017a95db`. The manifest includes exact source copies, raw Git captures, original failures, complete drivers, before/after runtime records and pinned upstream sources. Source acceptance and G1 remain OPEN.
