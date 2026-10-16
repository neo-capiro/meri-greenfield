# Public report source boundary

Implementation outline, pinned to Meri `fb708d231c7273f86b1462c72a72e70ccc36a3d6` and Core producer `b525032222515d636b0dae2d46e40c7c3d8b5528`:

- `handler.mjs` owns the three canonical `public-reports` searches. The family entry point only composes canonical operation references. Shared registration, dispatch, authority, accounting, contracts and fixtures stay with READS.
- Reuse `retainedCall`, the receiving operation contracts and the bounded retained HTTP transport. Configuration permits only the origin, injected clock, native credential callback, fetch implementation and request/response limits. There is no delegated protocol or fallback.
- Call the existing `POST /api/clio/tools/<nativeId>` routes with the original validator-admitted flat request. The producer normalizes once; sending an already lowercased/capped CBO bill ID changes its no-estimate note and can truncate Unicode lowercase expansions. The credential proof still binds the effective input hash and original request hash.
- Require the existing native user bearer and additional internal service secret. Missing credential ownership stays `UNAVAILABLE`. Do not infer current authority from this adapter or its synthetic test receipts.
- Preserve the raw HTTP JSON DTO, including serialized dates, separate GAO/CRS counts and the CBO no-estimate disclosure. Validate it against the original request with exactly `{}` normalization context. Return only the private `{binding,subject,operation,argumentsSha256,result}` carrier.
- No state, database, provider, live source, installation, shared-file or publication changes. Source admission and transport own deadlines/cancellation/body cleanup; gateway dispatch owns current authorization, result release and budget accounting.
- Verification is bounded offline Node tests with injected synthetic credentials/fetch: fieldwise DTOs, defaults and cap boundaries, original CBO labels, invalid input/output, proof substitution, missing credentials, native errors, cancellation, expiry and byte limits. Synthetic results do not qualify native principal/role ownership, physical cancellation or live connectivity. Review the handler/family for cohesive responsibility and canonical reuse; no new framework or size quota is needed for this small adapter.

Producer mapping is the existing docs-only Core commit `384325afaaf7ad34aeb9ff9b2f183d667ee17343`, `docs/retained-read-producer-mapping-20261016/federal-producers.json`, records `/operations/4`, `/operations/5`, `/operations/6`. The source implementation is local only; registration and activation require separate integration-owner review.

Verification on NEOMART, 16 October 2026, Node `v24.19.0`:

```text
node --test --test-concurrency=1 apps/gateway/sources/public-reports/test/handler.test.mjs packages/contracts/test/retrieval-public-reports.test.mjs packages/contracts/test/retrieval-public-reports-independent.test.mjs
92 passed / 0 failed / 0 skipped (30 source tests, 62 existing contract tests), 1144 ms
```

Syntax checks passed for the handler, family and test entry point; staged whitespace verification passed. Independent Codex source/contract and implementation reviews returned ACCEPT with no remaining findings. No live producer, current native credential ownership, shared dispatch integration, budget settlement or installation/activation claim is established by these checks. READS retains those shared responsibilities. No source was pushed, uploaded or otherwise published.
