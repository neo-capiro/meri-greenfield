# W02-02 trusted model proxy preparation — result report

Status: **ready for independent review (NOT accepted)**. Preparation-only: no
model call, proxy/DB/server start, migration, image build, deployment, credential
retrieval or product implementation occurred.

- Hermes session ID: `20261009_162217_f476e4`
- Allocated base/dependency commit: `08b5c33d6b53a3758ed6c1835d6e55825939c0cb`
- Branch / cwd: `hermes/w02-proxy` at `C:\dev\main\meri-greenfield-worktrees\w02-proxy`
- Result commit: none yet at the time of writing — this report is committed in the
  same bounded checkpoint session, so its own 40-char SHA cannot be embedded here
  without being self-referential. The resulting SHA is returned in the final CLI
  handoff and recorded on the branch head (`git log -1 --format=%H`).

## Continuation

Codex explicitly resumed this **own** session (`20261009_162217_f476e4`) for ONE
bounded checkpoint-completion session after the first session exited 0 at a turn
limit with zero remaining descendants/readers and exactly twelve allocated
uncommitted files and no result commit. That first exit was an honest turn-limit
checkpoint, not acceptance. This continuation made no code changes (no existing
check failed); it confirmed the exact twelve owned paths and unchanged protected
files, re-ran the three checks, added this note, and created one new commit (no
amend, no push). Source/config/policy findings and all NOT RUN gates above are
preserved unchanged.
- Process/checkpoint: single bounded session, one attempt, no retries, no
  delegation, no background scheduler. Owned scratch `apps/proxy/qualification/.runtime/**`
  is ignored and uncommitted.

## Changed tracked paths (exactly the twelve allocated)

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

No root `package.json`/lockfile, schema, launcher, infra, CI or other report was
touched. No migration was created (none allocated).

## Upstream versions, hashes and notices (inspected this session)

- LiteLLM `1.104.2`, source commit `fc3920bf403124ad075bc04990f999f7e0612e12`
  (tag `v1.104.2`; the published image OCI revision label equals this commit).
- Linux x86_64 wheel SHA-256 `416c3538ea78b08d637ec45564a919232aa2093e73adb9dd7752f7cff2ec585e`
  (36850695 bytes) — **matches** PyPI metadata.
- sdist SHA-256 `f766de3dd38b977ca70f17f409df04c0a9a3e90aed82582a965d348b6e2fe399`
  (19706913 bytes) — **matches** PyPI metadata.
- License: package `License-Expression: MIT`; outer `LICENSE` SHA-256
  `b170d6bf8e8835dd357e011681db028f4d51e2fb0ea892058f56e01fb39b8273` carves out
  `enterprise/`; `enterprise/LICENSE.md` SHA-256
  `a3160d1176cb556447255ca8652855486d681f8025550291828796a439e1b2f9`. No
  enterprise feature is adopted.
- Container image `ghcr.io/berriai/litellm:v1.104.2` -> index digest
  `sha256:3d88bd757134a00e8c00237b85a021ab1f6d54abb9c1df750f411dbe7256a500`;
  linux/amd64 manifest `sha256:ff11074add7b1cee63759b90eb2a9e4072763e520297761ea05a911b4a5b251d`;
  config `sha256:db4055eec62df7f5f23828795de317b1856275178688ce1735ca16e1b343044c`;
  base `wolfi-base` (Chainguard); **default user `root`**.

## Supported vs unsupported fields (this release)

Supported/verified: config loader uses `yaml.safe_load` (JSON is a valid subset);
`model_list[].litellm_params.{model,aws_region_name}`; `router_settings.{num_retries,
allowed_fails,fallbacks,context_window_fallbacks}`; `general_settings.{fail_closed_budget_enforcement,
disable_budget_reservation,database_url,master_key}`; `litellm_settings.{drop_params,callbacks}`;
`os.environ/<VAR>` secret references; `POST /v1/messages` behind `user_api_key_auth`
with `route_type anthropic_messages`; OSS `reserve_budget_for_request` /
`reconcile_budget_reservation` / `release_or_invalidate_budget_reservation`; OSS
`CustomLogger.async_pre_call_hook(self, user_api_key_dict, cache, data, call_type)`
and `async_post_call_streaming_iterator_hook(...)`.

Not adopted / Enterprise-gated: JWT/OIDC auth, per-model key `model_max_budget`,
named enterprise guardrails. Not implemented here: the admission hook instance and
broker integration (so `litellm_settings.callbacks` is intentionally empty).

## Check commands, exit codes and counts

Run from the assigned worktree:

| Command | Exit | Result |
| --- | --- | --- |
| `npm run check` (root, Codex-owned, unchanged) | 0 | 15 tests, 15 pass, 0 fail, 0 skipped |
| `npm --prefix apps/proxy/qualification test` | 0 | 21 tests, 21 pass, 0 fail, 0 skipped |
| `git diff --check` | 0 | no whitespace errors |

The nested suite opens no socket and contacts no AWS/model/proxy/DB. Nested
`check` calls `test`; no OS-Temp script is used and no unconditional success echo
masks failures.

## Fixture versus actual runtime

- `policy.fixture.json` and `offline-policy.mjs` are a **test reference** for the
  missing broker admission/budget invariants. They are not a deployed auth
  service, token issuer, ledger, broker or gateway, and their passing tests
  establish nothing about deployed proxy behaviour or authentication.
- All identity/key/token-count/price values are synthetic. Pricing is explicitly
  **NOT current Bedrock prices**.
- The `Dockerfile` was not built; `assembledImageDigest` is null. No placeholder
  digest was inserted — the digest recorded is the real, inspected upstream index.

## Broker / interface gaps and live gates

- Frozen `CapabilityClaims` has no inference action and only `meri-gateway`/
  `meri-broker` audiences. This ticket adds no `model.invoke` action, no proxy
  audience and no shared field. A broker-to-proxy internal inference grant/issuance
  interface must be proposed to Codex and approved separately.
- A virtual key is a short-lived inference credential; tenant/run metadata and TTL
  are attribution/expiry controls, not proof of caller identity or current
  authorization. Revocation target `<=30s` remains a later agreed/measured gate.
- Mandatory **NOT RUN** gates: assembled immutable image/signature/non-root/read-only
  verification; Postgres/Redis/state topology and least privilege; headless real
  virtual-key issuance/revocation/cache-failure behaviour; authenticated
  task-to-grant binding/current-run/fence checks and quiet-stream cancellation;
  native strict shared-team reservation under concurrency plus durable broker
  unknown-charge holds/reconciliation using verified current Bedrock pricing and
  token limits (cache/TTL/refund/process-loss gaps); actual SDK 0.3.295 / CLI
  2.1.295 Anthropic Messages header/feature/tool/stream/cancel/resume and
  provider error/no-retry behaviour; trusted proxy-only Bedrock role with exact
  ARNs and denied worker direct provider/admin/source/metadata routes; TLS/private
  ingress; new isolated Fargate services and failure/replacement tests. The
  entitlement observation passes no invocation gate. Browser image acceptance is
  separate. G1 remains incomplete; W03 promotion and cutover are blocked.

## Policy / migration effects

None. No migration was allocated or created. No shared contract, schema or
audience was modified.

## Evidence paths

- `apps/proxy/qualification/component-pins.json` — versions, hashes, digests,
  license paths, verified config fields, known budget/hook gaps, unresolved pins.
- `apps/proxy/qualification/proxy-config.json` — minimal config.
- `apps/proxy/qualification/offline-policy.mjs` + `test/offline-policy.test.mjs` —
  offline reference and 21 tests.
- Owned scratch `apps/proxy/qualification/.runtime/**` (ignored, uncommitted):
  downloaded wheel/sdist/LICENSE files, extracted upstream source, and captured
  ghcr token/manifest/config used for the digest findings.

## Next bounded action

Return **ready-for-review**, not accepted. Codex independently inspects the exact
commit and reruns the checks; a separate real Hermes session reviews it before
integration. Recommended next bounded session (Codex-owned, separate): image build
with signature/non-root/read-only verification, then the broker-to-proxy grant
interface, then a real isolated reservation/streaming qualification. No secret
values, keys or source/customer content are recorded in this report.
