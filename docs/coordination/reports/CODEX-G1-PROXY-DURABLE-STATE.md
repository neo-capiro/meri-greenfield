# Codex G1 durable proxy state

**Implemented and exercised against real PostgreSQL; independent review and G1 remain open.** This Codex session owns exactly the nine new paths allocated in `tasks/CODEX-G1-PROXY-DURABLE-STATE.md`: seven state/schema/dependency files, one focused test file and this report. Existing transport, compiler, locks and contracts were unchanged. No Hermes, cloud resource, provider/model call, proxy listener, worker/image build or existing database/service was used.

## Result

`pricing.py` owns exact integer microUSD arithmetic. `postgres_store.py` owns explicit connections, bounded SQL transactions and ambiguous-commit handling. `grants.py` owns pending/active/revoked grants and authoritative run/attempt/worker/fence/policy revision. `ledger.py` implements the transport's async `SendLedger.reserve_and_arm_once` interface and separate trusted reconciliation. Migration0001 creates only the new `meri_qualification` schema; it deliberately fails if that schema already exists. There is no runtime migration, budget reset, automatic retry or refund scheduler.

Every reservation locks the single fixed **10,000,000 microUSD** budget row. It reads database time after acquiring the lock, rechecks the authoritative current binding and active capability hash/expiry, refuses duplicate request IDs and a second UNKNOWN for that grant, and includes every unresolved hold across attempts, grants and runs. It commits a request as UNKNOWN before returning the exact transport `HoldReceipt`. The partial unique index is additional protection for one UNKNOWN per grant. Concurrent callers and processes use real PostgreSQL transactions, not an in-memory counter.

The ledger revalidates the native body with the unchanged small-envelope inspector and binds its hash, raw ingress-request hash, exact foundation model/profile, trusted count origin/count, output ceiling, pricing revision and original pricing expiry. The fixed reservation is `ceil((6600*input+16500*maxOutput)/1000)` microUSD; complete ordinary uncached usage uses `ceil((3300*input+16500*output)/1000)`. At8192/256, the reservation is58292 microUSD. These fixed rates refer to the owner's recorded official feed SHA `b21cfc4941e346275d9503700a094dc892f838172c41bc2e14c8284d91b1677a`; this task did not revalidate live prices or genuine CountTokens. [Recorded pricing direction](CODEX-G1-PROXY-IMPLEMENTATION-PLAN.md), [official pricing](https://aws.amazon.com/bedrock/pricing/).

`PostgresStore` acknowledges a reservation only after commit. A commit exception or injected lost acknowledgement denies dispatch with `CommitUncertain`; no rollback/refund is inferred after commit has begun. Cancellation of the async caller cannot undo a possibly committed thread operation. Expiry, revocation, replacement, process death, cancellation and reconnect never remove UNKNOWN liability.

Only explicit trusted complete-usage reconciliation or positive no-dispatch reconciliation can replace a hold. They bind the original request/body/pricing/binding; a renewed pricing expiry cannot be substituted. Original charges can be reconciled after a grant is revoked or its run advances, while stale new dispatch remains denied. Complete liability is recorded without clamping. Token/count contradictions, an actual amount above its hold, or consumed plus other outstanding liability above the ceiling quarantine further dispatch. A changed, missing or incomplete evidence object keeps UNKNOWN.

These are private trusted adapter methods, not an authentication service. A typed evidence object or its origin string is not proof of genuine provider usage/no-dispatch. The future trusted response parser/reconciler must establish that provenance before calling them. No worker-facing settlement endpoint or capability issuer is implemented.

## Real engine and dependency provenance

The official PostgreSQL Windows page links EDB's portable archives. PostgreSQL **17.11-3 Windows x64** was downloaded directly from EDB:341325378 bytes, SHA256 `4b8db0930c38f6ef845db919551dedda3b6b845aeb0927b3d79a6e8e9e4537cf`. It matched the checksum published in the upstream installer project's issue by an author marked **CONTRIBUTOR**. This is a published-hash match over HTTPS; no release-signature or Authenticode verification is claimed. [PostgreSQL Windows distribution](https://www.postgresql.org/download/windows/), [EDB archives](https://www.enterprisedb.com/download-postgresql-binaries), [exact published checksum](https://github.com/EnterpriseDB/edb-installers/issues/682#issuecomment-5580623267) (read10October2026 UTC).

Only `bin`, `lib` and `share` were extracted into new ignored scratch. No installer/service registration/global PATH change or Docker Desktop startup occurred. A new data directory used a previously checked unused port; actual server logs and readbacks established only `127.0.0.1:53983`. The synthetic local user uses loopback-only HBA trust; that is not deployed auth/TLS/isolation evidence. PostgreSQL reported17.11 with `fsync`, `synchronous_commit` and `full_page_writes` all on.

A new Python3.11.15 venv installed only verified local wheels selected from LiteLLM's retained exact `uv.lock`, SHA `1ac0d01bfc5e7b8674edf1f97ebe4fdc9e401d204b010ef0adf797e1ea08af18`: psycopg3.3.3, psycopg-binary3.3.3, typing-extensions4.15.0 and tzdata2026.2. All four wheel lengths/hashes matched that lock before installation. Final readback byte-compared **726 installed non-metadata wheel files** with their originals. Driver implementation was `binary`; its embedded libpq reported **16.9**. That older client library has not received a security disposition here. `dependencies.json` is Windows qualification identity DATA, not a Linux proxy image lock or dependency/license/security acceptance.

For the existing transport types/client, tests reused the separately recorded upstream site-packages read-only by intent; the transport's three raw source files still matched Git commit `72eb252a50f309d875d407ca229c01585fa8d4f6`. The first test invocation's `-I` ignored the environment's bytecode-disable selector. Seven ignored cache files have timestamps in that run, including the existing `runtime/bedrock_transport` bytecode cache and six new state/test caches. No old upstream site-package cache fell in that observed window. There was no complete pre-run cache inventory, so a stronger environment-immutability claim is unavailable. Subsequent commands used explicit `-B` and/or `sys.dont_write_bytecode`; unknown caches were preserved, not deleted.

## Checks and preserved failures

| Execution | Result | Meaning |
| --- | --- | --- |
| Initial real-PG test run |18/18 PASS,16.914s unittest;24.593s external child | Pending/activation, exact receipt, global duplicate and per-grant slot, count/body/capability/pricing refusals, stale binding, expiry/revocation, lost commit acknowledgement, cancellation, complete/mismatched/no-dispatch settlement, excess quarantine,8-connection race,3-process race, process exit17/reconnect and actual guard receipt-before-fake-send |
| Targeted changed settlement checks |4/4 PASS,1.664s unittest;5.485s external | Two new original-expiry/remaining-holds cases plus two affected settlement controls; no unchanged full replay |
| New configuration/error control |1/1 PASS,9.765s external | Qualification database namespace, remote verify-full TLS requirement, invalid/multihost configuration and sanitized real connection failure |
| New historical-reconciliation/native-forgery checks |2/2 PASS,0.891s unittest;4.734s external | Revoked/replaced grant can reconcile only its original request; a forged NativeBody cannot add thinking or substitute its output bound |
| Immediate server shutdown and WAL recovery |PASS,8.141s external | Same UNKNOWN row/hash/1076microUSD hold and aggregate before/after, real interrupted-server recovery in PostgreSQL logs |
| Final raw DATA/syntax checks |PASS |23 distinct test methods; eight source files parsed/measured; dependency records reconciled; fixed transport raw Git/current bytes equal |

There were **25 test-method executions covering23 distinct methods**, with two deliberate overlaps. A final unchanged23-method suite was not rerun; the initial18 and subsequent new/affected methods have separate captured source identities. Counts, prices and native usage are explicitly synthetic fixtures. The fake HTTPX send observed its UNKNOWN row in the real database before recording the send; no Bedrock request occurred. An injected after-commit exception models lost acknowledgement at the adapter boundary; it is not an observed physical network fault.

The first preparation stopped after downloading/validating PostgreSQL and three wheels because its universal-wheel selector omitted tzdata's `py2.py3` tag. The original helper/exception remain; a continuation selected the exact missing locked wheel and completed preparation. One PowerShell readback had a parsing error before executing commands. The first server-recovery control correctly refused `BUDGET_QUARANTINED`, left by the preceding excess-liability test; it performed no shutdown. A new recovery control used a separate NEW synthetic database, preserving the original quarantine. These first exceptions are retained as truthful transcript summaries in `FAILURES.md`, not fabricated binary captures.

Independent synthetic cases explicitly reset fixture tables/budget between cases; the runtime adapter has no reset operation. The recovery control performed no reset between its before/after observations. A frozen persistent database identity across all paid qualification sessions remains a mandatory owner admission input. Creating another database or privileged SQL/DDL could bypass a per-database cap; this module does not claim global enforcement against a trusted database administrator.

## Cleanup and limits

The engine was stopped at `2026-10-10T15:32:58.737062Z` with exact data-directory `pg_ctl`, exit0. The shutdown helper verified the live postmaster's exact new executable path before acting: six owned PostgreSQL processes before, **zero owned/unknown PostgreSQL processes after**, with the PID file absent. A separate Windows TCP-listener readback was `[]` for53983. Its socket probe returned Windows10035 after waiting, **not ECONNREFUSED**; that timeout is not the listener/process proof. Data, WAL, archive, source helpers and captures remain in ignored scratch; no arbitrary PID kill, service operation or recursive deletion was used.

This establishes local committed-state survival through client death and immediate PostgreSQL shutdown/recovery. It does not prove power-loss/storage-controller behavior, RDS failover/replication, production privileges, secret delivery, TLS, Linux runtime, image scans, private egress, peer-to-task identity, genuine CountTokens/usage, complete-stream parsing or quiet-stream revocation. A database/network outage can outlast server-side SQL timeouts; the existing async guard denies when its original wait expires, but a synchronous connection thread may still finish later. Its UNKNOWN liability must remain. Direct-child supervisors do not establish descendant-tree deadlines or live output-byte quotas.

The state layer has no general database selector exposed to workers, model endpoint choice, cache/thinking/server-tool feature support, automatic reconciliation or provider retry. Future trusted proxy wiring must freeze one database/schema/role and the exact source/dependency closure, use genuine bounded count/usage adapters, keep workers roleless/credential-free, bind actual peer/current task/fence, and qualify full ingress/stream/cleanup behavior before paid admission. Existing upstream transport review remains a dependency, not an acceptance granted by this task.

## Evidence handoff

Ignored evidence: `.task-inputs/CODEX-G1-proxy-durable-state-1/`. Its manifest inventories69 payloads,12801 bytes, SHA256 `695dd43b0dbe99315961f015dac26b6867cbb475daa509cadaa1ae4701938019`. It includes exact archive/wheel identities, source maps, binary test/start/stop captures, installed-driver comparison, server configuration/WAL readbacks and failure summaries. It excludes full extraction/venv/database inventories as explicitly declared; those private directories remain available. `provenance.json` SHA `70e3aa5645ccaaf68fee0f9cc1f27f64239b4d305ef6a3de1601f2b1379a2b7e`.

| New source | Bytes | SHA256 |
| --- | ---: | --- |
| `state/__init__.py` |78| `0207aed6edcbbb0e5760825e5cf5805eee9a5d60da0340e8d6ad2a7096d0b1c7` |
| `state/pricing.py` |1671| `76e3f2f10e4c45a112b22ed0085186f45d9e3995abc09ba49d5fd486e63d27f4` |
| `state/postgres_store.py` |4449| `3b4cf4bb014b62908077feea01bff47189833e9669863c184ffe436cd63b3a6b` |
| `state/grants.py` |4650| `7d1a3b313ca984f8cd5f4a3c2eeb31bc6075805b4b7843bcb84081390b98f50c` |
| `state/ledger.py` |8478| `cf5627d63cf3d27f7288c54aa1d08863a9aa5c1d0c7c62da7fa3618f1b9dcfde` |
| `state/dependencies.json` |2783| `50cb8b2050c9708031c127ce05a79716d1ec692260162ece5292437cdd11df80` |
| `state/migrations/0001_qualification_state.sql` |2467| `fa33f51c492361c280c4847ea08629f0c777cb6b0e9652f1e67f95543bda0dfc` |
| `test/test_postgres_state.py` |19876| `c0064102b6bb5978f1a285b2a8f416aee2d7e85733799c7ba3fc8b0eec03255c` |

Paths in that table are beneath `apps/proxy/qualification/`. All source, SQL and fixture results require independent owner review. No G1/runtime/security admission or deployment is claimed. Current Meri is untouched; paid model calls remain zero.
