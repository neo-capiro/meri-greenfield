# Package 3 browser/PDF re-review

15 October 2026, 22:12 UTC. Independent read-only source review and isolated synthetic tests. Fable owns implementation.

## Scoped verdict

**ACCEPT the package-3 PDF reference-coherence repair at `81e20025b7a805ac28a44f2044df87b0ebab905b`. The remaining package-2 PDF R1 source HOLD is closed. The previously accepted browser H1–H5 corrections remain accepted within this review's scope. Browser live activation and native artifact qualification remain HOLD.**

Browser capability default **ON** remains the desired product behavior; destinations still default to an empty allowlist. This is source acceptance of the reviewed browser/structure lane, not package-wide, canonical-contract, renderer-admission, deployment or live-browser acceptance. Prior XML-memory and raw-PDF-stream-cap recommendations stay nonblocking; this change provides no material new regression that would change their disposition.

## Exact source and integration

- Candidate: [81e20025b7a805ac28a44f2044df87b0ebab905b](https://github.com/neo-capiro/meri-greenfield/commit/81e20025b7a805ac28a44f2044df87b0ebab905b), supplied branch `fable/repair-package-3-20261015`.
- Read the [package-3 report](https://github.com/neo-capiro/meri-greenfield/blob/81e20025b7a805ac28a44f2044df87b0ebab905b/docs/coordination/reports/FABLE-REPAIR-PACKAGE-3-20261015.md#L1-L16), including its 12-malformed-file claim and explicit source/live separation.
- GitHub comparison confirms package-2 reviewed pin `69040f9b4ab2d239bec1a057354d578d2bf24b1e` is an ancestor: 41 commits ahead, zero behind, merge base equal to that pin.
- PDF lane pin [b6dc012c65830b018524a61433074f66722e1baa](https://github.com/neo-capiro/meri-greenfield/commit/b6dc012c65830b018524a61433074f66722e1baa) is an ancestor: 36 commits ahead, zero behind. No `apps/artifacts/structure/` changes between that lane pin and this integrated pin.
- Structure changes since package 2 are limited to `pdf.mjs`, the closed refusal reason list, structure tests and fixtures. Browser modules/tests, OOXML/XML/ZIP readers, PDF object reader, usable-file grader, root package and root lockfile are unchanged. Existing lock-verified saxes 6.0.0 dependencies were reused; no new installation or lock edits were needed.
- 52 materialized source files were verified against Git blob SHA-1 hashes. Unchanged package-2 blobs were reconciled with the exact comparison; changed source files were fetched at the exact package-3 pin. This is a focused source mirror, not a complete checkout.

## R1 repair: ACCEPT

Previously the catalog's `/Pages` merely needed an object number marked in use, so `/Pages 2 1 R` passed when the xref defined object 2 generation 0. The candidate now sends `/Pages` through the same indirect-object resolver used for the catalog:

1. In-use objects require exact reference generation agreement; compressed objects require generation zero. The object reader also checks the actual object number and generation at the xref offset. Sources: [resolver, lines 94–115](https://github.com/neo-capiro/meri-greenfield/blob/81e20025b7a805ac28a44f2044df87b0ebab905b/apps/artifacts/structure/pdf.mjs#L94-L115), [object reader, lines 61–75](https://github.com/neo-capiro/meri-greenfield/blob/81e20025b7a805ac28a44f2044df87b0ebab905b/apps/artifacts/structure/pdf-objects.mjs#L61-L75).
2. The page-tree walk resolves every child, requires a `Pages` root, validates `Kids`/leaf `Page` types, verifies each child's exact-number-and-generation `Parent`, checks `Count` against reached leaves and rejects repeated nodes. It is bounded by one million visited nodes and depth 256. Sources: [page-tree walk, lines 117–136](https://github.com/neo-capiro/meri-greenfield/blob/81e20025b7a805ac28a44f2044df87b0ebab905b/apps/artifacts/structure/pdf.mjs#L117-L136), [entry point, lines 138–149](https://github.com/neo-capiro/meri-greenfield/blob/81e20025b7a805ac28a44f2044df87b0ebab905b/apps/artifacts/structure/pdf.mjs#L138-L149).
3. Both validator and consumers retain closed refusal behavior. Structure rejection occurs before artifact ingest in the download port: [downloads, lines 35–60](https://github.com/neo-capiro/meri-greenfield/blob/81e20025b7a805ac28a44f2044df87b0ebab905b/apps/worker/conversation/browser/downloads.mjs#L35-L60).

### Independent retained-byte reproduction

Rebuilt the exact previous 341-byte generation probe using the retained package-2 fixture and the same equal-length substitution. SHA-256:

`5f92cd85b9a666b68e268ff38be2fe22996b125baf862710217bfb3cd915cf06`

- Package-2 validator: `{valid:true}`.
- Package-3 validator: `{valid:false,reason:"PDF_PAGE_TREE"}`.

### Independently reproduced all 12 claimed negatives

The [12 added negative assertions](https://github.com/neo-capiro/meri-greenfield/blob/81e20025b7a805ac28a44f2044df87b0ebab905b/apps/artifacts/structure/test/file-structure.test.mjs#L116-L128) cover:

1. Wrong `/Pages` generation 5.
2. Retained wrong generation 1.
3. Compressed page-tree root referenced with nonzero generation.
4. Compressed catalog naming a wrong-generation page-tree root.
5. `/Pages` naming a page leaf.
6. `/Pages` naming the catalog.
7. Wrong page-tree root type.
8. `Count` inconsistent with leaves.
9. `Kids` not an array.
10. Page-tree self-cycle.
11. Wrong leaf `Parent`.
12. Missing leaf `Parent`.

Using identical bytes for each old/new comparison, **12/12 pass the old validator and 12/12 reject in the new validator with `PDF_PAGE_TREE`**. All 12 also reject in the current usable-file grader and synthetic download port. Download effects: **zero artifact ingests, zero receipts**.

An additional independent classic-PDF writer verifies coherent nonzero generations (page-tree object generation 7, leaf generation 4) pass, while individually wrong `Pages`, `Kids` and `Parent` generations reject. This guards against a repair that simply bans every nonzero generation. The committed suite also passes the positive compressed-page-tree-root case.

## Previous corrections: no scoped regression

- **H1/H2 structural XML/ZIP/PDF negatives:** all 11 retained independent malformed inputs still reject in both validator and grader. Strict XML parsing, ZIP central/local agreement, path rules and decompression limits are unchanged.
- **Interaction approval and download races:** committed tests still pass for excluding interaction tools from `allowedTools`, pre-execution ask/deny, duplicate and concurrent download reservations, and unknown-ingest claim retention. Sources: [fragment, lines 24–35](https://github.com/neo-capiro/meri-greenfield/blob/81e20025b7a805ac28a44f2044df87b0ebab905b/apps/worker/conversation/browser/fragment.mjs#L24-L35), [download reservations, lines 31–60](https://github.com/neo-capiro/meri-greenfield/blob/81e20025b7a805ac28a44f2044df87b0ebab905b/apps/worker/conversation/browser/downloads.mjs#L31-L60).
- **H3 effective egress allowlist:** mandatory effective-origin enforcement for every connection/hop remains in the unchanged activation requirements. Reference negative tests pass; actual host enforcement is still unqualified. [Activation requirements, lines 10–24](https://github.com/neo-capiro/meri-greenfield/blob/81e20025b7a805ac28a44f2044df87b0ebab905b/apps/worker/conversation/browser/activation.mjs#L10-L24).
- **H4 raw tenant/role types:** browser partial-field validation still precedes normalization; mistyped booleans and related negative tests pass. [Resolution, lines 67–90](https://github.com/neo-capiro/meri-greenfield/blob/81e20025b7a805ac28a44f2044df87b0ebab905b/apps/worker/conversation/browser/resolution.mjs#L67-L90).
- **H5 approval deadline:** unchanged bounded timer/abort race and tool-use/input-digest binding; abort, timeout and late-answer tests pass. [Permissions, lines 21–36](https://github.com/neo-capiro/meri-greenfield/blob/81e20025b7a805ac28a44f2044df87b0ebab905b/apps/worker/conversation/browser/permissions.mjs#L21-L36), [decision binding, lines 69–90](https://github.com/neo-capiro/meri-greenfield/blob/81e20025b7a805ac28a44f2044df87b0ebab905b/apps/worker/conversation/browser/permissions.mjs#L69-L90).
- **Integration adjacency:** package 3 adds general-read mounting to conversation options; its allowed tools are restricted to `mcp__meri_reads__...`. The activity still composes SDK capabilities, selected-skill reads and general reads, without mounting the browser fragment. No browser permission bypass or activation regression was introduced by these adjacent changes in the reviewed source. This is a narrow static integration check, not acceptance of the new reads lane or its proposals. Sources: [read option validation, lines 8–25](https://github.com/neo-capiro/meri-greenfield/blob/81e20025b7a805ac28a44f2044df87b0ebab905b/apps/worker/conversation/reads/options.mjs#L8-L25), [activity composition, lines 40–47](https://github.com/neo-capiro/meri-greenfield/blob/81e20025b7a805ac28a44f2044df87b0ebab905b/apps/worker/conversation/activity.mjs#L40-L47).

## Tests actually run and limits

Node v24.19.0, isolated cloud review directory:

- `node --test apps/worker/conversation/browser/test/*.test.mjs apps/artifacts/structure/test/*.test.mjs`: **43/43 passed**, zero skipped (33 browser test cases, 10 structure test cases; the 12 new malformed assertions are inside one structure test).
- Retained generation probe: old accepts, current rejects.
- Twelve-case old/new validator comparison, current grader and synthetic download integration: **12/12 passed**.
- Additional nonzero-generation positive and three precise generation-negative probes: **4/4 passed**.
- Retained prior malformed files: **11/11 rejected** by both validator and grader.

No actual browser, MCP process, SDK/provider call, renderer, cloud resource, database, deployment or migration was used. The full conversation/P2a, reads, package-wide and complete Promptfoo suites were not rerun by this review. Package-3 author test totals remain author evidence, not independent results. No stopped P2b probe was attempted. Native file open/render and adversarial host/browser egress remain UNRUN.

The product's [default ON policy](https://github.com/neo-capiro/meri-greenfield/blob/81e20025b7a805ac28a44f2044df87b0ebab905b/apps/worker/conversation/browser/policy.mjs#L27-L32) and [held entry point](https://github.com/neo-capiro/meri-greenfield/blob/81e20025b7a805ac28a44f2044df87b0ebab905b/apps/worker/conversation/browser/index.mjs#L18-L25) are unchanged. Accepting R1 does not open that gate or freeze pending platform/tenant/approval contracts. Qualified renderer binding and PDF admission remain separately owned decisions.

## Evidence

Directory: `/workspace/scratch/cd02fe8d9ebf/browser-review-81e20025/`.

Current evidence: `package3-source-manifest.json`, `package3-compare-evidence.json`, `browser-structure-tests-package3.log`, `probe-package3-pdf.mjs`, `package3-pdf-probes.json`, `package3-pdf-probes.log`, `retained-negative-package3.log`, `retained-negative-results.json`.

All test commands exited. Synthetic temporary download directories were removed in `finally`. No implementation source edits, remote writes or gate changes were made. No additional source repair is requested by this bounded browser/PDF re-review.

