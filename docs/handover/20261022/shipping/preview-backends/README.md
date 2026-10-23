# Preview backends and the Workspace migration (scripts used on 2026-10-23)

These brought up the preview backends on the new-stack clone and migrated the clone for Workspace. They hard-code neomart paths (`C:/dev/fable/...`) and account 967807252336; read each before running it. Task-definition dumps and the one-off diagnostics from the same session are left out: get a live definition with `aws ecs describe-task-definition`.

| File | What it did |
|---|---|
| `preview-backend-tds.py` | Registers `capiro-preview-<service>` task definitions from the live `capiro-dev-<service>` ones: image to the preview ECR digest, `DB_HOST` to the clone, `RELEASE_SHA`, background jobs off. Registration only; no service |
| `ecr-pull.json` | The managed policy `CapiroPreviewBackendsEcrPull`, so the live execution role can pull the preview images |
| `shift.json`, `cond-3.json`, `cond-5.json`, `cond-6.json`, `catchall.json` | The ALB rule changes on `capiro-prod-alb` :443: renumber the live rules upward, add the host-scoped preview rules for `/strategy-api/*`, `/workspace-api/*` and `/intel-api/*`, and move the preview catch-all. The result is in `../alb-snapshots/` |
| `ws-build.py`, `ws-buildspec.yml` | Build the preview Workspace image through CodeBuild |
| `ws-migrate-td.py`, `ws-migrations.txt`, `run-task.py` | Register and run the one-off task that applies the missing Workspace migrations to the clone (the `ws_draft.client_id` column; snapshot first) |
| `ws-ledger.cjs` | Reads the Workspace migration ledger |

The Core side of the same session (image build, scan, register, roll) used the kit in `../core-kit/`.
