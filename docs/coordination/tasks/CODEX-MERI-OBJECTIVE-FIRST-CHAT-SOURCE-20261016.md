# Objective first-chat source composition

Base: local Meri Q branch at `525aa22fb9cf207228f8d0a62d59f0cc9ba73820`.
Reviewed source successor: `f560109` (local-only; no remote on this checkout).
Owner: Codex Meri integration. Core's generation authority and retained-result
acceptance remain with the Capiro backend owner. The frontend integration owner
works in a separate checkout. No deployment or new credential issuance is in
this task.

## Responsibilities and boundaries

- The existing Core initial-generation admission, request, and acceptance
  operations own job, consent, Objective revision, typed request, and current
  identity. Their POST bodies are exactly `{schemaVersion:1,generationJobId}`.
  Meri's control-side transport is fixed to those routes and exact wire-body
  hashes. Its credential callback must be backed by an issuer-minted,
  request-bound workload JWT and current delegation check. A returned JSON
  body is not authority until a closed Core response decoder validates it
  against the accepted run.
- The canonical prepared-run issuer owns one immutable facts hash and task
  credential. The prepared-facts reader must return that already-issued entry
  after rechecking the accepted run, issuance, allocation, and task identity.
  It must never recompile facts or issue a new credential on a read.
- The product proxy owner must attest the current model alias, provider,
  upstream model, and configuration binding. A control-side query-selection
  reader must compare that attestation with the issued model grant, protected
  credential digest, proxy origin, accepted request, and current allocation.
  Worker claims and qualification proxy settings provide no authority.
- The worker's Claude Agent SDK remains the only model loop. Its Objective
  runtime consumes the two read ports and the recovered candidate validator;
  native completion retains the typed result once. The source-specific Core
  result owner can read that custody after its own currentness checks. The
  backend owner composes the Core result verifier and acceptance decision.

## Source modules and state

Implemented source seams are `apps/control/objective-generation/core-http.mjs`,
`apps/runtime/objective-generation/prepared-facts-reader.mjs`,
`apps/runtime/objective-generation/query-selection-reader.mjs`, and the
unmounted `apps/control/objective-generation/workload-reader-gate.mjs`.
`apps/proxy/product/host_observation.py` is an inert Python host-evidence seam.
The first three ports default unavailable without product owners. Core HTTP
returns only `unqualified-response`; the workload gate requires fixed trusted
keys, a fixed accepted source and result owner, current authority, and atomic
durable replay before it can become available. Neither source seam issues a
credential or mounts a route. The proposed two-issuer JWT and replay design is
in `CODEX-MERI-OBJECTIVE-WORKLOAD-ISSUER-20261016.md`.

The private task route, if allocated, uses the existing task capability and a
fixed operation; it does not accept provider, model, or new source data from
the worker. The separate Core-to-Meri retained-result ingress is fixed to
`POST /v1/internal/objective-generation/retained-result/read` and must verify
an issuer-minted Core-reader JWT against exact received body bytes, route,
source, and current accepted-run custody. All source operations have a bounded
deadline, abort handling, fresh checks before release, no ambient credentials,
and an unavailable result for missing owners. They create no second journal or
new public Strategy contract. Ordinary authenticated Meri chat remains
independent of this Objective-specific allocation.

The current inert Python reservation codec contains a raw proxy credential.
It must not be used as a live cross-process frame under the no-secret-transfer
instruction. Host evidence and its separate proxy-service authentication need
an approved private channel and a reviewed digest-only boundary change before
the Python and JavaScript budget bridges can be mounted.

## Verification and unresolved inputs

Focused Node 24 checks passed for the Core transport (14/14), prepared-facts
reader (6/6), query-selection reader (38/38), and retained-reader workload
gate (10/10). The inert Python host-observation seam passed 6/6 synthetic
checks. Independent reviews accepted these as source contracts, not live
composition. Broader regression waits for a coherent integration pin.

Activation remains **HOLD**: no Objective issuer/key, receiver trust manifest,
durable issuance/replay store, accepted run-to-job mapping, issued Objective
fact pair, product proxy configuration attestation, authenticated private
task-read operation, current accepted-run/custody owner, Core response decoder,
or mounted retained-result ingress is present. The existing ordinary chat
must not depend on these missing Objective ports. No AWS build or deploy is
authorized.
