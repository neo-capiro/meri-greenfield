# Codex G1 AWS SDK wire repair candidate

Codex source author completion, 10 October 2026. This is not an independent review or acceptance. The user requested Codex alone; no Hermes, AWS call, provider call, Docker/native task, source-data read, infrastructure mutation or application execution occurred in this source task.

## Measured problem and bounded change

The owner dispatched six read-only TestState cases once: STS identity, three empty ECS inventories, a fixed absent ECS task and an EC2 new-VPC/owner-filtered ENI page. The three actual list results were `{TaskArns:[]}`; the actual absent task result was `{Failures:[{Arn:<exact absent task>,Reason:"MISSING"}],Tasks:[]}`. The previous native camel-case guards would reject the actual list result. TestState SUCCEEDED reports only the selected AWS Task; its empty output does not establish the following Choice or a complete execution.

Exactly seven allocated paths are authored: the new focused `lib/ecs-wire.mjs`; binding, expressions and workflow; new `scripts/test-native-wire.mjs`; README; this report. Task definitions, IAM, infrastructure, old test/fixture bytes, frozen bounds proofs, W18 planner pins, SDK parser/protocol and worker source remain unchanged.

The versioned v2 profile is `ecs-sdk-pascal_ec2-pascal_sts-pascal_v2`. V1 remains static-only even if its caller labels evidence actual. The new profile is an explicit compiler selection, with no automatic case conversion or fallback to v1. Its origin/execute flag remain structural inputs requiring a separately reviewed owner admission; this report supplies none.

`ecs-wire.mjs` reuses the unchanged strict raw duplicate-key scanner before evidence JSON.parse. Fixed result guards reject lower-case/colliding keys and malformed immediate/nested consumed fields. Fixed task facts preserve array cardinality, select a single worker only while retaining total container count, preserve unsupported overrides as a rejection marker, and feed existing before-write ledger/context caps. Unsupported timestamp encodings and forms refuse. Supported source-only timestamp forms are explicit ISO8601 with timezone or bounded numeric epoch seconds; actual nested Step Functions CreatedAt remains unmeasured.

The v2 terminal predicate accepts a container ARN only in this exact account/region/cluster namespace with the current task's 32-hex ID and a canonical UUID suffix, and preserves equality with an original bound full container identity. Optional container TaskArn, if present, must equal the task. The actual historical CLI container identity is in baseline3 `final-task.json` (3815B, SHA256 `eb77cd703fe51fdb01e8373d1c3eec0877df68c16476fe965779d2cb3340aaf2`); it is not an actual Step Functions nested Task capture. Synthetic projected containers are labelled accordingly. Nonzero exit143 remains qualification FAILED even when the synthetic terminal predicate confirms STOPPED evidence.

## Raw evidence and conditional bounds

V2 preserves the existing bounded `$raw` result and adds three named Pass states: `DescribeCandidateWire`, `PreStopDescribeWire`, `TerminalDescribeWire`, each kind `ECS_WIRE`, before projection. The extra record uses existing `boundedExpr` wrappers and original authority references; there is no second persistent raw copy. Raw-over returns null, not evidence. No ledger slot or persistent variable was added.

Unique graph states increase91->94; AWS Task states stay10. Added record visits are one per corresponding DescribeTasks success, under the existing bounded call/terminal-call ceilings. No API call, Retry, Map, Parallel or wait is added. D=720000ms/C=900000ms, record32768B, ledger16384B, ctx196608B, output131072B, references16384B, owned4+overflow6 and fallback writes remain unchanged. The old exact-source conditional proof is not automatically a proof of the new expressions: the owner must inspect the three record outputs, changed guards/projection/casing and complete source closure. The records add state/history/time overhead; unchanged deadlines do not prove timing or finally behavior. Source/raw caps cannot catch service payload/history failure before expressions; unknown physical cleanup blocks another task.

The separately exported synthetic native v2 graph is137176B SHA256 `9a4109b1230e4ff7a14a0f74bea858d94804d7ed459461b2001d5959e4c73ff2`; synthetic canary v2 graph136685B SHA256 `8deff885ac9c3abfcacf39d87ada641f4cb8407234f3bb9ff28562d7ae14ed7c`. Both remain runtimeEnabled:false. These are private source-review products, not service-validated deployment artifacts.

## Exact source closure

The previous eight-member compiler becomes eleven members. `binding`, `expressions` and `workflow` import the focused wire boundary, which imports the existing duplicate-key scanner, which imports its protocol leaf. Both leaves perform no filesystem/network work on import and were not edited. No generic parser/framework or copied scanner was added. W18's previous full-eight source authentication is intentionally stale for this candidate; parent must allocate complete-eleven advancement before use. Hashes are raw local bytes, to be independently matched with final raw Git by the owner.

| Compiler closure path | Bytes | SHA256 |
|---|---:|---|
| `infra/native-enforcement/app.mjs` | 618 | `e03076acb2ccda59bd38c2e2763f94af0d057f6c6c1bd3e699e25c72314ab1ed` |
| `infra/native-enforcement/lib/binding.mjs` | 17314 | `985519195dec59763d120ab8b1847eb71c023a782fa652e4d32e35528f5484e7` |
| `infra/native-enforcement/lib/expressions.mjs` | 14772 | `5195d83752a230ed3fae80bab14871026d6678caf1fbd9e4f82350d9d6fc0a45` |
| `infra/native-enforcement/lib/workflow.mjs` | 25523 | `237eae6c3938464732c13add0ef6e18484c203e51f00a79c1ef8064e6fd3bc98` |
| `infra/native-enforcement/lib/infrastructure.mjs` | 4892 | `80876d633d73b511d5060baecc6a609350d90706435f7acbcd086f40832c42b2` |
| `infra/native-enforcement/lib/task-definition.mjs` | 9432 | `edd9a835e7c05ed4fe47eaaa375bdb74204913e31b49fd169d9079a169164896` |
| `infra/native-enforcement/lib/probe-profiles.mjs` | 4920 | `67dff6ffb4025e1767226a5bb330998ad78bd9d76083319adb910a22e3397660` |
| `infra/native-enforcement/canary-task-definition.mjs` | 2612 | `524135d00aec413a6393e69a7d22974160109b01cc4ced71d35f26440d3e4df5` |
| `infra/native-enforcement/lib/ecs-wire.mjs` | 7060 | `1c7c318d011cf6f4783f6a29a2d64f69005ce366fc418359ba2d936f3a773c57` |
| `scripts/sdk-capture/json-records.mjs` | 6814 | `8b889617a9565b7f1b5d29863b772b71f2c880a5fd1606b8a8b68ac2163be02d` |
| `scripts/sdk-capture/protocol.mjs` | 5151 | `c20499a3a9e29069f6a59b58c7262fda6dfddd03068d7a49d6d73003f07e4a9e` |

The preserved author closure manifest is ROOT `.task-inputs/CODEX-G1-wire-repair-1/compiler-closure-11.json`,2983B SHA256 `d737ae150c7762f7c3547dd7ff403c5578e3a04266cda1ca816933a3f6d094c2`. It does not attest current AWS/Git authority.

## Author checks and retained failure history

Node24.19.0 and the exact retained JSONata2.0.6 runtime (291449B SHA256 `8327cafae2779d31512939cc45eba2f1b3fff3c09cdf7906ed457c31f198302b`) were used. Child stdout/stderr and stdlib subprocess envelopes are under ROOT `.task-inputs/CODEX-G1-wire-repair-1/`; each check had shell:false and60s timeout. All child stderr streams were empty. These are author checks, not independent owner evidence.

| Check | Retained result |
|---|---|
| Initial focused wire suite |16/16 PASS, childexit0,14:22:59–14:23:00Z. Subsequent Python console printing failed CP1252 on a checkmark after binary evidence/envelope had been saved; no test failure or unchanged replay. |
| Focused suite after adding closed-canary control |`focused-2`:16PASS/1FAIL; test passed saved `{staticPins}` envelope as pins and source correctly refused schema. |
| Corrected canary fixture |`focused-3`:16PASS/1FAIL; test incorrectly expected throw where existing native API returns AdmissionRefused Fail graph. |
| Corrected native-refusal assertion |`focused-4`:17/17 PASS, childexit0,14:28:26.351565–14:28:26.688653Z. No production change was made for either test repair. |
| Legacy canonical |47/47 PASS once,14:26:06Z. |
| Roleless compiler/definition regressions |25/25 PASS once,14:26:06Z; no role/infrastructure source change. |
| Legacy immediate RunShape |16 fixtures/81 evaluations PASS once. |
| Legacy canary |120 labels/73 evaluations PASS once,3retain/13uncertain. |

The first focused suite proved all six native A/B raw products exact (binding7133, graph112210, template115766); A/B graph SHA256 remains `2c962d23a3ab42317e9b9d9ecd80c9d8eab7af6a7e9c59f46359de106f51eac3`. The canary graph remains111719B SHA256 `b2b1004559c74d63e4d5f604f184c39b8f517f2c4b06073604f09cf215a1e3be`. Existing tests were not edited or replayed after test-only fixes in the new suite. The new script is local qualification evidence-dependent: exact private captures, original literal inputs and pinned runtime must exist; it is not a generally portable CI target.

The extra source-review export first had a generated-script newline syntax error before import/evaluation; original `export-final.mjs` is preserved. New `export-final-2.mjs` corrected only that representation and completed once14:29:15Z, exit0, retaining both synthetic bindings/graphs/templates/inputs and size/hash inventory. No accepted test was rerun for this export. Original failures are retained, not erased.

Actual stdout pins remain in `CODEX-G1-ACTUAL-WIRE-FINDINGS.md` and fixed new test constants. The EC2 result contained only one endpoint ENI and an opaque NextToken; no further page or complete enumeration was claimed. The synthetic ECS MISSING result provides no positive task, ownership, timestamp or terminal evidence. Duplicate keys can be checked on retained raw JSON evidence; AWS object results have already undergone service serialization, so source inspection does not establish preservation of impossible on-wire duplicate member names.

## Remaining owner gates

Independent source/eleven-member raw-Git review and actual selected v2 expression validation must precede any deployment. Actual RunTask/DescribeTasks nested shape, CreatedAt form, container ARN, overrides, tags, ENI lifecycle and terminal evidence remain open until an explicitly admitted isolated canary. Existing image49 findings/22critical-high remain OPEN; no image waiver, native SDK/Office admission, source access, product integration, G1 pass, role grant or cutover follows. All current Meri resources remain untouched.

Primary references already retained/verified: [AWS SDK integrations](https://docs.aws.amazon.com/step-functions/latest/dg/supported-services-awssdk.html), [ECS DescribeTasks](https://docs.aws.amazon.com/AmazonECS/latest/APIReference/API_DescribeTasks.html), [EC2 DescribeNetworkInterfaces](https://docs.aws.amazon.com/AWSEC2/latest/APIReference/API_DescribeNetworkInterfaces.html). SDK parameter PascalCase documentation is not proof of nested result timestamp serialization; recorded actual results and the remaining canary requirement control that distinction.
