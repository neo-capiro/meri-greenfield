# Gateway budget native-test source review — 2026-10-12

Reviewer: gateway_reviewer. Exact base: PR16 `e8d2c0d0e5db8fb01ba2df26c4eb3f79b296c0b5`. Isolated branch `review/meri-g1-budget-native-tests-20261012`. Current verdict: **HOLD** pending original child-group deadline repair. The earlier ACCEPT_SOURCE_TESTS for `e350ff3bae99ad5d2e53648c1f83f9814d6c5044` at review `a16b9c4540c9c4cc78610e0c9cf93a52ac964192` is superseded and retained. Native execution, admission and G1 remain HOLD.

## Scope and implementation outline

Read AGENTS.md, implementation standards, adopted R2, canonical gateway budget store/binding/adapter/disabled factory, migration0002, and existing qualification real-PostgreSQL test conventions. No applicable repository .agents skill directory exists. Review owns only this report and the sibling `g1-budget-native-tests-20261012/review/` evidence directory. Author owns the four new test modules and narrow README/task/evidence changes. No production, schema, migration, lock, dependency or original test edits are permitted.

The canonical owner remains `PostgresBudgetStore` and `createPostgresToolBudget`. The real production gateway remains source-disabled; only its trusted bind path can exercise SQL. Integration tests may later characterize the adapter directly. SQL readback is test evidence, because the adapter exposes no outcome/readback or reconciliation API. `markUncertain` returns no outcome and does not refund/reset liability.

Only offline admission/source controls and syntax checks may execute during this review. Do not execute/import the integration entry or child mode, connect a Pool, run SQL, provision/restart a database/server, or invoke native/cloud/model/provider/customer operations. Future native tests remain UNRUN. The current first L1 action packet remains frozen and cannot automatically chain these tests.

## Frozen acceptance criteria and negative controls

1. Default-closed explicit opt-in and closed inert configuration precede native dependency loading, Pool connections, SQL and child launch. Offline admission checks import only safe source. Missing, extra, malformed or mutable identity/authority/config inputs deny before effects. A name, boolean or self-supplied digest is not admission authority.
2. Future native use explicitly requires fresh separately admitted host/executable/dependency provenance, isolated cluster and system identity, scoped role, listener/PID, externally bounded supervisor/watchdog and exact action authority. Source guards honestly record their partial limits. Do not provision, migrate, reset, truncate, delete or infer that an existing database is safe from its name. Synthetic writes require the separately admitted fresh qualification schema.
3. Use the existing pinned pg8.23.1 Pool and canonical production owners. Borrowed pools are never ended by production code. Test-owned parent/child pools have explicit cleanup on success/failure. Connection, query, lock, process, output and cleanup bounds remain finite; child errors and credentials are content-free.
4. Native cases exercise durable database outcomes: exact retained invocation replay refusal even with a new reservation UUID, shared model/tool and per-run liabilities, UNKNOWN retention, terminal settlement and no double charge/refund, stale grant rejection, historical exact settlement after revocation/expiry. Independent processes use actual independent pools. Original assertions and negative evidence remain preserved.
5. Lost acknowledgement injected after a successful real COMMIT is labelled synthetic acknowledgement loss, not demonstrated network/WAL failure. It must leave exact UNKNOWN/SETTLED database evidence; no automatic redispatch, retry, pool replacement or invented reconciliation API. Uncertain clients are evicted and definite acknowledged transactions released normally.
6. Actual `createDurableSourceDisabledGateway` binds the real pool, then execute remains UNAVAILABLE before additional SQL/authority/source work. Do not mutate catalog availability or production flags to manufacture a gateway effect path.
7. Child entry validates mode/config before resources, with explicit finite deadline/output/IPC bounds and test-owner process cleanup. Source inspection is not physical process cleanup evidence. Neither child execution nor actual process-boundary durability is qualified here.
8. Exact final author source is reviewed and hashed. Run only approved offline controls and parser checks, retain any failures and fixtures/mutants, and prove original tracked files unchanged outside allocation. Return ACCEPT_SOURCE_TESTS only for useful executable test preparation; native durability, admission, security, runtime/G1 and production connectivity remain HOLD.

## Initial source findings

The existing migration enforces one UNKNOWN tool reservation per grant, with a combined model/tool liabilities view. The adapter refuses any reused invocation ID and retains UNKNOWN under `markUncertain`; raw SQL assertions must not be described as owner reconciliation. Existing real-engine revocation tests use a weaker loopback/name opt-in, which is precedent for syntax only and does not meet this task's fresh host/cluster/action prerequisites.

No native operation or integration/child entry has been invoked in this review. Final checks, source hashes and verdict will be appended after exact author freeze.

## Preserved prefreeze findings

The first independent offline parser replay ran 12 groups: 10 PASS / 2 FAIL. A numeric system identifier passed a coercing regular expression, and a caller-supplied SHA object executed its `toString` once before refusal. The getter, proxy, inherited-environment, ambient-injection, exact-digest, byte-limit and deadline controls passed. Exact fixture hash and unmodified stdout/stderr are retained under `review/prefreeze-*`; no Pool/resource/child/integration function was invoked. The author's promised repair is explicit string admission before coercion; unchanged independent cases will be replayed against the final source.

Static draft inspection also found that the originally labelled per-run call-cap race used one grant, so the earlier one-UNKNOWN-per-grant refusal could mask the intended assertion. This is a source coverage finding, not a native runtime failure. Author reports replacing that case with distinct synthetic grants sharing one run/allocation, adding a mixed model/tool liability case, and adding bounded TERM/KILL/reap fallback for owned children. These changes remain pending exact review.

A further static draft defect could leave the all-ready barrier pending forever: early exits did not reject the ready promises, while all completed child promises cleared its only deadline. This was reported before freeze without executing any child. Reviewer also requested exact aggregate consumed-budget deltas around settlement and duplicate refusal. Root amended the allocated native entry to `apps/gateway/test/postgres-budget.integration.mjs`, outside ordinary `*.test.mjs` discovery; the draft name is historical evidence only. The offline admission test remains discoverable.

## Native evidence boundaries

The nine future native cases cover production-disabled gateway binding/UNAVAILABLE, retained invocation refusal and historical settlement, post-COMMIT synthetic acknowledgement loss at reserve and settle, returned/evicted clients and borrowed-pool ownership, two three-process contention cases, and two mixed model/tool per-run cost boundaries. Distinct grants isolate the run call limit from the one-UNKNOWN-per-grant constraint. The synthetic model request row exercises the combined liability view; it does not call a model/provider. Aggregate consumed-budget deltas complement the reservation-row assertions.

The local installed primary pg8.23.1/pg-pool3.14.0 source was read without importing it: `release(error)` removes the client, while normal release can return it to the idle pool. Exact read source hashes are in `review/pg-primary-source.json`. This source inspection does not prove installed native host provenance or runtime driver behavior.

The explicit future packet must establish host/executable/library provenance, fresh isolated cluster/system identity, postmaster/PID/listeners, scoped role/HBA, separately admitted pg_control_system read permission, pre-migrated empty schema, no provider/egress access and an external supervisor. The test config digest and WeakSet brand are correlation/admission mechanics within the test process, not independent host authority. No credentials were obtained or created here.

The suite supplies no production outcome API, no automatic replay reconciliation, no real network-ack-loss proof, no server restart/WAL/power-loss proof, no global-cap native result, and no claim of runtime invocation persistence. All native SQL, three-process contention, Pool connect/driver eviction and native cleanup remain UNRUN. Child close/TERM/KILL source guards still require an independently admitted external watchdog; JavaScript timers and assertions do not establish physical task teardown. Existing Aurora choice, SDK/Temporal ownership, all fourteen disabled descriptors, first L1 action packet and G1 HOLD remain unchanged.

## Exact-source result and reproducible checks

Criteria commit `fc01f7a` preceded author freeze. Original independent failures and tests were committed at `1a2882e`; source preservation/native discovery controls followed at `967b44c`. Both original parser failures are repaired by explicit string validation. The unchanged independent suite now passes 12/12. The static child barrier repair rejects early close, owns its ready timer until barrier completion, and waits for close/EOF; distinct-grant contention and exact aggregate accounting assertions are present. No native behavior was sampled to reach this verdict.

| Check | Exact result |
| --- | --- |
| Independent offline admission | 12/12 PASS; original 10 PASS / 2 FAIL preserved |
| Author offline admission/source replay | 33/33 PASS |
| Syntax-only four new modules | 4/4 PASS |
| Exact tree/preservation/discovery/whitespace | PASS; 3944/3945 original tracked files unchanged; only budget README changed |
| Nine native engine cases | UNRUN; no integration entry or child mode invoked |

From the repository containing this review, replay only these offline commands (SOURCE_ROOT is the clean exact author checkout):

```sh
MERI_REVIEW_SOURCE_ROOT="$SOURCE_ROOT" node --test docs/qualification/candidates/g1-budget-native-tests-20261012/review/admission-independent.test.mjs
node --test "$SOURCE_ROOT/apps/gateway/test/postgres-budget-admission.test.mjs"
python3 -I -B -S docs/qualification/candidates/g1-budget-native-tests-20261012/review/verify-source.py "$SOURCE_ROOT" e350ff3bae99ad5d2e53648c1f83f9814d6c5044
```

Each new module was separately parsed with `node --check` and never evaluated through its native entry. `source-final.stdout.txt` retains full hashes: integration `227780eb228fd92640d11fe9f0eeecde2b1b24dfbe4702d382728b5aff69f06f`; fixture `a4a4cc8205668d72e15b2df46408f20172c1adc5914590b871f9ac206065f22a`; child `493834c03bec2effaf0932049ad375e3624166ddcd230e8965dac32ff04bb9e9`; offline test `cd10701cf440379962ddb077a741ceac8f340a7d1c96dbc9ce984a89d8a3b0e4`. Exact native filename is excluded from ordinary gateway test discovery; the offline test remains included.

Eight bounded local check process groups (one failed baseline plus seven final checks) were waited under an inherited Linux subreaper. Every receipt reports its owned group absent, no timeout, no kill and no orphan descendant to reap. These are local offline check receipts only, not native database/task teardown evidence. No other owner's processes were touched. Raw output contains only public source paths and synthetic values; no private producer body, credentials or customer data is present.

The accepted change is useful future native test preparation with explicit partial admission and evidence boundaries. Actual host/action qualification, native execution and returned independent real-engine evidence remain blocking prerequisites. No expansion of the first L1 action is implied.

## Post-review original-group-deadline finding

Immediately after the initial final report commit, root identified a remaining static admission gap in e350ff3: the group cutoff is fixed before preparing/binding the three payloads, but fork and send check only the broader global work cutoff. If preparation or an earlier fork consumes the original 30-second group window, later child effects can still begin. A short timer after starting the effect is not equivalent to refusing admission before it. Root requested a narrow guard before each fork and each send using the original, unextended group deadline. Earlier passing offline/syntax receipts and manifest remain preserved and do not close this missing assertion. No native failure reproduction is claimed. Final acceptance is blocked until exact repair and independent offline/source guard replay.
