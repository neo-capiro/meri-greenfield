# Repeatable validation and shipping

Reference: [pinned handover](https://github.com/neo-capiro/meri-greenfield/tree/90c250288647a738df2f8a92dd1db6fb549655f8/docs/handover/20261022) and CODEX-SETUP.md. Procedures below are documented only; Wave1 stays with its owners and Wave2 is not started.

## Validation

| Repo | Bounded/module checks | Required wider evidence |
|---|---|---|
| Meri | npm run check:contracts; node --test exact touched modules with their flags | npm run check / check:contracts:distribution / check:sdk-evidence / check:infra as affected; runtime package typecheck; brief-specific Docker/pinned-image gates |
| Core | pnpm --filter @capiro/api test --runInBand --runTestsByPath src/<owned>.spec.ts | API build/lint/typecheck and affected module suites; runtime closure regeneration on manifest/lock/schema changes; image static/runtime probes and isolated PG16 |
| Frontend | node --test touched .mjs modules; web workspace Vitest exact test paths | npm test, npm run typecheck, npm run build; web lint; affected browser/visual/accessibility checks and container smoke |

Install only in owned environments: Meri npm ci on Node24; Core pnpm9.12.0 install --frozen-lockfile; frontend Node24/npm11.9.0 npm ci --ignore-scripts in WSL /opt. Do not copy Windows junction-based node_modules. Infra needs package links, MERI_REVIEW_SOURCE_ROOT, real Git and cryptography>=42. Tests use isolated PostgreSQL16 and throwaway PKI. Never run a real DB migration as validation. Select required checks from the brief and changed consumers; no blanket suite-per-edit hook.

## Release checklist (future authorized execution only)

All AWS commands use --profile capiro-dev and PYTHONUTF8=1; verify expected account/region. Do not fall back to default. Prepare rollbacks and validate current resource state first. Kit exit2 means wrong state; exit3 means read back before rerun. Never invoke mutating steps to test arguments.

Meri/proxy: use existing ship-kit/tools/release-candidate.sh <sha-on-main> [--reuse-proxy-kit C:/dev/fable/ship-proxy-<sha8>]. It pushes a candidate branch and stages01–15, including credential-bearing11/12: this is not a dry run. Before a future authorized release, use the Secrets Manager preparation below; no private material retrieval is part of setup. Read meri-ledger-read.sh against the intended DB before assuming migration state. When separately authorized, execute16-execute-model.sh,17-execute-issuer.sh,18-execute-app.sh,19-verify.sh back to back in one foreground session, stopping on errors and reading state before recovery. Owner/proxy restart together; wait at least60s after the last gate=pair line and preserve stricter script gates. Recheck current secret-label capacity (historical quota20, used16).

Core: regenerate/adapt the latest kit, pin SOURCE_SHA/SOURCE_BRANCH/ARCHIVE_SHA256 from git -c core.autocrlf=false archive --format=zip; replace both SHA/hash occurrences in buildspec.template.yml. Never print kit.env. Steps00–03 preflight/upload/build/in-image probes/scan; steps04 register,045 snapshot-first clone migration as Aurora master,05 roll,06 verify only in the coordinated cut-over. Current qualified source ca4de503 supersedes89fcf2bb references in older plan text; resolve before execution. Rollback90 returns to revision3.

Frontend: node ship-fe-kit/make-fe-ship-kit.mjs <sha> --worktree <clean-worktree> --label <x>. Generator already runs00/01/02 (preflight/archive/dry); gate steps03–05 upload/build/readback-scan, with00 and02 rechecked as required. Optional02b-rehearse needs WSL/Linux Docker. Deploy06–08; R1-rollback-to-<rev> is prepared first. Current transferred kit87a84951 serves revision22 and rolls back to21.

Cut-over: use plan/NEWSTACK-CUTOVER-PLAN.md only after exact pins are reconciled. Snapshot clone, prepare reverse rollbacks, quiet window/no running turns, read clone Meri ledger, forward Core migration, Temporal SQL_HOST_NAME/TLS, coordinated Meri16–19, Core register/roll/health. Never split Core and Meri across databases. Never delete/re-clone or migrate the shared live DB for Core. Setup does not authorize this Wave1 operation.

Transferred release folders are evidence from neomart. Regenerate for EC2, verify external baseline/material dependencies and the authorized Secrets Manager identity. Do not execute transferred per-release scripts as-is. No new global scripts or database MCP are introduced.

## Private-material preparation for a future authorized Meri release

The updated neomart-kits README and Neo's direct instruction supersede old neomart-only private-step directions. Required IAM: secretsmanager:GetSecretValue and secretsmanager:DescribeSecret on meri/preview/private-pki and meri/preview/core/identity-bearer in us-east-1/account967807252336. Do not change IAM during setup or retrieve secrets to test access.

In a qualified Linux shell with owner-only scratch permissions, set AWS_PROFILE=capiro-dev, AWS_REGION=us-east-1 and PYTHONUTF8=1; shell tracing must be off. Run `bash ship-kit/tools/fetch-private-pki.sh <owner-only-scratch-dir>`, then `export MERI_PKI_DIR=<scratch>/meri-preview-private-pki` and `export MERI_PREP_DIR=<checkout>/docs/handover/20261022/shipping/stage3-prep`. The existing fetch helper validates the archive against the ContentSha256 tag without printing contents. Generate the kit and follow the release runbook, with16–19 together in one foreground session. Do not print, commit, paste or put secret material in logs or artifacts.

After success or failure, remove scratch PKI and the stage-3 render directory. Before any recursive cleanup, verify resolved absolute paths are exactly the owned scratch/render targets; use a single shell end-to-end, never broad or interpolated cross-shell deletion. Keep non-secret release evidence. No secret retrieval or cleanup command was executed during setup.
