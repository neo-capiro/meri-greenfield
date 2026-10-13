# Exact document replay continuation

Published PR58 remains the independently accepted source/local-artifact base: `398d599311a5f6c48e18d31b4928cf665de8dcb9`, tree `e8d3463dba3a427b52b30c02db3487cb9aefa100`. Dedicated branch `codex/document-replay-20261013`. Executable candidate `c872db174eb34ab1396260242b54fd16e2bb42a3`, tree `4eccbb74c352be05f7e19f714d21fc353c92ed45`. Publication and integrated review pins are recorded below after final verification.

## Behavior and owners

The completed-replay UNKNOWN was an implementation gap: the durable journal refused a second reservation correctly, while the artifact path entered generation and lacked retained-result lookup. New Word/Excel repeats now observe the canonical journal, verify the exact published artifact and bytes under current authority, and return the same immutable version/inspection/object and original budget ticket. The release receipt is fresh. Recovery never calls ids(), a new reservation, generator, object put or version commit.

`apps/gateway/budget/tool-invocation-owner.mjs` owns private read-only observation under the existing lock and full historical allocation/grant/invocation/accounting validation. `tool-budget-execution.mjs` exposes it only through trusted producer-owned budget ports. Existing historical reconciliation stays separate, still resultDelivered:false and never release authority. Observation and settlement preserve the original immutable deadline and charge.

`apps/artifacts/postgres-service.mjs` remains typed intent/current policy/accounting composition. New document version IDs use the already allocated server-owned invocation UUID; original artifact/object ID allocation is validated and preserved, not invented from request hashes. `service.mjs` retains canonical scope/resource/byte checks and delegates recovery to cohesive `recovery.mjs`. The private overload of the existing versions.read port is implemented by the existing local store in `local-replay.mjs`: require filename/version identity, exact snapshot digest or server invocation identity, request/context/evidence/base matching and published head ancestry. Scan/nodes <=1024, single record <=4MiB, aggregate raw record reads <=16MiB with caching; any missing/cyclic/wrong-artifact/over-limit/unsupported/ambiguous evidence fails closed. Legacy completed random IDs recover by the full protected completion digest; legacy markerless uncertain writes have no trustworthy delivery correlation and stay UNKNOWN.

A published version after a lost/malformed commit ACK can be independently verified and complete the original marker/charge once. Object-only writes, generation failures, unpublished version files, stale new revisions, missing/corrupt/foreign evidence or denied/expired current authority never regenerate or reset liability. Concurrent pending repeats may return UNKNOWN immediately; an exact later repeat recovers once publication evidence exists. Concurrent post-publication repeats use the same idempotent protected settlement. No new controller, public route, orchestration loop, contract version, migration or model capability.

All public contracts0.1.2 and document current/index/http blobs are byte-exact with PR58. Source scope/catalog/original skill versions and separately owned PR57 native query/test pins remain unchanged. Claude Agent SDK/Temporal and all existing governance remain canonical. No new Quicklog UI.

## Root verification

Exact candidate c872db17, zero tracked executable diff, captured physical child/process-group exit:

| Check | Result |
|---|---|
| New real-store/native-generator replay and existing artifact/accounting owner controls | 180/180 Node |
| Document/workbook/brief application and brief CLI checks | 52/52 Node |
| Existing artifact/execution/analysis/column regressions | 153/153 Node |
| Public generated-byte/type/distribution checks | PASS,71/71 public Node |
| Existing native-library DOCX retained-base revision checks | 2/2 Python |
| Congressional brief loopback create/revise/inspect/download/replay | PASS; original+revision both4pages reopened/rendered, all8pages visually opened |

Root Node total456 distinct cases across these final suites, including28new focused replay cases. Real source-local stores and native Python Office generator; SQL, identity and sources are explicitly scripted/synthetic, not PostgreSQL/Fargate/native acceptance. Actual model/AWS calls0. Brief create and revise repeats returned200 with exactly2generations/2settled original charges,20synthetic microUSD,0UNKNOWN. Other store/session remained isolated with0generations/charges; revoked inspect/download/preparation and write denied. All owned listener sockets closed, stores removed, child groups absent. Rendered original/revision preserve source passages/claims/missing-conflicting evidence, original skill/manifest and immutable parent; sparse provenance-only page4 remains the prior minor pagination issue.

Root samples: original38702bytes, SHA256`402928a64a53911d9d66a24deee2e0cd75af1b154813ea07ccf1f49c22553b64`, version`1c274a75-af93-464d-a78c-2fdb4ce6b2b7`; revision38886bytes, SHA256`e07a4df8b4ddf5cbfaa2c5ddfae4417dcc67af7524f005b6c5d4094ce3c7326f`, version`f591b793-f42c-47e6-b997-806060e3f60e`, exact original parent. [Raw captures and retained artifacts](../../qualification/candidates/document-replay-20261013/integration/), including root visual hash manifest and source-preservation audit.

## Preserved diagnostics and boundaries

Initial focused26case run25pass/1fixturefailure: stale scripted row reference and uncleared settlement timestamp when modelling legacy UNKNOWN. Corrected the test setup and retained diagnostic; subsequent60/60and74/74focused runs pass. Independent design review requested accounting-argument cross-binding and filename alias checks; both were added before the executable freeze. The initial public check lacked esbuild; a donor dependency symlink then caused bundled path drift. Both failures are retained; copying the already installed exact dependencies into this owned worktree made the generated/type/71public checks pass without changing tracked contract bytes. Borrowed dependencies are removed at completion. No pre-existing test/evidence was deleted. Completed replay assertion changes must compare immutable result/ticket and original physical generation/charge; first interruption UNKNOWN assertions remain.

This accepts source/local artifact behavior only. A production storage adapter must implement the same private read query with actual publication/ancestry and immutable bytes; unsupported ports stay UNKNOWN. Native PostgreSQL journal/transaction restart, actual S3/storage/resource authority, current live identity/session revocation, worker/sandbox/renderer and Claude SDK/Temporal resume qualification are unverified here. Replays do not renew expired original grants/deadlines; post-lease recovery needs separately qualified authority/migration semantics. Authentic congressional/private source attachment approval remains pending. The native owner's local install/preparation receipt applies only to its separately pinned PR57 fixture, not this composition or actual worker observations; no competing native work or pin change occurred.

The existing53whole-plan requirements/51remaining pending count and G1OPEN/G2-G7unentered remain unchanged. No production merge/deploy, AWS writes/spend, paid models, credentials, persistent permissions, private transfer or recipient messages. Shared cleanup/native coordination and deployment are not asserted by local source acceptance.
