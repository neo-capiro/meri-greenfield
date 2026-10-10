# Independent Codex review of CountTokens metadata repair

10 October 2026 UTC. Independent review of `089533104eb567899e79cddf7b400460395e6de0`, authored by Codex `contract_review`, in dedicated branch `review/g1-counter-metadata-repair`. **No blocking finding in this metadata repair; the original pinned-SDK compatibility defect is resolved offline.** The integration owner retains the source decision. This report does not accept live AWS counting, provider integration, settlement, runtime security or G1.

The reviewer read repository instructions, the human implementation standards, all three committed paths, their exact diff, the unchanged usage and transport boundaries, and retained author evidence. Only the existing counter's response-metadata condition changes in production. Its responsibility remains one trusted CountTokens operation; usage interpretation, persistence and admission stay with their existing owners. No dependency, transport, ledger, state, command, runtime permission or shared contract changes. The independent reviewer changed only this report and ignored evidence; no Hermes, cloud, network request, model, package installation or native application was invoked.

## Exact source and retained failure

Raw Git blobs match the reviewed worktree and new snapshot for all 28 recorded paths: the three candidate paths and 25 protected proxy files. Each protected file is also byte-identical to the candidate's parent. Candidate pins are:

| Path | Bytes | SHA256 |
| --- | ---: | --- |
| apps/proxy/qualification/runtime/aws_counter.py | 7015 | bba79ab1b7eeb67495b7d62554dd60199806b66bc36614183329bd170dfcee33 |
| apps/proxy/qualification/test/test_aws_counter.py | 12102 | d449678aaab69fcc704b4d496906383992d456a3a275362c26e4ea66cd57e5f6 |
| docs/coordination/reports/CODEX-G1-BEDROCK-COUNTER-METADATA-REPAIR.md | 6856 | 736999792d3cf54b7826ed40fb6f0396193404574c75a6b79b9f136b910a5160 |

Author final manifest SHA256 is `64568a1bdb1f5c3f9428b6f6b0953ca634e1a319c535a9e29929a7fe7b8f820e`; every named evidence record and referenced earlier independent record was byte-verified and copied. Original rejected `cfb9f2084a05698c18a9cc17a0d69deb7e7c0976`, its genuine-SDK failure and rejection remain historical failures.

The repaired author's eleven tests passed, but its capture child exited1 after treating a denied urllib3 import-time IPv6 probe as a wrapper failure. That outcome remains unchanged. Its separate import-only diagnosis is 1,494 bytes/SHA256 `96a5edf0125885a2c2e5f79b0e56def8ff3e11c1b3d9cb26df2b53a5562659fc`. The pinned upstream `_has_ipv6` attempts bind at line127, called by module line137, catches the denial and returns false. It does not make an application request.

## Semantic review

The counter still requires RequestId, HTTPStatusCode, HTTPHeaders and RetryAttempts, including HTTP200 and a genuine integer RetryAttempts0. It permits one known optional key, MaxAttemptsReached, only when its value **is literal True**. Missing required keys, unknown keys, false, string, integer1, null and arrays refuse. An absent optional annotation remains supported. Dictionary/type checks short-circuit before key/value operations.

Installed botocore1.43.111 standard retry source, SHA256 `ba5ede051c74c789ce59b03e9dff32c4da252190032ff7f512479b8ce1cc598b`, annotates MaxAttemptsReached=True when attempt1 reaches configured total_max_attempts1, including HTTP200. This annotation does not mean a second attempt occurred. Requiring RetryAttempts0 and exact one-attempt configuration remains necessary.

The source diff preserves the original immutable native bytes/hash, foundation CountTokens model, request envelope, effective endpoint resolution, SigV4 scope, TLS verification, empty proxies, original monotonic deadline, effective socket/pool timeout checks and single-entry latch. Timeout/cancellation still deny admission and do not enable a second call. Python cannot terminate an already running synchronous SDK thread; that thread may finish counting. Socket timeout sums are not a universal DNS/credential-provider/wall-clock termination proof. Trusted client, hooks and clean environment remain prerequisites.

The unchanged native_usage module remains strict usage DATA parsing. It does not authenticate provider origin or authorize settlement/refund. Streaming completion requires complete native chunk payloads and transport EOF; this repair changes none of that boundary. No usage-suite replay or ledger reconciliation was represented as metadata verification.

## Independent execution

Both children ran once in a fresh raw-Git source snapshot using the existing pinned Python3.11.15 venv with `-I -B`, shell=false, stdin DEVNULL, explicit replacement credential/proxy-free environment and retained binary stdout/stderr. No dependencies were installed. All 17,350 venv files plus three additional interpreter/configuration records match the earlier independent measured-runtime pins before and after each child, and at final closeout. Original runtime reconciliation retains the two historical RECORD exceptions: the normalized LiteLLM tokenizer cache and one pre-existing NumPy pyc. This is a measured installed-runtime claim, not a pristine-wheel claim.

The physical application-network guard raises on connect/bind/DNS/sendto. For the exact pinned urllib3 source/stack/address, it records the import self-probe as **DENIED**, then still raises before bind. It does not authorize or suppress that operation. Only the separately identified pinned stdlib `_fallback_socketpair` loopback bind/connect needed by Windows asyncio is allowed and counted. Each child observed exactly one denied import probe and zero unexpected denied actions; canonical counted22 stdlib socketpair events, independent controls counted2. This narrow instrumentation classification was fixed before these fresh independent runs and does not rewrite the author's exit1.

- **Canonical counter suite: 11/11 PASS, no errors or failures, once.** Test runner elapsed7.898s; envelope elapsed15.344s including post-run hashing, under a120-second direct-child bound. Existing cancellation, delayed thread completion, timeout, TLS/config/endpoint, parameter and response controls remain. The genuine SDK regression runs real serialization, signing, endpoint operation, parser and retry checker, replacing only the lowest HTTP session send with synthetic AWSResponse.
- **Independent production-call controls: 19/19 PASS, once.** Envelope elapsed9.437s under a60-second bound. A different literal native body and expected count11 verify successful annotated HTTP200, exact decoded Blob bytes/hash, expected foundation-model POST URL, SigV4 signing shape/scope, one before-send hook and one fake HTTP send, then second-count refusal. Authorization values are not retained.
- The independent controls retain the real SDK pipeline while deliberately mutating parsed DATA through an after-call hook to test absent optional metadata, five invalid optional values, unknown fields, each of the four missing required fields, and nonzero/boolean retry counters. These are validator negatives, not observed AWS response claims. Real SDK connection-error and HTTP500 fake transports each send once and refuse; shrinking the original remaining deadline refuses before the fake HTTP boundary.

Both envelopes exit0 without timeout and show source/runtime identity unchanged. Canonical stderr preserves asyncio debug slow-task notices; independent stderr is empty. No earlier failed runner was overwritten or silently retried.

## Evidence and remaining gates

Evidence is confined to this review worktree's `.task-inputs/CODEX-G1-counter-metadata-independent-1/`. Manifest 38,349 bytes/SHA256 `d537453abedd185ac8ff641e0c102019e68c084ef4e719a3ccccb63526b0c96d` binds231 files/27,572,137 bytes, including source copies, raw Git streams, prior evidence, guards, helpers, original runtime reference, both pre/post inventories and machine envelopes. Canonical stdout SHA256 is `2e47e4b0a6d3dfaf4d6e81bc2431b05826bac0bf652729a18e818dbd8a334be0`; independent stdout2,699 bytes/SHA256 `167324ad90675520c145620c0743614a8e208ab6c821023231524d5f9bb35f7e`. Final source/input/runtime readback passes.

The fake lowest HTTP transport and synthetic credentials prove compatibility with the pinned local SDK pipeline. They do not measure live CountTokens availability or token accuracy, real TLS/IAM/credentials, provider responses, aggregate budget enforcement, durable settlement or cancellation under service failure. Audit hooks are not an OS network sandbox. Supervision bounds the direct child; it does not prove descendant-tree termination, and stream limits are checked after completion. No paid call, send authorization, UNKNOWN-hold release, production admission or G1 gate follows from this report.
