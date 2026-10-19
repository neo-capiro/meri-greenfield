# Public source348 render inputs

This directory makes the reviewed **public inputs** portable to the neomart checkout. It contains no Core membership receipt, identity credential, DB login, PKI material, generated capability, or bundle. It authorizes no build, AWS write, live SQL, task registration, deployment, or model call. The source/image/config pins below are preparation evidence, not live acceptance.

## Exact inputs

| Input | SHA-256 |
| --- | --- |
| [deployment-inputs.candidate.json](deployment-inputs.candidate.json) | `40d92b957a50dc70fa25f9495125679a0d3f1cb3b0c65451959d93dc239832d5` |
| [runtime-values.candidate.json](runtime-values.candidate.json) | `1f51b015ed9842ed7ebecb1510e6bd8c8f0993889400d1f63d6352878db678b1` |
| [image-scans.candidate.json](image-scans.candidate.json) | `160198f9187ee1ce125758a9ab096d480c022275535e7e2ba1e70648d620a6f7` |
| Root `package-lock.json` at source348 | `4a18a2e5eeb672758df381eba55653da2dc0d9e9ab26e3f6f7943ad19120753c` |

Source HEAD: `34851020aa0d73fead4db59ba6e26a098e2d0313`. Use Node `>=24 <25` and dependencies installed from this lockfile. The repository's earlier `infra/product-preview/first-chat/deployment-inputs.json` pins older images; do not substitute it for the candidate here.

| Image role | Immutable image | Source commit |
| --- | --- | --- |
| Node runtime | `967807252336.dkr.ecr.us-east-1.amazonaws.com/meri-greenfield/qualification-worker@sha256:7b295b4265141ff8feefc86dd3fec18e10be5e1a72cd88b7a50511ef53501044` | `34851020aa0d73fead4db59ba6e26a098e2d0313` |
| Proxy | `967807252336.dkr.ecr.us-east-1.amazonaws.com/meri-greenfield/qualification-worker@sha256:734a20ec036a9aacb1f99cd8f8d2a0d5a3319a44a27e13e14781e396ebec3551` | `34851020aa0d73fead4db59ba6e26a098e2d0313` |
| Temporal server | `967807252336.dkr.ecr.us-east-1.amazonaws.com/meri-greenfield/qualification-worker@sha256:f73ce01ef4739a77fad6ace3fbfbbe1f1aeaa553b5c263d705053a2f5063cf2d` | `989a4227e6da6f176975d798826904d71c3a9f9c` |

Runtime candidate: Claude Agent SDK `0.3.295`, CLI `2.1.295`, executable SHA-256 `4503bfe11a6c7fcc1e0b39b5e0d347c04248f750b03b0977b3ad6b531fe6f358`, runner SHA-256 `177a982b7b710eb1c13cdd372f44c8ba4043fbc429d0646e299b22dea0e992c2`, general-read measurement SHA-256 `4aac313bd13e8316d192f76b246ed46bede0159656b7bc7bee5152f80e09e238`. That inventory records 76 operations: 55 native, 12 retained with source-composable candidates, and nine without the selected startup composer. All 21 retained operations remain held and unqualified; this is not 76 active handlers.

The nine missing composer operations are `get_research_portfolio@0.2.0`, `get_research_portfolio_changes@0.2.0`, `get_research_evidence@0.2.0`, `read_monday_client_boards@0.2.0`, `mail.list_messages@0.2.0`, `mail.search_messages@0.2.0`, `mail.read_thread@0.2.0`, `get_florida_budget_project@0.2.0`, and `query_tasks@0.2.0`.

The deployment candidate intentionally retains `PENDING_CORE` under top-level `core`, `origins.coreOrigin`, and `origins.frontendOrigin`. These values are **not current Core authority**. The separate private `--core` input must come from a fresh authorized membership read. Any additional placeholder is a blocker. The intended frontend origin is `https://portfolio-preview.app.capiro.ai`; a read-only check of current Core task definition `capiro-preview-first-chat-core:2` found the same `WEB_ORIGIN` on 2026-10-19 at 03:27 UTC. The current deployment packet targets Linux X86_64/amd64; older ARM64 wording is stale.

The candidate has no top-level `features` block and the renderer has not run. Source348 treats absent `features` as no product-family activation; a later feature change needs a separately reviewed input and compatible runtime measurement. The certificate pins in the candidate are historical until the private custodian checks their current validity. [Image-scan evidence](IMAGE-SCAN-EVIDENCE.md) records the reviewed Node replacement evidence and the missing original producer receipt.

## Neomart handoff boundary

Fable may verify this commit and its hashes, inspect public file metadata, use the existing AWS profile **read only** in account `967807252336` / `us-east-1`, and report Core service health plus named public task fields (`RELEASE_SHA`, image, `WEB_ORIGIN`, `PREVIEW_NATIVE_GETS_ENABLED`). Read the latest ACTIVE **and** INACTIVE task-definition ARNs for all six `STAGE3_FAMILIES` roles immediately before preparing a new Stage 3 input. Do not reuse historical task-revision predictions. Confirm rendered feature flags against the applied-schema owner receipt; disabled source is not complete functionality. No neomart checkout path is assumed by this handoff.

**Neo personally executes any step that reads the existing identity credential, obtains and handles the authenticated Core membership receipt, creates private Core values, inspects PKI or DB logins, or generates/uploads material.** No agent should create a replacement credential or cross this boundary. Neo's fresh `POST /api/clio/application-authority/membership` read (body `{}`) must prove HTTP 200, active/admitted role, current `checkedAtMs`, `expiresAtMs` later than render, intended tenant/actor, and the real selected client UUID in `clientIds`. The `core-values` helper alone does not reject an expired old receipt. The historical private `core.json` and Stage 3 inputs must not be reused without this revalidation.

Neo locally checks all 13 certificates, pins, chains/key pairs, earliest `notAfter`, existing credential validity, and DB-login validity. If DB-password validity lacks existing authorized proof, report `UNKNOWN`; do not change trust, expiry, or configuration to force a pass. After the gates pass, Neo uses `stage3-deploy.mjs core-values` and `stage3-input` to write **new** private files, then personally runs:

```text
node infra/product-preview/first-chat/render-material.mjs --deployment-inputs <reviewed-public-candidate> --private <existing-private-custody> --core <fresh-private-core-values> --runtime <reviewed-public-runtime-values> --stage3 <new-private-stage3-input> --out <new-private-output-directory>
```

The renderer creates five local private bundles/capabilities and performs no AWS write. Any later `PutSecretValue` or bundle upload is a separate Neo-personal step after review; none is authorized here. Return only scrubbed statuses, public pins, fresh task ARNs/read time, certificate expiry, validity end, and expected/config/material-contract hashes. Never commit or send private inputs, membership JSON, credential bytes, raw failure stacks, `bundle.json`, or the full private summary.
