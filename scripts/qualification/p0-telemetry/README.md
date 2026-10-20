# P0 verification without AWS credentials

This is the repeatable Linux/Docker implementation of P0 plan §13. It builds
local test images and runs the existing suites; it never publishes an image,
reads AWS credentials, deploys a stack, or contacts a model provider. Public
registry/package access is required during image builds. Test containers have
`--network none` and run tests as uid 1000 (Node) or 10001 (Python).

Implementation outline: `verify.py` owns bounded Docker processes, source/image
pins and suite ordering; `in-image.sh` and `proxy-tests.sh` own the short-lived
test containers and cleanup; `evidence.py` decodes test outcomes and compares
baseline/head evidence. The workflow runs the same harness against the PR's
exact base and head commits. It does not use GitHub's synthetic merge commit.

```bash
python3 scripts/qualification/p0-telemetry/verify.py runtime --source . --output /tmp/p0-runtime
python3 scripts/qualification/p0-telemetry/verify.py proxy --source . --output /tmp/p0-proxy
python3 scripts/qualification/p0-telemetry/verify.py infra --source . --output /tmp/p0-infra
python3 scripts/qualification/p0-telemetry/evidence.py compare /tmp/p0-artifacts --output /tmp/p0-report.md
python3 -m unittest discover -s scripts/qualification/p0-telemetry -p 'test_*.py'
```

Use a committed checkout. Source archives are made with `git archive HEAD`, and
their SHA-256 and exact commit are recorded. The image gate retains its ten
read-only fixture mounts, reporter, 24 cases and sandbox flags. The regular
suites overlay committed source onto the image to restore test files excluded
by `.dockerignore`. That is test-only setup, not the image's shipping hash gate.

The Node and Wolfi base digests are fixed in `verify.py` exactly as P0 §13.1.
The Python base remains the plan's `python:3.13-slim` tag; its resolved digest is
recorded before building. A missing pinned base fails the build and leaves a
blocked verdict. Never substitute a new base to make this workflow green.

One source correction to the plan: existing owner Node suites are adjacent to
their modules (`apps/proxy/product/*.test.mjs`), not in `product/test/`. Both
locations are discovered, and an empty required suite is an error.

Supplemental material-renderer tests run on a separate host runner with full Git
history, Node 24 and Python 3.13. They need historical `git cat-file` inputs and
fresh synthetic PKI, which are absent from the runtime image. Node dependencies
come from the existing lockfiles; the three Python PKI dependencies and hashes
are selected from the existing proxy lockfile. These tests use no private
deployment inputs and do not replace any image test. The pure observability
template test remains in the runtime-image suite.

Every runtime suite runs sequentially within a job. A rehearsal with nonempty
`hostClockSteps` is retried once, retaining both attempts. Persistent clock
steps make the result unverified. An initial ordinary failed test is never
automatically erased by a retry. The proxy's known material test may skip
without Node dependency trees; skip totals remain visible in the report.

`P0_CHANGED_NODE_TESTS` may contain a JSON array of changed `*.test.mjs` paths.
The workflow supplies it from the base/head diff, so new telemetry, integration
and infra tests are included. A new test absent from the base is explicitly
reported as candidate-only, not as a baseline pass.

Exit codes: 0 means all executed required checks passed; 1 means a failed or
unverified check; 2 means invalid arguments or unavailable prerequisites. Each
run writes `result.json` and individual logs. The comparison produces a suite
table and one row for each failed test, classifying an exact matching failure
on the base as pre-existing. Known baseline failures are reported, never
silently waived. Container commands have explicit deadlines and cleanup traps.

These checks do not apply CloudWatch resources or prove live acceptance. The
shipper still owns deployment, the image-manifest hash preflight, the actual
proxy product image and the live two-turn validation.
