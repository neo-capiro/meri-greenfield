**Update: ACCEPT at `bdaeed65`.** The test-only fix is pushed; C1 and C2 are done, and C3 is withdrawn as pre-existing. See §8.

**Original verdict at `5bf90117`: CHANGES (test-only; the runtime content is safe to merge and deploy).**

What holds:
- Every deletion is dead for build and deploy.
- P6-Core, auth, tenant and Clerk are byte-unchanged.
- The preview Core image builds and passes its smoke test.
- tsc is the same 62 errors, and the mount probe is identical.

The gate "failing test names equal to the base" fails:
- **9 new failing jest tests** pin the deleted legacy Meri loop;
- **the spec that replaces the deleted Research Portfolio binding test does not compile**;
- **the PR's own workspace-transition guard pins stale hashes**, so 3 of its contract specs are red at head.

There are three test-only fixes; see §6.

Merge review of capiro-backend **PR #104** "source consolidation core", `codex/source-consolidation-20261021-core` @ `5bf90117`, onto `backend-import` @ `309af848` (which includes #102/#103).
- By adj-d3-readiness, 2026-10-21. Verdict only: no edits and no GitHub comments.
- AWS: read-only describes (CodeBuild, ECS, ECR, ELBv2) on `capiro-dev`; no mutations.
- Labels: **[R]** ran or read now, **[D]** derived from code, **[I]** inference.

## 0. Shape [R]

- 36 commits. `309af848` is the merge base, so the merge is a **fast-forward**: the tree to validate is exactly `5bf90117` (tree `18952cfb`).
- 3,453 files, +146,635 / −916,148.
- **Deleted:**
  - `apps/web/src` (2,148), `apps/defense-api/runtime-source` code (730; the README and 15 JSON + 2 PDF fixtures stay);
  - `apps/web` html, vite, vitest and tsconfig files and 5 `apps/web/scripts`;
  - 8 files in `apps/api/src`: `meriv2-chat.client(.spec)`, `meriv2-routing.helpers(.spec)`, `meriv2-routing.matrix.spec`, `meri-research-portfolio-tool-scope`, `ResearchPortfolioMeriTurnBinding.spec`, `engagement-intel-context.spec`.
- **Moved** (renamed, unchanged bytes): 30 `apps/web/scripts` and assets → `tests/support/legacy-web/`; `apps/web/package.json` → `tests/support/legacy-web/visual-cli-inputs/package.json`.
- **Added:** about 400 `docs/**` evidence files, root contract specs and `scripts/lib` helpers.

## 1. Every deletion is dead for build and deploy [R]

**What builds from this repository (CodeBuild, read-only `BatchGetProjects`, 11 projects):**
- Only `capiro-preview-first-chat-core-build` and `capiro-preview-first-chat-core-alpine-amd64-build` take capiro-backend source. They use an S3 zip made by `infra/deploy/prepare-first-chat-core-source.mjs`.
- `capiro-build-web-dev`, `capiro-build-intel-api(-prod)` build from **capirov2**. The other four build from `neo-capiro/dev`.
- The head tree has no `.github/` directory, so no CI workflow runs from it.

**What the preview Core packet contains (`prepare-first-chat-core-source.mjs` at head):**
- `.dockerignore`, `apps/api/{Dockerfile,package.json,nest-cli.json,tsconfig*.json,src,prisma,scripts,data}`;
- the four `packages/{shared,meriv2-core,defense-contracts,defense-domain}`;
- `pnpm-workspace.yaml`, `package.json`, `pnpm-lock.yaml`.
- **No `apps/web` or `apps/defense-api` path.** I prepared both packets with the script itself: head 6,311 files (archive `b814583c…`), base 6,314.

**Live services (ECS describe, `capiro-dev`):**
- The only service whose image comes from this repo is `capiro-preview-first-chat-core:3` (`preview-core@sha256:1ae9b167…`, **X86_64**).
- `capiro-dev-api`, `-web`, `-web-vnext`, `-api-strategy` and the rest run ARM64 images from the capirov2 pipelines.

**`apps/web`:**
- `pnpm-workspace.yaml` now excludes `apps/web`. The lockfile change is exactly the removal of the `apps/web` importer (−136 lines, no version changes). No remaining package depends on `@capiro/web`.
- `apps/web/Dockerfile` becomes a frontend-artifact consumer that fails closed without `release-artifacts/capiro-frontend`. No live pipeline builds it from this repo (`capiro-build-web-dev` builds capirov2's Dockerfile).
- Remaining references to `apps/web/src/...` are JSON fixture data (for example `apps/api/scripts/__fixtures__/engagement-current-ui-surface-manifest.v1.json`), not imports. The two `apps/api/scripts` files that read that fixture were repointed to its new path.

**`apps/defense-api/runtime-source`. Is defense-api deployed from this repo? No:**
- There is no defense-api ECS service. Seven `capiro-dev-defense-*` task-definition families exist.
- `capiro/dev/defense-api` was last pushed on 2026-09-25, tagged with capirov2-lineage commits, and no CodeBuild project builds it from capiro-backend.
- The deleted tree never fed that image anyway: `apps/defense-api/Dockerfile` copies only `apps/defense-api/{src,prisma,scripts,…}` and packages, and `tsconfig.json` compiles `src/**` only.
- The inspect adapters in `src/runtime/phase1-7-runtime.adapters.ts` read the **retained** JSON fixtures under `runtime-source/`, which stay.
- **The PR's own proof passes [R]:** with git history available, `verify-defense-budget-mirror-parity.mjs` reports `CANONICAL_DEFENSE_SOURCE_PASS: 727 removed code twins, 317 retained canonical specs, 17 unchanged data files, 9 replay fixtures`, and `verify-phase8-session4.mjs` reports `SESSION4_SOURCE_PARITY_PASS`. The base version passes too.

**The 8 deleted `apps/api/src` files:**
- `git grep` at head finds no import of `meriv2-chat.client`, `meriv2-routing.helpers` or `meri-research-portfolio-tool-scope`.
- What remains is assertions in the PR's own contract specs that they are gone. tsc and the build both pass.

## 2. P6-Core is intact [R]

`git diff 309af848 5bf90117` is **empty** for:
- all 34 `apps/api` files #102/#103 changed;
- `apps/api/src/{auth,tenant,bootstrap,config,common}`, `main.ts`, `app.module.ts`, every `*clerk*`, `*throttl*` and `*preview*` path;
- `apps/api/prisma` and `packages/**`.

This covers current authority, the Clerk cache, the throttler, the mounted request path, application-authority, tenant-context and Clerk.

## 3. Core's in-repo Meri (`apps/api/src/meri`, 26 files) [R/D]

- **Legacy loop and V2 transport removed.** `MeriService.streamMessage` (≈2,300 lines: the in-process tool loop and the MeriV2 full-chat proxy branch) and `MeriV2ChatClient` are deleted.
- **This was already unreachable at base.** The `MeriService` provider is `createMeriRuntimeService` (`meri.module.ts:154-163`), a Proxy whose `get` trap returns V3's `streamMessage` and refuses with `meri_unavailable` when the gate is closed. Base already said there is no fallback (`meriv3-runtime.proxy.ts` header).
- **The only other caller** of `streamMessage` is the controller, through the same token.
- **The new `MeriRuntimeService` type** (`meri-runtime.contract.ts`) only states that contract, and the controller injects `@Inject(MeriService)`. Removing `installRawPhase19Adapters` removes patches of the deleted loop's seams.
- **Impersonated turns:** the controller comment changes from "route legacy" to "forward to V3". At base, routing was already V3-or-refuse through the proxy, so behaviour is unchanged [D].
- **`meri-tools.service.ts` → `meri-federal-legislation-tools.ts` + `meri-tool-input.helpers.ts`** is a pure move. Every removed line reappears in the new files; four helpers gain `export`. The five legislation tools delegate.
- **Is anything preview uses affected? No.**
  - The preview edge (`capiro-prod-alb` rules 1-3, read now) admits only POST `/api/clio/application-authority/{identity,context,membership}` and `/api/clio/conversations/bootstrap`, and GET `/api/me`, `/api/clients`, `/api/clients/<uuid>`. Everything else gets a fixed 404.
  - No `/meri` route is reachable through it, and none of those handlers changed.
  - The image smoke test (`require('./dist/meri/meri.service.js')`) passes on head.

## 4. Outreach, Directory and Strategy [D]

**Outreach duplicate send (`121c628f`, `sendCampaign`): correct for the case it fixes.**
- **The old behaviour.** At base, after the provider had sent mail, the final status update re-checked client visibility. It also matched `where: {id, tenantId, clientId, meetingId}`. So if a grant was revoked, or the client or meeting association changed during provider latency, the update threw or matched nothing. The record stayed `draft`, and a later authorized retry sent again.
- **The fix.** The update now runs on `{id, tenantId}` and records `sent`/`failed` and stats without the visibility re-check. The response still re-reads through `getOutreachRecord`, so a caller who just lost access gets 404 and no content.
- **Tests.** The spec covers all three changes (grant revoked, client changed, meeting changed). In each, exactly one provider send and one update happen, and the retry is refused with "Only draft campaigns can be sent".
- **Pre-existing gap, not introduced here (follow-up):** there is no atomic `draft → sending` claim before delivery. Two concurrent `sendCampaign` calls, or a crash between the provider call and the update, can still send twice, and the final update has no status guard.
- **Live exposure.** `sendCampaign` is unreachable through the preview edge, and `capiro-dev-api` is not built from this repo.

**Outreach read visibility (`a49a77f0`):**
- `outreachReadableClientWhere` (not archived, and no wall or a wall grant for this user) matches `clientMemoryAllowed`'s rule.
- Association checks cover the client, the meeting's client, and the clients of preps and debriefs.

**Directory (`c3481ca9`):** `toPositiveInt` now floors before its range check, so `0.5` falls back instead of returning 0. NaN and Infinity still fall back. Correct.

**Strategy ingress (`5a0fbd01`):**
- It adds a raw-body capture for only the five Objective POST routes and four GET patterns. The existing `json({limit:'8mb'})` is kept for everything else.
- `capiro-dev-api-strategy` is built from capirov2, so there is no live effect from this repo.

## 5. Gates on the merge (fast-forward = `5bf90117`) vs `309af848` [R]

The environment is the same as P6-Core: WSL Docker, `node:22.23.3-alpine3.24`, pnpm 9.12.0 frozen install, pgvector pg16 for the PostgreSQL spec, one tree at a time.

| Gate | Base `309af848` | Head `5bf90117` | Equal? |
|---|---|---|---|
| **Preview Core image** (prepared packet, `apps/api/Dockerfile`, `--platform linux/amd64`, the buildspec's source checks + runtime smoke) | builds, amd64, `SMOKE_OK` | builds, amd64, `SMOKE_OK` | ✓ |
| api `tsc --noEmit` | 62 | **62, the same errors.** The only difference is 4 errors in `meri-memory-legal-hold.spec.ts` that move up one line (the PR deleted a line) | ✓ |
| Mount probe v2 | pass | **identical output** (apart from an ephemeral port) | ✓ |
| Mount specs / PostgreSQL authority spec | 97/97, 10/10 | 97/97, 10/10 | ✓ |
| api / strategy / intel / defense build + typecheck | pass | pass | ✓ |
| jest auth/tenant/bootstrap/config | 26 failing names | the same 26 | ✓ |
| jest feature dirs | 39 | the same 39 (+33 passing) | ✓ |
| jest `src/engagement` | 3 | the same 3 (+23 passing, the new access spec) | ✓ |
| jest api-strategy | 17 | the same 17 (+53 passing) | ✓ |
| jest intel-api | 180 | the same 180 | ✓ |
| defense-api `tsx --test` | 16 failing | the same 16 | ✓ |
| **jest `src/meri`** | 90 failing | **77 failing: 22 gone (the deleted `ResearchPortfolioMeriTurnBinding.spec.ts`, already failing at base) and 9 NEW** | **✗** |
| **meriv2-orchestrator `research-portfolio-current-turn-dispatch.spec.ts`** (new) | — | **does not compile**: 3 × TS2532 at `:76`, `:79`, `:91` (`h.requests[0]` possibly undefined) | **✗** |
| The PR's new root contract specs (12 that need no history) | — | pass | ✓ |
| `scripts/lib/backend-workspace-retirement.spec.mjs` (needs history) | — | pass | ✓ |
| `frontend-artifact-docker`, `rebuild-verification-scopes`, `reviewed-pe-manifest-contract` contract specs (in a real repo with HEAD at the commit) | red: "Unreviewed PE manifest change refused" | **red: "Unreviewed backend-workspace transition refused"** | red before and after, but the head failure comes from this PR's guard (§6 C3) |
| `onboard-spa-artifact.contract.spec`, `backend-retirement-source-jobs.contract.spec.py` | red: reads a `.github/workflows/*` file absent from the tree | red, same | = |
| `tests/support/legacy-web/historical-source-replay.spec.mjs` | — | refuses without `CAPIRO_LEGACY_WEB_SOURCE_ROOT` (an external frontend checkout, by design) | not run |

**The 9 new meri failures** are source-text pins on the retired loop. They `readFileSync` `meri.service.ts` and expect strings that the PR deleted:
- `meri-client-scope-fail-closed.spec.ts`, 8 tests ("the chat tool loop enforces…": `let scopeViolation`, `parsedInput.clientId = conversation.clientId`, …);
- `meri-stream-launcher.fail-closed.spec.ts` › "provider resolution failures are classified before they can become a generic 500" (`meriProviderConfigurationError`).

The current path keeps both protections:
- `meriv3-proxy.service.ts:436` throws `meriProviderConfigurationError`;
- the orchestrator enforces conversation-client scope (`meriv3-assistant.service.ts:3441-3447`, `resolveAuxiliaryToolScopeViolation`).

So these are stale tests, not a lost safeguard.

**About the brief's "ARM64":** the preview Core build and service are **amd64** (buildspec `--platform linux/amd64` + architecture assertion; task definition `X86_64`). I built as the shipper does. No ARM64 image comes from this repo.

## 6. Changes for the author (all test-only)

1. **C1, stale Meri pins.**
   - **Delete** the 8 cases in `apps/api/src/meri/meri-client-scope-fail-closed.spec.ts`, and the "provider resolution failures…" case in `meri-stream-launcher.fail-closed.spec.ts`, **or retarget** them to the current owners: `meriv3-proxy.service.ts` for provider classification, and the orchestrator's `resolveAuxiliaryToolScopeViolation` for client scope.
   - Then the `src/meri` failing set equals the base minus the deleted spec.
2. **C2, replacement dispatch spec.** Make `apps/meriv2-orchestrator/src/meri/research-portfolio-current-turn-dispatch.spec.ts` compile under the orchestrator's jest/ts-jest config (`const [first] = h.requests; expect(first).toBeDefined();`, or `h.requests[0]!`). As committed, the 19 tool identities it claims to inherit from the deleted `ResearchPortfolioMeriTurnBinding.spec.ts` run nowhere.
3. **C3, stale workspace-transition pins.** `scripts/lib/backend-workspace-retirement.mjs` pins `package.json` and `pnpm-lock.yaml` "after" hashes from intermediate commit `016e79b5`:

   | File | Pinned "after" | Head bytes |
   |---|---|---|
   | `package.json` | `5bbfb38f…` | `f3d0b38c…` |
   | `pnpm-lock.yaml` | `c40a4e5d…` | `bd5869cf…` |

   Update the pins (and the CRLF `checkoutAfter` variants) to the final bytes, so the three PE-manifest contract specs pass at head.

**Follow-ups (non-blocking):**
- **Outreach:** an atomic `draft → sending` claim (conditional `updateMany … status:'draft'`) before provider delivery, and a status guard on the final update. This closes the concurrent and crash double-send window that exists before and after this PR.
- **Lockfile hygiene [I]:** the `apps/web` importer was removed, but no package entries were pruned. Packages only web used probably remain in `pnpm-lock.yaml`. A `pnpm install --lockfile-only` would prune them; the frozen install passes as is.

## 7. Merge order

**Nothing in it needs to wait.**
- The only deployable it changes is the preview Core image.
- In that image, the changes are deleting unreachable Meri code, a pure-move refactor, and Outreach/Directory fixes on routes the preview edge does not admit.
- P6-Core is byte-unchanged, and the image builds and smokes.
- C1-C3 change only spec and script files outside the image's runtime (`tsconfig.build` excludes specs; `scripts/` and the orchestrator are not in the Core packet). Fixing them does not change what you deploy, so landing them first, or as an immediate follow-up, are equivalent for the deploy.

**Artifacts:**
- Scripts in this session's scratchpad: `pr104-in.sh`, `pr104-run.sh`, `pr104-extra-in.sh`, `jest-diff.py`, `root-git-specs*.sh`;
- the raw logs were in WSL `/opt/pr104/out/` (removed at cleanup; the summaries above are taken from them).

---

## 8. Follow-up 2026-10-21: test-only fix pushed → `bdaeed65` — **ACCEPT**

**What I did.** One commit on `codex/source-consolidation-20261021-core`, `5bf90117` → **`bdaeed65`**: "test(meri): follow retired chat-loop pins to their current owners".
- It is a fast-forward push. The PR stays a **draft** and is not merged.
- Tests only: 3 spec files, +57/−53, no runtime source.

**C1 (done):**
- `meri-client-scope-fail-closed.spec.ts`: the 8 chat-loop pins on the deleted `meri.service.ts` loop now follow the file's own "follow the enforcement" rule to the current owner, the orchestrator's `MeriV3AssistantService`:
  - the guard is consumed before the input is mutated;
  - a mismatched `clientId` returns `CROSS_CLIENT_REFUSAL`;
  - an omitted `clientId` is filled from the conversation;
  - `blocked` is returned before the registry dispatch.
- The still-valid roster pin on `meri.service.ts` is kept.
- The behaviour itself is already covered by the orchestrator's own specs (`meriv3-assistant.service.spec.ts` cross-client cases).
- The circuit-breaker, bridged-MCP, memory-binding, name-resolution and prompt-tail pins named code that exists only in the deleted loop, so they were dropped, not moved.
- `meri-stream-launcher.fail-closed.spec.ts`: the provider-classification pin now asserts that the V3 proxy's `resolveProvider` call is classified by its own `catch` arm (`throw meriProviderConfigurationError(err)`), without reading the retired file.

**C2 (done):** `research-portfolio-current-turn-dispatch.spec.ts` narrows the single delegated request through a checked helper. It compiles and passes 22/22 (19 tool identities + 3 cases).

**C3 (withdrawn; pre-existing, not introduced by this PR):**
- `frontend-artifact-docker`, `rebuild-verification-scopes` and `reviewed-pe-manifest-contract` are lineage proofs. They require the **current** `package.json`/lockfile to reconstruct the cleanup lineage's reviewed bytes (`016e79b5` / `b7aa1d6e` / `5470c6df`).
- This repo's base `package.json` (`996d7ece`) had already diverged from that lineage (`ffbc0801`), so all three were **red at base** and stay red at head. The PR does not change their status.
- Repinning the `after` hashes, as I first proposed, would break the PR's sealed proof: `backend-workspace-retirement.spec.mjs` asserts that the bytes at `8d3c7422` reconstruct `016e79b5`, and it passes.
- The lock and workspace inverses do reproduce this repo's base exactly. `package.json` differs only by the moved `build:backend` line.
- Making the three proofs green means re-baselining them to this repo's history. That is a separate cleanup task, not a merge blocker.

**Re-run [R].** Same WSL Docker recipe, base `309af848` vs fix `bdaeed65`, the same recipe on both sides.

| Check | Base | Fix | Result |
|---|---|---|---|
| The two touched api specs | — | 2 suites, 19/19 pass | ✓ |
| Orchestrator dispatch spec | — (new) | 22/22 pass | ✓ |
| Orchestrator `src/meri` | 127 suites, 0 failing | 128 suites, 1,693 passing, 0 failing | ✓ |
| api jest `src/meri` failing names | 86* | 64* | **0 new.** Fix = base − the 22 names of the deleted `ResearchPortfolioMeriTurnBinding.spec.ts` (failing at base, now covered by the orchestrator spec) |
| api `tsc` (full P6 recipe: four closures, every Prisma client) | 62 | **62** | ✓ |
| api `tsc` (this narrower recipe) | 75* | 75*, the same errors ignoring positions | ✓ |

\* This run installed only the api and orchestrator closures, so api-strategy's Prisma client was not generated. That accounts for the higher tsc count and the different meri count than in §5; base and fix are compared under the same recipe.

The other jest groups (auth, features, engagement, strategy, intel, defense) were already equal to base in §5, and this commit touches none of their files.

**Verdict: ACCEPT `bdaeed65`.** The PR now adds no failing test name, tsc stays at 62, and the runtime content (§1-§5) is unchanged.
