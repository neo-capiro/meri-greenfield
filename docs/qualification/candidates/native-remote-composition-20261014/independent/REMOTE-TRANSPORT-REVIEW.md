# Independent remote transport source review

Read-only review of the initial working sources, 2026-10-14, base47c28805fbfc560c0b556875f673c3211e4e6a96. No other agent production files edited and no transport/SDK/CLI/cloud call executed for this review. Findings were sent promptly to root and transport owner; source remains subject to their correction and final independent freeze review. This is not remote task/live authority acceptance.

Blocking initial findings:

1. Remote controller methods return `{original,receipt}` or `{original,capture}` envelopes. Existing ECS/native receipt validation, registration owner, workspace adapter and checkpoint composition require raw closed DTOs. Exact-original validation must occur before unwrap. Test real controller-to-consumer compatibility, not only raw HTTP response shape.
2. Raw config capture/validate use shared `data`16MiB JSON/depth64 boundary despite32MiB raw bytes becoming~43MiB base64. Use existing scoped inert JSON copier with an explicit transfer bound; preserve global contracts and raw-byte caps. Full checkpoint capture response56MiB fits client64MiB cap; capture request itself is small.
3. Client `channel` awaits `reader.cancel()` in finally outside operation lifetime. A parked cancel can prevent operation return forever; late fetch responses after deadline also need body retirement. Nonawaited cancellation/late response controls are needed.
4. Process client close fabricates exit code0 when no actual exit was observed. Physical stop proof is distinct from native successful exit metadata. Preserve unknown/actual code and original process receipt.
5. Pump waits on drain/error without cancellation/close; close only disposes local streams after successful remote stop. Stop failure/backpressure/close-before-start can retain parked operations and unresolved readiness. Dispose owned local streams/reject readiness in finally and settle original stop separately without masking uncertainty.
6. Config scan only rechecks root stat after capture, not all earlier files/nested directories and membership. Earlier nested file changes while later reads occur need rejection. `readFileSync(fd)` can exceed the allocation cap if file grows after prestat; bounded fixed-size reads are required. Empty directories and directory modes are omitted; exact raw-tree preservation must either include them or refuse the unsupported source shape explicitly.

Static safeguards present: enabled defaults false; fixed native-task routes; distinct control/task capability digests; worker role limited to SDK prepare/start/stdin/stdout/stop, control-only registration/workspace/capture; exact original tuple on requests/replies; finite body/frame/queue bounds; original expiry applied to normal operations, original cleanup remains available afterward. These positive static observations do not qualify current authority or physical process cleanup.

Composition requirement: descriptor policy currently checks cwd/command/configparent/secure-storage path only. Root's trusted preparation authorizer/native factory must validate exact approved SDK args/env/provider binding before admission ACK/launch compilation. Possession of task capability must not convert arbitrary worker descriptor args/environment into the canonical approved plan.

## Readback file hashes (working sources may change after this review)

- `apps/runtime/native-authority/remote-task-boundary.mjs`: `80d3f4c51747991c2500fcc4cbb128f5d529cb62a997fc68eabeb6e03a0710b9`
- `apps/runtime/native-authority/remote-task-http.mjs`: `b4d668f2246894e2e6c40543f55783b807e4183800f8cb89166ec53d62804482`
- `apps/runtime/native-authority/remote-task-client.mjs`: `775e36beee7e26e1974f2854325286468251c30808004d9676053198f0e7ee74`
- `apps/runtime/native-authority/sdk-config-transfer.mjs`: `6e9b481c9e4b9b1893b467bd1ee41d2794627c5562ee589678660cd589e1b8bb`
