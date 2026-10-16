# Acquisition personnel native read adapter

Shared integration adds the existing `credentialsForCall(operation, call)` trusted CONTROL hook, mutually exclusive with `getCredentials`. The CONTROL owner joins the original request and gateway signal with current canonical Core principal, separate identity/member revisions and exact effective role. Missing genuine producers remains unavailable. The original reviewed source remains pinned at `857163136a1e1e38b08f73f1b5a6d32df1ae0571`; this hook does not change native audit effects or frozen receiving policy.

Independent shared-source review found a trim/clip boundary defect in the original search transport. Search now sends the original validated flat request so the Core wrapper normalizes selectors once. This preserves trailing blanks produced by clipping `service`, `organization`, `role` or `peCode`; the credential proof and receiving validation still bind the original request and canonical normalized digest. Detail continues to send the canonical UUID. The original reviewed pin and the earlier 124-case integration receipt are preserved; the correction is a separate successor.

Local implementation outline (base `fb708d231c7273f86b1462c72a72e70ccc36a3d6`):

- `request-context.mjs` admits the existing operation, current gateway authority and
  exact canonical `{actorRole}` context. No role is derived from model selectors.
- `handler.mjs` composes that admission with the existing bounded retained HTTP
  transport and canonical receiving validators. Two fixed flat POST routes only.
- `general-reads/families/acquisition-personnel.mjs` composes canonical operation
  references. Shared registration, dispatch, worker fixtures and ledger stay with
  the READS owner. Nothing here installs or qualifies a production handler.
- Native Core owns authentication, PII projection, supersession policy and audit
  writes; gateway dispatch owns current authorization, budgets and release.
- Focused synthetic tests exercise actual Fetch JSON bytes, native-shaped DTOs,
  canonical normalization/validation, authority correlation, deadlines and refusal.
  No native service, DB, provider, credential or deployment qualification is claimed.

## Producer and receiving boundary

Actual producer: `neo-capiro/capiro-backend`
`b525032222515d636b0dae2d46e40c7c3d8b5528`,
`apps/api/src/meri/meri-tools.service.ts:5241-5277`, delegating to
`AcquisitionPersonnelReadService`. Published sanitized mapping:
`384325afaaf7ad34aeb9ff9b2f183d667ee17343`,
`docs/retained-read-producer-mapping-20261016/federal-producers.json`,
`#/operations/7` and `#/operations/8`.

`POST /api/clio/tools/search_acquisition_personnel` and
`POST /api/clio/tools/get_acquisition_person` receive flat input. Search sends the
original validated request; detail sends the normalized canonical UUID.
The response is the native raw DTO after HTTP JSON serialization. The private
gateway envelope is exactly `{binding,subject,operation,argumentsSha256,result}`.
No source/result fields are invented, removed, repaired or redacted locally.
Invalid native output is withheld using the frozen canonical validators.

Search preserves the native query/q preference, UTF-16 caps, defaults and bounded
fuzzy count semantics through canonical normalization. List fields match the
frozen row projection, including opaque `headshotUrl` and `sourceCount`. Detail
preserves all source mentions, their native ordering, opaque metadata and exact
UUID identity. It has no top-level headshot or invented empty/not-found result.
Native exceptions remain refusals. Dates cross real JSON bytes as canonical ISO
strings. Producer fieldwise comparison is source evidence, not live conformance.

Both wrappers invoke mandatory native audit writes. List intentionally does not
forward `include_superseded`; detail preserves direct lookup of superseded IDs.
The adapter never retries or calls an alternate route after an uncertain audit.
For non-admins, native email/phone/parentOffice/department must be null and detail
metadata must omit `uploadedDirectoryContact` and `uploadedDirectoryPrevious`.
Only actual current Core `ctx.role === 'capiro_admin'` enables those projections.
Source mention metadata remains opaque under the frozen contract.

## Availability and credential ownership

Configuration is closed to `origin,now,getCredentials,credentialsForCall,fetchImpl,
maxRequestMs,maxResponseBytes`; the two credential callbacks are mutually exclusive.
There is no delegated ALL3 transport, custom endpoint, ambient
credential, role resolver or new role receipt. Missing credentials or role context
remain UNAVAILABLE. Input `role` is a personnel filter, never caller authority.

The existing credential callback correlates binding, subject, operation, policy,
source IDs, argument digest, original request digest, normalization context and
origin. Native user JWT **and** internal-service-secret are required. Its echo
proof does not establish current Core role or the JWT principal relationship.
No genuine role-corroborating CONTROL owner was demonstrated at the original base.
Shared dispatch must keep this family unavailable until that owner is allocated
and qualified. A future genuine owner must independently recheck the native JWT
principal's current Core role against captured `actorRole` and the current gateway
binding/subject/policy/source/digests. That behavior is not implemented here.

Frozen context keys are exactly `[actorRole]`; valid values are `capiro_admin`,
`user_admin`, `standard_user`, `client_portal_user`. Generic application membership
roles, guessed role mappings and model values cannot fill this gap. Rechecking
current context at dispatch/release, installation receipts and durable accounting
remain shared integration gates. Source metadata's false qualification/truth
flags remain unchanged. Local source commits do not activate the family.

The native route requires at least `standard_user`. Frozen context syntax also
permits `client_portal_user`; that does not authorize the native route. Native
role-guard refusals propagate; the adapter never silently maps this role upward.

## Local verification and review

Independent OpenAI/Codex source review: ACCEPT for passive local source;
production HOLD. No shared file or frozen contract changes. Source implementation
is two cohesive modules: admission/correlation and fixed-route execution. No new
dependency, runtime loop, current-role authority or registration is introduced.

Focused command (actual canonical validator, transport and synthetic Fetch):

```text
node --max-old-space-size=128 --test --test-isolation=none --test-concurrency=1 --test-reporter=tap apps/gateway/sources/acquisition-personnel/test/handler.test.mjs packages/contracts/test/retrieval-acquisition-personnel.test.mjs packages/contracts/test/retrieval-acquisition-personnel-independent.test.mjs
```

Final 81/81 PASS: 29 adapter/family cases and 52 existing canonical contract cases.
Single process with 120s supervisor wall and 128MB V8 old-space limit; Node
24.19.0; test duration 721.6752ms. Sampled peak working set 109,559,808 bytes is
an observation, not a total-process memory guarantee. Primary exit0. No owned
process remains. TAP SHA256:
`8f05e364d5598781cf455d269e7a359698220d731c8575a9fae94d5de1dcde95`.
Local supervisor evidence is retained outside Git in this task workspace as
`acquisition-corrected.{stdout.tap,stderr.txt,execution.json}`.

Initial 76/81 failure evidence remains as
`acquisition-initial.{stdout.tap,stderr.txt,execution.json}`. It exposed missing
role's undefined JSON admission and malformed subject classification, both fixed
without weakening assertions; the fifth failure was an assertion against a
nonexistent descriptor status field, corrected to canonical handler/availability/
qualification fields. No initial failure was replaced or presented as a pass.

No native HTTP, DB, audit transaction, SDK, model/provider, build/compiler, cloud,
live data or deployment check ran. Qualification was notified of this bounded
offline scope; integrated heavy checks remain with that owner. Production current
role, native principal relation, audit effects, exact installation/discovery and
shared dispatch/release/accounting integration were separate gates at the original
source checkpoint. The approved original pin was subsequently published unchanged.
The CONTROL hook, search correction and shared integration have separate pinned
source reviews and focused evidence; genuine runtime qualification stays pending.
This successor is local until the finite publication packet is approved. This
documentation-only sanitization removes process/workstation metadata without
changing source behavior or the preserved original proof.
