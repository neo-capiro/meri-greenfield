# Business-development selected-client source slice

Base: `e1845c3b0d7caa8fd3309ad96f6cb4e17f25ccce`. Native producer and authority reference: `neo-capiro/capiro-backend@b525032222515d636b0dae2d46e40c7c3d8b5528`. Source implementation only; no native, provider, credential, database or deployment actions.

## Implementation outline

- `sources/business-development/request-context.mjs` owns pure canonical request and exact single-client subject capture. Its explicit Core conversation UUID is independent of the Meri run conversation UUID. It returns only `{conversationId, clientId}` for private authority correlation, preserving raw request bytes and the frozen public normalization context `{}`.
- `handler.mjs` composes the existing retained native HTTP handler for only `get_business_development_context` and `get_business_development_recent_changes`. Fixed native routes, complete frozen DTO validation, deadline/cancellation and existing credential wire remain shared responsibilities. A call-bound credential callback is mandatory; selector capture precedes that callback.
- The private native authority owner (root-owned shared integration) must establish and pin the existing AppAuthority context receipt for the explicit Core conversation and current selected client. It rechecks current membership, resource revision, task/run/allocation and original expiry. Model arguments and the pure capture grant no access.
- Synthetic fixture/tests cover exact raw bodies, independent conversation IDs, scoped refusal before credential/source access, canonical context/history and alert projection semantics, whole-result rejection, cancellation and transport limits. These checks prove source mechanics only.

## Scope

Both implemented operations remain `PARTIAL_RESOURCE`: only current owned native conversations whose persisted prospect links to the exact current one-client subject are admitted. Unlinked prospects, unrelated or multiple client subjects and absent native resource authority are unavailable. SDK exposure remains withheld until the complete family contract is supported. `get_business_development_evidence` has no adapter here: the dossier can read another same-tenant organization's client facilities and can call SAM under flags, neither established by the linked-client receipt.

## Verification

Implemented the two fixed-route adapters, pure resource capture and synthetic fixture in `apps/gateway/sources/business-development/`. Receiving validates the full canonical DTO first, then rejects a context result whose linked client differs from the selected resource; it preserves case-equivalent native UUID bytes and never rewrites or filters the result. The guard does not grant authority: the native receipt must already be established before source HTTP.

Focused Node 24 checks (`--preserve-symlinks --max-old-space-size=256 --test --test-concurrency=1 --test-timeout=20000`) pass 14/14. The initial 12/13 outcome remains visible: the synthetic denied-resource fixture used an ordinary Error, correctly sanitized to `INTERNAL_ERROR`, rather than an owned `GatewayDenied`; fixing only that synthetic fixture produced 13/13. The added whole-result linked-client consistency delta then passed 14/14. No implementation failure was hidden or test assertion weakened. Final client UUID capture uses the existing native generic UUID syntax; the stricter conversation version/variant syntax remains owned by the canonical BD request normalizer.

The checks cover fixed original POST bytes and hashes, independent Core/run conversation IDs, current call-bound owner composition, complete DTO/history/alert semantics, scope refusal before credential access, hostile inert inputs, unsupported evidence, missing native owner, receiving drift, response limits, cancellation and expiry. Existing borrowed dependencies were used without installation. Independent source review and mounted private-authority checks belong to the parent integration owner. No live/source qualification, SDK exposure or complete family claim is made.

See [the nested authority assessment](CODEX-NESTED-READ-AUTHORITY-SEAMS-20261017.md) for exact native pins, reusable authority owners and unresolved outreach/research/evidence dependencies.
