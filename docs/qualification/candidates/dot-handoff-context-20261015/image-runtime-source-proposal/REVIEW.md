# Minimal runtime final-stage proposal

SOURCE REVIEW ONLY. This directory is outside Git. The transition commit 3532541665c62940cd83d98503b3d1d4a0ae718b remains unchanged and was published after direct user approval. This image proposal remains unpublished. No image was built, package installed or target binary executed. No AWS or model request occurred.

## Decision

Prefer a separate minimal final stage over a cross-release package upgrade. Retain the exact previously verified Node24.21.0 Trixie-slim source:

`docker.io/library/node@sha256:173f125896c3b47ddf056734c7ea789d04595a6a08769a8f78e0df642781fb66`

linux/amd64 manifest: `sha256:c83040f7e24bacea68e58a0b96a484ba430bf24abb2973eab7ba4701144b7b63`; config: `sha256:04f59b17d8d39a8fdeb138fecb8fcbaa6e208ed7b6db929c7e98ad9005e0a52f`.

No new base or mirror is introduced. Do not substitute an ECR mirror without verifying its exact index/platform/config digests. Apply only the separate Trixie NODE-argument patch and this proposal in a future reviewed source branch; neither is applied here.

The builder retains ordinary locked npm installation and SWC materialization. A new source-owned materializer constructs an empty final root from explicit reviewed files of that same base, audits ELF dependencies without ldd/package execution, and emits truthful file/package/license provenance. The final stage is FROM scratch, copies this root and the unchanged /opt/meri tree, and keeps UID/GID1000 and the direct Node entrypoint. This is an application filesystem assembled from known source bytes, not a forced purge of Essential/Protected packages in a general-purpose Debian installation. No vulnerable payload may be retained while its inventory is removed.

Static inspection resolves Node, SDK CLI2.1.295, SWC1.16.18 and Temporal1.24.0 through libc6, libgcc-s1 and libstdc++6 only. The union is Node plus eight OS regular files (loader, libc, libdl, libgcc_s, libm, libpthread, librt, libstdc++6.0.33), with no unresolved transitive dependency. These binaries do not dynamically require Debian zlib or util-linux libraries. Shell startup compatibility, NSS/dlopen, TLS and other helper probes still require Linux execution. Retaining Bash/Dash for startup does not authorize model Bash tools: the product's existing empty built-in tools and exact in-process MCP allowlist remain unchanged.

## Vendor facts and limits

Current Trixie util-linux is not vendor-fixed for the residual cases. The newer fixed unstable package requires libc6>=2.42 and matching split libraries, so installing it into this Trixie base is not a minimal compatible update. Debian lists the residual zlib issue unfixed even in unstable; an upstream fix commit exists but installing stable zlib1.3.2 is not a verified remedy. See the private residual report for the row-specific mapping; this source proposal contains none.

Removing unused OS package payloads is expected to remove package-presence findings. It does not prove the final image has zero findings. Node and the CLI can statically bundle zlib and other components. The Node tagged source still presents a potential pre-fix bundled-code concern requiring vendor/binary analysis and a full final scan. Do not describe this as a zlib-free runtime or use package removal as a policy exception. The base has no system CA bundle to copy; Node built-in trust, CLI trust, and the existing proxy trust contract must be tested explicitly.

## Exact source/proof impact

`runtime-final-stage.patch` changes only apps/runtime/Dockerfile. Both it and the separate NODE patch pass git apply --check against preserved35325416 (the NODE patch uses --unidiff-zero). Dockerfile.proposed is the complete proposed result. PROOF-IMPACT.json records exact old/new hashes.

One of the existing45 proof rows changes: apps/runtime/Dockerfile. The other44 retain exact bytes. The helper, its explicit policy and tests are new source files outside that existing45-row set and require their own reviewed source inventory. The producer NODE argument is outside those45. Combining later with the transition candidate would yield13 declared changed historical rows and32 unchanged, rather than12/33. No historical/Fable/Dot manifest is modified here, and no old acceptance transfers. Shipping must bind a new exact source/context/archive and candidate manifest; unsealed preparation remains disabled.

## Regression and admission plan

1. Independently review materializer path confinement, finite policy, exact file hashes, ELF interpreter/SONAME closure, unexpected dependency refusal, symlink handling and per-file package ownership. Verify that no libz or util-linux payload is in the proposed final root; preserve inventory and licensing for every retained or bundled component. Run pure parser/path tests without target binary execution.
2. In a separately authorized disposable Linux environment, materialize the root from the exact pinned source and installed locked Linux package tree. Audit every copied regular file and symlink; reject unexpected required libraries rather than silently adding them. Resolve NSS/dlopen/shell requirements and compare the actual emitted inventory to the reviewed policy. No additional apt repository, sid package, compiler or download is implicit.
3. After separate build authorization, test the final image as1000:1000 with read-only root, existing writable mounts, no added capabilities, no-new-privileges and bounded resources. Run exact Node/SDK/CLI/SWC/Temporal versions and hashes, ordinary runtime imports, CLI --help/--version, network-disabled workflow bundling, process cancellation and owned-child cleanup.
4. Use private synthetic DNS/TLS/proxy fixtures to verify Node and CLI certificate validation, DNS/hosts/user lookups and SDK session initialization. No external provider/model call is authorized by this plan. Exercise selected in-process MCP tools, transcript/checkpoint/next-turn restoration and cancellation through existing isolated qualification harnesses; verify Bash/mount/nsenter are not newly admitted tools. Full Python/LibreOffice/browser artifact capabilities need their own image placement and native closure if included in the release scope.
5. Preserve the exact Debian13/trixie os-release/debian_version metadata and its base-files provenance. Produce a new complete SBOM and full final-image scan, including native/bundled dependencies. Require positive Debian13 vendor attribution and zero High/Critical without exclusions or waiver; an unknown-OS zero result fails this gate. Reconcile every new or retained row against actual payload and fixed-version evidence; a package absence expectation or a passing smoke test cannot admit the image. Stop if the bundled-code concern persists.

This proposal remains blocked on complete policy/materializer review, dynamic Linux compatibility and final scan evidence. It is not an instruction to start a paid build.

The concrete draft policy deliberately sets dlopenReview.status to HOLD, so it cannot materialize a root yet. The source owner must first settle and review the finite shell/NSS/TLS/locale/license support profile, then record any reviewed policy change in a new source candidate. That source review could enable a separately authorized diagnostic build; it would not pre-clear the later dynamic tests or scan gates. Independent bounded source rereview resolved the reported CLI, image binding, path, payload ownership, ELF alias/interpreter and distro-attribution defects. Twelve pure metadata tests and syntax checking pass; VALIDATION.json records exact commands and unrun gates.

runtime-and-base-source.patch contains the Dockerfile change, three new source files and the separate pinned NODE producer argument. It passes git apply --check --unidiff-zero against preserved35325416 without changing that checkout. PROPOSAL-MANIFEST.json inventories the complete review packet and its file hashes. No private finding table is included.
