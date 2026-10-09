# W02-02 trusted model proxy qualification (PREPARATION ONLY)

Status: preparation-only recipe, configuration and offline policy reference. This
package does **not** implement the product broker, invoke a model, deploy a proxy,
run migrations or pass G1. Nothing here is an accepted runtime.

## Scope

Prepare a small upstream-adopted proxy recipe/configuration and deterministic
offline security/budget checks for later independent qualification, on the
allocated base `08b5c33d6b53a3758ed6c1835d6e55825939c0cb`.

- Upstream: LiteLLM `1.104.2`, source commit `fc3920bf403124ad075bc04990f999f7e0612e12`.
- Client model alias `meri-sonnet-qualification` -> `bedrock/invoke/us.anthropic.claude-sonnet-4-6`, `aws_region_name: us-east-1` (normalized AWS model ID `us.anthropic.claude-sonnet-4-6`).
- Route: Anthropic `POST /v1/messages`. No Converse/Mantle/platform route, no global profile, no client model_id/api_base/credential override, no fallback/passthrough/embeddings/proxy-MCP/UI/management ingress.
- Budget: one non-resetting qualification team `max_budget=10`; authoritative ceiling is safe integer `10000000` microUSD.

## Layout

| Path | Role |
| --- | --- |
| `package.json` / `package-lock.json` | private ESM package; `test` (Node test runner) and `check` scripts; no dependencies |
| `.gitignore` / `.dockerignore` | owned `.runtime/` scratch ignored before downloads; restrictive image context |
| `Dockerfile` | recipe pinning the verified upstream **index digest**; NOT built (no Docker daemon) |
| `component-pins.json` | exact versions, hashes, digests, license paths and known gaps |
| `proxy-config.json` | minimal LiteLLM config (JSON accepted as a YAML subset by `yaml.safe_load`) |
| `policy.fixture.json` | synthetic keys/identity/binding/pricing (NOT real, NOT current Bedrock prices) |
| `offline-policy.mjs` | pure offline admission/budget **test reference** |
| `test/offline-policy.test.mjs` | deterministic offline tests (no socket/AWS/model/proxy/DB) |

## What is genuinely established

- LiteLLM `1.104.2` wheel and sdist SHA-256 match the recorded upstream metadata exactly; package `License-Expression: MIT` (content outside `enterprise/`; no enterprise feature adopted).
- The `ghcr.io/berriai/litellm:v1.104.2` tag resolves to index digest `sha256:3d88bd75...`; the linux/amd64 config's OCI revision label equals the pinned source commit. The image's default user is `root`.
- The config loader uses `yaml.safe_load`, so `proxy-config.json` is a valid config document; the settings used here exist in this release.

## What is NOT established (blocks later live use)

- No image was built; `assembledImageDigest` is null. No signature (cosign) verification was performed.
- Non-root / read-only-root-filesystem suitability of the upstream image is **NOT VERIFIED** (image default user is root). No `USER` override is applied, because the upstream entrypoint may require root; live isolated verification is required.
- No proxy/Postgres/Redis server was started; no migration was run; no database/master/salt value is invented (runtime `os.environ/...` references only).
- `litellm_settings.callbacks` is deliberately **empty**: the future trusted admission `CustomLogger` instance (proposed registration point for broker admission) is a later bounded ticket. Naming a non-existent handler would break startup.
- Actual SDK 0.3.295 / CLI 2.1.295 Anthropic Messages header/feature/tool/stream/cancel/resume behaviour, binary-to-SSE translation, usage/cache accounting and retry/no-retry behaviour remain unrun.
- The offline policy reference is a **test fixture, not a deployed auth service or a replacement for LiteLLM's auth engine**. It opens no socket and proves nothing about real authentication.

## Offline policy reference

`offline-policy.mjs` models only the application invariants LiteLLM does not
supply, and is labelled a test reference:

- **Admission**: denies absent/unknown/expired/revoked keys, missing or untrusted
  caller identity (trusted identity must come from an authenticated broker
  observation, never caller headers), tenant/actor/conversation/run mismatch,
  stale attempt/worker/fence/policy revision, inactive/cancelled run, alternate
  model/route variants and state lookup failure. A stolen key plus forged binding
  headers cannot authorize a different task; a replaced worker needs a newly
  issued key after the authoritative fence update.
- **Feature admission**: freezes a text + ordinary local `tool_use`/`tool_result`
  subset and rejects unknown betas, context-management, structured-output, speed,
  container, server-tool, proxy-MCP, credential/routing overrides and unapproved
  helper models *before* translation (the Bedrock adapter would otherwise drop
  them silently).
- **Budget**: safe integer microUSD; reserves worst-case cost before dispatch;
  denies unknown/nonpositive estimates, missing output bounds, oversize
  input/output, duplicate request IDs, stale pricing and any reservation that
  would cross the ceiling. Ambiguous outcomes (missing usage, HTTP200 error,
  process loss, TTL expiry) keep a retained worst-case hold instead of releasing
  it; only an explicit pre-dispatch rejection releases cleanly. Budget resets are
  refused.
- **Streams**: only a valid `message_start ... message_stop` sequence with usage
  is a success; semantic failures stay visible and never mark success, execute a
  partial tool command, refund unknown spend or trigger a retry.

## Checks

Run from the worktree root:

```
npm run check
npm --prefix apps/proxy/qualification test
git diff --check
```

Nested tests are fully offline (synthetic keys/identity/events/pricing only).

## Next bounded follow-up

Codex-owned and separate: image build + signature/non-root/read-only verification;
Postgres/Redis topology and least privilege; headless virtual-key
issuance/revocation/cache-failure behaviour; authenticated task-to-grant binding,
current-run/fence checks and quiet-stream cancellation; native strict shared-team
reservation under concurrency plus a durable broker unknown-charge hold; real SDK
Messages header/feature/tool/stream/cancel/resume and no-retry behaviour; trusted
proxy-only Bedrock role with exact ARNs. G1 remains incomplete; W03 promotion and
cutover are blocked.
