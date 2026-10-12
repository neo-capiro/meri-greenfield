# Worker source guard repair — 12 October 2026

Root-authored candidate, pending independent review. The parent explicitly
authorized repair of legitimately stale source guards. Base PR13 remains
`690bac4cd44112b161d8e02818aeae7639ce237a`. The independently accepted inventory
fixture `0ea9b778c983108f664455e7fc4e195a0a33148a` is integrated first; reviewer
`703461e51e5dd191a9ef775c05bd5aae772678a6` accepted its exact source and context.

Only two collector source pins, their two expected test literals, and that
test's name change. The current 53-member context totals 996,428 bytes; its
manifest SHA256 is `0f9cc23fb20d3d292fc5f2759a570ec5b022a5b9068d17ac545251803f73e903`.
The unchanged assembler SHA256 is
`48f065d0ad61f98ba571c89dcd62141e6f8c9b272f0d371331d74a0dabf87851`.
Historical pins `18836912a03fc035d69c0cfc57d1f407e5c46af1bdd37c21a761f5d42dc84dda`
and `67c1cf554e80c62eeb56b6dcb9be00106adf9b1b8b40beba85249de662b835eb`
remain preserved in PR13 and the explicit receipt. They no longer describe
current candidate source and must not be accepted for this candidate.

The production inventory probe, assembler, package locks and all existing test
assertions except those exact source literals remain unchanged. The renamed
test distinguishes historical executable/caller identity from current source
identity; the fixed Python3.12.14 path/hash and historical principal are intact.
Fresh binding, authority, output reservation, retry and cost guards are intact.
Updating source hashes cannot authorize or execute a build.

Raw baseline and rerun evidence lives under
`docs/qualification/candidates/worker-source-guards-20261012/integration/`:

- Baseline build suite: 34 pass, one stale-context failure, one error requiring
  the fixed historical Windows executable absent on this Linux executor.
- Candidate build suite: 35 pass, zero failures, the same Windows-runtime error.
  That original check is neither skipped nor weakened; the suite still exits1.
- Inventory: 26/26 pass; context: 17/17 pass. Actual context and assembler bytes
  independently reproduce the two new literals.
- All owned process groups exited; no timeout, kill or surviving descendant.

No image build, push, launch, AWS request, native runner invocation or paid model
call occurred. Image, runner and G1 acceptance remain HOLD/OPEN. The separately
scoped independent reviewer must verify historical/tampered manifest rejection
and unchanged execution authority before integration acceptance.
