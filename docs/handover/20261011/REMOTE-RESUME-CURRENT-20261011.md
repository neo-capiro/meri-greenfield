# Remote Meri resume: current source and operational handoff

Snapshot: 11 October 2026, about 18:44 UTC. This supplements the pinned
[remote pickup](REMOTE-PICKUP.md),
[continuation instructions](CONTINUATION-INSTRUCTIONS.md),
[reference index](REFERENCE-INDEX.md) and
[code manifest](REMOTE-CODE-MANIFEST.json). The adopted
[deployment plan](../../plans/MERI-DEPLOYMENT.md) has not changed. The
objective is a fully operational greenfield Meri under that plan, using
existing Capiro data and governed institutional memory. **G0 accepted;
G1 OPEN; G2–G7 unentered.** This branch publishes source and handoff notes,
not a gate result, merge or deployment.

## First actions on the remote host

1. Load the current private `neo-capiro/capiro-agent-ops` repo and follow its
   [BOOTSTRAP](https://github.com/neo-capiro/capiro-agent-ops/blob/b2b0ce8c2bf03817b81e671d968b7892985b8d06/BOOTSTRAP.md).
   Fetch current `origin/main` without discarding work; read its current
   `AGENTS.md` and host-specific path map. For Hermes work also read
   `hermes/OPERATING.md`. Record the actual policy SHA and map revision.
   The Windows source host had a clean local policy HEAD `b32b480` with
   unpublished commits beyond GitHub `origin/main@b2b0ce8` at this snapshot;
   **do not assume `b32b480` is available or authoritative on the remote**.
   If required current shared instructions cannot be reached, stop the
   affected action.
2. Read this repository's [AGENTS](../../../AGENTS.md),
   [implementation standards](../../IMPLEMENTATION-STANDARDS.md), this
   handoff, the pinned pickup, and the plan. The older
   [G1 remaining-work snapshot](../../qualification/G1-REMAINING-WORK.md)
   is dated history. Recheck current Git, PR and cloud state before acting.
3. Recover the exact source from this handoff branch, then reconstruct
   dependencies from lockfiles. Do not expect Windows paths, ignored
   `.task-inputs`, junctions, local PostgreSQL, Hermes sessions or secrets
   on the remote host. Original private build evidence remains external;
   locate it by the immutable S3 identity and checksum below if needed.

## Published source identities and integration state

At this snapshot backend [draft PR #3](https://github.com/neo-capiro/meri-greenfield/pull/3)
was OPEN/DRAFT at `1eac54274223729d69a0d44456a3f090dc1a0b80` on
`resume/meri-g1-review-20261011`, based on `task/handover-20261011`.
Frontend [draft PR #1](https://github.com/neo-capiro/capiro-frontend/pull/1)
was OPEN/DRAFT at `b697cfcba6589ef193de4e3bcb25aad773871125`
on `task/meri-cited-answer-20261011`. Both were read with `gh pr view`
and `git ls-remote`; neither was merged or deployed by this handoff.

GitHub branch: `handoff/meri-remote-resume-20261011`. It combines **two
previously separate local SDK source lines** over
PR #3's `1eac542` base. The image publication line ended at
`2cd2518e26d7a0ac2f3e678f8bb220026255a7f7`; the control and evidence
line ended at `70aa01b78bad47cde40e69a5e4953cbc7fd1b0d7`. Their
combination is a clean `ort` merge `faafd0e04e1a43c702f062a9222a9516f2d19862`
before this note. On the combined tree, focused Node 24.19.0 handler/S3
tests passed 10/10; image-publish Python tests passed 9/9 and image-build
tests passed 29/29 under the pinned owner Python 3.12.14. These tests did
not run an SDK worker or use live S3/PostgreSQL. This source is **not**
already in PR #3. Review the final branch HEAD and changed paths before
advancing the draft PR. The frontend remains a separate repository, and its
fixture route is disconnected synthetic UI rather than the full Meri product.

The new control source is
[`apps/control/qualification-sdk-fixture/service/control.mjs`](../../../apps/control/qualification-sdk-fixture/service/control.mjs),
with [checkpoint storage](../../../apps/control/qualification-sdk-fixture/service/checkpoint-store.mjs),
[S3 object I/O](../../../apps/control/qualification-sdk-fixture/service/s3-objects.mjs)
and [fixed handlers](../../../apps/control/qualification-sdk-fixture/service/handlers.mjs).
The [control source report](../../coordination/reports/CODEX-G1-SDK-CONTROL-COMPOSITION-20261011.md)
records the isolated PostgreSQL/mTLS/fake-S3 **11/11 PASS** result and its
limits. The [evidence-read report](../../coordination/reports/CODEX-G1-SDK-NATIVE-EVIDENCE-READ-20261011.md)
records a later **4/4 PASS** source test. It adds only a 64 KiB,
producer-scope-bound, exact-VersionId/size/SHA-256/KMS S3 read for `init`,
`interrupt`, `exit` and `drain`. **No trusted native evidence producer,
payload validator or production `evidenceInspector.verify` exists.** Test
inspectors are synthetic and must never admit a real checkpoint.

Image publication source is in
[`scripts/qualification/worker_image_publish.py`](../../../scripts/qualification/worker_image_publish.py)
and the reviewed [image publication report](../../coordination/reports/CODEX-G1-SDK-IMAGE-PUBLISH-20261011.md).
The report accepts one exact publish and static readback, not image/runtime
security. No newer build or cloud write is authorized by these files.

## Existing cloud resources and exact SDK image evidence

One separately approved checkpoint stack
`MeriGreenfield-QualificationSdkCheckpoint` reached `CREATE_COMPLETE` on
11 October. The [stack report](../../coordination/reports/CODEX-G1-SDK-CHECKPOINT-INFRA-20261011.md)
records its verified bucket/versioning/seven-day governance Object Lock,
SSE-KMS, public blocks, TLS policy and unused restricted control role.
Bucket: `meri-greenfield-qual-checkpoint-967807252336-us-east-1`.
KMS key ID: `3a04f062-40de-4ed8-9a24-dad87c488e0c`.
Role: `meri-greenfield-qualification-sdk-control`. The stack created no
checkpoint object or ECS task. Recheck live state before use.

The user's one approved SDK image publish build from source
`60941654423b4118989b7bfc772ad11b383972d0` was consumed as
CodeBuild `meri-greenfield-qualification-build:7f906e90-98d5-435f-98aa-2b2246ffd2cb`
in account `967807252336`, `us-east-1`. It **SUCCEEDED** at 18:17:15 UTC.
The immutable result archive is in S3 bucket
`meri-greenfield-qual-build-967807252336-us-east-1`, key
`results/sdk-worker-image-441596ba-edd3-4e1b-ba0a-eee53c9c4af4/evidence.tar.gz`,
version `RN2aZBAyPulzEwf6iNKONh8NDBAsIRJ6`, SHA-256
`0d1b822f1b27e29b1c37e3b8b2eede574b1a6218d71fe491f39ce95f3d209c34`.
All 97 archive members and ten copied image artifacts were independently
reconciled on the source host. The final static inventory had 26,901 entries,
zero traversal/expectation/privilege errors; its container was never started,
builder cleanup was observed, and provider calls were zero.

The published ECR worker digest is
`sha256:8d1ec09aa78f47a11019089dacde93289fc66a39f55bd4357e59eeb25d9b52ac`
in `meri-greenfield/qualification-worker`. Its exact-digest ECR basic scan
completed at 18:17:54 UTC with **47 findings: 5 CRITICAL, 17 HIGH,
17 MEDIUM, 7 LOW, 1 UNDEFINED**. The five critical rows involve curl (2),
GnuTLS (2) and TIFF (1). The report links primary vendor status and records
bounded applicability leads; it grants no waiver. Complete bundled-component
license/notice reconciliation is also pending. The image remains
**PUBLISHED_NOT_ADMITTED**. Do not start ECS, provider inference or a two-task
recovery run on this digest until the exact image receives a reviewed finding
disposition and runtime admission. Rebuilding the same recipe is not a fix.
The raw exact-scan JSON was not committed; retrieve the evidence archive/S3
readback and verify the full hash before relying on it remotely.

## Existing Capiro data and cleanup boundary

The user selected the existing live Aurora cluster
`capiro-dev-data-auroracluster23d869c0-ltmz40k47ewv` for Meri's eventual
PostgreSQL state, and requires answers grounded in existing Capiro data and
governed institutional memory. The proposed new dedicated RDS stack was
superseded and was not deployed. Meri run/checkpoint state may need an
isolated logical database and restricted role on the selected cluster;
permission-aware connectors should read the existing records and memory
under current actor/tenant/client/source grants. Do not bulk-copy customer
data into the state database. Source connections remain disabled until
their boundary is approved.

Last read-only inventory found that cluster in Capiro VPC
`vpc-0ac26cfac7ed972be` (`10.40.0.0/16`), while Meri qualification tasks
are in `vpc-06e1941747e798f0a` (`10.80.0.0/16`), with no observed
peering/transit path and no Meri security-group admission. Hourly CloudWatch
maxima hit 16/16 ACU in 15 of 24 hours; this does not prove sustained
saturation but does not justify an unreviewed qualification load. No live
Aurora SQL or write was made. Keep G1 synthetic DB tests isolated pending
network, SQL/role, ownership and capacity review. A prior RuntimeStack
source extension still names the superseded new RDS instance and must not
be deployed as-is.

The user named the active Cleanup1 task `cleanup1`. The
[coordination boundary](../../coordination/REMOTE-CLEANUP-BOUNDARY-20261011.md)
records a two-way owner response at 14:22 UTC with current-at-that-time
locator, source and no-overlap scope. It is time-sensitive. Before any
shared API/auth/CORS/schema/migration/source-access change, shared fixture
or resource cleanup, merge or release, get a fresh exact path-by-path
agreement. GitHub PR #2391 alone is not proof of a live session or its
current status. No Capiro source was imported into this repo.

## Gate status and next execution sequence

1. **Native SDK evidence:** implement a trusted producer and validator for
   genuine init, active Query.interrupt, child/subagent exit, stdout/stderr
   drain and fixture workspace-writer quiescence. The four S3 references
   alone, worker booleans and synthetic test inspector cannot prove these.
   Compose task-bound A/B credentials, real S3 and current-fence publication
   with the reviewed mTLS/PostgreSQL control source. Use the accepted SDK
   driver/loopback, not a second orchestration loop.
2. **Two-task SDK run:** after image, source, network/IAM and separate runtime
   admission, make task A genuinely interrupt and commit the bounded durable
   partial fixture, positively STOP A, advance/revoke its fence, prove an
   actual A-bound request denied before effects, admit distinct B under the
   same original D720/C900 clocks, independently reread/restore and observe
   native continuity plus the declared sentinel. Positively contain both
   tasks. The receipt remains `completeRecoveryCheckpoint:false` and
   `sessionStoreQualified:false`; full product SessionStore is W05/W09.
3. **Other G1 gates:** run combined native proxy auth/revocation and durable
   budget/model path in isolated Fargate; qualify real nonroot browser **and
   renderer** sandbox, egress, cancellation, watchdog and teardown on the
   approved dedicated host; finish selected REL-02 operation-specific
   contracts, native RG-08 discovery and measured frozen cohorts; resolve
   exact-image security/license. Local source suites prove none of these.
4. **Later gates:** W03–W11, connected frontend, governed sources/memory,
   Temporal/SessionStore/workflow integration, restores, full release tests
   and G7 cutover remain. **Do not ask for 75 existing user requests as a
   G1 input.** This is greenfield. The adopted REL-01 75-real-request
   baseline is later release work when a protected real corpus exists;
   synthetic examples are no replacement. The accepted plan still retains
   full SDK capability, separate Fargate app/control, dedicated browser-host
   exception, source-disabled start and the $10 synthetic Bedrock cap.

For a new external write, prepare the exact reviewed source/digest, account,
resource, IAM/network, cost and cleanup bounds, then get the separate
approval required by current shared policy. Prior approvals for draft PR
creation/older exact updates, checkpoint stack and **one** image build were
consumed; they are not a standing deployment or merge authorization. Use
bounded Hermes workers where useful, with one file owner per shared path,
exact commit review, focused tests and verified physical session closure.
This handoff branch itself changes no running service.
