# Meri: final portable Fable handoff — 17 October 2026

## Start here

**Fable is the single Meri source, integration, image-qualification and shipping owner after this seal.** This includes Meri runtime/services, tools, documents, governed memory, settings, routines and Meri-specific UI. First priority is one connected desktop preview: authenticated login → real Meri prompt → streamed provider answer → saved conversation → reload. Deferred mobile and advanced product work remain in the backlog.

**Dot retains Core/backend, shared frontend/non-Meri modules, cross-service deployment coordination and live authenticated E2E acceptance.** Fable must coordinate Core activation, shared frontend edits, authentication, listener rules, shared schemas and migration IDs with dot. The frontend owner has published its current host/architecture repair at PR81; do not edit its shared files concurrently. There must be one named deployment owner per resource. This transfer is not an authorization for keys, credentials, grants, SQL, a paid build or a service count/routing change.

Root Meri implementation stopped at **2026-10-17 06:47:33 UTC**. Only source preservation, exact PR130 reception, handoff writing and verification followed. Feature owners' individual final cuts are recorded in their supplements. No owned install, build, browser, DB, provider, archive or service process is being handed over. Unattributed shared Node/Python processes were left untouched. No global process/permission change was attempted.

**Documentation/status cutoff:2026-10-17 07:14:24 UTC.** This includes dot's reported frontend terminal failure at07:12:55 and later completed scan. The build role was denied `ecr:DescribeImageScanFindings`; a separate authorized read later found the pushed digest's scan COMPLETE with zero HIGH/CRITICAL. CodeBuild remains FAILED, not qualified. No later cloud state is asserted and no IAM change/retry is authorized.

The immutable URL supplied with this document identifies the **documentation seal**. The product source it preserves is separately fixed at:

- **`59856683e07efde3e04772f6b5229faa931c4b85`**, tree **`d2120719e83132a2d62dce9d6ad3342d801725c1`**.
- Existing draft [Meri PR121](https://github.com/neo-capiro/meri-greenfield/pull/121), branch `codex/meri-first-chat-runtime-integration-20261017`. Before this publication it was at `0d6ba1590b41e3bc911e8c50f7c7407632101832`, based on Fable PR114 `7ef7c61c6093dc971d94a7879bbcfa4a38adfdfe`.
- **SOURCE HOLD: preserved incomplete integration, not a final accepted executable or deployed service.** Reviewed components and passing subsets do not establish a combined pass. One affected proxy startup fixture is known to error; root issuer/material/startup integration has not been rerun as one exact tree.

Read [ROOT-SOURCE.json](ROOT-SOURCE.json) for every new commit, parent, tree and changed-file blob/SHA-256. The final two product commits preserve 51 unfinished root paths and receive the exact 23 published PR130 blobs. No source was discarded to make this checkpoint look complete. Remote main is not the completed work: local-only NEOMART recovery and earlier accepted work are in the selected ancestry. Preserve existing checkouts; do not reset them to main or replay already-integrated side PRs.

## Reading order

1. [Architecture, services and fresh-machine commands](ARCHITECTURE-AND-RESUME.md).
2. [Current state, permissions, migration and live gates](STATE-AND-GATES.md).
3. [Exact tests, failures and unrun boundaries](CHECKS.json), plus the [independent proxy review](PROXY-REVIEW.md).
4. [All lanes and immutable pickup links](LANES.md). Fable receives **all Meri source**, but these independent trees are not silently merged into the first-chat checkpoint.
5. [Root source inventory](ROOT-SOURCE.json), [PR metadata snapshot](REMOTE-PRS.json), [exact PR130 receiving proof](ISSUER130-RECEIVING.json) and `verify_handoff.py`.

Final feature supplements: [read tools PR132](https://github.com/neo-capiro/meri-greenfield/blob/bba4ef68682812f303653f391df9ca586f41da57/docs/coordination/handoffs/meri-read-tools-final-20261017/README.md), [product/routines PR131](https://github.com/neo-capiro/meri-greenfield/blob/2a247510e7fa477466579971ca4e9a2366b2127f/docs/handover/20261017/fable-final/PRODUCT-FEATURES.md), [Objective custody PR129](https://github.com/neo-capiro/meri-greenfield/blob/047526c7022d04af6fd0f8faaae011171ef1eca2/docs/objective-source-reader-v2-20261017/FABLE-BOUNDARY-SUPPLEMENT.md), and [issuer PR130](https://github.com/neo-capiro/meri-greenfield/blob/eb603f28023c5fcbfcdbf42953e86411a1a83bca/apps/runtime/temporal-issuer/qualification/FABLE-HANDOFF-20261017.md). All preserve incomplete/unqualified boundaries. The read supplement provides a65-file partial tooling recovery excluding one **denied ledger payload**; exact local-only identifiers and pending authorization are in LANES. No indirect publication or retry of that payload occurred.

## Current cross-service truth

| Component | Source / image | Present limit |
| --- | --- | --- |
| Meri root integration | Source `59856683…`, with PR130 source received exactly | No successor image, final combined acceptance, live SQL/material/issuer/proxy/Temporal mount or real prompt. |
| Existing Meri image | Source `f005f77316bb8735e60f16c3ac99a5c8e3d71a34`; digest `sha256:6a03d5367c22a95db1fbc95a08b2bb1237164bfdf3b6f215f076a38833fffb8d` | Image build/scan passed for those older bytes only. It contains none of this runtime integration. |
| Core ordinary API | PR48 `6542f5b089656b6d255465edd464d06c2a0b408f`; digest `sha256:722a483259ebb5e9162b9294c26895bafa890fcfee45dc927ff1d2ec35fa071b` | Historical service 0/0/0; no current native admission. GET routing PR62/67 source-qualified, unapplied. |
| Frontend first-chat source | PR70 `31a140cddf798c32b5cc45ad22e7b672312b3ca3`; architecture-only successor PR81 `01cf1df981250841d40df5fe0389f47168593cce` | PR70 failed architecture. PR81 build5e2c6878 FAILED because its role lacked scan-read permission; pushed digest `sha256:e1c5799b786ba7f55cfd4b97587500e9eaeab5c3e71582dcc31ff75e09bd80e7` later scanned clean. Failed qualification remains; dot owns terminal receipt/security coordination, no retry or deployment. |
| Existing frontend image | Source `e0b47a34d00b8c181420188ed39a1d849e25ec0a`; digest `sha256:185d6ab9f7a8a6395546be4ac2374de2e329ab6182627de18e1fca9732220bcc` | Historical qualified image; newer native session/archived-client/first-chat sources are absent. |

**Neo confirmed the private same-application Clerk key pairing at 05:17 UTC.** Earlier documents saying that yes/no pairing remains unresolved are historical. This is owner attestation, not disclosure of key material or proof of current native session claims, active tenant membership, actor/client admission or conversation authority. Those live checks are **UNRUN**. No bearer, private key, connection string or user session belongs in Git or this handoff.

[FRONTEND-OPERATION.json](FRONTEND-OPERATION.json) records the latest separately owned active source-upload/build stage known at seal. It is an owner message, not a root AWS readback. Dot's frontend lane continues it to terminal and supplies the image/scan result; this does not delay or transfer that operation to Fable. Check that owner before any related paid action.

Frontend consumer contract **0.1.8**, Meri producer manifest **0.1.7**, and the private initial-input protocol **0.1.8** are distinct facts. The five initial-input schemas were previously compared equal; no version-only wire edit is established. Qualify actual installed distributions and mounted behavior rather than relabel packages.

## Historical records and supersession

This is a **new successor**, not a rewrite of [the earlier portable packet](../fable-shipping/FABLE-SHIPPING-HANDOFF.md). That packet retains signed runtime package inputs, historical source recovery, consumed attempts, contracts and rollback evidence. Its dated ownership, issuer-pairing blocker, image status, port-443 issuer and independent-VPC assumptions are superseded where this packet explicitly says so. Current source selects the approved same-VPC private Temporal topology, issuer port **8445**, direct `/run/meri` static material, task-local generated certificates and canonical registration/revocation. Neither dated proposals nor this handoff waive the remaining live qualification.

## Ownership acceptance and return package

Fable should first acknowledge the exact documentation seal SHA, root product pin, feature-lane pins and outstanding denied actions to dot. Outgoing Meri writers remain stopped to avoid conflict. Other Core/frontend workstreams may continue under dot; a later source change is a new integration decision.

Before dot's live E2E, return a Git-backed release packet containing exact source/image/config/deployed revisions, schema/grant and material **reference/version** receipts, network/listener ownership, private/public readiness, real native/provider path, task stop/rollback custody, terminal paid-operation records and budget reconciliation. Dot performs the real authenticated prompt, stream, saved conversation and reload test. A fixture response, liveness endpoint, source test or image scan is not that acceptance.
