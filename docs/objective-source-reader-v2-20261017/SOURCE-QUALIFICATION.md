# Objective source implementation qualification

Wire freeze: draft PR123 `b2f0a5d71e1c1b6a6cf79b1e9a496ad663ef641a`,
tree `3131379c8c258e1ac02b13b71524e49028598024`.
Self-contained schema SHA256:
`d461baaaf2300aa7ffd363bc4b58295d22c437360c126884e96433e10ac16ec1`.
Implementation is on a separate feature branch above that exact freeze.

## Canonical modules

All new runtime files are beneath `apps/runtime/objective-source/`:

| Module | Responsibility |
| --- | --- |
| `protected-facts.mjs` | Full canonical candidate/pair checks, explicit selected type, nonsecret whole-facts decorator and exact existing immutable bind input; historical integrity validation never grants fresh access. |
| `projection.mjs` | Closed private immutable record and closed v2 wire whitelist; binding derives from canonical accepted run and matching ISSUED facts. |
| `custody.mjs` | Global job immutable CAS/readback, conflict and uncertain-ack handling, mode-specific source reads and fresh authority before/after all reads/replays. |
| `prepared-reader.mjs` | Actual existing prepared reader with a per-read wrapper retaining its shortest validated Core proof deadline; no raw-facts fallback. |
| `native-authority.mjs` | Actual native identity/context factories, original accepted source/client/scopes and repeated fresh checks; separate read expiry. |
| `reader-gate.mjs` | Distinct Ed25519 purposes, exact raw bytes/claims, durable identity replay binding, custody-derived source and existing source-bound retained result owner. |

`packages/contracts/objective-reader-2/validate.mjs` owns inert canonical wire
and temporal/digest checks. Existing shared factories, legacy gates, Core RS256
and Temporal protocols are unchanged. No source mount was added.

## Checks actually run

Node **24.19.0**: final combined run **130/130**, zero skipped/cancelled/failed:
37 protected-facts, 29 native authority, 27 custody/projection/prepared reader,
26 signed gate, 5 frozen schema and 6 cross-repository composition cases.
Whitespace checks pass. Independent implementation review found and repaired
null selected type, backward clocks, invalid explicit CAS answers, shortened
Core proof expiry and inert input boundary cases. Earlier failures remain in
the task evidence; none were relabeled as passes at their old source.

The cross-repository test uses actual production factories in this order:
existing issuer `issue` -> actual prepared-facts compiler -> protected pair and
whole-facts decorator -> existing issuer immutable `bindFacts` -> confirmed
ISSUED metadata -> native/prepared readers -> custody -> signed gate -> actual
Core v2 signer/client and actual canonical Core Admission/Binding parsers.
Credentials, CAS storage, durable-decision storage, native HTTP replies, task
proof and Core-current replies are explicitly synthetic. This does not qualify
database durability, live native identity, deployment or production delegation.
Retained gate tests use the actual source-bound result owner around a labeled
synthetic inner reader; they do not qualify actual retained object/SDK capture.

The external Core emitter records eight original/rewritten/emitted source
hashes, declared import-only rewrites and TypeScript version. Fixture manifest
SHA256 for the final run:
`6f03cc85e9c6a33ae20b00ff2bb14b5d40fb36b16aac614d899922a0f8bcdec1`.
The test verifies emitted bytes and the exact frozen wire artifact, requires
the actual canonical parsers and fails when its explicit fixture is absent.
It does not skip positive qualification silently.

Reproduce after emitting a fresh Core fixture with the sibling Core branch's
`docs/objective-strategy-core-20261017/qualification/emit-reader-v2.cjs`:

```powershell
$env:CORE_OBJECTIVE_V2_MODULE_DIR='<absolute freshly emitted Core fixture>'
node --test packages/contracts/objective-reader-2/schema.test.mjs apps/runtime/objective-source/protected-facts.test.mjs apps/runtime/objective-source/projection.test.mjs apps/runtime/objective-source/custody.test.mjs apps/runtime/objective-source/prepared-reader.test.mjs apps/runtime/objective-source/native-authority.test.mjs apps/runtime/objective-source/reader-gate.test.mjs apps/runtime/objective-source/production-composition.int-test.mjs
```

Use Node24 explicitly where PATH still selects Node22. Existing dependencies
and read-only resolution junctions were reused; no dependency install, image
build or archive was performed.
The final 130/130 rerun used the existing official ECS SDK 3.1151.0, matching
the runtime manifest, through a task-local read-only dependency junction.
The Meri owner supplied the installed matching package; its version was checked
before the run. An earlier 130/130 pass used SDK 3.1141.0 and is superseded for
this dependency check. No shared install changed and no ECS request was sent.
These source/factory checks do not qualify a runtime image or live SDK capture.

## Exact integration holds

The normal shared `createPreparedRunIssuance` caller still does not consume the
Objective decorator. Meri integration owner must accept its minimal splice and
the optional-pair preservation in `task-router-authority.mjs`,
`runner-poststart-authority.mjs` and `prepared-run-bindings.mjs` at a coherent
first-chat pin. Shared files are untouched; ordinary facts remain unchanged.

The new custody owner requires an actual durable `store.read/putOnce` adapter.
Its closed port permits only identical replay, global-job conflict refusal and
explicit `OBJECTIVE_CUSTODY_ACK_UNKNOWN` recovery by exact committed readback.
No product persistence schema/migration ID is allocated by this source branch.
No in-memory fixture is offered as production persistence.

Live native credentials, admitted task/Core-current proofs, durable replay
storage, the genuine retained reader factory and runtime HTTP mounts remain
unbound. Core's production delegation disabled constraint and unavailable
later native issuer/authority paths remain unchanged. These are explicit source
integration/activation holds, not successful production acceptance.

Core `eef7cd1b` PostgreSQL **39/39** evidence stays at its original exact pin;
no SQL or transaction implementation changed and no native suite was repeated.
No first-chat shipping pin, live key/grant, AWS, SQL apply, migration,
deployment or activation changed.
