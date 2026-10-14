# Assembled runtime image qualification

This repairs qualification tooling for frozen PR84 runtime source
`d741792b1672d6eac4c1c37835c3c3d1931e66a8` (qualified code
`0898fadd077c61245fdb5c42365efacdb727d7c0`). It changes no runtime dependencies,
Dockerfile, source archive or deployment placement. No paid attempt is authorized by this PR.

The SDK owner's real public entry anchors resolution of its exact optional native
package. The pinned Bookworm image must positively report glibc. The probe verifies
the package's version, OS, architecture and libc, confines its real regular executable
to the package and image, rejects unsafe modes/links, and directly executes only
`--version` with bounded output/time and a credential-free environment. The same
executable is hashed before/after execution and reported. No PATH or optional-package
fallback is used. Node and native CLI receipt fields remain separate.

The runtime owner anchors the public Temporal entry and exact 1.24.0 dependency.
Prefix, npm hoisted and image-contained linked layouts are accepted; external
workspace fallback is refused. Actual `bundleWorkflowCode` uses canonical
`workerOptions` and upstream `DefaultLogger` with bounded error output. The earlier
`{log(){}}` logger did not satisfy the upstream interface. Bundle errors remain failures;
the probe never starts a Temporal worker, application, model request or service.

## Staging and commands

Create a new task-owned staging directory, preserving all failed artifacts. Copy
`meri_image_build.py`, `image_probe.mjs`, `native-cli.mjs`, `temporal-binding.mjs` and
`source-manifest.json` from this directory. Supply the existing, verified frozen
`runtime-source-d741792b1672.tar.gz` and `BUILD-INPUT-MANIFEST.json` there. The producer
validates their exact historical hashes and all 2,389 Git-bound files. The 45-file
runtime source manifest is unchanged. Do not copy prior start/upload intents or receipts.

`python -I -B -S meri_image_build.py --help` describes options. With no option it
prepares and seals the packet/buildspec locally. `--producer` is Linux-only and runs
inside the existing approved builder. **`--start` uploads and starts a paid attempt;
it requires separate explicit attempt approval and must not be used for this repair.**
Exit 0 means the requested operation completed; exit 1 is HOLD/failure. Fresh attempt
IDs are unique; existing intent receipts block repeated submission. No deployment is
performed by any mode. Docker network-none/read-only, capability drop, no-new-privileges,
non-root identity, memory/PID/tempfs bounds and mandatory native bundling remain gates.

## Verification

From the repository root:

```sh
node --test scripts/qualification/assembled-image/native-cli.test.mjs
python -I -B scripts/qualification/assembled-image/test_producer.py
node --test scripts/qualification/assembled-image/temporal-bundle.test.mjs
```

The Temporal test requires the Dockerfile's locked dependency installations plus the
same local `@capiro/meri-contracts` link. Use the project-supported install route and
preserve all lockfile bytes. It executes the actual upstream bundler under network and
listener tripwires. Windows local evidence is separate from Linux image admission.
The POSIX executable integration fixture is explicitly skipped on Windows; all native
image probes remain mandatory. Do not start a replacement Docker daemon or alter ACLs
to compensate for a blocked host check.
