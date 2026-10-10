# Complete proxy dependency proposal after q2

Codex DATA-only discovery, based on closed q2 report commit `be0b7628ad6f33c3469e620fbb846b2b28c71a98`. Outline before analysis: compare all installed LiteLLM 1.104.2 declared proxy requirements with its retained upstream lock; statically inventory mandatory top-level proxy imports and known Prisma/native startup prerequisites; separate selected package closure from optional/configured features. Reuse canonical metadata/requirement owners, retain raw source/hash provenance and report missing wheel/license/marker evidence. Own this sole tracked report and new ignored data/evidence only. No install, application import retry, Prisma/npm/engine generation, DB/listener/provider/cloud action, or original source mutation. A complete next environment needs coherent artifacts/licenses and separate owner admission; this report grants neither.

## Result and next action

**A complete declared-requirements inventory and a concrete 123-wheel community/native-key candidate are prepared; neither is installed or admitted.** The candidate preserves 90 q2 versions, adds 32 names, and proposes one explicit replacement, `importlib-metadata==8.5.0`, from the retained upstream lock. All 123 exact wheel artifacts are present and hashed. Actual wheel METADATA passes **217 selected constraints**. The full published `proxy` extra remains unsatisfied because its proprietary enterprise package is explicitly excluded; this fact is retained as the one failed declared-extra constraint. Do not call this a fully installed or universally supported `litellm[proxy]` environment.

After independent owner review of artifacts/notices and this exact scope, the next executable prerequisite can be **one fresh short-path q3 offline installation from the explicit 123-file/hash requirements**, installed-byte/RECORD/license freeze, then one guarded genuine app import. Do not retry q2 or install expression alone. No q3 directory, venv, installation, app import or execution helper was created here. Preserve the original failure and physical denials. If the next app import fails, retain its actual result; this static analysis does not promise import success. Generating the real Prisma client and exercising native DB-backed key authentication require a separate explicit, coherent native-toolchain/schema/DB allocation, described below.

## Complete declared extra and license boundary

LiteLLM 1.104.2 wheel METADATA selects **50 requirements on CPython 3.11.15 Windows** when `extra=proxy`: 18 base rows and 32 proxy-only rows. That includes `litellm-enterprise==0.1.71` and `litellm-proxy-extras==0.4.102.post1`. Linux-only uvloop and pyroscope-io are excluded by their explicit Windows markers, not silently removed. The complete rows, raw requirements, chosen q2 versions, lock versions and policy classifications remain in `full-proxy-data-1/inventory.json`. The retained upstream lock contains 462 package records. Its Windows proxy dependency graph, excluding those two policy packages, has 114 resolved package names and no unresolved lock edges; 31 names were absent from q2 and 36 present versions differed. Consequently, simply appending expression or copying the lock's versions over q2 would not establish a coherent environment.

Exact release JSON and wheel license texts establish distinct package boundaries:

- [litellm-enterprise 0.1.71](https://pypi.org/pypi/litellm-enterprise/0.1.71/json) declares `LicenseRef-Proprietary`. Its captured full license restricts production use to the applicable subscription/license agreement and separately addresses development/testing. It is retained solely as license evidence and **not selected for this candidate**. No authority to use its production features is implied.
- [litellm-proxy-extras 0.4.102.post1](https://pypi.org/pypi/litellm-proxy-extras/0.4.102.post1/json) declares MIT. Its exact wheel includes the Berri AI notice, the MIT terms and an enterprise-directory exclusion; its member inventory contains no `enterprise/` directory. This package is not interchangeable with litellm-enterprise. It carries the normal Prisma migration/toolchain helpers and SQL assets needed by the current native DB setup path, so the proposed community candidate includes it.
- [expression 5.6.0](https://pypi.org/pypi/expression/5.6.0/json) declares MIT; exact wheel METADATA and full text were captured. Its default dependency is typing-extensions; optional pydantic/all extras were not selected. Its import is unconditional in the actual failed outbound-credentials source, despite the fact that the route family is not the qualification endpoint.

The unchanged upstream community app and native virtual-key handler provide explicit enterprise-absent paths: `proxy_server.py:942` wraps enterprise routes/config imports in `try/except ImportError` and assigns `enterprise_proxy_config=None`; `auth/user_api_key_auth.py:143` does the same for enterprise custom auth, assigning `None`. At lines 1543 onward, the handler branches on that value, then continues through the upstream native key path. Lines 2104 onward require an actual connected Prisma client for non-master virtual keys. No custom auth substitute, no-auth dev mode, static fake key or alternate app is proposed. JWT/premium integrations have separate premium checks; their omission cannot be called qualification of those features. If later product scope requires such features, their exact licensing and configuration must be decided then.

Extras is optional for importing the bare community app, but **not disposable for the intended real DB setup**: `db/prisma_client.py:935` imports its DB manager for migrate mode, and line 948 imports its Prisma runner for db-push mode; either missing dependency returns failure. `proxy/prisma_migration.py:18` imports its toolchain unconditionally. `proxy_cli.resolve_v2_migration_resolver` also uses extras. The package's description claiming only SQL storage is incomplete relative to its actual seven Python modules; retained code, not that description, informs this proposal.

## Coherent candidate and preserved failures

The original 91-package environment had passed its own selected 135 constraints. Broadening to all published community proxy requirements exposed a real compatibility issue before any installation: `opentelemetry-api==1.33.1` requires `importlib-metadata>=6,<8.7`, while q2 contains 8.9.0. `coherent-candidate-1/result.json` preserves both this failed constraint and the intentionally absent enterprise constraint. The second DATA check changes only the proposed importlib version to the **retained lock's 8.5.0**, which satisfies both OpenTelemetry and LiteLLM's `>=8,<9`. The second check uses each downloaded wheel's actual METADATA, validates declared Python compatibility, and retains all 218 rows: 217 pass and the one enterprise requirement remains explicitly unsatisfied. It does not change q2 or claim a resolver selected these versions.

The 32 new names are:

| Package | Exact version |
| --- | --- |
| azure-core | 1.41.0 |
| azure-identity | 1.25.2 |
| azure-storage-blob | 12.28.0 |
| croniter | 6.2.2 |
| deprecated | 1.3.1 |
| expression | 5.6.0 |
| granian | 2.7.4 |
| gunicorn | 23.0.0 |
| hiredis | 3.4.0 |
| inquirerpy | 0.3.4 |
| isodate | 0.7.2 |
| litellm-proxy-extras | 0.4.102.post1 |
| markdown-it-py | 4.2.0 |
| mcp | 2.2.0 |
| mcp-types | 2.2.0 |
| mdurl | 0.1.2 |
| msal | 1.37.0 |
| msal-extensions | 1.3.1 |
| opentelemetry-api | 1.33.1 |
| pfzy | 0.3.4 |
| polars | 1.38.1 |
| polars-runtime-32 | 1.38.1 |
| prompt-toolkit | 3.0.52 |
| pygments | 2.20.0 |
| pynacl | 1.6.2 |
| pywin32 | 311 |
| restrictedpython | 8.5 |
| rich | 13.9.4 |
| rq | 2.7.0 |
| sse-starlette | 3.4.4 |
| wcwidth | 0.7.0 |
| wrapt | 1.17.3 |

The candidate also keeps the already-selected real Prisma 0.11.0, psycopg/psycopg-binary and canonical guard/counter dependencies from q2. No enterprise extras, extra-proxy cloud/KMS/resend/redisvl/A2A set, SAML, model-provider telemetry or generic `proxy-runtime` extra was installed. Some OSS proxy-extra packages serve optional features or alternative process servers; their inclusion here covers the complete declared community proxy package requirement set, not a claim that every one is unconditionally imported or configured. A source import requirement is distinct from permission to invoke Azure, Redis, MCP, telemetry or any network feature.

## Static import coverage and native boundary

The fixed DATA extractor follows literal module-level local imports, package initializers and importable aliases from the genuine app into **1,364 LiteLLM modules**, retaining source hashes and exact line/context rows. This is broader than the historical selective 283-module graph. Every one of the 1,364 source records remeasured identically at finalization. `expression` and fastapi-sso have unguarded references; enterprise, SAML, ddtrace, New Relic, debug objgraph and Opik references retain their actual condition/exception contexts. The billing-metrics module itself imports OpenTelemetry SDK/exporter modules, but the app wraps importing that module in an ImportError fallback; those packages are not made mandatory by flattening the graph. Module/function calls, decorators, computed imports and conditional execution are not fully resolved. The overapproximation is **not** a proof of complete runtime import closure, nor does it make every optional branch mandatory.

Real native key authentication needs the actual generated Prisma client and a real isolated DB with the reviewed native schema. Prisma's installed `__init__.py` catches missing generated modules; requesting `Prisma` then explicitly refuses when generation has not occurred. `proxy/utils.py:4414` imports the generated client inside `PrismaClient.__init__` and fails if unavailable. The schema selects PostgreSQL and `prisma-client-py`, with native and several Linux binary targets. Python wheel metadata does not bind those generated files or Rust/native binaries.

Pinned Prisma 0.11.0 source defaults to Node CLI **5.4.2** and engine commit **ac9d7041ed77bcc8a8dbd2ab6616b39013829574**. Its wrapper can install a private Node runtime and npm CLI when absent. Newly inspected extras toolchain source describes this bootstrap, separate command/migration budgets and process-group handling. None was invoked. The next native-toolchain preparation must freeze exact Node/CLI/engine artifacts and licenses for the intended platform, generated-client/schema bytes and compatibility, owned caches, subprocess budgets/containment and a reviewed isolated DB/migration strategy. Do not permit implicit runtime downloads or `db push --accept-data-loss` merely because upstream code offers them. Native library provenance/security, Linux wheels and the previously open bundled-libpq finding remain separate; Windows wheel hashes do not qualify Fargate.

## Evidence

Anonymous retrieval was limited to exact retained/published release versions: 34 release JSON responses and 34 exact wheel artifacts. All wheel sizes/SHA256 match their release records; all actual wheel requirement lists match their release metadata as canonical Requirement multisets. Fixed CPython 3.11 Windows/universal tags and Requires-Python were checked. The 34 wheels total **64,711,643 bytes**, including the unselected enterprise license-inspection artifact; **42 full license/notice files** were retained and hashed. No package code from a downloaded wheel was executed or imported. Null/legacy license metadata was retained honestly alongside the full captured text, not converted into an invented SPDX assertion. This is provenance/notice capture pending owner review, not full transitive release or legal clearance.

Key immutable DATA:

- `full-proxy-data-1/inventory.json`: 3,538,482 bytes, SHA256 `1bdb1ac51e0503fb0b86b672f84394418b2aadd9393bb8c1a04d03aa3c4b8eed`.
- `proposal-wheel-notices-1/manifest.json`: 81,984 bytes, SHA256 `a6b5e96082793d733fa8ddd230517621bc66155e5712d031d45676bf7b3473b7`.
- `coherent-candidate-2/result.json`: 212,595 bytes, SHA256 `1b7fc852bac4a0bc899f71dfc68e518f05c14428048da51120245d45d9908f15`.
- `proposed-community-123-1/plan.json`: 251,578 bytes, SHA256 `fb6aba510c2f2242cb1b9245a134fe2448cd1aba454fa3362606615ec03bb8e8`; exact requirements 28,697 bytes, SHA256 `1b9b0d2e000693dd23109646968f0e87f4d871584f71c288123ead3258430621`.
- Final 176-payload seal `.task-inputs/final-proposal-1/manifest.json`: 53,710 bytes, SHA256 `a1797b91e97875a1623db466d116750f05c95bbe1154a36e338a5d4aaca1ecdf`.

A failed navigation read of a metadata helper under the wrong prior worktree and an unsupported Windows rg wildcard were retained in the tool history; both were read-only. The first metadata coherence failure is preserved. No actual app/test/import/Prisma/engine/DB operation or install was performed in this task; the pure metadata checks deny subprocess/socket dispatch and record zero such attempts. Nothing here advances source execution, authentication, runtime security, physical cleanup or G1.
