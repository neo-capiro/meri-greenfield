# Exact Prisma 5.4.2 engines available as retained DATA

The Debian OpenSSL 3 query and schema engines for commit `ac9d7041ed77bcc8a8dbd2ab6616b39013829574` are already present in the retained OCI CAS. This closes acquisition of that native pair as DATA, subject to owner review. It does not establish successful generation, executable compatibility, native authentication, or G1 admission. No engine, Node, Prisma CLI, package installation, application import, generator, database, AWS operation, or provider call ran in this session.

The dedicated worktree is `C:/dev/main/meri-greenfield-worktrees/g1-prisma-engine-acquisition-data`, branch `task/prisma-engine-acquisition-data`, based on `cf0b91618582ce5beb3b04f24a6faa396cb0c13f`. AGENTS and implementation standards were read, and an ignored proportional outline preceded DATA work. This report is the only tracked change. The Linux community assembly worktree and all prior operational packs remained untouched.

## Reusable exact assets

Inventory: `C:/dev/main/meri-greenfield-worktrees/g1-proxy-abi-v2-execution-preparation/.task-inputs/oci-abi-profile-v2-execution-1/abi-inventory/abi-inventory.json`, 196697 bytes, SHA-256 `8adf37f71af5df2c77525404416225faf96352e5913ddf73aea18122e22c8c66`.

The CAS directory is the adjacent `objects/`. Each filename is its full SHA-256. I independently read and hashed both regular files, verified their recorded lengths, and compared the matching retained uncompressed checksum text byte for byte:

| Image member, below `opt/prisma/.cache/prisma/master/ac9d7041ed77bcc8a8dbd2ab6616b39013829574/debian-openssl-3.0.x/` | Bytes | CAS filename / SHA-256 |
| --- | ---: | --- |
| `query-engine` | 17568600 | `ceb43f7d85a862ce26c707534076094118040c834f2331025253c18079410626` |
| `schema-engine` | 20263736 | `75b9d65536770c48da858d2f563b5b0bf8274faa07366c78dc5c5a8bbf260f02` |

Both engines also appear under `opt/prisma/binaries/node_modules/@prisma/engines/` with the `-debian-openssl-3.0.x` suffix and identical byte hashes. Inventory layer index is 22. Each binary contains the expected commit string as DATA; this is not an executed version check.

The two `.sha256` members contain exactly the respective engine hashes, with no newline. Their CAS hashes are `82a00d24c1c6934cc89e0ddeba1cc055adb0b4c12e335e7f3ed01e6d0dca4b61` and `482985869142140c4440ce32ed4eb7d284b044cb61022d8b6af0f41695d95cfc`. Retained `.gz.sha256` text is `67f5accb19ac4f5c7ed7bf4cbbaae1131e8b457791d0d72df8bfa2f8b9b23a18` for query and `18d348d986b4e6d0682a5af00d8f1f7cd1380f110fe274bb8e773a78ed6cb40a` for schema. Those compressed payloads were not acquired or reconstructed here; these are retained checksum observations only.

The retained `@prisma/engines/package.json` is 1098 bytes, SHA-256 `bca65ba5fe4f280d2480d4906e2b26153864bf4464d61e0851ee517183927870`, version 5.4.2, Apache-2.0, with engines-version `5.4.1-2.ac9d7041ed77bcc8a8dbd2ab6616b39013829574`. Its Apache license is 11357 bytes, SHA-256 `c71d239df91726fc519c6eb72d318ec65820627232b2f796219e87dcf35d0ab4`; the Prisma CLI license has identical bytes. This narrowly identifies the selected community package assets; it does not adopt the full upstream image or enterprise code.

## Independent package/source continuity

Two existing author archives were read without extraction or execution. Each matched its retained npm `dist.integrity` SHA-512 exactly:

- `prisma-5.4.2.tgz`: 4384672 bytes, SHA-256 `98887eb4ad12c4ef8fb89adf5c4c939efcf7d62bb85d462af824fe9a59292359`, 86 members.
- `prisma-engines-5.4.2.tgz`: 869879 bytes, SHA-256 `58d4bc97c42ef227781be04bd8d64c413949664b339c519d1515aec73fc4dd05`, 10 members.

The CLI archive's `package/build/index.js` is 5313425 bytes, SHA-256 `436b50dff9395975439cfd017420c9693ae058f6fc5a412d584bca1ec9d6f127`, exactly the retained OCI member. Both package JSON and license members also match their OCI CAS hashes. The engines archive is a downloader/wrapper package, not a substitute acquisition of the missing engine platforms.

Primary Prisma 5.4.2 source confirms a supported cache at `~/.cache/prisma/master/<commit>/<target>`: matching cached file and `.sha256` are checked before downloading; exact non-latest commit paths are reusable. Supplying the retained pair and sidecars in an owned Linux build cache is therefore a concrete next preparation route, with network denied during separately admitted generation. Do not enable a missing-checksum waiver. The same version supports an explicit engines mirror, but this session does not adopt an alternate host. [Pinned download source](https://raw.githubusercontent.com/prisma/prisma/5.4.2/packages/fetch-engine/src/download.ts), [cache and mirror routing](https://raw.githubusercontent.com/prisma/prisma/5.4.2/packages/fetch-engine/src/utils.ts).

Three raw primary source files and the exact engine-commit GitHub tree were fetched as bounded public DATA, each under 2 MiB, 20-second timeout, no retries. Raw responses and receipts are retained under `primary/`. The 5.4.2 tag URLs are recorded with measured raw hashes; the engine tree URL names the exact commit. Two earlier guessed CI source URLs returned 404 in the web transcript only; they were not engine requests and have no local raw response capture.

## HTTP failure and remaining generation boundary

The author's seven retained checksum-request error bodies are all 17 bytes containing `error code: 1010` followed by LF, SHA-256 `2938e9f1284180959e33ab1718d0793a72ff6e4cdb8108c34dcd14e69446de5c`. The acquisition source requests a `.gz.sha256` before the compressed engine, so these failures do not demonstrate a failed engine-body download. The eighth failure is only the author's earlier traceback; its manifest explicitly says no body was retained and it was not retried. This session did not repeat those URLs. The literal error does not establish a removed release, an absent artifact, or a definitive origin-versus-gateway cause; retained response headers are insufficient for that attribution.

The unchanged PostgreSQL schema is 74271 bytes, SHA-256 `dbb02f20858ed397ea83b0dfabe2d3cfe59ef658976fdcde373c5baad33df387`, and declares native, Debian OpenSSL 1.1, Debian OpenSSL 3, musl, and musl OpenSSL 3 targets. Python Prisma 0.11.0's retained generator asks for queryEngine and warns about multiple binary targets. These facts do not prove whether generation needs every target in this exact build. Debian 1.1 and both musl engine families were not found in this selected inventory; that is not an exhaustive absence proof for the full image. No schema change, version change, cross-platform relabeling, or single-engine override pretending to satisfy multiple targets is authorized by this handoff. The owner must measure actual offline generation with the unchanged schema and retain any missing-target refusal.

## Finite evidence and limits

Ignored evidence root: `.task-inputs/prisma-engine-acquisition-1/`. `retained-results.json` binds 10 measured CAS rows. `data-reconciliation.json` binds 22 exact DATA copies, 12 protected engine/package references, both complete archive member inventories, and all seven retained error bodies. Inputs were rehashed after inspection; no protected byte changed. `FINAL-MANIFEST.json` additionally binds the helpers, outline, primary raw receipts, current report, runtime executable, and raw Git report readback.

Only bounded Git, PowerShell reads and isolated Python stdlib DATA helpers ran. There were no product tests or executable compatibility tests. File identity observations assume the trusted local checkout/filesystem and do not provide hostile-filesystem isolation or signed upstream release attestation. Actual Linux generation, ABI/loading, Prisma PostgreSQL connectivity, native proxy authentication, TLS/Fargate deployment, global accounting and G1 remain open.
