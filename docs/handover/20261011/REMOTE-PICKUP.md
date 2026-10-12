# Remote Codex pickup runbook

The next execution runs on a **remote server**, not `C:\dev\main`. GitHub is the source of code and documents. Local Windows paths in historical reports are provenance locators; do not assume those paths, dependency junctions, sessions, credentials or raw captures exist remotely.

Read this runbook, the [full handover on the publication branch](https://github.com/neo-capiro/meri-greenfield/blob/task/handover-20261011/docs/handover/20261011/Meri_Greenfield_Engineering_Handover_2026-10-11.md), [continuation instructions](CONTINUATION-INSTRUCTIONS.md), [reference index](REFERENCE-INDEX.md), [code checkpoint manifest](REMOTE-CODE-MANIFEST.json), repository AGENTS and human implementation standards. The engineering status snapshot is **G0 accepted, G1 OPEN, G2–G7 unentered**. Handover publication changes neither gate status nor deployment authority.

## 1. Recover the exact code state from GitHub

The published handover branch contains accepted integration source baseline `2f0e03ac656e393165ebc539bf6bfe9209623e2d` plus documentation. It does not integrate pending mail or SDK WIP. The default `main` branch at the engineering snapshot was only `f2d6c0b`; cloning `main` alone misses the latest accepted collector and this handover. Start with the handover branch and pin the final publication SHA supplied with the handover link. Record your actual checkout SHA before working; inspect any later changes rather than assuming the mutable branch has not advanced.

```sh
git clone --branch task/handover-20261011 https://github.com/neo-capiro/meri-greenfield.git meri-greenfield
cd meri-greenfield
git rev-parse HEAD
git status --short
git fetch origin task/g1-parallel-integration task/g1-rel02-mail-list-search-contract task/g1-rel02-remaining-capability-metadata handoff/sdk-worker-adapter-wip-20261011
git cat-file -e 2f0e03ac656e393165ebc539bf6bfe9209623e2d^{commit}
git cat-file -e dd98d6268d2e7057b4ef236bb2fd352f0fb0cec6^{commit}
git cat-file -e 086263abdf1b5c34b502a44d957b5568e837f992^{commit}
git cat-file -e 4d33640d9eaadc045c1c1f15dfcceddfe330f3fa^{commit}
```

Use approved GitHub authentication; never put tokens in commands, briefs or logs. Create new branch/worktrees for bounded work and review. Preserve all fetched source snapshots.

| Exact source | GitHub branch | Current meaning |
|---|---|---|
| `2f0e03ac656e393165ebc539bf6bfe9209623e2d` | `task/g1-parallel-integration` | Root-accepted source baseline including collector; G1 still open; actual collector/proxy execution unrun. |
| `dd98d6268d2e7057b4ef236bb2fd352f0fb0cec6` | `task/g1-rel02-mail-list-search-contract` | Pending root acceptance; distinct review ACCEPT_SOURCE_ONLY. Do not enable handlers. |
| `086263abdf1b5c34b502a44d957b5568e837f992` | `task/g1-rel02-remaining-capability-metadata` | Pending root review of documentation/metadata, not 93 implemented operations. |
| `4d33640d9eaadc045c1c1f15dfcceddfe330f3fa` | `handoff/sdk-worker-adapter-wip-20261011` | Unfinished, unreviewed SDK source snapshot. Seven paths copied byte-for-byte from interrupted work; no new test or acceptance claim. Finish and independently review. |

All four remote refs were pushed and independently read back using `git ls-remote`. [The manifest](REMOTE-CODE-MANIFEST.json) contains source dispositions and every SDK WIP file SHA256. The original interrupted local SDK worktree was preserved. There is **no SOURCE5 implementation diff** in the allocated browser worktree at publication; its clean base is `2f0e03a`. Implement the exact-VolumeIds/error-shape follow-up as a new bounded task instead of searching for an uncommitted hidden patch.

Clone the independent frontend repository and pin the accepted offline Home source:

```sh
cd ..
git clone https://github.com/neo-capiro/capiro-frontend.git capiro-frontend
git -C capiro-frontend switch -c resume/meri-ui 28c300093c0886018c49df8764a8e6fac44819eb
```

Its full workspace UI, backend transport integration and visual/accessibility gates remain incomplete. Portfolio, Modules and Settings are future modular features. No current Capiro implementation is copied into either repository.

## 2. Discover the remote environment before execution

Record OS/architecture, runtime versions, GitHub access, available disk/memory, process ownership controls, installed Hermes CLI/version/help, browser prerequisites and access to approved cloud roles/artifact storage. Both root repositories currently require Node `>=24 <25`; use each checked-in lockfile and documented package scripts. Backend uses `npm ci` and focused `npm run check:contracts`/`npm run check:infra`; frontend has documented `check`, `build` and transport/Elements checks. These are future pickup commands, not claims that they ran during publication.

Do not copy local `node_modules`, junctions, credential stores or caches to the remote server. Restore dependencies from pinned manifests. Historical PowerShell wrappers and `C:` paths need explicit platform qualification before use on Linux. Preserve fixed deadlines, argv boundaries, native errors, evidence hashes and cleanup semantics when porting a wrapper. No unsupported CLI flags, silent SDK downgrade or sandbox bypass is allowed.

Development sessions are not the production environment. Application/control/trusted services still belong in the approved isolated Fargate environment in us-east-1; the browser exception is a new dedicated isolated host. Discover and verify the approved account/role/resource bindings before new cloud actions. Do not use ambient remote credentials as implicit authority or touch current Meri/Capiro resources.

## 3. Recover evidence safely

Plans, workbook, canonical reports, pending report documents, code and WIP source are in GitHub. Raw `.task-inputs`, native/private archives, provider/auth material and local execution receipts are **not** bundled in Git. [Published evidence status](LOCAL-EVIDENCE-STATUS.md) gives safe hashes, locators and limitations. Obtain required original captures through an approved encrypted evidence store/transfer and verify their original hashes before relying on them. A usable secure remote archive locator was not established in this documentation task.

If required raw evidence cannot be recovered, retain the historical stated limit, mark reproduction/evidence availability pending and run only new independently admitted experiments when appropriate. Never fabricate old results, refresh consumed proofs, reset UNKNOWN reservations, replay historical paid jobs or claim a rebuilt image recreates missing original evidence. Missing captures need not block independent source work; they block claims that require those captures.

## 4. Find the active cleanup execution on the other remote server

The current cleanup session is **not the local PC chat**. Discover its current server/session/owner from available remote execution registries, GitHub coordination records and fresh `neo-capiro/capirov2` branch/PR metadata. Confirm the actual active owner by a current response/handoff; old local thread IDs, contributor names and stale draft PRs are insufficient.

Exchange and publish the coordination boundary described in [continuation instructions](CONTINUATION-INSTRUCTIONS.md#continue-coordination-with-the-cleanup-session). Continue isolated implementation while discovering the locator. Hold overlapping interfaces, auth/CORS/schema/migrations, shared fixtures, resource cleanup and merge/release until ownership and validation windows are agreed. If routing cannot be discovered, ask for that missing locator only; do not imply that coordination has occurred.

## 5. Resume implementation and close every worker

Codex remains integration owner. First review the two pending candidates, preserve and finish the SDK WIP, and allocate multiple independent bounded Hermes lanes for proxy source, SDK, browser SOURCE5, contract families, frontend feature groups and verification preparation. Serialize common contract/catalog/lockfile/migration changes. Use the exact task/dependency and first-G1-exit sequence in the full handover.

At the end of **every** worker task, workstream and phase, Codex validates all Hermes output independently, checks integrated regressions, coordinates affected cleanup boundaries, publishes ACCEPT/HOLD evidence and advances only when the applicable gates pass. Close every owned Hermes session and process group after collecting its commit/handoff; verify physical exit and reconcile the registry. **No dormant Hermes sessions are allowed.** Failure, cancellation and timeout use the same cleanup path. Preserve source/evidence and other sessions' resources.

G1 still requires actual combined proxy auth/revocation, durable budget/model path, two-task SDK interrupt/resume, real browser-host sandbox/egress/teardown, native discovery RG-08, measured cohorts and exact-image security/license acceptance. There are eight deployment gates total. Await the approved location/owner for 75 real requests; synthetic data is not a substitute. Keep source connections disabled until authorized. No cutover is permitted until the exact finished/tested candidate passes the later gates and receives explicit G7 approval.
