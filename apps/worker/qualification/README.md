# Meri W02-01 qualification worker package

Preparation for the independent Meri worker image: a Linux x86_64 image recipe,
deterministic OFFLINE qualification tests, and explicit opt-in LIVE probes.

This is PREPARATION ONLY. Nothing here is an accepted runtime, a built image or
live qualification evidence. G1 stays incomplete and W03 stays blocked until
Codex independently builds the image and runs the isolated Fargate evidence.

A PRIOR probe-only candidate was built and ECR-scanned by Codex (digest
`sha256:f669d3602892c36c7a829bc3e2747124fa2e1dd5397af193f7b893afdd19b837`,
12 CRITICAL / 64 HIGH / 70 MEDIUM / 16 LOW / 3 UNDEFINED). THIS refreshed recipe
(Node LTS 24.21.0 base, current fixed security snapshot `20261009T000000Z`) is
NOT YET BUILT and has no assembled digest; the prior digest does not apply to it.
The refresh re-pins patched OS packages (perl, NSS, GnuTLS, Python, OpenSSL) and
`dist-upgrade`s all inherited packages from the signed fixed sources. Package
metadata is not a completed security audit and does not establish zero
vulnerabilities: CVE-2026-95210 (GnuTLS) and CVE-2026-52490 (tiff/tiffcrop)
remain open. See `component-pins.json`.

## Layout

```
package.json                 private ESM package; exact pinned dependencies
package-lock.json            nested lockfile (npm ci from this lock only)
requirements.lock.txt        hash-pinned Python candidates (--require-hashes)
component-pins.json          versions, integrities, license files, OS snapshot pins
sdk-options.mjs              thin, explicit, inert Claude Agent SDK options builder
probes/static.test.mjs       canonical OFFLINE tests (npm test)
probes/runtime.mjs           probe:runtime image entrypoint (opt-in LIVE)
probes/browser.mjs           probe:browser Playwright MCP probe (opt-in LIVE)
probes/artifacts.mjs         probe:artifacts Office generate/render probe (opt-in LIVE)
probes/artifacts.py          native DOCX/XLSX generation, inspection, PDF, recalc
```

## Commands

Offline (deterministic, hermetic, no network/model/browser/Office/Docker):

```
npm --prefix apps/worker/qualification test     # node --test probes/static.test.mjs
npm --prefix apps/worker/qualification check    # same
```

Opt-in LIVE (image/container only; never run by `test`):

```
npm --prefix apps/worker/qualification run probe:runtime    # image qualification entrypoint
npm --prefix apps/worker/qualification run probe:browser    # sandbox-enabled Chromium probe
npm --prefix apps/worker/qualification run probe:artifacts  # Office generate/render/recalc
```

## Image recipe

Docker daemon is unavailable on the authoring host; the image is NOT built here
and `component-pins.json` keeps `assembledImageDigest: null`. Intended build
(build context is THIS package directory so the owned `.dockerignore` applies):

```
docker build --pull --platform linux/amd64 \
  -f apps/worker/qualification/Dockerfile \
  -t <ecr>/meri-greenfield/qualification-worker:<sha> \
  apps/worker/qualification
```

The recipe: immutable base `node:24.21.0-bookworm-slim@sha256:d6aa754f...`
(Node LTS 24.21.0), Debian repositories pinned to snapshot `20261009T000000Z`
(main + security) with normal signature verification and source-scoped
`Check-Valid-Until: no` (Debian's documented setting for historical snapshots), a
deterministic CA bootstrap (apt installs the exact resolved `ca-certificates`
over HTTP from the same fixed signed snapshot, then both sources switch to HTTPS
with normal CA verification), exact direct OS pins at the highest snapshot
candidates followed by `apt-get -y --no-remove dist-upgrade` to refresh ALL
inherited installed packages from the signed fixed sources (no-removal; never
silently drops a needed package), a single locked `npm ci --include=optional`,
hash-pinned Python in an isolated venv, the matched Chromium (revision 1247 /
Chrome-for-Testing 155.0.8059.12, archive
`builds/cft/155.0.8059.12/linux64/chrome-linux64.zip`) installed via the adopted
Playwright CLI with the browser tree kept root-owned and its `chrome_sandbox`
setuid helper asserted root/4755 after all ownership operations, non-root UID/GID
10001, and `VOLUME ["/workspace", "/tmp"]`. The build records the full dpkg
inventory and Node/Python/LibreOffice versions and byte-verifies the pinned SDK
Linux binary. Runtime expectation set by Codex's ECS task definition:
`readOnlyRootFilesystem=true`, no capabilities, no privileged mode, no Docker
socket, no host networking.

### Volume / writable-path behaviour REQUIRES LIVE VERIFICATION

ECS mounts empty writable volumes at `/workspace` and `/tmp`; declaring
`VOLUME` lets Docker initialise an empty volume from the image directory
(copying UID/GID 10001 ownership). That initialisation is an assumption to be
proven live, not a guarantee. `probe:runtime` verifies effective UID 10001 and
real `mkdir/write/read/delete` in BOTH directories, and checks
`/proc/self/mountinfo` for the read-only root mount before accepting writable
paths.

### Live output locations

LIVE probes write under `/workspace` (browser: `/workspace/qualification-browser`,
Office: `/workspace/qualification-artifacts`) because `/opt/meri-worker` is on
the read-only root. On this authoring host they default under the owned
`.runtime/` scratch subtree instead. Failures, originals, rendered PDFs/PNGs and
hashes are preserved by default.

## Security posture

- No `--no-sandbox`, no privileged mode, no docker socket, no extra
  capabilities, no root. The browser verdict parses the exact two-cell
  chrome://sandbox table (`#sandbox-status`): Layer 1 Sandbox = Namespace or SUID
  AND Seccomp-BPF sandbox = Yes (a disabled unused alternative layer is
  allowed); missing/None/ambiguous/unknown fails. It requires the actual `/proc`
  Chromium browser AND renderer for THIS run (identified by `/proc/<pid>/exe`
  under `/opt/meri-browsers` plus the exact profileDir and real PPid ancestry, so
  the MCP Node launcher's `--browser chromium` cannot be mislabelled) with no
  disabling flag anywhere. Downloaded fixture bytes are checked against the known
  payload hash; requested config alone is never accepted.
- `probe:runtime` network-denial requires the expected DNS denial class for
  example.com and api.anthropic.com (arbitrary resolver failures are not a pass),
  plus a positive control that `logs.us-east-1.amazonaws.com` resolves inside
  10.80.0.0/16 and connects on 443. The positive control failing or an unknown
  error fails visibly.
- `probe:artifacts` keeps every subprocess status/signal/error, recalculates a
  COPY of the XLSX in a distinct output directory (assert A4=6 after reopen),
  and treats disabled rendering (`MERI_ARTIFACTS_RENDER=off`) as a visible
  NOT-PASSED result, never a pass.
- The synthetic qualification sets `settingSources: []`, `skills: []` and
  `settings.autoMemoryEnabled: false`; the builder rejects any override that
  would re-enable discovery or move the stable cwd.
- The SDK's `InMemorySessionStore` is an OFFLINE adapter reference only. It does
  not establish durability, mirror/retry behavior, resume or workspace
  restoration, and (as measured) it does NOT deduplicate UUIDs. A production
  durable adapter must deduplicate separately and is out of scope for this task.

## Not run here (live gates)

Image build and immutable digest; target Linux SDK query/stream; non-root
sandbox-enabled MCP Chromium and real download; LibreOffice/fonts export and
visual render review; uploaded-config-inert; curated skill pack; model proxy and
denied direct paths; real isolated Fargate IAM/read-only mounts/task
separation/capabilities; remote opaque-session plus workspace snapshots;
interrupt/resume/replacement-task restoration and stale-fence rejection; SDK
mirror_error handling; Temporal production topology; measured startup/memory/
disk/timings/cost. Local offline results cannot pass these gates.
