# Repair verification, 2026-10-14

Pinned base: PR84 `d741792b1672d6eac4c1c37835c3c3d1931e66a8`.
All changes are new external qualification tooling under this directory. Runtime
source, dependencies, lockfiles and Dockerfile are unchanged.

- Native resolver tests: four passed; one POSIX executable/symlink integration
  fixture explicitly skipped on Windows. Safe executable-mode predicates, exact
  platform/architecture/glibc selection, dependency pin refusal and image containment passed.
- Producer receipt/hash tests: two passed, including rejected mismatched executable
  path/hash, platform, optional-package identity/libc, model/network activity,
  manifest counts and Temporal metadata/bundle fields. All four probe/input file
  hashes match the producer's sealed constants.
- Temporal binding test: runtime-owned hoisted package resolution and mismatched
  package/owner rejection passed.
- Real Temporal bundling: passed with pinned upstream `@temporalio/worker` 1.24.0,
  canonical `workerOptions`, actual workflow source and network/listener tripwires.
  The first sandboxed native-addon run failed on SWC's existing cache ACL. The same
  test passed through the supported reviewed executor route; no cache configuration
  or permission changes were made. Local Node was v24.19.0 x64 on Windows; this is
  supporting evidence, separate from the required v24.21.0 Linux image gate.
- A real local bundle attempt exposed the original probe's incomplete logger
  interface. The repair uses upstream `DefaultLogger`; no fake bundler or skipped
  workflow compilation was introduced.
- JavaScript syntax checks passed for the repaired image probe.
- Frozen failed image probe SHA256 remains
  `c6b9987c9c0183ecf090161fad15c93238ca38ff0d81e7962d03fa859e3dff24`;
  producer remains `006e33bbe99e19371770867f9fae1d33ad853e864b5cb0ab13749aace4cb5a11`.

Docker's Linux engine pipe was absent. No daemon was started. The real native CLI
execution and complete native image qualification remain unverified and mandatory
for a separately approved paid attempt. No image build/push, AWS mutation, deployment,
DB write or model request was performed for this repair.
