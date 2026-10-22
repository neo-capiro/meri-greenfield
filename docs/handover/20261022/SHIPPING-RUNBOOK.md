# Shipping runbook (as Fable ran it)

## 1. Environment

| Item | Value |
|---|---|
| AWS | account **967807252336**, region **us-east-1**, CLI profile **`capiro-dev`** (there is no `[default]`; pass `--profile` or `AWS_PROFILE`). Live users are served from this account. |
| Machine | **neomart** (Windows 11, user neoma). Git Bash for kits; PowerShell for cleanup; **WSL2 `Ubuntu-24.04`** for Docker (Docker Desktop is unreliable; native Docker in WSL has amd64 and arm64). |
| Working dirs | `C:\dev\fable\` holds the repos (`meri-greenfield`, `capiro-backend`, `capiro-frontend`), kits (`ship-kit`, `ship-proxy-kit`, `ship-fe-kit`, per-release `ship-<sha8>`, `ship-proxy-<sha8>`, `ship-core-<sha8>`, `ship-fe-<sha8>`), `wt-candidate` (the worktree release-candidate.sh fast-forwards), and `adj-reports\` (plans and decision log). |
| Private inputs (reference only; **never copy or print contents**) | Exist only on neomart: the PKI dir `C:\dev\fable\meri-preview-private-pki` (DB logins, pins), and Stage-3 render work dirs `C:\dev\fable\meri-stage3-<timestamp>` (rendered bundles, created by kit steps 11–12). Neo does the credential-bearing steps (bearer, membership, PKI). Secrets Manager material for Meri roles lives under `meri/preview/<role>/material`. |
| Tools | node 22, python 3 (use the py-launcher CPython, not the first `python.exe` on PATH), AWS CLI v2 with `PYTHONUTF8=1`, gh CLI. **Don't export `MSYS_NO_PATHCONV` globally**: it breaks Windows paths (kits set it internally). |

## 2. Meri runtime + proxy release (meri-greenfield)

**One command builds and stages; execution is separate:**
```bash
bash C:/dev/fable/ship-kit/tools/release-candidate.sh <greenfield sha on main> [--reuse-proxy-kit C:/dev/fable/ship-proxy-<sha8>]
```
It does the following, failing on any non-zero step (logs in `C:/dev/fable/release-logs/<sha8>-<step>.log`):
1. **Fast-forward** `fable/meri-first-chat-candidate-20261020` (in `C:/dev/fable/wt-candidate`) to the sha. `make-ship-kit` requires the commit on that branch.
2. **Proxy image**, unless `--reuse-proxy-kit` is given *and* `apps/proxy` is unchanged: `make-proxy-kit.sh`, then 01 start-build, 02 wait-receipt, 03 scan-gate.
   - A scan HOLD on non-HIGH findings needs an explicit, logged `ACCEPT_NON_HIGH_FINDINGS=1` (O144).
   - Then re-run with `--reuse-proxy-kit`.
3. **Meri kit:** `node make-ship-kit.mjs <sha>` makes `C:/dev/fable/ship-<sha8>`.
   - `04-feed-meri-kit.sh` feeds the proxy digest.
   - 01–04: source put, build request, image build, image readback.
   - 05: node-only measurement prep.
   - 06–10: measurement payload, finalize, build, readback, stage3 input.
4. **11-private-core** (`--client-id d1b0cb55-fd3a-49ef-847a-7bbe9175dc44`), then **12-private-render** within 15 minutes, then:
   - **13-secret-upload:** five new secret versions under a **new label only**; AWSCURRENT doesn't move. PR197 requires `--secret-labels`, and `kit.mjs` now passes it.
   - **14-bindings:** writes SHIP-PACKET.md.
   - **15-changesets:** three CloudFormation change sets (model, issuer, app). These touch TaskDefinition/Service only.

**Before execution:**
- Read `ship-packet/SHIP-PACKET.md` §Migrations.
- The packet lists entries "new" relative to the kit baseline. **Check the live Meri ledger** with `shipping/db-scripts/meri-ledger-read.sh` (read-only) before assuming anything.
- **If ledger entries are needed:**
  1. Take an Aurora snapshot of `capiro-dev-data-auroracluster23d869c0-ltmz40k47ewv`.
  2. Register a `meri-product-preview-d2-migrate` revision that differs from the previous one only in the release image.
  3. Run the stage (`MERI_D2_STAGE=meri|temporal|integration`). See `shipping/meri-release-example/165-integration-migrate.sh` (O145).
  4. Ledger order is strict: a stage applies every pending entry before the one you want.

**Execute:**
```bash
cd C:/dev/fable/ship-<sha8> && bash 16-execute-model.sh && bash 17-execute-issuer.sh && bash 18-execute-app.sh && bash 19-verify.sh
```
- 16 stops and starts the **owner + proxy pair together**. Never restart one alone: the owner locks pair identity on first read.
- `PRODUCT_PROXY_REFUSED gate=pair` lines during startup are expected. Wait 60 s after the last one before a chat.
- 19 checks that every deployed task definition equals the rendered one.

**Rollback:** the kit documents a forward redeploy of the previous release's deployment inputs. CloudFormation **deregisters** old task-definition revisions on completion, so "rollback to :N" means redeploying the recorded inputs as new revisions. During a rollout, use `cancel-update-stack`. The ECS circuit breaker auto-reverts failed tasks.

## 3. Preview Core (capiro-backend `backend-import`)

**Kit:** `shipping/core-kit/`, as adapted for the new-stack clone (O135–O141). Make a copy per release (`ship-core-<sha8>`):
1. **kit.env:**
   - set `SOURCE_SHA`, `SOURCE_BRANCH` (`backend-import`, or the PR branch for a pre-merge qualification build);
   - `ARCHIVE_SHA256` of `git -c core.autocrlf=false archive --format=zip -o core-<sha>-lf.zip <sha>`;
   - the rollback TD, digest and sha;
   - `CLONE_DB_HOST`.
2. **buildspec.template.yml:** replace **both** occurrences of the SHA and the archive hash. The hash line is indented; a missed hash shows up as the `pinned-source-checksum` stage failing.
3. **Run the steps:**
   - `00-preflight`;
   - `01-upload-source`;
   - `02-build`: CodeBuild `capiro-preview-first-chat-core-alpine-amd64-build`, which runs the in-image static probe, runtime probes and isolated entrypoint DB gate;
   - `03-scan-gate`: 0 findings;
   - `04-register-td`: changes only image, RELEASE_SHA and **DB_HOST → clone**. `DATABASE_URL` is empty; the entrypoint composes it from DB_*;
   - `045-migrate-clone`: the one-off family `capiro-preview-core-clone-migrate`, with the Core image, master DB login and execution role `capiro-preview-core-clone-migrate-exec`; it runs the image's `migrate` verb;
   - `05-roll`;
   - `06-verify`;
   - `90-rollback` returns to `:3` (shared DB, unmigrated, so the old code stays compatible).
4. **Runtime-closure contract:** if `package.json`, the lockfile or `schema.prisma` changed, the contract (`docs/runtime-production-closure-20261014/RUNTIME-CLOSURE-CONTRACT.json` plus the Prisma pins in `runtime-closure-contract.cjs`) must be regenerated **in a PR** first. PR #107 is the precedent; otherwise the static probe fails "frozen input mismatch".
5. **Migrations: clone only.**
   - The live shared DB is never migrated by this programme.
   - Migrations run as the **Aurora master** user (`/capiro/dev/aurora/master`), as live does. A migration run as the app user leaves wrongly-owned tables; that's why O140 re-cloned.
   - The clone auto-pauses after 1800 s idle. The first connection after a pause fails Prisma's 5 s timeout (P1001), so retry once.
   - **Re-clone:** `shipping/core-kit/reclone.sh`. It deletes and recreates `capiro-newstack-preview-clone` (copy-on-write from the shared cluster) and refuses unless the clone carries the `Purpose=newstack-preview` tag.
6. **#108 must merge before any clone migration.** It moves self-declared source-only/reserved migrations out of `prisma/migrations`. Without it, migration `20281012020000` fails (42701 on `clients.account_owner_version`).

## 4. Preview frontend (capiro-frontend `main`)

Kit generator: `shipping/ship-fe-kit/make-fe-ship-kit.mjs <sha> --worktree <clean worktree> --label <x>`. It writes `ship-fe-<sha8>` with steps 00–08 and `R1-rollback`.
1. **Source archive:** `git archive` (no autocrlf), then the commit's `scripts/verify-preview-archive.py`.
2. **Upload:** a new S3 version of `s3://capiro-portfolio-preview-source-967807252336-us-east-1/inputs/portfolio-source.zip`.
3. **Build:** CodeBuild `capiro-portfolio-preview-build`, with `EXPECTED_SHA` and `EXPECTED_S3_VERSION`. The image lands in ECR `capiro/portfolio-preview`, tagged with the commit.
4. **Scan:** read it back with `describe-image-scan-findings`. The gate is 0 findings.
5. **Deploy:** a change set on stack `Capiro-Portfolio-Preview-Service` with only `ImageUri` changed.

Test in a WSL `/opt` copy with `npm ci --ignore-scripts`; the Windows `node_modules` has junctions. Last shipped per Fable's record: **2abf9cdd**. `main` has #116 merged and not deployed.

## 5. Health and live checks

- **Kit health gates:** service stable, healthy targets, and 19-verify render equality. These are part of shipping.
- **Live acceptance:** post a packet (PROCESS.md §6.3) on #202 for **astra 6**. The first packet for eb657920 gave criterion 1 FAIL (ATTEMPT_LOST: the owner hot path took 112 s, as on C11). Criteria 2–5 are BLOCKED until S1 ships.
- **Telemetry for diagnosis:** CloudWatch `/meri/product-preview/{control,worker,runner,owner,proxy,issuer}`. `meri.model.request` (proxy) and `meri.turn.counters` (owner) carry `ownerExchangeMs`, `OwnerExchanges`, `AwsCalls`, `CoreCalls` and `DbStatements`. Refusals show as `CONTROL_SESSION_REFUSED step=… code=…` in control.

## 6. P2 gates (Docker)

The P2 pinned-image gates use `phases/p2a-harness/` (the in-image proxy tests, owner Node suites, composed test, mutation scripts and `ship-gates.sh`), run in WSL with:
- the P0 harness at `43b705c8`;
- the deployed proxy image `qualification-worker@sha256:a838846f…` (proxy:44);
- the runtime image `meri-p0-runtime:<sha>`.

The D3 reviewer's comments on #196 (c703e9f3, a235825f) record the exact commands, and its final gate comment for ba548925 and bfe98e96 will too.
