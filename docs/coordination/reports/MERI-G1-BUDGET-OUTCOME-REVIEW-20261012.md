# Canonical budget outcome review — 2026-10-12

Reviewer gateway_reviewer; isolated branch `review/meri-budget-outcome-20261012`, base `263d0d174f9924a6030bb1c20100ff1115ffcda0`. **ACCEPT_SOURCE** for author `028b1134e373734caea036ee5c38d35b20428d8b`, tree `2a1e21e38a568965270ca5c3982173991b234c9d`. Read root task `MERI-G1-OWNER-CONTINUATION-20261012.md`, AGENTS, implementation standards, R2, canonical budget store/binding/adapter/dispatcher/production-disabled factory and checkpoint control/stop callers. No repository .agents skill directory is present. Native/runtime/G1 remain HOLD.

## Ownership and outline

Review owns only this report and `docs/qualification/candidates/g1-budget-outcome-20261012/review/`. Author first proposes the API/module allocation to root. No reviewer production changes, schema/lock/dependency edits or delegation. Source tests may use inert scripted transaction boundaries and actual canonical source; no real Pool, SQL engine, native/server/Temporal/provider/cloud/customer execution or credentials.

The existing real source composition is `createDurableSourceDisabledGateway` → `createDurableToolDispatch` → `createPostgresToolBudget` → `PostgresBudgetStore`. Existing `createFixtureControl`/`createRunStop` owns separate checkpoint registry and publication liability; no gateway caller connects it to the budget. A new trusted readback must extend the actual durable gateway composition, not invent a second ledger or force unrelated state stores together. Runtime/Temporal persistence of invocation identity remains unqualified.

The author's preliminary API has a fresh current observer invocation, a historical original target invocation, and closed operation/arguments-digest expectation. Root must select the read authority semantics explicitly. A fresh observer requires a legitimate already-bound current grant even when the target grant is expired/revoked/replaced; absence of one must HOLD rather than authorize a new grant automatically. Owner-only historical inspection has different revocation implications. Neither choice can be silently represented as existing behavior.

## Frozen acceptance criteria and negatives

1. Reuse the canonical shared budget store, immutable allocation, exact grant correlation and transaction/aggregate-lock order. Add no table/migration/cache or second producer. Run source tests through actual durable gateway/dispatcher composition and canonical adapter/store with an inert scripted query boundary. Do not count scripted queries as real SQL evidence.
2. Trusted raw JSON inputs are snapshotted/validated before any await. Reject malformed/oversized/extra/invalid scalar inputs without effects; caller mutation, accessors and proxies cannot change target/authority. Exact allocation/tenant/actor/conversation/run binding is mandatory. Current and original task/attempt/fence/policy/grant/credential digests remain distinct and exact, preventing stale A from impersonating B.
3. Root-selected current read authority must be validated from canonical durable current run/grant/allocation facts; changing only a JSON label is not authority. Missing/stale/revoked/expired/mismatched observer refuses. Historical original target may remain revoked/expired/replaced only as an exact ledger target, never as fresh effect authority. No automatic grant mint/replacement/retry is allowed.
4. Exact target invocation facts plus expected operation and arguments digest bind the read. Verify redundant persisted row identities, reservation UUID, allowed state and internally consistent charge/output/timestamps. Refuse foreign/malformed/corrupted/oversized rows and changed expectations; no cross-tenant/run/grant/task/fence disclosure. If reservation ID is observed rather than supplied, document the dispatcher-owned lost-ID rationale and retain all other exact binding.
5. ABSENT is only a point-in-time snapshot: a pending reservation may acquire the lock later and commit. It is never NO_DISPATCH evidence or permission to release/refund/redispatch. UNKNOWN retains full liability. SETTLED reports only exact recorded conservative accounting, not tool/source success, a response body, provider actual price, or new effect authority.
6. Readback performs no data mutation, refund, settlement, retry, reservation or authorization enablement. Preserve original UNKNOWN/SETTLED behavior and all original tests. No automatic execute error reconciliation/release is introduced. Repeated reads, concurrent store boundaries and poisoned outcomes must not double charge, reset counters or alter liability.
7. Return only bounded immutable content-free accounting facts. Do not return credentials, private claims/SQL/cause bodies, source results or copied source implementations. Reuse existing transaction uncertainty/connection ownership; a failed/uncertain read acknowledgement cannot be represented as accepted outcome. Pool remains borrowed and no import/construction I/O starts.
8. Preserve exact canonical disabled catalog/public0.1/private0.2 and original SDK/Temporal/Aurora responsibilities. Actual production execute stays UNAVAILABLE before effects. Prove no native entry, real Pool connection, SQL engine, provider/model or customer data operation occurred. Freeze source hashes, meaningful negative controls/failures and local process cleanup receipts. Return ACCEPT_SOURCE/HOLD on exact final source, with native/G1 and runtime reconciliation limitations explicit.

## Initial finding

The current adapter offers reserve/settle/markUncertain; markUncertain returns no outcome and only preserves the exact existing liability. The source has no readback method. Existing native-test SQL assertions are deliberately test evidence, not production reconciliation. Consequently this change may add a canonical observation method, but must not invent a consequential UNKNOWN-to-success or ABSENT-to-retry decision.

## Root-selected authority and API

Root explicitly chose historical trusted-owner-only readback, consistent with the existing historical settle/markUncertain operations. This supersedes the fresh-observer alternative in criteria 3: expiry, revocation, quarantine and elapsed schedule cannot hide an exactly bound historical ledger or motivate minting new effect authority. The internal pool/allocation-bound durable owner is the access boundary. There is no worker/UI/HTTP endpoint; future remote exposure requires separate authentication/authorization review.

Allocated production paths are existing `postgres-tool-budget.mjs`, `durable-tool-dispatch.mjs`, budget README, new `tool-budget-outcome.mjs`, and new `tool-budget-outcome.test.mjs`. Existing gateway index already spreads the durable dispatcher, so no facade edit is needed. Final API: `readInvocationOutcome(originalInvocationJson, expectedJson)` where expected JSON has exactly operation and argumentsSha256. It validates installed immutable allocation, original retained grant-binding and historical original grant facts, then exact original reservation. Reservation ID is observed because the dispatcher generated it and may lose its acknowledgement; all other invocation/operation/digest correlation remains mandatory.

Expected frozen output fields are invocationId, reservationId, state, operation, argumentsSha256, holdMicrousd, chargedMicrousd, outputBytes, observedAtMs. Amounts remain decimal strings; outputBytes is a safe integer. ABSENT has null reservation/amount/output fields; UNKNOWN has null charged/output; SETTLED is accounting only. No fresh observer, mutation, current effect check, grant mint or automatic execute reconciliation will be added. Independent controls will exercise actual canonical composition with an inert transaction boundary, including historical A after current B, poisoned duplicate columns, lost reserve/settle/read acknowledgements and point-in-time ABSENT.

## Independent evidence and exact result

Criteria were frozen at `1343798`; the explicit historical-owner decision followed at `641d289`, before source acceptance. Independent tests call the actual production-disabled gateway, canonical adapter and PostgresBudgetStore through an inert scripted transaction boundary. The script models JSON persistence, aggregate-lock serialization, COMMIT/rollback and lost acknowledgements; it neither imports pg nor executes SQL against an engine. It is source control-flow evidence only.

The initial 22-group replay had 21 PASS / 1 reviewer-harness failure. The fake INSERT retained the canonical frozen JavaScript facts reference; a later corruption test could not modify it. A real pg JSON parameter is serialized into stored JSON. Original test/harness and raw failure were preserved at `48d20ab`, then the scripted persistence boundary copied its JSON values. No assertion was weakened. The disabled-operation check was also expanded from its original representative operation to all fourteen actual canonical descriptors. Corrected replay and exact-final replay both passed 22/22.

| Check | Result |
| --- | --- |
| Independent actual-composition controls | 22/22 PASS |
| New author outcome + unchanged durable/store tests | 73/73 PASS |
| Exact source/tree/allowed paths/whitespace | PASS; 4195/4198 originals unchanged |
| Original-invocation-facts removal mutant | 1 expected failure; missing rejection detected |
| Native pg/SQL/driver/host/Temporal/provider behavior | UNRUN |

The isolated mutant uses Node's module-load hook to remove only the original reservation-facts comparison in memory. The same actual gateway/owner call path then fails the independent foreign-facts control with a missing expected rejection. No candidate file was edited. Raw mutant failure is evidence that the assertion detects that defect, not a failure of accepted source.

Tests cover ABSENT followed by a later UNKNOWN reservation; lost reserve/settle/read COMMIT acknowledgement; historical expired/revoked/quarantined A after replacement B; immutable output; exact original and redundant grant/allocation/reservation identity; operation/digest mismatch; malformed charge/output/timestamps; parallel observations; observation ordered behind an in-flight canonical reservation boundary; and unchanged disabled execution across all fourteen descriptors. Reads issue no ledger INSERT/UPDATE and cannot settle/refund/retry or return source payloads. This validates the explicit internal trusted-owner boundary, not a future remote authentication design.

Only the three allocated existing files changed: budget README, durable-tool-dispatch and postgres-tool-budget. All original tests, gateway index, catalog, contracts, locks, migrations and other production files are byte-preserved. Full hashes are in `review/final-preservation.stdout.txt`: outcome helper `d5148557646a228160fc080efd40da6b110bebb6a2264b4180a9c6f5a018e3a7`; canonical adapter `6d2d76ace7edf38bd2c0559fc62b069b00d0f80b7e187db7347974998c48f6e0`; durable composition `17d791d9b4803dfbfd67e30befd3818a7d3bc82464b2e00a385a4619bf0fc9a6`.

Portable final offline replay from the repository containing these review files, with SOURCE_ROOT pointing to the exact author checkout (or integrated source for the independent tests):

```sh
MERI_REVIEW_SOURCE_ROOT="$SOURCE_ROOT" node --test docs/qualification/candidates/g1-budget-outcome-20261012/review/outcome-independent.test.mjs
node --test "$SOURCE_ROOT/apps/gateway/test/tool-budget-outcome.test.mjs" "$SOURCE_ROOT/apps/gateway/test/durable-tool-budget.test.mjs" "$SOURCE_ROOT/apps/gateway/test/postgres-tool-budget.test.mjs"
python3 -I -B -S docs/qualification/candidates/g1-budget-outcome-20261012/review/verify-source.py "$SOURCE_ROOT" 028b1134e373734caea036ee5c38d35b20428d8b
```

The preservation verifier requires the clean exact author checkout. Six bounded check process groups, including the reviewer fixture failure and expected mutant failure, were waited and confirmed absent under the local subreaper. No timeout, kill or orphan descendant reaping was needed. Separate read-only Git/file and Node API-availability commands exited normally. These are local source-check cleanup receipts only. No other owner's process was touched, and no native process cleanup is claimed.

## Remaining gates

ACCEPT_SOURCE means the actual internal durable composition now exposes exact historical accounting observation. It does not close PostgreSQL isolation/driver/COMMIT/readback qualification, external host/action admission, durable invocation production/persistence, authenticated live callers, Temporal restart correlation, source result recovery or G1. The read inherits the existing trusted borrowed-pool configuration and owner cleanup responsibilities; no dispatcher request-deadline or physical database cancellation guarantee is added. An ABSENT observation can precede a pending commit, and SETTLED still cannot release an unverified result. Existing Aurora, SDK/Temporal ownership, disabled source connectivity and unknown paid-model allowance are unchanged. Evidence contains public source paths and synthetic data only; no credentials, private producer bodies or customer data were read or published.
