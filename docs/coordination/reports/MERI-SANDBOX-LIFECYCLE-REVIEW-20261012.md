# Sandbox and artifact lifecycle independent review — 12 October 2026

Initial disposition: **HOLD — discovery only, no author candidate reviewed.**
Exact base PR15 `14be9fc614568a74133b89f2b229e50c9b030322`, tree
`fd5ac72bed31f0611e4c24a6535730ac17a14ad7`. Reviewer Codex
`/root/memory_reviewer`; isolated branch `review/meri-sandbox-lifecycle-20261012`.
The 12 behavioral criteria and exact source intake hashes are frozen under
`docs/qualification/candidates/sandbox-lifecycle-20261012/review/` before author
implementation. Root owns path allocation and integration.

Current worker browser/artifact implementations are opt-in qualification probes.
`runtime.mjs` invokes sibling probes with synchronous subprocess deadlines;
`browser.mjs` owns an MCP client, fixture server and fresh profile/output paths,
then closes the client/server. It does not implement canonical task A/B binding
or establish positive descendant death readback. A timer or close call cannot
stand in for either invariant. No browser or renderer was run for this review.

`office-export.mjs` has useful existing boundaries: one artifact probe, bounded
streams/deadlines, scoped process-group kill plus absence observation, structured
native/render/recalculation verdicts, path-chain and file identity checks, exact
11-file inspection and bounded evidence export. Preserve its original controls.
This is fixture evidence export, not task-authorized product publication.
`scripts/sdk-capture/artifacts.mjs` similarly verifies written file bytes and
cleans only its newly owned directory; it is a capture decoder, not a product
artifact owner. `ArtifactVersion` and the complete `RunBinding` already have
canonical public0.1 schemas, but no application caller of ArtifactVersion was
found at intake. Do not introduce a second registry or silently change schemas.

The source candidate must be reachable through a real owner entry, bind exact
current task identity, propagate cancellation/deadlines across every async
boundary, suppress late results, clean only owned resources including late
acquisitions, retain physical teardown uncertainty and inspect the exact bytes
before any publication. Source-disabled integration and fake ports can prove
control flow; they cannot prove browser/renderer isolation, physical process
death, native format validity, visual quality, infrastructure egress or G1.

All original tests, failed evidence, branches, contracts, pins and SDK ownership
remain preserved. No native process, browser, renderer, database, Docker, cloud,
model, provider or customer-data operation is authorized by this review. The
next step is to inspect the author's root-allocated entry/interface proposal,
then independently replay the exact frozen source with bounded local controls.
