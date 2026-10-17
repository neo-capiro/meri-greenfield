# Meri source inventory for Fable shipping — 17 October 2026

## Final ownership and first milestone

Fable owns **all Meri runtime/services/tools/documents/memory/settings/routines and Meri-specific UI**, including the remaining accepted Meri backlog. The first milestone is a **deployed, connected preview with usable desktop chat**, returning full source/image/config pins and health evidence to dot. Mobile and previously deferred advanced capabilities remain in Fable's accepted backlog; they are not gates for that first milestone.

Dot retains **Core, backend cleanup, Portfolio, non-Meri Modules/Settings, shared frontend and deployment coordination**, followed by live authenticated E2E acceptance. Shared authentication, Core listeners, database migration IDs and shared files require explicit coordination. There must be one deployment owner for each resource; Fable must coordinate any Core or shared-resource activation with dot. This scope allocation does not enable a held service, waive qualification or authorize an unallocated build.

## Current portable checkpoint: Fable resumes Meri; dot retains live E2E

**The latest parent safe-stop supersedes the 01:34:09 UTC dot resumption. Fable owns Meri source continuation, image qualification and shipping/integration preparation after this checkpoint, using another machine. Dot retains Core/frontend coordination and the live authenticated prompt, streamed answer, saved conversation and reload acceptance. Separate source lanes remain technically preserved and excluded from the first-chat pin; Meri continuation ownership is Fable as specified above.** Start with [PORTABLE-RESUME.md](PORTABLE-RESUME.md) and its final source/input/evidence inventories. This primary checkpoint is prepared on `handoff/meri-portable-fable-20261017`; its exact publication commit belongs in the final inventory, not a guessed self-reference.

Fable must use its own already configured, authorized AWS profile and verify the caller through STS against account `967807252336`, with region `us-east-1` explicit. Never copy this Windows host's credentials, `.aws` directory, tokens, cookies or private keys. The dated `jump-cli` principal and executable paths below are historical observations, not requirements to impersonate that principal or recreate this machine.

**First-chat activation remains HOLD beyond the image gate:** the frontend proposal names Test Clerk while Core's held dev service pins `https://clerk.app.capiro.ai`. One approved issuer/application/key and native `capiro` token template, active tenant membership, Core actor and selected-client admission are **UNPROVEN**. Dot owns Core/frontend coordination; Fable must coordinate any Core activation explicitly with dot before action. Core remains desired/running/pending `0/0/0`, and its retained priority-3 guard stays intact. The [latest portable Core handoff](https://github.com/neo-capiro/capiro-backend/blob/8b46d2df73f211ebdf09e5a138241539cb5dd922/docs/core-first-chat-fable-shipping-handoff-20261017.md) supersedes the earlier 6354/0e07 handoff procedures.


The published Meri PR101 scan-poll correction is `6fd48c9c3d49962a111e7f801f9f71ad06a7f1c9`, tree `b71b7a1baf63c88f18173cb5b41cbb4d9f66f74f`. The later runtime-base changes copied into this checkpoint are **source-only and unqualified**; they do not establish an image, native GNU pass, clean scan, approved next attempt or activation. The failed image remains the exact 38f-built digest below. Preserve both the committed source and every retained candidate file, including new files that a plain tracked diff would omit.

The earlier 01:19:23 stop, 01:34:09 dot resumption, 38f local-seal/no-upload cut and 01:44 terminal record are chronology. Their ownership, unused-allocation and no-upload statements do not override this checkpoint or authorize replay of consumed intents. `88620c95ce19d6ec9dd6b34b3cf8b4160bcd3ed5` is the earlier published documentation-only checkpoint. Existing resource, review, secret and deployment approval boundaries remain; no new build, upload or live action follows from this handoff.

## Selected source and evidence limits

**Published source baseline:** PR101 `6fd48c9c3d49962a111e7f801f9f71ad06a7f1c9`, tree `b71b7a1baf63c88f18173cb5b41cbb4d9f66f74f`, remote branch `refs/heads/codex/meri-image-diagnostics-20261016`. It is the reviewed source-only bounded scan-poll fix; no native image has been accepted at this source. Failed-image code was `38f52df94b1738649776792b2a28aac743801c19`, tree `7980fe7530d6623a2de9a788e150a377aca8201b`. The portable branch `handoff/meri-portable-fable-20261017` preserves the later runtime-base candidate and handoff; final exact source/file hashes belong in the root inventory. Candidate installation, native GNU and final scan are unqualified.

The ancestry inventory used pinned local Git blobs and the original captured `meri-greenfield-open-prs.json` (102 rows, SHA-256 `230f7d4cd83b084d7222db11761f7cff24eb414e1491f2a4b9035eebcf74d9e8`). The companion `open-pr-inventory.json` has now been refreshed from the three local `*-open-prs-final.json` snapshots, including 103 Meri rows and PR107; its timestamps and source hashes identify that later metadata cut. It made no fresh remote or AWS call and ran no tests. The repository is shallow. Recent included ancestry is proved; absent side-head objects and older history are not reconstructed or assumed equivalent. Captured PR metadata is a snapshot, not a current serving/deployment claim. The later metadata refresh does not independently validate side-lane implementation or deployment.

The immutable frontend/Core handoffs remain technical checkpoints. The latest explicit parent assignment makes Fable the Meri continuation/shipping owner and dot the live E2E owner; earlier 01:34 dot ownership and OpenAI-only directions are historical for this handoff. Existing product architecture, canonical owners, isolation and action approvals continue. Claude Agent SDK remains the product execution loop; this documentation changes no provider, architecture or placement.

## Required selected stack

| PR | Full head branch | Exact head | Included responsibility |
| --- | --- | --- | --- |
| [#89](https://github.com/neo-capiro/meri-greenfield/pull/89) | `refs/heads/codex/meri-recovered-source-20261016` | `525aa22fb9cf207228f8d0a62d59f0cc9ba73820` | Exact local continuation recovery; do not substitute remote main. |
| [#90](https://github.com/neo-capiro/meri-greenfield/pull/90) | `refs/heads/codex/meri-objective-local-source-20261016` | `5b166bf49bf4871138e3c02eebf04a8d6f04a5e2` | Inherited unmounted Objective source; ordinary chat does not activate it. |
| [#91](https://github.com/neo-capiro/meri-greenfield/pull/91) | `refs/heads/codex/meri-ordinary-first-chat-20261016` | `268dfe4447a8e7ae8ece8f74a9b5b5479eb50f08` | Current membership gate for ordinary Meri chat. |
| [#92](https://github.com/neo-capiro/meri-greenfield/pull/92) | `refs/heads/codex/meri-initial-run-admission-20261016` | `5850e858f9776ec5faa2902a90a1e90ea3903346` | Durable initial admission and native Core identity/context joins. |
| [#93](https://github.com/neo-capiro/meri-greenfield/pull/93) | `refs/heads/codex/meri-initial-run-binding-migration-20261016` | `d27c807bb5694cf84c73db5d647e2e8d13ba39f1` | 0017 SQL plus isolated qualification test source. |
| [#94](https://github.com/neo-capiro/meri-greenfield/pull/94) | `refs/heads/codex/meri-ordinary-currentness-20261016` | `0f82c8817e0155fd3bd1a95b7166ba2499451784` | Current Core context for saved history and model sends. |
| [#97](https://github.com/neo-capiro/meri-greenfield/pull/97) | `refs/heads/codex/meri-initial-run-startup-mount-20261016` | `8652488f087a1efa4d49d2df19a553b7cd7b3b65` | Explicit control startup mount plus recorded isolated PG qualification. |
| [#98](https://github.com/neo-capiro/meri-greenfield/pull/98) | `refs/heads/codex/meri-product-preview-manifests-20261016` | `caa7810ff19c09c8f7ea1c2524c025f36f99ccd6` | Disabled product preview, proxy/owner/Temporal/material source. |
| [#101](https://github.com/neo-capiro/meri-greenfield/pull/101) | `refs/heads/codex/meri-image-diagnostics-20261016` | `6fd48c9c3d49962a111e7f801f9f71ad06a7f1c9` | Includes prior 38f diagnostics/fixtures/W08 correction plus bounded exact ScanNotFoundException polling; published source-only, no accepted image. |

The selected recent chain is linear: PR89 -> PR90 -> PR91 -> PR92 -> PR93 -> PR94 -> PR97 -> PR98 -> PR101. All listed exact heads are ancestors of published `6fd48c9c3d49962a111e7f801f9f71ad06a7f1c9` in local Git; the earlier inventory itself was frozen at 38f. PR numbers need not be merged separately into this already combined code pin.

PR #96 (`refs/heads/codex/meri-initial-run-pg16-portability-20261016`, `0787c92672ee1a0b88fc6f69489c261e773490a1`) is **not** an ancestor. Its sole changed PG test has the exact same blob `e19b51119cbcfe37907caf8619a0a12fc27c3206` at the selected pin; the portability work was ported through `f2b0988ecadb0dbe21d032e557311b7807f55658` and `a50ee0b3b1001b5a57397c87f9ba631bcaa4d508`. Do not apply it again. This is file equivalence, not whole-tree equivalence.

PR #88 (`refs/heads/dot/meri-durable-input-admission-20261016`, `059b6338ece98c2b5217b85411b77517a0919988`) is a distinct recovery lineage; its head object is absent locally. Use selected PR89's recovered continuation and its evidence. No equivalence with PR88 is asserted.

## Excluded separate lanes

Do not merge or refresh the selected shipping source from these side lanes by implication:

| PR | Full head branch | Snapshot head |
| --- | --- | --- |
| [#95](https://github.com/neo-capiro/meri-greenfield/pull/95) | `refs/heads/codex/meri-objective-reader-rs256-20261016` | `5781c1150fbb3954c25ba245b26d325e06b4d82d` |
| [#99](https://github.com/neo-capiro/meri-greenfield/pull/99) | `refs/heads/codex/meri-general-reads-civic-20261016` | `81b3df7a0e9016e4dde8bb78418fb9901243ee54` |
| [#100](https://github.com/neo-capiro/meri-greenfield/pull/100) | `refs/heads/codex/meri-product-features-task6-20261016` | `78fbd3ae813fcf3fe286969e76102353c3a2eed2` |
| [#102](https://github.com/neo-capiro/meri-greenfield/pull/102) | `refs/heads/codex/meri-task-update-integration-task6-20261016` | `cc43d0004be59f315658207405ff1aea126adad5` |
| [#103](https://github.com/neo-capiro/meri-greenfield/pull/103) | `refs/heads/codex/meri-general-reads-stored-next-20261016` | `8bb0b2945429e70cf0ae1e594ea55eb8c3fa7ada` |
| [#104](https://github.com/neo-capiro/meri-greenfield/pull/104) | `refs/heads/codex/meri-general-reads-governed-next-20261016` | `0724a744d73356a0e935d15dabc5889ab2337d4b` |
| [#105](https://github.com/neo-capiro/meri-greenfield/pull/105) | `refs/heads/codex/meri-data-search-request-20261017` | `f33ea1a8945444b5ad8d15d5d048377abf201959` |
| [#106](https://github.com/neo-capiro/meri-greenfield/pull/106) | `refs/heads/codex/meri-general-reads-remaining-next-20261017` | `382f45ae695e271bf7433343d31486ac0d57184a` |
| [#107](https://github.com/neo-capiro/meri-greenfield/pull/107) | `refs/heads/codex/meri-read-resolution-next-20261017` | `526b6be7c906c15298f13430fe5dd5a9db458e03` |

PR100/102 are governed task-update work. PR99/103/104/105/106/107 are later read-tool work. PR95 is the separate Objective RS256 retained-reader successor; the selected source already inherits earlier disabled Objective code via PR90, but not this side head. Side-head blobs absent locally were not compared for copied behavior; absence from the selected lane is not a judgement on their quality or completion.

The final local PR metadata snapshot confirms the parent's newer update, absent from the original 102-row snapshot: read tools PR107 head `526b6be7c906c15298f13430fe5dd5a9db458e03`, based on PR106 `382f45ae695e271bf7433343d31486ac0d57184a`, remains excluded. Its reported checkpoint is `docs/coordination/reports/CODEX-READ-RESOLUTION-IMPLEMENTED-20261017.md`, reported coverage 56 complete / 10 partial / 16 absent / live 0. That document is not in selected `38f52df94b1738649776792b2a28aac743801c19`; this report does not independently verify the newer lane's content.

The task-update frontend remains separate at frontend PR61, `refs/heads/codex/meri-task-update-desktop-task6-20261016`, `bd9e0d03c54ef4fbb57010c3b97cfb3d77bdf2b9` (captured metadata; source reviewed, unactivated per parent). Planner backend PR50 is separately ongoing at `5591eac08428635bf911a0aa32acea859e2a5d95` on `refs/heads/feat/objective-planner-runtime-composition-20261016`, confirmed in the local final backend metadata snapshot (PR updated at `2026-10-17T01:33:01Z`). Its earlier parent-reported `a2b35fb64548caa5f96f25c97bda6d2f5055be93` is historical. Planner implementation/activation was not independently verified here. None is required as a prerequisite to refreshing the Meri first-chat code pin.

## What the selected source contains

- Ordinary chat uses current membership and independently joins native Core identity/context to the configured tenant, actor and client. Core bootstrap returns a candidate conversation UUID; the browser receipt is not Meri admission authority. See `docs/coordination/tasks/CODEX-MERI-INITIAL-RUN-ADMISSION-20261016.md`.
- `createInitialRunBindingJournal({pool,now})` in `apps/control/conversations/initial-run-binding-journal.mjs` owns one immutable writer-fence-1 admission per tenant/conversation. `claim`, `read` and `readConversation` reuse canonical validators, hash and borrowed pool. Run/input/issuance/allocation/current-run owners remain canonical.
- `apps/runtime/control.mjs` composes that journal only for literal `nativeCandidate.multiRun.dynamicInitialRuns: true`. The candidate declaration and trusted journal port must agree; missing relation/port fails closed. Static/default behavior remains available. Source mounting is not live activation.
- PR94 adds current Core conversation checks for saved history and model sends. Archive/authorization remains a point-in-time check; no instant global revocation or physical-stop proof is inferred.
- Product manifests, private/public ingress gates, runner poststart/TLS, owner channel, canonical product budget fact resolver, private native credential delivery and Temporal token-writer interfaces are source. The main application services have desired count zero, companion proxy is false-conditioned and Temporal services remain disabled/zero. Real owner HTTPS/mTLS/task leases, durable bearer/session resolution, native LiteLLM route, approved pricing/pool, network/material/issuer composition and physical qualification remain concrete gates. No second budget ledger is authorized.
- Existing Aurora reuse is the selected source direction: the stopped Temporal companion uses the existing capiro-dev Aurora cluster, not a new RDS instance. Application schemas target existing database `capiro` and preserve database-wide/public privileges. Temporal logical-store allocation and the separate Temporal VPC route/DNS/SG path to Aurora and product control remain unqualified. The current database decision is recorded in `infra/product-preview/README.md` and `EXISTING-DATABASE-GRANTS-20261016.md`.
- The Temporal writer cannot simply replace the static material-init token file. The existing inventory/receipt and task-local volume ownership need an explicit handoff, plus cached connection expiry/revocation/stop integration. See `OWNER-INTERFACE-CLOSURE-20261016.md`.
- PR101 contains the fixed three-suite Linux image gate, ten exact source-verified read-only fixture mounts, entrypoint/hash presence checks before Node test glob selection, exact 24 cases (B6/R6/W12), bounded diagnostics and one conditional encrypted failure artifact. W08 now has checks 1–30, a reserved detail slot, callback and after-hook capture, and the two corrected nested token-string expectations. Production token writer/reader were unchanged. The corrected mismatch is source-proven if reached; the earlier remote W08 assertion was not captured.

The historical six-file independent W08 review map was checked against exact 38f Git blobs. Task-local source receipts report Node 33/33 and Python 14/14, plus two actual canonical normalization invocations; none is a native Linux or live first-chat pass. This inventory did not repeat them. `packages/contracts/package.json` at the selected source is version `0.1.7`; do not infer compatibility from a different frontend package version.

## 0017 qualification: current and historical states

Selected SQL: `apps/control/conversations/migrations/0017_initial_run_bindings.sql`, Git blob `4fa941a215b3dac2f2a5cfbca190d7b73549b670`. Selected native test: `apps/control/conversations/test/initial-run-binding-migration-pg.test.mjs`, blob `e19b51119cbcfe37907caf8619a0a12fc27c3206`.

The committed audit `docs/coordination/audits/meri-initial-run-0017-20261016/README.md` and its `windows-loopback-redacted.txt` record **9/9 passed** under Node24 against a fresh disposable Windows-loopback PostgreSQL **16.15** cluster on 16 October. The wrapper recorded stop/removal and port cleanup. Coverage includes exact predecessor apply, older-row preservation, constraints, false SHA refusal, narrow role/lock permissions, concurrent replay, preexisting-original refusal, lost-COMMIT recovery and dump/restore. These source blobs still match that audit.

The exact migration order is 0001–0011, 0013, 0015, 0016, 0017. Held gaps 0012/0014 are not silently applied or reallocated. The Unix-socket profile was **not run**. No live product/Aurora migration, serving-role grant, Aurora16.11 compatibility, service activation or real first chat follows from the Windows fixture pass. The SQL itself grants no runtime role privileges.

The schema proposal records an exclusive 0017 reservation. Prior coordination names central allocation branch `dot/meri-package4-allocations-20261016` at `082eb9f24b61c0813044fcf3a1b9a4cb41999a3c`; that commit is absent locally and was not freshly verified here. Do not allocate another migration number. The proposal and admission outline still contain older UNRUN/unmounted statements: use the later committed native audit and actual opt-in startup source for current status.

## Old-pin continuation and stop custody

Source facts: `prepared-candidate.mjs:45`, `prepared-run-bindings.mjs:41` and `prepared-run-registry.mjs:36` require the journal's saved configuration digest to match the current reviewed configuration. Cleanup may accept an expired admission, but does not waive that configuration comparison. `prepared-run-bindings.mjs:82–94` rebuilds only the canonical stop from durable admission, allocation, issuance and original facts; it refuses drift and creates no new issuance/allocation.

Consequences to preserve in the rollout plan:

1. Retain the exact old controller/image/config/secret references and an authenticated stop/reconcile route until every old task is reconciled and physically stopped. No immutable old-config stop capsule exists in the exact journal schema at this pin.
2. An old-pin drain must cover every run, successor, allocation, issuance, Temporal workflow and corresponding ECS task under each admitted tenant/conversation. The journal identifies only writer-fence-1; checking that one run can miss successors. Live inventory and zero-UNKNOWN/physical-stop evidence are **unknown** in this audit.
3. Zero live tasks does not make old conversations compatible with config B. Preserve pin-routing/config A for continued chat, or explicitly close/read-only those conversations before decommissioning A. Do not invent a cross-config admission or silently rebind an old conversation.
4. Fence admissions/kickoffs and settle in-flight work before a drain; preserve rollback. These are source-derived planning requirements, not permission to run a drain or proof one happened.

## Existing context documents: reading order

| Context | Exact paths at the selected code pin |
| --- | --- |
| Governing design | `AGENTS.md`; `docs/IMPLEMENTATION-STANDARDS.md`; `docs/plans/MERI-DEPLOYMENT.md`; `docs/plans/MERI-G1-SOURCE-TO-NATIVE.md`; `docs/coordination/DECISIONS.md` |
| Original supplied plan | `docs/plans/Meri_Greenfield_Agent_Plan.docx`; R2 references under `docs/plans/revisions/20261010-R2/` |
| Historical ownership/recovery | `docs/coordination/reports/DOT-HANDOFF-TO-FABLE-20261015.md`; `docs/handover/OPENAI-CODEX-CONTINUATION-20261014.md` (historical worker assignments and PR71 pickup; use the current ownership qualifier above) |
| First chat and journal | `docs/coordination/tasks/CODEX-MERI-INITIAL-RUN-ADMISSION-20261016.md`; `docs/coordination/tasks/CODEX-MERI-INITIAL-RUN-BINDING-SCHEMA-PROPOSAL-20261016.md`; `docs/coordination/audits/meri-initial-run-0017-20261016/README.md` |
| Runtime owners | `apps/runtime/README.md`; `apps/runtime/native-authority/README.md`; `apps/runtime/RUNTIME-MOUNT-OUTLINE.md` |
| Current disabled preview | `infra/product-preview/README.md`; `LAUNCH-INPUTS-20261016.md`; `CAPIRO-DEV-CHANGE-SET-20261016.md`; `PLATFORM-COMPOSITION-OUTLINE-20261016.md`; `OWNER-INTERFACE-CLOSURE-20261016.md` (all under `infra/product-preview/`) |
| Material, database, transport | `infra/product-preview/material-delivery.md`; `EXISTING-DATABASE-GRANTS-20261016.md`; `task-route.md`; `apps/proxy/product/HOST-COMPOSITION-OUTLINE.md`; `OWNER-BRIDGE-HTTPS-CONTRACT.md` (last under `apps/proxy/product/`) |
| Temporal and model proxy | `infra/product-preview/temporal-deployment.md`; `temporal-linux-qualification.md`; `model-proxy-change-set.md` |
| Image provenance | `infra/product-preview/image-buildspec-design.md`; `MERI-CODEBUILD-REQUIREMENTS-20261016.md`; actual `image-build-source.py`, `image-build-producer.py`, `image-build-recipe.mjs`, `image-build-linux-checks.py`, `image-build-test-reporter.mjs` |

Several image documents describe the frozen **e4fc1034** packet. Its source archive excludes later owner interfaces and cannot represent selected `38f52df94b1738649776792b2a28aac743801c19`. A separately reviewed exact successor seal, versioned source/readbacks, generated recipe and accepted image receipt are required. That original inventory made no live image read; the later exact 38f failure digest and HIGH 3 scan are in MERI-CURRENT-QUALIFICATION. No accepted 6fd/base-candidate image exists. Root's task-local `meri-image-w08-qualification-20261017/` packet contains newer source review/proof records; those local paths are not portable Git evidence until the handoff owner preserves the reviewed nonsensitive receipts.

## Supported resume checks

Commands below name existing source checks. Use a hydrated exact checkout and its already reviewed locked dependencies, verified Node24/Python environment, and focused changed-behavior selection. They were not executed during this inventory.

```sh
# Dynamic admission, immutable replay and startup composition
node --test apps/control/action-host/application-adapters/dynamic-initial-context.test.mjs apps/control/conversations/test/initial-run-binding-journal.test.mjs apps/runtime/test/dynamic-candidate-identity.test.mjs apps/runtime/test/initial-run-bindings.test.mjs apps/runtime/test/prepared-candidate-startup.test.mjs

# Current saved-conversation/model authority
node --test apps/runtime/native-authority/test/conversation-currentness.test.mjs apps/gateway/model-proxy/product-request-owner.test.mjs

# Offline image recipe/diagnostics and exact fixture controls
node --test infra/product-preview/image-build.test.mjs
python3 -B -m unittest -v infra/product-preview/test_image_build_diagnostics.py infra/product-preview/test_image_build_linux_checks.py

# Disabled manifest/source owner contracts
node --test infra/product-preview/manifest.test.mjs
MERI_REVIEW_SOURCE_ROOT="$PWD" node --test apps/proxy/product/owner-channel.test.mjs apps/proxy/product/owner-credential-delivery.test.mjs apps/proxy/product/product-owner-facts.test.mjs
```

On Windows, the image source tests support `MERI_IMAGE_BUILD_TEST_PYTHON` to name the existing pinned Python executable. Native B/R/W image qualification must use the canonical producer's verified fixture mounts and presence gate; a plain test command inside the production image can omit the excluded R entry or fail B imports. It remains a separately authorized image qualification action.

For the known Python package-identity issue, use the exact source-documented pre-import invocation with existing site-packages; do not claim plain discovery passes:

```sh
python3 -c "import apps.proxy.product.upstream_callback; import unittest; s=unittest.defaultTestLoader.discover('apps/proxy/product/test',pattern='test_*.py'); r=unittest.TextTestRunner(verbosity=1).run(s); raise SystemExit(not r.wasSuccessful())"
```

The existing native migration command is `node --test apps/control/conversations/test/initial-run-binding-migration-pg.test.mjs`, **only** against a separately attested disposable PG16 target. The source requires `MERI_INITIAL_RUN_MIGRATION_TEST_ISOLATED=1`, exact transport/data-directory/port/control-database bindings and profile-specific preflight. The Unix profile fixes the private socket/control database; the Windows profile fixes the task-owned loopback target. Do not redirect it to a running system or product database. No server start, SQL execution, credential setup, image build, deployment or model spend was performed by this inventory.

## Later current operation and paired-contract clarification

The historical pre-start cut is superseded for current operation state by [the terminal qualification record](MERI-TERMINAL-QUALIFICATION-20261017.md): build `5b67476a` is FAILED, exact pushed image scan COMPLETE has 3 HIGH findings, cleanup OK, independent HOLD, no next allocation. The [paired-contract report](MERI-CONTRACT-COMPATIBILITY.md) and immutable frontend binding plan distinguish consumer 0.1.8 from producer 0.1.7; no version-only rebuild is required. Native authenticated mounted behavior and recovery still need qualification.

## Portable continuation additions

- **Current frontend source:** [PR60 `8fd2c4c4556e5fed37da012293a4f1b4d2088d14`](https://github.com/neo-capiro/capiro-frontend/commit/8fd2c4c4556e5fed37da012293a4f1b4d2088d14) is newer product source than the successful e0 image. The retained PR48 selected-client read review (SHA `af1ee19ea5ccfb6329d7325bdb9c393baa92626c9fe379a0867168c329b11bf0`) uses existing Core PR48 for the three tenant-scoped GET reads and changes the read source marker from111f to6542. It does not claim a new frontend image, reachable read hostname or live authorization. Existing Core GET middleware may write metadata; a separate read-only Core service is not a prerequisite solely to avoid those permitted preview writes.
- **Actual issuer gate:** held Core service source pins `https://clerk.app.capiro.ai`; frontend preview proposal names Test Clerk. One approved issuer/application/key/token template, native `capiro-internal` membership, Core actor `user.id`, tenant and selected client must be joined before activation.
- **Uncommitted candidate retention:** preserve the Dockerfile and every recipe/source/producer/provenance/test edit together with all new `runtime-packages`/`runtime-base-probe` modules/tests and the lock, fix-evidence and remediation report. A tracked diff alone omits new files. The final root source inventory is authoritative; no candidate result is inferred from 6fd's source review.
- **Frozen public inputs outside Git:** retain exact `APKINDEX.tar.gz`, four APKs, public signing-key bytes, signature/control/data-checksum evidence, registry manifest/config/SBOM and base inventory records. Runtime lock hash is `5c7724e6c9837dabc3146256aa55b3dce2230d10de5a2ff7c479f519aafb3ac9`. Mutable index/research URLs cannot reproduce old bytes automatically.
- **Private operational evidence outside Git:** retain sanitized resource/15-statement policy baselines, source/upload/start/terminal/scan/failure identities and independent receipts, plus contract comparison proof and its reproducer. Access exact source/result objects with Fable's own existing AWS authorization. Private C: paths below are original locations, not files assumed to exist on the new machine. Raw logs/material require approved private custody; never copy credential directories or secret values.
- **Operational helpers:** Windows `read-prerequisites.ps1`, `verify-prerequisites.py`, upload/start/monitor/reconcile helpers and their packet-preparation scripts depend on absolute executables, fixed paths, consumed f238 identity and sibling historical baselines. Preserve them as evidence; use the portable guide to review a fresh parameterized packet after a new source decision/allocation. Do not rerun them or issue another UUID to recreate this checkpoint.

Fable starts from PORTABLE-RESUME and its final inventories on the other machine; dot receives the final source/image/configuration receipts for live prompt/stream/save/reload acceptance. Neither this source index nor its old fixtures authorizes a build, SQL, service, IAM/network change or deployment.

Portable build-input seam: the candidate package-fetch CLI and Docker stage currently read the mutable public APKINDEX URL and verify its frozen hash, with no retained-cache input path. If those remote bytes change, an approved immutable delivery/read path or a newly reviewed authenticated index/lock is still needed; saved APK/index bytes are necessary evidence but do not alone make that exact build path reproducible.
