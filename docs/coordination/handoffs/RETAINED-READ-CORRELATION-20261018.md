# Retained 0.2 read correlation contract — 18 October 2026

This is the agreed wire shape for the eleven selected-client Core wrappers, pending implementation by Core and the shared Meri read-delegation/dispatcher owners. It is **not** a published Core route or an authority receipt. The source adapters in PR158 prepare the fixed path, exact body hash, optional invocation ID and correlation header; they do not issue the token.

## Existing wire and missing facts

`POST /api/clio/tools/<exact 0.2 operation id>` carries `JSON.stringify({input,metadata})`, with the exact UTF-8 bytes bound by a single-use `CapiroMeriRead` token's `bodySha256`. The token request already binds the operation and normalized `argumentsSha256` to an `UNKNOWN` Meri reservation under its trusted `callKey`/`invocationId`. Core's run fact can verify selected client, attempt and writer fence, but neither that fact nor the reservation contains the current Meri subject's `authorizationDecisionId` and scopes. The body lacks the gateway's trusted profile `asOf` and the binding/subject needed to emit other exact 0.2 source envelopes.

## Authenticated correlation shape

On these eleven `CapiroMeriRead` POSTs only, send `x-meri-read-correlation: <unpadded base64url of canonical JSON UTF-8 bytes>`. The decoded value is a closed object with exactly four top-level fields:

```json
{
  "binding": {"tenantId": "<tenant>", "actorId": "<actor>", "conversationId": "<uuid>", "runId": "<uuid>", "attemptId": "<uuid>", "workerId": "<uuid>", "writerFence": 1},
  "subject": {"kind": "client", "entityType": "client", "entityIds": ["<selected-client-uuid>"], "tenantId": "<tenant>", "actorId": "<actor>", "authorizationDecisionId": "<uuid>", "policyRevision": "<revision>", "scopes": ["<exact ResolvedSubject scopes>"], "rosterVersionId": null},
  "policyRevision": "<revision>",
  "normalizationContext": {"asOf": "<gateway ISO observation>", "clientResolution": {"selector": "<original selected alias>", "clientId": "<selected-client-uuid>"}}
}
```

The example's `subject.scopes` placeholder stands for the exact JSON `Scope[]`, not literal strings. For documents the context is the gateway's exact `{binding,subject}`; for entity candidates it is `{defaultCongress}`; for Monday, contacts, mail and meetings it is `null`. Mail and meeting time-sensitive selectors are validated against Core's own current clock. The object contains no credential, service secret or model-supplied authority. Serialize with the existing RFC 8785 canonical JSON library, encode the UTF-8 bytes as unpadded base64url, and cap the **decoded bytes at 8192**. Refuse unknown fields, invalid schema, noncanonical encoding or excess size; do not truncate. The Core owner agreed to this exact shape and cap.

Add `correlationSha256` (hex SHA-256 of the **decoded canonical UTF-8 bytes**) to the existing `kind:'tool'` token issuance request and Core-signed token claims. Keep the current `bodySha256`, operation, normalized arguments hash, single-use `jti`, target and reservation checks. Include `correlationSha256` in the canonical token-request digest used for lost-response retries. On use, Core checks the header hash against that signed claim before decoding, rejects a missing/mismatched header, and checks the full binding, including attempt and writer fence, policy revision and selected client against the current delegation/run facts. It separately checks current Core actor and client walls and the operation/body/arguments hashes already bound by token and `UNKNOWN` reservation. Client filters must intersect the selected client; `find_contacts` must not OR the client with a domain or query.

The gateway reservation's `argumentsSha256` is `canonicalSha256(input)` for the **normalized** source input. That `input` is copied unchanged into the POST protocol body. The separate source protocol `requestSha256` is `canonicalSha256({input,metadata})`. `bodySha256` hashes the exact UTF-8 bytes emitted by `JSON.stringify({input,metadata})`; it can differ from `requestSha256` because JSON property order can differ from canonical JSON order. Raw model arguments can differ from normalized `input`, but are never the reserved hash.

The source adapter builds this object from the gateway's current **effect** authority and its `context.options(effect)` after the `UNKNOWN` reservation. The trusted `invocationId` is the call key; it must be carried to the retained handler by the shared dispatcher, not accepted from tool arguments or discovered by querying for a similar reservation. The task-bound broker compares the requested correlation digest with its current authority/context, then requests the one existing run-delegation tool token. It echoes the correlation digest, target, invocation ID and expiry back to the source adapter. The adapter requires all four for a signed read and refuses an expiry beyond the admitted source deadline. It rejects Bearer fallback on the canonical Core path or any call carrying a trusted invocation ID. Legacy Bearer fixtures remain possible only on noncanonical paths without an invocation ID. The adapter sends the exact header and body bytes once, and never logs or persists the token.

Core treats `subject.authorizationDecisionId` as **opaque Meri lineage**, never as a Core grant. It may echo the verified correlation's exact binding and subject in the 0.2 source response, after its own current grant checks. Meri validates the returned envelope against the current effect and checks authority again before release. Core must not infer a different subject from client ID or use subject scopes to widen access.

For `get_client_context@0.2.0`, `normalizationContext.asOf` originates in `prepareProjectionReadContext` from the gateway observation, not the request. Its closed validator requires `result.generatedAt === asOf`, which Core's later six section reads cannot truthfully satisfy. Keep this version unavailable; do not relabel the result or reinterpret its pinned schema hash. The coordinated successor is `get_client_context@0.3.0` with an explicit versioned profile schema and truthful owner `readWindow:{startedAt,completedAt}`. Core's operation admission, Meri catalog/binding, pinned skill assets and source measurement must move together. The exact signed header and `{input,metadata}` body shape need no new fields.

## Current owner changes

- **Source PR158:** fixed `/api/clio/tools/<id>` token target, exact `JSON.stringify({input,metadata})` body bytes/hash, trusted `invocationId` propagation through owned handlers, scheme/deadline checks, canonical correlation bytes/hash, 8192-byte limit and exact digest/target echo. A signed call requires the invocation ID; the source sends the header only with `CapiroMeriRead`. The actual signed claim depends on the jointly published token extension.
- **Shared Meri receiver:** forward trusted invocation ID after reservation to the eleven retained handlers; expose a task-bound broker based on the existing `read-delegation` and current authority/context rather than a new issuer. The present `retainedTaskPorts` callback exposes only a bearer-string getter and service secret.
- **Read-delegation/Core:** extend closed tool-token request/claim/verification with the correlation digest, preserve exact retry semantics, and return the 0.2 source DTO from the canonical owners. No live route should claim task-bound authority before that extension and the selected-client guards are present.
