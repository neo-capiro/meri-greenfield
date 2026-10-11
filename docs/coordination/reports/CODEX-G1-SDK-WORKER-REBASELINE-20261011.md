# G1 SDK worker image source rebaseline

**Decision: ACCEPT source guard repair; image build and G1 HOLD.** Dedicated
branch `task/sdk-worker-rebaseline-20261011` starts at backend draft PR #3
head `1eac54274223729d69a0d44456a3f090dc1a0b80`. Shared Capiro policy
was verified at `b32b4803933760dc0a93fffdcd8fba30a89c3aac`; the local
machine map is dated 2026-09-30 00:21:48 UTC.

The image builder's stable-source reference `5192c575...` predates the
reviewed private wire decoder at `f118ff55dfb96ba4b44099953e6c9724064b723d`.
Direct Git blob comparison found exactly two changed stable members:
`packages/contracts/qualification-sdk/wire.mjs` and
`packages/contracts/test/sdk-fixture-wire.test.mjs`. The decoder's own Codex
review accepted private source only, and that commit is an ancestor of PR #3.
The builder now pins that exact decoder commit as its stable reference. No
member was exempted from the byte equality guard, and no image content or
archive rule was changed.

Pinned Python 3.12.14 offline builder checks passed **28/28** (exit 0).
The builder's exact Git baseline check passed for all **46** source/collector
members at `1eac54274223729d69a0d44456a3f090dc1a0b80` (exit 0).
`git diff --check` passed. The original baseline refusal and exact two-path
drift were retained in the task transcript; they were not treated as an image
failure. No source ZIP, build request, AWS mutation, Docker image, SDK task,
provider call or release action occurred.

An actual image build still requires a fresh full builder authority capture,
exact committed source archive, independent root review and specific approval
for the one external build. Build success would not by itself admit the image
or close the two-task SDK G1 gate.
