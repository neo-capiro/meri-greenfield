# Accepted source reference repair

Root owns only the REFERENCE/comment in
`scripts/qualification/worker_image_build.py`, this task, a new report and
`docs/qualification/candidates/worker-baseline-repair-20261012/author/**`.
Base is integrated source `d7e8b620a5d44a74341610a44afdfd01987552d4`.
The parent explicitly authorized legitimately stale source-guard repairs;
memory_reviewer separately owns review evidence and report in a fresh worktree.

The final preservation check discovered that the old stable-source reference
`f118ff55dfb96ba4b44099953e6c9724064b723d` predates 17 current stable members.
Read-only fetch recovered that exact historical Git object. All 44 current
stable members equal the expressly accepted PR7 source
`5ee46446b5f60034916f00b2a665b3e2bef9cf60` byte-for-byte. Source connectivity and
runtime qualification remain unavailable. No implementation is imported or
changed by this repair.

After independent criteria freeze, rebind only REFERENCE to accepted PR7.
Preserve the full stable set, packaging exclusions, current Git/worktree checks,
assembler hash, fixed Windows executable/Git/caller checks and every authority
guard. Retain the old-reference failure and source provenance. Exercise actual
baseline logic with an explicitly labeled Linux Git test adapter; this is not
qualification of the fixed Windows Git/runtime. Independent controls must still
reject stable byte changes, missing source, candidate/worktree drift and altered
assembler. Original 36 build tests remain 35 passing plus the unsupported fixed
Windows-owner error on this Linux host. No skip or weaker assertion is allowed.

This source task is bounded to 15 minutes. No build, native collector invocation,
resource, credential, network/security/database state change or paid model call
is authorized. Reports must retain original failures and distinguish local Git
source verification from native runner admission.
