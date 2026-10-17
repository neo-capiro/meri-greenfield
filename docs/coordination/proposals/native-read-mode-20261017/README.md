# Minimal native evidence-mode observation proposal

Status: source-only proposal, not an allocated Core route, implemented protocol or installation. Core first-chat work retains priority; this packet must use a separate source branch. Meri PR119 remains the accepted finite-six asOf checkpoint. No shipping source/image, credential, provider capture or deployment is changed.

## Existing behavior and minimum fact

Reviewed Core `59efe08f2f3429918758eef30539e9dde4dbb868`, tree `c2babd8e0d386b1c9f18ed32ebcd4472d5ebf486`. `apps/api/src/common/meri-evidence-accuracy-flags.ts:13-19` delegates to `rollout/evidence-accuracy.ts:11-21` and the canonical `rollout/capability-rollout.ts:85-110`. The actual authenticated tenant, literal `chat` surface and MODE/TENANTS/SURFACES inputs determine one enum. Presenters consume only that enum. Existing identity/context/membership, clio status/tool-schemas and v3 capabilities expose no such observation; status provenance is a different gate.

The smallest proposed private request is exactly `{operation:{id,version},requestSha256}`. Initially allow only `search_federal_grants@0.2.0` and `search_federal_awards@0.2.0`, with a lowercase SHA256 of the original parsed, unnormalized flat request. Reject caller tenant, actor, mode, clock, surface, origin or arbitrary operation fields.

The response is exactly `{operation,requestSha256,principal:{tenantId,actorId},surface:'chat',evidenceAccuracyMode:'off'|'shadow'|'enforce'}`. Core supplies the actual principal and actual canonical resolver mode. The existing CONTROL identity/membership observations, original request correlation and bounded invocation lifetime remain mandatory. The response supplies no grant and is not a production qualification receipt.

No rollout epoch, opaque configuration digest or separate mode generation is needed. An off-to-shadow-to-off transition is irrelevant if this invocation consumes off; configuration edits retaining the same effective mode do not change these result semantics. Current identity/membership/resource revisions and exact deployed source/origin/config qualification remain independent requirements.

## Native consumption and separate ownership

Proposed Core seams, pending exclusive path allocation: a thin `auth/application-read-observation.controller.ts` and domain service registered through the existing application-authority module; finite additions in `meri/meri-funding-read-observation.ts`; existing controller admission; and only the grants/awards consuming branches in `meri-tools.service.ts` (4926/5339 at the reviewed pin). Reuse the canonical mode resolver, native bearer and actual matched service-proof admission. Do not edit the PR48 shipping packet or start a generic observation framework.

Extend the private carrier with two explicitly finite operation arms whose context is exactly the already-frozen `{evidenceAccuracyMode}`. Keep all five funding and semantic KB golden bytes, outer header/schema/version, strict canonical encoding, original body hash and bounds unchanged. Public retrieval contracts and model tool arguments stay frozen.

For opted-in calls, resolve actual mode before querying, compare all three enum values with the observed expectation, and use that same compared value throughout the producer. A mismatch fails before source work. A final equality check may refuse later actual mode drift. Preserve ordinary legacy calls' existing sampling behavior. Shadow cannot collapse into off: it has logging behavior, and PE detail/timeline also load lineage in shadow.

Preserve grants' own asOf/generatedAt clock, Eastern deadline calculations and enforce-only structured deadlines; preserve awards' date projections. The mode fact is not a caller clock. Program-elements can subsequently reuse the same actual mode seam as a complete three-operation packet; SAM additionally requires its three distinct native clock observations. No family advances source accounting merely because this proposal exists.

## Focused acceptance

Core owner should qualify exact original-body correlation, closed two-operation mode arms, principal/tenant isolation, malformed values, all three modes, drift-before-source, existing legacy behavior and the exact native producer branches. Meri then adds the corresponding trusted fixed-route reader, private context/carrier and complete public-data adapter/SDK tests under current task, membership and installation owners. Publish and independently bind exact Core source before promoting Meri source metadata. Actual installation, native transport and live qualification remain separate gates.
