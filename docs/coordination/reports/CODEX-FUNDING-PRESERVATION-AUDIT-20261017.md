# Funding increment preservation audit - 17 October 2026

Disposition: **SOURCE PRESERVATION CHECK PASSED after the coordinator's new-file measurement repair**. This is a small read-only audit of branch `codex/meri-funding-asof-20261017`, against base/observed HEAD `615a5467ffa555f913ad49258b3919723ecf207d`. Only this new report is written by the audit lane, avoiding the existing Core pending report and staged-document conflicts. No application source, candidate, image pin, release checkout, installation or live system is changed here. Parent's latest steering places shipping and acceptance with dot; this audit does not transfer ownership or establish shipment acceptance.

## Preserved capabilities and withheld funding

The actual passive `createGeneralReadFamilyHandlers` factory constructed all three retained operations through their existing canonical bindings. The current `scope-ledger.json` **sourceExposure rows** retain `adapter-present` and the exact general operations. The unchanged SDK `READ_FAMILIES` retains research-portfolio and florida-budget without an operation subset excluding these reads:

| Operation | Canonical family | Source handler constructed | SDK family eligible | Live claim |
| --- | --- | --- | --- | --- |
| `get_research_portfolio@0.2.0` | research-portfolio | Yes | Yes | None |
| `get_research_portfolio_changes@0.2.0` | research-portfolio | Yes | Yes | None |
| `get_florida_budget_project@0.2.0` | florida-budget | Yes | Yes | None |

The five newly authored funding handlers also construct passively, but `funding-opportunities` remains absent from SDK `READ_FAMILIES`; every funding operation therefore remains SDK ineligible. The five checked IDs are `search_funding_opportunities`, `get_funding_opportunity_requirements`, `get_funding_opportunity`, `get_opportunity_client_context`, and `get_opportunity_government_landscape`. No source HTTP, credentials, source results, installation or live eligibility was exercised. The [Core bridge qualification gate](CODEX-FUNDING-CORE-BRIDGE-PENDING-20261017.md) remains held.

## Unchanged protected surfaces and shipping checkout

Read-only Git comparison against the exact base found no changed tracked lockfile, no changed file in the 120-file `packages/contracts/retrieval-0.2/` subtree (including catalog/schema/validators), and no infrastructure/workflow change. The narrow lock path inventory contained 15 tracked lockfiles and no changed member. A bounded text scan of 17 materialized startup/deployment source/config files found no funding operation IDs and no changed member. No new runtime production file was introduced. The only changed existing runtime production file is the allocated `apps/runtime/native-authority/native-read-credentials/source-read-context.mjs`, which supplies source context rather than changing startup.

Representative protected Git object checks used `git rev-parse <base>:<path>` and `git hash-object --path=<path> <path>`; the working canonical blob matched the base in every row below. Canonical Git blobs account for checkout line-ending filters.

| Protected path | Matching base/working Git blob |
| --- | --- |
| `package-lock.json` | `87442d3c0c53969ed0a7a5f7706b9bf7eb4400ae` |
| `packages/contracts/package-lock.json` | `551afd0dc26f037db0c5cf240299f707f12ba929` |
| `apps/runtime/package-lock.json` | `52c56e1c13758ea680ed23c7b908e155b5c0c91e` |
| `apps/worker/conversation/package-lock.json` | `881a9a7f8d00abd6b5c13cd91ba84f89b9e35d1f` |
| `packages/contracts/retrieval-0.2/catalog.json` | `9773e4b2a8ecaadf2fa2cecfe53b1bc6d8e38001` |
| `packages/contracts/retrieval-0.2/catalog.schema.json` | `51a764cfeb94a0e6fdce99c2bab3ce62d6b95853` |
| `apps/worker/conversation/reads/families.mjs` | `bf6654c43a441f289cdcb22817af4bea02a186fb` |
| `apps/runtime/product-applications.mjs` | `542dcc1d5c9a93b548c7d3858fcd1ca2c5fb3fa1` |
| `apps/runtime/native-runner-gateway.mjs` | `de8bf216bc4d1f45282d57516658813a7116b33f` |

The shipping checkout at `C:/Users/Administrator/Documents/Codex/2026-10-16/task/capiro-rebuild/repos/meri-basic-chat` was inspected only with `git --no-optional-locks rev-parse HEAD` and `git --no-optional-locks status --porcelain=v1 --untracked-files=normal`. It reported exact historical PR98 HEAD `caa7810ff19c09c8f7ea1c2524c025f36f99ccd6` and an empty status. No checkout, reset, index refresh requiring optional locks, source mutation, image/candidate change or shipping action was performed there.

## New-file measurement gap and verified repair

Initial passive manifest inspection confirmed the coordinator's conditional additions measured the finite observation validator/schema for retained HTTP adapters and the funding request helper for native families. It also found one **new-owned direct dependency** missing from non-funding manifests: measured `integration.mjs` statically imports new `families/funding-opportunities.mjs`, whose new handler/helper imports continue transitively. This observation was restricted to the five new production files; no pre-existing global import-closure expansion was requested.

Root repaired `integration.mjs` by including all five new files in unconditional `COMMON` and deduplicating labels with `Set`. The audit made no source edit. Final source SHA-256 values are:

| Source | SHA-256 |
| --- | --- |
| `apps/gateway/general-reads/integration.mjs` | `753e55fe0ec3605558011477e990085b701f1e2cd545ccaea31b3137c1673d7e` |
| `apps/gateway/general-reads/families/funding-opportunities.mjs` | `056a354b15e9e96fdc25a8a6aed3c37c911f8435259b485c525a157e746a1530` |
| `apps/gateway/sources/funding-opportunities/handler.mjs` | `de7e192577b676423a085249e6af23df76882444d4029f0d2d3e8896de473836` |
| `apps/gateway/sources/funding-opportunities/request-context.mjs` | `fff73469a064a7b2db64b92e46b1734cd77f207f6f0c2bc96981000d13bbaddb` |
| `packages/contracts/native-read-observation-0.2/validate.mjs` | `f02d651c9d157428040473eba39dd899498a6acb811483522940f6115a7281fe` |
| `packages/contracts/native-read-observation-0.2/schema.json` | `5bbe3c113adf2cd1b338ee432c2fb73ec368b0a336d0632fbcf4a929cb81d0de` |

The final passive check created only metadata/handler closures for research-portfolio, florida-budget, funding-opportunities and bill-text. It executed no handler, supplied no credentials and installed a fetch port that throws if called. Across ten operation manifests, all five new files were measured, the new-owned relative-import audit found **zero remaining gaps**, and every source label was unique. Inspection of unconditional `COMMON` establishes the same inclusion rule for every other family composition; those families were not separately constructed in this small audit.

| Final measured family | Distinct files | Source-manifest SHA-256 |
| --- | --- | --- |
| research-portfolio, both operations | 15 | `0ef08d0ba210354144980613c73227405cd63eeb349c74d6ba66e02c7c6a5262` |
| florida-budget | 16 | `740475f5fea480d9afa46b7759fde36608dbf2d10e9a541d68a0d2f5b8ad8fa6` |
| funding-opportunities, five operations | 27 | `c56904ea06346a9d219ed07fd572d846a3ae3d0516f8d7ebf482131316fe301e` |
| bill-text, two operations | 29 | `d456c61ea4894d4c105f1f36b71ff85612531ee33be1623b06cd1a0e30cf669b` |

These changed manifest hashes require fresh matching installation/qualification evidence. The passive result does not refresh a receipt or make funding live.

## Commands, failures and completion

Commands used the borrowed Node `24.19.0` with `--preserve-symlinks --max-old-space-size=256`, read-only Git (`--no-optional-locks`), filesystem hashing, canonical resolver/SDK data imports and the passive general-read factory. Protected comparisons used `git diff --name-status 615a5467ffa555f913ad49258b3919723ecf207d` plus the explicit blob checks above. No heavy/code suite was run.

One auxiliary inventory attempt ran unbounded `git ls-files` through Node `execFileSync` with its default output buffer and failed `ENOBUFS`; Node terminated that child. It made no mutation. The audit was rerun successfully with narrow runtime/infra/retrieval/lock pathspecs and a bounded 2 MiB capture. The initial new-file measurement omission was reported and repaired by root; its final verification passed as described above. No other audit check remains failed or pending.

Report local links/whitespace passed. No new source changes, release mutation, live source call, credentials, dependency install, archive, background process or deployment occurred in this lane. Parent retains final source review, coherent integration checks, publication and shipping acceptance; actual Core bridge and installation qualification remain separate held gates.
