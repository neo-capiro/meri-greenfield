# SDK public-package assembly source

Outline recorded before implementation. Base `1ea207d518266b97750fbe5dc7529dbb4a010f4b`; dedicated `task/g1-sdk-public-package-assembly` worktree. Own exactly worker package.json/package-lock.json/Dockerfile/.dockerignore/component-pins.json/probes/static.test.mjs, the new exact vendor/capiro-meri-contracts-0.1.0.tgz and this report. Canonical contracts remains the backend public package; this source only copies its already-reviewed archive. Add one local-file dependency with ordinary script-disabled lockfile generation, preserve the seven existing exact direct pins and old lock records, copy/size/hash-check the sole archive before the existing npm ci, and record truthful package provenance. Extend existing static alignment tests plus archive/hash/lock/build-context checks. No package installation, Docker/image/native/SDK/provider/cloud execution or admission. Source hashes and license metadata are not security or authorization proof.

Codex source implementation CLOSED for independent review. **91/91 canonical offline static checks passed once; no image was built or admitted.**

## Package and build boundary

`@capiro/meri-contracts` is now declared as the sole local-file dependency, `file:vendor/capiro-meri-contracts-0.1.0.tgz`. The already packed archive was copied as an ordinary regular file after checking its size, SHA256 and SHA512 integrity; npm pack was not repeated. Its exact identity is:

- 48823 bytes; SHA256 `2f15ade9458cbffe960b7cc36c6fb77cb54cc2a0eca4bc7c0f918b77cfacd4ee`.
- Integrity `sha512-gsJpKHbwliWB2jVP1jVoaH+t9RNrIC334+VkU3hYN7MrkCF7INS9YES+prCSD7SfVn7gIsp7eTwM1kCHwfQ3EA==`.
- Version `0.1.0`, license metadata `UNLICENSED`, source commit `8586f6279eac5a43132d4df3a7dbb6962c808009`.
- All eleven regular archive members independently equal the canonical backend public-package raw Git bytes; total unpacked size 536413 bytes. The public `/node` export remains `./validate.mjs` with its bundled schema. No canonical contract, export, generator or validator was changed.

Docker receives only this exact archive through an explicit COPY inside the existing qualification build context. Before the original single `npm ci --no-audit --no-fund --include=optional`, its RUN block requires a regular non-symlink file, exact 48823-byte size and successful `sha256sum --check --strict`. The checksum pipeline's final command is the checker and `set -e` makes rejection fail the build. The existing SDK optional-binary installation/verification remains unchanged. `.dockerignore` adds only `!vendor/` and `!vendor/capiro-meri-contracts-0.1.0.tgz` beneath its default `**` deny rule. There are no parent-repository COPY paths, additional build contexts, wildcard vendor copies or runtime package resolver.

`component-pins.json` adds one versioned npm provenance record with the file specifier, archive size/hash/integrity/member count, source commit, license metadata and public export. All older records/history remain unchanged. Its old image evidence is historical and does not admit this new recipe. The unassembled candidate digest remains null; this task neither changes nor clears existing security findings.

## Exact differential dependency closure

The seven original direct pins remain exact: Claude Agent SDK 0.3.295 / CLI 2.1.295, MCP SDK 1.32.1, Playwright MCP 0.0.83, Playwright and core 1.64.0-alpha-1790635538000, pdfjs-dist 6.4.299 and pptxgenjs 4.0.1. The existing browser/Office/OS/Python pins and all probe source bodies outside the allocated static test are unchanged.

Standard npm 11.17.0 generated the lockfile using Node 24.19.0 and `install --package-lock-only --ignore-scripts --no-audit --no-fund --include=optional`, with distinct empty user/global npm configs, an owned cache, notifier disabled, replacement environment without ambient credentials/proxy/preload variables, zero fetch retries and a 120-second direct-child bound. No node_modules directory or package installation was created by either lock operation.

The first `--offline` attempt exited 1 in 3.125 seconds with `ENOTCACHED` for canonicalize metadata. Its original lockfile, binary streams, cache log and envelope remain. The subsequent authorized public-metadata-only attempt exited 0 in 1.828 seconds, stderr empty. Its retained npm log records exactly one GET 200 to `https://registry.npmjs.org/canonicalize`; no package tarball download, lifecycle invocation or audit request is recorded. The response's 43092 raw bytes have SHA256 `af029530f6711dbd21f5eb2446c4c9d1753087edcc74ea28789e7405311dc1f4`. The selected 5.1.0 release metadata agrees with the new lock integrity and Apache-2.0 license label. This is metadata binding, not a new full transitive license clearance or complete freeze of npm's own implementation.

All **145 original non-root lock records** are whole-object exact, including versions, integrity, optional/platform metadata and dependencies. The root record changes only the new file dependency. The two added records yield 147 non-root records (148 including root):

| Record | Exact resolution and role |
| --- | --- |
| `node_modules/@capiro/meri-contracts` | `0.1.0`, local archive above; requires Ajv 8.20.0, ajv-formats 3.0.1, canonicalize 5.1.0 |
| `node_modules/canonicalize` | `5.1.0`, `https://registry.npmjs.org/canonicalize/-/canonicalize-5.1.0.tgz`, integrity `sha512-bab9+WefZljqQ8jT0qRwVmTyzAUU63K97QIQD3agynIBrb6sa5M2eAy8Hv8K3p4V9+ONVYZKtGYl4Dg+/5Gumw==` |

Ajv 8.20.0 and ajv-formats 3.0.1 already satisfy the exact public package closure; no new nested copy or replacement of their existing transitives was required. No SDK/runtime dependency drift is hidden by version-only comparisons.

## Actual checks and retained preparation failures

One full canonical `probes/static.test.mjs` invocation passed **91 tests, 0 failures/cancelled/skipped**, `2026-10-11T02:28:30.542354Z` to `02:28:32.165251Z`; the recorded supervision interval is 1.625 seconds. This is the original 86-case suite with only the explicit local-file alignment adjustments, plus five new archive/hash/integrity, full differential lock closure, provenance, Docker ordering and context-admission checks. A DATA inverse-delta proof recovers every original assertion/body by removing exactly those additions and the required alignment literals; no old coverage was skipped or weakened.

The suite used a read-only borrowed dependency tree through one owned Windows junction targeting `C:/dev/main/meri-greenfield-worktrees/w02-image/apps/worker/qualification/node_modules`. Fixed Node ran with filesystem read permissions limited to this worktree and that target, addons/child/worker capability ungranted, and an explicit JS socket/DNS/HTTP/fetch/process denial preload. The SDK's existing in-memory SessionStore export is used by canonical offline tests; no SDK query or bundled CLI/native execution occurs. A replacement environment excludes application/provider credentials and preloads. These are source-level restrictions, not an OS sandbox.

All **4262 enumerated source/runtime/borrowed code/type/metadata records** are equal before/after. This measures the listed files, not every installed binary or a complete installed-tree security freeze. Source inventory/hashing precedes the 120-second child bound; that bound is for the child, not a whole-entry deadline. Captures are buffered with a post-completion 2 MiB limit, not a streaming memory cap or process-tree supervision claim. Raw stdout is 20309 bytes, SHA256 `a1625f59badca692b78a3bc319b4af55a5accf93c188e2834da91142265b8248`; stderr is empty. Raw streams and envelope were saved before assertions/TAP parsing; only its parsing view handles CRLF. `static-1/process.json` is 3186 bytes, SHA256 `8c00314c0c29b618ad0255f4a0f1db974b457e898d9638ad610ed087a5575a3d`. No successful suite was replayed.

The separate DATA-only delta checker first failed its retained metadata-count assertion because ordinary Windows cache paths exceeded the API's supported path length and `Path.is_file()` reported them unavailable. A fresh second checker attempted gzip handling before the path diagnosis and retained the same failure. A direct relative-path diagnostic also retained WinError 3. Their sources and Git readbacks remain; tool-transcript tracebacks are not represented as separately captured binary streams. A third version uses the explicit Windows extended path for only these known npm cache records, verifies the actual raw JSON metadata, and passes. It makes no candidate source change and does not replay the static suite. This cache handling is not a production decoder or package resolver. The owned junction was then removed with non-recursive `os.rmdir` after exact target/type validation; the borrowed dependency directory remains untouched.

`git diff --check` passes. The final DATA proof also checks all eleven archive members against canonical raw Git, all 145 original lock objects, the entire prior component metadata after removing the single added record, the old Docker body outside the exact install block, original context rules, the static inverse delta and **22 protected worker paths** against base raw Git. `source-proof-3.json` is 43850 bytes, SHA256 `f1dd88ae26c018f827efae6c5a2db70a942ce89bc343fed7adafc601bd4695e0`.

## Handoff and remaining gates

Evidence is under `C:/dev/main/meri-greenfield-worktrees/g1-sdk-public-package-assembly/.task-inputs/sdk-public-package-assembly-1/`: both lock-only attempts, retained public metadata/cache logs, copied original lock/package, single static receipt/raw streams/exact tested source snapshot, all three DATA-checker versions/readbacks and final finite manifest. The separate commit readback binds exactly the eight allocated tracked paths and a clean tree. The archive was never repacked, installed or executed here.

Root must independently review/integrate this exact source, advance the complete build/source/archive/request inventory to include the new vendor path and changed package/recipe/pins/test bytes, build a new immutable image, inspect its actual installed public-package/SDK closure and inventory, rescan and make explicit per-run risk/runtime admission decisions. Existing build helper pins, old images, consumed native fixtures, original SDK options/capture source and security holds do not advance by this commit. No discovery registration, tool search, execution permission, trusted proxy, SessionStore durability, native interruption/replacement, browser/Office qualification or G1 claim follows. Full deployment scope remains unchanged.
