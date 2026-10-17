# Retained public runtime package inputs

This is a portable snapshot of exact public build inputs for the runtime-base candidate. All bytes were copied from previously retained public inputs and verified locally. No download, package installation, image build, activation, credential transfer or private-key creation occurred in this retention task.

## Exact source binding

- Lock: `infra/product-preview/runtime-packages.lock.json`, SHA-256 `5c7724e6c9837dabc3146256aa55b3dce2230d10de5a2ff7c479f519aafb3ac9`.
- Runtime base: `cgr.dev/chainguard/wolfi-base@sha256:030e45cb37187dff322bbefe9658bcaec31b824a5d523380771a64864c9f45d4`.
- The five public payloads total **13,425,778 bytes**. The public signing key adds **800 bytes**, for **13,426,578 bytes (12.80 MiB)** before documentation and Git overhead.
- `public-signing-key.txt` contains only the pinned base image's `/etc/apk/keys/wolfi-signing.rsa.pub` public PEM bytes. Its extension avoids the source sealer's `.pem`/`.key` prohibition; its bytes and digest are unchanged.
- The local `.gitattributes` disables line-ending conversion for every retained payload and the public key. Commit the actual bytes as ordinary Git blobs; a Git LFS pointer does not satisfy this snapshot verifier.

## Public payload identities

| File under `x86_64/` | Bytes | SHA-256 | Public source |
| --- | ---: | --- | --- |
| `APKINDEX.tar.gz` | 10635138 | `01398efd4ae98d03bf5cb2c9c5fe397399bca61b81c8cb0cb36bd90e230137c6` | [Exact URL](https://packages.wolfi.dev/os/x86_64/APKINDEX.tar.gz) |
| `bash-5.3-r14.apk` | 784966 | `28274b1abce489dd947e0b517935992a3b069647b7f3a4d8eb95bb262c0751d1` | [Exact URL](https://packages.wolfi.dev/os/x86_64/bash-5.3-r14.apk) |
| `libstdc++-16.2.0-r1.apk` | 1260650 | `fc233c091aa551d6ba6da3e444d99a94e9947d53814d20183a0a7ded9a668f80` | [Exact URL](https://packages.wolfi.dev/os/x86_64/libstdc++-16.2.0-r1.apk) |
| `ncurses-6.6.20261010-r0.apk` | 625682 | `475d8c2ec463637844149030a9cc3fc607782cfe681e3c16f80d2a6bc940bb63` | [Exact URL](https://packages.wolfi.dev/os/x86_64/ncurses-6.6.20261010-r0.apk) |
| `ncurses-terminfo-base-6.6.20261010-r0.apk` | 119342 | `fac2c47f1e85175a8cb6842c374b5462aa8a10d548b5d602d28ee7829b00a751` | [Exact URL](https://packages.wolfi.dev/os/x86_64/ncurses-terminfo-base-6.6.20261010-r0.apk) |

Public key SHA-256: `f0031424cf46f7db780ce63a45f0fd6aa6f85f601e6bb3b7a91fe3d4d5b7d2cc`.

The four APKs are not individually signed. The retained repository index is signed. `provenance.json` preserves the prior RSA-SHA256 compressed-index signature observation against this exact public key, plus indexed control/data checksum observations through the source provenance. This verifier checks retained bytes; it does not perform cryptographic RSA verification or execute `apk`. The final reviewed installation must use the pinned base's authentic key and signed local index with network disabled, with no `allow-untrusted`, floating upgrade or network fallback.

## Read-only verification on another machine

From the repository root, with a standard Python 3 interpreter:

```sh
python3 -B docs/handover/20261017/fable-shipping/verify-runtime-package-inputs.py
```

On Windows, use an existing authorized Python executable with `-B` and the same repository-relative script path. The verifier also accepts `--lock FILE` and `--inputs DIRECTORY`, is independent of the working directory, and supports `--help`. It reads only bounded regular files, makes no network calls, writes no files, and returns exit 0 only when the exact snapshot matches the lock. Errors are static and exit 2. Its success proves snapshot integrity, not installation, signature execution, vulnerability clearance or image readiness.

## Remaining source step before a paid build

**The current `runtime-packages.mjs fetch` and Dockerfile still fetch the mutable public index URL and exact versioned APK URLs. This snapshot is not yet consumed by that path.** A changed index will fail the pinned hash; removed or changed APKs will also fail. The resume owner must implement and independently review explicit consumption of these retained bytes before a paid build if the upstream URLs rotate. Do not replace the lock's hashes with newer upstream values merely to make a download pass.

The smallest source follow-up is a bounded local-cache preparer using the canonical lock/parser and hash/length checks, producing a new owned `x86_64` repository directory from these bytes without network fallback, then a Dockerfile wiring change to consume that prepared directory. Keep the signed-index/key verification, offline `apk` command, complete installed-package verification, GNU/SWC/Temporal probes, 24 Linux cases and HIGH/CRITICAL scan gate. This retention task did not change the helper, Dockerfile or lock, and authorizes no build.

The pinned Node/Wolfi OCI image layers and npm packages are not included here. Their existing immutable/locked identities remain in the source; this snapshot removes loss of these five public package inputs, not every external dependency of a complete image build. The `docs` tree is excluded from the current Docker context, so a later source change must explicitly place the prepared inputs in the build context without copying this handoff tree into the runtime image.

## Declared licenses and source pointers

These labels and source-recipe commits were read from the retained packages' public metadata/SBOMs. `provenance.json` retains the observed source pointers; it does not claim that upstream source trees are bundled here.

| Package | Declared license | Pinned Wolfi build recipe |
| --- | --- | --- |
| `bash 5.3-r14` | `GPL-3.0-or-later` | [Recipe at `ac7b15dc2695924986372a27cd7d6c4e029c5efa`](https://github.com/wolfi-dev/os/blob/ac7b15dc2695924986372a27cd7d6c4e029c5efa/bash.yaml) |
| `libstdc++ 16.2.0-r1` | `GPL-3.0-or-later WITH GCC-exception-3.1` | [Recipe at `794cf72f88e1b408eca5da0dbf5c5ed25543606d`](https://github.com/wolfi-dev/os/blob/794cf72f88e1b408eca5da0dbf5c5ed25543606d/gcc.yaml) |
| `ncurses 6.6.20261010-r0` | `MIT` | [Recipe at `a8ea2f5f5980ccf40a6f6f34c6aeb358dfccc815`](https://github.com/wolfi-dev/os/blob/a8ea2f5f5980ccf40a6f6f34c6aeb358dfccc815/ncurses.yaml) |
| `ncurses-terminfo-base 6.6.20261010-r0` | `MIT` | [Recipe at `a8ea2f5f5980ccf40a6f6f34c6aeb358dfccc815`](https://github.com/wolfi-dev/os/blob/a8ea2f5f5980ccf40a6f6f34c6aeb358dfccc815/ncurses.yaml) |

The repository index describes the broader public Wolfi package catalog; it is retained solely as the exact signed index needed to authenticate these pinned package identities. No credential, private key, authenticated response or local machine configuration is included.
