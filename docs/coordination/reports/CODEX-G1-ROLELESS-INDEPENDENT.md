# Codex independent review: roleless native workers

Reviewed source: `d9f31ca5009c28aa72c3026bad65d23223666700` (exact nine-path change). Reviewer: a separate Codex session from the author of `CODEX-G1-ROLELESS-WORKER.md`. Outcome: **no blocking source defect established for trusted parsed JSON task-definition readbacks; offline source acceptance recommended with the object-normalization qualification below.** The integration owner decides acceptance. This review grants no registration, launch, credential/security exception or G1 advancement.

## Source and contract assessment

I read the full author report, all nine changed paths and the relevant validator/profile/composition sources. The code change is narrow:

- The future SDK and Office CDK definitions omit `TaskRoleArn` completely. The execution role remains the same string reference. The public historical `WORKER_ROLE_ARN` export remains available but is absent from the emitted template.
- Native admission requires the existing exact schema. Only the exact historical role or explicit `workerRoleArn:null` passes its selector. Missing, undefined, false, empty or foreign selectors do not implicitly select absence. The null mode still requires both complete SDK/Office definition records, immutable image/source/config pins, exact execution role/network/platform and all existing evidence gates.
- For native null expectations, the focused definition validator uses `!('taskRoleArn' in t)`, so own undefined/null/empty values and inherited role properties refuse. It preserves the legacy actual-role then expected-role getter order and execution-role short circuit. There is no new command, invocation or deployment option.
- A branded roleless native binding produces `iam:PassRole` with the execution ARN only. Other IAM statements, trust conditions and RunTask arguments remain equal to the legacy synthetic binding. Legacy native bindings continue passing both retained roles. The canary factory still requires its frozen role-bearing contract; its task definition, graph and policy remain unchanged.

Module boundaries remain focused: a private role-matching helper in the definition validator, one selector extension in admission, one PassRole branch in infrastructure, and task-role omission in the existing CDK definition builder. No framework, cycle, new runtime adapter or shared contract change was introduced.

## Important qualification: direct validation versus composed input

The new inherited-field test calls `validateTaskDefinition` directly. It does not prove the same rejection at the admission entry point. `buildNativeEnforcementAdmission` already performs `structuredClone(input.staticPins)` before validation. My independent retained observation shows both an inherited `taskRoleArn` and a non-enumerable own `taskRoleArn` are rejected directly but are stripped by that clone and accepted as absent by the composed compiler.

This is not a counterexample involving an ECS JSON readback: JSON fields are ordinary enumerable own properties, and the new composed negatives prove those present fields refuse. It does limit the documentation's unqualified phrase “actual field absent”: it describes the validated normalized record and the trusted parsed JSON deployment input, not every arbitrary JavaScript descriptor/prototype. Hostile getters, Proxies and caller-controlled executable objects are not an established security boundary. If such objects become a supported authority input, the owner must require a separate normalization/provenance change and composed regressions before relying on absence. This review does not silently treat the direct inherited negative as composed coverage.

The native module's writable legacy exports also retain their prior compatibility semantics; this change is not a new hardened authority boundary for those exports. Canary boundary snapshots and mutation refusals remain exercised.

## Independent checks and evidence

All commands below ran once against the exact reviewed sources, with fixed Node `C:/Program Files/nodejs/node.exe` v24.19.0, existing read-only dependencies and no install. The Python capture runner used the fixed bundled Python 3.12.14. Commands had argument arrays, `shell:false`, closed stdin, binary stdout/stderr captures and direct-child timeouts. No check failed or required retry.

| Command / independent check | Result | Timeout |
| --- | --- | --- |
| `node --test scripts/test-native-roleless.mjs` | 25 passed, 0 failed/skipped | 60 s |
| `node --test scripts/test-native-enforcement.mjs` | 47 passed, 0 failed/skipped | 60 s |
| `node --test infra/native-qualification/security.test.mjs` | 15 passed, 0 failed/skipped | 60 s |
| `node scripts/test-native-canary-profile.mjs <pinned-jsonata.js> <fresh-canary-result.json>` | 120 checks; 73 actual JSONata evaluations | 120 s |
| Fresh `independent-control.mjs` | 42 assertions passed; two separately reported non-JSON normalization observations | 60 s |

The independent control exercises both actual compiler paths with literal execution/legacy role expectations, eighteen present-field negative cases across SDK and Office, missing/invalid selectors, legacy absence refusals, unbranded-template refusal, exact PassRole and unchanged other policy statements, synthetic runtime refusal, and execution-role getter short circuit. It also compares the entire emitted CDK template with the preserved pre-change template after removing exactly its two historical role fields. These assertions overlap the author's suite; 42 is not a count of independent end-to-end workflows.

The new raw synthetic template is 5,846 bytes, SHA-256 `fa390ba774065cc382099984f69621bbd1b3a31e9c43c3b9be60431dfc5efa4d`. The preserved old template is 6,082 bytes, SHA-256 `7895fa997a8521fe7adc03cb7c468b1987de8875518ae0d8ab6f284496b13080`. Whole-template equality after only those two deletions passed. Component pins match the actual new output.

Canary checks reproduced native baseline lengths 7,133 / 112,210 / 115,766 and preserved distinct literal-B outputs. Canary graph/template/task-template hashes remain `b2b1004559c74d63e4d5f604f184c39b8f517f2c4b06073604f09cf215a1e3be`, `60fa0762fc97ea8a94767a9279786f154effe7b0c9418ac82e918802b1336c44`, and `39cd589630baf398460967adf0d2ed46edc8e5c5560678f742c35d715ee3724d`. Selected expression evaluation is not an AWS workflow or cleanup qualification.

Fresh ignored evidence: `.task-inputs/CODEX-G1-roleless-independent-1/`. Its immutable `manifest.json` is 16,759 bytes, SHA-256 `3b79cbf2fce8756d71f53a353b3a659b95c3f16288429be14f4d0403ae945ffa`, binding 106 payload files. It contains the helpers, raw Git streams, source-before/after records, check envelopes/captures, finite-control result, retained template copies and baseline/package-metadata pins. All 19 tracked source/test/lock/rule files equalled exact candidate Git blobs before checking and remained byte-identical afterward. HEAD remained exact `d9f31ca` throughout the checks. Existing owner dirty-path names were unchanged; their files were neither edited nor staged by this review.

Checks ran approximately 14:10:33.723–14:10:42.819Z on 10 October. Original envelope fields named `startedUtc`/`endedUtc` contain explicit `-04:00` offsets; the UTC times here are their conversion, not a rewrite. Direct-child timeouts do not prove descendant-tree cleanup, and PIPE capture has no memory byte cap. Actual captures are small and complete. Raw source equality uses a trusted local checkout; it is not a hostile-filesystem proof. Lock/package metadata pins are not a complete transitive dependency integrity audit. The synthesis tests refresh ignored CDK scratch only; previous author evidence and original baseline files remain preserved.

## Remaining owner gates

Before any native SDK/Office launch, review the task-definition-only change set, obtain fresh revision-qualified readbacks with absent `taskRoleArn`, and independently inspect the actual parent environment without printing credential values. Preserve execution-role, immutable image/source, fresh authority/identity, network/DNS, deadline, complete log/artifact and confirmed cleanup gates. Source role omission alone proves no runtime credential absence or sandbox/security property.

The changed compiler bytes invalidate historical fixed request-planner source pins. Advancing the complete reviewed compiler closure is separate owner work; this review neither rewrites original W18 evidence nor bypasses its fail-closed loader. Existing security/vendor findings and deployment holds remain. No AWS, provider/model, Docker/build, native probe, current Meri mutation, production deployment or cutover occurred in this review.