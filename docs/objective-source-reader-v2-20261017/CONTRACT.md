# Objective reader v2 frozen source contract

Canonical schema/descriptor owner: `packages/contracts/objective-reader-2/schema.mjs`.
`emit-schema.mjs` expands pinned existing canonical candidate/native references
into self-contained `reader.schema.json` for exact-hash Core consumption.
This is a distinct protocol. Existing Meri v1 EdDSA gate, historical Core flat
RS256, and Temporal protocols remain unchanged. No dual-accept fallback exists.
No source HTTP mount is authorized by this contract freeze.

## Closed wire and trust

`Request` is exactly `{schemaVersion:2,purpose,generationJobId,sourceAdmissionSha256}`.
JSON entity bytes use that exact key order without whitespace; no caller binding,
actor, tenant, grant, URL, proof, path, material or result is accepted. Purpose
selects only the fixed descriptor route. A trusted custody lookup independently
resolves binding. Body identity is a comparator, never a mapping creation input.

Ed25519 JWT header is exactly `{alg:'EdDSA',typ:'capiro-objective-reader-v2+jwt',kid}`.
`Claims` has exactly `{iss,sub,aud,iat,nbf,exp,jti,objective}`. Closed nested
`Scope` binds purpose, operation, phase, POST, exact path, empty query, whole raw
body SHA256, generation job and source admission SHA. Every nested relationship
must match the selected descriptor, not merely pass enum validation.
Maximum token lifetime is 60 seconds; issuer/subject/audience/kid pins are
server-owned and qualified independently for each purpose. Key material cannot
be shared across purposes. No URL/JWK/private key comes from a request.
The source-admission commitment is deliberately named: it is not a digest of
the complete custody record, which Core cannot know before source discovery.

Normative time checks use safe, nonnegative integer seconds and no skew:
`iat <= nbf <= floor(nowMs/1000) < exp` and `1 <= exp-iat <= 60`.
The header and payload use the descriptor's declared key order with compact
JSON; canonical re-encoding must equal their decoded UTF-8 bytes, refusing
duplicate JSON fields, whitespace and alternate encodings. Nested scope order
is purpose,operation,phase,method,path,query,bodySha256,sourceAdmissionSha256,
generationJobId. Signature is exactly 64 bytes; base64url is canonical/unpadded.
Observation checkedAtMs is within this read (`readStartedAtMs <= checkedAtMs <=
nowMs`). Outer expiresAtMs must remain strictly in the future and no later than
the request token expiry, readStartedAtMs+3000, and every fresh native authority
or custody proof deadline. Invalid/backward clocks and expired checks deny.

Read-only gates require fresh native authority before and after every initial
read and replay, plus durable issuer/subject/JTI/token-byte idempotency. Missing,
conflicting or uncertain custody/idempotency stays unavailable. Signature
validity establishes caller authentication only, never user or source authority.

## Nonsecret source observation

`Observation` is a closed whitelist. It exposes the original admission, complete
binding, sanitized immutable issuance identity (including digests, never raw
capability), accepted request/prompt hashes, typed request/context hashes, chosen
type, run state and bounded observation timestamps. It exposes no prompt/context
text, owner credentials, materialRef, proxy URL/configuration or capability value.
`sourceAdmissionSha256` uses Core's existing finite sorted-key digest; accepted
request, typed request/context and whole-facts digests use Meri JCS. Binding
equality must follow existing finite binding semantics, with all seven fields.

Active source requires queued/starting/running, actual original admitted task
proof, already-ISSUED matching facts, and fresh native/source access. Observation
expiry is the minimum of original execution/issuance expiry, fresh authority,
task proof, request token and the three-second read deadline.

Historical source requires terminal completed/failed/cancelled state and fresh
native retained-source read authority. It reads immutable ISSUED metadata via
the durable store's read-only metadata port, not expired active readIssuance.
Original issuance.expiresAtMs may be past; outer expiresAtMs is a fresh read
deadline and cannot renew execution authority. Current access and exact custody
must be rechecked after read. Retained result additionally requires existing
completed/PUBLISHED journal, exact object versions/bytes and current access;
it uses the existing strict result owner. `Retained` freezes that owner's exact
v1 closed response envelope and canonical candidate Result schema; the new v2
transport does not wrap arbitrary result JSON or change its payload schema.

## Immutable custody and source controls

The wire schema freezes transport projections. The private immutable custody
record is owned and closed by the Objective source module; it is not a public
wire/storage schema in reader.schema.json. Its later persistence adapter and
any migration must be separately allocated and reviewed.

Only an owner operation over canonical accepted run/request and already-ISSUED
protected facts may publish the global generationJobId mapping. It derives
binding from the accepted run and checks all seven against immutable issuance
and whole-facts identity. Admission/job derive from validated facts. There is
one immutable record: identical replay only, changed admission/binding/facts
conflicts, uncertain publication requires exact durable readback before success.
No read-caller JSON and no resolveFacts result can enter the write authority.

The fact decorator validates the canonical typed Request and existing Objective
pair before the actual immutable bindFacts call. Existing bound digest permits
equality only. No original expiry, grant, capability digest or binding changes.
Shared compiler/reconstructor splice awaits Meri integration owner review.
No persistence schema/migration ID is inferred or activated by these pure ports.

These source contracts do not enable Core delegations, supply live keys/grants,
mount readers, accept browser writes or qualify production durability. Positive
composition fixtures must explicitly label synthetic keys/storage/native HTTP.
