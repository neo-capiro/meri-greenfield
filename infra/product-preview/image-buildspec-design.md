# Product runtime image build

The active entrypoints are the checked-in `image-buildspec.yml`, `image-build.sh`
and offline `image-build-source.py`. They use Git, ZIP, CodeBuild, Docker and the
AWS CLI directly. They do not start a model, database, service or deployment.

## Exact source preparation

Select a reviewed full Git commit. Both output paths must be absent:

```sh
python3 -I -B -S infra/product-preview/image-build-source.py seal \
  --repository . --commit "$SOURCE_COMMIT" \
  --archive /absolute/source.zip --output /absolute/members.json
```

The sealer compares every ZIP member with the selected Git blob and preserves Git
executable modes. It ignores dirty working-tree bytes. It rejects missing/extra
archive-attribute output, submodules, symlinks, case collisions, unsafe/private
paths, oversized inputs and non-certificate material. The only permitted PEM is
the public RDS CA bundle, whose committed lock pins its bytes, SHA and certificate
count. The complete sorted member manifest binds path, SHA-256, size and mode.

The archive limit is 1 GiB; at most 50,000 members, 128 MiB per file and 2 GiB
expanded total are accepted. Manifest input is at most 32 MiB. Git commands have
bounded time and private combined output; failed command output is not printed.

Verify separately downloaded archive/manifest bytes before uploading or use:

```sh
python3 -I -B -S infra/product-preview/image-build-source.py verify \
  --archive /absolute/source.zip --manifest /absolute/members.json \
  --commit "$SOURCE_COMMIT" --archive-sha256 "$ARCHIVE_SHA256" \
  --manifest-sha256 "$SOURCE_MANIFEST_SHA256"
```

Upload the ZIP and manifest using the existing authorized owner, retaining actual
non-null immutable S3 versions and checksum/readback evidence. This code does not
upload source or call StartBuild. The caller must independently authenticate the
selected Git source, S3 objects, buildspec and CodeBuild request/readback. Code
inside an archive cannot attest to its own trustworthiness.

## Standard CodeBuild invocation

Use the existing native ARM64 project with privileged Docker support. Select the
exact S3 source object and its version through StartBuild; use the committed
`infra/product-preview/image-buildspec.yml`, 30-minute build timeout, 5-minute
queue timeout and zero automatic retries. Supply only these nonsecret overrides:

- `SOURCE_COMMIT`: full reviewed 40-character commit.
- `SOURCE_VERSION`: actual S3 ZIP version selected by CodeBuild.
- `SOURCE_MANIFEST_KEY`, `SOURCE_MANIFEST_VERSION`, `SOURCE_MANIFEST_SHA256`:
  exact manifest under the existing bucket's `inputs/` prefix.
- `IMAGE_TAG`: fresh `product-<commit>-<32 lowercase hex attempt ID>`.

The existing account, region, source bucket and ECR repository are explicit in
the shell script. No resources or permissions are created. Root must check those
existing capabilities and the actual CodeBuild source/buildspec/environment
readback. There are no credential overrides, build secrets or host-directory
mounts in the image probes.

CodeBuild extracts its selected S3 ZIP. Before Docker runs, `verify-tree` checks
that extracted directory against every manifest member, including regular file
bytes, modes, missing/extra entries and symlink refusal. Evidence is initially
outside that source directory so it cannot contaminate the comparison. Manifest
head/get must return the selected version and agree on bounded byte size.

`image-build.sh --help` is inert. Invalid arguments/platform/version pins refuse
before external calls. Linux `aarch64` is required. Docker base arguments come
from the committed ARM runtime lock, using public ECR mirror names with the same
immutable child digests. The existing Dockerfile owns package installation and
native materialization; this pipeline does not duplicate that implementation.

## Native image checks and scan

After ordinary `docker build`, inspection requires Linux ARM64, UID:GID1000:1000,
the expected CLI entrypoint/source label/RDS CA environment, and size at most
3 GiB. The following five commands run in that exact image:

1. Product CLI help.
2. Canonical `runtime-base-probe.mjs --check`: actual SWC transform, Temporal
   bridge ELF/import, SDK-owner-relative ARM CLI resolution and direct `--version`
   execution, Python/native wheel imports/computation and OS CA trust.
3. Existing artifact executor generation smoke for txt/docx/xlsx/pptx/zip.
4. Direct imports of control, Temporal worker and conversation runner.
5. Public RDS bundle's image path, raw SHA, byte count, root ownership and 0444 mode.

All five use UID1000, a read-only root, no network, all capabilities dropped,
no-new-privileges, PID/CPU/memory limits and bounded noexec task tmpfs mounts.
No host fallback path or mounted host dependencies are available. This is a
native image smoke gate; it does not qualify model turns or full production
service behavior. Temporal workflow bundling remains its separate existing gate.

Only then may registry authentication/push occur. Repository readback must show
IMMUTABLE tags and scan-on-push. A private temporary Docker auth directory receives
the password over stdin. Exact tag readback must agree with the pushed local
RepoDigest. `aws ecr wait image-scan-complete` is the only waiter: FAILED,
ScanNotFoundException, timeout and other errors all fail closed without a custom
retry loop. A final digest-bound COMPLETE scan must have integer nonnegative
counts and zero HIGH/CRITICAL findings. No failure produces a success result;
a pushed image remains unadmitted if later scanning fails.

The buildspec bounds the entire script with GNU timeout at 25 minutes, allowing
90 seconds for termination/cleanup before kill. Commands also have individual
deadlines and 32 MiB live output-file limits. Unique local image/container names
must be absent before use. EXIT/INT/TERM cleanup removes only those owned names,
checks physical absence and deletes the private auth scratch. Unknown cleanup
removes any result and fails. A hard builder/process kill cannot promise that a
shell trap ran; the caller must retain that failed build and verify termination.

Owned cleanup relocates its private evidence directory into the standard artifact
base directory. CodeBuild `finally` requires the cleanup artifact; it never moves
a preexisting directory. Configure existing artifact encryption/access
and retention through the build owner. Success writes a small `result.json` with
source commit/version, image digest and scan counts; `cleanup.json` must also
report success. Logs are bounded private artifacts, not a new reporter protocol.
Authenticate CodeBuild/ECR/source evidence independently before accepting an image.

## Tests and retired coverage

```sh
node --test infra/product-preview/image-build.test.mjs \
  apps/runtime/build/runtime-base-probe.test.mjs \
  scripts/qualification/local-baseline/inventory.test.mjs
```

The Python source tests use synthetic Git/ZIP/tree inputs. Shell tests run the
actual script with closed `aws`/`docker` executables; unknown commands fail and no
real service/client can be reached. They cover source/size/version rejection,
preexisting-resource preservation, all five sandbox invocations, probe/build/
push/cleanup failure, timeout propagation, repository policy, digest mismatch,
scan failure/not-found/incomplete/severity/count controls and success cleanup.
Windows Git Bash cannot apply Linux RLIMIT_FSIZE: only its fixture overrides that
builtin, and the actual file-limit/deadline test explicitly skips on Windows.
The native Linux run must execute it; a stub timeout result is not deadline proof.

Removed tests for generated recipe bytes, nested reporter IDs, custom diagnostic
retention, custom scan retry and fixed launch/proof rows no longer describe active
behavior. They are not recreated under new names. Historical JSON manifests and
VALIDATION remain unchanged. Public CA/source/path/secret/size checks remain.
The old x86 CLI wrapper's alternate-libc selection, mutable host file hashing,
permission and diagnostic formatting tests are retired with that wrapper. Their
image requirement is now canonical ARM SDK package resolution, ELF check and
actual execution in a known read-only image with no host mounts. Existing ELF
wrong-architecture/endian/truncation negatives remain; real native image execution
and a missing/wrong native-package control are still required from the image owner.
This local suite does not claim those native results.

The real Docker COPY/import closure test remains, with the current materializer
and runtime probe byte checks. It no longer requires shipping 16 old test-source
files merely to rehash the historical 45-row manifest. Its actual Docker run is a
separate gate. Temporal helpers are unchanged and remain registered in inventory.
