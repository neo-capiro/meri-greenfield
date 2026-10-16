# Private product owner bridge: source contract, not an active route

The disabled model proxy plan fixes a **separate** canonical budget owner at its
`owner.fixedOrigin` HTTPS origin on TCP 8444. The proxy task may reach only the
owner security group on that port and receives the exact-version
`ownerBridgeClient` material. An in-task Node child or AF_UNIX socketpair would
change that placement and is not this plan's production bridge.

## Required two-channel exchange

The proxy host opens two independently authenticated logical channels to the same
fixed owner HTTPS origin. Both use pinned server CA/name and a client certificate
from the reviewed owner-bridge material. The owner pins issuer, client identity,
certificate purpose, current deployment revision and task lease; merely seeing
an HTTPS request or a caller-supplied request ID does not authenticate a send.

1. **Operation channel.** A one-shot reservation request carries
   `boundary_codec.encode_reservation(value, claim)` as a bounded positional
   JSON array. After a confirmed UNKNOWN hold, one settlement request carries
   `encode_settlement(requestId, usageResult)`. Only a canonical
   `BudgetCommitUncertain` after settlement may permit a read-only historical
   outcome request. The owner never retries inference or turns an absent row into
   a no-dispatch decision.
2. **Host-capture channel.** The proxy's direct TLS host registers a separate,
   request-local capture callback before the operation channel is usable. The
   owner sends `meri.proxy.capture-call/1` with the exact request ID, binding
   tuple and deadline. The host invokes its constructor-captured
   `HostRequestObservation.capture_authenticated_call`, freshly reads the
   accepted socket/original body/final HTTPX body/CountTokens observation, and
   returns another independently produced reservation array. For completion,
   the owner sends `meri.proxy.capture-complete/1` with the request ID, binding
   and grant ID. The host invokes the lower response tee's
   `capture_authenticated_complete` only after native EOF and returns the full
   `meri.proxy.complete-capture/1` tuple described below. It may not echo the
   operation claim or reuse a cached claim payload.

The owner joins the two authenticated channels using a single-use, short-lived
correlation ID bound to the exact mTLS peer, proxy task,
request ID, original run/grant and deadline. It allows one in-flight exchange
per channel and refuses early, duplicate, oversized, late, cross-session or
out-of-order messages. A bounded owner-to-proxy capture poll plus a separate
capture reply POST can carry the reverse callback using ordinary HTTPS on
8444; the correlation ID is not an authentication credential. The exact endpoint paths and server implementation need review before
mount. No new public listener, proxy-owned budget database or worker-supplied
provider credential is part of this contract.

The in-memory operation and capture arrays include the original opaque proxy
bearer because the existing canonical JavaScript owner verifies its SHA-256
against the persisted product grant. It is sent only inside the two pinned mTLS
channels to the trusted owner, never recorded in logs, receipts or storage.
`owner-wire-codec.mjs` only decodes these bounded arrays into data; it does not
authenticate either channel or provide the owner capture callback.

### Positional capture shapes

`bindingTuple` is `[tenantId,actorId,conversationId,runId,attemptId,workerId,writerFence]`.
The owner emits:

```text
["meri.proxy.capture-call/1", requestId, bindingTuple, deadlineMs]
["meri.proxy.capture-complete/1", requestId, bindingTuple, grantId]
```

The host's complete capture reply is:

```text
["meri.proxy.complete-capture/1", requestId,
 [requestId, nativeBodySha256, "UNKNOWN"],
 rawRequestBodyBase64, nativeRequestBodyBase64,
 [requestId, bindingTuple, taskArn, capabilitySha256,
  nativeBodySha256, rawRequestSha256, modelId, profileId,
  pricingRevision, evidenceSha256, 200, true, true,
  [inputTokens, outputTokens]],
 usageTuple]
```

`usageTuple` is the third item of the existing
`meri.proxy.settlement/1` array. Each complete body is capped at 12 MiB,
each raw/native body at 4 MiB, and the owner verifies the two captures against
the claimed arrays before the existing `createProductProxyOwnerComposition`
can touch the one canonical `meri_product_budget` store.

## Named activation gaps

- There is no owner HTTPS :8444 service/listener, mTLS client/server material
  schema, certificate issuer/trust policy, or task-lease binding implementation.
  The proxy plan is disabled and does not provision the owner service.
- The owner must resolve its canonical PostgreSQL pool, original allocation and
  grant facts, selected client and pricing, and a fresh Core conversation
  currentness reader from trusted persisted custody. Python claims cannot
  supply those constructor inputs.
- The proxy host still lacks a mounted server callback for the actual accepted
  TLS socket and a proven pinned LiteLLM per-request handler injection. Neither
  a JSON field nor a global HTTPX client substitutes for those ports.
- Native Linux mTLS, direct NLB source IP, fresh ECS/ENI lease, final CLI wire,
  PostgreSQL uncertain-commit and actual Bedrock response behavior remain
  qualification gates. This document and codec do not enable traffic.
