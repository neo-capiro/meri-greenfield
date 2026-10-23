# Meri model-proxy ship kit for `205eead4c18882e4fc0e6c016c10dc4e5dd8c45c`

**What it builds:** the product proxy image (Python LiteLLM proxy on Wolfi glibc 2.44 + CPython 3.13) for meri-greenfield commit
`205eead4c18882e4fc0e6c016c10dc4e5dd8c45c`. It uses the repository's own pipeline:
- `infra/product-preview/proxy-image-context.py` (seal);
- `proxy-image-start.sh` (upload + one StartBuild);
- `proxy-image-build.sh`, which runs in CodeBuild `meri-greenfield-qualification-build` and is sha256-pinned in the buildspec.

All three are copied from this commit into `tools/`.

**Where it goes:** `images.proxy` of a Meri first-chat ship kit (`C:/dev/fable/ship-kit/make-ship-kit.mjs`), through
`04-feed-meri-kit.sh`.

**Rollback:** the serving proxy is `…@sha256:734a20ec…` (source `34851020`, receipt sha256 `04d24b4b…`). It is release E's
proxy, so the Meri kit's documented rollback (forward redeploy of `release-E.deployment-inputs.json`) restores it.

Sealed input: `proxy-context.zip`, sha256 `28bd4d2bed7aad6e77f1e6113e6e5f475ec755f5dbed995efdd555d34004ae83` (`seal.json`). The live start is approved by exactly this hash.

## Steps (Git Bash, from `C:/dev/fable/ship-proxy-205eead4`)

| # | Script | Kind | Does | Result / gate |
| --- | --- | --- | --- | --- |
| 0 | `00-preflight.sh` | read-only | account, zip hash, commit on origin, S3 prefix free, shared project idle (the repository's own fail-closed check), serving proxy steady | `PREFLIGHT_OK` |
| 1 | `01-start-build.sh` | **MUTATING** | runs `tools/proxy-image-start.sh` live: create-only SSE-KMS upload + HEAD verify, attempt id, project idle, both tags absent, ONE StartBuild 30/5/0 | `put.json`, `head.json`, `attempt.txt`, `start-build.request.json`, `start-build.result.json` |
| 2 | `02-wait-receipt.sh` | read-only | wait; download `results/proxy-image/<commit>/<attempt>/proxy-image-receipt.json`; check identity, tags, pinned bases, receipt scan, ECR tag→digest | `state/product-digest`, `state/receipt-sha256` |
| 3 | `03-scan-gate.sh` | read-only | exact-digest ECR scan: COMPLETE, after push, unpaginated | **any HIGH/CRITICAL → STOP**; other findings → HOLD unless `ACCEPT_NON_HIGH_FINDINGS=1`; zero → `state/scan-gate.pass` |
| 4 | `04-feed-meri-kit.sh <meri kit dir>` | local edits | before the Meri kit's 04: `baseline-C.deployment-inputs.json` `images.proxy`/`proxySourceCommit`, `kit.json` `proxyScanSha256`; originals kept as `*.pre-proxy.json`; `proxy-feed.json` | `FED {...}` |
| 5 | `05-in-image-tests.sh [live\|built]` | local (WSL Docker) | proxy product unit tests in the image (`live`: serving image + this tree, compared with the 34851020 baseline; `built`: the new image) | `IN_IMAGE_TESTS_NO_REGRESSION` |

**What the build itself enforces:**
- `proxy-image-build.sh` verifies every context member against `context-manifest.json` and the 331 `assembly-pins.json`
  artifacts.
- It builds the unchanged assembly (node base pulled from the identical-digest ECR Public mirror) and runs the locked-down
  import probe.
- It builds the product image FROM that digest, including the in-image `InstalledNativeStartup` smoke.
- It pushes both images, gates the **product** scan on 0 HIGH/CRITICAL, and only then writes the receipt.
- The Debian assembly is builder-only; it is never deployed and its scan is recorded, not gated (the live receipt records 9
  HIGH there).

## Order with the Meri ship kit

1. Run `make-proxy-kit.sh` on the **final** commit. Best is the Meri candidate commit `X` you will ship, so the proxy image
   and the render read the same `apps/proxy`. At minimum, `X:apps/proxy` must equal this commit's tree (04 refuses
   otherwise).
2. Run `00` → `01` → `02` → `03`, and optionally `05 built`.
3. `node C:/dev/fable/ship-kit/make-ship-kit.mjs X` creates `C:/dev/fable/ship-<X8>`.
4. `bash 04-feed-meri-kit.sh C:/dev/fable/ship-<X8>`, before that kit's `04-image-readback`.
5. Run the Meri kit from `01` as usual:
   - its `04` writes `deployment-inputs.candidate.json` with the new proxy and `image-scans.candidate.json` with
     `proxy = receipt sha256`;
   - `12-private-render` renders the model-proxy role on it, and `verify-rendered.mjs` checks the proxy digest;
   - `14-bindings` pins `reviewedScanSha256`;
   - `16-execute-model` rolls owner and proxy.

## Notes

- **Seal reproducibility [R]:**
  - Use CPython **3.14** (`python3`) and `C:/dev/fable/proxy-artifacts-b7fc`. That combination re-seals `34851020`
    byte-for-byte to the live S3 input (`ba24c7fa…`, 252,117,916 B). CPython 3.11 deflates differently.
  - `make-proxy-kit.sh` refuses any other interpreter.
- **The CodeBuild project is shared with the Meri product image build.** Do not run 01 while a Meri kit build is active;
  00 and the start script both refuse.
- **An uncertain StartBuild is read back, never resubmitted:** `start-build.request.json` blocks a second start.
- **A failed build (02 prints the failure record's phase) is retried only as a new reviewed attempt.** The S3 input is
  create-only per commit, so the retry reuses it: move `start-build.request.json`, `start-build.result.json` and
  `attempt.txt` into `state/failed-<build id>/` and run `01` again. The start script keeps `put.json`, re-verifies the
  object and starts one new attempt with fresh tags.
- **No secret or private file is read.** The receipt and failure records are build metadata in the qualification bucket.
