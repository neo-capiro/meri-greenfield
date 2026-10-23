# Gate scripts (as Fable runs them on neomart), published 2026-10-22

These are local qualification gates. They run only in **throwaway Docker containers**. **None of them touches AWS or any real database**: every PostgreSQL here is a disposable `pgvector/pgvector:pg16` container with `--network=none`, deleted after the run. Real migrations (the new-stack clone) are a separate, shipping-only step (`../SHIPPING-RUNBOOK.md`, `../neomart-kits/`).

## Machine prerequisites

- **Linux or Windows WSL2, with native Docker**, not Docker Desktop (unreliable on neomart). Builds are `linux/amd64`; arm64 hosts need `docker buildx` with amd64 emulation.
- About 16 GB RAM and 60 GB free disk. One gate run at a time: two concurrent runs rebuild the same image tags and add timing noise.
- `git`, Python 3, Node 24 only inside containers (images below), and `gh` for posting results.
- Images: `pgvector/pgvector:pg16` (server 16.15), `node:24`, and for frontend browser repros `mcr.microsoft.com/playwright:v<version>-noble` with the version from the frontend `package-lock.json`.
- **Clone from GitHub** (`git clone https://github.com/neo-capiro/meri-greenfield.git`). A clone made from a partial local repo can silently miss blobs ("unable to read sha1 file").

## Meri

### `meri/m1-gates.sh`: head vs base, image + rehearsals + native PostgreSQL

```bash
HEAD_SHA=<full sha> BASE_SHA=<full sha of the PR parent> GATE_WORKDIR=/opt/gate-<sha8> \
  [CHANGED_TESTS_JSON='["apps/…/x.test.mjs",…]'] [COMBINED_FILE=…] [TARGETED="…"] \
  bash meri/m1-gates.sh setup head-runtime combined targeted pg-head base-runtime pg-base
```

| Step | What it does |
|---|---|
| `setup` | Fetches both SHAs from GitHub, plus the P0 harness at `43b705c8` (`scripts/qualification/p0-telemetry/{verify.py,evidence.py,in-image.sh}`) |
| `head-runtime` / `base-runtime` | `verify.py runtime`: builds image `meri-p0-runtime:<sha12>`, then runs the 24-case image gate, the runner-diagnostics, control, worker, owner and telemetry groups, the changed tests (`CHANGED_TESTS_JSON`, the PR's changed `*.test.mjs` excluding `*-pg`), and the **first-turn** and **D3 rehearsals** |
| `combined` / `targeted` | Runs a test selection inside the head image (`combined-m1.txt` is M1's 32-file set) |
| `pg-head` / `pg-base` | A native PostgreSQL 16 container: the repo's `scripts/qualification/local-baseline/provision-postgres.sh start`, then **`extra-migrations.sh`** (27 applies, expect 0 failed), then every `*-pg.test.mjs` under `apps/control/conversations/test`, `apps/runtime/test`, `apps/runtime/native-authority/test` and `apps/control/retention/test` |

Results go to `$GATE_WORKDIR/out/steps.txt`, plus per-step logs.

**Judging (O191):** diff head against base, test by test. Only a failure **new on head** blocks. On base `d3cf5496`, 78 PostgreSQL failures and the N21 renderer test are inherited, and the "nonanswers back off 0.5, 1, 2 s" case is timing-flaky on both sides. Rehearsals marked "unverified (clockSteps)" are a WSL clock artefact; check that the clock-retry also passes.

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

Expected at current `main`: all green (for example 61/61 at #209).

## Frontend

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

## Not covered yet: Core migration rehearsal

Core Prisma migrations are **not** rehearsed before they're applied to the clone; the snapshot is the safety net. The planned step is a schema-only dump of the clone, produced by an AWS-side task (never typed credentials), restored into a `pgvector/pgvector:pg16` container. The Core image's `migrate` verb then runs against it and must report "All migrations have been successfully applied" before the clone is touched.
