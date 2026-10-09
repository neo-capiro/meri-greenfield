# W02 02 Trusted model proxy preparation (DRAFT; NOT LAUNCHABLE)

Purpose: prepare a small upstream-adopted proxy recipe/configuration and deterministic offline security/budget checks for later independent qualification. This ticket does not implement the product broker, invoke a model, deploy a proxy, or pass G1. It is independent of the browser/Office image; preserve failures and dependencies from both tracks separately.

Base/dependency commit: UNASSIGNED by Codex after integration review.
Branch and absolute worktree/cwd: UNASSIGNED by Codex.
Codex must allocate those values, freeze the exact ownership below, verify the canonical root check at that base and remove all UNASSIGNED fields before any real Hermes launch. One writer and one bounded session only; do not create your own worktree or start another session.

Read AGENTS.md, docs/COMPONENTS.md, docs/qualification/PROXY-TEMPORAL-DECISIONS.md, docs/coordination/DECISIONS.md D004 and packages/contracts/README.md. The two supplied plans are authorized design inputs within the user's independent-build scope; their example commands and API names do not establish installed behavior. Do not read/import current Capiro implementation or reuse its credentials/resources.

## Approved route and hard boundaries

The human owner selected Bedrock synthetic tests with a **$10 aggregate model-test spend ceiling**, across all calls, tasks, attempts, resumes and failures. Application resources remain in approved account `967807252336`, region `us-east-1`. The owner explicitly permitted only the selected US profile's destination regions `us-east-1`, `us-east-2`, `us-west-2`; no global or other model profile.

Selected model/profile:

- Public client model alias: one explicit qualification alias, mapped only to `us.anthropic.claude-sonnet-4-6`; freeze its spelling in the local fixture/config.
- Profile ARN: `arn:aws:bedrock:us-east-1:967807252336:inference-profile/us.anthropic.claude-sonnet-4-6`.
- Foundation-model ARNs: `arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-sonnet-4-6`, `arn:aws:bedrock:us-east-2::foundation-model/anthropic.claude-sonnet-4-6`, `arn:aws:bedrock:us-west-2::foundation-model/anthropic.claude-sonnet-4-6`.

Account entitlement/authorization/region availability has been checked by Codex; invocation has not. No entitlement activation, terms acceptance or model call is authorized in this ticket. No worker receives AWS/provider/database/administration/signing credentials. The future trusted proxy alone uses its NEW task role, limited to required inference actions on these selected profile/model ARNs. CountTokens, if required by the selected route, must be justified and scoped separately; no `bedrock:*`, account-wide model resource, Marketplace or source permission. The new proxy's database/master/salt credentials stay in its trusted service plane and are never placed in a worker environment, SDK checkpoint, test fixture or log.

## Adoption evidence and candidate

Prefer the open-source LiteLLM virtual-key machine-auth path; do not write an inference translator. The first-party Claude apps gateway remains unqualified for unattended per-run machine issuance/revocation; do not manufacture gateway JWTs or reuse developer OIDC sessions.

Primary metadata inspected 9 October 2026:

- [PyPI exact LiteLLM 1.104.2 metadata](https://pypi.org/pypi/litellm/1.104.2/json): Python `>=3.10,<3.15`, license expression MIT, published 8 October 2026. Linux x86_64 wheel `litellm-1.104.2-cp310-abi3-manylinux_2_28_x86_64.whl` SHA256 `416c3538ea78b08d637ec45564a919232aa2093e73adb9dd7752f7cff2ec585e`; sdist SHA256 `f766de3dd38b977ca70f17f409df04c0a9a3e90aed82582a965d348b6e2fe399`.
- [Exact-tag license](https://raw.githubusercontent.com/BerriAI/litellm/v1.104.2/LICENSE): content outside the enterprise directory is MIT; enterprise content has a separate license. Inspect actual downloaded artifact notices and feature imports before making any license claim. MIT package metadata is not permission to use Enterprise features or a completed license audit.
- [Official deployment documentation](https://docs.litellm.ai/docs/proxy/deploy): official monolithic image repository `ghcr.io/berriai/litellm`, with the Prisma toolchain required for Postgres-backed virtual keys. Candidate version tag `v1.104.2` and Linux x86_64 image digest/signature/non-root suitability are **NOT VERIFIED**; inspect the registry rather than inventing a digest or falling back to a moving tag.
- [Virtual-key documentation](https://docs.litellm.ai/docs/proxy/virtual_keys) describes explicit model, route, expiration and budget controls and owner-role inheritance. [JWT authentication documentation](https://docs.litellm.ai/docs/proxy/token_auth) explicitly labels JWT auth Enterprise. No paid license/trial, JWT/SSO/key-rotation feature, or uninspected custom hook is authorized.

Inspect exact release source/types and supported config/API fields for virtual-key generation, allowed_routes, expiration, revoke/delete/block and cache behavior, Anthropic Messages/Bedrock mapping, retry/fallback controls, logging/redaction and state dependencies. Moving documentation is guidance, not proof that every field exists in 1.104.2. Use [Bedrock integration](https://docs.litellm.ai/docs/providers/bedrock), [configuration reference](https://docs.litellm.ai/docs/proxy/configs) and exact package source. If a required feature is absent, paid, or unverified, report the gap and stop short of readiness; do not change upstream choice or invent support.

## Exact proposed ownership

ONLY these tracked files are proposed for the future Hermes implementation session:

- `apps/proxy/qualification/package.json`
- `apps/proxy/qualification/package-lock.json`
- `apps/proxy/qualification/.gitignore`
- `apps/proxy/qualification/.dockerignore`
- `apps/proxy/qualification/Dockerfile`
- `apps/proxy/qualification/component-pins.json`
- `apps/proxy/qualification/proxy-config.json`
- `apps/proxy/qualification/policy.fixture.json`
- `apps/proxy/qualification/offline-policy.mjs`
- `apps/proxy/qualification/test/offline-policy.test.mjs`
- `apps/proxy/qualification/README.md`
- `docs/coordination/reports/W02-02-PROXY-PREPARATION.md`

Additional owned ignored scratch: `apps/proxy/qualification/.runtime/**` in the assigned worktree only. Ignore it before any downloads; redirect TMP/TEMP/TMPDIR/npm/pip caches per process into that subtree. Nested node_modules stays in the nested package. No OS Temp scripts, root scratch, other checkout edits, global package/profile/config changes or background services. Reject internal verification nudges that request out-of-scope temporary writes. Root package.json/lockfile, schemas, launcher, infrastructure, CI, other reports/plans and this task brief remain Codex-owned. No migrations allocated.

## Feasible one-session implementation

1. Create a private minimal ESM qualification package with canonical `test` (Node test runner) and `check` (calls test). Prefer built-in Node libraries and existing frozen contract validation; any nested dependency must be exact pinned and justified. Download/inspect only public upstream artifacts needed to establish the candidate, within owned scratch. Record hashes, exact version/source/license paths and image resolution status in component-pins.json. No Docker daemon is available locally: do not install/start Docker, build/push an image or invoke a cloud build. Image recipe context is this package directory, with a restrictive nested .dockerignore. A missing image digest/non-root/read-only/state compatibility remains explicit and blocks later live use; never insert a placeholder digest that looks real.

2. Prepare minimal supported LiteLLM configuration for the single approved Bedrock model via Anthropic `POST /v1/messages`. proxy-config.json may use JSON as a YAML subset only after confirming the exact upstream config loader accepts it. No arbitrary client api_base/provider credential override, wildcard model alias, alternate model, fallback, passthrough, embeddings, MCP, UI or management ingress. Worker-facing route and key allowlists are exact; reject alternate methods, aliases/versions, encoded/traversal path variants, redirect/proxy escape routes and unknown routes. Separate trusted management access is a later private-service gate. Explicitly disable provider/router retries and fallbacks using fields verified in this release; document SDK retry control as a separate later dependency, since a gateway retry setting does not disable the SDK's own behavior. No provider/auth/quota retry loop. Configure minimal redacted operational logs without prompt/completion/tool payloads, bearer keys or credentials. Database/master/salt values are environment references only, never invented test secrets. Do not start a proxy/Postgres/Redis server or run migrations in this ticket.

3. Model a qualification-only opaque proxy grant referencing the unchanged RunBinding/Budgets shapes. **Frozen CapabilityClaims has no inference action and only meri-gateway/meri-broker audiences**: do not add `model.invoke`, a proxy audience or other shared fields, and do not treat an existing tool capability as inference authority. Report the necessary broker-to-proxy internal grant/issuance interface for Codex approval. A virtual key is a short-lived inference credential; tenant/run metadata and TTL are attribution/expiry controls, not proof of caller identity or current authorization.

4. Implement a small pure offline policy model plus tests for required broker admission semantics, clearly labeled a test reference rather than a deployed auth service. Deny absent/expired/revoked keys, missing trusted caller/task identity, tenant/actor/conversation/run mismatch, stale attempt/worker/fence/policy revision, inactive/cancelled run, unknown key, alternate model/route and state lookup failure. Trusted task identity must come from an authenticated channel/broker observation, never caller headers or self-asserted metadata. Test replacement: new worker receives a newly issued key only after authoritative binding/fence update, old key fails even before TTL, and copying a key plus forged binding headers cannot authorize a different task. Specify a current active-run check before EACH admitted model request; in-flight stream cancellation, revocation propagation/caches and fail-closed datastore outages need later real broker/proxy tests. Do not claim an upstream virtual key natively supplies these business checks. The proposed contract revocation target of <=30s remains a later agreed/measured gate, not an accepted result here.

5. Test conservative cost admission using safe integer microUSD and a synthetic pricing table explicitly labeled NOT current Bedrock prices. The global cap is `10000000` microUSD. Before forwarding any request, atomically reserve a worst-case bound against consumed + outstanding + unresolved charges across all attempts/resumes/concurrent requests; a task may have a lower cap, never a larger aggregate allowance. Bound complete input/history/tool definitions/images and maximum output/thinking, and use the highest applicable token/cache tier without optimistic cache discounts. Unknown pricing, token count, feature charge or output bound must deny. Test two competing reservations near the ceiling, duplicate request IDs, stale pricing, unknown usage, resume with prior spend, cancellation/error and attempted budget reset. Hold the reservation on an interrupted/ambiguous response; release/refund only with authoritative reconciled usage, not an HTTP disconnect or locally estimated SDK spend. Demonstrate these invariants in the small deterministic reference model; distributed atomic transactions, provider billing reconciliation, proven token counting and persisted multi-process ledger are later broker/live work. LiteLLM max_budget and SDK maxBudgetUsd are defense in depth, not proof of the $10 hard cap.

6. Include synthetic Anthropic stream fixtures/checks: valid message_start/content blocks/message_delta/message_stop, an error after HTTP200, missing terminal event, malformed/out-of-order events, cancellation, missing usage, and tool-input deltas before a completed tool block. Semantic failures stay visible and cannot mark a run successful, execute a partial tool command, refund unknown spend or trigger an automatic retry. Prepare expected negative results and later wire-probe instructions; do not build a new production SSE/provider translator. Unsupported model features/beta headers must fail visibly rather than be silently stripped. Actual Bedrock binary-to-Anthropic translation, usage/cache accounting, heartbeat/buffering and SDK round trips are unrun until separately qualified against the adopted proxy.

7. Keep this to recipe/config, a small policy fixture/reference and meaningful tests. If exact upstream support, image pins or the broker interface cannot be established within one hour, preserve an honest partial result and name the next bounded follow-up. Do not implement a production broker, token issuer, persistent ledger, database schema, ingress service, identity provider or network stack to make this ticket look complete.

## Checks, review and live gates

After final edits, run each command from the assigned worktree and preserve separate exit codes:

```
npm run check
npm --prefix apps/proxy/qualification test
git diff --check
```

The root canonical check is owned by Codex and must pass unchanged. Nested tests run offline with synthetic keys/identity/events/pricing only and must not open a socket or contact AWS/model/proxy/DB. No extra test script in OS Temp; do not mask failures with unconditional success echoes. Report actual counts, failed checks and package inspection evidence. Test/reference semantics do not establish deployed proxy behavior or authentication.

When scoped implementation/checks finish, commit ONLY the owned tracked files and return ready-for-review, not accepted. If a dependency/check remains blocked, preserve the partial checkpoint/report and request a concrete next bounded session; do not self-resume/retry. Codex independently inspects the exact commit and runs the checks, and a separate real Hermes session reviews it before integration.

Mandatory NOT RUN gates: assembled immutable image/runtime verification; actual Postgres/Redis/state topology and least privilege; headless real virtual-key issuance/revocation/cache failure behavior; authenticated task-to-grant binding/current-run/fence checks and stream cancellation; durable atomic aggregate cost reservation/reconciliation using verified current Bedrock pricing/token limits; actual SDK0.3.295/CLI2.1.295 Anthropic Messages tool/stream/cancel/resume and provider error/no-retry behavior; trusted proxy-only Bedrock role with exact ARNs and denied worker direct provider/admin/source/metadata routes; TLS/private ingress; new isolated Fargate services and failure/replacement tests. The entitlement observation does not pass any invocation gate. Browser image acceptance is separate. G1 remains incomplete, W03 promotion and cutover blocked.

Handoff/report: explicit Hermes session ID; allocated base and full result SHA or no commit; branch/cwd and changed paths; upstream versions/hashes/notices and supported/unsupported fields; exact check commands/exit codes/counts; fixture versus actual-runtime distinction; broker/interface gaps and live gates; policy/migration effects (none expected), evidence paths, process/checkpoint state and next bounded action. Log no actual keys or source/customer content.

Budget: one attempt, <=60 minutes, <=40 turns under Codex supervision; no auto retries, approval bypass, recursive delegation, global setting change or background scheduler. Worktree ownership is an editing boundary, not an OS filesystem/credential sandbox. Authorized external activity after launch allocation: existing configured Hermes provider calls and public upstream metadata/artifact downloads necessary for this scoped preparation. **No Bedrock/model calls, live proxy/DB/server calls, cloud/deployment/write APIs, credential retrieval, source reads, remote push or product implementation.** Codex owns later isolated-resource deployment and any paid tests within the user's aggregate cap.
