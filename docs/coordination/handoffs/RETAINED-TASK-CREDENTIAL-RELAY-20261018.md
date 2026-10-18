# Retained read task credential relay

This source slice composes the existing Meri post-reservation invocation slot
with the existing Core run-delegation tool token. It does not issue a credential,
change source authority, or enable a Core route.

## Owners and interfaces

- The durable gateway owns current authority, the UNKNOWN reservation, the
  trusted `invocationId`, output validation and final release. It sends the
  invocation ID only to the eleven exact Core retained source handlers after
  reservation and the second authority check.
- The existing run-delegation owner issues a one-use `CapiroMeriRead` token for
  the exact operation, invocation, normalized-arguments hash, POST path, raw
  body hash, and canonical correlation hash. Other tool/current/mode/reference
  token requests remain byte compatible and omit correlation.
- The task composer supplies a per-task credential callback to retained source
  factories as `getSignedSourceCredentials`, alongside the existing
  `getNativeCredentialWithExpiry` port. It checks the task binding, selected client, policy revision,
  allowed operation, exact body and correlation hashes, current deadline and
  token receipt; it echoes the adapter's signed request pins and adds the
  existing service secret. An absent Option B delegation refuses before Fetch.
- The shared CLI/control/config/render/registry receiving owner composes
  `retainedTaskPorts`, configured Core endpoints and in-image source receipts.
  That owner retains production installation and live readback. Monday uses a
  separate signed source adapter so the memory family is unchanged.

No token, service secret, bearer, or private source data is stored. Delegation
expiry, Stop signal, task deadline, source cancellation and current authority
still bound each call. The Core source owner must publish the exact eleven
receivers; Meri never infers authority from an echoed correlation header.

## Receiving and source holds

- The shared receiving owner must pass `retainedTaskPorts` into
  `createControlReadsComposer`, route `getSignedSourceCredentials` only to the
  eleven exact adapters, configure HTTPS Core endpoints at
  `/api/clio/tools/<operation id>`, and include
  `client-knowledge/monday-signed-{adapter,handler}.mjs`,
  `retained-reads/signed-source-operations.mjs` and the relay/dispatch/delegation
  sources in its current P2 measurement. No source token is usable until that
  composition and current installation receipt exist.
- The prepared Core PR87 receiver still returns 503 for all eleven source
  routes. PR92 prepares document text-only data, but live text-only allocation
  needs the exact current Core no-provider image/configuration evidence in
  Meri PR162's tariff. This source branch does not supply that evidence.
- Monday's signed adapter requires a current `managedBoardMapping` credential
  receipt. There is no production Meri producer for that mapping; the relay
  refuses Monday before token issue. A token alone does not establish the
  managed board wall.
- Current prepared runs carry exactly one client scope. Mail admission needs a
  mailbox scope, so the three mail tools cannot use this client-only task
  delegation until the existing authority owners publish a scope successor.
  Personal meeting and personal contact paths similarly need an explicit
  authority decision; the relay does not turn the selected client scope into
  a personal grant.

## Verification

Focused checks cover token-request closed shape and retry digest, exact signed
credential pin/expiry refusal, post-reservation invocation propagation,
Option A refusal, and unchanged legacy native token forms. The source-only
checks are not a runtime/Core authorization receipt.
