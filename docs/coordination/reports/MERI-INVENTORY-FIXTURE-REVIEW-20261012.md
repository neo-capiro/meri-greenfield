# Independent inventory fixture repair review — 12 October 2026

**ACCEPT_SOURCE** for author commit `0ea9b778c983108f664455e7fc4e195a0a33148a`, tree `212590b14e9b737e3ca27dfba5f80530898e604b`, against base `690bac4cd44112b161d8e02818aeae7639ce237a`. Acceptance covers the fixture repair only. Source packaging guards and all image/runtime gates remain separately unqualified.

Reviewer: Codex `/root/memory_reviewer`; isolated branch `review/meri-inventory-fixture-20261012`. Behavior criteria were frozen at `2435e40` before the author freeze. Baseline failure and independent controls were preserved at `ffd0c6a`. Review receipts, commands and raw outputs are under `docs/qualification/candidates/inventory-fixture-repair-20261012/review/`.

The original suite independently reproduces **24 pass / 1 fail**. Its first capture sees the synthetic root directory at size80; emission creates the excluded output's directory entry, so the second capture sees size100. The deterministic comparison is correctly detecting changed fixture metadata. The author adds two explanatory comments and creates the excluded output during setup, before either capture, then appends a size-only directory-mutation regression. The original unnormalized deep equality stays intact. No output-induced membership change now occurs between those captures.

Removing exactly those three setup lines and the appended test recovers the entire original 25,547-byte test source. All 25 original test names, bodies, assertions and negative controls remain present. Only the existing test file changes; production `image-inventory.py` remains exactly 17,978 bytes, SHA256 `c7d682e67b5b3064947c92bebdce785aa04c3e00238fc8fb769d4a828479de58`. The repaired test is 27,407 bytes, SHA256 `845473b633ded89e8c94d1fe59637cee87418a7c0a2cdc3d2fe131971961b1b3`.

## Independent checks

- Original and appended inventory tests: **26/26 passed** against the exact author freeze. Existing hash, replacement, short-read, deadline, root/output, coverage, alias, ancestor, privilege, ownership, mode and membership controls remain effective.
- Existing worker context tests: **17/17 passed**.
- Independent actual-filesystem controls: **12/12 passed**. They reproduce the initial output-induced size drift, verify stable preexisting-output captures and actual root size, observe same-length content/hash changes, added/removed membership and symlink target changes, refuse a real mutation during traversal, and verify temporary-root cleanup.
- An independent isolated mutant that removes `st_size` from the production identity tuple is rejected by the new regression (expected exit1). The production probe was never edited. The temporary mutant was removed.
- The original fixture's cleanup helper also removes its temporary tree when the callback throws an assertion.
- The current source-context guard fails both before and after the repair. This is retained as a pre-existing packaging mismatch, not a fixture regression or a passed gate.

The first whitespace check flagged two trailing-space lines emitted by Node's failed assertion. The raw output is preserved byte-for-byte; directory-local attributes prevent normalization of stdout/stderr evidence. No assertion or source was changed to address that formatting observation.

## Packaging and source-binding consequences

The test is already one of `scripts/qualification/worker_context.py`'s canonical members and is copied to `/opt/meri-worker/probes/image-inventory.test.mjs`. Membership does not change. Independently generated repaired context has **53 members / 996,428 source bytes**; its 11,180-byte canonical manifest hashes to `0f9cc23fb20d3d292fc5f2759a570ec5b022a5b9068d17ac545251803f73e903`. The reviewed assembler itself remains unchanged at SHA256 `48f065d0ad61f98ba571c89dcd62141e6f8c9b272f0d371331d74a0dabf87851`.

| Surface | Required disposition |
| --- | --- |
| `worker_context.py` membership and assembler | No source edit is needed for this fixture. Regenerate the canonical context manifest from the final accepted source. |
| `component-pins.json` / `probes/static.test.mjs` | Neither contains a direct inventory-test byte/hash record. Their existing packaging rows and assertions need no change solely for this fixture edit. Both remain byte-identical. |
| `worker_image_collect.py` | Current `CONTEXT_SHA` remains historical `18836912a03fc035d69c0cfc57d1f407e5c46af1bdd37c21a761f5d42dc84dda`; `ASSEMBLER_SHA` remains historical `67c1cf554e80c62eeb56b6dcb9be00106adf9b1b8b40beba85249de662b835eb`. A separately reviewed source-guard change must bind the accepted current source. |
| `worker_image_build.py` / `test_worker_image_build.py` | Build preparation compares the regenerated manifest against the collector constant. The dynamic guard test must pass after rebinding; the literal expected context/assembler identities need explicit current-versus-historical treatment while preserving caller/Python identity and all refusal controls. |
| Fresh input/source archive/image receipts | Regenerate exact test, collector and aggregate source records from the final reviewed commit. No old source/archive/image or execution approval transfers to changed bytes. |
| Existing publication/context evidence | Preserve historical files, including the old test fingerprint and context manifests. Add new receipts rather than rewriting those records. |

At the unchanged base, the independently computed context was already `94216667decf5e4feed05914b3f295148d9437ee1c00b224ca4e92625b5b876f`, which did not match the collector's historical constant. The repaired test changes the expected current context again. Both failing guard outputs are retained. No shared pin was edited in this review.

No package installation, image/native binary execution, cloud/provider/paid-model action, customer-data access or frontend work occurred. Live image/runtime checks and the broader SDK-dependent static suite were unrun; this fixture change does not qualify either. Owned bounded checks completed, fixture/mutant directories were removed, and no background process requires teardown. Other owners' processes and original branches remain preserved.
