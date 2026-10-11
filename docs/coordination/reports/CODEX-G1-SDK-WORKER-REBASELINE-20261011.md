# G1 SDK worker image source rebaseline

**Decision: ACCEPT source guard repair; failed build retained, image and G1 HOLD.** Dedicated
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

## Subsequent local one-build preparation

At committed source `a02c5d4193d465c9b47acef632ea08ebfec599a3`, the
baseline recheck passed all 46 members. The source context assembled 44 members
and 884,347 bytes; its manifest SHA-256 is
`18836912a03fc035d69c0cfc57d1f407e5c46af1bdd37c21a761f5d42dc84dda`.
Fresh read-only `user/hermes-cli` captures found the fixed CodeBuild project,
builder role trust/inline policy, enabled KMS key and all 17 prior builds
terminal. The builder prepared a local 48-entry source ZIP, 941,462 bytes,
SHA-256 `cc17787a6baaae249c86ff998aabf68d00d498ad25c463870f7ebf705e495c10`.
Request SHA-256 is `5e6f94eddc73192a3a4ce1c79c7931e14d8b5fc635f54eb14846b6b8c345b575`;
the exact internal root-review SHA-256 is
`811ff83df57a769a6c0789c656ebb61202844bbe449de7e7deae3a329211dad1`.
The private raw captures, ZIP and request remain ignored under
`.task-inputs/sdk-builder-authority-a02/` and
`.task-inputs/sdk-worker-image-build-a02-20261011/`. The authority timestamp
is 17:29:05 UTC and the executable freshness guard expires after 600 seconds;
an expiry requires a new local request/review, not an unguarded dispatch.
This preparation was followed by a separate, explicitly approved single build.

## Consumed one-build result and local preflight repair

The approved build `meri-greenfield-qualification-build:6092fa3d-9509-45b3-aee7-4a304df2e125`
used S3 source version `LQshlbWzKMKz_9oU2is4tkmpQiCakeos` and ended **FAILED**.
The CodeBuild BUILD phase ran the fixed collector and returned exit 2;
POST_BUILD successfully uploaded a 3,854-byte bounded evidence archive at
`results/sdk-worker-image-aa7de84e-b479-4964-a803-730d852b5445/evidence.tar.gz`,
version `bNusf0E3cvPHdTfj7Pjmb.M0yvMQLpRw`. Its returned full-object SHA-256
checksum is `3pRgSjJIXO2wDWU363OiBRXcB9EJQMYvxV91Etdu0vI=`. The archive's
capture manifest is complete. It records successful 44-member source assembly
at 884,347 bytes, then no Docker build attempt or collector result. The
collector compared that assembled manifest against its obsolete pinned SHA-256
`e89bda8fa60fa2d950bcb9bb9177841e177f458131d4e5a66e8a9a17a1762940`;
the exact candidate manifest had SHA-256
`18836912a03fc035d69c0cfc57d1f407e5c46af1bdd37c21a761f5d42dc84dda`.
The comparison immediately precedes the collector's Docker work. ECR
`describe-images` found no image with the source commit tag. The consumed run
must not be retried.

The collector now pins the exact candidate context hash. The local builder
independently predicts the assembler's canonical manifest from candidate Git
bytes and refuses both prepare and load if that hash differs. A focused test
proves the current context pin and rejects a one-byte source change. The
offline builder suite passes **29/29**, and `git diff --check` passes. This
source-only fix has no new AWS write, image, ECS task, provider call or G1
acceptance. Another build requires a separate fresh reviewed request and
approval for that exact source commit.
