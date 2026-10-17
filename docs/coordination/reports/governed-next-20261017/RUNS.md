# Governed-read checks — 17 October 2026

These runs use synthetic native HTTP, scripted SQL and in-memory MCP. They establish source behavior, not real PostgreSQL, provider, source, audit-write or deployment qualification.

Node is24.19.0 from the bundled runtime. Every worker/SDK check uses `--preserve-symlinks --max-old-space-size=256 --test --test-concurrency=1`, resolving worker, MCP and SDK imports to the verified offline task-local Zod4.6.7 overlay. Adjacent JSON files record exact executable, arguments, status and signal. Every owned process exited.

A final `createRequire` resolution probe from the worker schema, MCP server and Claude Agent SDK entry points independently returned the same task-local `apps/worker/conversation/node_modules/zod/package.json`, version4.6.7, for all three consumers.

| Evidence | Result | Interpretation |
| --- | --- | --- |
| `integrated-read-tests.txt` / `.json` | **538/538**, exit0 | Real general-family durable dispatch, all native-family owner wiring, worker inventory and new MCP exposure. All13 native operations work;12 new SDK operations are exposed. |
| `sdk-blocker-and-exposure.txt` / `.json` | **42/42**, exit0 | Stronger raw-versus-normalized data-search contradiction proof plus all12 new exposed MCP tools and trusted-date bridge. Data-search is absent from `familyReads`, and its unchanged SDK conversion fails closed. |
| `ledger-and-helper.txt` / `.json` | **27/27**, exit0 |17 source-exposure/historical-preservation checks plus10 common adapter mechanics. Final Markdown-only regeneration is checked separately before commit. |
| `retained-and-worker-regression.txt` / `.json` | **143/147**, exit1 | All142 checks outside `reads/test/options.test.mjs` pass; that unchanged file has1 pass and4 failures. Includes retained portfolio/changes/Florida behavior and previous read families. |
| `baseline-options.txt` / `.json` | **1/5**, exit1 | Same four named failures at unchanged PR103/local48e0919 base, with the same pinned dependencies. Confirms no regression introduced by this increment. |
| `integration-first-failures.txt` | **530/540** initial | Explicitly condensed failure transcript, not a claim to preserve full initial stdout. Three actual data-search raw owner admission failures fixed through its canonical normalizer; three SDK failures became explicit central-contract hold; two registry expectations and two unsupported-dataset date fixtures corrected. |

An earlier root helper/ledger run was26/27: the newly written unexposed assertion incorrectly mapped strings as object rows and obtained `undefined`. The assertion was corrected to compare the exact existing string array; the retained27/27 rerun verifies the intended hold. No production behavior changed for that assertion.

## Baseline failure classification

The first and third `options.test.mjs` failures are `RUNTIME_CONFIGURATION` at `options.mjs:25`: the trusted runtime workspace uses a native Windows path while the unchanged guard requires the literal suffix `/<conversationId>`. The second is `WORKSPACE_ROOT_REFUSED` at `capabilities/workspace-tools.mjs:16`, whose unchanged guard rejects backslashes. The test fixture obtains its workspace from native `realpathSync`; these files are byte-identical to PR103 and release PR98. No path guard or fixture is relaxed by this lane.

The fourth is `STORE_UNAVAILABLE` during the scripted application's submission. A bounded diagnostic against the unchanged baseline wrapped only the synthetic pool and captured the underlying failure: `Unexpected SQL: SELECT * FROM meri_conversations.initial_inputs WHERE tenant_id=$1 AND conversation_id=$2 FOR UPDATE`. `applicationFixture` defaults to `storeFixture`; that fixture lacks the initial-input query protocol used by current submission. The diagnostic made no database/network call, altered no source and closed its session owner. This fixture gap is outside the read lane; it is not classified as a Windows path failure.

The prior PR1036/7 broad workspace guard check remains a separately recorded limitation; it was not rerun or counted as passing here.

## Independent review

The independent reviewer returned **ACCEPT_SOURCE** with no blocking findings for the completed adapters (77/77 and50/50 focused checks), then for the integrated owner/context/visibility changes (132/132 owner checks and213/213 native-wiring/MCP checks). A separate documentation reviewer verified17/17 exposure checks, exact historical-field preservation, all28 missing operations in15 families and the distinction54 implemented/53 exposed/one unexposed/live0. Review does not assert native/live qualification.
