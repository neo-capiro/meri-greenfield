# Assembled image history and retained Temporal checks

The active product image build lives in
`infra/product-preview/image-buildspec.yml`, `image-build.sh` and the offline
`image-build-source.py`. See `image-buildspec-design.md` there for invocation,
source validation, native ARM probes, scan behavior, cleanup and remaining gates.

This directory's JSON manifests and `VALIDATION.md` preserve historical evidence.
Their old commits, 45 proof rows and x86 recipe pins do not qualify current source.
They remain byte-for-byte historical artifacts, not active build inputs.

The old producer, frozen-candidate selector, image probe, native CLI wrapper and
SWC diagnostic tooling are retired. Current source is bound through a complete
Git archive/member manifest and immutable S3 version. The current image executes
`apps/runtime/build/runtime-base-probe.mjs` under UID1000/read-only/no-network
isolation; it resolves the SDK's ARM CLI through its actual package owner and
executes the exact binary. This directory no longer carries a parallel resolver,
launch-proof or diagnostic framework. Native negative coverage still belongs to
the actual image gate; local source tests do not stand in for it.

`temporal-binding.mjs`, `temporal-binding.test.mjs` and
`temporal-bundle.test.mjs` remain unchanged for the separate Temporal step. Their
locked dependencies and actual bundler are still required. The independent real
Docker COPY/import test remains at `apps/runtime/test/image-closure.test.mjs`.
