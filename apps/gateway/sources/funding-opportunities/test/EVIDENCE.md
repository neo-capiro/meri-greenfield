# Funding source adapter evidence - 17 October 2026

Base: `615a5467ffa555f913ad49258b3919723ecf207d`, branch `codex/meri-funding-asof-20261017`. This lane owns only the new funding source handler, pure request helper and focused fixture/tests/evidence. No backend, frozen contract, shared transport, registry, SDK, deployment or credential configuration is edited by this lane.

The implementation outline agreed before source edits uses the existing shared retained native handler for source admission, current credential proof, bounded fixed-route HTTP, receiving validation and the Meri envelope. The family handler owns only five exact native routes and client-subject admission. The pure helper owns explicit native client selection; CONTROL owns the once-captured trusted clock and current visibility. The shared observation transport is coordinator-owned and uses the finite `observation: 'funding-asof'` specification. There is no second transport or normalizer and no source output bridge.

## Actual producer and boundary

The audited producer is `neo-capiro/capiro-backend@b525032222515d636b0dae2d46e40c7c3d8b5528`:

- `apps/api/src/meri/meri-tools.service.ts`, L2747-L2792: fixed dispatch for the five funding reads. It passes the original tool fields to the existing funding adapter; the existing pin does not pass the adapter's supported third `asOf` argument.
- `apps/api/src/funding-opportunities/meri-opportunity-tools.adapter.ts`, L265-L296: every funding read applies native feature flags, role, UUID and current tenant/user client visibility before its source. All five frozen inputs require an explicit UUID client; search is not unscoped.
- The five methods at L302-L497, L559-L621 and L625-L688 already accept an explicit third `asOf`. Native record reads, matching/eligibility, requirement review, source coverage and landscape composition remain with their actual native owners.

`captureFundingClientSelection(operation, request)` validates the exact frozen request shape and returns a frozen lower-case client identity without trimming, coercion, clock capture or raw-body rewriting. `assertFundingClientSubject(subject, selection)` requires exactly that one client and a matching client-resource scope, refuses extra different client-resource scopes, and permits canonically valid shared tenant scopes. The private current owner must additionally prove current visibility. Source HTTP requires per-call credentials, native user identity and the service secret; static credentials and unqualified delegated transport cannot silently use the observation path.

This source adapter sends the raw flat request to the fixed `/api/clio/tools/<id>` route, carries exactly `{asOf}` privately with the original request hash, and returns the complete native JSON only after frozen receiving validation. A missing/substituted source clock is refused; no timestamp or DTO is patched and no legacy retry is issued. Search source generation/freshness clocks may remain independent of envelope `asOf`, as the frozen contracts require. A source calculation anchor does not grant client permission.

## Verification

Command, run serially using the borrowed Node 24 dependency overlay:

```text
node.exe --preserve-symlinks --max-old-space-size=256 --test --test-concurrency=1 apps/gateway/sources/funding-opportunities/test/handler.test.mjs
```

The initial run passed **25/26** and retained one failure: `clientId: undefined` failed during whole-call inert snapshotting and surfaced `INTERNAL_ERROR` before the request validator could classify it as `INVALID_ARGUMENTS`. No credentials or source HTTP occurred. The handler now performs pure canonical request capture before the whole-call snapshot, preserving the assertion. The corrected run passed **26/26**. A later UUID-selection guard check retained **26/26**. The coordinator then requested explicit generic-factory bridge/mode guard and delegated-fallback assertions; the final expanded suite passed **28/28**, with no skipped or cancelled tests.

Coverage includes all five fixed POST routes, unchanged raw/default requests, complete receiving carrier, exact private observation and original credential proof; trusted-clock substitution; mandatory client selection and hostile inert values; coherent client grants plus valid tenant scopes; absent/revoked current owners; search page clamp and independent source generation; UTF-16 notice continuation; grant/contract money and missing-value distinctions; pending/rejected/superseded extraction, quote spans and requirement continuation; sampled versus broad counts and deadline facts; eleven-source landscape coverage, inferred basis, fingerprint and original truncation counts; all native refusal states; unknown/private/oversize DTO rejection; tenant/request proof mismatch; HTTP failures with no retry; cancellation and expiry; and finite constructor/observation/delegation guards.

Only synthetic native JSON and current-owner fixtures were exercised. **The actual Core HTTP observation-to-third-parameter bridge remains pending. These five reads are `PARTIAL_TRANSPORT`, SDK exposure is withheld, normal runtime configuration remains unavailable, and live qualification remains zero.** Matching output timestamps are not proof that a server consumed the carrier. No live query, backend change, installation, archive, migration, deployment, staging or commit was performed.
