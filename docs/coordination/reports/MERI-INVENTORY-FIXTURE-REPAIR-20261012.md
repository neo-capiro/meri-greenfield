# Inventory fixture repair — 12 October 2026

**Author source candidate ready for independent review.** The repeated-scan test
now creates its excluded result file before the first scan. All 25 original tests
pass, and one appended directory-size regression passes. Production inventory
code, original assertions/negative controls and shared pins remain unchanged.
No image, security, licensing or runtime gate is accepted by these local checks.

Base: `690bac4cd44112b161d8e02818aeae7639ce237a`. Isolated author branch
`task/meri-inventory-fixture-repair-20261012`; worktree
`/workspace/meri-inventory-fixture-repair-20261012`. The separate reviewer owns
acceptance. The implementation outline was recorded before editing in the matching
coordination task. Relevant AGENTS/standards, R2 and prior independent PR13
inventory diagnosis were read; no applicable repository skill files were present.

## Cause and narrow repair

The original test compared complete entries from two scans, but its first
`emit` created `inventory-result.json` inside the scanned root. Excluding this
file from inventory does not erase the parent directory's own metadata change.
The fresh author baseline reproduces **24 pass / 1 fail**, with the compared root
size changing from80 to100. This agrees with the preserved independent diagnosis;
the raw baseline is retained without normalization.

Three setup lines were inserted into that one existing test: two explanatory
comments and `write(dir, 'inventory-result.json', '{}')`. Setup finishes before
both captures. Both `scan` calls, the original unnormalized `deepEqual`, candidate
hash checks and coverage assertion are unchanged. No generic fixture helper,
production traversal, emission, identity, roots, limits or allowlist changed.
Removing those three added lines from the original-test portion reproduces the
entire original file byte-for-byte. The exact original file is archived beside
the fresh failing output.

The appended test uses the existing fabricated POSIX fixture to keep all facts
except directory size constant. A stable root/child retains sizes128/4096 and
complete coverage. Changing the child's size to8192 immediately before descent
returns code1, incomplete coverage and an explicit directory-identity error.
The manifest retains the already captured sizes. This tests size preservation
and fail-closed mutation detection without relying on a filesystem's choice of
directory allocation size.

A separate negative control copies the candidate test and production probe to
an owned temporary directory, replaces only the size field in `_identity` with
zero, and runs the new test. It fails at `0 !== 1`, as required. The intentionally
bad copy and raw failed child output are hash-bound; the temporary copy is removed.
The real production probe is never edited. No production algorithm was copied
into the test, and no directory-size assertion was dropped to obtain a pass.

## Checks and preserved outcomes

All commands, source diff hashes, stdout/stderr, exit codes, timeout flags and
owned group receipts are under
`docs/qualification/candidates/inventory-fixture-repair-20261012/author/`.

| Check | Result |
| --- | --- |
| Fresh unchanged original inventory suite | **24 pass / 1 fail**, exit1; expected diagnosed fixture failure retained |
| Repaired complete inventory suite | **26/26 pass**, exit0; zero skipped |
| Preservation and isolated mutation controls | PASS; original25 bodies recover byte-for-byte after removing setup insertion; production byte-identical; size-blind mutant child exit1 as expected |
| Existing canonical worker-context suite | **17/17 pass**, exit0 |
| Two canonical source-context assemblies and verification | PASS; manifests byte-identical,53 members,996,428 bytes; temporary assembled directories removed |
| Final scope/receipt/hash/whitespace checks | PASS; only the allocated existing test and new owned documentation/evidence changed |

No dependency installation was needed. Product-wide tests were not rerun because
no production module, dependency or public contract changed. Image build/push,
installed inventory, SDK/browser/renderer execution, package solving, actual
security/runtime qualification and paid/cloud/provider/model work are **unrun**.
The prior collector-context mismatch and Windows runtime guard remain unchanged;
this repair does not convert either into a pass.

## Exact identity proposal for the shared-pin owner

The sole existing-file change is
`apps/worker/qualification/probes/image-inventory.test.mjs`:

- Original:25,547 bytes, SHA256 `6f43c0d24e97f766aa588b6773dd6a3399074b35e6ad226e47e73adde27627e7`.
- Repaired:27,407 bytes, SHA256 `845473b633ded89e8c94d1fe59637cee87418a7c0a2cdc3d2fe131971961b1b3`.
- Production `image-inventory.py` remains SHA256 `c7d682e67b5b3064947c92bebdce785aa04c3e00238fc8fb769d4a828479de58`.
- Unchanged canonical assembler SHA256 `48f065d0ad61f98ba571c89dcd62141e6f8c9b272f0d371331d74a0dabf87851`.
- New source-only context manifest SHA256 `0f9cc23fb20d3d292fc5f2759a570ec5b022a5b9068d17ac545251803f73e903`.

`worker_context.py` already includes this test as
`probes/image-inventory.test.mjs`; `worker_image_build.py` also includes the source
path in its reviewed closure. The collector still expects historical context
`18836912a03fc035d69c0cfc57d1f407e5c46af1bdd37c21a761f5d42dc84dda`
and assembler
`67c1cf554e80c62eeb56b6dcb9be00106adf9b1b8b40beba85249de662b835eb`.
No component packaging record for this specific test was found; changing unrelated
packaging hashes is not justified by this repair.

Root must separately review the integrated test/context identity and exact
assembler/build-helper/collector/runner closure, preserve historical identity
assertions, and bind any new authorized source target through its approved flow.
This packet's manifest applies only to the stated base plus fixture repair.
Other packaging changes require fresh canonical measurement; the recorded hash
must not be blindly installed as the later integrated context pin. No shared
component metadata, collector constants, authority/runner guards or packaging
pin files were edited here.

## Preservation and cleanup

The matching task, original test archive, raw24/1 failure, repaired26/26 output,
negative-control failure, context17/17 output, both context manifests, scripts
and exact source/hash records are retained. Every captured process completed
within the120-second bound, all owned process groups are absent, and no group
kill or timeout was required. Temporary original/repaired test roots, mutant
copies and assembled contexts were removed by scoped cleanup. No other owner's
worktree, branch, evidence or process was stopped or modified.

`manifest.json` hashes the complete author packet plus the task, report and
candidate test. It excludes itself. Independent acceptance remains a separate
reviewer's decision; G1 and all image/runtime holds remain in force.
