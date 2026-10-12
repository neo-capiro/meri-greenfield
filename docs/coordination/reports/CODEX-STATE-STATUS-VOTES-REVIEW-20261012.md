# Independent state bill status and floor-vote review

**ACCEPT_SOURCE** for source `a25516ae8d2c44638800e492e439e212098dc750`, tree `f7942b8aa8e3011336bc56cc568ddd0e7c4d52cf`, on base `a3e946c1fa264ae7b33205f5b87804ee1ef75773`. This decision covers the new private family and pure selector helper only. Registration, adapters and source/runtime acceptance remain separate; no operation was enabled.

The independent criteria were frozen at `c1db199b71caee92925de1b5948df920708a4d3a`; 31 executable controls were frozen at `9262ce5f5d0f69f211a1ef0480deb7502a0aebed` before the candidate source freeze. The exact frozen source passes **53/53** local checks: the unchanged 31 independent controls plus 22 author tests. The preservation/source audit passes **77/77**, including all **6,110** preexisting files byte-identical, all four new source/test identities exact, and **8/8** relevant immutable source-reference pairs unchanged. Author metadata closeout binding and final packet hashes are recorded below once received.

## Reviewed behavior

The new family has no context keys. The existing canonical inert JSON snapshot remains its caller-data admission boundary; it refuses getters, proxies, symbols, extra fields and coercive inputs without effects. `state-bill-identity.mjs` performs syntax inspection only. No lookup, current-session choice, provider, database, clock, model or authorization engine is introduced. Existing state-legislation schema owns the reused status-label vocabulary.

`get_state_bill_status` preserves missing/unparseable, resolved-but-absent and found branches, with distinct field sets and notes. Direct canonical selection takes precedence over the hint; a direct lookup binds only `billId`, never inventing constraints on separate stored state/session/identifier fields. Designation outputs require a canonical key with the requested state and bill number; this is an explicit narrowing of malformed stored IDs, not an asserted database CHECK. It permits historical sessions and cannot prove which matching session the source resolved.

`search_state_floor_votes` treats `query` as a motion filter, not a bill alias. A supplied unparseable bill must produce an empty, reason-bearing response before state-wide search can occur. Successful designation results share one matching bill key. Without bill selection, state filtering remains only a bill-key prefix; unsupported chambers preserve the source's ignored-filter behavior. Nullable motion cannot satisfy a query, while actual substring/collation semantics remain PostgreSQL-owned.

Returned vote count equals the returned window, capped at the selected limit. Signed tallies, sponsor counts and nullable importance are retained without invented positivity, sums, uniqueness or outcome inference. Status actions/votes each have a 15-row cap; floor votes have a 25-row cap. SQL dates require canonical midnight wire values; status/generated timestamps permit time of day. Null vote dates sort first under descending PostgreSQL ordering, and ties have no invented secondary ordering.

Null status, empty/unknown status strings, present versus missing companion enrichment, and cumulative no-rollcall/dead-session caveats remain distinct. Inherited Object.prototype names in the source label table serialize with an omitted label; the contract validates omission instead of manufacturing an ordinary fallback. Empty or capped histories establish neither complete coverage nor legislative passage/failure.

## Source, policy and unqualified effects

The [reference manifest](../../qualification/candidates/read-continuation-20261012/state-status-votes-review/reference-identities.json) binds exact Capiro `fd8765ec01d292013758606204f2c9d886cd31c1` and observed `4be13b0b1ed0f2f3fa014040eedbb2fc2c27dace`. Metadata trace locators and derived findings are in [projection-findings.json](../../qualification/candidates/read-continuation-20261012/state-status-votes-review/projection-findings.json). No private implementation bodies were copied into tests/evidence, imported or executed.

The existing controller declares `standard_user` through RolesGuard and a configuration-dependent service-secret guard on tool HTTP entry. That policy surface is not reproduced by this family and is not proof of current actor, task, tenant, wall or source authority. A designation miss can call live LegiScan, reserve provider-query quota and ingest normalized records. All such effects remain **UNRUN/unqualified**. Four query units do not establish a monetary allowance or permission to spend. Source-note compatibility does not certify that any lookup occurred or that a bill is absent/current.

All original public0.1 contracts, private shared contracts, catalog/registry, locks, gateway, workers, runtime, migrations, tests and original capability ledger are byte-preserved. Root owns subsequent canonical integration. R2's Claude Agent SDK loop, Temporal durability and planned state placement remain unchanged.

## Failures and evidence sequence

1. Initial independent run: **22 PASS / 9 FAIL**. The vote-request limit used a multi-type JSON Schema declaration rejected by existing strict Ajv. Raw stdout/stderr and the immediately captured three-file new-Meri source preimage are retained. That run targeted an evolving author worktree; its receipt explicitly disclaims atomic process-to-source pinning rather than relying on an empty Git diff for untracked files.
2. The author independently repaired the primitive union to explicit `anyOf` and froze `a25516a`. No independent assertion changed. Exact local replay: **53 PASS / 0 FAIL**.
3. Initial reference lookup guessed `auth/tool-service-secret.guard.ts`; it was absent. The immutable tree resolved the actual `meri/tool-service-secret.guard.ts`. The initial metadata manifest is retained; this is a lookup correction, not a producer defect.
4. The author reports broad checks **1396 PASS / 2 FAIL**: generated public browser artifact drift (cause not established) and a data-search permission subprocess rejecting borrowed dependency realpaths. Those raw failures remain in the author packet. This reviewer did not repeat broad/public checks or weaken the subprocess boundary. Combined verification remains root-owned; focused source acceptance does not turn those failures into passes.

The review capture uses a Linux child subreaper and owns only its new session/process group. Initial tests group **223255**, exact tests group **223878**, and initial audit group **232303** exited and were verified absent, with no timeout or kill needed. This is local check cleanup evidence, not native task teardown or database/provider cancellation evidence.

Repeat focused checks from the review worktree with:

```sh
node --test packages/contracts/test/retrieval-state-status-votes-independent.test.mjs packages/contracts/test/retrieval-state-status-votes.test.mjs
```

For reviewed captures use the allocated `capture-reaped.py` with a fresh write-once label. Test source override `MERI_STATE_STATUS_REVIEW_SOURCE_ROOT` exists solely for prefreeze characterization; exact replay used the merged immutable candidate with no override. No dependency installation, private source execution, native fixture, SQL, service, provider, model, cloud, customer-data or frontend action was performed by this review.
