# neomart release kits (snapshot 2026-10-22 ~17:30 UTC)

Copied from `C:\dev\fable\` on neomart, with source archives (`*.zip`, `*.tar`), `node_modules` and `product-source-members.json` (4 MB, derivable) left out. No secret values are included. The kits do contain AWS identifiers (account, ARNs, Secrets Manager version IDs, digests) and neomart-local paths.

| Folder | What it is | State |
|---|---|---|
| `ship-kit/` | Meri kit generator (`make-ship-kit.mjs`) and `tools/release-candidate.sh` | Current |
| `ship-proxy-kit/` | Model-proxy image kit generator | Current |
| `ship-fe-kit/` | Frontend kit generator (`make-fe-ship-kit.mjs`) | Current |
| `ship-205eead4/`, `ship-proxy-205eead4/` | The **live** Meri release (P2.1): control:48, worker:47, runner:33, owner:46, proxy:46, issuer:47. Its deployment inputs are the Meri rollback target for the cut-over | Executed |
| `ship-core-ca4de503/` | **The cut-over Core kit**: `backend-import` `ca4de503`. Steps 00–03 are done: image `capiro/preview-core@sha256:036b368c…`, probes PASS, 0 findings. Steps 04, 045, 05 and 06 run only in the cut-over (`../../plan/NEWSTACK-CUTOVER-PLAN.md`). `90-rollback` returns to `:3` | Built, not deployed |
| `ship-fe-87a84951/` | The **live** frontend: `capiro-portfolio-preview:22`. `R1-rollback-to-21.sh` returns to 4e2c770f | Executed |

## Things that only work on neomart

- **Meri release steps 11-private-core and 12-private-render** read the private PKI (`C:\dev\fable\meri-preview-private-pki`). They write stage-3 render dirs (`C:\dev\fable\meri-stage3-<timestamp>`). Neither leaves neomart, and the credential-bearing steps are Neo's. Any Meri release therefore needs neomart for those two steps.
- **Kits use absolute neomart paths** (`C:/dev/fable/...`) and the AWS CLI profile `capiro-dev`. On another machine, regenerate a kit with the generators rather than reusing these per-release folders.
- **Docker gates** ran in WSL `Ubuntu-24.04` with native Docker.

See `../../SHIPPING-RUNBOOK.md` for the procedures and `../../decision-log/DECISION-LOG.md` (through O195) for every decision.
