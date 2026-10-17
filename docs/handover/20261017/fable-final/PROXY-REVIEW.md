# Proxy model service: independent review checkpoint

Status: **SAFE-STOP. Reviewed source only; no activation qualification.** This supplement records the last independent read-only review of the uncommitted service-pair receiving changes. It does not identify these bytes as a published Git commit or qualified image. Preserve the actual source, tests, and newly added fixture files in the portable checkpoint and verify them against the final package manifest. No implementation repair, test execution, Git mutation, network action, or credential access was performed while preparing this document.

## Architecture and authority

- The Python product proxy uses the separate pinned Debian/CPython 3.13.5 native assembly, LiteLLM 1.104.2, and the existing dependency lock. Its product Dockerfile requires an independently qualified digest-pinned assembly image; it does not use the Node worker base or resolve another package set.
- The Node owner executable assembles the canonical persisted facts, initial-run journal, original runner placement, budget owner, and fresh native Core conversation currentness against one pool. The complete reviewed control configuration is SHA-pinned before parsing. Service discovery supplies **only the owner/proxy service pair**. Original runner execution, capability, allocation, issuance, writer fence, and network placement continue to come from the existing database-backed owners.
- Runner-to-proxy HTTPS is port 8443. Proxy-to-owner mTLS is port 8444, using separate operation and capture connections, exact independently configured certificate/issuer fingerprints, and observed socket addresses. Request headers or response echoes do not establish AWS task identity. Temporal issuer port 8445 belongs to a separate service.
- Native LiteLLM custom-auth compatibility remains narrowly version/function-hash guarded; native common checks remain in the path. The product projection is not a master key, generic JWT authority, or substitute provider loop.

## Startup pair discovery and limits

The nested service configuration is closed `schemaVersion:2`. Reviewed inputs pin deployment revision/expiry, both certificate fingerprints, exact cluster/service/task-definition ARNs, container/image digest, task/execution roles, VPC, subnets, and security groups. Prelaunch task ARNs, IP addresses, creation timestamps, arbitrary endpoints, and callbacks are refused.

Both language implementations freshly read the two approved services, service-scoped task inventories, task definitions, actual running tasks, and ENIs. They require one running task per service, one eligible PRIMARY deployment, exact task-definition/role/image/network joins, actual task creation time, private addresses, and no public-IP or IPv6 path. PRIMARY `IN_PROGRESS` is refused unless the reviewed per-role pin explicitly permits it. Final service and task-inventory reads must still match the initial selection. Inventory is bounded to four pages; ambiguity denies.

The normal scripted proof uses ten SDK calls. Each read is bounded by the caller deadline, immutable configuration expiry, and a maximum three-second request lifetime; emitted leases last at most 30 seconds. Authorization is freshly observed before and after transport operations. A valid task/IP/creation-time replacement permanently retires the admitted runtime pair; there is no stale-IP fallback. Node pending SDK work quarantines the reader. Python abort retires future native commands; an in-flight blocking call is not described as physically stopped merely because its async waiter was cancelled.

No material production source defect was found in this receiving review. This is a source conclusion, not an AWS consistency, transport-performance, installed-native, or deployment result.

## Actual focused evidence and unfinished fixture

Previously executed during review, **not rerun for this safe-stop document**:

- Node 24: discovery, lease, and owner-entrypoint files **62/62 passed**.
- Python: discovery, owner HTTPS, main, startup configuration, and Uvicorn protocol files **39 passed, one installed-native skip** (40 total).
- A further directly affected `test_owner_startup.py` run had **one pass and one error**. `StartupCompositionTests.test_real_startup_joins_placement_and_fresh_admission_without_native_import` still constructs `ProductOwnerHttpsExchange` at line 40 without the newly mandatory canonical `service_pair_reader`. Construction fails at `owner_https.py:124` with `PRODUCT_OWNER_HTTPS_DENIED`. The fixture also uses the earlier prelaunch task/IP inputs. **This remains unfinished.** Receive the fixture through genuine scripted service discovery and a compiled peer policy, preserving the real constructor guard and original runner issuance/placement. Do not weaken production validation to make it pass.
- Scoped whitespace checks passed. The existing original placement/facts and Python owner-startup/bearer-admission production files were unchanged from the reviewed checkout HEAD.

These counts describe separate runs and are not a full-suite pass claim. The installed-native skip means real LiteLLM startup was not qualified here.

## Exact reviewed working-tree hashes

All paths below are relative to `apps/proxy/product/`; SHA-256 values identify the last reviewed bytes. The first eight are production source; remaining rows are focused tests. The new supporting `test/service-pair-fixture.mjs` must also be included and independently hash-bound by the final package manifest.

| Path | SHA-256 |
| --- | --- |
| `service-pair-discovery.mjs` | `2873865c4a71ce5c024c329fa6c5d1aaac917b9a2773ac4dbd5406a1b59b28e6` |
| `service-task-leases.mjs` | `0f822c7dfc2332b02157eaea1d89efc0bbe40110612f048c14250704a9c63c43` |
| `owner-entrypoint.mjs` | `54d17bcc773b47c9e167f8e68f95fafc8931bffece91ef9c8d3bfffc6db089a2` |
| `service_pair_discovery.py` | `76c12cee0e9685d452f56ec8bec5bf0e9c949749407ece9a3c77e2d1366c565d` |
| `main.py` | `11d764b5c95314effca7167af08f163bdc2dafc6840e707af0b3ed4399fb1b66` |
| `startup_config.py` | `03003aa0693cd5ee51e0a3644970aa7aefefef597d18662e7b8ab7f6635e38df` |
| `owner_https.py` | `6c4a62ddc78d589db38c0f12ea7929cfe082457204698b9b9141a162b0da5b0d` |
| `uvicorn_tls_protocol.py` | `844973080d2410d3c4e530347bfdaac66b8b0962abd8be43f9a57b75e87b5aa5` |
| `service-pair-discovery.test.mjs` | `2d63f91b2f097b5624c22d650cfcf6b8af2d649493be5dbcc1abdafb94707348` |
| `service-task-leases.test.mjs` | `88de4a82ea306fce36a685abff0f0e52f7183fd5936de2038deae0e342fc4cf1` |
| `owner-entrypoint.test.mjs` | `503365a5e60fa900dc7f3486da0870bd10deaecc67ab6638ec1571e7e60143cf` |
| `test/test_service_pair_discovery.py` | `0021491b2991870675fc714775184544d6bd3fdc5dcc8027959ec2a54863e4ad` |
| `test/test_main.py` | `88cecd1ac73ac81488e2bac07d38c0c894eda02fe548d2a4602258bd9feee324` |
| `test/test_startup_config.py` | `9fe4bd41df2bd6c129eb04c22252338d02822b58f971115f7aa22518f9c9929b` |
| `test/test_owner_https.py` | `8bb598fadd54841be6b7f7ded582afa9cc57292f0cbf109472342d13eb188466` |

## Qualification, security, and rollback prerequisites

Actual ECS/EC2 authorization and responses, container-role credential delivery, nonroot Linux material ownership, native TLS handshakes, installed LiteLLM startup, provider/model dispatch, and this successor's image build/scan are **UNRUN** in this review. The Docker recipe and future installed-native smoke are source only. No authenticated first-chat or saved/reload acceptance is implied.

Before activation, identify the exact source/image/config revisions, original database/schema/grant owner, selected member/client and native Core proof, private service routing/SGs, deployment expiry, trusted certificate delivery/renewal, and narrowly scoped task-role permissions for every added ECS read. Verify both actual service task definitions and current task/ENI observations; do not manufacture prelaunch task IDs or reuse service discovery as runner issuance authority. Keep unrelated AWS/provider HTTPS on port 443.

Rollback must fence new admissions, retain the original image/config/material references and authenticated stop/reconcile path, and establish physical task/connection cleanup rather than infer it from cancellation. Pair replacement requires a fresh reviewed runtime; configuration rollover must preserve original run and conversation custody. No routing, desired-count, task-definition, IAM, credential, database, or service change is authorized by this supplement. Root's final handoff must name the actual approved prior revision and shipping owner before any resume action.
