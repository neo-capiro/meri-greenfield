# L3 history and truthful startup composition

Base `eca78d458acb46cbfd54a94cf870841d999ef6b1`; branch `dot/meri-startup-history-20261016`. Prior independent review pin `f8d1816eda48347eeca4c0c25308870f2885c1f5`. This is a source candidate, **HOLD for full L2/L3 product, public wire freeze and live acceptance**. Product-effect, activity-cleanup and lifecycle-authority fixes are separate preceding commits.

## Implementation and ownership

`conversations/history/store.mjs` reads canonical conversations/runs/events under the existing store transaction, validates sealed ranges, original request/event hashes, exact tenant/actor/client walls and contiguous global cursors. `service.mjs` reuses the current membership and retention gates. `protocol.mjs` explicitly labels its versioned envelopes a local proposal; `http.mjs` uses the existing product HTTP owner. No second auth/model loop, event renumbering or new history persistence exists. Run-local history/stream APIs and old-writer fencing remain unchanged.

The next-run owner adds explicit `admitTurn`: one source run identifies one immutable journal mapping. Concurrent requests and lost ACKs recover the same target. Replaying an already accepted/historical mapping grants no writer authority and never selects a later target. Existing session issuance and submit still own immutable request acceptance and Temporal dispatch. Latest nonterminal-source admission refuses before effects. Generic indeterminate reservation errors retain UNKNOWN. Historical prompts/request IDs are recovered from retained canonical requests.

Runtime control now consumes explicit continuation-admission/retirement and approval owners rather than forwarding invented native operations that have no implementation. Trusted startup can supply membership/turn/action owners through captured inert ports. Canonical document/task/session mounts stay intact. Prepared startup still supplies only its real identity owner: absent lifecycle/history/actions/artifacts owners therefore remain closed. The health readiness response now names each missing owner and returns 503, with release acceptance held. Schedule dispatch is explicitly unregistered pending Q-X2. Sources and the budget lane's model-grant issuer remain uncomposed; no issuer was duplicated. Worker role registration and model orchestration are unchanged.

The exact UI request/response/auth/error/reload/reconnect/ACK proposal is [DOT-CONVERSATION-HISTORY-WIRE-20261016.md](../proposals/DOT-CONVERSATION-HISTORY-WIRE-20261016.md). No public frozen export exists yet. The frontend owner was told to retain unavailable states pending review and public version allocation.

## Verification

Node 24.19.0; synthetic tests capped at 192 MiB V8 heap, concurrency one. Initial history batch: 6 pass/1 fail due to a test selecting a terminal latest run before it became historical; adding the third accepted run made the historical-writer assertion valid. Final history suite: **10/10** (three turns, cross-run paging, reload/tail reconnect, discovery paging, exact prompt/request custody, concurrent admission, original mapping replay, cross-tenant/actor/client denial, membership/retention refusal and coherent event substitution). Existing lifecycle/next-run focused suites plus the two HTTP uncertainty tests: **31/31**, with **8/8 negative regressions failing** under reverted lifecycle source.

Runtime product mount/readiness/startup: **10 unique cases pass**. The first combined run was 9 pass/1 sandbox loopback EACCES. The exact two-case startup/health test reran through approved execution: 2/2; its task-owned listener closed in finally. SQL, Core, native and Temporal are scripted. No browser, real SDK query, provider, real database or AWS action ran. Windows dependency-junction creation was initially denied by the sandbox; the repository's image-equivalent links were then created through approved execution, entirely within this checkout. All installs used existing locks with scripts disabled; no lock changed.

The first combined focused batch at `d41878e898e41ac1e0ce26a01104730a7402a0e8` passed 90/90. Independent UI review then found that null limit/after values were normalized despite the integer-only proposal. Three new negative cases reproduced it (**0 pass, 3 fail**, each 200 instead of 400). The correction defaults only omitted values and rejects explicit null; null before remains deliberately allowed. Final combined focused batch after this correction: **93 passed, 0 failed, 0 skipped**, 11.49 s, concurrency one, 192 MiB heap. It includes product HTTP/effect uncertainty (13), worker activity/cleanup (26), lifecycle/next-run/HTTP (31), history HTTP (13) and runtime mount/readiness/startup (10). Exact command:

```text
node --max-old-space-size=192 --experimental-test-module-mocks --test --test-concurrency=1 apps/control/product-access/test/effect-uncertainty.test.mjs apps/control/product-access/test/http.test.mjs apps/worker/conversation/test/cleanup-activity.test.mjs apps/worker/conversation/test/activity.test.mjs apps/control/conversations/test/lifecycle-http-uncertainty.test.mjs apps/control/conversations/test/authority-before-successor.test.mjs apps/control/conversations/test/next-run-owner.test.mjs apps/control/conversations/test/lifecycle-transition.test.mjs apps/control/conversations/test/history-http.test.mjs apps/runtime/test/startup-history.test.mjs apps/runtime/test/product-mount.test.mjs apps/runtime/test/product-readiness.test.mjs
```

No repository-wide compiler, real PostgreSQL query/trigger/locking/scaling, real Temporal/native cleanup, live membership/retention, or production stream/UI run is claimed. Compiler/DB/browser suites require a bounded heavy-test slot and remain UNRUN pending coordinator grant. The lifecycle authority fix and cleanup evidence have their own focused reports. No fixture success proves actual startup owner availability.

## Source proof rows

Candidate h and every historical manifest are unchanged. `source-proof.test.mjs`: **4 pass, 1 expected fail**, because current source is intentionally not repinned. An exhaustive 45-row comparison finds exactly two changed rows, with the other 43 equal to h:

| Path | Candidate h SHA-256 | Current SHA-256 |
|---|---|---|
| `apps/control/conversations/postgres-store.mjs` | `2de6bce64ace8a6d2b5d0ed205f9ffb5b7ac2884d6109df19bc629b13d48c1cb` | `d385fd62d5cfb26bc184d26c2659298fde1ba8ba9c2d5ca3210429a8a3d03420` |
| `apps/runtime/control.mjs` | `ec63730199cbc092042dab6b6694506087530ee85572e1daadfb478bf76c5757` | `96aec55b6dff229a00f9d8bc0a939f285c8c93bbf5365ebdeeb9a57134374779` |

The store exports the canonical history reader and preserves owned read-domain errors through rollback. Control mounts explicit owners and returns the composition census. No recipe or other hashed row changed. Source-proof assertions remain strong; its failure is retained for parent review and successor candidate allocation, never silently fixed with new hashes.

## Parent decisions and remaining blockers

1. Independently review the local history wire and allocate a public contracts export/version before UI adoption.
2. Bind genuine current authority, continuation admission/retirement and approval/decision owners into prepared startup; bind canonical membership and next-turn ports. The source has no implemented native `continuation/admit`, `continuation/retire`, `approval/read` or `approval/decision` routes to forward automatically. Factory seams and synthetic facts do not fill that gap.
3. Resolve source-installation/model-grant composition and schedule worker placement with their existing owners; leave readiness closed meanwhile.
4. Confirm existing conversation 0001/0009 source allocations/application before runtime use; no new history table/migration ID is needed. Optional performance proposal M-L3-INDEX is [discovery-index.sql](../proposals/history-20261016/discovery-index.sql); centrally allocate it only if real PostgreSQL query-plan evidence justifies it. No SQL was executed.
5. Allocate a bounded compiler/real-DB qualification slot. Historical candidate-h acceptance and source-proof successor allocation remain parent decisions. No integration of other lanes, main merge, deployment, credentials, provider call, live migration or purge occurred.
