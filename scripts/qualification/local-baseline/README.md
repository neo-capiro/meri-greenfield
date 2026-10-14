# Local baseline runner

Reproduces the existing source checks of this repository on an ordinary Linux host and records every outcome, including failures, in one machine-readable receipt. It exists so that an implementer and an independent reviewer can rerun the same checks at an exact commit without rediscovering the host facts the existing test sources assume (Unix-socket PostgreSQL paths, root-level dependency links, Node flags, non-root execution).

It is qualification tooling only. A passing run proves source behavior on the host that ran it; it does not establish image admission, native Fargate/Temporal/provider behavior, live authority or release acceptance.

## What the existing checks assume

| Assumption in existing test sources | Supplied by |
| --- | --- |
| PostgreSQL 16 on `/tmp/meri-broker-pg-socket-20261014` (databases `postgres`, `meri_prepared_launch`) and `/tmp/meri-prepared-kickoff-pg-20261014/socket` (`meri_inspection_final`), Unix-socket only, canonical migrations applied | `provision-postgres.sh start` |
| `MERI_INSPECTION_TEST_SOCKET`, `MERI_INSPECTION_TEST_DATABASE`, `MERI_PREPARED_LAUNCH_DATABASE`, `MERI_REVIEW_SOURCE_ROOT` | `run-suites.mjs` sets the canonical values when absent |
| Root `node_modules/@capiro/meri-contracts`, `@anthropic-ai/claude-agent-sdk`, `@aws-sdk/client-s3` (the image recipe's links) plus test-only `pg` and `jszip` | `link-dependencies.sh` |
| `node --experimental-test-module-mocks` for `apps/runtime` and native-authority mocks; `--experimental-vm-modules` for the standalone browser-module control | per-suite flags in `suites.json` |
| Non-root UID: `assertRunnerWorkspace` refuses UID 0 | the runner refuses root unless `--allow-root` |
| No ambient `AWS_*`, `ANTHROPIC_*`, `DATABASE_URL`, `NODE_EXTRA_CA_CERTS` and similar: the runner CLI refuses ambient credentials and extra-CA warnings corrupt exact stderr assertions | environment scrub in `run-suites.mjs` |
| Orphaned grandchildren (LibreOffice, supervisors) must be reapable for process-group absence proofs | `subreaper.py` wraps every suite |
| Writable `MERI_PIPELINE_ARTIFACT_ROOT` and `MERI_ASSOCIATION_ARTIFACT_ROOT` for the skill pipeline checks; `MERI_DOCUMENT_PYTHON`/`MERI_PYTHON`/`MERI_SOFFICE` for the checks that honor them | scratch directories under `<out>/scratch` and `command -v` lookups, recorded under `environment.supplied` in `RESULTS.json` |
| Files that share one database run serially | `concurrency: 1` in `suites.json` |

Several existing document/office checks hard-code the Codex host Python path `/opt/codex/runtimes/codex-primary-runtime/dependencies/python/bin/python3` and `.../bin/override/soffice`; a Docker daemon is needed for the image-closure build control; `apps/runtime/artifacts/test` writes one-shot evidence receipts and refuses to overwrite them. These are recorded under `knownHostRequirements` and show up as retained failures where absent.

## Run

```sh
# once per host, as root or as the postgres account owner
scripts/qualification/local-baseline/provision-postgres.sh start
scripts/qualification/local-baseline/link-dependencies.sh
# as a non-root user with the per-package locks installed (npm ci --ignore-scripts in each package)
node scripts/qualification/local-baseline/run-suites.mjs --out /path/to/receipt-dir
scripts/qualification/local-baseline/provision-postgres.sh stop
```

`run-suites.mjs --only name,name` runs a subset. Exit 0 means every suite exited 0; exit 1 means at least one suite failed and `RESULTS.json` plus per-suite `*.stdout.txt`/`*.stderr.txt` were still written; exit 2 is a usage or configuration refusal before any suite ran. `RESULTS.json` records the exact head/tree, host facts, each suite's command, exit code, Node summary counts, failing test names with their first error line, and output hashes.

The runner performs no network access, provider call, cloud action or migration against any product database. Provisioned clusters live under `/tmp/meri-local-baseline-pg` with `fsync=off` and trust authentication: disposable local evidence only.
