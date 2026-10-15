# Local baseline runner

Reproduces the existing source checks of this repository on an ordinary Linux host and records every outcome, including failures, in one machine-readable receipt. It exists so that an implementer and an independent reviewer can rerun the same checks at an exact commit without rediscovering the host facts the existing test sources assume (Unix-socket PostgreSQL paths, root-level dependency links, Node flags, non-root execution).

It is qualification tooling only. A passing run proves source behavior on the host that ran it; it does not establish image admission, native Fargate/Temporal/provider behavior, live authority or release acceptance.

## What the existing checks assume

| Assumption in existing test sources | Supplied by |
| --- | --- |
| PostgreSQL 16 on `/tmp/meri-broker-pg-socket-20261014` (databases `postgres`, `meri_prepared_launch`) and `/tmp/meri-prepared-kickoff-pg-20261014/socket` (`meri_inspection_final`), Unix-socket only, canonical migrations applied | `provision-postgres.sh start` |
| `MERI_INSPECTION_TEST_SOCKET`, `MERI_INSPECTION_TEST_DATABASE`, `MERI_PREPARED_LAUNCH_DATABASE`, `MERI_REVIEW_SOURCE_ROOT` | `run-suites.mjs` sets the canonical values when absent |
| Root `node_modules/@capiro/meri-contracts`, `@anthropic-ai/claude-agent-sdk`, `@aws-sdk/client-s3` (the image recipe's links). Runtime sources and suites no longer need the S3 or SDK links: they import those SDKs through their owners (`apps/artifacts/storage/s3-sdk.mjs`, `apps/worker/conversation/agent-sdk.mjs`). Test-only `pg` and `jszip` are declared devDependencies of the root (`pg` 8.23.1, `jszip` 3.10.2) and of `apps/control/conversations` (`pg` 8.23.1), so no link is needed for them | `link-dependencies.sh`, only for comparison runs; the clean-checkout procedure creates no links |
| `node --experimental-test-module-mocks` for `apps/runtime` and native-authority mocks; `--experimental-vm-modules` for the standalone browser-module control | per-suite flags in `suites.json` |
| Non-root UID: `assertRunnerWorkspace` refuses UID 0 | the runner refuses root unless `--allow-root` |
| No ambient `AWS_*`, `ANTHROPIC_*`, `DATABASE_URL`, `NODE_EXTRA_CA_CERTS` and similar: the runner CLI refuses ambient credentials and extra-CA warnings corrupt exact stderr assertions | environment scrub in `run-suites.mjs` |
| Orphaned grandchildren (LibreOffice, supervisors) must be reapable for process-group absence proofs | `subreaper.py` wraps every suite |
| Writable `MERI_PIPELINE_ARTIFACT_ROOT` and `MERI_ASSOCIATION_ARTIFACT_ROOT` for the skill pipeline checks, and `MERI_SELECTED_OUTPUT_ARTIFACT_ROOT` so the selected-output lifecycle check does not write into the checkout; `MERI_DOCUMENT_PYTHON`/`MERI_PYTHON`/`MERI_SOFFICE` for the checks that honor them | scratch directories under `<out>/scratch` and `command -v` lookups, recorded under `environment.supplied` in `RESULTS.json` |
| Files that share one database run serially | `concurrency: 1` in `suites.json` |

Several existing document/office checks hard-code the Codex host Python path `/opt/codex/runtimes/codex-primary-runtime/dependencies/python/bin/python3` and `.../bin/override/soffice`; a Docker daemon is needed for the image-closure build control; `apps/runtime/artifacts/test` writes one-shot evidence receipts and refuses to overwrite them. These are recorded under `knownHostRequirements` and show up as retained failures where absent.

## Clean checkout

From a fresh clone or a `git archive` export, with Node 24 on `PATH` and npm registry access:

```sh
scripts/qualification/local-baseline/clean-checkout.sh --out /path/to/receipt-dir   # add --allow-root when the host user is root
```

The script installs every package lock with `npm ci --ignore-scripts --no-audit --no-fund` (the image recipe's flags; storage also installs its test-only `pg`) in dependency order: `packages/contracts`, the root, the image recipe's packages, then the qualification packages. It refuses a `node_modules` that is a symlink, because `npm ci` deletes it, and refuses when the repository's package locks differ from its list. It then runs `run-suites.mjs` with the remaining arguments. It creates no root links and changes no lock or source file.

`MERI_REVIEW_SOURCE_ROOT` is set by `run-suites.mjs` to the checkout under test (its `--repo`, default: the checkout containing the script). The durable-invocation review harness that reads it (`docs/qualification/candidates/durable-invocation-20261012/review/invocation-harness.mjs`) is hashed historical evidence and stays unchanged. To run one suite by hand, set it exactly yourself from the repository root: `export MERI_REVIEW_SOURCE_ROOT="$PWD"`, and use `--experimental-test-module-mocks` for `apps/runtime` and native-authority tests (`npm test` in `apps/runtime` already passes it).

Failures that depend on the host stay in the receipt: no Docker daemon (image closure), a root user (runner workspace checks), no PostgreSQL clusters (`*-pg` files; start them with `provision-postgres.sh`), and absent LibreOffice or Codex-host Python paths. Ambient `AWS_*` and similar variables are scrubbed from every suite, never passed in. `dependency-ownership.test.mjs` fails on any undeclared first-party import. It keeps two reviewed rows: the frozen runtime SDK type-only fixture, and the schedules harness's Temporal client, which resolves through a `createRequire` anchored at `apps/control/conversations/package.json` (asserted by the same test). Several artifact checks still resolve `jszip` through the hard-coded Codex-host `pptxgenjs` path; that is a host requirement, not a declaration gap.

## Run

```sh
# once per host, as root or as the postgres account owner
scripts/qualification/local-baseline/provision-postgres.sh start
scripts/qualification/local-baseline/link-dependencies.sh
# as a non-root user with the per-package locks installed (npm ci --ignore-scripts in each package)
node scripts/qualification/local-baseline/run-suites.mjs --out /path/to/receipt-dir
scripts/qualification/local-baseline/provision-postgres.sh stop
```

`run-suites.mjs --only name,name` runs a subset; `--name-pattern REGEX` adds `--test-name-pattern` to the selected node-test suites for a targeted rerun of failing tests (select the suites with `--only`; npm suites refuse it). `--source-commit SHA` records the commit an archive export was made from; a checkout without its own `.git` records no head, and the receipt marks the declared commit unverified. Exit 0 means every suite exited 0; exit 1 means at least one suite failed and the receipts were still written; exit 2 is a usage or configuration refusal before any suite ran.

`--out` must be outside the checkout under test (the runner refuses otherwise), so receipts never change the inventory, hashes or status of what they describe. It receives:

- `receipts/<suite>.json` (`meri.local-baseline-suite-receipt.v1`), one per suite: source root/head/tree/uncommitted count and declared commit; host Node version and executable, npm version, kernel, UID/GID/user; selectors (`--only`, `--name-pattern`, the exact file list, Node flags, concurrency or npm script, the `MERI_*` fixture selector values, and the names, never values, of scrubbed variables); the exact argv, subreaper-wrapped argv and absolute cwd; exit code, signal, timeout, duration, summed Node spec counts, every failing test name with its first error line; stdout/stderr paths, byte counts and SHA-256.
- `<suite>.stdout.txt` / `<suite>.stderr.txt`, the raw outputs those hashes cover; `RESULTS.json`, the run summary with totals; `SHA256SUMS` over all of these (`sha256sum -c SHA256SUMS` from the receipt directory).

## Inventory

`suites.json` accounts for every test file in the checkout (`*.test.{mjs,js,cjs,ts,mts}`, `test_*.py`, `*_test.py`, outside `node_modules`). A file is covered by a node-test suite's `files` globs, or by an npm suite's `covers` list, each entry of which must occur in that package's scripts; otherwise one `exclusions` entry must match it and give the reason. `inventory.test.mjs` fails on any file that is neither, and on empty suites, stale covers, stale exclusions or a file both covered and excluded. Current exclusions: historical evidence under `docs/`, the Python qualification-tool tests (this recipe runs Node suites only), and `infra/qualification/checkpoint-security.test.mjs`, whose synthesized template no package script produces (separate command: `node infra/qualification/checkpoint-app.mjs && node --test infra/qualification/checkpoint-security.test.mjs`).

The runner performs no network access, provider call, cloud action or migration against any product database. Provisioned clusters live under `/tmp/meri-local-baseline-pg` with `fsync=off` and trust authentication: disposable local evidence only.
