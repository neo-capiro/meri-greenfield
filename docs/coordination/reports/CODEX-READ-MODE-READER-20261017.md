# Native read-mode observation reader — 2026-10-17

Base: local `4359e05bd11b7756d4f1d42fcd2243b3e07f126b`, isolated branch `codex/meri-read-native-next-20261017`, public PR125-equivalent. Owned changes are the new private read-mode reader and focused tests, plus the narrow existing Core client method export. No startup, shared contracts, registry, Core, credentials, installation or live qualification changes are allocated.

## Outline recorded before implementation

Use the existing `createClientReferenceReader` pattern and canonical operation lifetime, authority identity validator, closed inert data boundary, HTTPS origin validator and bounded strict UTF-8 JSON response reader. Add one cohesive `read-mode-observation.mjs` module exporting `READ_MODE_MAX_REQUEST_MS=3000`, `assertNativeReadModeObservation(local,{started,now,operation,requestSha256})`, and `createReadModeObservationReader({available,origin,fetchImpl,authorityClient,now,maxRequestMs})`. Reuse the root-owned finite `MODE_READ_OPERATIONS` registry once available; do not infer families or expand IDs.

The input is closed `{credential,serviceSecret,operation,requestSha256,deadlineMs,signal?}`. Validate exact finite `0.2.0` operation and lowercase SHA256 before any identity or HTTP call. The fixed POST `/api/clio/application-authority/read-mode-observation` sends only `{operation,requestSha256}` and the exact admitted Bearer/internal service secret headers. Omit cookies and cache; reject redirects and non-2xx status. Parse at most 4096 bytes of uncompressed strict UTF-8 JSON. Its closed response must echo operation/hash, match the bracketed principal, declare `surface:'chat'`, and contain exactly one of `off`, `shadow`, `enforce`.

Read actual identity before and after the fixed mode HTTP call, requiring equal principal and identity revision. Preserve the first identity expiry, second identity expiry, caller deadline and configured observation window; never extend an earlier bound. Cancel acquired and late response bodies; close only this reader's lifetime, never the borrowed authority client. Return the closed frozen local projection `{principal,identityRevision,operation,requestSha256,evidenceAccuracyMode,checkedAtMs,expiresAtMs}`. This is a local observation of current native mode, not a server-issued grant, receipt, resource revision or qualification fact.

Expose `readModeObservation` alongside the existing Core client's methods with no existing method behavior change. Parent owns private context/wire admission and any consumption of this observation.

Focused offline tests will cover every finite operation/mode, exact wire and header shape, fresh identity coherence, principal/revision/echo drift, closed bodies and hostile values, byte/encoding/media/status bounds, all expiry bounds, early cancellation/no-I/O admission and cancellation of streaming or late bodies. Preserve the initial process stdout/stderr and exact command/source hashes before repairs under `read-mode-reader-20261017/`. No live endpoint or production qualification is exercised.

## Implementation and ownership

Implemented the outlined reader and projection validator in `apps/runtime/native-authority/native-read-credentials/read-mode-observation.mjs`. The operation allowlist is imported directly from the root-owned `MODE_READ_OPERATIONS` export in `packages/contracts/native-read-observation-0.2/validate.mjs`; no second operation registry was added. The actual existing application-authority HTTP client's `readIdentity` brackets mode HTTP. The mode response's principal must match that identity, its operation and raw request hash must match the captured call, its surface must be chat, and its mode must be exactly off, shadow or enforce. Both bracketed identities must preserve principal and identity revision.

The caller's operation is captured as inert frozen data before the first await. Bearer credential and service secret must each be exact visible ASCII header strings, length 1–8192, matching existing native HTTP token admission. The reader forwards the supplied secret; actual secret validity belongs to the native endpoint and the parent-owned trusted secret getter. A 403 remains unavailable and never selects a legacy or identity-only fallback. The secret appears only in the fixed mode request header and never in either identity request, request body, local projection or error.

The local observation expiry is the minimum of the caller deadline, initial reader window and both actual identity expiries. The first shorter identity expiry remains retained even when the second identity advertises a longer lifetime. Streaming, acquired rejected and late bodies are cancelled without waiting for physical transport retirement. The borrowed identity owner is not closed. This local observation has no server-issued expiry, resource revision, permission or qualification receipt; parent-owned native authority and private carrier consumption remain separate requirements.

The only Core-client changes import this reader, construct it with the same existing fixed-origin identity owner, and expose `readModeObservation` alongside the existing methods. The disabled client exposes a callable unavailable reader. No existing method behavior, startup path, configuration contract or credential issuer changed.

## Focused verification and evidence

[Initial full stdout](read-mode-reader-20261017/read-mode-initial.stdout.txt), [stderr](read-mode-reader-20261017/read-mode-initial.stderr.txt), and [exact metadata](read-mode-reader-20261017/read-mode-initial.json) record **109/109 passed on the first run, exit 0**, no skips or cancellations. This comprises the new mode-reader tests and unchanged existing Core-client suite only. Node v24.19.0; 256 MiB; serial; 30-second per-test timeout; total test duration 1.636 seconds. Full streams and metadata were written before returning command output. No test repair or repeated full run was needed.

The checks exercise all five finite operations in all three modes, native 2xx responses, exact body/headers, identity principal/revision drift, closed malformed results, operation/hash substitution, all expiry caps, fresh repeated observations, inert input capture, strict UTF-8 and 4096-byte limit, no-I/O invalid admission, service-secret refusal without fallback, pre-abort/expired requests, regressing clocks, and acquired/streaming/late-body cancellation. The Core-client suite confirms its existing identity/membership behavior remains unchanged. Syntax and owned whitespace checks passed. Before-run source hashes match the final owned files; archived stdout/stderr byte counts and hashes were independently read back and matched.

Author source freeze SHA256:

- Reader: `19b1a22067bf964499ed5c706d1daa7e8a7c641cf469b0ae6dc2c8298a52233f`.
- Core client: `a5939600c8a8d45c5095865ad8ddd34e228ce9be44b38689ea45818e776c35d5`.
- New tests: `4b4a2a21e2636d7ac39b1d917574219b39cdb0154119bec7a1c71c8512da47c6`.
- Initial process metadata: `02c29ef0667950200e983dc3a78bc5e3adcfb5c20049695eadaf252c26d11ff2`.
- Stdout: 8492 bytes, `92c8ad663eadaa5b0edd7facb6a5d5ebb41a291560254e337239c8e2232ba5bf`; stderr: zero bytes, `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`.

Independent review is coordinated by the parent against the complete Core/Meri mode packet, including the actual current shared registry, owner and Core successor. These offline fixtures do not establish that a production server implements the endpoint or consumes the new private mode carrier. Source compatibility, integrated installation and server qualification remain parent-owned. No live endpoint, real source/database/provider/cloud, build, install, staging or commit was used by this reader task.
