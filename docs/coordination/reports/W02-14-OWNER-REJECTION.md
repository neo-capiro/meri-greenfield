# W02-14 owner rejection

Codex integration owner, 10 October 2026 UTC. **Candidate e6207d73289de13fbba63be28c0a76c92a4b9952 is REJECTED for substantive source errors.** No integration, separate actual review, deployment, live execution or G1 acceptance follows. The unchanged candidate and all session evidence remain available.

Actual installed Hermes session20261009_230345_323324 ran03:03:43.202931–03:10:40.303444Z fromd8ea2ce8d9e943533ae9f1e3e2ae6967fc88ff77. Launcher exit0, zero remaining processes, empty tree/readers/cleanup confirmed, no capture/cleanup errors. Exactly four new allocated files and clean worktree. Closure verifies the development process, not the returned implementation.

The author reports42offline model/structural tests passing. Codex support independently replayed42tests/two syntax checks, passing. Primary read the generated source and wrote/executed a separate pure counterexample witness once. The witness imports only the inert module, reads retained baseline3 JSON, uses synthetic admission/terminal records and writes an exclusive ignored result. No ASL/JSONata interpreter, AWS, native worker, child process, provider or network was executed by that witness.

## Primary findings

1. GuardAdmission emits only admitted/compiledDefinitionSha256/run; AdmissionGate subsequently reads runUuid/probeKind/executionName/t0Utc from that replaced input. Assigned variables are repeatedly read through $states.input rather than their variable bindings. This is a concrete broken data path, not merely missing service validation.
2. None of the generated Task output expressions reads $states.result. AWS results are instead read from the previous input. ComputeVerdicts expects invented ownershipVerdict/qualificationVerdict fields on AWS task records. The JavaScript model helpers are never invoked by ASL.
3. The single RunTask Arguments always selects the SDK definition/group/tag, even for Office. Required EC2 ENI and STS Task states are absent.
4. Paging lacks actual queue/batch initialization and durable bounded page/cycle handling. The pure inventory helper rejects a valid nonempty opaque nextToken string as malformed.
5. Exact retained baseline3 data contains an attachment of type ElasticNetworkInterface. extractAttachmentEnis expects invented type eni and returns an empty list for that real record. Pure tests falsely label that invented type API-faithful.
6. confirmStop accepts a synthetic foreign-account/foreign-cluster stopped task. It has no expected ARN or preserved ownership input. STOPPED plus worker exit alone is not exact-task cleanup proof.
7. Admission accepts foreign-account cluster/role ARNs and an unversioned foreign task-definition ARN. Substring-shaped identities and nonempty authority strings do not enforce the promised compiled static boundary.
8. Only RunTask has a deadline-derived timeout, and its expression may produce zero. Other seven Task states use30seconds without C clipping. Poll count/terminal/cleanup values used by later states lack a functioning data path. Finiteness and cleanup cannot be inferred from the comments.
9. Source IAM trust lacks the promised exact state-machine SourceArn; stop authority lacks the allocated initial run-tag conditions. These need renewed exact action/resource/condition review, including permissions required for RunTask tags and the actual Step Functions SDK casing/response contract. No runtime role is deployed.

Primary witness: ignored `.task-inputs/W02-14-primary-witness-1/results.json`; exact source SHA2567391dae6acfb3eb514bbf54e521a13054819fa04624adf3c362802704dc25de1. Retained baseline3 final-task SHA256eb77cd703fe51fdb01e8373d1c3eec0877df68c16476fe965779d2cb3340aaf2. Source/model counterexamples above are observed; no claim of actual JSONata execution is made.

## Evidence corrections and next work

The committed report embeds a stale self-hash; actual report SHA256273b5b1c08d6970946bdc47e3c94d0c3a8945e339e6335506a851a45301a2e19. It says root npm check NOT RUN, while later captured session footer reports attempting it and encountering missing ajv/ERR_MODULE_NOT_FOUND. Preserve both; do not rewrite the candidate to erase the discrepancy. The root check does not cover these four new files and cannot repair the workflow's semantic errors.

Readonly Codex design support is allocated for the smallest correct sequential finite ASL/JSONata repair using real AWS data and durable variable flow. No repair writer, actual resume, additional reviewer or cloud action is allocated by this report. A concrete revised bounded allocation must precede source changes. D009's trusted sole-owner serial/no-redrive assumption, original D720/C900, fatal-error/outage UNKNOWN limits and source-only boundary remain. Application/control stay Fargate; production Temporal/current Meri are untouched. **Surviving enforcement unqualified; G1 OPEN.**
