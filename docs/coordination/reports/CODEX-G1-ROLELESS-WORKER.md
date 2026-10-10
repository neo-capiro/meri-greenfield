# Codex role-free native worker source correction

Codex authored this narrow correction on 10 October 2026. It is a source candidate for independent owner review, not a separate Hermes review, AWS registration, runtime admission or G1 acceptance. No Hermes, AWS API, image build, native SDK/Office probe or provider request ran in this session.

The future SDK/Office task definitions now omit `TaskRoleArn` entirely. Their retained execution role still supports ECR pulls and logging. An empty-policy task role was incompatible with the SDK capture's credential-free parent preflight because ECS vends task-role credentials independently of whether that role's policy is empty. AWS documents the distinction in [task IAM roles](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task-iam-roles.html) and the [ECS credential URI environment variable](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/ecs-environment-variables.html); these primary sources were checked during the preceding security assessment, not re-fetched during this correction.

## Source behavior

- `infra/native-qualification/app.mjs` emits exactly the same two hardened task-definition resources, with only the task-role property removed. It retains the historical `WORKER_ROLE_ARN` export for source compatibility but never uses it in the future definitions. The execution role, image parameter, commands, seven inert environment entries, volumes, resource sizing, capabilities, logs and all other boundaries are unchanged.
- Native enforcement accepts the explicit, required `workerRoleArn:null` selector only together with complete SDK/Office definition records whose actual `taskRoleArn` property is absent. Missing selectors, arbitrary selectors and present null/undefined/empty role properties refuse. Legacy role-bearing inputs continue requiring their exact historical role. Actual-before-expected getter evaluation order is preserved for that legacy path.
- Proposed native `iam:PassRole` resources contain only the execution role for the role-free shape. Every other IAM statement, trust condition and RunTask argument is unchanged. The fixed canary factory remains role-bearing and retains its original bytes.
- `workflow.mjs` and `expressions.mjs` contain no task-role assumptions; neither required modification. No original W18 input, source pin, historical record, canary profile, shared contract or lockfile was changed.

The new role-free fixture deliberately derives from the unchanged exported synthetic native fixture, explicitly sets the selector to null and removes both synthetic role fields. Its reused fixture ARNs/revisions are synthetic examples, not claims that the existing registered revision-1 definitions are role-free. Explicit null is a static selection, not proof of owner review: all existing authority, wire, source/image, network, deadline, cleanup and owner-admission gates remain.

## Local checks and byte preservation

Evidence is retained under `.task-inputs/CODEX-G1-roleless-worker-1/`, with raw stdout/stderr, UTC/elapsed records, return codes, source hashes and both old/new synthetic templates. Every command below ran once and returned 0; this task had no failed check or retry. The wrappers used stdin EOF, direct subprocess arguments and 60-second limits, except the canary suite's 120-second limit. These are direct-child timeouts, not a descendant-tree cleanup claim. Only local CDK synthesis and pure source/expression fixtures ran.

| Check | Result |
|---|---|
| `node --test scripts/test-native-roleless.mjs` | 25/25; absent-role positives, 12 present-role negatives, inherited-role negatives, missing/invalid selectors, execution/environment/network drift, PassRole scope and legacy getter order |
| `node --test scripts/test-native-enforcement.mjs` | 47/47 unchanged legacy checks |
| `node --test infra/native-qualification/security.test.mjs` | 15/15 against actual emitted template, including omission and raw template pin assertions |
| `node scripts/test-native-canary-profile.mjs <pinned-jsonata> <new-result>` | 120 checks / 73 actual local JSONata 2.0.6 evaluations; frozen native A/B byte comparisons and canary checks passed |

The actual role-free synthetic CDK template is **5846 bytes**, SHA256 `fa390ba774065cc382099984f69621bbd1b3a31e9c43c3b9be60431dfc5efa4d`. The earlier 6082-byte template, SHA256 `7895fa997a8521fe7adc03cb7c468b1987de8875518ae0d8ab6f284496b13080`, was copied before refreshing the ignored synthesis output. Its only semantic difference is the removed `TaskRoleArn` property in each of the two definitions. The component pins now bind the new raw template bytes; all dependency pins remain unchanged.

The old native binding/graph/template raw lengths remain 7133/112210/115766, with exact frozen byte equality checked by the canary suite. Its fixed canary outputs still match the retained owner results:

| Frozen canary output | Bytes | SHA256 |
|---|---:|---|
| State graph | 111719 | `b2b1004559c74d63e4d5f604f184c39b8f517f2c4b06073604f09cf215a1e3be` |
| Enforcement template | 115198 | `60fa0762fc97ea8a94767a9279786f154effe7b0c9418ac82e918802b1336c44` |
| Task template | 2000 | `39cd589630baf398460967adf0d2ed46edc8e5c5560678f742c35d715ee3724d` |

## Reviewed source inventory

Only these eight source/document paths and this new report belong to this correction. Hashes below describe raw working-tree bytes after the checks; the report itself is hashed in the handoff rather than recursively self-pinned.

| Path | Bytes | SHA256 |
|---|---:|---|
| `infra/native-qualification/app.mjs` | 8872 | `16e065c2e3c6829216ca5a4a4f53f5589ce9d22afcf13801b0e246f60e168112` |
| `infra/native-qualification/component-pins.json` | 6765 | `9df61d151078ac085aed51279ed246ccfb2fb8b0412464a3b6621c05a6fb7cbc` |
| `infra/native-qualification/security.test.mjs` | 11972 | `7224e1e7d9914a2c41a19723ed9a09afc00cf7ec8615afef8b5ffd3143a94754` |
| `infra/native-qualification/README.md` | 6108 | `4461fa35bbf8f831c0e5e1a6987af5a0575de6d3b223c04dd2f630164a066e79` |
| `infra/native-enforcement/lib/binding.mjs` | 16767 | `49ac6d5a94df9ce117db484613e258836437550957c5fde75d6437514192a13c` |
| `infra/native-enforcement/lib/task-definition.mjs` | 9432 | `edd9a835e7c05ed4fe47eaaa375bdb74204913e31b49fd169d9079a169164896` |
| `infra/native-enforcement/lib/infrastructure.mjs` | 4892 | `80876d633d73b511d5060baecc6a609350d90706435f7acbcd086f40832c42b2` |
| `scripts/test-native-roleless.mjs` | 6923 | `75933990df6583f7676f78197afcfeb1392291d413043dbc7aa64145c04d9986` |

## Remaining admission work

The owner must independently review this exact source and a task-definition-only change set, register new revision-qualified SDK/Office definitions, and retain fresh full readbacks proving actual field absence. The execution role and all image, IAM, network/DNS, authority, deadline, evidence and cleanup controls still need their separate fresh admission. Do not reuse the old role-bearing revision-1 records as evidence of this source correction.

Changed native compiler modules invalidate the previously accepted request planner's fixed source hashes. Root integration requires a separately allocated, reviewed source-pin advancement; neither bypass those checks nor rewrite the old W18 history. Role omission also does not prove every credential source absent: native preflight must inspect the actual environment without printing values. Harmless ECS metadata URIs remain distinct from credential URIs.

The existing image's severe/vendor-open findings and production-security blocker remain. No security exception, new runtime, paid inference, cutover or deployment gate promotion follows from these local checks. The old failures and historical qualification limits remain intact.
