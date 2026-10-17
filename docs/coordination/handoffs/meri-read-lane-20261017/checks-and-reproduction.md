# Reproduce the read-lane checks on another machine

Run from a task-owned checkout. No original machine path, symlink/junction, local dependency cache, private token or local helper is required. The historical logs retain their original Windows executable/cwd and stack paths as execution provenance. [commands.json](commands.json) contains portable relative arguments and distinguishes each pinned source. This safe-stop did not repeat product test suites or perform a fresh dependency installation.

## Recover source and documentation

Use Git with access to `neo-capiro/meri-greenfield`, Node24 (`>=24 <25`; recorded version24.19.0) and npm. Check disk/RAM before provisioning. Fetch the immutable commit from this handoff's URL into a new task checkout, preserving other owners' work. The handoff commit adds documentation over PR110; implementation is identical to source head `f7f4ed5b397fcd44576251739ed361aee6941d7a`.

```sh
git clone --filter=blob:none --no-checkout https://github.com/neo-capiro/meri-greenfield.git meri-read-pickup
cd meri-read-pickup
git fetch --no-tags origin <full-handoff-commit-from-immutable-URL>
git switch --detach FETCH_HEAD
git status --porcelain=v1
node --version
npm --version
```

Angle-bracket text above is the published handoff commit, not a branch name or old local-equivalent SHA. A full ordinary clone also works. Use a source-complete checkout for the recorded checks; this handoff does not qualify a smaller sparse selection. Missing historical blobs in a partial clone must be fetched before the offline fixture verifier.

## Prepare exact dependencies once

The passing original checks borrowed root dependencies from an existing checkout and worker dependencies from an ignored local junction. Those locations are not portable inputs. Prepare the root and conversation-worker dependencies from their committed lockfiles in this task checkout, reusing a verified equivalent installation only when coordinated with its owner. Expected critical worker versions are SDK0.3.295, MCP1.32.1 and Zod4.6.7; the exact lock identities are recorded in [commands.json](commands.json).

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm ci --prefix apps/worker/conversation --ignore-scripts --no-audit --no-fund
```

This lock-based fresh-install recipe is **documented, not freshly qualified by this stopped lane**. It performs no product startup or provider calls. Do not regenerate lockfiles, change Zod, copy the old junctions or install every package in the repository. If an additional package is required by a changed check, resolve its owning committed manifest/lock explicitly. Runtime/build/native-addon checks outside the selected source tests have separate setup requirements.

## Restore only required historical test objects

The unchanged `scripts/scope-ledger/source-exposure.test.mjs` reads four historical local commit IDs. They were tree-identical local equivalents of published PR105/106/107/109 source. Their exact small commit payloads are now Git-backed in [baseline-commit-objects.json](baseline-commit-objects.json); no archive or old repository is required. They are historical fixture aliases, not public ancestors or release pins.

First fetch their published equivalents (also ancestors of PR110):

```sh
git fetch --no-tags origin b4daa4adf6e8269e7c341751db9a02bf6d4f062b 526b6be7c906c15298f13430fe5dd5a9db458e03 382f45ae695e271bf7433343d31486ac0d57184a f33ea1a8945444b5ad8d15d5d048377abf201959
```

For a partial clone, this explicit read-only command hydrates exactly the16 historical file versions needed. Git may fetch those missing published objects through its configured origin. It writes no source file:

```sh
node --input-type=module -e "import {readFileSync} from 'node:fs';import {execFileSync} from 'node:child_process';const f=JSON.parse(readFileSync('docs/coordination/handoffs/meri-read-lane-20261017/baseline-commit-objects.json','utf8'));for(const o of f.objects)for(const p of f.requiredPaths)execFileSync('git',['show',o.publishedEquivalent+':'+p],{stdio:['ignore','ignore','inherit']});"
node docs/coordination/handoffs/meri-read-lane-20261017/restore-history-fixture.mjs --check
node docs/coordination/handoffs/meri-read-lane-20261017/restore-history-fixture.mjs --restore
```

The verifier independently checks raw Git commit SHA1, exact payload bytes/tree, the fetched public equivalent tree and all required historical file objects with lazy network fetching disabled. Only after every check passes does `--restore` write the four commit objects. It does not change refs, index, worktree, parent history or source. Default/`--check` writes nothing; `--help` documents exit codes. The original four file comparisons remain unchanged.

## Run the recorded current selection

This portable invocation works with the handoff checkout at repository root. It uses Node's current executable and the exact19-file serial/256MiB argument selection from the passing run:

```sh
node --input-type=module -e "import {readFileSync} from 'node:fs';import {spawnSync} from 'node:child_process';const c=JSON.parse(readFileSync('docs/coordination/handoffs/meri-read-lane-20261017/commands.json','utf8')).runs.latest;const r=spawnSync(process.execPath,c.args,{stdio:'inherit'});process.exit(r.status??1);"
node --preserve-symlinks --max-old-space-size=256 scripts/scope-ledger/cli.mjs --check-exposure
git diff --check
```

Recorded current result: **1029/1029 PASS**, exit0, zero failed/skipped/cancelled,77,649.6677ms. [Original invocation/status](../../reports/read-completion-20261017/combined-affected-initial.json) and [full output](../../reports/read-completion-20261017/combined-affected-initial.txt) remain committed. A new run is a new result; preserve failures and changed environment details.

Historical funding command selection in `commands.json.runs.fundingHistorical` passed1006/1006 at **PR109 `b4daa4adf6e8269e7c341751db9a02bf6d4f062b`**. Its count is not an expectation for PR110. [Original metadata](../../reports/funding-asof-20261017/integrated-final.json) and [output](../../reports/funding-asof-20261017/integrated-final.txt) are Git-backed. All68 evidence files from five read-increment directories have content identities in [evidence-index.json](evidence-index.json).

## Evidence interpretation and known limits

- Latest author focused runs: BD source24/24; legal18/18; owner/SDK37/37; added native-RPC gate1/1; promotion15/15; ledger26/26. These overlap the combined run and are not additive qualification totals.
- Independent review separately passed BD10, legal18, owner/SDK37 and native-RPC1. The five-family/12-operation217-assertion passive manifest probe is recorded in [the review report](../../reports/CODEX-READ-COMPLETION-REVIEW-20261017.md); its exact executable/raw output was not archived. Treat it as supplementary historical review evidence, not a required hidden helper.
- The initial owner/SDK33/35 failure output and status1 remain preserved. Two HTTP403 expectations were corrected to the existing strict boundary's `INVALID_RESULT`, and two static-fallback negatives were added. Four whitespace-only lines were normalized, with original/working/published-LF hashes in [metadata](../../reports/read-completion-20261017/evidence-normalization.json). Assertions, stacks and outcomes remain visible.
- Earlier failed/corrected funding runs and12-line whitespace metadata remain in their evidence directory. Do not discard or reinterpret failed outcomes as successful runs.
- Existing broad historical inventory classification failures, Windows worker path-guard/platform fixture differences and asset symlink `EPERM` are separately documented baseline issues. The selected check suite does not establish broad-suite, clean-machine install or cross-platform acceptance. Do not weaken checks to make a new environment pass.
- Tests use synthetic SQL/native HTTP and current-authority fixtures. They do not qualify the actual Core server, tenant/provider policy, SDK installation, physical isolation, browser, Temporal durability, AWS or a first real conversation. Read-source fingerprint changes require fresh exact source/installation qualification.
- Core PR52's compiler/review statements are owner-reported in [candidate metadata](core-funding-candidate.json); this lane has not run or accepted its cross-repository bridge. All five funding reads remain partial and SDK-withheld.

No live credentials, database setup, provider budget, startup, image build, deployment or migration is needed for these recorded source checks. Any live continuation requires the primary owner's current integration plan and explicit applicable authorization.
