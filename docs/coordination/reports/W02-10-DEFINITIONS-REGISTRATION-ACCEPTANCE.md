# W02-10 definitions-only registration acceptance

The new isolated `MeriGreenfield-NativeQualification` stack reached **CREATE_COMPLETE** at AWS 2026-10-10T05:11:00.311Z. Codex accepts registration of exactly two inert task definitions. **No RunTask, image pull, native SDK/Office execution, security admission or G1 pass follows from registration.**

The [prepared-input acceptance](W02-10-REGISTRATION-INPUTS-ACCEPTANCE.md) records distinct actual Hermes review `538ef2c` and independent primary verification. Owner and a separate read-only Codex reviewer then inspected the actual CREATE change set: exactly two Add changes, no other resources, no pagination/imports/capabilities/deployment role/nested stack, explicit image parameter `bf55fdab…`, and Original/Processed templates semantically equal to the reviewed 6,082-byte template. All 38 output-stream hashes reconciled. Fresh AVAILABLE-status checks and immediate STS verification preceded the single reserved ExecuteChangeSet request.

Complete private evidence: `docs/coordination/private-evidence/W02-10-definition-registration-1/`. It retains the exact request, consumed create and execute reservations, both mutation responses, preflight authority/name checks and immutable readbacks. Only one CreateChangeSet and one ExecuteChangeSet were dispatched; neither request includes RunTask or creates a running service. Local and AWS timestamps are distinct clocks, so cross-clock ordering is not inferred from numeric time alone.

## Registered objects

- Stack ID: `arn:aws:cloudformation:us-east-1:967807252336:stack/MeriGreenfield-NativeQualification/7d925160-c468-11f1-bea1-120ccf9f5447`.
- SDK definition: `arn:aws:ecs:us-east-1:967807252336:task-definition/meri-greenfield-qualification-sdk:1`.
- Office definition: `arn:aws:ecs:us-east-1:967807252336:task-definition/meri-greenfield-qualification-office:1`.
- Both image fields: `967807252336.dkr.ecr.us-east-1.amazonaws.com/meri-greenfield/qualification-worker@sha256:bf55fdab91136344688e2c804598546e521b24d6cdbf4fde9e6a7131e6c2ec9c`.

Six fresh post-execution readbacks contain stack, exactly two stack resources, events, EXECUTE_COMPLETE change set and both complete ECS definitions. Their manifest SHA256 is `222950debfc3603e2ed2beb71f4927099b284aa2295a33de8d8e050e19b42f50`. SDK raw JSON SHA256 is `40f6b4a70ebf9558dbcb724ab969a332104b85bf97cf181490308f524597f0a0`; Office raw JSON SHA256 is `355b1beb670a1364ea5d1f53c53042113f09a39bfe274b6406a5d3a9315f598b`.

The owner read the full definition bodies and a separate read-only Codex audit matched both against the reviewed template. Exact image, family/revision, isolated roles, FARGATE/awsvpc/X86_64/Linux, CPU/memory/ephemeral resources, fixed native commands, seven inert environment values, fresh workspace/tmp mounts, UID 10001, read-only root, nonprivileged/drop ALL and blocking private logs match. ECS reports additional empty defaults and reorders environment/volume lists; these raw facts are retained, not silently removed.

## Integration gap and remaining gates

W02-14 candidate `234a08e` rejects the actual API representation with `exact volumes/single worker`. A primary local compatibility witness used the two actual cached definitions and explicitly synthetic other authority, without AWS calls or runtime enablement. Independent source/data inspection also found empty Linux/logging/container defaults and `placementConstraints:[]` that its strict validator rejects. This is a source integration gap; accepting registration does not claim compiler compatibility. Any adapter must preserve full raw hash-bound evidence, admit only explicitly reviewed neutral defaults and unique order-independent environment/volume comparisons, and continue rejecting unknown, wrong-type or nonempty settings.

W02-14 also has two measured sticky attachment failures and remains unaccepted. Its bounded repair and separate exact-commit review are independent of this registration. All 49 image scan findings, including 22 severe, remain open; Office residual risk is deferred. Fresh complete IAM/network/DNS/log/KMS authority, accepted surviving enforcement, per-run image/exposure admission and native evidence remain before runtime. Current Meri is untouched; G1 stays OPEN and no cutover is authorized.
