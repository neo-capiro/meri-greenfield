# First-chat profile operation selection successor

Source branch: `codex/meri-profile-selection-v03-20261018`, based on Meri
memory PR172 `432006eb2b1d87af8c73e11d4222be2a5930952b`. Shipping
coordination is recorded in [PR121 comment 6252783362](https://github.com/neo-capiro/meri-greenfield/pull/121#issuecomment-6252783362).
The three first-chat preview JSON files were byte-identical to PR171
`d117a7d4d6de94f25943d54c0b15d82c891b9b96` and the separate receiving
tree `f4cf0385471d9c57fbe7c537e3f352a0378ece24` before this patch.

The bespoke first-chat allocation still selects one allowed and scheduled
operation with a 1 µUSD charge. Its only operation ref changes from
`get_client_context@0.2.0` to `get_client_context@0.3.0`, the sole profile
version in the current catalog. The allocation's catalog pin, schedule
revision, policy allocation pin, and runtime allocation/policy mirrors follow
that exact successor. The preview limits, model envelope, source requirement,
rubric, approval rules, and disabled tool posture remain as before. No existing
run or installed allocation is migrated by this source patch.

| Source-only pin | Value |
| --- | --- |
| Catalog `0.2.16` canonical SHA-256 | `58673ff38658c07e608ad209f007c4c6e30b9ee06a04c0f52afa97ac222bca9c` |
| Schedule revision, `canonicalSha256(operations)` | `69b3b88a730c8e759202d67fb1ef484746d2a38edee6ff46b968f88e990c3c77` |
| Allocation SHA-256 | `ac6ac7e4ea3815767a6545b64e3550d0c0e2943327b99ca79eef8829aba5ccb4` |
| Policy revision, `canonicalSha256(policy.json)` | `79936353b071ddfcc9e02477163f191f7dcdb1a1419f4769b860c9e709dfbf2f` |
| Current source skills digest | `40e6270e9394ebcd86c60ee06f3689d5069ebc04dde0d7b60ece63fd63ce55fa` |
| Full P2 source inventory, 76 operations | `eb7f0cd742728ac15c7f01f5bc7d01c42158120406ad8557986061fce3670660` |
| Source SDK option-template projection for the new policy | `af7f07b8f784884eae32e14e0b697d434d1668b0d68f55d203bf873c7af5431b` |

The active immutable Client Changes asset is `1.0.1` with a broader source
set, rubric, and different budgets. This preview allocation is a bespoke
`1.0.0`-labeled manifest with its original single source and preview limits;
its identity and prose pins are left unchanged to avoid falsely claiming the
full `1.0.1` asset. That pre-existing preview/asset identity difference needs
a separate product owner decision if selection must match an immutable asset.

`runtime-values.json` now mirrors the proposed allocation and policy revision,
but its `versions.skillsDigest`, executable, runner, and SDK option pins came
from an older N21 image measurement. The current source skills digest above
differs from the retained N21 value
`9b1b763df5f24bb54664251a1aa387c07a61439681371f54d1475614abf95191`.
No image-derived field or `launch-measurement-receipt.json` was regenerated.
The JSON is a **source-prepared, nonqualifying candidate** until shipping
obtains a fresh in-image receipt for this exact allocation, policy and source
closure, and completes the normal config/image/readback gates. No AWS, SQL,
credential, model or deployment action was performed.

Focused checks: `parseAllocationFile` admitted the updated source allocation
and confirmed the runtime mirror; the source skills and full P2 measurements
above were recomputed; the source SDK template was projected locally; and
`MERI_REVIEW_SOURCE_ROOT=<this worktree> node --test
infra/product-preview/first-chat/runtime-values.test.mjs` passed 7/7 using
its synthetic Linux/throwaway PKI fixture. Those tests do not qualify the N21
image or enable the Core profile receiver.
