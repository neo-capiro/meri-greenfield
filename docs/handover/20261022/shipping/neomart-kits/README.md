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

## Portability notes

- **Meri release steps 11-private-core and 12-private-render** read the private PKI. It is now fetched from Secrets Manager on any machine (next section). They write a stage-3 render dir; keep it owner-only and delete it after the release.
- **Kits use absolute neomart paths** (`C:/dev/fable/...`) and the AWS CLI profile `capiro-dev`. On another machine, regenerate a kit with the generators rather than reusing these per-release folders.
- **Docker gates** ran in WSL `Ubuntu-24.04` with native Docker.

See `../../SHIPPING-RUNBOOK.md` for the procedures and `../../decision-log/DECISION-LOG.md` (through O195) for every decision.

## Private PKI is in AWS (2026-10-22, O196)

The private PKI is no longer neomart-only. Its contents are stored as Secrets Manager secret **`meri/preview/private-pki`** (binary tar.gz, 45 files). The tag `ContentSha256` = `79f0c3c75d5246f68f2595fdf5de2b9254988a76579d9624aa0f5a9554171c3b`.

On any machine with `capiro-dev` access, a Meri release runs as follows:
```bash
bash ship-kit/tools/fetch-private-pki.sh <owner-only scratch dir>   # verifies the hash; prints no contents
export MERI_PKI_DIR=<scratch dir>/meri-preview-private-pki
export MERI_PREP_DIR=<checkout>/docs/handover/20261022/shipping/stage3-prep
# make the kit, run release-candidate.sh … 11-private-core, 12-private-render, 13–19 as usual
rm -rf <scratch dir>/meri-preview-private-pki                        # when the release is done
```
`make-ship-kit.mjs` reads `MERI_PKI_DIR` and `MERI_PREP_DIR` (the defaults are the old neomart paths). The Core bearer was already in Secrets Manager (`meri/preview/core/identity-bearer`). The stage-3 helper scripts are in `../stage3-prep/`; they contain no secrets.

**If the PKI rotates:** re-upload with `put-secret-value --secret-binary` and update the `ContentSha256` tag in the same change.
