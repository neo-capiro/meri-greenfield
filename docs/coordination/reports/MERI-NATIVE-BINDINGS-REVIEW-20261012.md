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

## First independent writer checkpoint

The exact saved writer draft passes150 independent inert assertions. An added
return-time control reproduces150PASS/1FAIL: two final clock samples permit
`readbackAndMembershipMatched:true` alongside `remainingTotalSeconds:0` when time
crosses the cutoff between samples. `first-writer-draft.py.txt` and
`final-clock-before.*` retain the exercised bytes and raw failure. The author
has been asked to derive both fields from one final time observation; this
cannot establish a hard runtime limit. The original150 assertions remain.

The two newly received private records are now independently size/hash verified;
metadata-only intake receipts preserve their exact identities. The provenance
record confirms the known collector receipt reference but does not supply its
original bytes. It explicitly did not repeat the full1,538-file audit; its
different42,321-byte audit reference and weaker tracked-status command cannot
replace the required source verification, full preservation manifest or original
untracked/submodule checks. No missing pin was populated.
