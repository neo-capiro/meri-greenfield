# Public-web contract author packet

Final source candidate `c7d2bb344d56552d271c3f8d508b99cb8e2bb970`, tree `b7e8366162a549f0c4a567a1f43698bb97f9c9a8`, is **ready for independent source review**. It adds private DTO contracts for `search_public_web` and `scrape_web_page`. It adds no provider, fetch, parser, handler, runtime admission or canonical registry entry. Root owns integration; source connectivity remains unavailable.

The exact isolated base is `c1c9bfde7dd466a0474589a224a99b44277adbc9`. The implementation outline was committed at `8a1eb8e` before code. AGENTS, implementation standards and adopted R2 preserve SDK/tool ownership: eventual public search must use supported SDK tools or a qualified provider, and page extraction must use the approved sandbox/egress/watchdog path. This family does not introduce a universal adapter or recreate legacy network/parser implementation.

## Modules and interface

One cohesive private schema, `public-web.schema.json`, has ID `urn:meri:retrieval:public-web:0.2.0`; `public-web-validation.mjs` owns DTO normalization and projection relations. `retrieval-public-web.test.mjs` contains the focused synthetic controls. The validator depends only on the existing canonical `snapshotOperationData` inert-JSON boundary. No new package, license, lock, shared helper or public export was added.

`createPublicWebValidators({validateShape,schema})` exposes:

- `PUBLIC_WEB_OPERATION_IDS`, `publicWebSchemaId`;
- `publicWebInputDefinition(id)` and `publicWebOutputDefinition(id)`;
- `normalizePublicWebInput(id,request,options={})`, returning detached frozen `{input,metadata}` with empty frozen metadata;
- `assertPublicWebOutput(id,value,request,options={})`, returning detached result data;
- `validatePublicWebShape(definition,value)`.

Definitions use `PublicWebSearchRequest/Input/Output` and `PublicWebPageRequest/Input/Output`, provider-specific rows, and separate HTML/PDF output/coverage shapes. Context keys are **empty**; nonempty options are rejected. No model/caller clock, actor or provider selection is accepted. Generated timestamps are canonical ISO metadata, not freshness proof.

Search requires query trim/UTF-16 slice240 without a second trim. Limit retains finite numeric/string conversion, truncation and clamp1–12/default6. Page URL trims/slices2000; mode trims/slices20/default`summary`, preserving arbitrary case-sensitive strings. Only exact `extract` changes default maxChars from4000 to12000. MaxChars retains finite numeric/string conversion and clamp500–20000. Null numeric values use the source fallback. Unknown fields, complex coercion, nonfinite numbers, accessors and proxies are refused.

The old advertised scrape input schema lists URL only; the pinned producer also consumes mode/maxChars. This private contract explicitly exposes those existing producer inputs. URL admission is intentionally limited to standard absolute HTTP(S) syntax and no embedded credentials for the request/final response URL. It is **not** a private-address/DNS/rebinding/redirect/egress authorization check. Pure syntax can accept a loopback-looking fixture; it must never trigger a fetch. Projected HTML links permit credentials because their pinned projection does not apply the main-response credential rule. Their public-network safety remains unqualified.

## Exact search and page projections

Tavily and Serper rows require `title,url,snippet,source,publishedAt`; DuckDuckGo rows omit `publishedAt`. Null snippets and provider publication text remain distinct from absent properties. Provider publication text is opaque normalized text, not an ISO date. Title180/snippet320/publication40/providerURL2000 caps are measured in UTF-16. Tavily/Serper URLs have only the producer's HTTP-prefix constraint; malformed prefix-only text can pass that projection and is not fetchable authority. DuckDuckGo retains raw nonempty URLs without a fabricated HTTP rule. Returned count equals array length and respects request limit; duplicate search rows are legitimate. All envelopes retain `contentStatus:discovered`; snippets are not full evidence and empty results are not absence proof.

HTML results preserve nullable uncapped normalized title, lowercase contentType, text, totalChars, truncation, at most eight distinct links, and raw-byte SHA-256 spelling. PDF results instead require `kind:pdf`, title null, nonnegative safe-integer pages, no links, and full normalized extracted-text totalChars. PDF totalChars is **not** a byte count and can exceed displayed text length. Both preserve `authoritativeOwner:public_url`, `currentStatus:available`, `trust:external_untrusted`, locator final URL, UTF-16 character range and matching completion/truncation flags. These literal fields describe the producer claim; the DTO cannot authenticate it or verify bytes.

HTML untruncated totalChars equals displayed UTF-16 length; truncated HTML totalChars is null. Request-bound truncated HTML/PDF fills the requested maxChars window; truncated HTML ends with an ellipsis. PDF need not end in an ellipsis because normalization can trim the extra prefix whitespace. PDF truncation is exactly full totalChars greater than maxChars, and an untruncated PDF total equals displayed length. Content-type/suffix relations constrain the declared HTML/PDF branch but perform no MIME sniffing or extraction. Final URL may differ from request after redirects; equality is deliberately not required.

No validation establishes correct retrieval, complete source coverage, actual hash bytes, current content, provider availability, source permission or redirect safety. No private-address classifier, DNS logic, HTTP request, HTML/PDF parser, browser orchestration or provider request implementation is copied or executed. Existing source controller role, current request-active and service-identity guards remain independent execution prerequisites.

## Verification and preserved negative control

Initial source `306734d65e90c079bf150a9a93f9be74fcc0e285` passed26/26 focused controls. Self-audit then found that its truncated-page relation was too permissive: a short HTML text marked truncated was accepted even though the pinned producer fills maxChars. A new test was committed at `4c3d84e4e524ccb9cc9404df26d97a6d72de78b1` and replayed unchanged: **26 passed / 1 failed of27**. The first short-HTML assertion failed; later assertions in that same test were not reached. Raw failure and original source remain preserved.

The repair adds only request-bound truncated-window length and HTML ellipsis checks. Two invalid positive fixtures were changed from short partial text to the full requested window. Their assertions remain, the original entire author test is retained, and the appended negative assertions are unchanged. Schema and API are unchanged. The final replay is **27/27 pass**, no skips, zero source diff:

```sh
python3 -B docs/qualification/candidates/read-continuation-20261012/public-web-author/capture-reaped.py focused-truncation-repaired node --test packages/contracts/test/retrieval-public-web.test.mjs
```

Controls include provider-specific fields, raw publication/URL distinctions, repeated search rows, empty results, HTML/PDF nulls and branch rules, complete/partial coverage, signed URL-independent hash syntax, UTF-16 boundaries, unknown fields/context, hostile selectors/getters/proxies, immutability and actual canonical resolver argument hashing using a test-only unavailable descriptor. The test does not edit or qualify the canonical catalog.

Offline integrity verification passes **78/78**. It binds all three source files, ten complete private reference pairs (all unchanged between `fd8765ec01d292013758606204f2c9d886cd31c1` and `4be13b0b1ed0f2f3fa014040eedbb2fc2c27dace`), all raw captures and **6,528 original complete file blobs/modes**. Only metadata is retained from private references. The canonical loader/catalog, public0.1 files, original tests and dependency notices remain unchanged. Seven existing installed packages (1,374,227 bytes) were physically reused; no package installation or donor mutation occurred.

All three owned focused-test process groups are absent, with no timeout or cleanup kill. The initial absent neighboring validator lookup is recorded as a metadata readback mistake, not a source failure. Broad/public checks were not run in this bounded lane; root owns combined verification. Independent acceptance remains pending. No source/provider/network/model/SQL/native/browser/renderer/parser/service/cloud/customer/frontend action occurred.

The [verification record](../../qualification/candidates/read-continuation-20261012/public-web-author/verification.json), [reference identities](../../qualification/candidates/read-continuation-20261012/public-web-author/reference-identities.json), [repair record](../../qualification/candidates/read-continuation-20261012/public-web-author/truncation-repair.json) and packet manifest retain the exact evidence.
