# wave5 upload — custody-mediated fixed native inspection (AgentCore inspection purpose)

Author session `20261028_013136_549ef2` (configured default). Implemented, tested, frozen.
Companion (orchestrator outputs, outside this repo):
`outputs/WAVE5-UPLOAD-AGENTCORE-INSPECTION-HANDOFF.txt`. No prior output was replaced or edited.

Branch `codex/wave5-upload-agentcore-inspection-20261028`, created from the exact pin
`95a55bbd266b9dc0a8c95bf1eb774c3fdc283a83` / tree `21e4f5c15e4ca4f51050221b02f6b4c897c06d2c` with
`git worktree add --no-checkout` + cone sparse-checkout (`apps packages infra scripts`) + `git read-tree -mu HEAD`.
Nothing in this or any other checkout was cleaned, repaired, removed or read-tree'd over.

## Commits

| commit | subject |
| --- | --- |
| `814d96a8b311e8cf1436bbb7c49a5f2512393acd` | imported accepted parser (cherry-pick `-x 7c7257b4…`, the same 5 paths) |
| `5348a0f0dd45ec2a04f64b0cec5f2962b8462181` | tree `25c65719fd1bf86fb1db0471deb2a7a8ccf98e69` — this slice's source, 9 files, +705/−5 |

Per-command identity `Codex <codex@openai.com>`. The single amend changed only
`apps/runtime/uploads/test/agentcore-client.test.mjs`.

## Files

New: `apps/runtime/uploads/agentcore-contract.mjs`, `apps/runtime/uploads/agentcore-client.mjs`,
`apps/runtime/uploads/agentcore-http.mjs`, and their focused tests plus `test/agentcore-fixture.mjs`.
Narrow spans only: `apps/runtime/agentcore-http.mjs` (third purpose on the existing purpose lock),
`apps/runtime/agentcore-entrypoint.mjs` (construction).

Nothing else was touched — not the renderer or its wire bounds, not the parser/native-sandbox/composition/definition
owners (the accepted parser was imported unchanged), not `apps/control/uploads/*`, not `packages/**`, `infra/**`,
`scripts/**`, public input/schema/generator/npm/lockfile/catalog/migration.

## What it does

The purpose is derived only from the server-selected session `meri-inspect-<64 hex>` and never from a request body, so
a request can name no runtime, session, image, tool or program, and a second differing purpose is refused. The original
is bound to the existing upload bound (10 MiB) plus exactly its base64 envelope; the response is bounded by the
extractor's own output. Receipts are re-checked by the existing `validateUploadInspection` gate, the declared image
digest can never be reported as observed, unknown dispatch outcomes are never retried, an unavailable or failed fixed
owner is never reported clean or extracted, and the owned session is always stopped with a failed cleanup surfaced.
The AWS SDK is imported lazily so its absence is an honest transport fault rather than a module-load failure of
unrelated products.

## Verification (Node 24.22.1)

```
node --test apps/runtime/uploads/test/agentcore-contract.test.mjs \
           apps/runtime/uploads/test/agentcore-http.test.mjs \
           apps/runtime/uploads/test/agentcore-client.test.mjs
=> tests 21, pass 20, fail 0, skipped 1

node --test apps/runtime/test/agentcore-*.test.mjs apps/runtime/uploads/test/*.test.mjs \
           apps/runtime/product-ports/test/*.test.mjs apps/runtime/test/control-product-factory.test.mjs
=> tests 321, pass 316, fail 5 (three pre-existing files: agentcore-cli-composition,
   agentcore-entrypoint-diagnostics, agentcore-query)
```

A/B in the same tree with the base versions of both edited files restored: `209/200/9` vs `209/205/4`, identical
failing-file set, the five extra passes being this slice's own purpose-locked tests (they need the new branch). No
regression; files restored byte-identically.

Not run: broad suite, typecheck, build, container build, deployment, any live endpoint, Playwright/visual (no pixel
change), Promptfoo/DeepEval (no Meri prompt/retrieval/tool/routing change), AWS CLI, browser, provider, model.

## Real remaining limits

1. **No container-side host composition owner** — the entrypoint passes `inspection: null`, so the purpose honestly
   serves 503. The exact join is one bounded call, on the container's own startup path, to the existing owner CONTROL
   already uses (`composeUploadNativeHost` / the serialized signed-definition provisioning owner). It must not be
   resolved per request: a one-use session cannot cold-provision a definition snapshot inside an ordinary request
   budget, and no deadline was extended, no daemon/cache/privilege added and no scan manufactured.
2. **CONTROL-side transport selection not wired** — `mountUploadNativeControl` still composes the in-process owner.
   The swap is signature-identical (one line plus a closed selector), left out because it also chooses custody's
   inspection owner, which is not this slice's span.
3. Declared vs observed image is still unqualified, and endpoint drift remains the runtime/image owner's join.
4. `@aws-sdk/client-bedrock-agentcore` is absent from the named read-only dependency source; it exists only in the
   per-app runtime tree the frozen base itself junctions to. Nothing was installed.

## Honest note

One focused check, before it was guarded, exercised the production transport once the SDK became resolvable and sent a
single authenticated HTTPS `InvokeAgentRuntime` request to the AgentCore endpoint with a synthetic placeholder ARN and
a synthetic 41-byte payload (no tenant, customer or real upload data). The check now runs only where the SDK is
genuinely unresolvable, and is otherwise skipped — so on this host it is **skipped, not passed**. This is the only
outbound call this slice made; it is recorded rather than hidden.
