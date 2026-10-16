# CONTROL native read boundary (local source candidate)

This directory has two production modules. They compose existing owners; they do
not issue credentials, add an authority endpoint, create a task, or activate a
source. The local gateway consumes their context and per-call credential interfaces;
Startup owns the actual admitted-entry CONTROL caller and credential producers.
Their genuine runtime binding and qualified receipts remain required. Native
READS availability remains zero.

`core-client.mjs` exports `createNativeToolAuthorityClient(configuration)` and the
closed receiving assertion `assertNativeToolAuthority(value,{started,now})`.
Configuration is closed: optional `origin`, `fetchImpl`, `now`, `enabled`,
`maxRequestMs` (1..3000). Enabled defaults false; absent explicit origin/fetch
stays unavailable before HTTP. Its `readCurrent({credential,deadlineMs,signal?})`
uses the existing fixed application-authority identity client around a bounded
membership request: identity `{}` → membership `{}` → identity `{}`.

The returned fact is exactly `{principal,identityRevision,actorRole,
membershipRevision,checkedAtMs,expiresAtMs}`. Principal uses Core UUIDs. Every
source receipt must be fresh within its individual request, every principal must
agree, and the outer identity revisions must agree. The membership must be active,
have one of `standard_user`, `user_admin`, `capiro_admin`, empty permissions and
bounded unique UUID client IDs. The source checked-at minimum and expiry minimum
are retained. Native source expiry may exceed 30 seconds; the HTTP timeout is a
separate bound. No caller headers, cookies, tenant or impersonation headers,
redirects, host override, origin fallback, or service secret are accepted here.

Core confirmed this effective-role theorem only for this fixed ordinary boundary:
the chosen membership supplies both native `ctx.role` and selected tenant;
identity rechecks that membership and binds its role in `identityRevision`.
`membershipRevision` remains distinct. Impersonation is outside this theorem.
Acquisition PII requires exactly `capiro_admin`; `user_admin` is not equivalent.
The model's acquisition role selector is not authority. No Core endpoint change
is required. Source basis: Core `1b9fedc5bd476311d9234ca4b549ff3ebb14ab2d`
(relevant production blobs equal `b525032222515d636b0dae2d46e40c7c3d8b5528`).

`owner.mjs` exports `createNativeReadCredentialOwner(configuration)`:

- Required: `binding`, original `expiresAtMs`.
- Borrowed existing owners: `store.read`, `taskVerifier.verify`, canonical registry
  `readCurrentEntry`, exact `taskCapability`, admitted `allocationJson`, immutable
  `approvedReads`, `coreAuthority` from the first module.
- Borrowed credential boundaries: `getNativeCredential({binding,operation,
  requestSha256,signal,deadlineMs}) -> private native token string` and
  `getServiceSecret({binding,operation,origin,requestSha256,argumentsSha256,
  normalizationContext,signal,deadlineMs}) -> private service-secret string`.
  These are required composition seams, **not implemented producers**. No file,
  environment, global session, prepared identity credential or task capability is
  substituted for either one.
- Optional `defaultCongress` must be a genuinely captured CONTROL fact for bills;
  missing Congress refuses before I/O. `now` and `enabled` are optional; enabled
  defaults false. Configuration accepts no other keys.

The owner exposes `available`, `nativeReadContextPorts.readCurrent`,
`getCredentials`, and `credentialsForCall`. It currently limits operations to the
canonical bill-text, public-reports, acquisition-personnel and disclosures
families. Existing approved config **and** admitted allocation must contain the
exact operation. The approved original report/acquisition source pins and local
successor repairs retain separate custody. Disclosures registration is a local
source change; it establishes no runtime qualification or publication approval.

`nativeReadContextPorts.readCurrent` takes exactly `{binding,subject,operation,
request,requestSha256,policyRevision,sourceIds,deadlineMs,signal?}` and returns JSON
with those binding/proof fields except request/deadline/signal, plus `context`,
`checkedAtMs`, `expiresAtMs`. The signal must be the original gateway invocation
lifetime. Context is `{defaultCongress}` for bills, `{actorRole}` for acquisition,
and `{}` for public reports and disclosures.
The actual task verifier, current admitted-run owner, same registry entry and
conversation store prove task/grant/fence/request/allocation/config/scopes/policy.
Fresh Core principal IDs must equal the task's genuinely captured Core UUIDs;
there is no name conversion or cross-namespace mapping.

`getCredentials` takes the existing source credential proof plus canonical
`request`, `input`, `scopeSignal`, `deadlineMs`, optional callback `signal`.
`scopeSignal` must have a prior matching current observation. It re-observes
task/native facts before and after awaiting the service-secret owner. Principal,
both revisions, role, task vector, request/context and native credential identity
must remain unchanged. The per-lifetime weak pin stores only nonsecret facts and
a token digest; original expiries never renew, including concurrent observations.
Both original and callback cancellation stop release. No receipt is persisted.

`credentialsForCall(operation,canonicalGatewayCall)` is the trusted per-invocation
adapter for the accepted source callback. It captures the original request and
gateway signal, then returns the existing `{...credentialProof,input,deadlineMs,
signal?}` callback. The original proof and normalized input must match before
delegating to `getCredentials`. This avoids a transport wire change, global cache
or guessed request recovery. The local bill handler's mutually exclusive trusted
`credentialsForCall` constructor hook binds this adapter on its actual canonical
invocation. `nativeReadContextPorts` is propagated through the general-read mount
and dispatch; its closed receipts are checked before effect and release. Startup's
actual per-entry CONTROL factory composition is still pending coordination. Static
`getCredentials` mode remains unchanged, and no held family was registered.

The existing transport emits the fixed producer headers and flat native body;
its JWT+service-secret guard remains an independent enforced-mode qualification.
Observe-mode HTTP200, synthetic credential callbacks and a matching role do not
prove installation or native access. The three separately delegated retained
operations and their signed envelopes are unchanged.

Startup confirmed its real action-session bearer is private with no extraction
API. The request-local product bearer closure is not an allocated READS producer.
Its service-secret callback has a consumer but no producer. Parent allocation and
review of genuine purpose-bound credential ownership plus exact production
composition, installation/discovery and release checks remain required. Missing
either producer keeps this owner unavailable before any task or Core I/O.

Focused tests use real Meri task/store/transport implementations with scripted SQL,
synthetic HTTP JSON, roles, revisions and credentials. They do not qualify Core,
PostgreSQL durability, native authentication, permissions, runtime or release.

The two modules received independent local source review, with a P2 cancellation
finding preserved and repaired: the secret await now combines original gateway and
callback signals. The repair passed88 receiving controls; the separate mounted
gateway wiring passed53 focused controls including legacy bill and ledger checks.
The review is bound to exact readable module hashes; reviewer Git custody access
was denied and was not retried. New gateway wiring has separate review status.
