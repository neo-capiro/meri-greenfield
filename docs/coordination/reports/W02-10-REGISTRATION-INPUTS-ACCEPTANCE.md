# W02-10 definition-registration input acceptance

Codex accepts only the **prepared definitions-only inputs** after a distinct actual Hermes review and independent primary inspection. The four source files are byte-identical to accepted candidate `390903a0ffddedb61bba5c8a47562864be7633c2`; unchanged tests and synthesis were not replayed. This acceptance grants no worker execution, image/security admission or G1 pass.

Actual reviewer `20261010_005326_692fd2` closed at 04:57:12.128050Z with report-only commit `538ef2cbbf1a92146c6715088b2973516299db11`, clean tree, exit 0, empty process tree, finished readers and confirmed cleanup. Its [report](W02-10-NATIVE-DEFINITION-INPUTS-REVIEW-2.md) SHA256 is `e97f4e06b4940cf73bdf5d108d3bd933984f4def92d30435dbb033c4602c36f7`. A separate read-only Codex audit agreed. Minor correction: the reviewer deleted its optional private verifier after the review; its present-tense wording implying that scratch remains is inaccurate. The captured transcript retains its source and output. The owner independently checked the actual bytes.

Prepared private inputs are `.task-inputs/W02-10-native-definition-inputs-2/`:

- Manifest SHA256 `80c1c6062ccbde948b292fcf3d67ce6fa7ac85f9cca5be9493026fb583e4319a`.
- Exact 6,082-byte template SHA256 `7895fa997a8521fe7adc03cb7c468b1987de8875518ae0d8ab6f284496b13080`.
- Proposed CREATE request SHA256 `684530328db1a0a36f87f05bb227d3cf871041fca3e3cc1f3e31b5b7a60df167`.

The template contains exactly `SdkTaskDefinition` and `OfficeTaskDefinition`, both `AWS::ECS::TaskDefinition`, and two outputs. It creates no IAM, service, networking, secret, asset, custom or transformed resource. Both definitions require the explicit WorkerImage parameter, with no default. Its regex is only a shape guard; it does not reject every historical/fake digest. The owner-supplied actual parameter is:

`967807252336.dkr.ecr.us-east-1.amazonaws.com/meri-greenfield/qualification-worker@sha256:bf55fdab91136344688e2c804598546e521b24d6cdbf4fde9e6a7131e6c2ec9c`

Owner full inspection confirmed the fixed native commands, retained isolated roles, FARGATE/awsvpc/X86_64/Linux, CPU 2048/memory 8192/ephemeral 50, UID 10001, read-only root, nonprivileged/drop ALL, fresh workspace/tmp volumes, seven inert environment values and blocking private logs. No no-new-privileges claim is made.

## Historical change-set checkpoint

Read-only prerequisites at 04:55Z and a separate inline-policy read established the exact principal, absent NEW stack, empty ACTIVE families, scoped ECS task-role trusts, an empty worker role and execution permissions limited to the isolated image pull/log/KMS path. Before the single change-set creation, the owner refreshed identity, stack absence, both ACTIVE and INACTIVE families, role IDs/trust/boundaries and policy attachments/body, then rechecked STS immediately before mutation. All evidence is point-in-time; this is not full runtime IAM/network/DNS admission.

At 05:07:28.822Z, one reserved, consumed CreateChangeSet request created only the NEW review placeholder `MeriGreenfield-NativeQualification`:

- Stack ID `arn:aws:cloudformation:us-east-1:967807252336:stack/MeriGreenfield-NativeQualification/7d925160-c468-11f1-bea1-120ccf9f5447`.
- Change set `arn:aws:cloudformation:us-east-1:967807252336:changeSet/meri-native-definitions-20261010-bf55fdab/bacf95f2-c906-4e03-8537-5774fe804d5d`.
- Actual change set CREATE_COMPLETE / AVAILABLE, exactly two Add task-definition changes; stack REVIEW_IN_PROGRESS. No execution has occurred at this checkpoint.

Complete private request/reservation, 14 fresh read calls, the one mutation response and four subsequent readbacks are retained in `docs/coordination/private-evidence/W02-10-definition-registration-1/`. Owner and separate read-only review of the actual all-ADD change set and Original/Processed templates precede any execution. The [AWS CreateChangeSet contract](https://docs.aws.amazon.com/AWSCloudFormation/latest/APIReference/API_CreateChangeSet.html) distinguishes this review placeholder from execution; the [task-definition resource](https://docs.aws.amazon.com/AWSCloudFormation/latest/TemplateReference/aws-resource-ecs-taskdefinition.html) registers a definition. Neither operation launches a task or accepts an image.

The image remains static-build accepted only. All 49 scan findings, including 22 severe, remain open; Office residual risk is deferred and W02-14 is unaccepted. No RunTask, SDK/Office/browser/provider/source operation, application deployment or cutover is admitted. Runtime launches require their own image/exposure decision, fresh complete authority and accepted surviving enforcement.

## Registration follow-through

The owner and separate read-only Codex reviewer subsequently reconciled all 38 captured output-stream hashes, the exact actual two-Add change set and both Original/Processed template bodies. No structural issue was found. Change-set readback SHA256: `c88a07242e5f9d36cdd1f534ce7d274f11c1f63e03c6e009b9fccefbf2d3559c`. AWS CreationTime and local dispatch timestamps use different clocks; local capture establishes STS-before-dispatch, not exact cross-clock ordering.

After a fresh AVAILABLE-status/parameter/resource check and immediate fresh STS verification, the owner consumed one exact ExecuteChangeSet reservation. The stack reached CREATE_COMPLETE at AWS 05:11:00.311Z. SDK and Office revision 1 were registered and independently read back. See [definitions-only registration acceptance](W02-10-DEFINITIONS-REGISTRATION-ACCEPTANCE.md). This advances the inert registration prerequisite only; runtime/security admission remains absent.
