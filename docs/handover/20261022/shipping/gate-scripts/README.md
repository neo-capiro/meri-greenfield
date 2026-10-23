# Current gate pointers and historical neomart scripts

Root Codex owns current qualification under [CODEX-VALIDATION-AND-SHIPPING.md](../../CODEX-VALIDATION-AND-SHIPPING.md). Use the current source owners below at the exact reviewed head. New images are ARM64. Root schedules shared native gates and AWS work; source tests use isolated synthetic databases, never the preview clone or live data.

The remaining scripts in this directory record the 2026-10-22 neomart setup. They are historical inputs for review, not a current release recipe. In particular, the old M1 launcher that reconstructed the P0 image verifier from Git history has been deleted; do not recreate it. Frontend CodeBuild recipes described below use AWS and require root's resource allocation.

## Current Meri gates

Run bounded source checks from the repository root with the current lockfiles installed:

```bash
node --test infra/product-preview/image-build.test.mjs \
  apps/runtime/build/runtime-base-probe.test.mjs \
  scripts/qualification/local-baseline/inventory.test.mjs
```

The [standard image build](../../../../../infra/product-preview/image-buildspec-design.md) owns exact source/member verification, ARM build/probes and digest-bound scan checks. The command above uses offline fixtures; it does not execute Docker or AWS and does not qualify a native image. Linux deadline/file-bound controls, actual image COPY/import closure, native dependency failures, retained Temporal bundle checks and exact-image scans remain required.

The [local baseline runner and suite inventory](../../../../../scripts/qualification/local-baseline/README.md) own retained source selections and test flags. Root selects affected suites and isolated PostgreSQL resources, records every failure/skip, and compares suspected inherited failures with an untouched base in the same environment. No historical count is a waiver for a current failure.

| Retained behavior | Current source or acceptance owner |
| --- | --- |
| First session, native usage, terminal delivery, cleanup, hold/steer and backoff | Runtime `first-session.test.mjs`; worker `activity-usage.test.mjs`, `cleanup-activity.test.mjs`, `lifecycle-activity.test.mjs` and `terminal-settlement.test.mjs`, with their registered flags and dependencies. |
| Current run/session ownership, conflicts, successor exclusion, recovery and retention | Canonical control/runtime suites in the local baseline inventory; root provisions isolated PostgreSQL and applies the current fixture migration chain. The dated `meri/combined-m1.txt` and `meri/extra-migrations.sh` are not the current selection or migration owner. |
| Real first turn, Core access negatives, follow-up/resume/fork, reconnect, Stop and revocation | The [retired-rehearsal coverage map and unmet acceptance](../../../../../scripts/qualification/first-chat-rehearsal/README.md). Scripted SDK/Core/ECS facts do not prove these native behaviors. |

## Historical machine prerequisites

- **Linux or Windows WSL2, with native Docker**, not Docker Desktop (unreliable on neomart). Builds are `linux/amd64`; arm64 hosts need `docker buildx` with amd64 emulation.
- About 16 GB RAM and 60 GB free disk. One gate run at a time: two concurrent runs rebuild the same image tags and add timing noise.
- `git`, Python 3, Node 24 only inside containers (images below), and `gh` for posting results.
- Images: `pgvector/pgvector:pg16` (server 16.15), `node:24`, and for frontend browser repros `mcr.microsoft.com/playwright:v<version>-noble` with the version from the frontend `package-lock.json`.
- **Clone from GitHub** (`git clone https://github.com/neo-capiro/meri-greenfield.git`). A clone made from a partial local repo can silently miss blobs ("unable to read sha1 file").

## Historical Meri selections

The M1 launcher contained no test declarations; its head/base orchestration and historical image reconstruction were removed, not the underlying behavior suites. Its old 32-file selection and migration helper remain dated evidence. The current owners above determine applicable files and migrations; the earlier 78 PostgreSQL failures, renderer failure and clock-retry observations do not establish an inherited failure at a new integration base.

### `meri/m1-repro.sh`
The D3 runner's isolated reproduction: reruns one case N times on head and base (used for the backoff flake: head 3/10, base 1/10).

### `meri/render-gate.sh` + `meri/render-gate-inner.sh`: first-chat render and Temporal infra
```bash
HEAD_SHA=<full sha> GATE_OUT=/tmp/rg bash meri/render-gate.sh
```
This runs observability, render-features, runtime-values, render-material and temporal-deployment in `node:24`. **Traps** (each looks like a product failure):
- `packages/*` must be linked under `node_modules/@capiro` (there are no npm workspaces);
- `MERI_REVIEW_SOURCE_ROOT` must be set;
- it needs a real git checkout, not a tarball (the renderer reads the runtime source commit from git);
- Python `cryptography` ≥ 42 is needed for `pki.py`, so Debian's packaged version is too old.

The historical example was 61/61 at #209. Re-run applicable current suites; that result does not qualify today's source.

## Historical frontend recipes

### Composed production gate
Use the kit generator in `../neomart-kits/ship-fe-kit/make-fe-ship-kit.mjs <composed sha> --worktree <clean worktree> --label <x>`, with `FE_EXTRA_PORTFOLIO_SPECS=tests/browser/a.spec.ts,…` for new required browser specs. Run steps 00 and 02–05 (CodeBuild: typecheck, lint, `npm run architecture` exit 0, vitest, browser, `next build`, container smoke, ECR scan with 0 findings). This step uses AWS CodeBuild with the shipper's identity.

### `frontend/run-ws03.sh` + `rerun-ws03.sh` + `check-report.cjs`: the WS03 joined Workspace gateway suites (O209)
Inputs in `$WS03_INPUTS`:
- `backend.tar` (`git archive` of capiro-backend at the Core SHA);
- `frontend.tar` (`git archive` of the composed frontend);
- `check-report.cjs`.

The suites run on loopback only, with no credentials. `run-ws03.sh` installs both repos (frontend `npm ci --ignore-scripts`; backend `pnpm install --frozen-lockfile` and Prisma generate). **Then build the workspace's package dependencies** (`pnpm --filter "@capiro/workspace^..." -r run build`; `rerun-ws03.sh` does it). Without that, `@capiro/auth` doesn't resolve and 0 tests run.

Pass = wrapper exit 0, plus a child report with **57/57** exact identities (21 standalone + 36 joined), 0 skipped, plus `check-report.cjs` exit 0.

### `frontend/repro-form.sh`
Reruns one browser spec in the Playwright image against an installed composed tree, with a local-only diagnostic edit that adds method and URL to the harness guard. That's how the Vite `/@fs/…/api/provider.tsx` abort was found.

## Historical gap: Core migration rehearsal

The neomart handover recorded that Core Prisma migrations were not rehearsed before clone application. This is a historical gap, not permission to omit current migration checks. Root owns isolated PostgreSQL rehearsal, exact migration-byte review and a verified snapshot before any forward migration of the persistent clone; see the current validation/shipping workflow above.
