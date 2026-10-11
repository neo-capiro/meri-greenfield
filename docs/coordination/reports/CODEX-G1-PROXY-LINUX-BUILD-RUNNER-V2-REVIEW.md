# Linux experiment runner v2 independent source review

Verdict: **HOLD before dispatch** for one remaining failure-bundle accounting defect. The v2 source addresses both capture/evidence blockers in the independently sealed v1 review, but an OSError after writing a bundle prefix leaves those bytes outside the aggregate counter. The owner was informed before any build. No native, Docker, cloud or runtime acceptance is granted.

Dedicated worktree: `C:/dev/main/meri-greenfield-worktrees/g1-proxy-linux-build-runner-v2-review`, branch `review/proxy-linux-build-runner-v2`, base `cf0b91618582ce5beb3b04f24a6faa396cb0c13f`. The same pinned-base AGENTS and implementation standards apply. A proportional ignored outline preceded review. Only this report is tracked. Candidate code, help, preflight tests, Docker, native binaries, AWS, installation and network were not executed; only stdlib DATA reconciliation and Git/PowerShell reads ran.

## Exact scope and continuity

The owner sources are under `C:/dev/main/meri-greenfield-worktrees/g1-parallel-integration/.task-inputs/proxy-linux-owner-build-1`:

- `linux-run.py`, SHA-256 `8dd5bae1743ed76d5770ae0b92129686e05039a884910db23893c94ecbf661e5`.
- `buildspec-2.json`, SHA-256 `759ebff2c371fd58b6f13f9e11190173e103204ad522e23762e92c3f91127688`.

Both were fully read and copied unchanged into `.task-inputs/linux-build-runner-v2-review-1/`. Fixed v1 source copies come from the prior independent review rather than mutable owner paths. Removing the reviewed selector import, substituting the entire old capture function, and removing the two explicit image/mount restrictions reproduces **all original runner bytes exactly**. No other source delta is present. The recipe build command differs only in the runner hash; its upload command, KMS/checksum/version checks and shell header remain byte-identical. Only the inline result packer changed. The reconciler saves both unified diffs and all four raw pins without importing the candidate.

V1 remains closed at report-only commit `d4f93c6f9020a426900e704523ec2910b35c2ba0`; its report SHA-256 is `6d6bd37155c7eefd1f3712b8d7636771670864dd511eb9de6c203f3d62ec5a82`. Its 233-payload seal, SHA-256 `6515b0bf2123b40bb54871c4beaa1a0a18c3cf1e4997231efc288ad60a517916`, and historical HOLD findings remain untouched. This v2 assessment does not relabel the v1 source or checks as accepted.

## Original findings addressed in source

V2 captures stdout/stderr through nonblocking pipes and drains them even after process exit. Each write is sliced to the remaining 32 MiB per-stream prefix; an overflow is marked and refused before any complete-output read or JSON parse. Both observed and written byte counts, capture completeness, bound failure, exit and hashes are recorded. Exactly-at-cap EOF can succeed; additional bytes make the capture incomplete. `observedBytes` means bytes drained before termination, not the total the child may have produced. These source changes address the fast-exit acceptance gap and make the retained prefix physically bounded.

The new finally packer prioritizes JSON receipts, limits selection to 128 files and writes prefixes within a nominal 512 MiB payload budget. It records missing/nonregular/linked/excluded files, prefix lengths/hashes and completeness rather than asserting away an oversized stream before upload. The archive checksum and upload version still bind the produced archive. Thus ordinary oversized-output failures now have an upload path instead of the v1 assert-and-abandon behavior. Failure-path aggregate accounting remains defective as described below.

Image-declared volumes are now rejected. Image Env records must be strings with assignments and unique names, and known AWS/provider/database/key/token/password names are rejected. The created container's writable mounts may only be tmpfs at `/tmp`. These are focused additive checks; a credential-name denylist is not a universal secret detector. Final pinned Dockerfile/artifact inspection remains necessary.

## Remaining blocker: retained partial prefixes escape aggregate accounting

Inside the new `__RESULTS__` block, the packer selects a prefix using `536870912-total`, opens the target and writes bytes, then calls `path.lstat()` again. Only after that succeeds does it execute `total+=n` and append the complete prefix record. The enclosing `except OSError` appends merely an error type. It leaves an already-created partial target in `result-bundle/`, without charging its bytes to `total` or recording a prefix hash.

For example, an OSError at the post-copy lstat after each 32 MiB write leaves the budget unchanged. Seventeen such retained targets exceed 512 MiB, and the final archive includes all bundle members. Up to 128 selected files could therefore exceed the advertised aggregate bound. This is a source-derived counterexample; no injected failure or packer execution was performed by this reviewer.

The repair should account for the actual retained target bytes on every exit path and bind any retained partial prefix with length/hash/incomplete/error facts. Alternatively, it may explicitly exclude that newly owned partial target, preserving the failure record; it must not hide the failure or touch historical outputs. The finite budget must include error-path retained bytes, not just successful copies. Exact new source and focused error-path DATA evidence are required before lifting this HOLD.

## Unchanged and unverified boundaries

Context validation, owner image/label checks, create-attempt handling, unique-name recovery, forced removal only after positive ownership, absent-container readback, stable-input check and fixed native result fields are unchanged. This is a delta review, not a replay of those tests or physical cleanup. Native runtime still requests network none, read-only root, cap-drop ALL, no-new-privileges, nonroot identity, bounded tmpfs/PIDs/memory/CPU and no host binds.

Unexpected Popen/selector/read/wait exceptions can still omit a per-call process receipt; top-level result/other raw files may remain, and failure must stay unqualified. Killing the CLI process group does not prove daemon-side build work has stopped. The root project timeout/host disposal and unknown-build reconciliation remain external owner responsibilities. No Docker state was observed.

The retained 15 preflight groups belong to the unchanged v1 context checks: one positive and eleven context refusals, help, unknown arguments and a Windows platform refusal. The `missing-environment` case never reached Linux environment checks. Those groups were not rerun or relabeled as new capture/packer evidence. ROOT announced separate benign/oversized DATA packer controls; no results were supplied or inferred for this report.

The seven-file context, full artifact/input manifest, exact archive/S3 version, final owner source/request binding, one-shot dispatch reservation and build acknowledgment reconciliation remain outside this review. The builder role retains ECR permissions, while this recipe contains no ECR action; that is a source restriction, not IAM-denied authority. A successful CodeBuild terminal status or uploaded empty/incomplete bundle is insufficient: acceptance must require genuine import fields, complete raw process evidence, exact image/source/input binding, stable inputs and positive owned-container cleanup. No Fargate/database/provider/model/G1 admission follows.

The versioned finite seal binds the four raw source copies, inverse/diff DATA result, outline/reconciler, report Git bytes and runtime executable. It is an audit record of source observations, not evidence of a past kernel state or executed Linux experiment.
