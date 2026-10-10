# Codex G1 fixed Linux OCI inventory preparation

Prepared in dedicated `g1-proxy-oci-inventory-preparation` at base `bf42f6ae0dbc4812c4894de7d19e047a64ad7f30`, after reading instructions and recording the outline. This is an actionable DATA extraction proposal, not an image, native-toolchain, community-license, Prisma/auth or G1 acceptance. No layer/executable was downloaded; no Docker/container/build, Node/npm/Prisma, native engine, database, cloud or provider action ran.

## Fixed metadata actually captured

Anonymous GHCR pull metadata completed once at 23:19:54.633713-23:19:55.216514 UTC. The fixed fetcher permits only this manifest and config, each bounded to 2 MiB with 20-second requests; it cannot fetch layers. Anonymous bearer bytes are not retained. The config's one HTTPS307 redirect to `pkg-containers.githubusercontent.com` stripped Authorization; signed redirect queries are not logged. Raw receipts retain exact byte lengths, digests, relevant headers and times.

| Object | Bytes | SHA256 |
| --- | ---: | --- |
| linux/amd64 manifest | 4,677 | `ff11074add7b1cee63759b90eb2a9e4072763e520297761ea05a911b4a5b251d` |
| config | 7,390 | `db4055eec62df7f5f23828795de317b1856275178688ce1735ca16e1b343044c` |

Both equal the original W02 proxy's retained `.runtime/downloads/ghcr-{manifest,config}-linux-amd64.json` bytes, without rerunning its owner. Config establishes Linux/amd64 metadata, source revision `fc3920bf403124ad075bc04990f999f7e0612e12`, user root, `/app` working directory, production entrypoint and the `/opt/prisma` CLI/cache environment. These metadata are not proof of actual binary compatibility or enforced isolation.

There are **23 gzip layers, 401,268,538 compressed bytes (382.68 MiB)**. Every descriptor digest, compressed length and corresponding config diff_id is frozen in `.task-inputs/oci-inventory-preparation-1/extraction-plan.json` (SHA256 `aa17a87926383a5e4ea03f5df3b8b00946941bfe24bc3ccb7e24cfb5517f1adf`). The largest compressed layer is 216,610,952 bytes. Nonempty history aligns one-to-one with all23 descriptors; useful hints are:

| Layer | Compressed bytes | History hint | Digest |
| --- | ---: | --- | --- |
| 13 | 74,035,115 | APK Node/Python/OpenSSL/native libraries | `afbc4365bb9e7c196e540e8ec042fe8c6c362319bed4fda070e60492d09d571f` |
| 16 | 216,610,952 | generated `/app/.venv` | `cd92873e7148c077ae82b482b89bc3218685c290a57e2e657c70dc955c6dedcd` |
| 18 | 15,263 | `/app/schema.prisma` | `b1ed03c8a3f9bcda820f1405a5803b763bc7e281d95e06d118c5c0b5e8f4748e` |
| 20 | 3,373,232 | enterprise implementation | `2d4dea8a84f32474be2e37b7f6ce5d7704333112f9702866d9655c8abfcc6448` |
| 21 | 4,339,098 | proxy extras | `103555e713d80769a85c29977494aba0a07fd6741254d42028da3e24aebb8bb2` |
| 22 | 93,684,446 | Prisma CLI/cache/engines | `93f3fe31ada959420c7fb03675b30f4e75d5b6aece44a8ee32d0655fa59f9add` |
| 23 | 1,528,151 | cleanup/chmod/client-path check | `a51722a6346263197243344dbebc8dc502008c2bcc185ad21507df86f3939451` |

History does not prove path membership, final overlay state, license scope or absence of later changes. All23 layers require header/whiteout inspection before final selected assets can be qualified.

## Reuse and the smallest missing implementation

Searched canonical repository scripts/build readers, root ignored Python registry helpers, original `w02-proxy`/review scratch and scoped proxy runtime downloads/extract. Existing raw image owner is root `.task-inputs/codex-g1-support-v3-registry.py`, with `codex-g1-support-v3-overlay-review.py`. Their source is snapshotted unchanged here. They verify fixed ECR browser-support blobs, small1MiB compressed/2MiB expanded layers and a fixed `meri-host-assets` tree. The overlay correction handles one specific empty opaque marker. Neither is a general Linux-image extractor and neither was imported or executed here. Its pinned ECR/AWS dispatch must not be substituted with GHCR arguments.

The same useful boundaries apply: exact raw manifest/config and blob hashes, fixed digest requests, no ambient proxy, bounded HTTPS, no native image startup. Reuse those patterns, not an unreviewed generic framework. No selected OCI layer store was located in the scoped owners; original proxy scratch contains wheels/source and metadata, not this image's layer blobs. This is not a global-filesystem absence claim.

The actual missing cohesive module is a small **offline selected-asset overlay inventory**. Proposed future owned paths are `scripts/qualification/proxy_oci_inventory.py` and `scripts/qualification/test_proxy_oci_inventory.py`, with `apply_pinned_layers(manifest, config, blob_dir, new_output, limits)`. No implementation is introduced in this report-only preparation. A separately reviewed fixed-download entrypoint in owned scratch can supply those exact23 blobs; keep downloading and offline interpretation separate so network is physically denied during interpretation.

## Exact proposed extraction constraints

Download all23 descriptors once into a fresh directory with exact compressed size/SHA256 verification. Proposed bounds: 512MiB aggregate compressed bytes, two concurrent requests, 120seconds per blob, 20seconds per socket request and 1,200seconds whole operation. Require 2GiB free disk first. Retain consumed/failed download results and never silently retry or raise limits. Existing fixed metadata can be reused by rawhash; no moving tag or latest lookup is needed. GHCR/CDN host allowlist and Authorization stripping remain explicit.

Stream gzip/tar rather than reading expanded layers into memory or writing a native rootfs. Proposed scan bounds: 2GiB expanded per layer, 4GiB aggregate expanded, 200,000 members; selected ordinary files <=128MiB each and aggregate retained bytes <=512MiB. Store compressed blobs plus selected content-addressed ordinary files only. A limit refusal is evidence requiring a new owner disposition, not permission to expand limits. Manifest cannot reveal decompressed lengths or member counts, so these are proposed ceilings, not measured guarantees.

Verify each full uncompressed tar stream against its config diff_id, including bytes not selected. Preserve paths/types/modes/owner-layer and replacements in JSON. The output is `objects/<sha256>` with inert path/link metadata, never `extractall`, chmod/chown, native symlinks or hardlinks. Normalize only POSIX leading `./` and directory trailing slash; reject absolute paths, traversal, NUL, backslash, drive/ADS notation, ambiguous normalized duplicates, sparse or unsupported selected entries. Refuse a selected binding with unresolved links, cycles or ambiguous ancestor semantics rather than materializing it.

Apply whiteouts only to preceding-layer state, with same-layer additions preserved regardless of archive ordering; handle opaque subtree removal before additions and refuse malformed/nonzero/unsupported marker encodings. Ordinary replacement and type-changing ancestors need equivalent explicit treatment. Earlier hardlink identity must not be guessed by looking up only the final path. These follow the [OCI layer specification](https://github.com/opencontainers/image-spec/blob/v1.1.1/layer.md); fixed digest/length blob retrieval follows the [distribution specification](https://github.com/opencontainers/distribution-spec/blob/v1.1.1/spec.md). Neither specification makes the proposed reader implemented or reviewed.

Selected implementation bytes: `/app/schema.prisma`, `/app/.venv/bin/prisma`, the generated `prisma/` package and `prisma-0.11.0.dist-info/`, all `/opt/prisma/`, actual Node binary/link metadata, OS/APK records and relevant libc/OpenSSL loader/library metadata. Keep generated schema/BINARY_PATHS/client/model bytes separately from upstream pristine wheel RECORD expectations because generation changes installed files. Capture relevant packaged LICENSE/NOTICE/distribution metadata; first derive actual OS package IDs from APK DATA, then freeze an exact second-stage notice/native-library member list before expanding selected output. Missing files and unresolved library/license identities remain HOLD.

Do not extract enterprise implementation for reuse. Record its path/distribution presence and license metadata separately. Exclude unrelated venv implementations, dashboard and OS executables. The entire upstream image remains outside community-only adoption. This focused Prisma extraction also does not qualify the complete Linux application dependency closure, actual engine execution, migrations, native key/auth or ASGI/TLS/peer/budget integration.

## Handoff

Evidence directory: `.task-inputs/oci-inventory-preparation-1/`, including fixed metadata fetcher, raw manifest/config, receipts,23-row plan/history, nine unchanged source/data snapshots and original-versus-current metadata equality. Final seal/report-only Git readback pins are supplied at close. Only metadata/data preparation ran; no product tests or native suites were replayed. Root must independently review the fixed plan and any future offline reader/downloader source before admitting bounded actual layer extraction. G1 remains OPEN, provider calls0 and source connectivity false.
