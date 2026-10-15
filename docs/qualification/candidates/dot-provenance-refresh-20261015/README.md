# Contracts provenance and worker source candidate

Pinned base: `b5be44d5141ae5fd3830aed789cb7ad525506c4e`, tree `efc4b7bf87480d65fc4e6090c2a83b8e6d9dcf4d`. This is a source-only provenance refresh. No product behavior, public interface, version, dependency, schema, generator, validator source, migration, Dockerfile or independent expected outcome changed. Parent accepted e323 source only and Fable's proof candidate as a record; qualification remains open. See [coordination decisions](https://github.com/neo-capiro/meri-greenfield/blob/8bbe8405e03964072ed79be068d2d0a84cf71609/docs/coordination/reports/DOT-TO-FABLE-COMPLETION-INSTRUCTIONS-20261015.md).

The supported conversation and lifecycle generators updated only the source byte counts and SHA256 values for their existing service dependencies. `contracts-byte-identity.json` inventories all420 tracked contracts files against the pinned Git base: two metadata files changed; all418 others, including every browser bundle, declaration, schema, package version, lock, generator and test, remain byte-identical. No tarball was repacked or published.

The supported worker pin generator changes exactly the validator record's byte count and hash:3311 / `c2449fd55300b31bdc1e829b5d918a531f1c4b2c675085a5b4707726ddd36d10` becomes3606 / `bc72b4cbc240e133742350d3dcc7dcd995a426d9dc85439f1886b49aa41c0605`. The accepted source change originates at `de599e4ac5021dae34476d5b2079e0d433791395`. `worker-pin-diff.json` verifies18 other records and all fields outside the records remain unchanged. SDK0.3.295, CLI2.1.295 and the historical vendor archive stay unchanged.

`worker-candidate.json` is a new unsealed candidate, bound to exact source/lock hashes and the supported57-member context assembler's `worker-context-manifest.json`. Its enclosing Git commit supplies candidate identity. The45 runtime proof rows and four preceding manifests are inventoried and preserved byte-for-byte; source-proof tests and their expected values were not edited. No prior candidate or historical receipt was rewritten. Context assembly is not a build, target-profile qualification, image scan or admission.

## Checks actually run

Windows local tooling: Node24.19.0, npm11.17.0, Python3.11.15. Contracts dependencies installed with `npm ci --prefix packages/contracts --ignore-scripts --no-audit --no-fund` in this isolated worktree. No product dependency or lock changes.

| Command | Result |
| --- | --- |
| `node packages/contracts/generate-conversations.mjs` and `node packages/contracts/generate-lifecycle.mjs` | PASS; only two metadata diffs |
| `npm --prefix packages/contracts run check` | Generated checks PASS, TypeScript PASS; public tests139/145 PASS,6 FAIL |
| `python -B scripts/qualification/worker_source_pins.py --write` then `--check` | PASS;19 records |
| `python -B -m unittest discover -s scripts/qualification -p worker_source_pins_test.py` | Initial attempt ERROR in sandbox default Temp setup/cleanup |
| Same unchanged four pin tests using task-owned `tempfile.tempdir` |3 PASS,1 ERROR: Windows symlink privilege unavailable |
| `python -B scripts/qualification/worker_context.py --output <fresh-task-owned-directory>` | PASS;57 members,1036503 total source bytes |
| `node --test --test-isolation=none --test-concurrency=1 scripts/qualification/assembled-image/source-proof.test.mjs` | PASS5/5 |
| Source inventory/semantic comparison and `git diff --check` | PASS |
| Independent read-only source review | ACCEPT: two metadata diffs, all420 contracts records verified, worker record scope verified |

Five public-package failures construct invalid Windows paths such as `C:\C:\...` from URL pathnames, affecting browser/CLI harness checks. The sixth is the unchanged redirect test's sandbox-denied localhost connection (`EACCES`). Both the tests and the exercised generated product bytes are identical to the base; this slice does not fix those platform/environment issues. The first full contracts check had the same six failures; the repeated run retained here captures the output. The second pin-test run changed only the temporary directory to recover from the first setup failure; no test assertion was weakened, skipped or relabelled. Run the unchanged public/browser and symlink tests in the supported Linux qualification environment before claiming a full pass.

Logs in this directory are scrubbed copies; raw local receipts remain outside Git. Scrubbing replaces workstation paths, sandbox identifiers and user paths, retaining error types, test assertions, counts and exit evidence. Final clean-source verification and its source identity are recorded separately in `clean-source-checks.json` when available.

## Integration and remaining gates

Integrate the two separate provenance commits after independent review onto the exact base or verify all source hashes anew on a newer Fable branch. Regenerate through the supported generators if those source dependencies changed; never copy stale provenance or alter independent assertions to match new behavior. Existing historical evidence continues to describe its original bytes.

Source-only ACCEPT does not admit an image. Linux/target Python wheel imports, native artifact behavior, actual Docker COPY closure, immutable Node24 digest, full scan with zero High/Critical findings, source/image seal and original W00–W11/REL/RG live gates remain shipping-owned and UNRUN here. Product authority, PostgreSQL, Temporal, capability issuer, model budget, TLS/hosts permission and preview bindings remain required. No provider/model call, credential, AWS, database, container build, migration or trust/hosts operation occurred in this slice.

Central allocation audit is a separate coordination result. This source owner did not reserve or edit product0009/0010 or artifact0002 and did not execute SQL.
