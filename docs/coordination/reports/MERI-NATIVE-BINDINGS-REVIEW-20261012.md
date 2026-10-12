# Native binding/adaptation independent review — 12 October 2026

**HOLD — criteria frozen before implementation; exact private inputs and author
allocation/freeze pending.** Reviewer: Codex `/root/memory_reviewer`. Exact base
`263d0d174f9924a6030bb1c20100ff1115ffcda0`; isolated branch
`review/meri-native-bindings-20261012`.

Read AGENTS, implementation standards, adopted R2, the source-to-native roadmap,
root continuation task and actual accepted wrapper/lifecycle/inventory owners.
The review owns only this report and `native-bindings-20261012/review/**`.
Twelve criteria and six original source anchors are frozen in
`review/frozen-criteria.json` before author implementation.

The current partial wrapper still has a reserved-directory write loop without
verified short-write handling, flush/fsync, complete readback or final membership.
The canonical writer allocates its own directory and deletes owned partial
files on failure, so it cannot silently substitute for this preservation flow.
The author has proposed a narrow reserved-slot writer with explicit inert ports;
root allocation is pending. Review will require actual composition, bounded
ownership, preserved failures and the original cooperative deadline.

New private serialization derivatives must not become original byte identities.
The truncated candidate hash record is incomplete. The reported42,321-byte
prior full-audit reference names `source-and-input-verification.json`; it is not
automatically the missing `originals/source-verification.json` or full prior
preservation manifest. A supplied Git path does not supply its hash/size or
provenance. All original negative identity/timestamp flags remain negative.

No wrapper, candidate or native diagnostic is imported or run. Only allocated
isolated definitions with inert ports may receive dynamic source checks. Private
bodies/paths stay outside Git. No filesystem/native qualification, external
watchdog, runtime publication, build, cloud/database/network/provider action,
paid call or execution authority is inferred by this review.
