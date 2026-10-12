# Frozen independent source-disabled gateway review

12 October 2026 UTC. **HOLD_SOURCE** exact `1f0250df1d8d87751b2c4807fa2de2fe88a1d1ee`, tree `309fcb76b3effab1f34e78445a311e0c8f74b150`. User requested freezing all work and a new-session handover during this review. No further workstream or source repair was started by the reviewer. The retained deadline finding must be resolved before source acceptance.

## Reproduced blocker: fresh release deadline is not applied to pending settlement

`dispatch/tool-dispatch.mjs` obtains fresh release authority after handler execution and validates `now() < release.deadlineMs`, but does not shrink the lifetime to that deadline before awaiting `budget.settle`. The lifetime therefore retains the earlier run/capability/request timer.

The independent seeded-port control changes the run deadline from `NOW+10000` to `NOW+20` during the handler. The subsequent fresh release lookup observes exactly `NOW+20`. Budget settlement is parked. After 100 milliseconds the request remains pending rather than reaching its shortened deadline; the expected-bound assertion fails, physical exit **1**. No source/JWT/DB/real budget was accessed. This is a mechanical dispatch-lifetime gap, not a measured production policy SLA.

Reviewer cleanup aborts the operation, waits for `CANCELLED`, observes exactly one uncertainty call, resolves the pending synthetic settlement and drains its microtasks. The owned process group is absent. The original failed control and raw output remain unchanged, including harmless console formatting. No refund or physical-stop claim is made.

Required next task: apply each newly obtained release authority deadline to the owned lifetime before subsequent settlement/other awaited work; maintain shrink-only semantics and check final authority/deadline before release. Replay `release-deadline-control.mjs` against an exact frozen repair, run original 17 and actual13 composition cases, and preserve this HOLD/proof. Source-disabled behavior must remain hardwired. A repair is not accepted by this frozen report.

## Reviewed source and completed evidence

Six allocated source owners separate source-disabled composition, immutable catalog lookup, current authority-port composition, lifecycle/cancellation, primitive raw JSON/safe errors and one-call dispatch. Two test files contain seeded in-process ports and an explicit internal bound test carrier. The carrier is not an actual registered federal/data operation protocol. Raw canonical federal/data outputs without qualified binding/subject lineage remain intentionally unreleasable.

Raw external boundaries accept bounded primitive JSON strings and refuse external objects/proxies without property inspection. Argument authority fields refuse before ports/effects. Safe errors use private WeakMap codes rather than external error content. Mandatory trusted ports/configuration create no live listener, auth provider, database, timer or source adapter at import/construction. Actual signature verification, membership/client/private-mail/memory walls, ECS identity, source principals, durable budgets and atomic authorized publication remain absent production dependencies.

Consistency controls require matching actor/tenant/run/fence/policy/scope/source facts and fresh timestamps, reread run state after policy awaits, recheck before effect/result release, require reservation/settlement acknowledgements, mark unsettled reservations uncertain and never refund/retry them. Deadline and cancellation abort signals are not physical-stop evidence. The demonstrated release-deadline gap limits acceptance of those controls. Budget-pending/unknown/settlement-error and suspended-client/private-mail scenarios beyond the original suite were not newly qualified before the user's freeze.

| Actual independent check | Physical result |
| --- | --- |
| Exact gateway source with its original base catalog | **17/17 PASS**, exit 0; 1.014 seconds |
| Same gateway bytes composed with accepted catalog `475e970bb0776b63a80a1ac8170bfaabf27959a3` | **17/17 PASS**, exit 0; 1.046 seconds |
| Fresh release deadline / parked settlement negative control | **FAIL**, exit 1; 0.933 seconds; expected shortened-bound completion absent |

The composition fixture copies exact pinned source bytes into an owned ignored overlay: 29 files / 517,707 bytes; neither producer is edited. It uses the accepted thirteen-operation catalog/resolver source and the exact gateway modules/tests. All thirteen descriptors remain pending/unimplemented/null-handler and production exposes/executes zero tools, making zero authority/budget/source calls. Discovery stays empty. The gateway's own frozen source base still contains three pending mail descriptors; the overlay is proof of disabled composition compatibility, not a tracked integration or actual active canonical dispatch.

All three commands use pinned Node24.19.0, fifteen-second external supervisor bounds and retained raw stdout/stderr/physical exits. Every owned group is absent and owned temporary roots are removed. Borrowed dependency trees are read-only and untouched; no dependency installation or gigabyte copy occurred. Owned dependency link and the half-megabyte overlay are removed after manifest/context capture. No product source was edited, no real JWT/DB/source/provider/AWS/cloud/network Git/runtime/activation was invoked, and no deployment permission or admission was transferred.

## New-session handover and context

The accepted catalog dependency is source-only `475e970bb0776b63a80a1ac8170bfaabf27959a3`, tree `8c7166aa86be9f3fa4fdecafeda46dbdc0cfb89d`: thirteen mapped operations, 139 original IDs, 96 selected, 43 deferred, 83 selected pending/unmapped; action items remain pending and every handler/retry is disabled. Real reader, lineage, auth, cursor, revocation and durable-budget qualification is still necessary after this core repair.

The latest accepted fresh-runner collector source is `a3c3c340218690ff1b02672ab50565014f51eae2`; independent review `ae4ba22ea5b598cc808270acc252435aa0fbe7d3` retains 27 passing source tests and replay proofs. Actual Windows PeekNamedPipe/OS/ACL/loaded-native/full executable closure and runner/build/G1 admission remain unrun. Original runner HOLD reviews `c13a536d9d629cfc9a4f74a9c70d9cc744bfbd03` and `58b12c32be5dd596414a128bd84d63dd6b25112f` remain immutable. Accepted catalog review is `2b4336de9714e26a731923621a3cb0b289c3b11a`. No previous source acceptance establishes deployment or authentic runtime authority.

[context-files.json](../../qualification/candidates/gateway-source-disabled-20261012/independent-review-20261012/context-files.json) records 56 repository/ref/path/byte/SHA256 entries actually read/copied/imported for this review, plus linked earlier handover reports, pinned runtime hash and borrowed dependency package metadata. This is not a full installed-tree attestation. [freeze-cleanup.json](../../qualification/candidates/gateway-source-disabled-20261012/independent-review-20261012/freeze-cleanup.json) records no active owned process, released synthetic pending work and removed owned scaffolding.

Remaining exact source/evidence: [review directory](../../qualification/candidates/gateway-source-disabled-20261012/independent-review-20261012/) contains original17 and actual13-overlay17 receipts/raw streams, exact overlay manifest, release-deadline script/failing receipt/raw output, machine-readable context and cleanup, and review index. User freeze stopped further probes. The returned local review commit contains only the allocated NEW task/report/evidence and has exact frozen gateway source as parent. Any ignored post-commit Git readback receipt is an owned audit artifact, not product work. No unsaved product change or active owned process remains.
