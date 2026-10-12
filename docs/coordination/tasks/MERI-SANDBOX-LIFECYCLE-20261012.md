# Qualification probe watchdog and cleanup source slice

Author memory_author; independent reviewer memory_reviewer. Base PR15 `14be9fc614568a74133b89f2b229e50c9b030322`, tree `fd5ac72bed31f0611e4c24a6535730ac17a14ad7`. Dedicated precreated worktree `/workspace/meri-sandbox-lifecycle-20261012`, branch `task/meri-sandbox-lifecycle-20261012`. Discovery began 2026-10-12 04:52:59 UTC, ten-minute bound. Initial worktree-add attempt refused because root had already created the exact branch; read-only verification confirmed the correct clean worktree and base, with no branch removed or reset.

Read AGENTS.md, implementation standards, adopted deployment R2 worker/browser/artifact responsibilities, actual runtime/browser/artifact/Office export callers, existing tests and finite context source list. No `.agents/skills` directory exists in this worktree or `/workspace/.agents`. Initial allocation is this task, the matching report and `docs/qualification/candidates/sandbox-lifecycle-20261012/author/**`; production edits require root's exact allocation.

## Outline before implementation

1. Preserve current qualification-only scope. Root narrowed this slice to observed probe watchdog/cleanup defects, not a product artifact publication or task-authorization system. Reuse existing owned-child cleanup and existing Office byte/file verification rather than inventing parallel implementations. No new product authority DTO.
2. Propose NEW `apps/worker/qualification/probes/owned-probe-child.mjs` and `owned-probe-child.test.mjs`: extract the existing owned process-group supervisor, retaining exact close-plus-definite-group-absence semantics, and add AbortSignal, monotonic bounded cleanup, output bounds and safe late-event handling. Spawn exactly one of the fixed browser/artifact probe entrypoints. No shell or arbitrary executable input.
3. Propose narrow existing `office-export.mjs` delegation/reexports preserving its public child-helper interface, original file inspection, eleven-file allowlist, protocol and all original assertions. Propose existing `runtime.mjs` async actual caller integration for both children, with clean semantic failures continuing independent checks, but unknown cleanup preventing another probe launch and reporting NOT-RUN/HOLD.
4. Propose NEW `browser-lifetime.mjs` and `browser-lifetime.test.mjs`, integrated into existing browser main, to bound MCP startup/listTools/calls and both official client and fixture-server close waits, bound stderr, handle cancellation and late acquisition. The official MCP SDK and Playwright retain browser/process behavior; closing a client is not independently observed descendant death. The outer child supervisor owns that qualification observation.
5. Root must centrally allocate the four new finite worker-context list members, then review exact context/source hashes. No collector/component/image pins are edited here. A missing packaged import is a preparation HOLD, not shippable source packaging.
6. Run only local ordinary source and scripted child/MCP-port tests. Preserve original test bodies and negative controls; capture failures, rerun reasons, source hashes and owned test-process cleanup. No native browser, renderer, OS sandbox/kill, Docker, DB, cloud, model/provider, customer or frontend execution; no host artifact skills, image/lock/contract/infra edits or recursive delegation.

## Discovery findings

`runtime.mjs` runs both child probes using synchronous direct-child timeout/SIGKILL. That path does not establish descendant/process-group cleanup. `office-export.mjs` already supplies the appropriate owned-child responsibilities and requires close plus strict definite group absence before accepting artifacts. Its current operation lacks caller cancellation, and the runtime path bypasses it.

`browser.mjs` declares an unused DEADLINE_MS. MCP connect/listTools/tool calls and client.close can park; stderr is concatenated without a cap; server.close is not awaited. Native prelaunch and process inspection remain separate qualification evidence and must not be replaced with scripted success claims. Artifact generation/conversion and exact export/reconstruction validators already exist and remain canonical.

Trusted task identity/authorization and actual artifact publication belong to other runtime/product owners. Probe UUIDs, owned child handles and fresh output directories establish only local qualification-resource correlation; they must not be labeled tenant or task authority. Native sandbox, image, physical process-death and target-host egress/teardown qualification remain open.

## Allocation and fixture precondition

Root allocated the four proposed modules/tests, thin existing runtime/browser/Office integration, worker README and exactly four finite PACKAGE_FILES additions. Root separately allocated the pre-existing Office fake-child fixture correction: main forwards optional group ports with defaults unchanged; the fixture assigns a valid synthetic PID and retains exact child/close state in a WeakMap. All original assertions and names remain. Native execution remains prohibited. The supervisor implementation window began at 05:00 UTC.
