# Codex G1 actual wire findings

Codex independently inspected the four retained read-only TestState captures. They demonstrate a real ECS response-casing mismatch and do not pass native enforcement or G1. No compiler, decoder, request or AWS resource was modified by this diagnostic review. No Hermes was invoked.

## Measured evidence

All four retained envelopes have exit 0, no timeout, zero stderr and automaticRetries 0. I remeasured raw stdout, compared its hash/length to the envelope, bound each dispatched request hash to its prepared plan, checked the accepted graph SHA256 `2c962d23a3ab42317e9b9d9ecd80c9d8eab7af6a7e9c59f46359de106f51eac3`, and compared actual `afterArguments` with planned arguments. Each response has `status:SUCCEEDED`, `callOk:true`, `rawOver:false`, and inspection result equal to retained variables.raw. This corroborates the retained calls; it does not prove absence of unrelated out-of-band calls.

| Case | Started UTC | Raw bytes | Raw SHA256 | Actual result shape |
|---|---|---:|---|---|
| identity | 2026-10-10T14:05:14.395655+00:00 | 852 | `1d2a435ad58d91973bc8e2ed3aee523e38527b43770316549126ebdd2735bd84` | Account / Arn / UserId |
| list-started-by | 2026-10-10T14:05:22.644454+00:00 | 658 | `966e007d90bfbfc8a95d1c7ded817e47f3bc628c60b28b84126c9530c6f6e935` | `{"TaskArns":[]}` |
| list-running | 2026-10-10T14:05:24.452944+00:00 | 573 | `9e1b482b31e95cd1ee1c7441f5d3bdf171855aed37cb668707ad9e34b761b653` | `{"TaskArns":[]}` |
| list-stopped | 2026-10-10T14:05:26.411475+00:00 | 573 | `c5be493ea9fc157560b0c7ae5e4007ffb79bf539a0b9d5ce257ab5533b2ac575` | `{"TaskArns":[]}` |

The identity result has the expected account and an assumed session of `MeriGreenfield-TestStateReadOnly-20261010`. It establishes STS field casing and that read-only role's identity, not the future enforcement role/context predicate. Every response output is `{}`. `nextState` is `CheckDispatchIdentity` or `ListShape`: TestState executed the selected Task, not the subsequent Choice or whole workflow.

## Concrete defects

1. `lib/workflow.mjs:84–86` requires `$raw.taskArns` and optionally reads `$raw.nextToken`. The actual three list results contain `TaskArns`. Missing lower-camel taskArns cannot satisfy the required array type, so real successful empty lists would take `DiscoveryError`, setting sticky hold/failure. Pagination `NextToken` was not present in any result and its spelling/behavior remains unmeasured. `lib/binding.mjs:10,57,130` pins `ecs-native_ec2-pascal_sts-pascal_v1` and demands lower-camel listResult.taskArns/describeResult.tasks. Actual wire bodies must not be rewritten into camelCase to make that old profile pass.
2. The current ECS Run/Describe paths also assume lower-camel raw task bodies (`tasks`, `failures`, `taskArn`, `createdAt`); `expressions.mjs` projects lower-camel containers/tags/attachments/overrides. The list observation invalidates the claim that the selected ECS profile is qualified; it does not itself establish every replacement spelling or timestamp encoding. Do not globally title-case fields by heuristic.
3. `expressions.mjs:55` terminal container ARN validation accepts only `container/<cluster>/<32hex>`. Two retained actual isolated Fargate readbacks instead have `container/<cluster>/<task32hex>/<hyphenated-container-UUID>`. Baseline3 is `container/meri-greenfield-qualification/4a9c2d40f4094c8f88705108fdd11f2e/85bd54ab-bd0a-41ae-a166-d626792d8d1d`; baseline2 independently agrees with that structure. The present terminal predicate would reject them after casing repair. Bind the container ARN to the current task's exact task-ID segment and canonical container UUID, while retaining exact equality to the originally observed complete container ARN. This is retained CLI readback evidence; new Step Functions nesting is still unmeasured.

The focused `scripts/sdk-capture/*` decoder handles Claude SDK capture records and is separate from AWS native-enforcement wire data; no SDK protocol decoder change is indicated by these ECS observations. `scripts/native-teststate/requests.mjs` explicitly prepares requests only, with no reply decoder. A small owner-only response inspector must preserve the raw response and decoded inspectionData.result separately, rather than treating output `{}` or status SUCCEEDED as native qualification.

## Smallest next read-only measurements

These are proposals for separately frozen, owner-reviewed request/guard input, not dispatch authority. Keep the existing four captures and expired request plans immutable. Retain the same read-only role, literal `{}` input, DEBUG, revealSecrets false, exact new graph/request hashes and actual dispatch deadline checks. No RunTask, StopTask, PassRole, provider/source access or role expansion is required.

- **Missing-task DescribeTasks:** select original `DescribeCandidate` with fresh `$ctx.C` and one literal synthetic task ARN in the exact qualification cluster. Its existing Arguments are fixed Cluster, Tasks:[currentArn], Include:['TAGS']. A 32-hex ARN does not prove absence merely by spelling; retain the service's actual outcome. A missing result can establish top-level Tasks/Failures and Failure member casing, not real task/container/attachment fields, creation timestamps, ownership or terminal success. An independently proven old isolated task ARN may be described if still retained, but a MISSING response gives no nested task evidence.
- **New-VPC EC2 ENI read:** a tiny separate inert graph can select only `ec2:describeNetworkInterfaces` with Filters exactly `vpc-id=vpc-06e1941747e798f0a` and `owner-id=967807252336`, MaxResults 5, and a clipped positive timeout. If existing retained new-VPC endpoint metadata gives an exact admitted ENI, describing that one ID is narrower; do not combine NetworkInterfaceIds and MaxResults. Capture actual NetworkInterfaces and nested fields and retain any NextToken without claiming complete enumeration. Endpoint ENIs can show serialization, not worker SG/ownership/readiness.

AWS documents [Step Functions SDK parameters in PascalCase](https://docs.aws.amazon.com/step-functions/latest/dg/supported-services-awssdk.html); that statement does not qualify all response members. The [ECS DescribeTasks reference](https://docs.aws.amazon.com/AmazonECS/latest/APIReference/API_DescribeTasks.html) describes native service response tasks/failures and gives createdAt a numeric syntax while its example uses timestamp text: neither is a measured Step Functions timestamp. [EC2 DescribeNetworkInterfaces](https://docs.aws.amazon.com/AWSEC2/latest/APIReference/API_DescribeNetworkInterfaces.html) supports the VPC/owner filters, MaxResults 5–1000, and forbids combining MaxResults with explicit interface IDs.

## Bounded source repair allocation proposal

After those reads, allocate focused Codex ownership; no file is changed by this report:

- `infra/native-enforcement/lib/binding.mjs`: introduce an explicit new measured ECS wire profile and raw evidence shape for both native/canary. Keep structural evidence distinct from owner runtime admission; never relabel synthetic or old camel-case bodies actual.
- `infra/native-enforcement/lib/workflow.mjs`: fix only measured list raw selectors and the subsequently proven Run/Describe/timestamp boundary paths. Preserve one launch attempt, original D/C, Catch/fallbacks, record caps and immutable ledgers.
- `infra/native-enforcement/lib/expressions.mjs`: explicit wire-to-existing-compact-task projection for confirmed fields; fix terminal container ARN binding. If mapping warrants a separate module, allocate `lib/ecs-wire.mjs` as a small pure fixed-schema boundary, without generic recursive case conversion or duplicate full persistent raw bodies. Preserve internal compact keys, ownership, sticky network identity and original stop authority.
- New `scripts/test-native-wire.mjs`: literal captured TaskArns empty successes; lower-camel-only/mixed conflicting keys rejection for the new profile; malformed list types/ARNs/token duplicate/size controls; actual container ARN positive and wrong task/container namespace negative controls; explicit timestamp variants, missing tasks/failures and nested projections only as evidence becomes available. Adapt the affected existing enforcement/run-shape/canary fixtures to explicitly named synthetic profiles rather than silently regenerating expected data.
- `infra/native-enforcement/README.md` and one owner repair report: document measured vs inferred fields, old profile retirement and remaining live gaps. Infrastructure/IAM/task-definition sources need no change for a casing fix.

The fixed eight-source W18/W22 request planner and its old static/graph pins intentionally cease to compose after compiler changes. Advance a separately reviewed version/input pack only after the new complete source closure/graph freeze; do not bypass source checks or overwrite original static-pins/definition/baseline inputs. These four retained requests were generated before source changes and remain correctly bound to their old accepted graph.

Minimum independent source checks should replay the affected actual ListShape/RetainPage expressions against the retained raw TaskArns response, assert the success route and unchanged bounded context semantics, then verify the new profile refuses conflicting/malformed shapes. Add the terminal ARN controls using actual retained metadata. Rerun relevant composed native/canary/negative cleanup fixtures after the patch, and inspect the exact graph diff and conditional byte-bound delta. This source repair must not loosen ownership or claim StopTask acknowledgement proves STOPPED.

Still OPEN: real RunTask response, real DescribeTasks task/container/attachment/overrides/timestamp wire representation, list pagination response, StopTask/terminal observation, managed-role identity context, tag/IAM propagation, launch/stop timing and controller-force-kill-surviving physical cleanup. A safely admitted controlled canary may later measure what read-only missing-task/endpoint probes cannot. No application probe, SDK/Office admission, image security waiver or G1 pass follows from this report.

## Observed source and envelope pins

Hashes describe files read for this diagnostic snapshot; compiler files later repaired by another owner require new pins. Earlier historical reports and raw evidence remain untouched.

| Path | Bytes | SHA256 |
|---|---:|---|
| `.task-inputs/CODEX-G1-readonly-wire-1/teststate-identity/process.json` | 1210 | `2318d2324aa7c7641030a601abd96d2410cb248a1f2e7abf872a98c9e52ab2df` |
| `.task-inputs/CODEX-G1-readonly-wire-1/teststate-list-started-by/process.json` | 1210 | `9a957f0ac2817df50952563190aa85b893fd4d2e66a24fba87f852f3af97b4f6` |
| `.task-inputs/CODEX-G1-readonly-wire-1/teststate-list-running/process.json` | 1207 | `2feebc3821d2038cfc6e2479156d21ff700df0c949b6a8704a9f97cd5d9d7c5d` |
| `.task-inputs/CODEX-G1-readonly-wire-1/teststate-list-stopped/process.json` | 1207 | `cd7e5de0865a8540c3d4eae89fffa5c0326715de52a67f2cca18cafa132c90f4` |
| `infra/native-enforcement/lib/binding.mjs` | 16767 | `49ac6d5a94df9ce117db484613e258836437550957c5fde75d6437514192a13c` |
| `infra/native-enforcement/lib/workflow.mjs` | 25002 | `09171cbc66ce0efbd643969d92c92c742f89d0b41804eefd65064f2175aa39ca` |
| `infra/native-enforcement/lib/expressions.mjs` | 13776 | `933dcca53027688be2e6373bed818890882f239bc5da5af1af827277213b87aa` |
| `infra/native-enforcement/lib/probe-profiles.mjs` | 4920 | `67dff6ffb4025e1767226a5bb330998ad78bd9d76083319adb910a22e3397660` |
| `scripts/native-teststate/binding.mjs` | 13492 | `ba2432bc18ec8a1ece64bc37687c9258b6d5312be08b60323b9d4afa0ecabbfb` |
| `scripts/native-teststate/requests.mjs` | 10538 | `20034956fa9445cb0dbd15992f1cfe500a235a97e4fe443912a536f5b5ca478d` |
| `scripts/test-native-enforcement.mjs` | 21460 | `d294a9635f8ad17c6c73071e106dd95ae17bd732115d9fb18022348f7ff5978e` |
| `scripts/test-native-run-shape.mjs` | 8884 | `9a1fbbe47131765fe38055f5e21ba0fc49b77de09d3df15e849f6635bd3286be` |
| `scripts/test-native-canary-profile.mjs` | 43621 | `eae1b945f943d1a9979bac7c0126c26192ec2e4b4f80a3270049276aa2aae35d` |
| `docs/coordination/private-evidence/W02-fargate-baseline-3-run/final-task.json` | 3815 | `eb77cd703fe51fdb01e8373d1c3eec0877df68c16476fe965779d2cb3340aaf2` |
| `docs/coordination/private-evidence/W02-fargate-baseline-2/final-task.json` | 4705 | `0152929eedf5119eb660a16f365e52a711d9f5041317a1d21dcbbbf2cc308637` |

Diagnostic closed UTC: 2026-10-10T14:11:09.662767+00:00. Only this new report was written. CLOSED.
