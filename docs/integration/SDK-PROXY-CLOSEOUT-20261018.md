# PR188 first-chat SDK follow-up

Status: **17/17 final offline partitions pass; source candidate published; deployment/chat HOLD**. The one source candidate for future image qualification is `34851020aa0d73fead4db59ba6e26a098e2d0313`, complete tree `d5d1b5599c812d49428bb113badd89092f9d05f3`. No candidate image exists yet. This report advances PR188 from `b3611559582be27f4545509d9c2f03dc3b1332cd`; it does not restart PR186 or the architecture. Dot exclusively owns Core middleware integration with roster `b5071e8156899c1a5d01c19e64d647cb44e40789`.

## Source and bounded contract changes

The date correction is `0d3388a88aa575fba2bf9ee9c1c219053ea09418`, tree `be5ece2d8ff81d6112fb55c29e60beb69c8c4c09`. `12:30 Jan 1 2020+0530` becomes **07:00Z** in both as-of and date-filter paths. The existing three-timezone children really execute their selected tests; the 948 native-reference tuples and independent public assertions are preserved in [attached-offset evidence](integration-evidence-20261018/attached-date-offset/README.md). The earlier explicit `-0500` forms remain covered.

| Published repair | Purpose |
| --- | --- |
| `0256c9cecdcdab26af7a64d757ab4815f635ee23` | Supported SDK model metadata, disabled thinking, prompt-cache off and effort unset; include controls in the closed options projection |
| `5b2eb265067a1e5b59583fb68c0bfd008520c86b` | Bounded metadata/beta body and header admission; immutable trusted schema binding |
| `c049fea52efbe3670d8793ced7202871bf139b16` | Response context observations limited to absent/null/empty applied edits |
| `335cee797cb4c11f073731afb11f5aff80664cb0` | Exactly disabled thinking and numeric temperature 0 or 1; all other thinking/sampling shapes refuse |
| `046087d122b5f4274aee8c6769f5d05ea499ea3b` | Independent JS owner validates the same closed beta header/body contract before SQL |
| `8568bda65b19e2cf5199257460fc45b7fd13a4de` | Actual pinned SDK structured-output/accounting qualification and valid synthetic allocation |
| `a563309d6b95dcc972e730b73aa2ec84d68a99e4` | Fresh source measurement tests; explicitly refuse the immutable historical launch/options pin |
| `0bc1b9b1b43eff7b82697e1f381f29dc11b2ce4e` | Remove superseded diagnostic SDK configurations from the current harness |
| `fc0842efedb1acc1149353642d2d37b250ea2563` | Hold native terminal/tool/JSON response bytes until complete observation and canonical settlement proof |
| `e3069265062861bde0f425e29618a451b60bce88` | Preserve qualification assertions while requiring the stronger earlier terminal refusal |
| `d920a33c179b678b688110d0c7c8973dc5a3189a` | Prove shared owner-gate refusal after unavailable readback and legitimate same-byte/new-request admission after proven SETTLED |
| `34851020aa0d73fead4db59ba6e26a098e2d0313` | Replace the simplified accounting bridge with actual Python ProductOwnerBridge and JS owner-channel over an explicitly synthetic pipe carrier |

Current candidate `34851020` is byte-identical to reviewed local `e104f6934e13b5ecce477f89ed842dfd791a1ab1`. The actual SDK matrix ran at clean egress commit `90f82dc692fd017f4f8957cfaf8402000bb2f92f`; the net committed differences from that checkout are only reports and test files not executed by the SDK path. All executable runtime/harness bytes match. Earlier product-test checkpoint `e3069265` has tree `93804582ee5d6b28a7b52c4b57d67c2ca2467ccc`, identical to local `f45b9b599ada9438fd443e878641a91602c32b92`. Per-commit local/published mappings and complete-tree receipts are in the evidence. A later documentation head does not replace this code pin.

The [explicit contract proposal](SDK-PROXY-CONTRACT-FOLLOWUP-20261018.md) was posted before implementation in PR188 comment6256660957. The model remains Claude Sonnet 4.6 via the fixed proxy alias `meri-sonnet-qualification`; model metadata does not change the transmitted alias. Native beta admission is limited to the unique subset `context-management-2025-06-27` / `effort-2025-11-24`. A present header must agree exactly with the body; a body-only beta remains permitted. Semantic `context_management` requests are refused because the exact CountTokens path does not support context-edit operations. Cache controls/nonzero cache usage, enabled/adaptive thinking, effort/task-budget payloads and unsupported fields stay closed. Fixed model/profile, pricing and 65536/8192 limits are unchanged.

The actual SDK deliberately uses its terminal `StructuredOutput` tool and returns `result.structured_output`. That is compatible without pretending the SDK emitted `output_config.format`. The format-only native branch is supported only when it matches the same immutable trusted schema. Neither branch gains authority from the request's schema or tool name; both existing allowlist membership and exact trusted schema are required. Default production limits without that binding still refuse structured requests. Production selected-schema/MCP custody remains a [separate dependency](integration-evidence-20261018/sdk-compatibility/MERI-STRUCTURED-SCHEMA-CUSTODY-GATE.md), distinct from ordinary first chat with `skill:null` and no Objective runtime.

## Actual SDK and accounting evidence

Pinned execution uses SDK0.3.295 / CLI2.1.295, real LiteLLM1.104.2 and Python3.13.5 with the existing exact dependency lock. It traverses real SDK translation, native LiteLLM auth/router/deployment hook, the product guard, botocore CountTokens serialization/stub, actual Python ProductOwnerBridge, actual JS owner-channel/capture codecs and canonical reservation/settlement, CRC-framed provider stand-in, and actual SDK parsing. Ingress peer/current/persisted facts, pipe-carrier TLS evidence, count/provider and SQL are explicitly stand-ins. No paid provider, real database, AWS operation or private-network TLS acceptance is implied.

Both plain and schema production-option positives pass: one count, one reservation/INSERT, one provider stand-in execution and one settlement; unchanged8192 output with the stubbed12 input /3 output tokens reserves135248 microUSD and settles90. These are synthetic accounting values, not measured tokens for a real SDK prompt. The fixture's250000 allocation is constructed and admitted canonically before persistence; no persisted row or production pricing is modified to make the SDK fit. Structured output validates the exact fixture schema/value and ends without another provider request.

The native transport now buffers whole JSON bodies and terminal/tool eventstream chunks through validated EOF and settlement ACK or strict same-request SETTLED readback. It preserves earlier text streaming and exact wire bytes, enforces existing bounds, clears held data on cancellation/close, and never flushes incomplete/unknown results. The independently observed inner stream still reaches complete closed capture before settlement. The previous ASGI-final-body check alone was too late: actual SDK negatives already reported success from terminal events. Those red controls remain published.

The first17-run post-terminal matrix has15 passes and two failures at the explicitly simplified IPC owner bridge. In the two unresolved-settlement-ACK cases the SDK correctly withholds success, but that fixture omitted production `ProductOwnerBridge`'s process-wide uncertainty poisoning. The duplicate attempt was a **qualification fidelity defect**, not a demonstrated production SQL defect. The old AccountingBridge/direct capture bypass was removed. Actual Python and JS owner-channel code now exchange their real OPEN/POLL/REPLY/OPERATION frames over the transport-only pipe adapter, sharing the exact same carrier/gate with real admission-reader code. The adapter does not poison a gate itself or fabricate canonical accounting outcomes. Production SQL/state remains unchanged and permits legitimate subsequent requests after proven SETTLED.

The final clean-source matrix passes **17/17**, with zero75-second supervisor timeouts:

| Partition | Cases | Result |
| --- | --- | --- |
| Independent minimal Messages client | Seven complete/truncated/cache/missing-usage/reservation-ACK/settlement-readback cases | 7/7 |
| Actual pinned SDK, production-default plain options | The same seven cases | 7/7 |
| Actual pinned SDK, explicitly bound structured schema | Complete, truncated and unresolved settlement ACK | 3/3 |

Complete SDK requests parse successfully and settle once. Truncation/cache/missing usage retain UNKNOWN135248 and never report SDK success; one further count/reservation is refused by the canonical owner channel and poisons the shared gate before another provider send. Lost reservation ACK retains one UNKNOWN row and zero provider executions. Unresolved settlement ACK retains the actual durable SETTLED90 result, withholds SDK success, poisons the shared gate and retires the carrier: all later SDK attempts fail admission before a second count/reservation/provider. Confirmed SETTLED readback instead permits completion without another provider send. The25-case owner/admission regression also proves a distinct request ID with identical bytes remains legal after proven readback; no unsafe body-hash/global-once rule was added.

SDK negative cases use the explicit30-second query AbortController. Their passing result proves bounded refusal/no success and the captured no-duplicate accounting invariants, not natural termination of an unbounded SDK retry loop, cross-process restart idempotence or every concurrent request before readback finishes. The earlier15/17 and premature-success receipts remain immutable failed controls.

## Focused checks and classifications

| Check / exact source scope | Result |
| --- | --- |
| Root combined eight-module Python envelope/native/terminal/host/offline group at local `f45b9b59` | 98/98, no skips |
| Final owner-channel/admission/offline group at candidate-equivalent local `e104f693` | 30/30, no skips |
| Worker options, capability activity, Bash and runner-query group | 26/26, no skips |
| Existing focused worker group with two added trust regressions | 22/22, no skips |
| Runtime SDK measurement/dynamic-options group | 28/28, no skips |
| Independent JS observation/reservation/settlement/envelope group | 21/21, no skips |
| Runtime TypeScript after the SDK source changes | 0 diagnostics |
| Independent terminal/host and native-contract reviews | 42/42 and49/49; overlapping groups, not additive |

The last broad standard4391/4391, worker20/20 and runtime/control type0/0 checkpoint remains tied to date commit `0d3388a8`. Contract and Control code did not change in this SDK lane, so those broad checks were not repeatedly rerun or relabeled as new-source results. Affected source checks above cover the changed SDK/proxy/runtime code. The original48 failures and21 diagnostic occurrences retain their exact names, assertions, locations and parent comparisons in [the existing inventory](integration-evidence-20261018/BEFORE-AFTER.md).

Additional discoveries are separate from those original48:

- Eight `activity-capabilities` tests stopped before SDK execution because their inherited fixture omitted canonical initial-input allocation. The baseline test source reproduces the same failures against the unchanged fixture path. Repair only opts into `initialInput:true` and allocates the exact input before submission; existing assertions remain. The first copied-test control relocates imports into the receiving tree and is not represented as a full isolated baseline run.
- Three runtime measurement tests had stale current-versus-historical equality expectations after the intentional options change. They now assert the exact new controls, freshly measured options/descriptor bytes and explicit historical-pin refusal. The literal old receipt/hash remains unchanged. A source-only fresh fixture hash is not a final-image deployment pin.
- Four older native-settlement tests expected partial JSON or silent EOF for invalid input. They now require typed `INCOMPLETE_NATIVE_RESPONSE`; early-close coverage uses real early native text and retains no-settlement checks. Original sends/capture/UNKNOWN assertions stay intact.
- The inherited terminal-release defect is exposed by the newly admitted actual SDK path; source repair `fc0842ef` fixes it. Its21 failing subassertions and actual SDK false-success receipts are retained.
- One root check initially named a nonexistent test module; that setup error is retained and corrected. Subsequent98-case stale-expectation failures and the successful98-case result are all preserved. No result is silently overwritten.
- Two unresolved-ACK matrix failures came from the simplified IPC bridge omitting the real shared-gate contract. The final carrier reuses the existing product bridge/channel and keeps synthetic transport evidence explicit; both cases now pass with no production SQL/state repair. The pre-fix17-run snapshot is retained at its exact source.

Exact commands, versions, scrubbed logs and source hashes are under [sdk-compatibility](integration-evidence-20261018/sdk-compatibility). Copied logs remove ANSI decoration and local scratch prefixes only; original source-time manifests remain historical, and the outer evidence manifest binds the published copies. Counts overlap and must not be summed.

## Shipping boundaries

Core is dot-owned. The full uncommitted native middleware patch was transferred through [Core96 comment6256660862](https://github.com/neo-capiro/capiro-backend/pull/96#issuecomment-6256660862), with exact payloads published in Meri commit `3b6b3b802aec3ba65013c36d22afcca67d186e09`. No Core commit/branch/PR or further Core middleware edit was made. Dot must reconcile it with `b5071e81` and finish the complete response-subject contract; Meri release integration remains dependent on that contract.

The existing shipping owner has [one coordination thread](https://github.com/neo-capiro/meri-greenfield/pull/187#issuecomment-6256612108). Its acknowledgement, authorized execution access, fresh live/rollback receipt and exact final image digest are unavailable. No competing build or rollout is started. The packet must bind the final committed source/tree and exact linux/amd64 Dockerfile, then obtain actual UID1000 init→fresh Control/database trust, first/multiple-run readiness, private owner HTTPS/PostgreSQL and final-image alias/options/launch/closure measurements. Historical receipts and the adapted diagnostic image are not accepted replacements.

PR175 remains `993f52a97e5d9edcf65c9f89423c097aa52831c7`; frontend98 remains `5c784e3e46114816ba57db17ad7a2c2013a8d81a`. No merge, migration, deployment, credential change, AWS mutation or paid model call occurred. Deployment/chat HOLD stays active until review and explicit clearance. Real authenticated prompt, persisted reply after reload, second turn and Stop cleanup remain mandatory after that clearance.
