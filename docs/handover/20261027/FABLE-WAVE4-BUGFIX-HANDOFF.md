# Fable Wave 4 bug-fix return — 27 October 2026

From Fable to the Wave 4 orchestrator. Author evidence only; no merge, deployment, migration or acceptance was performed. Authors do not accept their own fixes: root arranges independent review of every head below.

## 1. Returned branches (PR candidates)

No pull request was opened; each branch is ready for root to open, review and merge. All three carry the same branch name `claude/jolly-cori-v7dcvd`.

| Repository | Base (fetched remote) | Head commit / tree | Commits | Mergeability |
| --- | --- | --- | --- | --- |
| `neo-capiro/meri-greenfield` | `main` 651bdf37 (PR292) | `61e9574ebe59a91e552cb9356be75112892bdfd7` / `f39f1bd5acc8f45a91f5b3abe4fc6492650e32e8` | 1bbcf5a9 sharing read fixes; 4a93f8eb MO-05 integration + contracts 0.1.21 / catalog 0.2.23; 61e9574e UI stream 0.1.8 peers | fast-forward on 651bdf37 at push time |
| `neo-capiro/capiro-frontend` | `main` 050df524 (PR250); remote main is now b70f5d8e (PR244 merged after PR250, unrelated avatar change) | `6652fe2280ed3282e52ee2ca08803f2000ad32c5` / `3f8bba04f420dd21a0ea736757e9b268ca69a248` | one commit | no overlap with b70f5d8e expected; root confirms at PR time |
| `neo-capiro/capiro-backend` | `backend-import` c5b99db7 (PR193) | `8fa0ccdd94c17c0c677d2f01ae18a6762d218b59` / `412267afc3eb93be016041c17b3ee0b35f2787f4` | 4a6636f4 preview labels; 8fa0ccdd guard | fast-forward on c5b99db7 at push time |

Dependency order: Meri first (it produces contracts 0.1.21 and UI stream 0.1.8), then frontend (vendors both artifacts), then Core (independent; the preview labels are cosmetic and safe before or after).

### 1.1 Meri commit 1bbcf5a9 — sharing reads: advertised schema and Core envelope

- **Bug 1 (user-visible):** `get_research_portfolio_share_links` was never offered to the model. The sharing schema pinned `pattern: ^[a-f0-9-]+$` beside `format: uuid` on every id; the worker's zod round-trip proof cannot narrow that combination, so the read failed closed with `READ_SCHEMA_CONFIGURATION`. Reproduction: baseline `apps/worker/conversation` schema proof for that operation; fixed by removing the redundant pattern (format remains) and repinning the three sharing descriptors.
- **Bug 2:** the attended sharing read posted a flat body to Core, which Core's trusted transport (`meri-rp-tool-transport.ts`) admits only for `CapiroMeriRead` delegations; attended native reads relay the live user session and must send `{version:1,input,currentTurn}`. New `research-portfolio-envelope.mjs` builds that envelope from the authority binding; `reads-research-sharing.test.mjs` asserts it.
- **Correction:** pre-call refusals in the sharing preparer (invalid arguments, first rights check) are reported as effect `none`, not unknown, so the journal never treats a refused prepare as an uncertain write.
- Changed files: `packages/contracts/retrieval-0.2/research-portfolio-sharing.schema.json`, `catalog.json` (three pins only), `apps/gateway/sources/retained-reads/research-portfolio-envelope.mjs` (new), `apps/gateway/general-reads/families/research-portfolio-sharing.mjs`, `apps/runtime/test/reads-research-sharing.test.mjs`, `apps/control/intents/research-sharing-preparer.mjs`.

### 1.2 Meri commit 4a93f8eb — MO-05: 7 reads and 10 governed actions

- **Gap:** Core already served all 22 Research Portfolio tools behind `RESEARCH_PORTFOLIO_MERI_TOOLS_ENABLED`; Meri mapped only the 5 sharing/portfolio operations. The 17 remaining originals were `deferred`.
- **Reads** (`research-portfolio-workflow` group): analytics, bookmarks, fit, reviews, rules, imports, operation status. Typed input/output schema (`research-portfolio-workflow.schema.json`, 29 definitions), validators that bind the conversation, tenant and `visibleClientIds`, gateway routes `/api/clio/tools/<id>` with the trusted envelope, worker family (`clientScope: optional`), runtime read context.
- **Actions** (`research-portfolio-action` group): management (49 Core actions, `confirmed:true`, bounded parameters), snapshot, output request, save output to client, watch, change state, bookmark, review note, brief, meeting. Each is a prepare-only intent (`propose_research_portfolio_*`, `prepare_research_portfolio_draft`) that posts an immutable proposal to Core `/api/clio/action-proposals`; approve/dismiss go through the existing intent journal and the public intents contract (kind `research_action`, decide response `research_action_decided`). Model-supplied `idempotencyKey` / `operationKey` / authority keys are refused; the key is derived from the delivery identity (`meri-rp-<sha256>`).
- **Contracts/catalog:** contracts 0.1.21, catalog 0.2.23 (originals 153 = 141 selected / 12 deferred; operations 142), `packages/skills/assets.json` `installationCatalogSha256` repinned, dist regenerated (byte-identical regeneration verified on the untouched baseline), owner-exclusion ledger authorizes the 17 names.
- **Tests added:** `packages/contracts/test/retrieval-research-portfolio-workflow.test.mjs` (3), `apps/control/intents/test/research-action.test.mjs` (6), `apps/runtime/test/reads-research-workflow.test.mjs` (4); stale-count tests updated (`legacy-tools-excluded`, intents `schema.test`).
- **Known limitation (Core, not changed here):** Core's `manage_research_portfolio` runs every management action through an approval, including the read-only ones; Meri labels them honestly but cannot skip the approval.

### 1.3 Meri commit 61e9574e — UI stream 0.1.8

UI stream 0.1.7 admits only contracts `0.1.19 || 0.1.20` as a peer, so the frontend cannot install contracts 0.1.21 beside it (`npm install` fails resolving the peer). 0.1.8 changes package metadata only (peer `0.1.20 || 0.1.21`, README note); `dist/` is byte-identical to 0.1.7 after rebuild. The handoff's "do not repack unchanged artifacts" is respected for 0.1.20/0.1.7 themselves: both stay in the frontend vendor record untouched; the new versions are additive.

### 1.4 Frontend commit 6652fe22 — receive `research_action` proposals

- Vendors `capiro-meri-contracts-0.1.21-4a93f8eb-4b92830eaa46.tgz` (1,298,567 bytes, 69 entries, SHA256 `4b92830e…`) and `capiro-meri-ui-stream-0.1.8-61e9574e-39451998f953.tgz` (3,177 bytes, 6 entries, SHA256 `39451998…`), both packed with `npm pack --ignore-scripts` from the exact Meri heads above; records added to `vendor/meri-public-packages.json` with status `candidate-source-pending-review-and-merge`. Root may repack from the merged Meri head and replace both records; the bytes will match if the merged tree is identical.
- New `research-action-view.ts` renders the retained request, the bounded Core preview, approve/reject and settled states; `intent-view.ts`, `decision-recovery.ts`, `useConversationIntents.ts`, `useIntentExpiry.ts`, `ConversationIntents.tsx` treat `research_action_decided` like the other owner decisions; uncertain outcomes are recovered by reading the recorded status, never by re-sending.
- Pins moved to 0.1.21: `apps/web`, `packages/meri-client` (peer and dev), `packages/qualification-transport`, root; `previewMeriContractsPackageVersion` in `meri-conversation-route.server.ts`; `scripts/installed-public-export.test.mjs`.
- Tests added: `tests/meri-research-action-fixture.ts`, `tests/meri-research-action-view.test.ts` (4).

### 1.5 Core commits 4a6636f4 + 8fa0ccdd — preview labels

Meri action previews for the ten MO-05 actions showed only the raw tool name. `meri-action-preview.ts` now labels each action and shows only bounded facts (ids, action, label, counts, effect text); keys and body text stay server-side. Spec extended (`meri-action-preview.spec.ts`). The second commit guards the field-table lookup under `noUncheckedIndexedAccess`.

## 2. Author check results

Node 24.x, npm 11 (Meri/frontend), pnpm 9.12 (Core); isolated clones; no live target touched.

| Repo | Check | Result |
| --- | --- | --- |
| Meri | affected tests: new 13 + sharing read + legacy-tools-excluded + intents schema (`node --test`) | 28 pass, 0 fail |
| Meri | `npm run check:contracts:distribution` | exit 0 |
| Meri | `npm run check:contracts` | exit 1 at head and at baseline. Head 1053 failing cases vs baseline 1021; the 34 "new" names are the pre-existing broken `next independent zero inner effects for unavailable <id>` case (it fails for all 250 operations on the baseline because `createSourceDisabledGateway` passes `authority`/`budget` where `createToolDispatch` requires `current`/`contextFor`) applied to the 17 new ids; 2 cases fixed at head. Inherited stale-count tests (139/97/48/84 etc.) untouched. |
| Meri | full `npm run check` baseline comparison (pre-compaction run) | 1019 inherited failures; affected suites: no new failures, one fixed |
| Frontend | `npm run check:packages` | exit 0 (both new artifacts bound) |
| Frontend | `apps/web` `tsc --noEmit` (8 GB heap; the default heap OOMs in this container) | exit 0 |
| Frontend | `npm run lint --workspace @capiro/web` | exit 0 (83 inherited warnings) |
| Frontend | `npm run format:check --workspace @capiro/web` | exit 1: 6 inherited files, none touched by this branch; all changed files are Prettier-clean |
| Frontend | root `npm test` | 205 pass / 3 fail at head and at baseline (`preview-backend-boundary` ×2, `preview-config` ARM pins) |
| Frontend | `npm run architecture` | exit 1 at head and baseline; no new review-required signal (DecisionControls shrank 117→86 lines; `researchActionRow` 58 lines) |
| Frontend | vitest: intents views (15), research action (4), preview route activation, share view | pass; `meri-capabilities.test.ts` 2 fail at head and baseline (fixture pins 0.1.14) |
| Frontend | `npm run test:transport` | 132 pass |
| Core | `jest src/meri/meri-action-preview.spec.ts` | 6 pass |
| Core | `tsc --noEmit --rootDir .` in `apps/api` | 9,410 inherited errors in this container (Prisma clients and `@capiro/shared` not generated here); 0 in the changed file after 8fa0ccdd |
| Core | eslint | not runnable here (no eslint in the installed `apps/api` dependencies); root's gate covers it |

GitHub checks: none observed for the pushed branches from this environment; report as not run.

## 3. Migration, schema, contract, package, environment, route and deployment impact

- **Database:** none. No migration in any repo.
- **Contracts/catalog/packages:** contracts 0.1.21, catalog 0.2.23, UI stream 0.1.8, skills `installationCatalogSha256` changed. A deployed runtime needs a fresh native installation receipt for the new catalog hash (release owner); the previous 0.2.22 receipt will not admit the new reads.
- **Core environment:** every Research Portfolio Meri tool requires `RESEARCH_PORTFOLIO_MERI_TOOLS_ENABLED=true`; the CDK preview source does not set it, the preview `first-chat-core-meri-tools.json` allowlist lists no Research Portfolio tools and the standard profile sets no `MERI_TOOL_ALLOWLIST`. Without those the 22 tools stay unavailable on preview. Deployment decision for root/release, not a code change.
- **Frontend environment:** `CAPIRO_PREVIEW_MERI_CONTRACT_PACKAGE_VERSION` must equal `0.1.21` on preview. Pre-existing mismatch: `apps/web/deployment/portfolio/service.yml` asserts `0.1.14` and `tests/meri-capabilities-fixtures.ts` pins `0.1.14`, which already disagreed with 0.1.20; both are release-owned and left unchanged.
- **Routes:** no new HTTP routes. Meri calls the existing Core `/api/clio/tools/get_research_portfolio_*` and `/api/clio/action-proposals` endpoints.
- **Cleanup/recovery:** no resources created; the temporary local tarball pin was replaced before commit and never committed.

## 4. Decisions and definitions returned to root

1. **F01–F42 and V4-01–V4-15:** not recoverable from any accessible repository. The recorded lineage (`docs/research-portfolios/BRANCH-CLOSEOUT-2026-09-28.md`, `CURRENT-BRANCH-CLOSEOUT-2026-09-28.md`) states the original START-HERE/portable plan and the F/V4 source files are unavailable; only the 70 register rows exist. Root must supply the definitions or accept the register as the lineage.
2. **Original sections 1–15 and section 16 text (FR-16.36):** not in `meri-greenfield`, `capiro-backend` or `capiro-frontend`; `SECTION-16-SOURCE.txt` lives only in root's `R/outputs`. Needed before any row-11 fix.
3. **FR-16.36 / 16H row 11 (publisher source permission):** trace of current owners — the share payload admits only frozen evidence; evidence is resolved from the public qualified defense corpus (`resolveEvidence` has no tenant/user input); the publisher check is editor grant + linked client + current client access. No private-source input into a share widget was found, so there is nothing today that a publisher-specific source permission would gate. The meaning of "source permission" for a public-corpus widget is undefined in the available sources: root must decide whether row 11 is satisfied by the current public-only admission (then the acceptance row only needs a documented refusal case) or whether a private source is expected to exist (then name the source and widget). No ACL model was invented.
4. **Core management actions:** read-only `manage_research_portfolio` actions still require approval in Core (`RESEARCH_MANAGEMENT_READ_ONLY_ACTIONS` are labelled but not short-circuited). Decision whether Core should bypass approval for those actions.

## 5. Coverage note against the existing rows

Scan in progress at this commit; the per-row coverage and concrete findings follow in the next revision of this document.
