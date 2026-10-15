# Fable round 4: dependency decision, Docker-proof selection, suite inventory and portable receipts (15 Oct 2026)

Branch `fable/r4-deps-recipe-20261015`, base `81e20025` (package three, as reviewed by dot). Scope: the coordinator's bounded dependency decision (PACKAGE3-REVIEW-20261015 "Coordinator technical owner decision"), the Docker-copy proof correction and the suite recipe/receipt items (same review, "Checks, failures and exact evidence limits"; PACKAGE3-INTEGRATION-REVIEW §2, §3, §5, §7). Not pushed. Candidate f bytes, hashed proof rows, P2b and frozen contracts are untouched.

## Outline

- Dependency owners: each package declares what its files import, at the pin already locked in the repository; locks change only by the added/flagged entries. The schedules harness keeps its conversations-anchored Temporal client.
- Docker proof: a small selection module in `scripts/qualification/assembled-image/` (owner of the candidate manifests) binds the frozen candidate to the historical manifest and supplies the expected copied bytes; `image-closure.test.mjs` consumes it.
- Recipe: `inventory.mjs` owns `suites.json` loading, file resolution and coverage accounting; `receipt.mjs` owns spec parsing and receipt/checksum writing; `run-suites.mjs` stays the CLI and orchestration.

## Commits

1. `bc935a1f` Declare approved dependencies at existing locked pins; guard keeps only the frozen SDK type-only row and the anchored Temporal client seam (now asserted); `link-dependencies.sh` drops the pg/jszip links.
2. `c414a1af` Docker COPY check compares copied proof sources with candidate f (pinned `3215210633f6…`) after verifying its row-by-row binding to the historical manifest.
3. `c5645fa4` Complete suite inventory (every test file covered or excluded with a reason, enforced by `inventory.test.mjs`) and per-suite portable receipts; `--out` must be outside the checkout.
4. `456fdf90` Worker qualification static checks record the declared zod 4.6.5 (found by the first pristine run).
5. `a0a85df8` Runner supplies `MERI_SELECTED_OUTPUT_ARTIFACT_ROOT` so a document test no longer writes into the checkout (found by the first pristine run); observed host requirements recorded.
6. This report (docs only).

## Dependency decision: lock diffs

All added entries have the same version, resolved URL and integrity as an entry already locked in this repository (checked per entry against `apps/runtime` for the pg tree and `apps/worker/qualification` for the jszip tree). No entry was removed and no version or integrity changed. Generated with `npm install --save-exact --package-lock-only --ignore-scripts`; package.json key order preserved; every lock installed with `npm ci` in both pristine runs.

| Lock | Change |
|---|---|
| root | devDependencies `pg` 8.23.1, `jszip` 3.10.2; 27 added `dev` entries (pg, pg-cloudflare (optional), pg-connection-string, pg-int8, pg-pool, pg-protocol, pg-types, pgpass, postgres-array/-bytea/-date/-interval, split2, xtend; jszip, lie, immediate, pako, readable-stream, core-util-is, inherits, isarray, process-nextick-args, safe-buffer, setimmediate, string_decoder, util-deprecate) |
| apps/control/conversations | devDependencies `pg` 8.23.1, `@temporalio/common` 1.24.0 (already locked, unchanged entry); 14 added `dev` entries (the pg tree above) |
| apps/worker/conversation | dependency `zod` 4.6.7, devDependency `@modelcontextprotocol/sdk` 1.32.1; no entry added; 94 existing entries (the MCP SDK/zod subtree) lose `"peer": true` only |
| apps/worker/qualification | dependency `zod` 4.6.5; root entry only |
| apps/artifacts/storage | unchanged (keeps pg 8.23.0) |

The guard now also asserts the approved pins equal their owner lock entries, and that the root does not declare `@temporalio/client`.

Image note for dot: the unchanged Dockerfile runs `npm ci` without `--omit=dev` for the root and conversations prefixes, so an image built from this tree would also install the test-only pg/jszip trees there. Whether to add `--omit=dev` is a Dockerfile (hashed row) decision for an image candidate.

Worker provenance note: `docs/qualification/candidates/dot-provenance-refresh-20261015/worker-candidate.json` binds the old bytes of `apps/worker/qualification/{package.json,package-lock.json,component-pins.json}`; a successor worker source candidate is needed at integration. The historical record was not edited.

## Docker-copy proof

`frozen-candidate.mjs` refuses unless candidate f's bytes hash to the pinned value, it names `source-manifest.json` byte-exact, the 45 paths match, each unchanged row equals history and each changed row carries the exact historical hash and a different current hash. Copied bytes are then compared with candidate f. 7 unit tests run without Docker (current tree passes; 18 stale historical rows characterized; excluded/drifted copies reported per path; edited, unbound, duplicate and path-drifted manifests refuse). Reverting the selection to historical hashes fails 3 of 7. The Docker test itself was not run: no Docker daemon (`/var/run/docker.sock` absent).

## Inventory and receipts

`suites.json` now has 43 suites and 3 exclusions; 750 test files: 559 covered, 191 excluded (historical `docs/`, Python qualification-tool tests, and `infra/qualification/checkpoint-security.test.mjs`, which needs `node infra/qualification/checkpoint-app.mjs` first; that separate command is recorded). Reverting the telemetry and worker browser/reads globs fails 2 of 5 inventory tests, naming those 12 files. Receipts: `receipts/<suite>.json` per suite, raw outputs, `RESULTS.json` and `SHA256SUMS`, written outside the checkout; `--name-pattern` for targeted reruns, `--source-commit` for exports. Reverting the outside-checkout refusal or the summed parse fails 2 of 5 receipt tests. The dependency guard with the four package.json files reverted fails, listing the 20 resolved rows.

## Pristine archive qualification

Host: Linux 6.18, Node v24.21.0, npm 11.19.0, UID 0 (`--allow-root`), no Docker daemon, PostgreSQL clusters not provisioned (canonical socket paths are shared with other sessions), no `/opt/codex` host paths. Command: `bash scripts/qualification/local-baseline/clean-checkout.sh --out <scratchpad receipts> --allow-root --source-commit <sha>` from a `git archive` export in a fresh scratch directory with 0 symlinks and 0 `node_modules`.

Run 1 at `c5645fa4` (tar SHA-256 `6d4255e1…3219`) found two problems this lane caused or exposed, fixed in commits 4 and 5. Run 2 at the final code commit `a0a85df8` (tree `038bac45`, tar SHA-256 `531146ab…a53f`): 13 locks installed; 43 suites, 31 passed; 10365 tests, 10100 pass, 261 fail. Counts are pass/tests:

| Suite | Run 1 `c5645fa4` | Run 2 `a0a85df8` | Failures in run 2 (observed error) |
|---|---|---|---|
| source-proof | 5/5 | 5/5 | |
| assembled-image-local | 17/17 | 17/17 | |
| contracts-package-check | exit 1 | exit 1 | `Generated drift: document-application.metadata.json` (pre-existing contracts-owner item) |
| root-check | 4241/4241 | 4241/4241 | |
| sdk-evidence | 369/369 | 369/369 | |
| runtime-typecheck | exit 0 | exit 0 | |
| runtime-tests | 221/228 | 221/228 | Docker: `failed to connect to the docker API at unix:///var/run/docker.sock`; 2 `ECONNREFUSED` broker socket; 3 runner tests `RUNNER_WORKSPACE_REFUSED` (UID 0); runner-bootstrap: `cleanup failure is reported with the original failure`, actual `RUNNER_BOOTSTRAP_FILE_REFUSED` (root-sensitive chmod fixture). Runner/bootstrap reproduced in a targeted rerun (33/37). |
| conversations-typecheck | exit 2 | exit 2 | TS2345/TS7006 in `apps/worker/conversation/reads/{schema,tools}.mjs`, reached via `options.mjs`. Byte-identical output with conversations' `pg` moved aside, so not caused by this lane |
| conversations-tests | 214/305 | 214/305 | all 91 PostgreSQL: 39 `EXPLICIT_ISOLATED_LOCAL_POSTGRES_REQUIRED`, 52 `ECONNREFUSED`. No `ERR_MODULE_NOT_FOUND` now that pg is declared, so more pg cases load and run |
| conversations-skills | 33/33 | 33/33 | |
| worker-conversation | 266/266 | 266/266 | includes browser and reads |
| worker-qualification | 254/257 | 257/257 | run 1: the 2 zod pin checks (fixed in commit 4); image-inventory `directory/ancestor identity changed: /tmp`, passed 9/9 on targeted rerun |
| native-authority | 320/355 | 320/355 | 35 PostgreSQL `ECONNREFUSED` |
| runtime-selected, runtime-artifacts | 20/20, 26/26 | same | |
| gateway, -budget, -sources, -local-action, -selected-skills, -general-reads | all pass (budget 1 skip) | same | skip: `MERI_TENANT_BUDGET_PG_SOCKET` unset |
| artifacts | 328/331 | 328/331 | 2 files `MODULE_NOT_FOUND` from the Codex-host `pptxgenjs` path; 1 skip |
| control-core | 260/260 | 260/260 | |
| control-retention | 26/33 | 26/33 | 7 PostgreSQL `ECONNREFUSED` |
| control-action-host | 328/386 | 328/386 | 57 host git fixture `/tmp/capiro-endpoint-integration-source-20261013.git` absent; 1 `aborted whole-run deadline must stop awaiting the borrowed callback`. Its targeted rerun (`--name-pattern`) hung over 20 minutes in `local/recovery-independent.test.mjs` until stopped, then reported the file failed |
| control-action-application, -followthrough, -admitted-runs, -commands | all pass | same | |
| control-document-application | 262/264 | 262/264 | `actual HTTP Word draft and revision…`: `ARTIFACT_BUDGET_SETTLEMENT_UNKNOWN`, reproduced in targeted reruns of both runs; 1 skip |
| control-schedules | 153/154 | 154/154 | run 1 `independent: authority expiresAtMs substitution refuses`: `Missing expected rejection` (the known frozen-clock fixture; reproduced in its run-1 targeted rerun; passed in run 2; not fixed by this lane) |
| control-task-lookup, -staging-e2e, -qualification-temporal | all pass | same | |
| control-qualified-application | 362/393 | 362/393 | 31 `ENOENT /tmp/meri-qualified-lifecycle-deps/jsonata.cjs` |
| control-qualification-sdk-fixture | 65/71 | 65/71 | `FIXTURE_TEST_CERTS_MISSING` (`.task-inputs/sdk-fixture-ingress-1/certs`), `EXPLICIT_ISOLATED_DATABASE_EXECUTION_REQUIRED`, `ISOLATED_TEST_DATABASE_REQUIRED` |
| proxy-qualification | 29/29 | 29/29 | |
| infra-qualification (new) | 7/7 | 7/7 | |
| infra-offline (new) | 93/115 | 97/120 | 16 jsonata `ENOENT` and 3 browser-enforcement files failing at load; `git show 4fd85f7:…` `not a git repository` (archive has no history); asset protocol: `script.includes("expected['schema']=='meri-host-assets-build-input/2'")` false and preflight `assert set(expected)==…` AssertionError, apparently a test/source mismatch in `infra/browser-qualification` (not diagnosed further here); observer replay `1 !== 0`. All 7 reproduced in a targeted rerun |
| window-resolution, skills, evals | all pass | same | evals now includes isolation, offline-targets, performance and promptfoo |
| scripts-local | 57/58 | 71/72 | run 1: scope ledger refused files left in the checkout by the selected-output test (fixed in commit 5); after deleting them, a rerun passed 71/72 with 1 skip |

Before reference (author evidence, not rerun here): the clean-checkout lane's archive at `eafcb769` had 38 suites, 27 passed, 9066/9236 passed. Owner-reported package-three aggregates were runtime 221/228 and schedules 153/154.

Receipts stay in the session scratchpad, not in Git: run 1, run 2, both sets of targeted reruns, revert proofs and lock diffs. Run 2 `RESULTS.json` SHA-256 `5f868c9a…e304`, `SHA256SUMS` `ed147908…bae`. Both exports and their `node_modules` were deleted afterwards.

## Not run

Docker image build or COPY closure (no daemon), real PostgreSQL suites (not provisioned on this shared host), non-root runner checks, Codex-host Python/LibreOffice/pptxgenjs paths, host git/jsonata/certificate fixtures, the checkpoint template check, Python qualification tests, and any AWS, SDK provider or Temporal server call. This commit adds only this report to the qualified tree `a0a85df8`.

## Proposals and residual items for dot

- Image candidate: decide `--omit=dev` for the root and conversations `npm ci` lines in the Dockerfile (hashed row).
- Worker provenance: record a successor worker source candidate for the three changed qualification inputs.
- Owners outside this lane: the conversations typecheck errors in `apps/worker/conversation/reads`; contracts generated drift; the `infra/browser-qualification` asset-protocol mismatch; the action-host deadline test, which hangs when targeted; the document-application `ARTIFACT_BUDGET_SETTLEMENT_UNKNOWN`; and the schedule frozen-clock fixture, which belongs to its own lane.
- Two artifact checks still resolve `jszip` through the hard-coded Codex-host `pptxgenjs` path, so the root `jszip` declaration does not make them load. Changing those sources is a separate decision.
