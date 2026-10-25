## 1. Claude handles the harness

The quality bar is Claude's own. Answer quality comes from the whole harness, not only the model: its system prompt, built-in tools, subagents, skills, context management and compaction, and session handling.

- Run `@anthropic-ai/claude-agent-sdk` with its **full harness** and the Claude Code system-prompt preset, plus a short Capiro/Meri append. Don't replace the preset with our own prose.
- Do not rebuild what the SDK or AWS already does: model calls, retries, streaming, the tool loop, context management and compaction, session resume/fork, per-run turn and spend limits, AWS credentials.
- The real Claude SDK calls Bedrock directly using its narrowly scoped AgentCore runtime IAM role. Preserve the full preset, native tools, subagents and all 14 skills.
- Capiro data reaches Claude as **tools** (rule 4), not as a custom retrieval layer around the model.

Spec and plan: `phases/wave2/WAVE2-00-CLAUDE-NATIVE-HARNESS-SPEC.md`. It is **Wave 2 item 0**, and it comes before every other item that touches the runner, the proxy or authority.

## 2. Simple, standard architecture

```text
browser -> control (current access, conversation/run ownership, durable events)
        -> AgentCore Runtime V1 (isolated conversation session; actual Claude SDK) -> Bedrock
                                      -> tool gateway -> Core
control -> existing durable SDK SessionStore and artifact owners
control -> Temporal for required durable runs, schedules and background work
```

- **Core is the gatekeeper for Capiro data.** Tenant, member, client and wall rules remain server-side in Core. Check current access at admission and actual tool/data/artifact access; revocation must also prevent use of previously loaded privileged context. Do not duplicate policy in the harness.
- Reuse one isolated environment only for the same immutable tenant/actor/conversation and approved General/client scope. Serialize turns; stop idle compute and restore exact SDK transcripts and artifacts from their durable owners. A Runtime session ID is not authorization or durable storage.
- Keep the SDK's per-run turn/spend limits and one canonical tenant cap/usage owner. Preserve required durable runs, schedules, consent, outcomes and uncertain-write fences; neither SDK Task tools nor a warm process replaces Temporal durability.
- **No custom warm pool, per-turn ECS task requirement, model proxy, duplicated per-hop authority, credential-minting service or spend-reservation ledger.** Use standard Runtime V1; no V2 snapshot machinery or second SDK implementation.
- Before adding a mechanism, identify the standard feature or existing owner it uses. Before deleting a wrapper, prove the retained lower-layer behavior with meaningful positive/negative tests. Do not remove canonical authorization, idempotency or durable outcomes as “extra security.”

## 3. Leave no dead code behind

A change is not done until what it replaced is gone.

1. **Delete in the same PR** everything the change makes unused: code, tests, fixtures, docs, config keys, env vars, feature flags, IAM statements, ALB rules, secrets, task definitions, CloudFormation resources, kit steps, alarms and metric filters. Applied database migrations are history: never edit them. Drop tables only through a separately reviewed forward migration after a snapshot; this hosting migration does not itself authorize schema/data removal.
2. **Temporary diagnostics come out before merge** of the fix they were added for. A log line stays only as named product telemetry that someone reads.
3. **No code behind a flag nothing turns on.** The "source-complete, activation-held" status is retired for code we don't intend to ship. Dark features need an owner and a date, or they are deleted.
4. **No** commented-out code, `legacy` or `_old` copies, compatibility shims for removed things, or "superseded" stubs.
5. **Show proof in the PR:** list the identifiers, files and resources deleted, with a search proving no executable/active caller remains; label immutable historical references, and explain any drop in test count.
6. **Old plan tickets for removed mechanisms are closed as superseded**, not implemented and left dormant. See `source-of-truth/SUPERSEDED-BY-ITEM-0.md`.
7. **Reuse before write.** Use SDK, AWS and library features first. Custom code needs one line saying what the standard option couldn't do.

## 4. Capiro data must keep working

- Capiro data is served to Claude as tools. Core remains the source: today's read families call Core at `/api/clio/tools/<operation>`, and the new tools call the same endpoints.
- Tools are hosted by **control** (the existing tool gateway) so the runner never holds the Core service secret (`x-internal-service-secret`). The runner gets only a short-lived per-run token for control, scoped to tenant, user, client, conversation and run.
- Reuse the existing read handlers under `apps/gateway/sources/*` and their typed schemas. Delete the authority, relay and measurement wrappers around them.
- Parity: every read family that works today must be reachable as a tool with the same results and the same permission outcomes. A parity checklist is part of the item 0 spec.
- Negative tests are mandatory: another tenant's data, another client's data, and walled data must not be retrievable, through chat or through tools. A General chat reads across the clients the user can already see, with each client's wall enforced per result (FINAL-PLAN decision 2).
- The original read-only first cut is historical. Neo subsequently authorized preview client-record writes and autonomous Wave 2 completion. Activate accepted writes through their existing authenticated domain/intent owners and receipts, with the actual route/configuration and effect semantics verified. This does not authorize the assistant to send external mail without the user's specific send instruction.

# Owner/proxy/issuer source retirement — review inventory, 25 October 2026

**Source audit cutoff: 2026-10-25 17:44 UTC. Live resource deletion/absence: NOT RUN.** This is the narrow author appendix to the existing [migration deletion inventory](../20261022/plan/AGENTCORE-RUNTIME-MIGRATION-20261024.md#deletion-inventory-required-not-a-claim-of-deletion), for Root to fold into that owner. It adds no deployment, registry or cleanup mechanism. Root owns integration and independent review; Release alone owns cloud readback and operations.

Base `7eee7f7c358be9ae903169816ef68eb6e64ae1f3`; author branch `codex/w2-owner-proxy-issuer-retirement-20261025`. Canonical standing/provenance revision `c0411e2` is preserved in docs `f28cb25e48c0f268c463bcf6f0f2aa13bebdded3`. Current instructions override historical mechanism prose. The committed tree and final head are in the PR; a document cannot contain its own commit hash.

Implementation outline: establish last import/image/CLI/config readers; delete only the allocated obsolete leaves and their approved package/suite callers; exercise current control/SDK/Temporal owners; preserve migration and current-authority tests; publish ordered Release dependencies. There is no new product interface, policy, persistence or replacement implementation.

81 whole files are removed. Three originally allocated files remain unchanged (pinned transport, its test and poststart CLI); the retained envelope values are unchanged and its file receives only a stale-comment correction. Snapshot tests are redirected to the existing control mount and the existing SQL identity assertions are retained. No applied SQL, journal, SessionStore, memory, artifact, native-authority product source, Core read handler, private edge, shared lockfile, current image entrypoint, active app configuration key, feature flag or IAM statement changes. The extra deletions are the 16 package-local config/docs files explicitly allocated by Root; the extra caller edits are listed below.

## Retained owners and common row semantics

| Group | Replacement/retained owner and local evidence | Source/rollback disposition |
|---|---|---|
| P — qualification proxy | Actual SDK direct Bedrock: worker `options-trust.test.mjs`; AgentCore candidate/execution/routine composition. Old Python reservation/count/transport/Prisma harness has no current product mount. Immutable qualification SQL stays. | Delete obsolete source/config/test closure; keep prior immutable image/evidence for the bounded rollback. No source deletion establishes live eligibility. |
| M — model bridges | Direct SDK options; existing canonical usage owner. Retained `budget/product-model-{budget,settlement}.test.mjs` pass 22/22 and still use the unchanged envelope constants. | Delete codec/bridges/old envelope parity tests; RETAIN envelope until separately allocated budget-owner review. |
| S — loopback relay | Existing control `sdk-session-http.mjs`; all three snapshot cases remain, including captured owner, foreign/revoked refusal, missing owner and getter/proxy denial. Candidate mounts native session operations. | Delete unmounted relay and its tests; direct snapshot test now supplies the required execution port. No product owner change. |
| T — custom token issuer | `temporal-tls.mjs`, native client certificates, current renderer/server role mapper. Two native TLS tests pass; closed-config issuer rejection remains tested. | Delete unmounted renewal/token consumer and issuer-only type assertions. Current native TLS/worker/AgentCore typing remains. |
| R — retained poststart/TLS fixture | `runner-poststart-cli.mjs` and native-authority `test/router-tls-fixture.mjs` still consume pinned transport; workspace preflight tests still consume poststart CLI. | RETAIN, Root owns subsequent exact consumer review. Test-only use is not claimed as production reachability; this lane does not remove retained fixture behavior. |
| B — obsolete image/plan | Current runtime Dockerfile and canonical node image recipe select AgentCore entrypoint; proxy starter references an already-absent build script. | Delete obsolete starter/test/plan. No proxy build performed. Historical images and source manifests stay. |

All source rows below use this 17:44 UTC audit. READY means source removal is reviewable, not cloud clearance. Their live dependencies, rollback use and failure actions remain the Release rows below. If source review finds a retained reader, stop that row and restore the exact base file/consumer rather than copy behavior. Previous accepted immutable image/config are preserved by Release until explicit closure.

## Exact initial candidates and approved package additions

Paths in the reader column are relative to their candidate package unless prefixed `scripts/`. Every row is individually accounted for; no directory deletion was used.

| Exact source/config identifier | Last reader at base | Owner group | Action/disposition |
|---|---|---|---|
| `apps/gateway/model-proxy/product-boundary-codec.mjs` | product-boundary-codec.test.mjs, product-envelope.test.mjs | M | DELETE — READY |
| `apps/gateway/model-proxy/product-boundary-codec.test.mjs` | obsolete-only test discovery; see test-count table | M | DELETE — READY |
| `apps/gateway/model-proxy/product-envelope.mjs` | budget/product-model-budget.mjs and budget/product-model-settlement.mjs | M | RETAIN — named dependency |
| `apps/gateway/model-proxy/product-envelope.test.mjs` | obsolete-only test discovery; see test-count table | M | DELETE — READY |
| `apps/gateway/model-proxy/product-request-owner.mjs` | product-request-owner.test.mjs, product-reservation-bridge.mjs | M | DELETE — READY |
| `apps/gateway/model-proxy/product-request-owner.test.mjs` | obsolete-only test discovery; see test-count table | M | DELETE — READY |
| `apps/gateway/model-proxy/product-reservation-bridge.mjs` | product-reservation-bridge.test.mjs | M | DELETE — READY |
| `apps/gateway/model-proxy/product-reservation-bridge.test.mjs` | obsolete-only test discovery; see test-count table | M | DELETE — READY |
| `apps/gateway/model-proxy/product-settlement-bridge.mjs` | product-settlement-bridge.test.mjs | M | DELETE — READY |
| `apps/gateway/model-proxy/product-settlement-bridge.test.mjs` | obsolete-only test discovery; see test-count table | M | DELETE — READY |
| `apps/proxy/qualification/assembly/__init__.py` | component-pins.json, linux/assembly-pins.json | P | DELETE — READY |
| `apps/proxy/qualification/assembly/bridge.py` | assembly/test_fixture_compatibility.py, assembly/test_lifecycle.py | P | DELETE — READY |
| `apps/proxy/qualification/assembly/lifecycle.py` | assembly/bridge.py, assembly/test_fixture_compatibility.py, assembly/test_host_address.py, assembly/test_lifecycle.py | P | DELETE — READY |
| `apps/proxy/qualification/assembly/test_fixture_compatibility.py` | obsolete-only test discovery; see test-count table | P | DELETE — READY |
| `apps/proxy/qualification/assembly/test_host_address.py` | obsolete-only test discovery; see test-count table | P | DELETE — READY |
| `apps/proxy/qualification/assembly/test_lifecycle.py` | obsolete-only test discovery; see test-count table | P | DELETE — READY |
| `apps/proxy/qualification/linux/assembly.test.py` | obsolete-only test discovery; see test-count table | P | DELETE — READY |
| `apps/proxy/qualification/linux/import-probe.py` | linux/Dockerfile ENTRYPOINT; linux/assembly.test.py | P | DELETE — READY |
| `apps/proxy/qualification/linux/native-runtime/fixture_config.py` | linux/native-runtime/native_auth_probe.py, linux/native-runtime/test_native_auth_config.py, linux/postgres-fixture/native_bootstrap.py, linux/postgres-fixture/test_native_bootstrap.py, linux/native-runtime/README.md, linux/postgres-fixture/README.md | P | DELETE — READY |
| `apps/proxy/qualification/linux/native-runtime/native_auth_probe.py` | linux/native-runtime/fixture_config.py, linux/native-runtime/test_native_auth_config.py, linux/postgres-fixture/native_bootstrap.py, linux/postgres-fixture/run-fixture.py, linux/native-runtime/README.md, linux/postgres-fixture/README.md | P | DELETE — READY |
| `apps/proxy/qualification/linux/native-runtime/test_native_auth_config.py` | obsolete-only test discovery; see test-count table | P | DELETE — READY |
| `apps/proxy/qualification/linux/postgres-fixture/config.py` | linux/native-runtime/fixture_config.py, linux/native-runtime/native_auth_probe.py, linux/native-runtime/test_native_auth_config.py, linux/postgres-fixture/native_bootstrap.py, linux/postgres-fixture/run-fixture.py, linux/postgres-fixture/test_fixture.py, linux/postgres-fixture/test_native_bootstrap.py, runtime/aws_counter.py, test/test_aws_counter.py, linux/assembly-pins.json, linux/native-runtime/README.md, linux/postgres-fixture/README.md | P | DELETE — READY |
| `apps/proxy/qualification/linux/postgres-fixture/docker_capture.py` | linux/postgres-fixture/run-fixture.py, linux/postgres-fixture/test_fixture.py, linux/postgres-fixture/README.md | P | DELETE — READY |
| `apps/proxy/qualification/linux/postgres-fixture/native_bootstrap.py` | linux/postgres-fixture/run-fixture.py, linux/postgres-fixture/test_native_bootstrap.py, linux/postgres-fixture/README.md | P | DELETE — READY |
| `apps/proxy/qualification/linux/postgres-fixture/native_output_capture.py` | linux/postgres-fixture/native_bootstrap.py, linux/postgres-fixture/prisma-peer.py, linux/postgres-fixture/run-fixture.py, linux/postgres-fixture/test_native_output_capture.py, linux/postgres-fixture/README.md | P | DELETE — READY |
| `apps/proxy/qualification/linux/postgres-fixture/prisma-peer.py` | linux/postgres-fixture/run-fixture.py, linux/postgres-fixture/test_fixture.py, linux/postgres-fixture/test_native_output_capture.py | P | DELETE — READY |
| `apps/proxy/qualification/linux/postgres-fixture/prisma_error_evidence.py` | linux/postgres-fixture/native_bootstrap.py, linux/postgres-fixture/prisma-peer.py, linux/postgres-fixture/run-fixture.py, linux/postgres-fixture/test_native_bootstrap.py, linux/postgres-fixture/test_prisma_error_evidence.py, linux/postgres-fixture/README.md | P | DELETE — READY |
| `apps/proxy/qualification/linux/postgres-fixture/run-fixture.py` | linux/postgres-fixture/test_fixture.py, linux/postgres-fixture/README.md | P | DELETE — READY |
| `apps/proxy/qualification/linux/postgres-fixture/server-bootstrap.sh` | linux/postgres-fixture/run-fixture.py | P | DELETE — READY |
| `apps/proxy/qualification/linux/postgres-fixture/test_fixture.py` | obsolete-only test discovery; see test-count table | P | DELETE — READY |
| `apps/proxy/qualification/linux/postgres-fixture/test_native_bootstrap.py` | obsolete-only test discovery; see test-count table | P | DELETE — READY |
| `apps/proxy/qualification/linux/postgres-fixture/test_native_output_capture.py` | obsolete-only test discovery; see test-count table | P | DELETE — READY |
| `apps/proxy/qualification/linux/postgres-fixture/test_prisma_error_evidence.py` | obsolete-only test discovery; see test-count table | P | DELETE — READY |
| `apps/proxy/qualification/linux/prisma-build.py` | linux/Dockerfile RUN/COPY; linux/assembly.test.py | P | DELETE — READY |
| `apps/proxy/qualification/offline-policy.mjs` | test/offline-policy.test.mjs, README.md | P | DELETE — READY |
| `apps/proxy/qualification/runtime/__init__.py` | component-pins.json, linux/assembly-pins.json | P | DELETE — READY |
| `apps/proxy/qualification/runtime/aws_counter.py` | test/test_aws_counter.py | P | DELETE — READY |
| `apps/proxy/qualification/runtime/bedrock_body.py` | runtime/aws_counter.py, runtime/bedrock_transport.py, runtime/native_usage.py, state/ledger.py, state/pricing.py, test/test_aws_counter.py, test/test_bedrock_transport.py, test/test_postgres_state.py, test/test_server.py, test/test_tool_budget_source.py, state/dependencies.json | P | DELETE — READY |
| `apps/proxy/qualification/runtime/bedrock_transport.py` | runtime/aws_counter.py, state/ledger.py, test/test_bedrock_transport.py, test/test_postgres_state.py, test/test_server.py, state/dependencies.json | P | DELETE — READY |
| `apps/proxy/qualification/runtime/ingress.py` | runtime/lifetime.py, runtime/server.py, test/test_ingress.py, test/test_lifetime.py, test/test_server.py, README.md | P | DELETE — READY |
| `apps/proxy/qualification/runtime/lifetime.py` | runtime/server.py, test/test_lifetime.py, test/test_server.py | P | DELETE — READY |
| `apps/proxy/qualification/runtime/native_usage.py` | test/test_native_usage.py | P | DELETE — READY |
| `apps/proxy/qualification/runtime/server.py` | linux/native-runtime/native_auth_probe.py, test/test_server.py, component-pins.json | P | DELETE — READY |
| `apps/proxy/qualification/state/__init__.py` | component-pins.json, linux/assembly-pins.json | P | DELETE — READY |
| `apps/proxy/qualification/state/admission.py` | qualification internal imports; scope-ledger/ownership-graph.json | P | DELETE — READY |
| `apps/proxy/qualification/state/grants.py` | assembly/lifecycle.py, runtime/ingress.py, state/admission.py, state/ledger.py, test/test_ingress.py, test/test_postgres_state.py, test/test_tool_budget_source.py | P | DELETE — READY |
| `apps/proxy/qualification/state/ledger.py` | qualification internal imports; scope-ledger/ownership-graph.json | P | DELETE — READY |
| `apps/proxy/qualification/state/postgres_store.py` | assembly/bridge.py, test/test_postgres_state.py, test/test_tool_budget_source.py | P | DELETE — READY |
| `apps/proxy/qualification/state/pricing.py` | assembly/lifecycle.py, runtime/ingress.py, runtime/lifetime.py, runtime/server.py, state/admission.py, state/grants.py, state/ledger.py, state/postgres_store.py, state/sql.py, test/test_ingress.py, test/test_lifetime.py, test/test_postgres_state.py, test/test_server.py, test/test_tool_budget_source.py | P | DELETE — READY |
| `apps/proxy/qualification/state/sql.py` | state/admission.py, state/grants.py, state/ledger.py, state/postgres_store.py | P | DELETE — READY |
| `apps/proxy/qualification/test/offline-policy.test.mjs` | package.json test; local-baseline/suites.json proxy-qualification | P | DELETE — READY |
| `apps/proxy/qualification/test/test_aws_counter.py` | qualification test discovery; scope-ledger/owner-exclusion.json | P | DELETE — READY |
| `apps/proxy/qualification/test/test_bedrock_transport.py` | obsolete-only test discovery; see test-count table | P | DELETE — READY |
| `apps/proxy/qualification/test/test_ingress.py` | obsolete-only test discovery; see test-count table | P | DELETE — READY |
| `apps/proxy/qualification/test/test_lifetime.py` | obsolete-only test discovery; see test-count table | P | DELETE — READY |
| `apps/proxy/qualification/test/test_native_usage.py` | obsolete-only test discovery; see test-count table | P | DELETE — READY |
| `apps/proxy/qualification/test/test_postgres_state.py` | obsolete-only test discovery; see test-count table | P | DELETE — READY |
| `apps/proxy/qualification/test/test_server.py` | obsolete-only test discovery; see test-count table | P | DELETE — READY |
| `apps/proxy/qualification/test/test_tool_budget_source.py` | obsolete-only test discovery; see test-count table | P | retain immutable SQL assertion; remove six ledger tests — READY |
| `apps/runtime/native-runner-gateway.mjs` | test/native-runner-gateway.test.mjs; test/snapshot-mount.test.mjs (retained direct mount) | S | DELETE — READY |
| `apps/runtime/pinned-native-transport.mjs` | runner-poststart-cli.mjs; native-authority/test/router-tls-fixture.mjs; its test | R | RETAIN — named dependency |
| `apps/runtime/runner-poststart-cli.mjs` | test/runner-poststart-cli.test.mjs; test/runner-workspace-startup.test.mjs | R | RETAIN — named dependency |
| `apps/runtime/temporal-authorization.mjs` | test/temporal-authorization.test.mjs; test/types.ts issuer-only block | T | DELETE — READY |
| `apps/runtime/test/native-runner-gateway.test.mjs` | obsolete-only test discovery; see test-count table | S | DELETE — READY |
| `apps/runtime/test/pinned-native-transport.test.mjs` | obsolete-only test discovery; see test-count table | R | RETAIN — named dependency |
| `apps/runtime/test/snapshot-mount.test.mjs` | obsolete-only test discovery; see test-count table | S | retain three cases; remove relay — READY |
| `apps/runtime/test/temporal-authorization.test.mjs` | obsolete-only test discovery; see test-count table | T | DELETE — READY |
| `infra/product-preview/model-proxy-change-set.md` | no external executable reader | B | DELETE — READY |
| `infra/product-preview/proxy-image-start.sh` | test_proxy_image_start.py; no current image recipe reader | B | DELETE — READY |
| `infra/product-preview/temporal-issuer-renewal.mjs` | no executable importer; temporal-deployment.md instruction | T | DELETE — READY |
| `infra/product-preview/test_proxy_image_start.py` | obsolete-only test discovery; see test-count table | T | DELETE — READY |
| `apps/proxy/qualification/Dockerfile` | linux/assembly.test.py, .dockerignore, README.md, linux/README.md | P | DELETE — READY |
| `apps/proxy/qualification/.dockerignore` | Dockerfile, README.md | P | DELETE — READY |
| `apps/proxy/qualification/.gitignore` | README.md | P | DELETE — READY |
| `apps/proxy/qualification/README.md` | Dockerfile, .dockerignore, linux/README.md | P | DELETE — READY |
| `apps/proxy/qualification/component-pins.json` | Dockerfile, .dockerignore, README.md | P | DELETE — READY |
| `apps/proxy/qualification/package.json` | scripts/qualification/local-baseline/clean-checkout.sh LOCKS | P | DELETE — READY |
| `apps/proxy/qualification/package-lock.json` | README.md | P | DELETE — READY |
| `apps/proxy/qualification/policy.fixture.json` | test/offline-policy.test.mjs, README.md | P | DELETE — READY |
| `apps/proxy/qualification/proxy-config.json` | test/offline-policy.test.mjs, Dockerfile, .dockerignore, README.md, component-pins.json | P | DELETE — READY |
| `apps/proxy/qualification/linux/Dockerfile` | linux/assembly.test.py, Dockerfile, .dockerignore, README.md, linux/README.md | P | DELETE — READY |
| `apps/proxy/qualification/linux/README.md` | Dockerfile, .dockerignore | P | DELETE — READY |
| `apps/proxy/qualification/linux/assembly-pins.json` | linux/assembly.test.py, linux/prisma-build.py, linux/Dockerfile, linux/README.md | P | DELETE — READY |
| `apps/proxy/qualification/linux/requirements.lock` | linux/assembly.test.py, linux/Dockerfile, linux/README.md | P | DELETE — READY |
| `apps/proxy/qualification/linux/native-runtime/README.md` | Dockerfile, .dockerignore, linux/README.md | P | DELETE — READY |
| `apps/proxy/qualification/linux/postgres-fixture/README.md` | Dockerfile, .dockerignore, linux/README.md | P | DELETE — READY |
| `apps/proxy/qualification/state/dependencies.json` | qualification package only; no external executable reader | P | DELETE — READY |

## Exact caller edits and retained references

- `apps/runtime/test/types.ts`: remove only the custom issuer import and API-key refresh/rotation assertions; retain native TLS, Temporal worker and standard AgentCore SDK types.
- `scripts/qualification/local-baseline/clean-checkout.sh`: remove the deleted package from LOCKS. `suites.json`: remove only `proxy-qualification` and `gateway-model-proxy`, the two now-empty obsolete suites. No current suite is narrowed.
- `scripts/scope-ledger/ownership-graph.json`: remove only the two deleted proxy state module paths. `owner-exclusion.json`: remove only the deleted counter-test path. Historical generated ledgers remain historical.
- `infra/product-preview/temporal-deployment.md`: replace the obsolete renewal instruction with the existing native TLS owner. `temporal-linux-qualification.md` and `OWNER-INTERFACE-CLOSURE-20261016.md` explicitly label their obsolete issuer/owner instructions historical while preserving original text.
- Qualification SQL `0001_qualification_state.sql`, `0002_tool_budget.sql`, `0003_tool_invocations.sql` stays byte-for-byte, as do all applied owner-read/issuer SQL and their migration/ACL regressions. Active local-action/task-lookup/gateway fixture references point only at these retained SQL files.
- Dated assembled-image candidate manifests and `source-manifest.json` are immutable source-hash evidence, not current recipe readers. Budget frozen-protection evidence and docs history remain. `native-client.mjs` retains its old gateway comment/error classification in a frozen current owner; no active import of the deleted gateway remains. Do not infer authorization to remove that owner or its unknown-outcome handling.
- `apps/proxy/product/runtime-packages/.gitattributes` is not executable and was not allocated. No current owner/proxy product executable source exists there at this base. Missing earlier owner/issuer files were not recreated.

## Ordered Release deletion rows — all BLOCKED

Release confirmed that `release-20261025/private/assembly7eee` contains app/foundation/private-edge readbacks and that `assembly7eee/all-label-references` plus `assembly51b0/all-label-references` contain scoped material-reference snapshots. They do **not** establish comprehensive retirement clearance or rollback closure. Existing public receipts are `FINAL-DEPLOYMENT-DELTA.txt`, `LIVE-ROLLOUT-HANDOFF.txt` and `RELEASE-PREPARATION.txt`. Exact private identities remain there; public role rows below are search candidates, not existence claims. As of this audit each current count/reference is UNKNOWN, live absence NOT RUN.

| Order / resource role | Fresh dependency and rollback proof required | Action through existing Release owner; retained evidence and failure action | Disposition |
|---|---|---|---|
| 0 / replacement and old-hosting rollback | Root plus independent reviewer accept this exact list; authenticated T3–T6/H1/H2, Stop/physical settlement, exact restore, revocation, retained credential rotation and routine outcomes; separately proven AgentCore-compatible forward recovery. | Record explicit bounded old-hosting rollback closure before destructive retirement. UI success alone is insufficient. Missing evidence leaves old resources intact. | BLOCKED — Root acceptance and Release rollback owners |
| 1 / owner service | Fresh desired/running/pending tasks, deployment/task revisions, stack and discovery refs; retained rollback reader. | Under verified account/region and preview deploy lock, review existing stack change set; drain/stop only this obsolete role after order 0. Preserve image/config and scrubbed receipts. Stop if a retained caller appears. | BLOCKED — Release fresh readback |
| 1 / proxy service | Same service/task/stack proof; direct SDK path and no retained traffic. | Same ordered stack retirement; verify stopped/absent and retained control/Runtime health. Failure uses reviewed compatible forward recovery. | BLOCKED — Release fresh readback |
| 1 / custom issuer service | Current token/certificate readers, schedules/rules, native Temporal replacement acceptance, rollback dependency. | Remove obsolete issuer producers/triggers only after native authentication acceptance; retain current Temporal server, namespace, worker, scheduler and credential rotation. | BLOCKED — Release fresh readback |
| 2 / owner task-definition family | No service, task, scheduled target, rollback image/config or retained operator references. | Deregister only verified obsolete revisions via existing lifecycle owner after drain; preserve immutable receipts. Recheck if a new consumer appears. | BLOCKED — Release |
| 2 / proxy task-definition family | Same family-specific current references. | Same targeted deregistration; no historical IDs used as targets. | BLOCKED — Release |
| 2 / issuer task-definition family and renewal schedules | Current ECS/scheduler/EventBridge targets, task refs and stopped producer proof. | Remove reviewed obsolete targets then revisions; retained routine schedules stay. Unknown target blocks deletion. | BLOCKED — Release |
| 3 / owner task and execution IAM roles/grants | Current policies, trust, task/stack/service references and shared readers. | Remove only obsolete role-specific statements/resources after task retirement; keep shared policies and canonical authorization. A shared reader means RETAIN. | BLOCKED — Release |
| 3 / proxy task and execution IAM roles/grants | Same plus old model invocation/count permissions and any shared role. | Remove obsolete role grants; preserve narrow current Runtime Bedrock IAM and current gateway/Core access. | BLOCKED — Release |
| 3 / issuer task and execution IAM roles/grants | Signing, token-delivery, task and secret-reader dependencies. | Remove only obsolete grants after no producer/consumer remains; preserve standard remaining-secret rotation. | BLOCKED — Release |
| 4 / pair PKI secret material | All current/inactive task, service, stack, IAM and bounded rollback readers; retention/version policy. | Retire only confirmed obsolete versions/labels using existing policy; do not erase retained evidence or current private-control/Temporal CAs. Unknown reader means RETAIN. | BLOCKED — Release |
| 4 / issuer tokens, material and signing keys | Actual readers, decrypt/sign dependencies, schedules, retention and irreversible key-loss consequences. | Explicitly record consequences before eligible deletion; keys/versions are not disposable because a service stopped. Current control, Core, Temporal and Clerk secrets remain. | BLOCKED — Release |
| 5 / obsolete pair/issuer SG and ALB rules | ENIs, shared groups, targets/listeners, discovery, stack ownership and current control private edge. | Remove only exact unused role-specific rules/groups and discovery entries. Preserve currently used private edge and all retained traffic; any shared dependency blocks. | BLOCKED — Release |
| 6 / obsolete role alarms, metric filters, log groups and image-kit artifacts | Current metric/log readers, required retention, image rollback readers and approved artifact policy. | Remove obsolete alarms/filters and eligible kit artifacts only. Retain required logs/history; verify actual absence and retained-service health in PROCESS6.3. Never prune by age/stopped status alone. | BLOCKED — Release |

No AWS command, live resource deletion, image build, migration, DB drop, retention change or rollback closure was executed by the author. No alternate script is needed: current `first-chat/ship-packet.mjs` already requires replacement acceptance, accounts for keys/logs/versions and requires independently proven AgentCore forward recovery after old hosting retirement. Its cleanup/rollback clauses were read and left unchanged. Root forwards only the independently reviewed concrete list; Release generates commands from fresh topology and records source/image/revision/UTC, exact results, irreversible consequences and absence.

## Checks and test-count change

Node v24.22.1 on Windows; existing exact-base dependencies are borrowed through task-owned junctions, never installed over a donor. No shared DB/container/service is touched. Synthetic TLS fixtures are cleaned by existing tests. Logs and temporary scripts remain in the author chat `work`; no private release material was copied.

| Check / command | Base result (UTC) | Head working-tree result (UTC) |
|---|---|---|
| `node --test --test-concurrency=1 apps/runtime/test/agentcore-candidate.test.mjs apps/runtime/test/agentcore-execution.test.mjs apps/runtime/test/agentcore-routine-composition.test.mjs` | PASS 71/71, 17:36:26 | Included in PASS 81/81, 17:39:51 |
| Above plus `apps/runtime/test/temporal-tls.test.mjs apps/runtime/test/snapshot-mount.test.mjs apps/worker/conversation/test/options-trust.test.mjs` (`MERI_TEST_OPENSSL` selects existing Git OpenSSL) | Native TLS and SDK options pass; snapshot has two inherited `INVALID_COMMAND` failures because required execution port is absent, 17:37:29 | PASS 81/81 total, no skips, 17:39:51; all three snapshot cases retained |
| `MERI_REVIEW_SOURCE_ROOT=<checkout> node --test --test-concurrency=1 apps/gateway/budget/product-model-budget.test.mjs apps/gateway/budget/product-model-settlement.test.mjs` | PASS 22/22, 17:42:36 | PASS 22/22, 17:42:36 |
| `npm run typecheck --prefix apps/runtime` | PASS, 17:32:59 | PASS, 17:40:14 |
| `python -B -m unittest apps.proxy.qualification.test.test_tool_budget_source` | Original Python harness not executed; existing three SQL assertions read before extraction | PASS 1 retained test / three unchanged SQL assertions, 17:40:14 |
| `MERI_REVIEW_SOURCE_ROOT=<checkout> node --test --test-concurrency=1 infra/product-preview/first-chat-database.test.mjs infra/product-preview/agentcore-runtime.test.mjs infra/product-preview/temporal-deployment.test.mjs infra/product-preview/first-chat/render-material.test.mjs infra/product-preview/first-chat/ship-packet.test.mjs` | 70 PASS / 12 FAIL / 0 skips, 17:34:41 | Same 70/12/0, same failure names, 17:40:07 |
| `node --test --test-concurrency=1 scripts/qualification/local-baseline/clean-checkout.test.mjs scripts/qualification/local-baseline/inventory.test.mjs scripts/scope-ledger/ledger.test.mjs` | 4 PASS / 5 FAIL / 0 skips, 17:41:01 | Same 4/5/0, 17:40:14. Final direct inventory read has no empty suite/stale cover/stale exclusion; same four uncovered files remain. |
| Snapshot credential-forwarding mutant in existing `sdk-session-http.mjs` | N/A | KILLED 17:41:28: foreign credential incorrectly becomes success (200 vs 403). Restored byte-for-byte; no production owner delta. |

Infra failures are inherited: one archived render-input case; ten ship-packet cases (stale migration expectations and archived current input refusal); one archived Temporal CA hash mismatch. Caller failures are inherited Windows bash exit/path handling (three), four already-uncovered test files (one assertion), and already-missing native-read observation source (one module load). Root environment/current-owner lanes own these pre-existing failures. `options-capabilities.test.mjs` was also attempted at base: two Windows workspace-root failures remain unrelated; no feature assertion was weakened. Initial missing package links and unset source-root attempts are preserved in logs; after correct dependency/source-root setup the checks above passed. No unavailable check is counted as a pass.

Deleted tests: 25 whole test files with 428 static test declarations, plus six obsolete Python ledger test methods from the retained SQL file. Static declarations are **not** a claimed executed-case count (parameterized/nested cases differ). The three snapshot cases remain; zero new test cases are added. The only repaired fixture is the existing missing execution port. The meaningful snapshot mutant above qualifies that retained boundary; mutation for simple deletion/type-assertion removal is N/A.

| Deleted test path | Static declarations |
|---|---|
| `apps/gateway/model-proxy/product-boundary-codec.test.mjs` | 5 |
| `apps/gateway/model-proxy/product-envelope.test.mjs` | 3 |
| `apps/gateway/model-proxy/product-request-owner.test.mjs` | 5 |
| `apps/gateway/model-proxy/product-reservation-bridge.test.mjs` | 4 |
| `apps/gateway/model-proxy/product-settlement-bridge.test.mjs` | 6 |
| `apps/proxy/qualification/assembly/test_fixture_compatibility.py` | 6 |
| `apps/proxy/qualification/assembly/test_host_address.py` | 4 |
| `apps/proxy/qualification/assembly/test_lifecycle.py` | 11 |
| `apps/proxy/qualification/linux/assembly.test.py` | 26 |
| `apps/proxy/qualification/linux/native-runtime/test_native_auth_config.py` | 32 |
| `apps/proxy/qualification/linux/postgres-fixture/test_fixture.py` | 27 |
| `apps/proxy/qualification/linux/postgres-fixture/test_native_bootstrap.py` | 13 |
| `apps/proxy/qualification/linux/postgres-fixture/test_native_output_capture.py` | 17 |
| `apps/proxy/qualification/linux/postgres-fixture/test_prisma_error_evidence.py` | 84 |
| `apps/proxy/qualification/test/offline-policy.test.mjs` | 29 |
| `apps/proxy/qualification/test/test_aws_counter.py` | 11 |
| `apps/proxy/qualification/test/test_bedrock_transport.py` | 31 |
| `apps/proxy/qualification/test/test_ingress.py` | 27 |
| `apps/proxy/qualification/test/test_lifetime.py` | 14 |
| `apps/proxy/qualification/test/test_native_usage.py` | 18 |
| `apps/proxy/qualification/test/test_postgres_state.py` | 23 |
| `apps/proxy/qualification/test/test_server.py` | 11 |
| `apps/runtime/test/native-runner-gateway.test.mjs` | 10 |
| `apps/runtime/test/temporal-authorization.test.mjs` | 8 |
| `infra/product-preview/test_proxy_image_start.py` | 3 |

NOT RUN: live Bedrock/model turns, authenticated preview data/tenant/client/wall tests, native Linux/ARM image qualification, native PostgreSQL transaction tests, full Temporal server/credential rotation, build/scan/deploy, AWS dependency/absence and old-hosting rollback closure. Existing fixtures prove composed source behavior, not those live outcomes. No infra synthesis implementation changed; the focused existing infra checks above are the affected local coverage.

## Before/after search proof

The base import scan showed only the deleted proxy-internal chain, old tests/type assertions, two suite/one install entries and two historical scope-ledger source rows. The exact file list above is the deletion set. An after-scan of all surviving tracked JS/TS relative imports in apps/infra/scripts/packages resolves **zero imports to the 81 deleted paths**. Before/after search logs and per-file static counts are retained in the author `work` directory.

```sh
git grep -n -E "product-boundary-codec|product-request-owner|product-reservation-bridge|product-settlement-bridge|temporal-authorization|temporal-issuer-renewal|proxy-image-start" -- apps infra packages scripts ":!*.md" ":!apps/gateway/budget/evidence/**" ":!scripts/qualification/assembled-image/*.json"
# exit 1: no executable/config caller remains for these deleted mechanisms
git grep -n -E "apps/proxy/qualification|native-runner-gateway" -- apps infra packages scripts ":!*.md" ":!apps/gateway/budget/evidence/**" ":!scripts/qualification/assembled-image/*.json"
# remaining: retained SQL readers/assertion and the frozen native-client historical error comment only
git diff --name-only 7eee7f7c358be9ae903169816ef68eb6e64ae1f3 -- "*.sql" apps/runtime/native-authority apps/control/conversations apps/gateway/sources packages/contracts infra/product-preview/first-chat-private-edge.mjs
# empty: protected owners and migration history unchanged
git diff --check
# clean
```

No active issuer/proxy env/config reader is removed from a current app schema in this patch; those current render paths already refuse retired material. Deleted package-local recipes and obsolete tests disappear with their source. The old rollback material/images are retained by Release, not made current by these docs. Author completion is source plus this reviewable plan; independent PROCESS6.2, Root list review, authenticated replacement acceptance and Release PROCESS6.3 remain separate gates.
