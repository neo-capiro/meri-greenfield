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
| `policy.fixture.json` | synthetic credential registry / identity / pricing (NOT real, NOT current Bedrock prices) |
| `offline-policy.mjs` | pure offline admission/budget **test reference** |
| `test/offline-policy.test.mjs` | deterministic offline tests (no socket/AWS/model/proxy/DB) |

## What is genuinely established

- LiteLLM `1.104.2` wheel and sdist SHA-256 match the recorded upstream metadata exactly; package `License-Expression: MIT` (content outside `enterprise/`; no enterprise feature adopted).
- The `ghcr.io/berriai/litellm:v1.104.2` tag resolves to index digest `sha256:3d88bd75...`; the linux/amd64 config's OCI revision label equals the pinned source commit. The image's default user is `root`.
- The config loader uses `yaml.safe_load`, so `proxy-config.json` is a valid config document; the settings used here exist in this release, including the redaction flags.

## What is NOT established (blocks later live use)

- No image was built; `assembledImageDigest` is null. No signature (cosign) verification was performed.
- Non-root / read-only-root-filesystem suitability of the upstream image is **NOT VERIFIED** (image default user is root). No `USER` override is applied, because the upstream entrypoint may require root; live isolated verification is required.
- No proxy/Postgres/Redis server was started; no migration was run; no database/master/salt value is invented (runtime `os.environ/...` references only).
- `litellm_settings.callbacks` is deliberately **empty**: the future trusted admission `CustomLogger` instance is a later bounded ticket. Empty callbacks is **not** redaction.
- `router_settings.num_retries: 0` does **not** disable the upstream `max_retry_on_anthropic_messages_http_error` (a hardcoded `@property` returning 2, with no config/env knob; see `component-pins.json.retryLimitation`). "All provider attempts disabled" is **not** claimed. The strict classifier denies `thinking` blocks so an admitted request cannot trigger that 400 path, but an unqualified feature could still be retried upstream — a mandatory later no-retry wire test.
- Actual SDK 0.3.295 / CLI 2.1.295 Anthropic Messages header/feature/tool/stream/cancel/resume behaviour, binary-to-SSE translation, usage/cache accounting and retry/no-retry behaviour remain unrun.
- The offline policy reference is a **test fixture, not a deployed auth service or a replacement for LiteLLM's auth engine**. It opens no socket and proves nothing about real authentication.

## Offline policy reference

`offline-policy.mjs` models only the application invariants LiteLLM does not
supply, and is labelled a test reference:

- **Credential binding**: admission looks the credential ID up in a trusted
  server-side registry (`keyId -> immutable opaque grant`). The caller-supplied
  key object and HTTP headers are never the grant, and the registry keeps a
  deep-frozen snapshot rather than the caller's entry object. The grant's full `RunBinding`,
  exact model and exact nonempty `allowedRoutes` are compared to the authenticated
  broker task observation **and** the authoritative active run
  attempt/worker/fence/policy. Missing/malformed fields deny (validated with the
  frozen 0.1.0 `RunBinding` shape) instead of comparing `undefined === undefined`.
  Old keys fail before TTL; new keys authorize only after the authoritative
  fence update. `trustedIdentity.source === 'broker'` is fixture provenance only,
  not an authenticator.
- **Raw Messages classifier**: a strict parser is the only producer of the trusted
  request DTO (branded). Unknown/malformed/unsupported fields, credential/routing
  overrides, and nested server-tool/thinking/context/structured/container/MCP
  features are denied from their actual raw header/body representation, including
  nested message/system/text/tool_use/tool_result/tool-definition/tool_choice/
  metadata nodes (thinking, cache_control, routing overrides, unknown keys).
  Arbitrary JSON inside a local tool's input/input_schema is DATA and is not
  censored. The parsed DTO is deep-frozen and its provenance lives in a private
  WeakMap, so a forged copy is rejected. No silent strip or sanitize-and-pass;
  unknown bounds fail admission. Actual SDK fields/betas/cache/thinking remain
  unqualified.
- **Trusted token-count observation**: a SEPARATE trusted internal observation
  (fixture provenance), bound to the canonical hash of the classified raw request
  plus the model/pricing revision, supplies the input-token bound; wire-body token
  claims cannot. char/4 is diagnostic only and is NOT a verified worst-case bound;
  missing/mismatched/unsafe bounds deny.
- **Budget**: safe integer microUSD; worst-case reservation before dispatch;
  denies unknown/nonpositive estimates, missing output bounds, oversize
  input/output, duplicate request IDs, stale pricing and ceiling breaches. Real
  liability above the reservation bound is surfaced (`OVER_RESERVED_BOUND`) and a
  breach quarantines the ledger and denies later dispatch — never clamped or
  fabricated safe. Settlement and reconciliation compare the real actual to the
  ORIGINAL reservation AND re-check combined consumed + every remaining hold, so an
  over-bound or over-cap result quarantines the ledger and denies later dispatch.
  An unresolved hold is retained until explicit trustworthy
  `provider_reconciliation` evidence; an inconsistent later outcome cannot release
  it. Budget resets are refused; TTL/process loss keeps the hold.
- **Streams**: pure synthetic validation requiring ordered message/block
  lifecycle, unique indexes, immutable block identity/type/tool name/id, matching
  start/delta/stop, all blocks closed before the final delta/terminal, exactly one
  terminal with no events after it, and safe complete usage fields. Accumulated
  tool input must be complete valid JSON before any executable-tool assertion;
  semantic failures never mark success or expose a partial command.

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
