# Retained CONTROL authority and broker: source handoff

Base: joint `8ec0235294855b189addaff6e7bb1ad527a224d0`, tree
`f01a6be695cf3fc420921c4bf092078276b8bd8c`. Parent allocated the concrete
control adapter after independent acceptance of native READS c72. Qualification
recorded the new retained source directory/shared contract and the narrow existing
retained HTTP transport plus family-integration transport-field seam. Startup's
issuer, registry, candidate and compiler paths remain owned by Startup.

The shared source contract owns closed Core current-authority and delegated-read
wire validation. The Core client owns only fixed native HTTPS requests, fresh
request-lifetime credential acquisition, bounded media/UTF8 streaming and cleanup.
The Meri context join borrows the actual canonical conversation store and accepted
read-task verifier: current run binding/state/scopes/policy and canonical accepted
request hash must match immutable admitted task facts. Native Core principal must
match the verified canonical Meri principal; no ID namespace conversion or legacy
conversation inference is allowed.

The control owner returns the existing local retainedContextPorts/readCurrent
schema and internal getCredentials. It pins current Core identity/resource revision
for each canonical dispatch lifetime, compares it on every later observation, and
caps all observations at the original task/request/dispatch cutoff. A dispatch
AbortSignal is an ephemeral correlation key, never an authority or fabricated
lease. No result or credential is persisted/cached. Business/current source guards,
canonical normalization, durable receipt/UNKNOWN/settlement remain gateway-owned.

The credential broker consumes an explicitly bound genuine issuer port, disabled
by default. The signed envelope binds fixed recipient, principal, operation,
raw+normalized argument/context/selector/resource digests and original cutoff.
No key, real credential, trust resource or actor+secret fallback is created. New
delegated transport uses Core's agreed fixed POST routes and CapiroRetained scheme,
returns unchanged domain DTOs to existing handlers, and never falls back to legacy
transport. The legacy mode remains explicit and unchanged.

Focused synthetic controls must cover all three operations through real canonical
gateway owners, source-specific resource drift, accepted request/fence/principal
substitution, missing issuer/material, wrong audience/operation/digests, TTL and
stream/cancellation limits, and release revocation with settled receipts preserved.
No heavy suite, real provider/DB/Core request, real material creation, security
activation, historical manifest repin or Startup shared edit is authorized here.

## Implemented source and ownership

The reviewed-source base remains the exact joint pin above. The tested retained
source is `63c3528f5e779caae8b13a63d47c3a36d31234b5`, tree
`da2e729b390ce1e6d082e0e04d31bd304170a977`. This report's successor changes only
documentation. The candidate has twelve paths: the new
`packages/contracts/runtime-0.2/retained-reads.mjs`, six production modules and two
test modules under `apps/runtime/native-authority/retained-reads/`, this report,
and the two explicitly allocated existing transport/integration paths below.
No Startup shared composition or issuance path is included.

| Export | Trusted input and result |
| --- | --- |
| `createCoreRetainedAuthorityClient(configuration = {})` | Constructor-owned Core HTTPS origin, fresh request-local native credential callback, explicit fetch implementation and clock; returns `available`, `readIdentity`, `readResource`, `issue`. |
| `createRetainedMeriContext(configuration)` | Actual canonical conversation `store`, accepted `taskVerifier`, existing `taskCapability`, `binding`, original `expiresAtMs`; returns `available`, `readCurrent`. |
| `createRetainedCredentialBroker(configuration = {})` | Genuine Core issuer, pinned issuer/key ID and public Ed25519 JWK, three admitted recipient origins; returns `available`, `getCredentials`. |
| `createRetainedReadControlOwner(configuration)` | The preceding Meri/Core/broker owners and recipients; returns internal `retainedContextPorts.readCurrent` and `getCredentials`. |
| `createRetainedDelegatedTransport(configuration)` | Admitted recipient origin and internal credential callback; returns `read`, which sends only the fixed delegated operation route. |
| `createRetainedReadControl(configuration)` | Composes the preceding concrete owners. Required `binding`, `expiresAtMs`; optional `store`, `taskVerifier`, `taskCapability`, `coreOrigin`, `getNativeCredential`, `fetchImpl`, `issuerId`, `keyId`, `publicKeyJwk`, `recipients`, `enabled`, `now`. |
| `createRetainedControlGeneralReadRuntime({retained, gateway, families?})` | Composes the accepted CONTROL gateway mount and returns only `readAvailability`/`execute`. Missing genuine dependencies or source disabled returns the accepted unavailable port. |

Every enable flag defaults false. `recipients` is a closed map keyed by the exact
three retained operation IDs; portfolio detail/changes must share the admitted
Core origin. No ambient origin, fetch, credential, private key or issuer fallback
is supplied. The public-key parser rejects private/unknown JWK fields.

The Meri join reads the actual canonical run row before/after the same admitted
read-task assertion. It correlates current run state, complete binding, policy,
scopes and the hash of the accepted request with the immutable task facts. It
does not synthesize an issuance receipt from startup configuration. Existing
static original tasks without canonical issued facts remain unavailable; Startup
and Budget own the separately allocated original-issuance repair.

Native Core identity uses Core tenant/users UUIDs. Equality with a Meri binding is
accepted only through the existing canonical startup identity provenance. A
different namespace requires a genuine mapping owner and otherwise refuses.
The accepted run/conversation binding never implies a legacy Core conversation.
Membership alone supplies no retained portfolio/folder authority.

Each actual canonical dispatch signal pins the initial proof, accepted task,
principal, identity revision, operation-specific resource revision and original
cutoff. The owner rechecks the actual Meri task and fresh Core facts before and
after issuance and at later gateway observations. Observed drift withholds the
result; the canonical gateway retains its durable charge/UNKNOWN semantics. The
scope signal and child request signal are distinct, so a child lifetime cannot
replace the original dispatch proof. No token/result/opaque authority is logged,
persisted or used as a renewable lease.

## Agreed private Core wire and pending adoption

The consumer follows Core's agreed `WIRE.md` SHA256
`80b11ad1599c7886aeb9d694bb5d9741eb45600b833314490df90d3740416a17`
at `task-3/backend-retained-authority/docs/retained-authority-20261016/WIRE.md`,
including the subsequently agreed receiving caps: opaque `currentAuthority`
at most 4096 UTF8 bytes within the 8192-byte full envelope; issuer/key ID 1..256;
Clerk ID 1..256 nonwhitespace without an invented prefix policy.

The fixed native identity/current-resource/issuer calls retain the native user
bearer only inside CONTROL. Issuer POSTs under `/api/clio/application-authority/`
are `retained-research-portfolio-principal`,
`retained-research-portfolio-changes-principal`, and `retained-florida-principal`.
Each accepts exactly `{schemaVersion:1,request,context,originalExpiresAtMs}` and
returns the raw closed signed envelope. Delegated data POSTs are exactly:

- `/api/clio/retained-reads/research-portfolio`
- `/api/clio/retained-reads/research-portfolio-changes`
- `/intel-api/internal/legiwatch/retained-florida-budget`

Data uses `{schemaVersion:1,request,context}` and the exact `CapiroRetained`
authorization scheme. No native bearer or service secret reaches data routes or
workers. Explicit delegated mode never requests a service secret and never falls
back after failure. The existing explicit legacy transport mode is preserved.

The pinned Ed25519 envelope binds issuer/key, exact origin/path/operation,
independently captured Core principal, identity and **resource** revisions, raw
request/normalized arguments/context digests, opaque current authority and the
original task/native cutoff, at most 30 seconds. Signature verification uses the
fixed `capiro-retained-read-principal-v1\n` domain plus canonical unsigned JSON.
Florida preserves the accepted empty/default session string exactly and null
selectors. Frozen request/context/domain DTOs are unchanged.

Core reports actual native provenance/current-principal rechecks, retained
resource producers, all three issuer/data services and separate Florida authority
probe/current-corroboration adapters implemented in its isolated source batch.
Three orchestration findings were closed; independent source review/focused
proof/sealing/publication are ongoing. No reviewed final retained backend pin has
been received. The distinct authority-only Florida probe is backend-owned and
cannot substitute a data-purpose envelope or dummy resource revision. A missing
canonical name resolver must refuse rather than guess a client.

This is a published-source consumer candidate, not backend adoption or runtime
activation. Actual issuer/key/origin/material trust remains unallocated. Required
next actions are independent consumer review, receipt of Core's reviewed exact
retained pin, and coordinated accepted-slice integration by Qualification. Live
availability is **zero**. No migration allocation, credentials or live permission
change is requested by this source batch.

## Focused evidence and preserved failures

All execution below is **synthetic**, using actual canonical gateway/store/task
owners with synthetic SQL/native HTTPS dependencies and the public RFC8032 test
vector. No real Core/provider/DB call, SDK session, key generation, compiler,
browser, installation or uncontrolled child was launched.

The final exact source passed **57/57**, zero skipped:

```text
node --max-old-space-size=128 --test --test-isolation=none --test-concurrency=1 --test-reporter=tap apps/runtime/native-authority/retained-reads/test/control.test.mjs
```

`task-5/native-reads-retained-final-execution.json` records PID 7240 ended,
primary exit 0, cleanup exit 0, zero remaining owned processes, no timeout,
3135.9166 ms supervised duration and a fresh 2867736576-byte commit headroom
sample. Observed peak working set was 169897984 bytes, a sample rather than a
guaranteed bound. The supervisor enforced a 120-second wall limit. TAP SHA256 is
`7f5d1fa6b4cc886f6d39037a4ab0b31f8c6ca911a4bba280552aa9c375b11630`;
stderr was empty.

Coverage includes all three operations through the actual canonical mount,
disabled/missing owners, wrong key/origin/path/principal/digests/time, accepted
request/fence/policy/scope substitution, opaque authority format/caps, exact empty
Florida session, stream/cancellation bounds, preserved legacy mode, resource drift
and post-settlement entry revocation without refund or replay.

Earlier retained runs remain preserved in separate logs/receipts:

| Source | Actual result | Correction |
| --- | --- | --- |
| `27787214d7649fa60bce7169e636c7fbb99a2999` | 48/49; primary 1, cleanup 0 | Default no-argument Core client now remains unavailable. |
| `7a3451f1cad830809a519bd93adc55cad2f33c9e` | 52/53; primary 1, cleanup 0 | Synthetic installation callback strips unrelated fields before calling its closed canonical owner; production validation was preserved. |
| `0ea5f26832b3f2afce6f93de3ecc5d3a1f6ce54e` | 53/53; primary 0, cleanup 0 | Passing predecessor before four additional boundary controls. |
| `63c3528f5e779caae8b13a63d47c3a36d31234b5` | 57/57; primary 0, cleanup 0 | Final source above. |

Historical initial uncertain/failed READS execution receipts also remain intact.
No pass or case count is inferred for an earlier empty-log uncertain run.

## Changed measured proof rows

`task-5/READS-RETAINED-CONTROL-PROOF-DELTA.json` SHA256
`37a13519d4f96b0249ca530109e8d99dea4319391ee3e8c361f66ececf2db051`
records raw Git blob hashes and SHA256, independently matching current worktree
bytes:

| Existing path | Base SHA256 | Candidate SHA256 |
| --- | --- | --- |
| `apps/gateway/general-reads/integration.mjs` | `c53d264fca5244a317363acd3dd6b042f473c4143a426cc00f012f905c0a9641` | `998f9be19192d404592374930e5102cc3c3861666a7a067c93d86e184ca1e0a9` |
| `apps/gateway/sources/retained-reads/http-transport.mjs` | `6ee9682c9d467fb2b294ae84e91620b75814e9d7b9246c5ce043abd31d178b9c` | `93537874564772dd9e4ae1255178cb215305ef9daff58c3548107e2eba15c4a0` |

The integration module is measured common source for all fourteen general-read
family groups; the retained HTTP seam is additionally measured for the retained
three. Existing installation/qualification receipts cannot qualify these changed
bytes. Historical manifests and their rows are unchanged. New-source
qualification must record the new measurements separately.

## Separate two-line typing repair

Published independent branch `dot/meri-reads-schema-types-20261016` at
`bbf58cc84d93546dd9a2e5adbc3c0bfca651b94a`, tree
`a6525977e9a1b8c4c41e1eb37a4de373c77da492`, changes only the two callback
parameters in `apps/worker/conversation/reads/schema.mjs` to explicit JSDoc
`unknown`. New blob `6d2f4de1b203b54ffd507b62b0ee7438eda1e61e` replaces
`e4fcf1187a4251b7a37574c7d8008b9bb2e58f41`. It preserves narrowing, schema and
runtime behavior; no `any`, ignored diagnostic or compiler flag change.

Its six focused synthetic union/unknown-boundary controls passed, primary and
cleanup exits 0, PID 8212 ended, zero remaining processes. TAP SHA256
`a0648ad2bef9835a41c2a8840da0457b5106c742545fccd9b57284636827d8dd` is
recorded in `task-5/native-reads-schema-type-repair-execution.json`. Qualification
owns the affected integrated conversations compiler recheck; no compiler was run
in this lane. That isolated repair is not included in the twelve-path retained
candidate and must be reviewed/integrated separately without its retained WIP
ancestors.
